'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchBrandVoiceTrace } from '@/lib/api';
import {
  ChevronDown,
  Loader2,
  Wrench,
  FileText,
  MessageSquare,
  AlertCircle,
  PenLine,
  Sparkles,
  Search,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DebugEvent, AgentLogEntry } from '@/types';

// -- Agent metadata for human-readable cards --

interface AgentMeta {
  icon: LucideIcon;
  role: string;
  description: string;
  accentColor: string;
}

const AGENT_META: Record<string, AgentMeta> = {
  'blog-writer': {
    icon: PenLine,
    role: 'Initial Draft',
    description: 'Generated the first draft from your selected dresses and instructions.',
    accentColor: 'var(--color-blue, #3b82f6)',
  },
  'blog-editor': {
    icon: Sparkles,
    role: 'Content Editor',
    description: 'Refined grammar, flow, and readability while preserving brand voice.',
    accentColor: 'var(--color-purple, #8b5cf6)',
  },
  'seo-specialist': {
    icon: Search,
    role: 'SEO Optimization',
    description: 'Optimized headers, keyword placement, and generated SEO metadata.',
    accentColor: 'var(--color-yellow, #f59e0b)',
  },
  'senior-editor': {
    icon: ShieldCheck,
    role: 'Final Polish',
    description: 'Final editorial review for consistency and professional quality.',
    accentColor: 'var(--color-green, #10b981)',
  },
  'blog-reviewer': {
    icon: ClipboardCheck,
    role: 'Quality Review',
    description: 'Scored overall quality and identified strengths and suggestions.',
    accentColor: 'var(--color-pink, #ec4899)',
  },
};

const DEFAULT_META: AgentMeta = {
  icon: FileText,
  role: 'Agent',
  description: 'Processed the blog content.',
  accentColor: 'var(--color-gray-400)',
};

// -- Props --

interface AgentInsightProps {
  traceId: string | null;
  agentId?: string;
  agentLabel: string;
  inline?: DebugEvent[];
  live?: boolean;
}

export default function AgentInsight({ traceId, agentId, agentLabel, inline, live }: AgentInsightProps): React.ReactElement | null {
  const debugMode = useWizardStore((s) => s.debugMode);
  const agentOutputs = useWizardStore((s) => s.agentOutputs);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const [expanded, setExpanded] = useState(false);
  const [traceData, setTraceData] = useState<AgentLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRawTrace, setShowRawTrace] = useState(false);

  const hasInline = inline && inline.length > 0;
  const hasTrace = traceId != null;

  if (!debugMode) return null;
  if (!hasInline && !hasTrace) return null;

  // Use inline path for brand voice (unchanged)
  if (hasInline) {
    return <InlineInsight agentLabel={agentLabel} inline={inline} live={live} />;
  }

  // -- Compute stats from store data (no API call needed) --
  const meta = (agentId && AGENT_META[agentId]) || DEFAULT_META;
  const Icon = meta.icon;

  // Find this agent's position in the pipeline to get the previous agent's output
  const pipelineIndex = agentId ? generationPipeline.findIndex((a) => a.id === agentId) : -1;
  const prevAgentId = pipelineIndex > 0 ? generationPipeline[pipelineIndex - 1].id : null;

  const outputText = agentId ? agentOutputs[agentId] : null;
  const inputText = prevAgentId ? agentOutputs[prevAgentId] : null;

  const outputChars = outputText?.length ?? 0;
  const inputChars = inputText?.length ?? 0;
  const isFirstAgent = pipelineIndex === 0;
  const charDelta = !isFirstAgent && inputChars > 0 ? outputChars - inputChars : null;
  const charDeltaPct = charDelta !== null && inputChars > 0
    ? Math.round((charDelta / inputChars) * 100)
    : null;

  async function handleToggle() {
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand && traceId && !traceData) {
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

  function formatChars(n: number): string {
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  return (
    <div className={`agent-insight ${expanded ? 'agent-insight--open' : ''}`}>
      <button className="agent-insight__header" onClick={handleToggle}>
        <span className="agent-insight__icon" style={{ color: meta.accentColor }}>
          {live ? <Loader2 size={16} className="spin" /> : <Icon size={16} />}
        </span>
        <span className="agent-insight__title">
          <span className="agent-insight__name">{agentLabel}</span>
          <span className="agent-insight__role">{meta.role}</span>
        </span>
        <span className="agent-insight__pills">
          {outputChars > 0 && (
            <span className="agent-insight__pill">{formatChars(outputChars)} chars</span>
          )}
          {charDelta !== null && (
            <span className={`agent-insight__pill agent-insight__pill--${charDelta >= 0 ? 'positive' : 'negative'}`}>
              {charDelta >= 0 ? '+' : ''}{formatChars(charDelta)}{charDeltaPct !== null ? ` (${charDeltaPct >= 0 ? '+' : ''}${charDeltaPct}%)` : ''}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`agent-insight__chevron ${expanded ? 'agent-insight__chevron--open' : ''}`}
        />
      </button>

      {expanded && (
        <div className="agent-insight__body">
          <p className="agent-insight__description">{meta.description}</p>

          {/* Stats grid */}
          {outputChars > 0 && (
            <div className="agent-insight__stats">
              {!isFirstAgent && inputChars > 0 && (
                <div className="agent-insight__stat">
                  <span className="agent-insight__stat-label">Input</span>
                  <span className="agent-insight__stat-value">{inputChars.toLocaleString()} chars</span>
                </div>
              )}
              <div className="agent-insight__stat">
                <span className="agent-insight__stat-label">Output</span>
                <span className="agent-insight__stat-value">{outputChars.toLocaleString()} chars</span>
              </div>
              {charDelta !== null && (
                <div className="agent-insight__stat">
                  <span className="agent-insight__stat-label">Change</span>
                  <span className={`agent-insight__stat-value agent-insight__stat-value--${charDelta >= 0 ? 'positive' : 'negative'}`}>
                    {charDelta >= 0 ? '+' : ''}{charDelta.toLocaleString()} ({charDeltaPct}%)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Raw trace data toggle */}
          {hasTrace && (
            <div className="agent-insight__trace-section">
              <button
                className="agent-insight__trace-toggle"
                onClick={() => setShowRawTrace(!showRawTrace)}
              >
                {showRawTrace ? 'Hide raw trace data' : 'Show raw trace data'}
              </button>

              {showRawTrace && (
                <div className="agent-insight__trace-content">
                  {loading && (
                    <div className="agent-insight__loading">
                      <Loader2 size={14} className="spin" />
                      <span>Loading trace data...</span>
                    </div>
                  )}
                  {traceData && traceData.map((entry) => (
                    <TraceEventCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Inline Insight (brand voice step — kept as-is) --

function InlineInsight({ agentLabel, inline, live }: { agentLabel: string; inline: DebugEvent[]; live?: boolean }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const eventCount = inline.length;

  return (
    <div className="agent-insight">
      <button className="agent-insight__header" onClick={() => setExpanded(!expanded)}>
        <span className="agent-insight__icon">
          {live ? <Loader2 size={16} className="spin" /> : <ChevronDown size={16} />}
        </span>
        <span className="agent-insight__title">
          <span className="agent-insight__name">{agentLabel}</span>
        </span>
        <span className="agent-insight__pills">
          <span className="agent-insight__pill">{eventCount} events</span>
        </span>
        <ChevronDown
          size={16}
          className={`agent-insight__chevron ${expanded ? 'agent-insight__chevron--open' : ''}`}
        />
      </button>

      {expanded && (
        <div className="agent-insight__body">
          {inline.map((event, i) => (
            <InlineEventCard key={i} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

// -- InlineEventCard (brand voice events — unchanged) --

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
        <span className="agent-insight__stat-text">{event.contentLength} chars total</span>
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

// -- TraceEventCard (raw trace view — kept for power users) --

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
