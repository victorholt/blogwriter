import { Router } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { pool as sourcePool } from '../db';
import { db } from '../db';
import { appSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  buildConnectionString,
  maskConnectionString,
  fetchAwsCredentials,
  testConnection,
  getTableCounts,
  createSchemaOnTarget,
  copyAllTables,
  resetSequences,
  checkTarget,
  verifyMigration,
  importFromJson,
  type DirectConnectionParams,
  type AwsKeyMappings,
  type ExportPayload,
} from '../services/database-migration';

const router = Router();

const CONFIG_KEY = 'db_migration_config';

let migrating = false;

// ============================================================
// Helpers
// ============================================================

interface StoredConfig {
  mode: 'direct' | 'aws';
  // Direct mode
  host?: string;
  port?: number;
  username?: string;
  database?: string;
  // AWS mode
  secretId?: string;
  keyMappings?: AwsKeyMappings;
}

async function loadStoredConfig(): Promise<StoredConfig | null> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CONFIG_KEY))
    .limit(1);

  if (!rows[0]?.value) return null;
  try {
    return JSON.parse(rows[0].value) as StoredConfig;
  } catch {
    return null;
  }
}

async function saveConfig(config: StoredConfig): Promise<void> {
  const value = JSON.stringify(config);
  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CONFIG_KEY))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettings.key, CONFIG_KEY));
  } else {
    await db.insert(appSettings).values({ key: CONFIG_KEY, value });
  }
}

async function resolveTargetConnectionString(
  config: StoredConfig,
  password?: string,
): Promise<string> {
  if (config.mode === 'aws') {
    if (!config.secretId || !config.keyMappings) {
      throw new Error('AWS secret config incomplete');
    }
    const creds = await fetchAwsCredentials(config.secretId, config.keyMappings);
    return buildConnectionString(creds);
  }

  // Direct mode
  if (!config.host || !config.username || !config.database) {
    throw new Error('Direct connection config incomplete');
  }
  if (!password) {
    throw new Error('Password is required for direct connections');
  }
  return buildConnectionString({
    host: config.host,
    port: config.port || 5432,
    username: config.username,
    password,
    database: config.database,
  });
}

// ============================================================
// Routes
// ============================================================

// --- Status ---

router.get('/status', async (_req, res) => {
  try {
    // Check source (current DB)
    let sourceHealthy = false;
    let sourceVersion = '';
    try {
      const result = await sourcePool.query('SELECT version()');
      sourceHealthy = true;
      const v = (result.rows[0]?.version as string) || '';
      sourceVersion = v.match(/PostgreSQL [\d.]+/)?.[0] || v;
    } catch {
      // unhealthy
    }

    const config = await loadStoredConfig();

    return res.json({
      success: true,
      data: {
        sourceDb: {
          url: maskConnectionString(process.env.DATABASE_URL || ''),
          healthy: sourceHealthy,
          version: sourceVersion,
        },
        targetConfig: config,
      },
    });
  } catch (err) {
    console.error('[Database] Status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// --- Configure target ---

const directSchema = z.object({
  mode: z.literal('direct'),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
});

const awsSchema = z.object({
  mode: z.literal('aws'),
  secretId: z.string().min(1),
  keyMappings: z.object({
    host: z.string().min(1).default('host'),
    port: z.string().min(1).default('port'),
    username: z.string().min(1).default('username'),
    password: z.string().min(1).default('password'),
    database: z.string().min(1).default('dbname'),
  }),
});

const configureSchema = z.discriminatedUnion('mode', [directSchema, awsSchema]);

router.post('/external/configure', async (req, res) => {
  const parsed = configureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.message });
  }

  const data = parsed.data;

  try {
    let connectionString: string;
    let params: DirectConnectionParams;

    if (data.mode === 'aws') {
      params = await fetchAwsCredentials(data.secretId, data.keyMappings);
      connectionString = buildConnectionString(params);
    } else {
      params = {
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        database: data.database,
      };
      connectionString = buildConnectionString(params);
    }

    // Test the connection
    const { version } = await testConnection(connectionString);

    // Save config (without password for direct mode)
    const storedConfig: StoredConfig =
      data.mode === 'aws'
        ? { mode: 'aws', secretId: data.secretId, keyMappings: data.keyMappings }
        : { mode: 'direct', host: data.host, port: data.port, username: data.username, database: data.database };

    await saveConfig(storedConfig);

    return res.json({
      success: true,
      data: { connected: true, version, host: params.host },
    });
  } catch (err) {
    console.error('[Database] Configure error:', err);
    const message = err instanceof Error ? err.message : 'Configuration failed';
    return res.json({ success: false, error: message });
  }
});

// --- Test connection (without saving) ---

router.post('/external/test-connection', async (req, res) => {
  const parsed = configureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.message });
  }

  const data = parsed.data;

  try {
    let connectionString: string;

    if (data.mode === 'aws') {
      const creds = await fetchAwsCredentials(data.secretId, data.keyMappings);
      connectionString = buildConnectionString(creds);
    } else {
      connectionString = buildConnectionString({
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        database: data.database,
      });
    }

    const { version } = await testConnection(connectionString);
    return res.json({ success: true, data: { connected: true, version } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return res.json({ success: false, error: message });
  }
});

// --- Test stored config ---

router.post('/external/test', async (req, res) => {
  try {
    const config = await loadStoredConfig();
    if (!config) {
      return res.json({ success: false, error: 'No target database configured' });
    }

    // For direct mode, password must be provided in the body
    const password = req.body?.password;
    const connectionString = await resolveTargetConnectionString(config, password);
    const { version } = await testConnection(connectionString);

    return res.json({ success: true, data: { connected: true, version } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return res.json({ success: false, error: message });
  }
});

// --- Remove config ---

router.delete('/external', async (_req, res) => {
  try {
    await db.delete(appSettings).where(eq(appSettings.key, CONFIG_KEY));
    return res.json({ success: true });
  } catch (err) {
    console.error('[Database] Remove config error:', err);
    return res.status(500).json({ success: false, error: 'Failed to remove config' });
  }
});

// --- Export (local only) ---

router.get('/export', async (_req, res) => {
  // Only allow when source DB is the local Docker postgres container
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('@postgres:')) {
    return res.status(403).json({ success: false, error: 'Export is only available on local environments' });
  }

  try {
    const tables = await getTableCounts(sourcePool);
    const data: Record<string, unknown[]> = {};

    for (const t of tables) {
      const result = await sourcePool.query(`SELECT * FROM "${t.tableName}"`);
      data[t.tableName] = result.rows;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      database: dbUrl.split('/').pop()?.split('?')[0] || 'unknown',
      tableCount: tables.length,
      rowCount: tables.reduce((sum, t) => sum + t.rowCount, 0),
      tables: data,
    };

    const filename = `blogwriter-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    console.error('[Database] Export error:', err);
    return res.status(500).json({ success: false, error: 'Export failed' });
  }
});

// --- Import from JSON export ---

const importPayloadSchema = z.object({
  exportedAt: z.string(),
  database: z.string(),
  tableCount: z.number(),
  rowCount: z.number(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});

router.post('/import', async (req, res) => {
  if (migrating) {
    return res.status(409).json({ success: false, error: 'A migration or import is already in progress' });
  }

  const parsed = importPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid export file format',
    });
  }

  const payload = parsed.data as ExportPayload;
  migrating = true;

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (type: string, data: unknown) => {
    try {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { /* closed */ }
  }, 15_000);

  try {
    sendEvent('status', `Importing ${payload.rowCount} rows from ${payload.tableCount} tables...`);

    const result = await importFromJson(sourcePool, payload, (progress) => {
      sendEvent('progress', progress);
    });

    sendEvent('status', 'Resetting sequences...');
    await resetSequences(sourcePool);

    sendEvent('result', result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    console.error('[Database] Import error:', err);
    sendEvent('error', message);
  } finally {
    migrating = false;
    clearInterval(heartbeat);
    res.end();
  }
});

// --- Analyze source ---

router.get('/analyze', async (_req, res) => {
  try {
    const raw = await getTableCounts(sourcePool);
    const tables = raw.map((t) => ({ table: t.tableName, count: t.rowCount }));
    return res.json({ success: true, data: { tables } });
  } catch (err) {
    console.error('[Database] Analyze error:', err);
    return res.status(500).json({ success: false, error: 'Failed to analyze database' });
  }
});

// --- Check target ---

router.post('/check-target', async (req, res) => {
  try {
    const config = await loadStoredConfig();
    if (!config) {
      return res.json({ success: false, error: 'No target database configured' });
    }

    const password = req.body?.password;
    const connectionString = await resolveTargetConnectionString(config, password);
    const result = await checkTarget(connectionString);

    return res.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Target check failed';
    return res.json({ success: false, error: message });
  }
});

// --- Migrate (SSE) ---

router.post('/migrate', async (req, res) => {
  if (migrating) {
    return res.status(409).json({ success: false, error: 'Migration already in progress' });
  }

  const config = await loadStoredConfig();
  if (!config) {
    return res.json({ success: false, error: 'No target database configured' });
  }

  migrating = true;

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (type: string, data: unknown) => {
    try {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch { /* closed */ }
  }, 15_000);

  let targetPool: Pool | null = null;

  try {
    const password = req.body?.password;
    const connectionString = await resolveTargetConnectionString(config, password);
    const isLocal = connectionString.includes('@localhost') || connectionString.includes('@postgres:');
    targetPool = new Pool({
      connectionString,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
    });

    // Step 1: Create schema
    sendEvent('status', 'Creating schema on target...');
    await createSchemaOnTarget(targetPool);
    sendEvent('status', 'Schema created. Copying data...');

    // Step 2: Copy data
    const result = await copyAllTables(sourcePool, targetPool, (progress) => {
      sendEvent('progress', progress);
    });

    // Step 3: Reset sequences
    sendEvent('status', 'Resetting sequences...');
    await resetSequences(targetPool);

    sendEvent('result', result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Migration failed';
    console.error('[Database] Migration error:', err);
    sendEvent('error', message);
  } finally {
    migrating = false;
    clearInterval(heartbeat);
    if (targetPool) await targetPool.end();
    res.end();
  }
});

// --- Verify ---

router.post('/verify', async (req, res) => {
  try {
    const config = await loadStoredConfig();
    if (!config) {
      return res.json({ success: false, error: 'No target database configured' });
    }

    const password = req.body?.password;
    const connectionString = await resolveTargetConnectionString(config, password);
    const result = await verifyMigration(sourcePool, connectionString);

    return res.json({
      success: true,
      data: {
        match: result.match,
        tables: result.comparison.map((c) => ({
          table: c.table,
          source: c.sourceCount,
          target: c.targetCount,
          match: c.sourceCount === c.targetCount,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return res.json({ success: false, error: message });
  }
});

export default router;
