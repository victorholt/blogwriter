import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ============================================================
// Types
// ============================================================

export interface DirectConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface AwsKeyMappings {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

export interface TableInfo {
  tableName: string;
  rowCount: number;
}

export interface MigrationProgress {
  table: string;
  status: 'pending' | 'copying' | 'done' | 'error';
  copied: number;
  total: number;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  tables: MigrationProgress[];
  duration: number;
  error?: string;
}

export interface ExportPayload {
  exportedAt: string;
  database: string;
  tableCount: number;
  rowCount: number;
  tables: Record<string, unknown[]>;
}

export interface TargetCheckResult {
  reachable: boolean;
  hasData: boolean;
  hasSchema: boolean;
  tables: TableInfo[];
  error?: string;
}

// ============================================================
// Table ordering (FK dependency)
// ============================================================

const TABLE_MIGRATION_ORDER = [
  // Tier 1: No FK dependencies
  'users',
  'app_settings',
  'agent_model_configs',
  'agent_additional_instructions',
  'agent_logs',
  'audit_logs',
  'brand_voice_cache',
  'cached_dresses',
  'themes',
  'brand_labels',
  'voice_presets',
  // Tier 2: Depends on users
  'spaces',
  // Tier 3: Depends on spaces
  'space_members',
  'blog_sessions',
  'saved_brand_voices',
  // Tier 4: Depends on blog_sessions
  'shared_blogs',
];

// Tables with serial integer PKs that need sequence resets
const SERIAL_PK_TABLES = [
  'app_settings',
  'agent_model_configs',
  'agent_additional_instructions',
  'brand_voice_cache',
  'cached_dresses',
  'shared_blogs',
  'themes',
  'brand_labels',
  'voice_presets',
  'space_members',
];

// ============================================================
// Connection helpers
// ============================================================

export function buildConnectionString(params: DirectConnectionParams): string {
  const { host, port, username, password, database } = params;
  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/** Build pool options with SSL for non-local connections */
function poolOptions(connectionString: string, timeoutMs = 5000) {
  const isLocal = connectionString.includes('@localhost') || connectionString.includes('@postgres:');
  return {
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}

export function maskConnectionString(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//*****:*****@${u.host}${u.pathname}`;
  } catch {
    return '****';
  }
}

export async function fetchAwsCredentials(
  secretId: string,
  keyMappings: AwsKeyMappings,
): Promise<DirectConnectionParams> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  const secret = JSON.parse(response.SecretString);

  return {
    host: secret[keyMappings.host],
    port: parseInt(secret[keyMappings.port] || '5432', 10),
    username: secret[keyMappings.username],
    password: secret[keyMappings.password],
    database: secret[keyMappings.database],
  };
}

export async function testConnection(
  connectionString: string,
): Promise<{ version: string }> {
  const pool = new Pool(poolOptions(connectionString));
  try {
    const result = await pool.query('SELECT version()');
    const version = (result.rows[0]?.version as string) || 'Unknown';
    // Extract "PostgreSQL X.Y" from the full version string
    const match = version.match(/PostgreSQL [\d.]+/);
    return { version: match?.[0] || version };
  } finally {
    await pool.end();
  }
}

// ============================================================
// Analysis
// ============================================================

export async function getTableCounts(pool: Pool): Promise<TableInfo[]> {
  // Use pg_stat_user_tables for a quick estimate, then get exact counts
  const tables = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const results: TableInfo[] = [];
  for (const row of tables.rows) {
    const name = row.tablename as string;
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${name}"`);
    results.push({
      tableName: name,
      rowCount: parseInt(countResult.rows[0].count, 10),
    });
  }

  return results;
}

// ============================================================
// Schema creation on target
// ============================================================

export async function createSchemaOnTarget(targetPool: Pool): Promise<void> {
  const drizzleDir = join(__dirname, '../../drizzle');
  const journalPath = join(drizzleDir, 'meta', '_journal.json');

  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
  const entries = journal.entries as Array<{
    idx: number;
    tag: string;
    when: number;
  }>;

  const client = await targetPool.connect();
  try {
    // Create Drizzle migration tracking table
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS drizzle;
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    for (const entry of entries) {
      const sqlPath = join(drizzleDir, `${entry.tag}.sql`);
      const sql = readFileSync(sqlPath, 'utf-8');

      // Split on Drizzle's statement breakpoint marker
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await client.query('BEGIN');
      try {
        for (const stmt of statements) {
          await client.query(stmt);
        }
        // Record migration as applied
        await client.query(
          'INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
          [entry.tag, entry.when],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

// ============================================================
// Data migration
// ============================================================

const BATCH_SIZE = 500;

async function copyTable(
  source: Pool,
  target: Pool,
  tableName: string,
): Promise<number> {
  const { rows } = await source.query(`SELECT * FROM "${tableName}"`);
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let copied = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const values = columns.map((c) => row[c]);
      await target.query(insertSql, values);
      copied++;
    }
  }

  return copied;
}

export async function copyAllTables(
  source: Pool,
  target: Pool,
  onProgress: (p: MigrationProgress) => void,
): Promise<MigrationResult> {
  const start = Date.now();
  const results: MigrationProgress[] = [];

  // Get source counts for progress tracking
  const sourceCounts = await getTableCounts(source);
  const countMap = new Map(sourceCounts.map((t) => [t.tableName, t.rowCount]));

  for (const table of TABLE_MIGRATION_ORDER) {
    const total = countMap.get(table) ?? 0;
    const progress: MigrationProgress = {
      table,
      status: 'copying',
      copied: 0,
      total,
    };
    onProgress(progress);

    try {
      const copied = await copyTable(source, target, table);
      progress.status = 'done';
      progress.copied = copied;
      onProgress(progress);
    } catch (err) {
      progress.status = 'error';
      progress.error = err instanceof Error ? err.message : 'Unknown error';
      onProgress(progress);
    }

    results.push({ ...progress });
  }

  const hasErrors = results.some((r) => r.status === 'error');
  return {
    success: !hasErrors,
    tables: results,
    duration: Date.now() - start,
    error: hasErrors ? 'Some tables failed to copy' : undefined,
  };
}

// ============================================================
// Import from JSON export
// ============================================================

async function importTableFromRows(
  target: Pool,
  tableName: string,
  rows: unknown[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const firstRow = rows[0] as Record<string, unknown>;
  const columns = Object.keys(firstRow);
  const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let copied = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const r = row as Record<string, unknown>;
      const values = columns.map((c) => r[c]);
      await target.query(insertSql, values);
      copied++;
    }
  }

  return copied;
}

export async function importFromJson(
  target: Pool,
  payload: ExportPayload,
  onProgress: (p: MigrationProgress) => void,
): Promise<MigrationResult> {
  const start = Date.now();
  const results: MigrationProgress[] = [];

  // Get set of tables that actually exist in the current schema
  const existingTables = await target.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const existingSet = new Set(existingTables.rows.map((r: { tablename: string }) => r.tablename));

  for (const table of TABLE_MIGRATION_ORDER) {
    const rows = payload.tables[table];

    // Skip tables not in export or not in current schema
    if (!rows || !existingSet.has(table)) continue;

    const total = rows.length;
    const progress: MigrationProgress = {
      table,
      status: 'copying',
      copied: 0,
      total,
    };
    onProgress(progress);

    try {
      const copied = await importTableFromRows(target, table, rows);
      progress.status = 'done';
      progress.copied = copied;
      onProgress(progress);
    } catch (err) {
      progress.status = 'error';
      progress.error = err instanceof Error ? err.message : 'Unknown error';
      onProgress(progress);
    }

    results.push({ ...progress });
  }

  const hasErrors = results.some((r) => r.status === 'error');
  return {
    success: !hasErrors,
    tables: results,
    duration: Date.now() - start,
    error: hasErrors ? 'Some tables failed to import' : undefined,
  };
}

// ============================================================
// Sequence reset
// ============================================================

export async function resetSequences(targetPool: Pool): Promise<void> {
  for (const table of SERIAL_PK_TABLES) {
    try {
      await targetPool.query(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
          false
        )
      `);
    } catch {
      // Table may not exist or may not have a serial column — skip
    }
  }
}

// ============================================================
// Target check
// ============================================================

export async function checkTarget(
  connectionString: string,
): Promise<TargetCheckResult> {
  const pool = new Pool(poolOptions(connectionString));
  try {
    // Check if we can connect
    await pool.query('SELECT 1');

    // Get tables
    const tables = await getTableCounts(pool);
    const hasSchema = tables.length > 0;
    const hasData = tables.some((t) => t.rowCount > 0);

    return { reachable: true, hasData, hasSchema, tables };
  } catch (err) {
    return {
      reachable: false,
      hasData: false,
      hasSchema: false,
      tables: [],
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  } finally {
    await pool.end();
  }
}

// ============================================================
// Verification
// ============================================================

export async function verifyMigration(
  source: Pool,
  targetConnectionString: string,
): Promise<{
  match: boolean;
  comparison: Array<{
    table: string;
    sourceCount: number;
    targetCount: number;
  }>;
}> {
  const targetPool = new Pool(poolOptions(targetConnectionString));

  try {
    const sourceCounts = await getTableCounts(source);
    const targetCounts = await getTableCounts(targetPool);

    const targetMap = new Map(
      targetCounts.map((t) => [t.tableName, t.rowCount]),
    );

    const comparison = sourceCounts.map((s) => ({
      table: s.tableName,
      sourceCount: s.rowCount,
      targetCount: targetMap.get(s.tableName) ?? 0,
    }));

    const match = comparison.every((c) => c.sourceCount === c.targetCount);

    return { match, comparison };
  } finally {
    await targetPool.end();
  }
}
