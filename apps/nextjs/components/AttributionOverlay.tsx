'use client';

import { useMemo, useState, useRef } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { buildAttribution, AGENT_COLORS } from '@/lib/diff-utils';
import type { AttributionSegment } from '@/lib/diff-utils';

const AGENT_ORDER = ['blog-writer', 'blog-editor', 'seo-specialist', 'senior-editor', 'blog-reviewer'];

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  segment: AttributionSegment | null;
}

export default function AttributionOverlay(): React.ReactElement | null {
  const agentOutputs = useWizardStore((s) => s.agentOutputs);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const generatedBlog = useWizardStore((s) => s.generatedBlog);
  const debugMode = useWizardStore((s) => s.debugMode);

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

  if (!debugMode || agentIds.length < 2 || !generatedBlog || segments.length === 0) return null;

  const agentLabel = (id: string) => {
    const found = generationPipeline.find((a) => a.id === id);
    return found?.label || AGENT_COLORS[id]?.label || id;
  };

  function handleMouseEnter(e: React.MouseEvent, seg: AttributionSegment) {
    if (!seg.previousText) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      segment: seg,
    });
  }

  function handleMouseLeave() {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }

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

      {/* Attributed text */}
      <div className="attribution__text">
        {segments.map((seg, i) => {
          const color = AGENT_COLORS[seg.agent] || AGENT_COLORS['blog-writer'];
          const isModified = !!seg.previousText;
          return (
            <span
              key={i}
              className={`attribution__segment ${isModified ? 'attribution__segment--modified' : ''}`}
              style={{
                background: color.bg,
                borderBottom: `2px solid ${color.border}`,
              }}
              onMouseEnter={(e) => handleMouseEnter(e, seg)}
              onMouseLeave={handleMouseLeave}
            >
              {seg.text}
            </span>
          );
        })}
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
