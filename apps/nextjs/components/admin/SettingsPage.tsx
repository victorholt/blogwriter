'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSettings,
  updateSettings,
  clearCache,
  fetchDressCacheStats,
  clearDressCache,
  syncDresses,
  fetchAdminBrandLabels,
  createBrandLabel,
  updateBrandLabel,
  deleteBrandLabel,
} from '@/lib/admin-api';
import type { AdminBrandLabel } from '@/lib/admin-api';
import { Save, Check, Key, Bot, Loader2, Trash2, Database, Package, RefreshCw, FileText, Palette, Plus, Tag } from 'lucide-react';
import SearchSelect from '@/components/ui/SearchSelect';
import Toggle from '@/components/ui/Toggle';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';
import DressMultiSelect from '@/components/ui/DressMultiSelect';
import ThemesTab from './ThemesTab';
import AgentModelsTab from './AgentModelsTab';
import type { Dress } from '@/types';

type SettingsTab = 'api' | 'agents' | 'products' | 'themes' | 'cache' | 'blog';

interface SettingsPageProps {
  token: string;
}

export default function SettingsPage({ token }: SettingsPageProps): React.ReactElement {
  // Persist admin token so the share page can use it for delete access
  useEffect(() => {
    localStorage.setItem('blogwriter:adminToken', token);
  }, [token]);

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState('');
  const [apiKeyDisplay, setApiKeyDisplay] = useState('');
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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

  // Brand labels
  const [brandLabels, setBrandLabels] = useState<AdminBrandLabel[]>([]);
  const [brandLabelEdits, setBrandLabelEdits] = useState<Record<number, Partial<AdminBrandLabel>>>({});
  const [brandLabelSaveStatus, setBrandLabelSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [brandLabelDeleteConfirm, setBrandLabelDeleteConfirm] = useState<number | null>(null);
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [brandCreateStatus, setBrandCreateStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const loadData = useCallback(async (): Promise<void> => {
    const settingsResult = await fetchSettings(token);

    if (!settingsResult.success) {
      setAuthorized(false);
      return;
    }

    setAuthorized(true);
    const s = settingsResult.data ?? {};
    setAllSettings(s);
    setApiKeyDisplay(s.openrouter_api_key ?? '');
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

  // --- Blog Settings ---

  async function handleToggleGenerateImages(): Promise<void> {
    const newValue = allSettings.blog_generate_images === 'false' ? 'true' : 'false';
    const result = await updateSettings(token, { blog_generate_images: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  async function handleToggleGenerateLinks(): Promise<void> {
    const newValue = allSettings.blog_generate_links === 'false' ? 'true' : 'false';
    const result = await updateSettings(token, { blog_generate_links: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  async function handleToggleSharing(): Promise<void> {
    const newValue = allSettings.blog_sharing_enabled === 'true' ? 'false' : 'true';
    const result = await updateSettings(token, { blog_sharing_enabled: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  const TIMELINE_STYLE_OPTIONS: SearchSelectGroup[] = [
    {
      label: 'Display Styles',
      options: [
        { label: 'Preview Bar', value: 'preview-bar' },
        { label: 'Vertical Timeline', value: 'timeline' },
        { label: 'Horizontal Stepper', value: 'stepper' },
      ],
    },
  ];

  async function handleTimelineStyleChange(value: string): Promise<void> {
    const result = await updateSettings(token, { blog_timeline_style: value });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
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

  // --- Dress Cache ---

  const loadDressCacheStats = useCallback(async (): Promise<void> => {
    const result = await fetchDressCacheStats(token);
    if (result.success) {
      setDressCacheCount(result.data?.total ?? 0);
    }
  }, [token]);

  const loadBrandLabels = useCallback(async (): Promise<void> => {
    const result = await fetchAdminBrandLabels(token);
    if (result.success && result.data) {
      setBrandLabels(result.data);
    }
  }, [token]);

  useEffect(() => {
    if (authorized) {
      loadDressCacheStats();
      loadBrandLabels();
    }
  }, [authorized, loadDressCacheStats, loadBrandLabels]);

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

  // --- Brand Labels ---

  function getBrandLabelValue(id: number, field: keyof AdminBrandLabel): string {
    const edit = brandLabelEdits[id];
    if (edit && field in edit) return edit[field] as string;
    const label = brandLabels.find((b) => b.id === id);
    return label ? (label[field] as string) : '';
  }

  async function handleToggleBrandLabel(label: AdminBrandLabel): Promise<void> {
    const result = await updateBrandLabel(token, label.id, { isActive: !label.isActive });
    if (result.success && result.data) {
      setBrandLabels((prev) => prev.map((b) => (b.id === label.id ? result.data! : b)));
    }
  }

  async function handleSaveBrandLabel(id: number): Promise<void> {
    const edit = brandLabelEdits[id];
    if (!edit) return;
    setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    const result = await updateBrandLabel(token, id, { displayName: edit.displayName });
    if (result.success && result.data) {
      setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setBrandLabels((prev) => prev.map((b) => (b.id === id ? result.data! : b)));
      setBrandLabelEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setTimeout(() => setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 2000);
    } else {
      setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 3000);
    }
  }

  async function handleDeleteBrandLabel(id: number): Promise<void> {
    const result = await deleteBrandLabel(token, id);
    if (result.success) {
      setBrandLabels((prev) => prev.filter((b) => b.id !== id));
      setBrandLabelDeleteConfirm(null);
    }
  }

  async function handleCreateBrandLabel(): Promise<void> {
    if (!newBrandSlug.trim() || !newBrandName.trim()) return;
    setBrandCreateStatus('saving');
    const result = await createBrandLabel(token, {
      slug: newBrandSlug.trim(),
      displayName: newBrandName.trim(),
    });
    if (result.success && result.data) {
      setBrandLabels((prev) => [...prev, result.data!]);
      setNewBrandSlug('');
      setNewBrandName('');
      setBrandCreateStatus('idle');
    } else {
      setBrandCreateStatus('error');
      setTimeout(() => setBrandCreateStatus('idle'), 3000);
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
            className={`settings-tab ${activeTab === 'themes' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('themes')}
          >
            <Palette size={15} />
            Themes
          </button>
          <button
            className={`settings-tab ${activeTab === 'cache' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('cache')}
          >
            <Database size={15} />
            Cache
          </button>
          <button
            className={`settings-tab ${activeTab === 'blog' ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab('blog')}
          >
            <FileText size={15} />
            Blog
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
          <AgentModelsTab token={token} />
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

            {/* Brand Labels */}
            <div className="settings-card">
              <h3 className="settings-card__title">
                <Tag size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                Brand Labels
              </h3>
              <p className="settings-field__label" style={{ marginBottom: 12 }}>
                Map product API slugs to display names. These are used for brand filtering and agent brand exclusivity.
              </p>

              {brandLabels.length > 0 && (
                <table className="brand-labels__table">
                  <thead>
                    <tr>
                      <th className="brand-labels__th">Slug</th>
                      <th className="brand-labels__th">Display Name</th>
                      <th className="brand-labels__th">Active</th>
                      <th className="brand-labels__th" />
                    </tr>
                  </thead>
                  <tbody>
                    {brandLabels.map((label) => {
                      const status = brandLabelSaveStatus[label.id] ?? 'idle';
                      const hasEdits = label.id in brandLabelEdits;
                      const isDeleting = brandLabelDeleteConfirm === label.id;

                      return (
                        <tr key={label.id} style={!label.isActive ? { opacity: 0.5 } : undefined}>
                          <td className="brand-labels__td brand-labels__td--slug">{label.slug}</td>
                          <td className="brand-labels__td">
                            <input
                              className="brand-labels__name-input"
                              type="text"
                              value={getBrandLabelValue(label.id, 'displayName')}
                              onChange={(e) =>
                                setBrandLabelEdits((prev) => ({
                                  ...prev,
                                  [label.id]: { ...prev[label.id], displayName: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td className="brand-labels__td">
                            <Toggle
                              checked={label.isActive}
                              onChange={() => handleToggleBrandLabel(label)}
                            />
                          </td>
                          <td className="brand-labels__td brand-labels__td--actions">
                            {isDeleting ? (
                              <>
                                <button className="btn btn--outline btn--danger btn--sm" onClick={() => handleDeleteBrandLabel(label.id)}>
                                  Yes
                                </button>
                                <button className="btn btn--ghost btn--sm" onClick={() => setBrandLabelDeleteConfirm(null)}>
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                {hasEdits && (
                                  <button
                                    className="btn btn--primary btn--sm"
                                    onClick={() => handleSaveBrandLabel(label.id)}
                                    disabled={status === 'saving'}
                                  >
                                    {status === 'saving' ? <Loader2 size={12} className="spin" /> : status === 'saved' ? <Check size={12} /> : <Save size={12} />}
                                  </button>
                                )}
                                <button className="btn btn--ghost btn--sm" onClick={() => setBrandLabelDeleteConfirm(label.id)}>
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="brand-labels__create-row">
                <input
                  className="input"
                  type="text"
                  placeholder="slug (e.g. essense-dress)"
                  value={newBrandSlug}
                  onChange={(e) => setNewBrandSlug(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Display Name"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn--primary"
                  onClick={handleCreateBrandLabel}
                  disabled={!newBrandSlug.trim() || !newBrandName.trim() || brandCreateStatus === 'saving'}
                >
                  {brandCreateStatus === 'saving' ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
              {brandCreateStatus === 'error' && (
                <p className="error-text" style={{ marginTop: 8 }}>Failed to create brand label</p>
              )}
            </div>
          </section>
        )}

        {/* Themes Tab */}
        {activeTab === 'themes' && (
          <ThemesTab token={token} />
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

        {/* Blog Settings Tab */}
        {activeTab === 'blog' && (
          <section className="settings-section">
            <h2 className="settings-section__heading">
              <FileText size={18} />
              Blog Settings
            </h2>

            <div className="settings-card">
              <div className="settings-field">
                <label className="settings-field__label">Generation Timeline Style</label>
                <p className="settings-field__current" style={{ fontFamily: 'inherit' }}>
                  Controls how blog generation progress is displayed to users.
                </p>
                <SearchSelect
                  value={allSettings.blog_timeline_style || 'preview-bar'}
                  onChange={handleTimelineStyleChange}
                  groups={TIMELINE_STYLE_OPTIONS}
                  placeholder="Select display style..."
                />
              </div>
            </div>

            <div className="settings-card">
              <Toggle
                checked={allSettings.blog_generate_images !== 'false'}
                onChange={() => handleToggleGenerateImages()}
                label="Generate Images"
                description="When disabled, blog posts will not include dress images."
              />
            </div>

            <div className="settings-card">
              <Toggle
                checked={allSettings.blog_generate_links !== 'false'}
                onChange={() => handleToggleGenerateLinks()}
                label="Generate Links"
                description="When disabled, blog posts will not include hyperlinks."
              />
            </div>

            <div className="settings-card">
              <Toggle
                checked={allSettings.blog_sharing_enabled === 'true'}
                onChange={() => handleToggleSharing()}
                label="Blog Sharing"
                description="When enabled, users can create public share links for generated blog posts."
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
