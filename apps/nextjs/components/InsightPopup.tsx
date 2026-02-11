'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Globe, FileText, Sparkles } from 'lucide-react';
import type { DebugEvent } from '@/types';

interface InsightPopupProps {
  event: DebugEvent;
}

function formatToolCall(event: DebugEvent & { kind: 'tool-call' }): { icon: typeof Globe; title: string; body: React.ReactNode } {
  const url = event.args?.url as string | undefined;
  let hostname = '';
  try {
    hostname = url ? new URL(url).hostname : '';
  } catch { /* ignore */ }

  return {
    icon: Globe,
    title: 'Visiting Page',
    body: (
      <div className="insight-popup__body">
        <p>Navigated to <strong>{hostname || 'a page'}</strong> to gather brand information.</p>
        {url && <p className="insight-popup__detail">{url}</p>}
      </div>
    ),
  };
}

function formatToolResult(event: DebugEvent & { kind: 'tool-result' }): { icon: typeof FileText; title: string; body: React.ReactNode } {
  const hasContent = event.contentLength > 0;
  const hasError = !!event.error;
  let hostname = '';
  try {
    hostname = event.url ? new URL(event.url).hostname : '';
  } catch { /* ignore */ }

  // Use page title if available, otherwise show the hostname
  const title = event.title || (hostname ? `Visited ${hostname}` : 'Page Visited');

  return {
    icon: FileText,
    title,
    body: (
      <div className="insight-popup__body">
        {event.metaDescription && (
          <p className="insight-popup__meta">{event.metaDescription}</p>
        )}
        {hasError ? (
          <>
            <p>Could not read this page: <strong>{event.error}</strong></p>
            {event.url && <p className="insight-popup__detail">{event.url}</p>}
          </>
        ) : hasContent ? (
          <p>Extracted <strong>{event.contentLength.toLocaleString()} characters</strong> of content from this page.</p>
        ) : (
          <p>Page metadata was captured. Body content was not available (the site may use dynamic rendering).</p>
        )}
        {event.contentPreview && (
          <div className="insight-popup__preview">
            <span className="insight-popup__preview-label">Content preview</span>
            <p>{event.contentPreview.slice(0, 300)}{event.contentPreview.length > 300 ? '...' : ''}</p>
          </div>
        )}
      </div>
    ),
  };
}

function formatRawResponse(event: DebugEvent & { kind: 'raw-response' }): { icon: typeof Sparkles; title: string; body: React.ReactNode } {
  // Try to parse the brand voice JSON from the raw response
  let parsed: Record<string, unknown> | null = null;
  try {
    const text = event.text.trim();
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      parsed = JSON.parse(text.slice(braceStart, braceEnd + 1));
    }
  } catch { /* ignore */ }

  if (parsed && parsed.brandName) {
    const tone = Array.isArray(parsed.tone) ? (parsed.tone as string[]).join(', ') : '';
    const usps = Array.isArray(parsed.uniqueSellingPoints) ? parsed.uniqueSellingPoints as string[] : [];

    return {
      icon: Sparkles,
      title: 'Brand Analysis Complete',
      body: (
        <div className="insight-popup__body">
          <div className="insight-popup__field">
            <span className="insight-popup__field-label">Brand</span>
            <span>{parsed.brandName as string}</span>
          </div>
          {tone && (
            <div className="insight-popup__field">
              <span className="insight-popup__field-label">Tone</span>
              <span>{tone}</span>
            </div>
          )}
          {parsed.targetAudience && (
            <div className="insight-popup__field">
              <span className="insight-popup__field-label">Audience</span>
              <span>{parsed.targetAudience as string}</span>
            </div>
          )}
          {parsed.priceRange && (
            <div className="insight-popup__field">
              <span className="insight-popup__field-label">Price Range</span>
              <span className="insight-popup__capitalize">{parsed.priceRange as string}</span>
            </div>
          )}
          {usps.length > 0 && (
            <div className="insight-popup__field insight-popup__field--block">
              <span className="insight-popup__field-label">Key Differentiators</span>
              <ul className="insight-popup__list">
                {usps.map((usp, i) => <li key={i}>{usp}</li>)}
              </ul>
            </div>
          )}
          {parsed.summary && (
            <div className="insight-popup__field insight-popup__field--block">
              <span className="insight-popup__field-label">Summary</span>
              <p>{parsed.summary as string}</p>
            </div>
          )}
        </div>
      ),
    };
  }

  return {
    icon: Sparkles,
    title: 'AI Analysis',
    body: (
      <div className="insight-popup__body">
        <p>Generated a {event.charCount.toLocaleString()}-character brand analysis.</p>
      </div>
    ),
  };
}

function getInsightContent(event: DebugEvent): { icon: typeof Globe; title: string; body: React.ReactNode } {
  switch (event.kind) {
    case 'tool-call':
      return formatToolCall(event);
    case 'tool-result':
      return formatToolResult(event);
    case 'raw-response':
      return formatRawResponse(event);
    default:
      return { icon: FileText, title: 'Event', body: <p>Processing step completed.</p> };
  }
}

export default function InsightPopup({ event }: InsightPopupProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const { icon: Icon, title, body } = getInsightContent(event);

  return (
    <div className="insight-popup__anchor" ref={popupRef}>
      <button
        type="button"
        className="insight-popup__trigger"
        onClick={() => setOpen(!open)}
        aria-label="View details"
      >
        <MessageCircle size={14} />
      </button>

      {open && (
        <div className="insight-popup__panel">
          <div className="insight-popup__header">
            <Icon size={14} />
            <span className="insight-popup__title">{title}</span>
            <button
              type="button"
              className="insight-popup__close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          {body}
        </div>
      )}
    </div>
  );
}
