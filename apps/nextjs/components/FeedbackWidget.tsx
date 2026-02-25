'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import FeedbackForm, { type FeedbackFormData } from './FeedbackForm';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const STORAGE_KEY = 'feedback_submitted';

export default function FeedbackWidget(): React.ReactElement | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FeedbackFormData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    // Don't show the widget in admin settings
    if (pathname.startsWith('/settings')) return;
    // Don't show the widget to logged-in users who have already submitted
    if (isAuthenticated && localStorage.getItem(STORAGE_KEY) === 'true') return;

    fetch(`${API_BASE}/api/feedback/active?context=widget`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setForm(data.data);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, isLoading, pathname]);

  // Prevent body scroll when panel open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleSuccess(): void {
    if (isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, 'true');
      // Show success state briefly then hide the widget
      setTimeout(() => {
        setOpen(false);
        setVisible(false);
      }, 3000);
    }
  }

  if (!visible || !form || pathname.startsWith('/settings')) return null;

  return (
    <>
      <div className="feedback-widget">
        <button className="feedback-widget__trigger" onClick={() => setOpen(true)}>
          <MessageSquare size={15} />
          Feedback
        </button>
      </div>

      {open && (
        <>
          <div className="feedback-panel__backdrop" onClick={() => setOpen(false)} />
          <div className="feedback-panel__drawer" role="dialog" aria-label="Feedback panel" aria-modal="true">
            <div className="feedback-panel__header">
              <div className="feedback-panel__title">Help us Shape the Future of Bride Write</div>
              <button className="feedback-panel__close" onClick={() => setOpen(false)} aria-label="Close feedback panel">
                <X size={18} />
              </button>
            </div>
            <div className="feedback-panel__body">
              <FeedbackForm form={form} onSuccess={handleSuccess} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
