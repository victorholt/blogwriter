'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchBrandVoiceTrace } from '@/lib/api';
import { ChevronDown, ChevronUp, Loader2, Wrench, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import type { DebugEvent, AgentLogEntry } from '@/types';

interface AgentInsightProps {
  traceId: string | null;
  agentLabel: string;
  inline?: DebugEvent[];
  live?: boolean;
}

export default function AgentInsight({ traceId, agentLabel, inline, live }: AgentInsightProps): React.ReactElement | null {
  const debugMode = useWizardStore((s) => s.debugMode);
  const [expanded, setExpanded] = useState(false);
  const [traceData, setTraceData] = useState<AgentLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Determine what data to show
  const hasInline = inline && inline.length > 0;
  const hasTrace = traceId != null;
  const eventCount = hasInline ? inline.length : (traceData?.length ?? 0);

  // Don't render if debug mode is off
  if (!debugMode) return null;

  // Don't render if no data source
  if (!hasInline && !hasTrace) return null;

  async function handleToggle() {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Lazy-load trace data when expanding (only for traceId mode)
    if (willExpand && traceId && !traceData && !hasInline) {
      setLoading(true);
      try {
        const result = await fetchBrandVoiceTrace(traceId);
        if (result.success && result.data) {
          setTraceData(result.data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="agent-insight">
      <button
        className="agent-insight__toggle"
        onClick={handleToggle}
      >
        <span className="agent-insight__icon">
          {live ? <Loader2 size={14} className="spin" /> : (expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </span>
        <span className="agent-insight__label">{agentLabel}</span>
        <span className="agent-insight__count">{eventCount} events</span>
      </button>

      {expanded && (
        <div className="agent-insight__content">
          {loading && (
            <div className="agent-insight__loading">
              <Loader2 size={14} className="spin" />
              <span>Loading trace data...</span>
            </div>
          )}

          {/* Inline debug events (brand voice real-time) */}
          {hasInline && inline.map((event, i) => (
            <InlineEventCard key={i} event={event} />
          ))}

          {/* Trace data from API */}
          {traceData && traceData.map((entry) => (
            <TraceEventCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineEventCard({ event }: { event: DebugEvent }): React.ReactElement {
  const [textExpanded, setTextExpanded] = useState(false);

  if (event.kind === 'tool-call') {
    return (
      <div className="agent-insight__card">
        <div className="agent-insight__card-header">
          <Wrench size={12} />
          <span>Tool Call: {event.toolName}</span>
        </div>
        <pre className="agent-insight__pre">{JSON.stringify(event.args, null, 2)}</pre>
      </div>
    );
  }

  if (event.kind === 'tool-result') {
    return (
      <div className="agent-insight__card">
        <div className="agent-insight__card-header">
          <FileText size={12} />
          <span>Scraped: {event.title}</span>
        </div>
        {event.metaDescription && (
          <p className="agent-insight__meta">{event.metaDescription}</p>
        )}
        <pre className="agent-insight__pre">{event.contentPreview}...</pre>
        <span className="agent-insight__stat">{event.contentLength} chars total</span>
      </div>
    );
  }

  if (event.kind === 'raw-response') {
    const preview = textExpanded ? event.text : event.text.slice(0, 500);
    return (
      <div className="agent-insight__card">
        <div className="agent-insight__card-header">
          <MessageSquare size={12} />
          <span>Raw AI Response ({event.charCount} chars)</span>
        </div>
        <pre className="agent-insight__pre">{preview}{!textExpanded && event.text.length > 500 ? '...' : ''}</pre>
        {event.text.length > 500 && (
          <button
            className="agent-insight__expand-btn"
            onClick={() => setTextExpanded(!textExpanded)}
          >
            {textExpanded ? 'Show less' : 'Show full response'}
          </button>
        )}
      </div>
    );
  }

  return <></>;
}

function TraceEventCard({ entry }: { entry: AgentLogEntry }): React.ReactElement {
  const [textExpanded, setTextExpanded] = useState(false);
  const data = entry.data;

  const icon = {
    'tool-call': <Wrench size={12} />,
    'tool-result': <FileText size={12} />,
    'agent-input': <MessageSquare size={12} />,
    'agent-output': <MessageSquare size={12} />,
    'error': <AlertCircle size={12} />,
  }[entry.eventType] ?? <FileText size={12} />;

  const label = {
    'tool-call': `Tool Call: ${data.toolName || 'unknown'}`,
    'tool-result': `Result: ${data.title || 'unknown'}`,
    'agent-input': 'Agent Input',
    'agent-output': 'Agent Output',
    'error': 'Error',
  }[entry.eventType] ?? entry.eventType;

  const textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = textContent.length > 500;
  const preview = textExpanded ? textContent : textContent.slice(0, 500);

  return (
    <div className={`agent-insight__card ${entry.eventType === 'error' ? 'agent-insight__card--error' : ''}`}>
      <div className="agent-insight__card-header">
        {icon}
        <span>{label}</span>
      </div>
      <pre className="agent-insight__pre">{preview}{!textExpanded && isLong ? '...' : ''}</pre>
      {isLong && (
        <button
          className="agent-insight__expand-btn"
          onClick={() => setTextExpanded(!textExpanded)}
        >
          {textExpanded ? 'Show less' : 'Show full content'}
        </button>
      )}
    </div>
  );
}
