'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, ChevronDown, ChevronRight, Send, Loader2, Check, AlertCircle } from 'lucide-react';
import { fetchEmailTemplates, sendTestEmail, type EmailTemplatePreview } from '@/lib/admin-api';
import { useSettings } from './SettingsContext';

export default function EmailTemplatesSection(): React.ReactElement {
  const { allSettings } = useSettings();
  const [templates, setTemplates] = useState<EmailTemplatePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Test email state — per-template, defaults to SMTP from-email
  const defaultEmail = allSettings.smtp_from_email ?? '';
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<Record<string, { status: 'success' | 'error'; message: string }>>({});

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  useEffect(() => {
    fetchEmailTemplates().then((res) => {
      if (res.success && res.data) {
        setTemplates(res.data);
      } else {
        setError(res.error || 'Failed to load templates');
      }
      setLoading(false);
    });
  }, []);

  const resizeIframe = useCallback((id: string) => {
    const iframe = iframeRefs.current[id];
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body) {
        iframe.style.height = Math.max(doc.body.scrollHeight + 16, 200) + 'px';
      }
    } catch {
      // cross-origin — fallback height already set
    }
  }, []);

  function getTestEmail(id: string): string {
    return testEmails[id] ?? defaultEmail;
  }

  async function handleSendTest(id: string): Promise<void> {
    const email = getTestEmail(id);
    if (!email) return;

    setSendingId(id);
    setSendResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const result = await sendTestEmail(id, email);
    if (result.success) {
      setSendResults((prev) => ({ ...prev, [id]: { status: 'success', message: result.data?.message || 'Sent!' } }));
    } else {
      setSendResults((prev) => ({ ...prev, [id]: { status: 'error', message: result.error || 'Send failed' } }));
    }
    setSendingId(null);

    // Clear result after a few seconds
    setTimeout(() => {
      setSendResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 4000);
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <Mail size={18} />
        Email Templates
      </h2>

      {loading ? (
        <div className="email-tpl__loading">
          <Loader2 size={16} className="spin" />
          <span>Loading templates...</span>
        </div>
      ) : error ? (
        <div className="email-tpl__error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      ) : (
        <div className="email-tpl__list">
          {templates.map((tpl) => {
            const isExpanded = expandedId === tpl.id;
            const isSending = sendingId === tpl.id;
            const result = sendResults[tpl.id];

            return (
              <div key={tpl.id} className={`email-tpl__card ${isExpanded ? 'email-tpl__card--expanded' : ''}`}>
                {/* Header — click to expand */}
                <button
                  className="email-tpl__card-header"
                  onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                >
                  <div className="email-tpl__card-info">
                    <span className="email-tpl__name">{tpl.name}</span>
                    <span className="email-tpl__description">{tpl.description}</span>
                    <span className="email-tpl__subject">Subject: {tpl.subject}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Preview + Test */}
                {isExpanded && (
                  <>
                    <div className="email-tpl__preview">
                      <iframe
                        ref={(el) => { iframeRefs.current[tpl.id] = el; }}
                        srcDoc={tpl.html}
                        className="email-tpl__iframe"
                        sandbox="allow-same-origin"
                        title={`${tpl.name} preview`}
                        onLoad={() => resizeIframe(tpl.id)}
                      />
                    </div>

                    <div className="email-tpl__card-footer">
                      <input
                        type="email"
                        className="input email-tpl__test-input"
                        placeholder="recipient@example.com"
                        value={getTestEmail(tpl.id)}
                        onChange={(e) => setTestEmails((prev) => ({ ...prev, [tpl.id]: e.target.value }))}
                      />
                      <button
                        className="btn btn--primary"
                        onClick={() => handleSendTest(tpl.id)}
                        disabled={isSending || !getTestEmail(tpl.id)}
                      >
                        {isSending ? (
                          <Loader2 size={14} className="spin" />
                        ) : result?.status === 'success' ? (
                          <Check size={14} />
                        ) : (
                          <Send size={14} />
                        )}
                        {isSending ? 'Sending...' : 'Send Test'}
                      </button>
                      {result && (
                        <span className={`email-tpl__send-result email-tpl__send-result--${result.status}`}>
                          {result.message}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
