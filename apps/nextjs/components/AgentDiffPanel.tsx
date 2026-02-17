'use client';

import { useState, useMemo } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { computeDiff, buildAnnotatedMarkdown, AGENT_COLORS } from '@/lib/diff-utils';
import { Columns2, Rows3, Equal } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import type { DiffSegment } from '@/lib/diff-utils';

type DiffViewMode = 'inline' | 'side-by-side';

const AGENT_LABELS: Record<string, string> = {
  'blog-writer': 'Blog Writer',
  'blog-editor': 'Blog Editor',
  'seo-specialist': 'SEO Specialist',
  'senior-editor': 'Senior Editor',
  'blog-reviewer': 'Blog Reviewer',
};

interface AgentDiffPanelProps {
  leftAgent: string;
  rightAgent: string;
  /** Override store values — used on the blog detail page */
  overrideOutputs?: Record<string, string>;
  overridePipeline?: { id: string; label: string }[];
}

export default function AgentDiffPanel({ leftAgent, rightAgent, overrideOutputs, overridePipeline }: AgentDiffPanelProps): React.ReactElement {
  const storeOutputs = useWizardStore((s) => s.agentOutputs);
  const storePipeline = useWizardStore((s) => s.generationPipeline);

  const agentOutputs = overrideOutputs ?? storeOutputs;
  const generationPipeline = overridePipeline ?? storePipeline;

  const [viewMode, setViewMode] = useState<DiffViewMode>('inline');

  const leftText = agentOutputs[leftAgent] || '';
  const rightText = agentOutputs[rightAgent] || '';

  const leftLabel = generationPipeline.find((a) => a.id === leftAgent)?.label
    || AGENT_LABELS[leftAgent] || leftAgent;
  const rightLabel = generationPipeline.find((a) => a.id === rightAgent)?.label
    || AGENT_LABELS[rightAgent] || rightAgent;

  if (!leftText || !rightText) {
    return (
      <div className="diff-panel">
        <p className="diff__empty">No output available for one or both agents.</p>
      </div>
    );
  }

  return (
    <div className="diff-panel">
      <div className="diff__controls">
        <div className="diff__selectors">
          <span
            className="diff__agent-tag"
            style={{ borderColor: AGENT_COLORS[leftAgent]?.border || '#999' }}
          >
            {leftLabel}
          </span>
          <span className="diff__vs">vs</span>
          <span
            className="diff__agent-tag"
            style={{ borderColor: AGENT_COLORS[rightAgent]?.border || '#999' }}
          >
            {rightLabel}
          </span>
        </div>

        <div className="diff__view-toggle">
          <button
            className={`diff__view-btn ${viewMode === 'inline' ? 'diff__view-btn--active' : ''}`}
            onClick={() => setViewMode('inline')}
            title="Inline diff"
          >
            <Rows3 size={14} />
          </button>
          <button
            className={`diff__view-btn ${viewMode === 'side-by-side' ? 'diff__view-btn--active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            title="Side-by-side diff"
          >
            <Columns2 size={14} />
          </button>
        </div>
      </div>

      <DiffView
        leftText={leftText}
        rightText={rightText}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        leftAgent={leftAgent}
        rightAgent={rightAgent}
        viewMode={viewMode}
      />
    </div>
  );
}

function DiffView({
  leftText,
  rightText,
  leftLabel,
  rightLabel,
  leftAgent,
  rightAgent,
  viewMode,
}: {
  leftText: string;
  rightText: string;
  leftLabel: string;
  rightLabel: string;
  leftAgent: string;
  rightAgent: string;
  viewMode: DiffViewMode;
}): React.ReactElement {
  const diff = useMemo(() => computeDiff(leftText, rightText), [leftText, rightText]);

  // Compute change summary (must be before early return to satisfy hooks rules)
  const changeStats = useMemo(() => {
    let removed = 0;
    let added = 0;
    for (const seg of diff) {
      if (seg.type === 'removed') removed += seg.text.split(/\s+/).filter(Boolean).length;
      if (seg.type === 'added') added += seg.text.split(/\s+/).filter(Boolean).length;
    }
    return { removed, added };
  }, [diff]);

  // Check if there are any actual changes
  const hasChanges = diff.some((seg) => seg.type !== 'equal');

  if (!hasChanges) {
    return (
      <div className="diff__no-changes">
        <Equal size={16} />
        <span>No changes between {leftLabel} and {rightLabel}</span>
      </div>
    );
  }

  if (viewMode === 'side-by-side') {
    return (
      <SideBySideDiff
        leftText={leftText}
        rightText={rightText}
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        leftAgent={leftAgent}
        rightAgent={rightAgent}
        changeStats={changeStats}
      />
    );
  }

  return (
    <RichDiff
      diff={diff}
      leftLabel={leftLabel}
      rightLabel={rightLabel}
      leftAgent={leftAgent}
      rightAgent={rightAgent}
      changeStats={changeStats}
    />
  );
}

function RichDiff({
  diff,
  leftLabel,
  rightLabel,
  leftAgent,
  rightAgent,
  changeStats,
}: {
  diff: DiffSegment[];
  leftLabel: string;
  rightLabel: string;
  leftAgent: string;
  rightAgent: string;
  changeStats: { removed: number; added: number };
}): React.ReactElement {
  const leftColor = AGENT_COLORS[leftAgent] || AGENT_COLORS['blog-writer'];
  const rightColor = AGENT_COLORS[rightAgent] || AGENT_COLORS['blog-editor'];

  const annotatedMarkdown = useMemo(
    () => buildAnnotatedMarkdown(diff),
    [diff],
  );

  return (
    <div className="diff__inline">
      <div className="diff__legend">
        <span className="diff__legend-item">
          <span className="diff__legend-swatch diff__legend-swatch--removed" style={{ borderColor: leftColor.border }} />
          {leftLabel} ({changeStats.removed} words removed)
        </span>
        <span className="diff__legend-item">
          <span className="diff__legend-swatch diff__legend-swatch--added" style={{ borderColor: rightColor.border }} />
          {rightLabel} ({changeStats.added} words added)
        </span>
      </div>
      <div
        className="diff__content result__content"
        style={{
          '--diff-removed-bg': leftColor.bg,
          '--diff-removed-border': leftColor.border,
          '--diff-added-bg': rightColor.bg,
          '--diff-added-border': rightColor.border,
        } as React.CSSProperties}
      >
        <Markdown rehypePlugins={[rehypeRaw]}>
          {annotatedMarkdown}
        </Markdown>
      </div>
    </div>
  );
}

function SideBySideDiff({
  leftText,
  rightText,
  leftLabel,
  rightLabel,
  leftAgent,
  rightAgent,
  changeStats,
}: {
  leftText: string;
  rightText: string;
  leftLabel: string;
  rightLabel: string;
  leftAgent: string;
  rightAgent: string;
  changeStats: { removed: number; added: number };
}): React.ReactElement {
  const leftColor = AGENT_COLORS[leftAgent] || AGENT_COLORS['blog-writer'];
  const rightColor = AGENT_COLORS[rightAgent] || AGENT_COLORS['blog-editor'];

  return (
    <div className="diff__side-by-side-wrapper">
      <div className="diff__stats">
        <span className="diff__stat diff__stat--removed" style={{ color: leftColor.border }}>
          {changeStats.removed} words removed
        </span>
        <span className="diff__stat diff__stat--added" style={{ color: rightColor.border }}>
          {changeStats.added} words added
        </span>
      </div>
      <div className="diff__side-by-side">
        <div className="diff__side">
          <div className="diff__side-header" style={{ borderColor: leftColor.border }}>
            {leftLabel}
          </div>
          <div className="diff__side-content diff__side-content--rich">
            <Markdown>{leftText}</Markdown>
          </div>
        </div>
        <div className="diff__side">
          <div className="diff__side-header" style={{ borderColor: rightColor.border }}>
            {rightLabel}
          </div>
          <div className="diff__side-content diff__side-content--rich">
            <Markdown>{rightText}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
