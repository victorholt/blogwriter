'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, MessageSquare } from 'lucide-react';
import FeedbackForm, { type FeedbackFormData } from '@/components/FeedbackForm';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function FeedbackPage(): React.ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [form, setForm] = useState<FeedbackFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/feedback/active`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setForm(data.data);
        } else {
          setUnavailable(true);
        }
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="feedback-loading">
        <Loader2 size={18} className="spin" />
        Loading…
      </div>
    );
  }

  if (unavailable || !form) {
    return (
      <div className="feedback-unavailable">
        <div className="feedback-unavailable__icon">
          <MessageSquare size={30} />
        </div>
        <h1 className="feedback-unavailable__title">Feedback Unavailable</h1>
        <p className="feedback-unavailable__message">
          We&rsquo;re not collecting feedback right now. Check back soon&mdash;we&rsquo;d love to hear from you.
        </p>
        <Link href="/new" className="feedback-unavailable__cta">Start a New Blog</Link>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      {!submitted && (
        <div className="feedback-page__header">
          <h1 className="feedback-page__title">Help us Shape the Future of Bride Write</h1>
          <p className="feedback-page__intro">
            We are in the early stages of building something special for boutique bridal stores.
            Your experience and perspective are genuinely valuable — this is not a checkbox survey.
            It is a conversation, and we read every single response.
          </p>
        </div>
      )}
      <FeedbackForm
        form={form}
        onSuccess={() => setSubmitted(true)}
        backHref="/new"
        backLabel="Start a New Blog"
        secondaryHref={isAuthenticated ? '/my/blogs' : undefined}
        secondaryLabel={isAuthenticated ? 'View my blogs' : undefined}
      />
    </div>
  );
}
