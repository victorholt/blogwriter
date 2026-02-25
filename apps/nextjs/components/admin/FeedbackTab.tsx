'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2, ChevronRight, AlertTriangle, Bot, Download,
} from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import SearchSelect from '@/components/ui/SearchSelect';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';
import { useSettings } from './SettingsContext';
import {
  fetchFeedbackResponses,
  fetchFeedbackStats,
  fetchFeedbackForms,
  updateFeedbackResponse,
  triggerFeedbackReview,
  exportFeedbackForm,
  updateFeedbackForm,
  updateSettings,
  type FeedbackResponseItem,
  type FeedbackFormItem,
  type FeedbackStats,
} from '@/lib/admin-api';

interface ParsedReview {
  flagged: boolean;
  flags: string[];
  summary: string;
}

interface ParsedQuestion {
  id: string;
  question: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}

function parseReview(raw: string | null): ParsedReview | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseAnswers(raw: string): Record<string, string> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function parseQuestions(raw: string): ParsedQuestion[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function getAnswerLabel(questions: ParsedQuestion[], questionId: string, value: string): string {
  const q = questions.find((x) => x.id === questionId);
  if (!q) return value;
  const opt = q.options?.find((o) => o.value === value);
  return opt?.label ?? value;
}

// ---- Response Row (link to detail page) ----

interface ResponseRowProps {
  response: FeedbackResponseItem;
  questions: ParsedQuestion[];
  onUpdated: (id: string, patch: Partial<FeedbackResponseItem>) => void;
}

function ResponseRow({ response, questions }: ResponseRowProps): React.ReactElement {
  const review = parseReview(response.agentReview);
  const answers = parseAnswers(response.answers);
  const isFlagged = review?.flagged === true;

  return (
    <Link
      href={`/settings/feedback/${response.id}`}
      className={`feedback-tab__response${isFlagged ? ' feedback-tab__response--flagged' : ''}`}
      style={{ display: 'block', textDecoration: 'none' }}
    >
      <div className="feedback-tab__response-header">
        <div className="feedback-tab__response-meta">
          <span className="feedback-tab__response-date">
            {new Date(response.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {response.storeCode && (
            <span className="feedback-tab__response-store">{response.storeCode}</span>
          )}
          {answers.role && (
            <span className="feedback-tab__response-chip">
              {questions.find((q) => q.id === 'role')?.options?.find((o) => o.value === answers.role)?.label ?? answers.role}
            </span>
          )}
          {answers.businessType && (
            <span className="feedback-tab__response-chip">
              {questions.find((q) => q.id === 'businessType')?.options?.find((o) => o.value === answers.businessType)?.label ?? answers.businessType}
            </span>
          )}
          {response.agentReviewedAt && (
            <span
              className="feedback-tab__response-chip"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: isFlagged ? '#dc2626' : '#059669', background: isFlagged ? '#fef2f2' : '#f0fdf4' }}
            >
              <Bot size={11} />
              {isFlagged ? 'Flagged' : 'Agent OK'}
            </span>
          )}
        </div>
        <span className={`feedback-tab__status-badge feedback-tab__status-badge--${response.status}`}>
          {response.status}
        </span>
        {isFlagged && <AlertTriangle size={15} className="feedback-tab__flag-icon" />}
        <ChevronRight size={15} style={{ color: 'var(--color-gray-300)', flexShrink: 0 }} />
      </div>
    </Link>
  );
}

// ---- Main Tab ----

export default function FeedbackTab(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [responses, setResponses] = useState<FeedbackResponseItem[]>([]);
  const [forms, setForms] = useState<FeedbackFormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [storeCodeFilter, setStoreCodeFilter] = useState('');
  const [formSlugFilter, setFormSlugFilter] = useState('');

  // Form editing
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [editingQuestionsJson, setEditingQuestionsJson] = useState('');
  const [savingForm, setSavingForm] = useState(false);
  const [formSaveError, setFormSaveError] = useState('');

  const loadResponses = useCallback(async (p: number, status: string, storeCode: string, formSlug: string) => {
    setLoading(true);
    const result = await fetchFeedbackResponses(p, { status: status || undefined, storeCode: storeCode || undefined, formSlug: formSlug || undefined });
    if (result.success && result.data) {
      setResponses(result.data.responses);
      setTotalPages(result.data.totalPages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeedbackStats().then((r) => { if (r.success && r.data) setStats(r.data); }).catch(() => {});
    fetchFeedbackForms().then((r) => { if (r.success && r.data) setForms(r.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    loadResponses(page, statusFilter, storeCodeFilter, formSlugFilter);
  }, [page, statusFilter, storeCodeFilter, formSlugFilter, loadResponses]);

  async function handleToggle(key: string, currentlyOn: boolean): Promise<void> {
    const newValue = currentlyOn ? 'false' : 'true';
    const result = await updateSettings({ [key]: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  function handleResponseUpdated(id: string, patch: Partial<FeedbackResponseItem>): void {
    setResponses((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  // Get questions for a given form slug (for label lookup)
  function getQuestionsForSlug(slug: string): ParsedQuestion[] {
    const form = forms.find((f) => f.slug === slug);
    if (!form) return [];
    return parseQuestions(form.questions);
  }

  function startEditForm(form: FeedbackFormItem): void {
    setEditingFormId(form.id);
    setEditingQuestionsJson(JSON.stringify(JSON.parse(form.questions), null, 2));
    setFormSaveError('');
  }

  async function handleSaveFormQuestions(formId: string): Promise<void> {
    setFormSaveError('');
    // Validate JSON
    try {
      JSON.parse(editingQuestionsJson);
    } catch {
      setFormSaveError('Invalid JSON. Please fix before saving.');
      return;
    }
    setSavingForm(true);
    const result = await updateFeedbackForm(formId, { questions: editingQuestionsJson });
    if (result.success) {
      setForms((prev) => prev.map((f) => f.id === formId ? { ...f, questions: editingQuestionsJson } : f));
      setEditingFormId(null);
    } else {
      setFormSaveError('Failed to save. Please try again.');
    }
    setSavingForm(false);
  }

  async function handleToggleFormActive(form: FeedbackFormItem): Promise<void> {
    await updateFeedbackForm(form.id, { isActive: !form.isActive });
    setForms((prev) => prev.map((f) => f.id === form.id ? { ...f, isActive: !form.isActive } : f));
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">Feedback</h2>

      {/* Toggles */}
      <div className="feedback-tab__toggles">
        <div className="feedback-tab__toggle-item">
          <Toggle
            checked={allSettings.feedback_enabled === 'true'}
            onChange={() => handleToggle('feedback_enabled', allSettings.feedback_enabled === 'true')}
            label="Feedback enabled"
          />
        </div>
        <div className="feedback-tab__toggle-item">
          <Toggle
            checked={allSettings.feedback_widget_enabled === 'true'}
            onChange={() => handleToggle('feedback_widget_enabled', allSettings.feedback_widget_enabled === 'true')}
            label="Floating widget"
          />
        </div>
        <div className="feedback-tab__toggle-item">
          <Toggle
            checked={allSettings.feedback_agent_enabled === 'true'}
            onChange={() => handleToggle('feedback_agent_enabled', allSettings.feedback_agent_enabled === 'true')}
            label="Agent review"
          />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="feedback-tab__stats">
          {[
            { label: 'Total', value: stats.total },
            { label: 'New', value: stats.new },
            { label: 'Reviewed', value: stats.reviewed },
            { label: 'Actioned', value: stats.actioned },
            { label: 'Flagged', value: stats.flagged, flagged: true },
          ].map((s) => (
            <div key={s.label} className={`feedback-tab__stat${s.flagged ? ' feedback-tab__stat--flagged' : ''}`}>
              <div className="feedback-tab__stat-value">{s.value}</div>
              <div className="feedback-tab__stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="feedback-tab__filters">
        <div className="feedback-tab__filter">
          <label>Status</label>
          <SearchSelect
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            groups={[{ label: 'Status', options: [
              { label: 'All', value: '' },
              { label: 'New', value: 'new' },
              { label: 'Reviewed', value: 'reviewed' },
              { label: 'Actioned', value: 'actioned' },
            ] }] satisfies SearchSelectGroup[]}
            placeholder="All"
          />
        </div>
        {forms.length > 1 && (
          <div className="feedback-tab__filter">
            <label>Form</label>
            <SearchSelect
              value={formSlugFilter}
              onChange={(v) => { setFormSlugFilter(v); setPage(1); }}
              groups={[{ label: 'Forms', options: [
                { label: 'All forms', value: '' },
                ...forms.map((f) => ({ label: f.name, value: f.slug })),
              ] }] satisfies SearchSelectGroup[]}
              placeholder="All forms"
            />
          </div>
        )}
        <div className="feedback-tab__filter">
          <label>Store Code</label>
          <input
            className="input"
            style={{ fontSize: 13, padding: '7px 10px' }}
            value={storeCodeFilter}
            onChange={(e) => { setStoreCodeFilter(e.target.value); setPage(1); }}
            placeholder="Filter by store code"
          />
        </div>
      </div>

      {/* Response list */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: '24px 0' }}>
          <Loader2 size={16} className="spin" /> Loading responses…
        </p>
      ) : responses.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: '24px 0' }}>
          No responses yet.
        </p>
      ) : (
        <div className="feedback-tab__list">
          {responses.map((r) => (
            <ResponseRow
              key={r.id}
              response={r}
              questions={getQuestionsForSlug(r.formSlug)}
              onUpdated={handleResponseUpdated}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="blog-dashboard__pagination" style={{ marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {/* Form management */}
      <div className="feedback-tab__forms">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 12 }}>Forms</h3>
        {forms.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-gray-400)' }}>No forms found.</p>
        )}
        {forms.map((form) => (
          <div key={form.id} className="feedback-tab__form-card">
            <div className="feedback-tab__form-info">
              <div className="feedback-tab__form-name">
                {form.name}
                {form.isDefault && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: '#eff6ff', color: 'var(--color-blue)', marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Default
                  </span>
                )}
                {!form.isActive && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: 'var(--color-gray-100)', color: 'var(--color-gray-400)', marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Inactive
                  </span>
                )}
              </div>
              <div className="feedback-tab__form-slug">{form.slug}</div>
            </div>
            <div className="feedback-tab__form-actions">
              <button
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => handleToggleFormActive(form)}
              >
                {form.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => startEditForm(form)}
              >
                Edit Questions
              </button>
              <button
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => exportFeedbackForm(form.id)}
                title="Export form + responses as JSON"
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        ))}

        {/* Inline JSON editor for questions */}
        {editingFormId && (
          <div className="settings-card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 8 }}>
              Edit Questions JSON
            </div>
            <textarea
              className="feedback-textarea"
              style={{ minHeight: 280, fontFamily: 'monospace', fontSize: 12 }}
              value={editingQuestionsJson}
              onChange={(e) => setEditingQuestionsJson(e.target.value)}
              spellCheck={false}
            />
            {formSaveError && <div className="feedback-error">{formSaveError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                className="btn btn--primary"
                onClick={() => handleSaveFormQuestions(editingFormId)}
                disabled={savingForm}
              >
                {savingForm ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn--ghost" onClick={() => setEditingFormId(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
