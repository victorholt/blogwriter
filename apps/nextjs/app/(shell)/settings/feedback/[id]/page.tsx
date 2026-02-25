'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import {
  fetchFeedbackResponse,
  fetchFeedbackForms,
  updateFeedbackResponse,
  triggerFeedbackReview,
  type FeedbackResponseItem,
  type FeedbackFormItem,
} from '@/lib/admin-api';
import { useSettings } from '@/components/admin/SettingsContext';

interface ParsedQuestion {
  id: string;
  section: number;
  question: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}

interface ParsedReview {
  flagged: boolean;
  flags: string[];
  summary: string;
}

const SECTION_LABELS: Record<number, string> = {
  1: 'Workflow & Performance',
  2: 'Qualitative Insight',
  3: 'About Your Store',
};

function getLabel(questions: ParsedQuestion[], qId: string, value: string): string {
  const q = questions.find((x) => x.id === qId);
  return q?.options?.find((o) => o.value === value)?.label ?? value;
}

export default function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }): React.ReactElement {
  const { id } = use(params);
  const { allSettings } = useSettings();
  const agentEnabled = allSettings.feedback_agent_enabled === 'true';

  const [response, setResponse] = useState<FeedbackResponseItem | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchFeedbackResponse(id),
      fetchFeedbackForms(),
    ]).then(([responseResult, formsResult]) => {
      if (!responseResult.success || !responseResult.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const r = responseResult.data;
      setResponse(r);
      setStatus(r.status);
      setNotes(r.adminNotes || '');

      if (formsResult.success && formsResult.data) {
        const form = formsResult.data.find((f: FeedbackFormItem) => f.slug === r.formSlug);
        if (form) {
          try { setQuestions(JSON.parse(form.questions)); } catch { /* ignore */ }
        }
      }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  async function handleStatusChange(newStatus: string): Promise<void> {
    setStatus(newStatus);
    await updateFeedbackResponse(id, { status: newStatus });
    setResponse((prev) => prev ? { ...prev, status: newStatus } : prev);
  }

  async function handleNotesBlur(): Promise<void> {
    if (notes === (response?.adminNotes || '')) return;
    setSavingNotes(true);
    await updateFeedbackResponse(id, { adminNotes: notes });
    setResponse((prev) => prev ? { ...prev, adminNotes: notes } : prev);
    setSavingNotes(false);
  }

  async function handleAgentReview(): Promise<void> {
    setReviewing(true);
    const result = await triggerFeedbackReview(id);
    if (result.success && result.data) {
      const updated = result.data as FeedbackResponseItem;
      setResponse((prev) => prev ? { ...prev, agentReview: updated.agentReview, agentReviewedAt: updated.agentReviewedAt } : prev);
    }
    setReviewing(false);
  }

  if (loading) {
    return (
      <div className="feedback-detail">
        <Link href="/settings/feedback" className="feedback-detail__back">
          <ArrowLeft size={14} /> Back to Feedback
        </Link>
        <div style={{ padding: '40px 0', color: 'var(--color-gray-400)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} className="spin" /> Loading response…
        </div>
      </div>
    );
  }

  if (notFound || !response) {
    return (
      <div className="feedback-detail">
        <Link href="/settings/feedback" className="feedback-detail__back">
          <ArrowLeft size={14} /> Back to Feedback
        </Link>
        <p style={{ color: 'var(--color-gray-400)', fontSize: 14 }}>Response not found.</p>
      </div>
    );
  }

  const answers = (() => { try { return JSON.parse(response.answers) as Record<string, string>; } catch { return {} as Record<string, string>; } })();
  const review = (() => { try { return response.agentReview ? JSON.parse(response.agentReview) as ParsedReview : null; } catch { return null; } })();
  const sections = Array.from(new Set(questions.map((q) => q.section))).sort((a, b) => a - b);

  return (
    <div className="feedback-detail">
      <Link href="/settings/feedback" className="feedback-detail__back">
        <ArrowLeft size={14} /> Back to Feedback
      </Link>

      {/* Header */}
      <div className="feedback-detail__header">
        <div className="feedback-detail__meta">
          <span className="feedback-detail__date">
            {new Date(response.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <div className="feedback-detail__chips">
            {response.storeCode && <span className="feedback-detail__store">{response.storeCode}</span>}
            {answers.role && <span className="feedback-detail__chip">{getLabel(questions, 'role', answers.role)}</span>}
            {answers.businessType && <span className="feedback-detail__chip">{getLabel(questions, 'businessType', answers.businessType)}</span>}
            <span className="feedback-detail__chip" style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-gray-400)' }}>
              {response.formSlug}
            </span>
          </div>
        </div>
        <select
          className="feedback-detail__status-select"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="actioned">Actioned</option>
        </select>
      </div>

      {/* Answers grouped by section */}
      {sections.length > 0 ? (
        sections.map((sectionNum) => {
          const sectionQuestions = questions.filter((q) => q.section === sectionNum);
          return (
            <div key={sectionNum} className="settings-card feedback-detail__section">
              <div className="feedback-detail__section-title">
                {SECTION_LABELS[sectionNum] ?? `Section ${sectionNum}`}
              </div>
              <div className="feedback-detail__answers">
                {sectionQuestions.map((q) => {
                  const val = answers[q.id];
                  return (
                    <div key={q.id} className="feedback-detail__answer">
                      <div className="feedback-detail__answer-q">{q.question}</div>
                      {val ? (
                        <div className="feedback-detail__answer-v">{getLabel(questions, q.id, val)}</div>
                      ) : (
                        <div className="feedback-detail__answer-empty">No answer</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        // Fallback: no form definition, show raw answers
        <div className="settings-card feedback-detail__section">
          <div className="feedback-detail__section-title">Answers</div>
          <div className="feedback-detail__answers">
            {Object.entries(answers).map(([k, v]) => (
              <div key={k} className="feedback-detail__answer">
                <div className="feedback-detail__answer-q">{k}</div>
                <div className="feedback-detail__answer-v">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Review */}
      <div className="settings-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: review ? 12 : 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--color-gray-700)' }}>
            <Bot size={16} />
            Agent Review
            {response.agentReviewedAt && (
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-gray-400)' }}>
                · {new Date(response.agentReviewedAt).toLocaleString()}
              </span>
            )}
          </div>
          {(agentEnabled || response.agentReviewedAt) && (
            <button
              className="btn btn--ghost"
              style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={handleAgentReview}
              disabled={reviewing}
            >
              {reviewing ? (
                <><Loader2 size={13} className="spin" /> Reviewing…</>
              ) : (
                <><Bot size={13} /> {response.agentReviewedAt ? 'Re-run review' : 'Run agent review'}</>
              )}
            </button>
          )}
        </div>

        {review ? (
          <div className={`feedback-detail__agent-card feedback-detail__agent-card--${review.flagged ? 'flagged' : 'ok'}`}>
            <div className="feedback-detail__agent-header">
              <div className="feedback-detail__agent-title">
                {review.flagged
                  ? <><AlertTriangle size={14} /> Flagged — quality concern</>
                  : <><CheckCircle size={14} /> Looks good</>
                }
              </div>
            </div>
            {review.flags.length > 0 && (
              <ul className="feedback-detail__agent-flags">
                {review.flags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
            <div className="feedback-detail__agent-summary">{review.summary}</div>
          </div>
        ) : !agentEnabled ? (
          <p style={{ fontSize: 13, color: 'var(--color-gray-400)', marginTop: 4 }}>
            Agent review is disabled. Enable it in settings to automatically review new responses.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-gray-400)', marginTop: 4 }}>
            Not yet reviewed. Click "Run agent review" above.
          </p>
        )}
      </div>

      {/* Admin Notes */}
      <div className="settings-card">
        <label className="feedback-detail__notes-label">Admin Notes</label>
        <textarea
          className="feedback-detail__notes-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add internal notes about this response…"
        />
        <div className="feedback-detail__notes-hint">
          {savingNotes ? 'Saving…' : 'Auto-saved on blur'}
        </div>
      </div>
    </div>
  );
}
