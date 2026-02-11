'use client';

import { useState, useRef, useEffect } from 'react';
import { GitCompareArrows, ChevronDown, Check } from 'lucide-react';
import { AGENT_COLORS } from '@/lib/diff-utils';

export type CompareMode =
  | { type: 'none' }
  | { type: 'attribution' }
  | { type: 'diff'; left: string; right: string };

interface CompareDropdownProps {
  value: CompareMode;
  onChange: (mode: CompareMode) => void;
  /** Ordered list of agent IDs that have outputs */
  agents: { id: string; label: string }[];
}

export default function CompareDropdown({
  value,
  onChange,
  agents,
}: CompareDropdownProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Build comparison pairs from adjacent agents
  const pairs: { left: string; right: string; label: string }[] = [];
  for (let i = 0; i < agents.length - 1; i++) {
    const leftLabel = AGENT_COLORS[agents[i].id]?.label || agents[i].label;
    const rightLabel = AGENT_COLORS[agents[i + 1].id]?.label || agents[i + 1].label;
    pairs.push({
      left: agents[i].id,
      right: agents[i + 1].id,
      label: `${leftLabel} vs ${rightLabel}`,
    });
  }

  // Display label
  function getDisplayLabel(): string {
    if (value.type === 'attribution') return 'Attribution';
    if (value.type === 'diff') {
      const leftLabel = AGENT_COLORS[value.left]?.label || value.left;
      const rightLabel = AGENT_COLORS[value.right]?.label || value.right;
      return `${leftLabel} vs ${rightLabel}`;
    }
    return 'Compare';
  }

  const isActive = value.type !== 'none';

  function select(mode: CompareMode): void {
    onChange(mode);
    setOpen(false);
  }

  function isSelected(mode: CompareMode): boolean {
    if (value.type !== mode.type) return false;
    if (mode.type === 'diff' && value.type === 'diff') {
      return mode.left === value.left && mode.right === value.right;
    }
    return true;
  }

  return (
    <div className="compare-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`result__action-btn ${isActive ? 'result__action-btn--active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <GitCompareArrows size={14} />
        <span>{getDisplayLabel()}</span>
        <ChevronDown
          size={12}
          className={`compare-dropdown__chevron ${open ? 'compare-dropdown__chevron--open' : ''}`}
        />
      </button>

      {open && (
        <div className="compare-dropdown__menu">
          {/* None */}
          <button
            type="button"
            className={`compare-dropdown__item ${isSelected({ type: 'none' }) ? 'compare-dropdown__item--selected' : ''}`}
            onClick={() => select({ type: 'none' })}
          >
            <span>None</span>
            {isSelected({ type: 'none' }) && <Check size={14} />}
          </button>

          {/* Attribution */}
          <button
            type="button"
            className={`compare-dropdown__item ${isSelected({ type: 'attribution' }) ? 'compare-dropdown__item--selected' : ''}`}
            onClick={() => select({ type: 'attribution' })}
          >
            <span>Show Attribution</span>
            {isSelected({ type: 'attribution' }) && <Check size={14} />}
          </button>

          {/* Divider + Comparison pairs */}
          {pairs.length > 0 && (
            <>
              <div className="compare-dropdown__divider" />
              <div className="compare-dropdown__section-label">Compare Agents</div>
              {pairs.map((pair) => {
                const mode: CompareMode = { type: 'diff', left: pair.left, right: pair.right };
                return (
                  <button
                    key={`${pair.left}-${pair.right}`}
                    type="button"
                    className={`compare-dropdown__item ${isSelected(mode) ? 'compare-dropdown__item--selected' : ''}`}
                    onClick={() => select(mode)}
                  >
                    <span className="compare-dropdown__pair-label">
                      <span
                        className="compare-dropdown__dot"
                        style={{ background: AGENT_COLORS[pair.left]?.border || '#999' }}
                      />
                      <span
                        className="compare-dropdown__dot"
                        style={{ background: AGENT_COLORS[pair.right]?.border || '#999' }}
                      />
                      {pair.label}
                    </span>
                    {isSelected(mode) && <Check size={14} />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
