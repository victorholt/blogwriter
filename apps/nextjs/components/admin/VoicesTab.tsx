'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchVoicePresets,
  createVoicePreset,
  updateVoicePreset,
  deleteVoicePreset,
  formatVoicePresetStream,
} from '@/lib/admin-api';
import type { AdminVoicePreset } from '@/lib/admin-api';
import type { BrandVoice } from '@/types';
import {
  Plus,
  Save,
  Trash2,
  Check,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import BrandVoicePreview from '@/components/ui/BrandVoicePreview';

interface VoicesTabProps {
  token: string;
}

export default function VoicesTab({ token }: VoicesTabProps): React.ReactElement {
  const [presets, setPresets] = useState<AdminVoicePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<number, Partial<AdminVoicePreset>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Create form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRawText, setNewRawText] = useState('');
  const [newAdditionalInstructions, setNewAdditionalInstructions] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'formatting' | 'error'>('idle');
  const [createErrorMessage, setCreateErrorMessage] = useState('');
  const [createStatusMessages, setCreateStatusMessages] = useState<string[]>([]);
  const [createPreview, setCreatePreview] = useState<BrandVoice | null>(null);

  // Per-preset formatting & preview
  const [formatStatus, setFormatStatus] = useState<Record<number, 'idle' | 'formatting'>>({});
  const [formatMessages, setFormatMessages] = useState<Record<number, string[]>>({});
  const [previewVoice, setPreviewVoice] = useState<Record<number, BrandVoice>>({});
  const [showPreview, setShowPreview] = useState<Record<number, boolean>>({});
  const [expandedRawText, setExpandedRawText] = useState<Record<number, boolean>>({});

  const loadPresets = useCallback(async () => {
    try {
      const result = await fetchVoicePresets(token);
      if (result.success && result.data) {
        setPresets(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // --- Helpers ---

  function getPresetValue<K extends keyof AdminVoicePreset>(id: number, field: K): AdminVoicePreset[K] | string {
    const edit = edits[id];
    if (edit && field in edit) return edit[field] as AdminVoicePreset[K];
    const preset = presets.find((p) => p.id === id);
    return preset ? preset[field] : '';
  }

  function setPresetValue(id: number, field: keyof AdminVoicePreset, value: string): void {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function parseFormattedVoice(jsonStr: string | null): BrandVoice | null {
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  }

  // --- CRUD ---

  async function handleToggleActive(preset: AdminVoicePreset): Promise<void> {
    const result = await updateVoicePreset(token, preset.id, { isActive: !preset.isActive });
    if (result.success && result.data) {
      setPresets((prev) => prev.map((p) => (p.id === preset.id ? result.data! : p)));
    }
  }

  async function handleSave(id: number): Promise<void> {
    setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    const edit = edits[id];
    if (!edit) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'idle' }));
      return;
    }

    const result = await updateVoicePreset(token, id, {
      name: edit.name ?? undefined,
      description: edit.description ?? undefined,
      rawSourceText: edit.rawSourceText ?? undefined,
      additionalInstructions: edit.additionalInstructions ?? undefined,
    });

    if (result.success && result.data) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setPresets((prev) => prev.map((p) => (p.id === id ? result.data! : p)));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 2000);
    } else {
      setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [id]: 'idle' })), 3000);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    const result = await deleteVoicePreset(token, id);
    if (result.success) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    }
  }

  // --- Format (existing preset) ---

  async function handleFormat(id: number): Promise<void> {
    const rawText = (getPresetValue(id, 'rawSourceText') as string) || '';
    if (!rawText.trim()) return;

    const additionalInstructions = (getPresetValue(id, 'additionalInstructions') as string) || undefined;

    setFormatStatus((prev) => ({ ...prev, [id]: 'formatting' }));
    setFormatMessages((prev) => ({ ...prev, [id]: [] }));
    setShowPreview((prev) => ({ ...prev, [id]: true }));

    const result = await formatVoicePresetStream(
      token,
      rawText,
      (msg) => setFormatMessages((prev) => ({ ...prev, [id]: [...(prev[id] || []), msg] })),
      additionalInstructions,
    );

    setFormatStatus((prev) => ({ ...prev, [id]: 'idle' }));

    if (result.success && result.data) {
      setPreviewVoice((prev) => ({ ...prev, [id]: result.data! }));

      // Save the formatted voice to the preset
      const saveResult = await updateVoicePreset(token, id, {
        formattedVoice: JSON.stringify(result.data),
      });
      if (saveResult.success && saveResult.data) {
        setPresets((prev) => prev.map((p) => (p.id === id ? saveResult.data! : p)));
      }
    }
  }

  function handleShowPreview(id: number): void {
    const preset = presets.find((p) => p.id === id);
    if (!preset?.formattedVoice) return;
    const voice = parseFormattedVoice(preset.formattedVoice);
    if (voice) {
      setPreviewVoice((prev) => ({ ...prev, [id]: voice }));
      setShowPreview((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  }

  // --- Create + Format flow ---

  async function handleCreateAndFormat(): Promise<void> {
    if (!newName.trim() || !newRawText.trim()) return;

    setCreateStatus('formatting');
    setCreateStatusMessages([]);
    setCreatePreview(null);
    setCreateErrorMessage('');

    // First format the raw text
    const formatResult = await formatVoicePresetStream(
      token,
      newRawText,
      (msg) => setCreateStatusMessages((prev) => [...prev, msg]),
      newAdditionalInstructions || undefined,
    );

    if (!formatResult.success || !formatResult.data) {
      setCreateStatus('error');
      setCreateErrorMessage(formatResult.error || 'Failed to format voice preset');
      setTimeout(() => setCreateStatus('idle'), 5000);
      return;
    }

    setCreatePreview(formatResult.data);
    setCreateStatus('idle');
  }

  async function handleAcceptAndSave(): Promise<void> {
    if (!createPreview || !newName.trim()) return;

    setCreateStatus('saving');
    const result = await createVoicePreset(token, {
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      rawSourceText: newRawText.trim(),
      formattedVoice: JSON.stringify(createPreview),
      additionalInstructions: newAdditionalInstructions.trim() || undefined,
    });

    if (result.success && result.data) {
      setPresets((prev) => [...prev, result.data!]);
      setNewName('');
      setNewDescription('');
      setNewRawText('');
      setNewAdditionalInstructions('');
      setCreatePreview(null);
      setCreating(false);
      setCreateStatus('idle');
    } else {
      setCreateStatus('error');
      setCreateErrorMessage(result.error || 'Failed to save voice preset');
      setTimeout(() => setCreateStatus('idle'), 5000);
    }
  }

  function handleCancelCreate(): void {
    setCreating(false);
    setNewName('');
    setNewDescription('');
    setNewRawText('');
    setNewAdditionalInstructions('');
    setCreatePreview(null);
    setCreateStatusMessages([]);
    setCreateErrorMessage('');
    setCreateStatus('idle');
  }

  // --- Filter ---

  const filteredPresets = search
    ? presets.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : presets;

  if (loading) {
    return (
      <section className="settings-section">
        <div className="settings-loading">
          <Loader2 size={24} className="spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="voices-tab__header">
        <div className="voices-tab__search-wrap">
          <Search size={14} className="voices-tab__search-icon" />
          <input
            type="text"
            className="voices-tab__search"
            placeholder="Search voice presets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          <Plus size={14} />
          Add Voice Preset
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="settings-card voices-tab__create-card">
          <h3 className="settings-card__title">New Voice Preset</h3>
          <div className="settings-card__fields">
            <div className="settings-field">
              <label className="settings-field__label">Name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Luxury Bridal Voice"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">
                Description
                <span className="settings-field__hint"> — internal note, not shown to users</span>
              </label>
              <input
                className="input"
                type="text"
                placeholder="Brief description of this voice preset"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">Raw Voice Text</label>
              <textarea
                className="input settings-field__textarea"
                placeholder="Paste or type the brand voice document text here..."
                value={newRawText}
                onChange={(e) => setNewRawText(e.target.value)}
                rows={8}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">
                Additional Formatting Instructions
                <span className="settings-field__hint"> — optional guidance for the formatter agent</span>
              </label>
              <textarea
                className="input settings-field__textarea"
                placeholder="e.g. Emphasize the luxury tone, split vocabulary into more categories..."
                value={newAdditionalInstructions}
                onChange={(e) => setNewAdditionalInstructions(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Format status messages */}
          {createStatusMessages.length > 0 && (
            <div className="voices-tab__status-log">
              {createStatusMessages.map((msg, i) => (
                <div key={i} className="voices-tab__status-msg">{msg}</div>
              ))}
            </div>
          )}

          {/* Preview after formatting */}
          {createPreview && (
            <div className="voices-tab__preview-panel">
              <h4 className="voices-tab__preview-title">Preview</h4>
              <BrandVoicePreview brandVoice={createPreview} showDownload />
            </div>
          )}

          <div className="settings-card__footer">
            <button className="btn btn--ghost" onClick={handleCancelCreate}>
              Cancel
            </button>
            <div className="voices-tab__footer-right">
              {createPreview ? (
                <>
                  <button
                    className="btn btn--outline"
                    onClick={() => { setCreatePreview(null); setCreateStatusMessages([]); }}
                  >
                    <RefreshCw size={14} />
                    Try Again
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={handleAcceptAndSave}
                    disabled={createStatus === 'saving'}
                  >
                    {createStatus === 'saving' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    Accept &amp; Save
                  </button>
                </>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={handleCreateAndFormat}
                  disabled={!newName.trim() || !newRawText.trim() || createStatus === 'formatting'}
                >
                  {createStatus === 'formatting' ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
                  {createStatus === 'formatting' ? 'Formatting...' : 'Format & Preview'}
                </button>
              )}
            </div>
          </div>
          {createStatus === 'error' && <p className="error-text">{createErrorMessage}</p>}
        </div>
      )}

      {/* Preset list */}
      {filteredPresets.length === 0 && !creating && (
        <div className="settings-card">
          <p className="settings-field__label" style={{ textAlign: 'center', padding: 24 }}>
            {search ? 'No voice presets match your search' : 'No voice presets yet. Click "Add Voice Preset" to create one.'}
          </p>
        </div>
      )}

      {filteredPresets.map((preset) => {
        const status = saveStatus[preset.id] ?? 'idle';
        const hasEdits = preset.id in edits;
        const isDeleting = deleteConfirm === preset.id;
        const isFormatting = formatStatus[preset.id] === 'formatting';
        const hasFormatted = !!preset.formattedVoice;
        const isPreviewOpen = showPreview[preset.id] ?? false;
        const isRawExpanded = expandedRawText[preset.id] ?? false;
        const currentPreview = previewVoice[preset.id];
        const messages = formatMessages[preset.id] || [];

        return (
          <div key={preset.id} className={`settings-card${!preset.isActive ? ' settings-card--disabled' : ''}`}>
            <div className="settings-card__title-row">
              <div className="settings-card__fields" style={{ flex: 1 }}>
                <div className="settings-field">
                  <label className="settings-field__label">Name</label>
                  <input
                    className="input"
                    type="text"
                    value={getPresetValue(preset.id, 'name') as string}
                    onChange={(e) => setPresetValue(preset.id, 'name', e.target.value)}
                  />
                </div>
              </div>
              <div className="voices-tab__card-badges">
                {hasFormatted && <span className="voices-tab__badge voices-tab__badge--formatted">Formatted</span>}
                <Toggle
                  checked={preset.isActive}
                  onChange={() => handleToggleActive(preset)}
                />
              </div>
            </div>

            <div className="settings-card__fields">
              <div className="settings-field">
                <label className="settings-field__label">
                  Description
                  <span className="settings-field__hint"> — internal note</span>
                </label>
                <input
                  className="input"
                  type="text"
                  value={(getPresetValue(preset.id, 'description') as string) || ''}
                  onChange={(e) => setPresetValue(preset.id, 'description', e.target.value)}
                />
              </div>

              {/* Collapsible Raw Text */}
              <div className="settings-field">
                <button
                  type="button"
                  className="voices-tab__collapsible-toggle"
                  onClick={() => setExpandedRawText((prev) => ({ ...prev, [preset.id]: !prev[preset.id] }))}
                >
                  <span className="settings-field__label" style={{ margin: 0 }}>Raw Source Text</span>
                  {isRawExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isRawExpanded && (
                  <textarea
                    className="input settings-field__textarea"
                    value={(getPresetValue(preset.id, 'rawSourceText') as string) || ''}
                    onChange={(e) => setPresetValue(preset.id, 'rawSourceText', e.target.value)}
                    rows={8}
                  />
                )}
              </div>

              <div className="settings-field">
                <label className="settings-field__label">
                  Additional Formatting Instructions
                  <span className="settings-field__hint"> — optional</span>
                </label>
                <textarea
                  className="input settings-field__textarea"
                  placeholder="Optional instructions for the formatting agent..."
                  value={(getPresetValue(preset.id, 'additionalInstructions') as string) || ''}
                  onChange={(e) => setPresetValue(preset.id, 'additionalInstructions', e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Format status messages */}
            {messages.length > 0 && (
              <div className="voices-tab__status-log">
                {messages.map((msg, i) => (
                  <div key={i} className="voices-tab__status-msg">{msg}</div>
                ))}
              </div>
            )}

            {/* Preview panel */}
            {isPreviewOpen && currentPreview && (
              <div className="voices-tab__preview-panel">
                <h4 className="voices-tab__preview-title">Voice Preview</h4>
                <BrandVoicePreview brandVoice={currentPreview} showDownload />
              </div>
            )}

            <div className="settings-card__footer">
              <div className="voices-tab__footer-left">
                {isDeleting ? (
                  <div className="voices-tab__delete-confirm">
                    <span className="settings-field__label">Delete?</span>
                    <button className="btn btn--outline btn--danger btn--sm" onClick={() => handleDelete(preset.id)}>
                      Yes, delete
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirm(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn--ghost btn--danger btn--sm"
                    onClick={() => setDeleteConfirm(preset.id)}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
              <div className="voices-tab__footer-right">
                {hasFormatted && (
                  <button
                    className="btn btn--outline btn--sm"
                    onClick={() => handleShowPreview(preset.id)}
                  >
                    <Eye size={13} />
                    {isPreviewOpen ? 'Hide Preview' : 'Preview'}
                  </button>
                )}
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => handleFormat(preset.id)}
                  disabled={isFormatting || !(getPresetValue(preset.id, 'rawSourceText') as string)?.trim()}
                >
                  {isFormatting ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                  {hasFormatted ? 'Re-format' : 'Format'}
                </button>
                <button
                  className={`btn ${hasEdits ? 'btn--primary' : 'btn--outline'} btn--sm`}
                  onClick={() => handleSave(preset.id)}
                  disabled={status === 'saving' || !hasEdits}
                >
                  {status === 'saving' ? (
                    <Loader2 size={13} className="spin" />
                  ) : status === 'saved' ? (
                    <Check size={13} />
                  ) : status === 'error' ? (
                    <AlertCircle size={13} />
                  ) : (
                    <Save size={13} />
                  )}
                  {status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
