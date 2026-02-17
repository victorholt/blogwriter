'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { buildAttribution, buildAnnotatedAttributionMarkdown, AGENT_COLORS } from '@/lib/diff-utils';
import type { AttributionSegment } from '@/lib/diff-utils';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const AGENT_ORDER = ['blog-writer', 'blog-editor', 'seo-specialist', 'senior-editor', 'blog-reviewer'];

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  segment: AttributionSegment | null;
}

interface AttributionOverlayProps {
  /** Override store values — used on the blog detail page */
  overrideOutputs?: Record<string, string>;
  overridePipeline?: { id: string; label: string }[];
  overrideBlog?: string;
}

export default function AttributionOverlay({ overrideOutputs, overridePipeline, overrideBlog }: AttributionOverlayProps = {}): React.ReactElement | null {
  const storeOutputs = useWizardStore((s) => s.agentOutputs);
  const storePipeline = useWizardStore((s) => s.generationPipeline);
  const storeBlog = useWizardStore((s) => s.generatedBlog);
  const storeDebugMode = useWizardStore((s) => s.debugMode);

  const agentOutputs = overrideOutputs ?? storeOutputs;
  const generationPipeline = overridePipeline ?? storePipeline;
  const generatedBlog = overrideBlog ?? storeBlog;
  const debugMode = overrideOutputs ? true : storeDebugMode;

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    segment: null,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const agentIds = Object.keys(agentOutputs);

  // Build ordered agent outputs with stable memoization
  // Use pipeline order if available, fall back to known agent order
  const orderedOutputs = useMemo(() => {
    const ordered: [string, string][] = [];
    if (generationPipeline.length > 0) {
      for (const a of generationPipeline) {
        if (agentOutputs[a.id]) {
          ordered.push([a.id, agentOutputs[a.id]]);
        }
      }
    } else {
      for (const id of AGENT_ORDER) {
        if (agentOutputs[id]) {
          ordered.push([id, agentOutputs[id]]);
        }
      }
    }
    return ordered;
  }, [agentOutputs, generationPipeline]);

  // Compute attribution
  const segments = useMemo(() => buildAttribution(orderedOutputs), [orderedOutputs]);

  // Find which agents actually contributed
  const activeAgents = useMemo(() => {
    const agents = new Set<string>();
    for (const seg of segments) agents.add(seg.agent);
    return Array.from(agents);
  }, [segments]);

  // Build rich markdown with attribution spans
  const annotatedMarkdown = useMemo(
    () => buildAnnotatedAttributionMarkdown(segments),
    [segments],
  );

  const agentLabel = useCallback((id: string) => {
    const found = generationPipeline.find((a) => a.id === id);
    return found?.label || AGENT_COLORS[id]?.label || id;
  }, [generationPipeline]);

  // Event delegation for tooltips on raw HTML spans
  function handleMouseOver(e: React.MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-seg-idx]') as HTMLElement | null;
    if (!target) {
      setTooltip((prev) => ({ ...prev, visible: false }));
      return;
    }
    const idx = parseInt(target.dataset.segIdx || '', 10);
    if (isNaN(idx) || !segments[idx]?.previousText) {
      setTooltip((prev) => ({ ...prev, visible: false }));
      return;
    }
    const rect = target.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      segment: segments[idx],
    });
  }

  function handleMouseLeave() {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

  if (!debugMode || agentIds.length < 2 || !generatedBlog || segments.length === 0) return null;

  return (
    <div className="attribution">
      {/* Legend */}
      <div className="attribution__legend">
        {activeAgents.map((id) => {
          const color = AGENT_COLORS[id] || AGENT_COLORS['blog-writer'];
          return (
            <span key={id} className="attribution__legend-item">
              <span
                className="attribution__legend-dot"
                style={{ background: color.border }}
              />
              {agentLabel(id)}
            </span>
          );
        })}
      </div>

      {/* Attributed text — rendered as rich blog preview */}
      <div
        className="attribution__text result__content"
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        <Markdown rehypePlugins={[rehypeRaw]}>
          {annotatedMarkdown}
        </Markdown>
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.segment && (
        <div
          ref={tooltipRef}
          className="attribution__tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="attribution__tooltip-header">
            Modified by {agentLabel(tooltip.segment.agent)}
          </div>
          {tooltip.segment.previousAgent && (
            <div className="attribution__tooltip-prev-label">
              Previously ({agentLabel(tooltip.segment.previousAgent)}):
            </div>
          )}
          <div className="attribution__tooltip-prev-text">
            {tooltip.segment.previousText}
          </div>
        </div>
      )}
    </div>
  );
}
