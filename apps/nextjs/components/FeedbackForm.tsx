'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface FeedbackQuestion {
  id: string;
  section: number;
  required: boolean;
  type: 'radio' | 'textarea';
  question: string;
  options?: QuestionOption[];
}

export interface FeedbackFormData {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  questions: FeedbackQuestion[];
}

const SECTION_LABELS: Record<number, { title: string; required: boolean }> = {
  1: { title: 'Workflow & Performance', required: true },
  2: { title: 'Qualitative Insight', required: false },
  3: { title: 'About Your Store', required: true },
};

interface Props {
  form: FeedbackFormData;
  onSuccess?: () => void;
  backHref?: string;
  backLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export default function FeedbackForm({ form, onSuccess, backHref, backLabel, secondaryHref, secondaryLabel }: Props): React.ReactElement {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const sections = Array.from(new Set(form.questions.map((q) => q.section))).sort((a, b) => a - b);

  function handleRadio(questionId: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleTextarea(questionId: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    const requiredMissing = form.questions.filter((q) => q.required && !answers[q.id]);
    if (requiredMissing.length > 0) {
      setError('Please answer all required questions before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ formSlug: form.slug, answers }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        onSuccess?.();
      } else {
        setError(data.error || 'Failed to submit. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="feedback-success">
        <div className="feedback-success__rings">
          <div className="feedback-success__ring feedback-success__ring--outer" />
          <div className="feedback-success__ring feedback-success__ring--mid" />
          <div className="feedback-success__icon">
            <CheckCircle size={24} strokeWidth={2.5} />
          </div>
        </div>
        <div className="feedback-success__eyebrow">Thank you</div>
        <div className="feedback-success__title">Insights received!</div>
        <p className="feedback-success__message">
          We are using your feedback to shape how Bride Write evolves.
          Every response is read carefully — it means a lot to us.
        </p>
        {(backHref || secondaryHref) && (
          <div className="feedback-success__cta">
            {backHref && (
              <Link href={backHref} className="feedback-success__back">
                {backLabel || 'Go back'}
                <ArrowRight size={15} />
              </Link>
            )}
            {secondaryHref && (
              <Link href={secondaryHref} className="feedback-success__secondary">
                {secondaryLabel || 'View more'}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="feedback-form" onSubmit={handleSubmit} noValidate>
      {sections.map((sectionNum) => {
        const sectionQuestions = form.questions.filter((q) => q.section === sectionNum);
        const label = SECTION_LABELS[sectionNum] ?? { title: `Section ${sectionNum}`, required: false };

        return (
          <div key={sectionNum} className="feedback-section">
            <div className="feedback-section__title">
              {label.title}
              <span className={`feedback-section__badge feedback-section__badge--${label.required ? 'required' : 'optional'}`}>
                {label.required ? 'Required' : 'Optional'}
              </span>
            </div>
            <div className="feedback-section__questions">
              {sectionQuestions.map((q) => (
                <div key={q.id} className="feedback-question">
                  <div className="feedback-question__label">{q.question}</div>

                  {q.type === 'radio' && q.options && (
                    <div className="feedback-question__options">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt.value;
                        return (
                          <div
                            key={opt.value}
                            className={`feedback-radio${selected ? ' feedback-radio--selected' : ''}`}
                            onClick={() => handleRadio(q.id, opt.value)}
                            role="radio"
                            aria-checked={selected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRadio(q.id, opt.value);
                              }
                            }}
                          >
                            <div className="feedback-radio__dot" />
                            <div className="feedback-radio__content">
                              <div className="feedback-radio__label">{opt.label}</div>
                              {opt.description && (
                                <div className="feedback-radio__description">{opt.description}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'textarea' && (
                    <textarea
                      className="feedback-textarea"
                      value={answers[q.id] || ''}
                      onChange={(e) => handleTextarea(q.id, e.target.value)}
                      placeholder="Your thoughts…"
                      rows={4}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {error && <div className="feedback-error">{error}</div>}

      <div className="feedback-submit">
        <button type="submit" className="feedback-submit__btn" disabled={submitting}>
          {submitting ? (
            <><Loader2 size={15} className="spin" /> Sending…</>
          ) : (
            'Send to Product Team'
          )}
        </button>
      </div>
    </form>
  );
}
