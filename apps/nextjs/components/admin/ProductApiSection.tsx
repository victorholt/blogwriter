'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  updateSettings,
  fetchAdminBrandLabels,
  createBrandLabel,
  updateBrandLabel,
  deleteBrandLabel,
} from '@/lib/admin-api';
import type { AdminBrandLabel } from '@/lib/admin-api';
import { Package, Save, Check, Loader2, Trash2, Plus, Tag } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import TagInput from '@/components/ui/TagInput';
import DressMultiSelect from '@/components/ui/DressMultiSelect';
import { useSettings } from './SettingsContext';
import type { Dress } from '@/types';

const PRODUCT_KEYS = [
  { key: 'product_api_base_url', label: 'Base URL', placeholder: 'https://product.dev.essensedesigns.info' },
  { key: 'product_api_language', label: 'Language', placeholder: 'en' },
  { key: 'product_api_type', label: 'Type', placeholder: 'essense-dress' },
  { key: 'product_api_app', label: 'App', placeholder: 'essense-designs' },
  { key: 'product_api_timeout', label: 'Timeout (ms)', placeholder: '30000' },
];

export default function ProductApiSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  // Product API settings
  const [productEdits, setProductEdits] = useState<Record<string, string>>({});
  const [productSaveStatus, setProductSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Dress filter
  const [filterSelectedIds, setFilterSelectedIds] = useState<Set<string>>(new Set());
  const [filterDressesMap, setFilterDressesMap] = useState<Map<string, Dress>>(new Map());
  const [filterSaveStatus, setFilterSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [filterInitialized, setFilterInitialized] = useState(false);

  // Brand labels
  const [brandLabels, setBrandLabels] = useState<AdminBrandLabel[]>([]);
  const [brandLabelEdits, setBrandLabelEdits] = useState<Record<number, Partial<AdminBrandLabel>>>({});
  const [brandLabelSaveStatus, setBrandLabelSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [brandLabelDeleteConfirm, setBrandLabelDeleteConfirm] = useState<number | null>(null);
  const [newBrandSlug, setNewBrandSlug] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [brandCreateStatus, setBrandCreateStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const loadBrandLabels = useCallback(async () => {
    const result = await fetchAdminBrandLabels();
    if (result.success && result.data) setBrandLabels(result.data);
  }, []);

  useEffect(() => {
    loadBrandLabels();
  }, [loadBrandLabels]);

  // --- Product settings ---

  function getProductValue(key: string): string {
    return productEdits[key] ?? allSettings[key] ?? '';
  }

  const hasProductEdits = Object.keys(productEdits).length > 0;

  async function handleSaveProductSettings(): Promise<void> {
    if (!hasProductEdits) return;
    setProductSaveStatus('saving');
    const result = await updateSettings( productEdits);
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

  // --- Dress filter ---

  useEffect(() => {
    if (filterInitialized) return;
    const raw = allSettings.allowed_dress_ids;
    if (raw === undefined) return;
    if (!raw.trim()) {
      setFilterInitialized(true);
      return;
    }
    const ids = new Set<string>();
    const placeholderMap = new Map<string, Dress>();
    for (const entry of raw.split(',')) {
      const sep = entry.indexOf(':');
      if (sep === -1) continue;
      const externalId = entry.slice(0, sep).trim();
      const label = entry.slice(sep + 1).trim();
      if (!externalId) continue;
      ids.add(externalId);
      placeholderMap.set(externalId, { externalId, name: label, styleId: label });
    }
    setFilterSelectedIds(ids);
    setFilterDressesMap(placeholderMap);
    setFilterInitialized(true);
  }, [allSettings.allowed_dress_ids, filterInitialized]);

  function handleFilterToggle(externalId: string): void {
    setFilterSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
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
    const pairs = Array.from(filterSelectedIds)
      .map((id) => {
        const dress = filterDressesMap.get(id);
        return dress ? `${id}:${dress.styleId || dress.name}` : null;
      })
      .filter(Boolean)
      .join(',');

    const result = await updateSettings( { allowed_dress_ids: pairs });
    if (result.success) {
      setFilterSaveStatus('saved');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setTimeout(() => setFilterSaveStatus('idle'), 2000);
    } else {
      setFilterSaveStatus('error');
      setTimeout(() => setFilterSaveStatus('idle'), 3000);
    }
  }

  // --- Brand labels ---

  function getBrandLabelValue(id: number, field: keyof AdminBrandLabel): string {
    const edit = brandLabelEdits[id];
    if (edit && field in edit) return edit[field] as string;
    const label = brandLabels.find((b) => b.id === id);
    return label ? (label[field] as string) : '';
  }

  async function handleToggleBrandLabel(label: AdminBrandLabel): Promise<void> {
    const result = await updateBrandLabel(label.id, { isActive: !label.isActive });
    if (result.success && result.data) {
      setBrandLabels((prev) => prev.map((b) => (b.id === label.id ? result.data! : b)));
    }
  }

  function parseTags(json: string): string[] {
    try { const arr = JSON.parse(json); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }

  function getBrandTags(id: number, field: 'seoKeywords' | 'avoidTerms'): string[] {
    const edit = brandLabelEdits[id];
    if (edit && field in edit) return parseTags(edit[field] as string);
    const label = brandLabels.find((b) => b.id === id);
    return label ? parseTags(label[field]) : [];
  }

  function setBrandTags(id: number, field: 'seoKeywords' | 'avoidTerms', tags: string[]): void {
    setBrandLabelEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: JSON.stringify(tags) },
    }));
  }

  async function handleSaveBrandLabel(id: number): Promise<void> {
    const edit = brandLabelEdits[id];
    if (!edit) return;
    setBrandLabelSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    const payload: Record<string, unknown> = {};
    if (edit.displayName !== undefined) payload.displayName = edit.displayName;
    if (edit.seoKeywords !== undefined) payload.seoKeywords = edit.seoKeywords;
    if (edit.avoidTerms !== undefined) payload.avoidTerms = edit.avoidTerms;
    const result = await updateBrandLabel(id, payload as any);
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
    const result = await deleteBrandLabel(id);
    if (result.success) {
      setBrandLabels((prev) => prev.filter((b) => b.id !== id));
      setBrandLabelDeleteConfirm(null);
    }
  }

  async function handleCreateBrandLabel(): Promise<void> {
    if (!newBrandSlug.trim() || !newBrandName.trim()) return;
    setBrandCreateStatus('saving');
    const result = await createBrandLabel({ slug: newBrandSlug.trim(), displayName: newBrandName.trim() });
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

  return (
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
              : 'No filter \u2014 all dresses shown'}
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

        {brandLabels.map((label) => {
          const status = brandLabelSaveStatus[label.id] ?? 'idle';
          const hasEdits = label.id in brandLabelEdits;
          const isDeleting = brandLabelDeleteConfirm === label.id;

          return (
            <div key={label.id} className="brand-labels__card" style={!label.isActive ? { opacity: 0.5 } : undefined}>
              <div className="brand-labels__card-header">
                <div className="brand-labels__card-info">
                  <span className="brand-labels__card-slug">{label.slug}</span>
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
                </div>
                <div className="brand-labels__card-actions">
                  <Toggle
                    checked={label.isActive}
                    onChange={() => handleToggleBrandLabel(label)}
                  />
                  {isDeleting ? (
                    <>
                      <button className="btn btn--outline btn--danger btn--sm" onClick={() => handleDeleteBrandLabel(label.id)}>Yes</button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setBrandLabelDeleteConfirm(null)}>No</button>
                    </>
                  ) : (
                    <button className="btn btn--ghost btn--sm" onClick={() => setBrandLabelDeleteConfirm(label.id)}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="brand-labels__card-fields">
                <div className="brand-labels__tag-field">
                  <label className="settings-field__label">SEO Keywords</label>
                  <TagInput
                    tags={getBrandTags(label.id, 'seoKeywords')}
                    onChange={(tags) => setBrandTags(label.id, 'seoKeywords', tags)}
                    placeholder="Type a keyword and press Enter"
                  />
                </div>
                <div className="brand-labels__tag-field">
                  <label className="settings-field__label">Terms to Avoid</label>
                  <TagInput
                    tags={getBrandTags(label.id, 'avoidTerms')}
                    onChange={(tags) => setBrandTags(label.id, 'avoidTerms', tags)}
                    placeholder="Type a term to avoid and press Enter"
                  />
                </div>
              </div>
              {hasEdits && (
                <div className="brand-labels__card-footer">
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handleSaveBrandLabel(label.id)}
                    disabled={status === 'saving'}
                  >
                    {status === 'saving' ? <Loader2 size={12} className="spin" /> : status === 'saved' ? <Check size={12} /> : <Save size={12} />}
                    {status === 'saved' ? 'Saved' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

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
  );
}
