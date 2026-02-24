const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Types ---

export interface SourceDbInfo {
  url: string;
  healthy: boolean;
  version: string;
}

export interface StoredTargetConfig {
  mode: 'direct' | 'aws';
  host?: string;
  port?: number;
  username?: string;
  database?: string;
  secretId?: string;
  keyMappings?: {
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
  };
}

export interface DatabaseStatus {
  sourceDb: SourceDbInfo;
  targetConfig: StoredTargetConfig | null;
}

export interface TableInfo {
  table: string;
  count: number;
}

export interface TargetCheckResult {
  reachable: boolean;
  hasSchema: boolean;
  hasData: boolean;
  version: string;
}

export interface VerifyResult {
  match: boolean;
  tables: Array<{ table: string; source: number; target: number; match: boolean }>;
}

export interface MigrationProgress {
  table: string;
  status: 'copying' | 'done' | 'error';
  copied: number;
  total: number;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  duration: number;
  tables: Array<{ table: string; copied: number; total: number }>;
}

// --- Direct config (for configure + operations that need password) ---

export interface DirectConfig {
  mode: 'direct';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface AwsConfig {
  mode: 'aws';
  secretId: string;
  keyMappings: {
    host: string;
    port: string;
    username: string;
    password: string;
    database: string;
  };
}

export type TargetConfig = DirectConfig | AwsConfig;

// --- API functions ---

export async function fetchDatabaseStatus(): Promise<ApiResponse<DatabaseStatus>> {
  const res = await fetch(`${API_BASE}/api/admin/database/status`, { credentials: 'include' });
  return res.json();
}

export function exportDatabaseUrl(): string {
  return `${API_BASE}/api/admin/database/export`;
}

export async function testTargetConnection(config: TargetConfig): Promise<ApiResponse<{ connected: boolean; version: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/database/external/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function configureTargetDb(config: TargetConfig): Promise<ApiResponse<{ connected: boolean; version: string; host: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/database/external/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function testTargetDb(password?: string): Promise<ApiResponse<{ connected: boolean; version: string }>> {
  const res = await fetch(`${API_BASE}/api/admin/database/external/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  return res.json();
}

export async function removeTargetDb(): Promise<ApiResponse<void>> {
  const res = await fetch(`${API_BASE}/api/admin/database/external`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.json();
}

export async function analyzeSourceDb(): Promise<ApiResponse<{ tables: TableInfo[] }>> {
  const res = await fetch(`${API_BASE}/api/admin/database/analyze`, { credentials: 'include' });
  return res.json();
}

export async function checkTargetDb(password?: string): Promise<ApiResponse<TargetCheckResult>> {
  const res = await fetch(`${API_BASE}/api/admin/database/check-target`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  return res.json();
}

export async function streamMigration(
  password: string | undefined,
  onStatus: (message: string) => void,
  onProgress: (progress: MigrationProgress) => void,
  onResult: (result: MigrationResult) => void,
  onError: (error: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/database/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({ error: 'Migration request failed' }));
    onError(json.error || `HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function processLine(line: string): void {
    if (!line.startsWith('data: ')) return;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'status') onStatus(event.data);
      else if (event.type === 'progress') onProgress(event.data);
      else if (event.type === 'result') onResult(event.data);
      else if (event.type === 'error') onError(event.data);
    } catch { /* skip malformed lines */ }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line.trim());
      }
    }
    if (buffer.trim()) processLine(buffer.trim());
  } finally {
    reader.releaseLock();
  }
}

// --- Import ---

export interface ImportSummary {
  exportedAt: string;
  database: string;
  tableCount: number;
  rowCount: number;
  tables: Array<{ table: string; rows: number }>;
}

export function parseExportFile(file: File): Promise<{ summary: ImportSummary; raw: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const data = JSON.parse(raw);

        if (!data.exportedAt || !data.tables || typeof data.tables !== 'object') {
          throw new Error('Invalid export file format');
        }

        const tables = Object.entries(data.tables).map(([table, rows]) => ({
          table,
          rows: Array.isArray(rows) ? rows.length : 0,
        }));

        resolve({
          summary: {
            exportedAt: data.exportedAt,
            database: data.database || 'unknown',
            tableCount: data.tableCount || tables.length,
            rowCount: data.rowCount || tables.reduce((sum, t) => sum + t.rows, 0),
            tables,
          },
          raw,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse export file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function streamImport(
  exportJson: string,
  onStatus: (message: string) => void,
  onProgress: (progress: MigrationProgress) => void,
  onResult: (result: MigrationResult) => void,
  onError: (error: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/database/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: exportJson,
  });

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({ error: 'Import request failed' }));
    onError(json.error || `HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function processLine(line: string): void {
    if (!line.startsWith('data: ')) return;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === 'status') onStatus(event.data);
      else if (event.type === 'progress') onProgress(event.data);
      else if (event.type === 'result') onResult(event.data);
      else if (event.type === 'error') onError(event.data);
    } catch { /* skip malformed lines */ }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line.trim());
      }
    }
    if (buffer.trim()) processLine(buffer.trim());
  } finally {
    reader.releaseLock();
  }
}

export async function verifyMigration(password?: string): Promise<ApiResponse<VerifyResult>> {
  const res = await fetch(`${API_BASE}/api/admin/database/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  return res.json();
}
