'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAgentConfigs,
  updateAgentConfig,
  fetchSettings,
  updateSettings,
  fetchModels,
  clearCache,
  fetchDressCacheStats,
  clearDressCache,
  syncDresses,
} from '@/lib/admin-api';
import type { AgentConfig, ModelOption } from '@/lib/admin-api';
import { Save, Check, AlertCircle, Key, Bot, Loader2, Trash2, Database, Package, RefreshCw } from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import Toggle from '@/components/ui/Toggle';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';
import DressMultiSelect from '@/components/ui/DressMultiSelect';
import type { Dress } from '@/types';

type SettingsTab = 'api' | 'agents' | 'products' | 'cache';

interface SettingsPageProps {
  token: string;
}

export default function SettingsPage({ token }: SettingsPageProps): React.ReactElement {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState('');
  const [apiKeyDisplay, setApiKeyDisplay] = useState('');
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [agentSaveStatus, setAgentSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [agentEdits, setAgentEdits] = useState<Record<string, Partial<AgentConfig>>>({});
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'cleared' | 'error'>('idle');
  const [cacheMessage, setCacheMessage] = useState('');

  // Product API settings
  const [productEdits, setProductEdits] = useState<Record<string, string>>({});
  const [productSaveStatus, setProductSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Dress filter
  const [filterSelectedIds, setFilterSelectedIds] = useState<Set<string>>(new Set());
  const [filterDressesMap, setFilterDressesMap] = useState<Map<string, Dress>>(new Map());
  const [filterSaveStatus, setFilterSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [filterInitialized, setFilterInitialized] = useState(false);

  // Dress cache
  const [dressCacheCount, setDressCacheCount] = useState<number | null>(null);
  const [dressClearStatus, setDressClearStatus] = useState<'idle' | 'clearing' | 'cleared' | 'error'>('idle');
  const [dressSyncStatus, setDressSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dressSyncMessage, setDressSyncMessage] = useState('');

  const modelGroups: SearchSelectGroup[] = Object.entries(
    models.reduce<Record<string, ModelOption[]>>((acc, m) => {
      (acc[m.provider] ??= []).push(m);
      return acc;
    }, {}),
  ).map(([provider, providerModels]) => ({
    label: provider,
    options: providerModels.map((m) => ({
      label: m.name,
      value: `openrouter/${m.id}`,
    })),
  }));

  const loadData = useCallback(async (): Promise<void> => {
    const [agentsResult, settingsResult, modelsResult] = await Promise.all([
      fetchAgentConfigs(token),
      fetchSettings(token),
      fetchModels(token),
    ]);

    if (!agentsResult.success || !settingsResult.success) {
      setAuthorized(false);
      return;
    }

    setAuthorized(true);
    setAgents(agentsResult.data ?? []);
    const s = settingsResult.data ?? {};
    setAllSettings(s);
    setApiKeyDisplay(s.openrouter_api_key ?? '');
    setModels(modelsResult.data ?? []);
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- API Key ---

  async function handleSaveApiKey(): Promise<void> {
    if (!apiKey) return;
    setSettingsSaveStatus('saving');
    const result = await updateSettings(token, { openrouter_api_key: apiKey });
    if (result.success) {
      setSettingsSaveStatus('saved');
      setApiKeyDisplay(result.data?.openrouter_api_key ?? '');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setApiKey('');
      setTimeout(() => setSettingsSaveStatus('idle'), 2000);
    } else {
      setSettingsSaveStatus('error');
      setTimeout(() => setSettingsSaveStatus('idle'), 3000);
    }
  }

  // --- Debug Mode ---

  async function handleToggleDebug(): Promise<void> {
    const newValue = allSettings.debug_mode === 'true' ? 'false' : 'true';
    const result = await updateSettings(token, { debug_mode: newValue });
    if (result.success && result.data) {
      const data = result.data;
      setAllSettings((prev: Record<string, string>) => ({ ...prev, ...data }));
    }
  }

  // --- Insights Enabled ---

  async function handleToggleInsights(): Promise<void> {
    const newValue = allSettings.insights_enabled === 'true' ? 'false' : 'true';
    const result = await updateSettings(token, { insights_enabled: newValue });
    if (result.success && result.data) {
      const data = result.data;
      setAllSettings((prev: Record<string, string>) => ({ ...prev, ...data }));
    }
  }

  // --- Cache ---

  async function handleClearCache(): Promise<void> {
    setCacheStatus('clearing');
    const result = await clearCache(token);
    if (result.success) {
      setCacheStatus('cleared');
      setCacheMessage(`Cleared ${result.data?.cleared ?? 0} cached entries`);
      setTimeout(() => setCacheStatus('idle'), 3000);
    } else {
      setCacheStatus('error');
      setCacheMessage('Failed to clear cache');
      setTimeout(() => setCacheStatus('idle'), 3000);
    }
  }

  // --- Agent ---

  function getAgentValue(agentId: string, field: keyof AgentConfig): string {
    const edit = agentEdits[agentId];
    if (edit && field in edit) return edit[field] as string;
    const agent = agents.find((a) => a.agentId === agentId);
    return agent ? (agent[field] as string) : '';
  }

  function setAgentValue(agentId: string, field: keyof AgentConfig, value: string): void {
    setAgentEdits((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [field]: value },
    }));
  }

  async function handleToggleAgent(agentId: string): Promise<void> {
    const agent = agents.find((a) => a.agentId === agentId);
    if (!agent) return;
    const newEnabled = !agent.enabled;
    const result = await updateAgentConfig(token, agentId, {
      modelId: agent.modelId,
      enabled: newEnabled,
    });
    if (result.success && result.data) {
      setAgents((prev) => prev.map((a) => (a.agentId === agentId ? result.data! : a)));
    }
  }

  async function handleSaveAgent(agentId: string): Promise<void> {
    setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'saving' }));

    const instructions = getAgentValue(agentId, 'instructions');
    const result = await updateAgentConfig(token, agentId, {
      modelId: getAgentValue(agentId, 'modelId'),
      temperature: getAgentValue(agentId, 'temperature'),
      maxTokens: getAgentValue(agentId, 'maxTokens'),
      ...(instructions !== undefined && { instructions: instructions || '' }),
    });

    if (result.success && result.data) {
      setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'saved' }));
      setAgents((prev) => prev.map((a) => (a.agentId === agentId ? result.data! : a)));
      setAgentEdits((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
      setTimeout(() => setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'idle' })), 2000);
    } else {
      setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'error' }));
      setTimeout(() => setAgentSaveStatus((prev) => ({ ...prev, [agentId]: 'idle' })), 3000);
    }
  }

  // --- Dress Cache ---

  const loadDressCacheStats = useCallback(async (): Promise<void> => {
    const result = await fetchDressCacheStats(token);
    if (result.success) {
      setDressCacheCount(result.data?.total ?? 0);
    }
  }, [token]);

  useEffect(() => {
    if (authorized) {
      loadDressCacheStats();
    }
  }, [authorized, loadDressCacheStats]);

  async function handleClearDressCache(): Promise<void> {
    setDressClearStatus('clearing');
    const result = await clearDressCache(token);
    if (result.success) {
      setDressClearStatus('cleared');
      setDressCacheCount(0);
      setTimeout(() => setDressClearStatus('idle'), 3000);
    } else {
      setDressClearStatus('error');
      setTimeout(() => setDressClearStatus('idle'), 3000);
    }
  }

  async function handleSyncDresses(): Promise<void> {
    setDressSyncStatus('syncing');
    setDressSyncMessage('');
    const result = await syncDresses(token);
    if (result.success && result.data) {
      setDressSyncStatus('synced');
      setDressCacheCount(result.data.synced);
      const breakdown = Object.entries(result.data.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      setDressSyncMessage(`Synced ${result.data.synced} dresses (${breakdown})`);
      setTimeout(() => setDressSyncStatus('idle'), 5000);
    } else {
      setDressSyncStatus('error');
      setDressSyncMessage('Failed to sync dresses from API');
      setTimeout(() => setDressSyncStatus('idle'), 3000);
    }
  }

  // --- Product API ---

  const PRODUCT_KEYS = [
    { key: 'product_api_base_url', label: 'Base URL', placeholder: 'https://product.dev.essensedesigns.info' },
    { key: 'product_api_language', label: 'Language', placeholder: 'en' },
    { key: 'product_api_type', label: 'Type', placeholder: 'essense-dress' },
    { key: 'product_api_app', label: 'App', placeholder: 'essense-designs' },
    { key: 'product_api_timeout', label: 'Timeout (ms)', placeholder: '30000' },
  ];

  function getProductValue(key: string): string {
    return productEdits[key] ?? allSettings[key] ?? '';
  }

  const hasProductEdits = Object.keys(productEdits).length > 0;

  async function handleSaveProductSettings(): Promise<void> {
    if (!hasProductEdits) return;
    setProductSaveStatus('saving');

    const result = await updateSettings(token, productEdits);
    if (result.success) {
      setProductSaveStatus('saved');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setProductEdits({});
      setTimeout(() => setProductSaveStatus('idle'), 2000);
    } else {
      setProductSaveStatus('error');
      setTimeout(() => setProductSaveStatus('idle'), 3000);
    }
  }

  // --- Dress Filter ---

  // Initialize filter selections from saved setting (externalId:label pairs)
  useEffect(() => {
    if (filterInitialized) return;
    const raw = allSettings.allowed_dress_ids;
    if (raw === undefined) return; // settings not loaded yet
    if (!raw.trim()) {
      setFilterInitialized(true);
      return;
    }
    const ids = new Set<string>();
    const placeholderMap = new Map<string, Dress>();
    for (const entry of raw.split(',')) {
      const sep = entry.indexOf(':');
      if (sep === -1) continue; // skip malformed entries
      const externalId = entry.slice(0, sep).trim();
      const label = entry.slice(sep + 1).trim();
      if (!externalId) continue;
      ids.add(externalId);
      placeholderMap.set(externalId, {
        externalId,
        name: label,
        styleId: label,
      });
    }
    setFilterSelectedIds(ids);
    setFilterDressesMap(placeholderMap);
    setFilterInitialized(true);
  }, [allSettings.allowed_dress_ids, filterInitialized]);

  function handleFilterToggle(externalId: string): void {
    setFilterSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) {
        next.delete(externalId);
      } else {
        next.add(externalId);
      }
      return next;
    });
  }

  function handleFilterClear(): void {
    setFilterSelectedIds(new Set());
  }

  function addFilterDressesToMap(dresses: Dress[]): void {
    setFilterDressesMap((prev) => {
      const next = new Map(prev);
      for (const d of dresses) next.set(d.externalId, d);
      return next;
    });
  }

  async function handleSaveFilter(): Promise<void> {
    setFilterSaveStatus('saving');
    // Store as externalId:styleId pairs so we can restore badges on page load
    const pairs = Array.from(filterSelectedIds)
      .map((id) => {
        const dress = filterDressesMap.get(id);
        return dress ? `${id}:${dress.styleId || dress.name}` : null;
      })
      .filter(Boolean)
      .join(',');

    const result = await updateSettings(token, { allowed_dress_ids: pairs });
    if (result.success) {
      setFilterSaveStatus('saved');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setTimeout(() => setFilterSaveStatus('idle'), 2000);
    } else {
      setFilterSaveStatus('error');
      setTimeout(() => setFilterSaveStatus('idle'), 3000);
    }
  }

  // --- Render ---

  if (authorized === null) {
    return (
      <div className="page-shell">
        <div className="paper">
          <div className="settings-loading">
            <Loader2 size={24} className="spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="page-shell">
        <div className="paper">
          <h1 className="step-heading">Page not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="paper">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage API keys, agent models, and product API configuration</p>

        {/* Tab Bar */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'api' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Key size={15} />
            API Config
          </button>
          <button
            className={`settings-tab ${activeTab === 'agents' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            <Bot size={15} />
            Agent Models
          </button>
          <button
            className={`settings-tab ${activeTab === 'products' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Package size={15} />
            Product API
          </button>
          <button
            className={`settings-tab ${activeTab === 'cache' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('cache')}
          >
            <Database size={15} />
            Cache
          </button>
        </div>

        {/* API Config Tab */}
        {activeTab === 'api' && (
          <section className="settings-section">
            <h2 className="settings-section__heading">
              <Key size={18} />
              API Configuration
            </h2>

            <div className="settings-card">
              <label className="settings-field__label">OpenRouter API Key</label>
              {apiKeyDisplay && (
                <p className="settings-field__current">Current: {apiKeyDisplay}</p>
              )}
              <div className="settings-field__row">
                <input
                  type="password"
                  className="input"
                  placeholder="sk-or-v1-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  className="btn btn--primary"
                  onClick={handleSaveApiKey}
                  disabled={!apiKey || settingsSaveStatus === 'saving'}
                >
                  {settingsSaveStatus === 'saving' ? (
                    <Loader2 size={14} className="spin" />
                  ) : settingsSaveStatus === 'saved' ? (
                    <Check size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {settingsSaveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>
              </div>
              {settingsSaveStatus === 'error' && (
                <p className="error-text">Failed to save API key</p>
              )}
            </div>

            <div className="settings-card">
              <Toggle
                checked={allSettings.debug_mode === 'true'}
                onChange={() => handleToggleDebug()}
                label="Debug Mode"
                description="When enabled, brand voice analysis streams diagnostic data (scraped content, raw AI response)."
              />
            </div>

            <div className="settings-card">
              <Toggle
                checked={allSettings.insights_enabled !== 'false'}
                onChange={() => handleToggleInsights()}
                label="Agent Insights Collection"
                description="When disabled, agent trace data is not collected. Disable to reduce overhead if insights impact performance."
              />
            </div>
          </section>
        )}

        {/* Agent Models Tab */}
        {activeTab === 'agents' && (
          <section className="settings-section">
            <h2 className="settings-section__heading">
              <Bot size={18} />
              Agent Models
            </h2>

            {agents.map((agent) => {
              const status = agentSaveStatus[agent.agentId] ?? 'idle';
              const hasEdits = agent.agentId in agentEdits;
              const isRequired = agent.agentId === 'blog-writer' || agent.agentId === 'brand-voice-analyzer';

              return (
                <div key={agent.agentId} className={`settings-card${!agent.enabled && !isRequired ? ' settings-card--disabled' : ''}`}>
                  <div className="settings-card__title-row">
                    <h3 className="settings-card__title">{agent.agentLabel}</h3>
                    {!isRequired && (
                      <Toggle
                        checked={agent.enabled}
                        onChange={() => handleToggleAgent(agent.agentId)}
                      />
                    )}
                  </div>

                  <div className="settings-card__fields">
                    <div className="settings-field">
                      <label className="settings-field__label">Model</label>
                      <SearchSelect
                        value={getAgentValue(agent.agentId, 'modelId')}
                        onChange={(val) => setAgentValue(agent.agentId, 'modelId', val)}
                        groups={modelGroups}
                        placeholder="Select a model..."
                      />
                    </div>

                    <div className="settings-card__row">
                      <div className="settings-field">
                        <label className="settings-field__label">Temperature</label>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={getAgentValue(agent.agentId, 'temperature')}
                          onChange={(e) => setAgentValue(agent.agentId, 'temperature', e.target.value)}
                        />
                      </div>

                      <div className="settings-field">
                        <label className="settings-field__label">Max Tokens</label>
                        <input
                          className="input"
                          type="number"
                          step="256"
                          min="256"
                          value={getAgentValue(agent.agentId, 'maxTokens')}
                          onChange={(e) => setAgentValue(agent.agentId, 'maxTokens', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="settings-field">
                      <label className="settings-field__label">Custom Instructions</label>
                      <textarea
                        className="input settings-field__textarea"
                        rows={4}
                        placeholder="Leave empty to use default agent instructions..."
                        value={getAgentValue(agent.agentId, 'instructions') || ''}
                        onChange={(e) => setAgentValue(agent.agentId, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="settings-card__footer">
                    <span className="settings-card__updated">
                      Updated: {new Date(agent.updatedAt).toLocaleString()}
                    </span>
                    <button
                      className={`btn ${hasEdits ? 'btn--primary' : 'btn--outline'}`}
                      onClick={() => handleSaveAgent(agent.agentId)}
                      disabled={status === 'saving'}
                    >
                      {status === 'saving' ? (
                        <Loader2 size={14} className="spin" />
                      ) : status === 'saved' ? (
                        <Check size={14} />
                      ) : status === 'error' ? (
                        <AlertCircle size={14} />
                      ) : (
                        <Save size={14} />
                      )}
                      {status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Product API Tab */}
        {activeTab === 'products' && (
          <section className="settings-section">
            <h2 className="settings-section__heading">
              <Package size={18} />
              Product API Configuration
            </h2>

            <div className="settings-card">
              <div className="settings-card__fields">
                {PRODUCT_KEYS.map(({ key, label, placeholder }) => (
                  <div key={key} className="settings-field">
                    <label className="settings-field__label">{label}</label>
                    <input
                      className="input"
                      type={key === 'product_api_timeout' ? 'number' : 'text'}
                      placeholder={placeholder}
                      value={getProductValue(key)}
                      onChange={(e) => setProductEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div className="settings-card__footer">
                <span className="settings-card__updated">
                  {hasProductEdits ? 'Unsaved changes' : 'No changes'}
                </span>
                <button
                  className={`btn ${hasProductEdits ? 'btn--primary' : 'btn--outline'}`}
                  onClick={handleSaveProductSettings}
                  disabled={!hasProductEdits || productSaveStatus === 'saving'}
                >
                  {productSaveStatus === 'saving' ? (
                    <Loader2 size={14} className="spin" />
                  ) : productSaveStatus === 'saved' ? (
                    <Check size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {productSaveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>
              </div>
              {productSaveStatus === 'error' && (
                <p className="error-text">Failed to save product API settings</p>
              )}
            </div>

            <div className="settings-card">
              <h3 className="settings-card__title">Dress Filter</h3>
              <p className="settings-field__label" style={{ marginBottom: 12 }}>
                Restrict which dresses appear in the wizard. Leave empty to show all dresses.
              </p>
              <DressMultiSelect
                selectedIds={filterSelectedIds}
                onToggle={handleFilterToggle}
                onClear={handleFilterClear}
                dressesMap={filterDressesMap}
                addDressesToMap={addFilterDressesToMap}
                unfiltered
              />
              <div className="settings-card__footer" style={{ marginTop: 12 }}>
                <span className="settings-card__updated">
                  {filterSelectedIds.size > 0
                    ? `${filterSelectedIds.size} dress${filterSelectedIds.size !== 1 ? 'es' : ''} allowed`
                    : 'No filter — all dresses shown'}
                </span>
                <button
                  className="btn btn--primary"
                  onClick={handleSaveFilter}
                  disabled={filterSaveStatus === 'saving'}
                >
                  {filterSaveStatus === 'saving' ? (
                    <Loader2 size={14} className="spin" />
                  ) : filterSaveStatus === 'saved' ? (
                    <Check size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {filterSaveStatus === 'saved' ? 'Saved' : 'Save Filter'}
                </button>
              </div>
              {filterSaveStatus === 'error' && (
                <p className="error-text">Failed to save dress filter</p>
              )}
            </div>
          </section>
        )}

        {/* Cache Tab */}
        {activeTab === 'cache' && (
          <section className="settings-section">
            <h2 className="settings-section__heading">
              <Database size={18} />
              Cache
            </h2>

            <div className="settings-card">
              <h3 className="settings-card__title">Brand Voice Cache</h3>
              <p className="settings-field__label" style={{ marginBottom: 12 }}>
                Brand voice analysis results are cached for 7 days. Clear the cache to force fresh analysis on next request.
              </p>
              <div className="settings-field__row">
                <button
                  className="btn btn--outline btn--danger"
                  onClick={handleClearCache}
                  disabled={cacheStatus === 'clearing'}
                >
                  {cacheStatus === 'clearing' ? (
                    <Loader2 size={14} className="spin" />
                  ) : cacheStatus === 'cleared' ? (
                    <Check size={14} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {cacheStatus === 'cleared' ? cacheMessage : cacheStatus === 'clearing' ? 'Clearing...' : 'Clear Brand Voice Cache'}
                </button>
              </div>
              {cacheStatus === 'error' && (
                <p className="error-text">{cacheMessage}</p>
              )}
            </div>

            <div className="settings-card">
              <h3 className="settings-card__title">Dress Cache</h3>
              <p className="settings-field__label" style={{ marginBottom: 12 }}>
                Cached dresses from the external product API. Cache is only cleared manually.
                {dressCacheCount !== null && (
                  <strong> Currently {dressCacheCount} dresses cached.</strong>
                )}
              </p>
              <div className="settings-field__row">
                <button
                  className="btn btn--outline btn--danger"
                  onClick={handleClearDressCache}
                  disabled={dressClearStatus === 'clearing' || dressSyncStatus === 'syncing'}
                >
                  {dressClearStatus === 'clearing' ? (
                    <Loader2 size={14} className="spin" />
                  ) : dressClearStatus === 'cleared' ? (
                    <Check size={14} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  {dressClearStatus === 'cleared' ? 'Cleared' : dressClearStatus === 'clearing' ? 'Clearing...' : 'Clear Dress Cache'}
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleSyncDresses}
                  disabled={dressSyncStatus === 'syncing' || dressClearStatus === 'clearing'}
                >
                  {dressSyncStatus === 'syncing' ? (
                    <Loader2 size={14} className="spin" />
                  ) : dressSyncStatus === 'synced' ? (
                    <Check size={14} />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {dressSyncStatus === 'syncing' ? 'Syncing...' : dressSyncStatus === 'synced' ? 'Synced' : 'Sync All Dresses'}
                </button>
              </div>
              {dressSyncMessage && (
                <p className={dressSyncStatus === 'error' ? 'error-text' : 'settings-field__current'} style={{ marginTop: 8 }}>
                  {dressSyncMessage}
                </p>
              )}
              {dressClearStatus === 'error' && (
                <p className="error-text">Failed to clear dress cache</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
