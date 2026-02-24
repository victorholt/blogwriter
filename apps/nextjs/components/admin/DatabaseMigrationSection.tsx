'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database, Loader2, Check, AlertTriangle, Circle, X,
  ChevronDown, ChevronRight, Server, Cloud, Trash2, ArrowRight, Download, Upload,
} from 'lucide-react';
import {
  fetchDatabaseStatus,
  testTargetConnection,
  configureTargetDb,
  removeTargetDb,
  analyzeSourceDb,
  checkTargetDb,
  streamMigration,
  verifyMigration as verifyMigrationApi,
  exportDatabaseUrl,
  parseExportFile,
  streamImport,
  type DatabaseStatus,
  type TargetConfig,
  type TableInfo,
  type TargetCheckResult,
  type MigrationProgress,
  type MigrationResult,
  type VerifyResult,
  type ImportSummary,
} from '@/lib/admin-database-api';

type Step = 'idle' | 'analyze' | 'check' | 'migrate' | 'verify';

const DEFAULT_KEY_MAPPINGS = {
  host: 'host',
  port: 'port',
  username: 'username',
  password: 'password',
  database: 'dbname',
};

export default function DatabaseMigrationSection(): React.ReactElement {
  // --- Section collapsed state ---
  const [sectionOpen, setSectionOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin:db-section-open') === '1';
    }
    return false;
  });

  // --- DB status ---
  const [status, setStatus] = useState<DatabaseStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // --- Target config form ---
  const [mode, setMode] = useState<'direct' | 'aws'>('direct');
  const [directForm, setDirectForm] = useState({ host: '', port: '5432', username: '', password: '', database: '' });
  const [awsSecretId, setAwsSecretId] = useState('');
  const [awsKeyMappingsOpen, setAwsKeyMappingsOpen] = useState(false);
  const [awsKeyMappings, setAwsKeyMappings] = useState({ ...DEFAULT_KEY_MAPPINGS });
  const [configuring, setConfiguring] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; version?: string; error?: string } | null>(null);
  const [configError, setConfigError] = useState('');
  const [targetConnected, setTargetConnected] = useState(false);
  const [targetVersion, setTargetVersion] = useState('');

  // --- Migration steps ---
  const [activeStep, setActiveStep] = useState<Step>('idle');
  const [sourceTables, setSourceTables] = useState<TableInfo[] | null>(null);
  const [targetCheck, setTargetCheck] = useState<TargetCheckResult | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress[]>([]);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [migrationOpen, setMigrationOpen] = useState(false);

  // --- Import state ---
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importRaw, setImportRaw] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [importParseError, setImportParseError] = useState('');
  const [importRunning, setImportRunning] = useState(false);
  const [importProgress, setImportProgress] = useState<MigrationProgress[]>([]);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<MigrationResult | null>(null);
  const [importError, setImportError] = useState('');
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  // --- Load status when section opens ---
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const result = await fetchDatabaseStatus();
      if (result.success && result.data) {
        setStatus(result.data);
        if (result.data.targetConfig) {
          setTargetConnected(true);
          const cfg = result.data.targetConfig;
          setMode(cfg.mode);
          if (cfg.mode === 'direct') {
            setDirectForm((prev) => ({
              ...prev,
              host: cfg.host || '',
              port: String(cfg.port || 5432),
              username: cfg.username || '',
              database: cfg.database || '',
            }));
          } else if (cfg.mode === 'aws') {
            setAwsSecretId(cfg.secretId || '');
            if (cfg.keyMappings) {
              setAwsKeyMappings({
                host: cfg.keyMappings.host || 'host',
                port: cfg.keyMappings.port || 'port',
                username: cfg.keyMappings.username || 'username',
                password: cfg.keyMappings.password || 'password',
                database: cfg.keyMappings.database || 'dbname',
              });
            }
          }
        }
      }
    } catch {
      // Ignore
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sectionOpen && !status) loadStatus();
  }, [sectionOpen, status, loadStatus]);

  // --- Helpers ---
  function getPassword(): string | undefined {
    if (mode === 'direct') return directForm.password || undefined;
    return undefined;
  }

  function toggleSection(): void {
    setSectionOpen((v) => {
      const next = !v;
      localStorage.setItem('admin:db-section-open', next ? '1' : '0');
      return next;
    });
  }

  // --- Build config from form ---
  function buildConfig(): TargetConfig {
    return mode === 'direct'
      ? {
        mode: 'direct' as const,
        host: directForm.host,
        port: parseInt(directForm.port, 10) || 5432,
        username: directForm.username,
        password: directForm.password,
        database: directForm.database,
      }
      : {
        mode: 'aws' as const,
        secretId: awsSecretId,
        keyMappings: { ...awsKeyMappings },
      };
  }

  // --- Test connection (no save) ---
  async function handleTestConnection(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    setConfigError('');
    try {
      const result = await testTargetConnection(buildConfig());
      if (result.success && result.data) {
        setTestResult({ success: true, version: result.data.version });
      } else {
        setTestResult({ success: false, error: result.error || 'Connection failed' });
      }
    } catch {
      setTestResult({ success: false, error: 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }

  // --- Connect target (test + save) ---
  async function handleConfigure(): Promise<void> {
    setConfiguring(true);
    setConfigError('');
    setTestResult(null);
    try {
      const result = await configureTargetDb(buildConfig());
      if (result.success && result.data) {
        setTargetConnected(true);
        setTargetVersion(result.data.version);
        setActiveStep('idle');
        setSourceTables(null);
        setTargetCheck(null);
        setMigrationProgress([]);
        setMigrationResult(null);
        setVerifyResult(null);
        setCompletedSteps(new Set());
      } else {
        setConfigError(result.error || 'Failed to connect');
      }
    } catch {
      setConfigError('Connection failed');
    } finally {
      setConfiguring(false);
    }
  }

  // --- Disconnect target ---
  async function handleRemoveTarget(): Promise<void> {
    await removeTargetDb();
    setTargetConnected(false);
    setTargetVersion('');
    setActiveStep('idle');
    setSourceTables(null);
    setTargetCheck(null);
    setMigrationProgress([]);
    setMigrationResult(null);
    setVerifyResult(null);
    setCompletedSteps(new Set());
    setMigrationOpen(false);
    setStatus((prev) => prev ? { ...prev, targetConfig: null } : prev);
  }

  // --- Step 1: Analyze ---
  async function handleAnalyze(): Promise<void> {
    setActiveStep('analyze');
    setStepLoading(true);
    setStepError('');
    try {
      const result = await analyzeSourceDb();
      if (result.success && result.data) {
        setSourceTables(result.data.tables);
        setCompletedSteps((prev) => new Set(prev).add('analyze'));
      } else {
        setStepError(result.error || 'Analysis failed');
      }
    } catch {
      setStepError('Failed to analyze source database');
    } finally {
      setStepLoading(false);
    }
  }

  // --- Step 2: Check target ---
  async function handleCheckTarget(): Promise<void> {
    setActiveStep('check');
    setStepLoading(true);
    setStepError('');
    try {
      const result = await checkTargetDb(getPassword());
      if (result.success && result.data) {
        setTargetCheck(result.data);
        setCompletedSteps((prev) => new Set(prev).add('check'));
      } else {
        setStepError(result.error || 'Target check failed');
      }
    } catch {
      setStepError('Failed to check target database');
    } finally {
      setStepLoading(false);
    }
  }

  // --- Step 3: Migrate ---
  async function handleMigrate(): Promise<void> {
    setShowConfirm(false);
    setActiveStep('migrate');
    setStepLoading(true);
    setStepError('');
    setMigrationProgress([]);
    setMigrationStatus('');
    setMigrationResult(null);

    try {
      await streamMigration(
        getPassword(),
        (msg) => setMigrationStatus(msg),
        (progress) => {
          setMigrationProgress((prev) => {
            const idx = prev.findIndex((p) => p.table === progress.table);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = progress;
              return updated;
            }
            return [...prev, progress];
          });
        },
        (result) => {
          setMigrationResult(result);
          setCompletedSteps((prev) => new Set(prev).add('migrate'));
        },
        (error) => setStepError(error),
      );
    } catch {
      setStepError('Migration connection failed');
    } finally {
      setStepLoading(false);
    }
  }

  // --- Step 4: Verify ---
  async function handleVerify(): Promise<void> {
    setActiveStep('verify');
    setStepLoading(true);
    setStepError('');
    try {
      const result = await verifyMigrationApi(getPassword());
      if (result.success && result.data) {
        setVerifyResult(result.data);
        setCompletedSteps((prev) => new Set(prev).add('verify'));
      } else {
        setStepError(result.error || 'Verification failed');
      }
    } catch {
      setStepError('Failed to verify migration');
    } finally {
      setStepLoading(false);
    }
  }

  // --- Import handlers ---

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportParsing(true);
    setImportParseError('');
    setImportSummary(null);
    setImportRaw('');
    setImportResult(null);
    setImportProgress([]);
    setImportError('');

    try {
      const { summary, raw } = await parseExportFile(file);
      setImportSummary(summary);
      setImportRaw(raw);
    } catch (err) {
      setImportParseError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setImportParsing(false);
    }
  }

  async function handleImportConfirm(): Promise<void> {
    setShowImportConfirm(false);
    setImportRunning(true);
    setImportError('');
    setImportProgress([]);
    setImportStatus('');
    setImportResult(null);

    try {
      await streamImport(
        importRaw,
        (msg) => setImportStatus(msg),
        (progress) => {
          setImportProgress((prev) => {
            const idx = prev.findIndex((p) => p.table === progress.table);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = progress;
              return updated;
            }
            return [...prev, progress];
          });
        },
        (result) => setImportResult(result),
        (error) => setImportError(error),
      );
    } catch {
      setImportError('Import connection failed');
    } finally {
      setImportRunning(false);
    }
  }

  function handleImportReset(): void {
    setImportSummary(null);
    setImportRaw('');
    setImportParseError('');
    setImportResult(null);
    setImportProgress([]);
    setImportStatus('');
    setImportError('');
    setShowImportConfirm(false);
    if (importFileRef.current) importFileRef.current.value = '';
  }

  const totalRows = sourceTables?.reduce((sum, t) => sum + t.count, 0) ?? 0;

  function isStepUnlocked(step: Step): boolean {
    switch (step) {
      case 'analyze': return targetConnected;
      case 'check': return completedSteps.has('analyze');
      case 'migrate': return completedSteps.has('check');
      case 'verify': return completedSteps.has('migrate');
      default: return false;
    }
  }

  function stepModifier(step: Step): string {
    if (completedSteps.has(step)) return 'db-migrate__step--complete';
    if (activeStep === step && stepLoading) return 'db-migrate__step--active';
    if (!isStepUnlocked(step)) return 'db-migrate__step--locked';
    return '';
  }

  const hasNonDefaultMappings = Object.entries(awsKeyMappings).some(
    ([k, v]) => v !== DEFAULT_KEY_MAPPINGS[k as keyof typeof DEFAULT_KEY_MAPPINGS],
  );

  return (
    <section className="settings-section">
      <button className="db-migrate__section-toggle" onClick={toggleSection}>
        {sectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Database size={16} />
        Database Connections
        {targetConnected && (
          <span className="db-migrate__pill db-migrate__pill--green" style={{ marginLeft: 6 }}>
            <Circle size={5} fill="currentColor" /> Target connected
          </span>
        )}
      </button>

      {sectionOpen && (
        <div className="db-migrate__section-body">
          {statusLoading ? (
            <div className="settings-loading">
              <Loader2 size={18} className="spin" />
            </div>
          ) : (
            <>
              {/* --- Source Database --- */}
              <div className="settings-card">
                <h3 className="settings-card__title">Source Database (active)</h3>
                <div className="db-migrate__url">{status?.sourceDb.url || 'Not configured'}</div>
                <div className="db-migrate__status-row">
                  {status?.sourceDb.healthy ? (
                    <span className="db-migrate__pill db-migrate__pill--green">
                      <Circle size={6} fill="currentColor" /> Connected
                    </span>
                  ) : (
                    <span className="db-migrate__pill db-migrate__pill--red">
                      <Circle size={6} fill="currentColor" /> Disconnected
                    </span>
                  )}
                  {status?.sourceDb.version && (
                    <span className="db-migrate__version">{status.sourceDb.version}</span>
                  )}
                </div>
                <p className="db-migrate__hint">This is the database the app is currently using.</p>

                <div className="db-migrate__source-actions">
                  {status?.sourceDb.url?.includes('@postgres:') && (
                    <a className="btn btn--sm btn--outline" href={exportDatabaseUrl()} download>
                      <Download size={12} /> Export JSON
                    </a>
                  )}
                  <button
                    className="btn btn--sm btn--outline"
                    onClick={() => importFileRef.current?.click()}
                    disabled={importRunning}
                  >
                    <Upload size={12} /> Import JSON
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportFileChange}
                  />
                </div>

                {importParsing && (
                  <div className="db-migrate__import-status">
                    <Loader2 size={14} className="spin" /> Reading file...
                  </div>
                )}

                {importParseError && (
                  <div className="db-migrate__import-error">
                    <X size={12} /> {importParseError}
                    <button className="btn btn--sm btn--ghost" onClick={handleImportReset}>Dismiss</button>
                  </div>
                )}

                {importSummary && !importResult && (
                  <div className="db-migrate__import-preview">
                    <div className="db-migrate__import-preview-header">
                      <strong>Import Preview</strong>
                      <button className="btn btn--sm btn--ghost" onClick={handleImportReset}>
                        <X size={12} />
                      </button>
                    </div>
                    <div className="db-migrate__import-meta">
                      <span>Exported: {new Date(importSummary.exportedAt).toLocaleString()}</span>
                      <span>Database: {importSummary.database}</span>
                      <span>{importSummary.tableCount} tables, {importSummary.rowCount} rows</span>
                    </div>
                    <div className="db-migrate__table-list">
                      {importSummary.tables.map((t) => (
                        <div className="db-migrate__table-row" key={t.table}>
                          <span className="db-migrate__table-name">{t.table}</span>
                          <span className="db-migrate__table-count">{t.rows}</span>
                        </div>
                      ))}
                    </div>

                    {!showImportConfirm && !importRunning && (
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => setShowImportConfirm(true)}
                        style={{ marginTop: 10 }}
                      >
                        Start Import
                      </button>
                    )}

                    {showImportConfirm && (
                      <div className="db-migrate__confirm" style={{ marginTop: 10 }}>
                        <p>
                          This will insert {importSummary.rowCount} rows into the current database.
                          Existing rows will not be overwritten (ON CONFLICT DO NOTHING).
                        </p>
                        <div className="db-migrate__confirm-actions">
                          <button className="btn btn--sm btn--primary" onClick={handleImportConfirm}>
                            Confirm Import
                          </button>
                          <button className="btn btn--sm btn--ghost" onClick={() => setShowImportConfirm(false)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(importProgress.length > 0 || importStatus) && (
                  <div className="db-migrate__import-progress">
                    {importStatus && !importResult && (
                      <p className="db-migrate__status-text">{importStatus}</p>
                    )}
                    {importProgress.length > 0 && (
                      <div className="db-migrate__progress-list">
                        {importProgress.map((p) => (
                          <div className="db-migrate__progress-row" key={p.table}>
                            <span className="db-migrate__progress-icon">
                              {p.status === 'done' ? (
                                <Check size={12} className="db-migrate__check-icon" />
                              ) : p.status === 'copying' ? (
                                <Loader2 size={12} className="spin" />
                              ) : p.status === 'error' ? (
                                <X size={12} style={{ color: 'var(--color-red)' }} />
                              ) : (
                                <Circle size={8} />
                              )}
                            </span>
                            <span className="db-migrate__progress-name">{p.table}</span>
                            <span className="db-migrate__progress-count">
                              {p.status === 'done' || p.status === 'copying' ? `${p.copied}/${p.total}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {importResult && (
                      <div className={importResult.success ? 'db-migrate__success' : 'db-migrate__warning'} style={{ marginTop: 10 }}>
                        {importResult.success ? (
                          <><Check size={14} /> Import complete in {(importResult.duration / 1000).toFixed(1)}s</>
                        ) : (
                          <><AlertTriangle size={14} /> Import completed with errors</>
                        )}
                      </div>
                    )}
                    {importResult && (
                      <button className="btn btn--sm btn--ghost" onClick={handleImportReset} style={{ marginTop: 8 }}>
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {importError && !importResult && (
                  <p className="error-text" style={{ marginTop: 8 }}>{importError}</p>
                )}
              </div>

              {/* --- Target Database --- */}
              <div className="settings-card">
                <div className="settings-card__title-row">
                  <h3 className="settings-card__title">Target Database</h3>
                  {targetConnected && (
                    <button className="btn btn--sm btn--outline btn--danger" onClick={handleRemoveTarget}>
                      <Trash2 size={12} /> Disconnect
                    </button>
                  )}
                </div>

                {!targetConnected ? (
                  <>
                    <div className="settings-field__radios" style={{ marginBottom: 14 }}>
                      <label className="settings-field__radio">
                        <input type="radio" name="db-mode" checked={mode === 'direct'} onChange={() => setMode('direct')} />
                        <Server size={14} /> Direct
                      </label>
                      <label className="settings-field__radio">
                        <input type="radio" name="db-mode" checked={mode === 'aws'} onChange={() => setMode('aws')} />
                        <Cloud size={14} /> AWS Secrets Manager
                      </label>
                    </div>

                    {mode === 'direct' ? (
                      <div className="db-migrate__direct-form">
                        <div className="settings-card__row">
                          <div className="settings-field">
                            <label className="settings-field__label">Host</label>
                            <input className="input" placeholder="localhost" value={directForm.host} onChange={(e) => setDirectForm((f) => ({ ...f, host: e.target.value }))} />
                          </div>
                          <div className="settings-field settings-field--sm">
                            <label className="settings-field__label">Port</label>
                            <input className="input" placeholder="5432" value={directForm.port} onChange={(e) => setDirectForm((f) => ({ ...f, port: e.target.value }))} />
                          </div>
                        </div>
                        <div className="settings-card__row">
                          <div className="settings-field">
                            <label className="settings-field__label">Username</label>
                            <input className="input" placeholder="postgres" value={directForm.username} onChange={(e) => setDirectForm((f) => ({ ...f, username: e.target.value }))} />
                          </div>
                          <div className="settings-field">
                            <label className="settings-field__label">Password</label>
                            <input className="input" type="password" value={directForm.password} onChange={(e) => setDirectForm((f) => ({ ...f, password: e.target.value }))} />
                          </div>
                        </div>
                        <div className="settings-field">
                          <label className="settings-field__label">Database</label>
                          <input className="input" placeholder="mydb" value={directForm.database} onChange={(e) => setDirectForm((f) => ({ ...f, database: e.target.value }))} />
                        </div>
                      </div>
                    ) : (
                      <div className="db-migrate__aws-form">
                        <div className="settings-field">
                          <label className="settings-field__label">Secret ID / ARN</label>
                          <input
                            className="input"
                            placeholder="arn:aws:secretsmanager:us-east-1:123456:secret:my-db-creds"
                            value={awsSecretId}
                            onChange={(e) => setAwsSecretId(e.target.value)}
                          />
                          <p className="settings-field__hint">
                            The secret should contain a JSON object with database connection fields (host, port, username, password, dbname).
                          </p>
                        </div>

                        <button
                          className="db-migrate__mappings-toggle"
                          onClick={() => setAwsKeyMappingsOpen((v) => !v)}
                        >
                          {awsKeyMappingsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          Custom key mappings
                          {hasNonDefaultMappings && <span className="db-migrate__mappings-badge">modified</span>}
                        </button>

                        {awsKeyMappingsOpen && (
                          <div className="db-migrate__mappings-body">
                            <p className="settings-field__hint" style={{ marginBottom: 8 }}>
                              If your secret uses different JSON key names, override them here.
                              These are the key names inside your secret — not the actual values.
                            </p>
                            <div className="db-migrate__mappings-grid">
                              {(['host', 'port', 'username', 'password', 'database'] as const).map((field) => (
                                <div className="db-migrate__mapping-field" key={field}>
                                  <span className="db-migrate__mapping-label">{field}</span>
                                  <input
                                    className="input"
                                    value={awsKeyMappings[field]}
                                    onChange={(e) => setAwsKeyMappings((f) => ({ ...f, [field]: e.target.value }))}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="db-migrate__connect-row">
                      <button
                        className="btn btn--outline"
                        onClick={handleTestConnection}
                        disabled={testing || configuring}
                      >
                        {testing ? <Loader2 size={14} className="spin" /> : null}
                        Test
                      </button>
                      <button className="btn btn--primary" onClick={handleConfigure} disabled={configuring || testing}>
                        {configuring ? <Loader2 size={14} className="spin" /> : <ArrowRight size={14} />}
                        {configuring ? 'Saving...' : 'Save & Connect'}
                      </button>
                    </div>
                    {testResult && (
                      <div className={`db-migrate__test-result ${testResult.success ? 'db-migrate__test-result--ok' : 'db-migrate__test-result--fail'}`}>
                        {testResult.success ? (
                          <><Check size={12} /> Connection successful — {testResult.version}</>
                        ) : (
                          <><X size={12} /> {testResult.error}</>
                        )}
                      </div>
                    )}
                    {configError && <p className="error-text">{configError}</p>}
                  </>
                ) : (
                  <>
                    <div className="db-migrate__status-row">
                      <span className="db-migrate__pill db-migrate__pill--green">
                        <Circle size={6} fill="currentColor" /> Connected
                      </span>
                      {targetVersion && <span className="db-migrate__version">{targetVersion}</span>}
                      <span className="db-migrate__mode-badge">
                        {status?.targetConfig?.mode === 'aws' ? 'AWS' : 'Direct'}
                      </span>
                    </div>
                    {status?.targetConfig?.mode === 'direct' && status.targetConfig.host && (
                      <div className="db-migrate__url" style={{ marginTop: 6 }}>
                        {status.targetConfig.host}:{status.targetConfig.port || 5432}/{status.targetConfig.database}
                      </div>
                    )}
                    {mode === 'direct' && !directForm.password && (
                      <div className="db-migrate__password-prompt">
                        <label className="settings-field__label">Password (required for operations)</label>
                        <div className="settings-field__row">
                          <input
                            className="input"
                            type="password"
                            placeholder="Enter password"
                            value={directForm.password}
                            onChange={(e) => setDirectForm((f) => ({ ...f, password: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* --- Migration Steps --- */}
              {targetConnected && (
                <div className="db-migrate__migration">
                  <button
                    className="db-migrate__migration-toggle"
                    onClick={() => setMigrationOpen((v) => !v)}
                  >
                    {migrationOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Migration
                    {completedSteps.has('verify') && (
                      <span className="db-migrate__pill db-migrate__pill--green" style={{ marginLeft: 8 }}>
                        <Check size={10} /> Complete
                      </span>
                    )}
                  </button>

                  {migrationOpen && (
                    <div className="db-migrate__steps">
                      {/* Step 1: Analyze */}
                      <div className={`db-migrate__step ${stepModifier('analyze')}`}>
                        <div className="db-migrate__step-header">
                          <span className="db-migrate__step-number">
                            {completedSteps.has('analyze') ? <Check size={12} /> : '1'}
                          </span>
                          <span className="db-migrate__step-title">Analyze Source</span>
                          <button
                            className="btn btn--sm btn--outline"
                            disabled={!isStepUnlocked('analyze') || (activeStep === 'analyze' && stepLoading)}
                            onClick={handleAnalyze}
                          >
                            {activeStep === 'analyze' && stepLoading && <Loader2 size={12} className="spin" />}
                            Analyze
                          </button>
                        </div>
                        {sourceTables && (
                          <div className="db-migrate__step-body">
                            <div className="db-migrate__table-list">
                              {sourceTables.map((t) => (
                                <div className="db-migrate__table-row" key={t.table}>
                                  <span className="db-migrate__table-name">{t.table}</span>
                                  <span className="db-migrate__table-count">{t.count}</span>
                                </div>
                              ))}
                            </div>
                            <div className="db-migrate__table-summary">
                              Total: {totalRows} rows across {sourceTables.length} tables
                              <Check size={12} className="db-migrate__check-icon" />
                            </div>
                          </div>
                        )}
                        {activeStep === 'analyze' && stepError && (
                          <p className="error-text" style={{ padding: '8px 14px' }}>{stepError}</p>
                        )}
                      </div>

                      {/* Step 2: Check Target */}
                      <div className={`db-migrate__step ${stepModifier('check')}`}>
                        <div className="db-migrate__step-header">
                          <span className="db-migrate__step-number">
                            {completedSteps.has('check') ? <Check size={12} /> : '2'}
                          </span>
                          <span className="db-migrate__step-title">Check Target</span>
                          <button
                            className="btn btn--sm btn--outline"
                            disabled={!isStepUnlocked('check') || (activeStep === 'check' && stepLoading)}
                            onClick={handleCheckTarget}
                          >
                            {activeStep === 'check' && stepLoading && <Loader2 size={12} className="spin" />}
                            Check Target
                          </button>
                        </div>
                        {targetCheck && (
                          <div className="db-migrate__step-body">
                            {!targetCheck.hasData ? (
                              <div className="db-migrate__success">
                                <Check size={14} />
                                Target is empty — safe to migrate
                              </div>
                            ) : (
                              <div className="db-migrate__warning">
                                <AlertTriangle size={14} />
                                <div>
                                  <strong>Target database contains existing data.</strong>
                                  <p>
                                    Migration uses ON CONFLICT DO NOTHING — existing rows won't be overwritten,
                                    but this may cause inconsistencies.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {activeStep === 'check' && stepError && (
                          <p className="error-text" style={{ padding: '8px 14px' }}>{stepError}</p>
                        )}
                      </div>

                      {/* Step 3: Migrate */}
                      <div className={`db-migrate__step ${stepModifier('migrate')}`}>
                        <div className="db-migrate__step-header">
                          <span className="db-migrate__step-number">
                            {completedSteps.has('migrate') ? <Check size={12} /> : '3'}
                          </span>
                          <span className="db-migrate__step-title">Migrate</span>
                          {!completedSteps.has('migrate') && (
                            <button
                              className="btn btn--sm btn--primary"
                              disabled={!isStepUnlocked('migrate') || (activeStep === 'migrate' && stepLoading)}
                              onClick={() => setShowConfirm(true)}
                            >
                              {activeStep === 'migrate' && stepLoading && <Loader2 size={12} className="spin" />}
                              Start Migration
                            </button>
                          )}
                        </div>

                        {showConfirm && (
                          <div className="db-migrate__confirm">
                            <p>This will copy all data to the target database. The source database will not be modified.</p>
                            <div className="db-migrate__confirm-actions">
                              <button className="btn btn--sm btn--primary" onClick={handleMigrate}>Confirm</button>
                              <button className="btn btn--sm btn--ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {(migrationProgress.length > 0 || migrationStatus) && (
                          <div className="db-migrate__step-body">
                            {migrationStatus && !migrationResult && (
                              <p className="db-migrate__status-text">{migrationStatus}</p>
                            )}
                            {migrationProgress.length > 0 && (
                              <div className="db-migrate__progress-list">
                                {migrationProgress.map((p) => (
                                  <div className="db-migrate__progress-row" key={p.table}>
                                    <span className="db-migrate__progress-icon">
                                      {p.status === 'done' ? (
                                        <Check size={12} className="db-migrate__check-icon" />
                                      ) : p.status === 'copying' ? (
                                        <Loader2 size={12} className="spin" />
                                      ) : p.status === 'error' ? (
                                        <X size={12} style={{ color: 'var(--color-red)' }} />
                                      ) : (
                                        <Circle size={8} />
                                      )}
                                    </span>
                                    <span className="db-migrate__progress-name">{p.table}</span>
                                    <span className="db-migrate__progress-count">
                                      {p.status === 'done' || p.status === 'copying' ? `${p.copied}/${p.total}` : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {migrationResult && (
                              <div className="db-migrate__success" style={{ marginTop: 10 }}>
                                <Check size={14} />
                                Migration complete in {(migrationResult.duration / 1000).toFixed(1)}s
                              </div>
                            )}
                          </div>
                        )}
                        {activeStep === 'migrate' && stepError && (
                          <p className="error-text" style={{ padding: '8px 14px' }}>{stepError}</p>
                        )}
                      </div>

                      {/* Step 4: Verify */}
                      <div className={`db-migrate__step ${stepModifier('verify')}`}>
                        <div className="db-migrate__step-header">
                          <span className="db-migrate__step-number">
                            {completedSteps.has('verify') ? <Check size={12} /> : '4'}
                          </span>
                          <span className="db-migrate__step-title">Verify</span>
                          <button
                            className="btn btn--sm btn--outline"
                            disabled={!isStepUnlocked('verify') || (activeStep === 'verify' && stepLoading)}
                            onClick={handleVerify}
                          >
                            {activeStep === 'verify' && stepLoading && <Loader2 size={12} className="spin" />}
                            Verify
                          </button>
                        </div>
                        {verifyResult && (
                          <div className="db-migrate__step-body">
                            {verifyResult.match ? (
                              <div className="db-migrate__success">
                                <Check size={14} />
                                All {verifyResult.tables.length} tables match — migration complete
                              </div>
                            ) : (
                              <>
                                <div className="db-migrate__warning">
                                  <AlertTriangle size={14} />
                                  Some tables have mismatched row counts
                                </div>
                                <div className="db-migrate__table-list" style={{ marginTop: 8 }}>
                                  {verifyResult.tables.filter((t) => !t.match).map((t) => (
                                    <div className="db-migrate__table-row" key={t.table}>
                                      <span className="db-migrate__table-name">{t.table}</span>
                                      <span className="db-migrate__table-count" style={{ color: 'var(--color-red)' }}>
                                        {t.source} → {t.target}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            {verifyResult.match && (
                              <div className="db-migrate__next-steps">
                                <p>Update your <code>DATABASE_URL</code> to point to the target database and redeploy.</p>
                                {status?.targetConfig?.mode === 'direct' && status.targetConfig.host && (
                                  <div className="db-migrate__connection-url">
                                    <label>Connection URL</label>
                                    <code>
                                      postgresql://{status.targetConfig.username}:{'<password>'}@{status.targetConfig.host}:{status.targetConfig.port || 5432}/{status.targetConfig.database}
                                    </code>
                                  </div>
                                )}
                                {status?.targetConfig?.mode === 'aws' && status.targetConfig.secretId && (
                                  <div className="db-migrate__connection-url">
                                    <label>AWS Secret</label>
                                    <code>{status.targetConfig.secretId}</code>
                                    <p className="db-migrate__hint">Resolve the secret in your deployment to build the <code>DATABASE_URL</code>.</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {activeStep === 'verify' && stepError && (
                          <p className="error-text" style={{ padding: '8px 14px' }}>{stepError}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
