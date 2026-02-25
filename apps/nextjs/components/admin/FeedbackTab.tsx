'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2, ChevronRight, AlertTriangle, Bot, Download, Play, CheckCircle2,
} from 'lucide-react';
import Toggle from '@/components/ui/Toggle';
import SearchSelect from '@/components/ui/SearchSelect';
import Modal from '@/components/ui/Modal';
import type { SearchSelectGroup } from '@/components/ui/SearchSelect';
import { useSettings } from './SettingsContext';
import {
  fetchFeedbackResponses,
  fetchFeedbackStats,
  fetchFeedbackForms,
  fetchPendingReviewIds,
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

// ---- Response Row ----

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

// ---- Batch review progress bar ----

interface ReviewProgressProps {
  done: number;
  total: number;
  currentLabel?: string;
}

function ReviewProgress({ done, total, currentLabel }: ReviewProgressProps): React.ReactElement {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="feedback-tab__batch-progress">
      <div className="feedback-tab__batch-progress-bar">
        <div className="feedback-tab__batch-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="feedback-tab__batch-progress-text">
        <Loader2 size={12} className="spin" style={{ flexShrink: 0 }} />
        {currentLabel
          ? <span>Reviewing {done + 1} of {total}&hairsp;&mdash;&hairsp;{currentLabel}</span>
          : <span>Reviewed {done} of {total}</span>
        }
      </div>
    </div>
  );
}

// ---- Main Tab ----

const BATCH_OPTIONS = [5, 10, 20, 50] as const;

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

  // Batch review
  const [batchSize, setBatchSize] = useState<number>(10);
  const [reviewing, setReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState<{ done: number; total: number; currentLabel?: string }>({ done: 0, total: 0 });
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [remainingAfterBatch, setRemainingAfterBatch] = useState(0);
  const [reviewDoneMsg, setReviewDoneMsg] = useState('');
  const reviewAbortRef = useRef(false);

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

  const refreshStats = useCallback(() => {
    fetchFeedbackStats().then((r) => { if (r.success && r.data) setStats(r.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
    fetchFeedbackForms().then((r) => { if (r.success && r.data) setForms(r.data); }).catch(() => {});
  }, [refreshStats]);

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

  async function runBatch(ids: string[]): Promise<void> {
    reviewAbortRef.current = false;
    setReviewing(true);
    setReviewProgress({ done: 0, total: ids.length });
    setReviewDoneMsg('');

    for (let i = 0; i < ids.length; i++) {
      if (reviewAbortRef.current) break;
      const id = ids[i];
      const questions = responses.find((r) => r.id === id);
      setReviewProgress({ done: i, total: ids.length, currentLabel: questions?.storeCode || `#${i + 1}` });
      await triggerFeedbackReview(id);
      setReviewProgress({ done: i + 1, total: ids.length });
    }

    setReviewing(false);

    // Refresh data
    await Promise.all([
      loadResponses(page, statusFilter, storeCodeFilter, formSlugFilter),
      refreshStats(),
    ]);

    // Check if more remain
    const pending = await fetchPendingReviewIds(1);
    const remaining = pending.success && pending.data ? pending.data.total : 0;

    if (remaining > 0) {
      setRemainingAfterBatch(remaining);
      setShowContinueModal(true);
    } else {
      setReviewDoneMsg('All responses reviewed.');
    }
  }

  async function handleStartReview(): Promise<void> {
    const result = await fetchPendingReviewIds(batchSize);
    if (!result.success || !result.data || result.data.ids.length === 0) {
      setReviewDoneMsg('No unreviewed responses found.');
      return;
    }
    await runBatch(result.data.ids);
  }

  async function handleContinueReview(): Promise<void> {
    setShowContinueModal(false);
    const result = await fetchPendingReviewIds(batchSize);
    if (!result.success || !result.data || result.data.ids.length === 0) {
      setReviewDoneMsg('All responses reviewed.');
      return;
    }
    await runBatch(result.data.ids);
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">Feedback</h2>

      {/* Settings row: toggles in a subtle bar */}
      <div className="feedback-tab__settings-bar">
        <Toggle
          checked={allSettings.feedback_enabled === 'true'}
          onChange={() => handleToggle('feedback_enabled', allSettings.feedback_enabled === 'true')}
          label="Feedback enabled"
        />
        <Toggle
          checked={allSettings.feedback_widget_enabled === 'true'}
          onChange={() => handleToggle('feedback_widget_enabled', allSettings.feedback_widget_enabled === 'true')}
          label="Floating widget"
        />
        <Toggle
          checked={allSettings.feedback_agent_enabled === 'true'}
          onChange={() => handleToggle('feedback_agent_enabled', allSettings.feedback_agent_enabled === 'true')}
          label="Agent review"
        />
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

      {/* Responses section */}
      <div className="feedback-tab__responses-section">
        {/* Section header: label + batch review controls */}
        <div className="feedback-tab__responses-header">
          <span className="feedback-tab__responses-title">Responses</span>

          <div className="feedback-tab__batch-controls">
            {reviewing ? (
              <ReviewProgress
                done={reviewProgress.done}
                total={reviewProgress.total}
                currentLabel={reviewProgress.currentLabel}
              />
            ) : (
              <>
                {reviewDoneMsg && (
                  <span className="feedback-tab__batch-done">
                    <CheckCircle2 size={13} />
                    {reviewDoneMsg}
                  </span>
                )}
                <label className="feedback-tab__batch-label">Review</label>
                <select
                  className="feedback-tab__batch-select"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                >
                  {BATCH_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} at a time</option>
                  ))}
                </select>
                <button
                  className="feedback-tab__batch-btn"
                  onClick={handleStartReview}
                  title="Run agent review on unreviewed responses"
                >
                  <Play size={12} />
                  Review New
                </button>
              </>
            )}
          </div>
        </div>

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
      </div>

      {/* Form management */}
      <div className="feedback-tab__forms">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gray-500)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forms</h3>
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

      {/* Continue-batch modal */}
      <Modal
        open={showContinueModal}
        onClose={() => setShowContinueModal(false)}
        title="Continue reviewing?"
      >
        <div className="feedback-tab__continue-modal">
          <p className="feedback-tab__continue-modal-body">
            {remainingAfterBatch} response{remainingAfterBatch !== 1 ? 's' : ''} still need agent review.
            Continue with the next {batchSize}?
          </p>
          <div className="feedback-tab__continue-modal-actions">
            <button className="btn btn--primary" onClick={handleContinueReview}>
              <Play size={13} />
              Continue reviewing
            </button>
            <button className="btn btn--ghost" onClick={() => setShowContinueModal(false)}>
              Done for now
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
