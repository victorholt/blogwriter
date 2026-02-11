'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  enhanceText,
} from '@/lib/admin-api';
import type { AdminTheme } from '@/lib/admin-api';
import { Plus, Save, Trash2, Check, Loader2, AlertCircle, Search, Sparkles } from 'lucide-react';
import Toggle from '@/components/ui/Toggle';

interface ThemesTabProps {
  token: string;
}

export default function ThemesTab({ token }: ThemesTabProps): React.ReactElement {
  const [themes, setThemes] = useState<AdminTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<number, Partial<AdminTheme>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<number, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [enhancing, setEnhancing] = useState<Record<string, boolean>>({});

  const loadThemes = useCallback(async () => {
    try {
      const result = await fetchAdminThemes(token);
      if (result.success && result.data) {
        setThemes(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  function getThemeValue(id: number, field: keyof AdminTheme): string {
    const edit = edits[id];
    if (edit && field in edit) return edit[field] as string;
    const theme = themes.find((t) => t.id === id);
    return theme ? (theme[field] as string) : '';
  }

  function setThemeValue(id: number, field: keyof AdminTheme, value: string): void {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handleToggleActive(theme: AdminTheme): Promise<void> {
    const result = await updateTheme(token, theme.id, { isActive: !theme.isActive });
    if (result.success && result.data) {
      setThemes((prev) => prev.map((t) => (t.id === theme.id ? result.data! : t)));
    }
  }

  async function handleSave(id: number): Promise<void> {
    setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    const edit = edits[id];
    if (!edit) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'idle' }));
      return;
    }

    const result = await updateTheme(token, id, {
      name: edit.name,
      description: edit.description,
    });

    if (result.success && result.data) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setThemes((prev) => prev.map((t) => (t.id === id ? result.data! : t)));
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
    const result = await deleteTheme(token, id);
    if (result.success) {
      setThemes((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    }
  }

  async function handleCreate(): Promise<void> {
    if (!newName.trim()) return;
    setCreateStatus('saving');
    const result = await createTheme(token, {
      name: newName.trim(),
      description: newDescription.trim(),
    });
    if (result.success && result.data) {
      setThemes((prev) => [...prev, result.data!]);
      setNewName('');
      setNewDescription('');
      setCreating(false);
      setCreateStatus('idle');
    } else {
      setCreateStatus('error');
      setTimeout(() => setCreateStatus('idle'), 3000);
    }
  }

  async function handleEnhance(key: string, text: string, onResult: (text: string) => void): Promise<void> {
    if (!text.trim() || enhancing[key]) return;
    setEnhancing((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await enhanceText(token, text, 'a theme description that guides AI blog-writing agents — it should be specific, actionable, and describe the theme\'s focus, tone, and key topics');
      if (result.success && result.data) {
        onResult(result.data.text);
      }
    } finally {
      setEnhancing((prev) => ({ ...prev, [key]: false }));
    }
  }

  const filteredThemes = search
    ? themes.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()),
      )
    : themes;

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
      <div className="themes-tab__header">
        <div className="themes-tab__search-wrap">
          <Search size={14} className="themes-tab__search-icon" />
          <input
            type="text"
            className="themes-tab__search"
            placeholder="Search themes..."
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
          Add Theme
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="settings-card themes-tab__create-card">
          <h3 className="settings-card__title">New Theme</h3>
          <div className="settings-card__fields">
            <div className="settings-field">
              <label className="settings-field__label">Name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Summer Wedding Trends"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="settings-field">
              <label className="settings-field__label">
                Agent Description
                <span className="settings-field__hint"> — guides the AI, not shown to users</span>
              </label>
              <div className="enhance-wrap">
                <textarea
                  className="input settings-field__textarea"
                  rows={3}
                  placeholder="Describe the theme's focus, tone, and key topics for the AI agents..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
                {newDescription.trim() && (
                  <button
                    type="button"
                    className="enhance-btn"
                    onClick={() => handleEnhance('new', newDescription, setNewDescription)}
                    disabled={enhancing['new']}
                    title="Enhance with AI"
                  >
                    {enhancing['new'] ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                    {enhancing['new'] ? 'Enhancing...' : 'Enhance'}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="settings-card__footer">
            <button className="btn btn--ghost" onClick={() => { setCreating(false); setNewName(''); setNewDescription(''); }}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={!newName.trim() || createStatus === 'saving'}
            >
              {createStatus === 'saving' ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              {createStatus === 'saving' ? 'Creating...' : 'Create Theme'}
            </button>
          </div>
          {createStatus === 'error' && <p className="error-text">Failed to create theme</p>}
        </div>
      )}

      {/* Theme list */}
      {filteredThemes.length === 0 && !creating && (
        <div className="settings-card">
          <p className="settings-field__label" style={{ textAlign: 'center', padding: 24 }}>
            {search ? 'No themes match your search' : 'No themes yet. Click "Add Theme" to create one.'}
          </p>
        </div>
      )}

      {filteredThemes.map((theme) => {
        const status = saveStatus[theme.id] ?? 'idle';
        const hasEdits = theme.id in edits;
        const isDeleting = deleteConfirm === theme.id;

        return (
          <div key={theme.id} className={`settings-card${!theme.isActive ? ' settings-card--disabled' : ''}`}>
            <div className="settings-card__title-row">
              <div className="settings-card__fields" style={{ flex: 1 }}>
                <div className="settings-field">
                  <label className="settings-field__label">Name</label>
                  <input
                    className="input"
                    type="text"
                    value={getThemeValue(theme.id, 'name')}
                    onChange={(e) => setThemeValue(theme.id, 'name', e.target.value)}
                  />
                </div>
              </div>
              <Toggle
                checked={theme.isActive}
                onChange={() => handleToggleActive(theme)}
              />
            </div>

            <div className="settings-card__fields">
              <div className="settings-field">
                <label className="settings-field__label">
                  Agent Description
                  <span className="settings-field__hint"> — guides the AI, not shown to users</span>
                </label>
                <div className="enhance-wrap">
                  <textarea
                    className="input settings-field__textarea"
                    rows={3}
                    value={getThemeValue(theme.id, 'description')}
                    onChange={(e) => setThemeValue(theme.id, 'description', e.target.value)}
                  />
                  {getThemeValue(theme.id, 'description').trim() && (
                    <button
                      type="button"
                      className="enhance-btn"
                      onClick={() => handleEnhance(
                        String(theme.id),
                        getThemeValue(theme.id, 'description'),
                        (text) => setThemeValue(theme.id, 'description', text),
                      )}
                      disabled={enhancing[String(theme.id)]}
                      title="Enhance with AI"
                    >
                      {enhancing[String(theme.id)] ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                      {enhancing[String(theme.id)] ? 'Enhancing...' : 'Enhance'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-card__footer">
              {isDeleting ? (
                <div className="themes-tab__delete-confirm">
                  <span className="settings-field__label">Delete this theme?</span>
                  <button className="btn btn--outline btn--danger btn--sm" onClick={() => handleDelete(theme.id)}>
                    Yes, delete
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirm(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn--ghost btn--danger btn--sm"
                  onClick={() => setDeleteConfirm(theme.id)}
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
              <button
                className={`btn ${hasEdits ? 'btn--primary' : 'btn--outline'}`}
                onClick={() => handleSave(theme.id)}
                disabled={status === 'saving' || !hasEdits}
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
  );
}
