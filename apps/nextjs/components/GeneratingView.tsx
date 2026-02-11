'use client';

import { useState, useMemo } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { Check, Loader2, Circle, AlertCircle, ChevronDown, Eye } from 'lucide-react';
import Markdown from 'react-markdown';

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'blog-writer': 'Drafting the blog post with dress details',
  'blog-editor': 'Polishing grammar, flow, and tone',
  'seo-specialist': 'Optimizing for search engines',
  'senior-editor': 'Final editorial review',
  'blog-reviewer': 'Quality assessment and scoring',
};

export default function GeneratingView(): React.ReactElement {
  const generationAgent = useWizardStore((s) => s.generationAgent);
  const generationAgentLabel = useWizardStore((s) => s.generationAgentLabel);
  const generationStep = useWizardStore((s) => s.generationStep);
  const generationTotalSteps = useWizardStore((s) => s.generationTotalSteps);
  const generationChunks = useWizardStore((s) => s.generationChunks);
  const generationError = useWizardStore((s) => s.generationError);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const agentOutputs = useWizardStore((s) => s.agentOutputs);

  const [previewOpen, setPreviewOpen] = useState(false);

  // When chunks are empty between agents, show the last completed agent's output
  const previewText = useMemo(() => {
    if (generationChunks) return generationChunks;
    // Find the most recent completed agent output as fallback
    const completedAgents = generationPipeline.filter((a) => agentOutputs[a.id]);
    if (completedAgents.length > 0) {
      return agentOutputs[completedAgents[completedAgents.length - 1].id];
    }
    return '';
  }, [generationChunks, generationPipeline, agentOutputs]);

  function getStepStatus(agentId: string): 'pending' | 'active' | 'complete' {
    const agentIdx = generationPipeline.findIndex((a) => a.id === agentId);
    const currentIdx = generationPipeline.findIndex((a) => a.id === generationAgent);

    if (agentIdx < currentIdx) return 'complete';
    if (agentIdx === currentIdx) return 'active';
    return 'pending';
  }

  return (
    <div className="page-shell">
      <div className="paper">
        <div className="generating">
          <h1 className="generating__title">Writing Your Blog Post</h1>
          <p className="generating__subtitle">
            {generationError
              ? 'An error occurred during generation'
              : generationAgent
                ? `Step ${generationStep} of ${generationTotalSteps}`
                : 'Starting pipeline...'}
          </p>

          {/* Pipeline Steps */}
          <div className="generating__pipeline">
            {generationPipeline.map((agent, idx) => {
              const status = generationError
                ? (getStepStatus(agent.id) === 'complete' ? 'complete' : 'pending')
                : getStepStatus(agent.id);
              const isActive = status === 'active' && !generationError;

              return (
                <div key={agent.id}>
                  <div
                    className={`generating__step generating__step--${status}`}
                    style={{ '--step-index': idx } as React.CSSProperties}
                  >
                    <div className="generating__step-icon">
                      {status === 'complete' ? (
                        <span className="generating__check-icon">
                          <Check size={14} />
                        </span>
                      ) : isActive ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </div>
                    <div className="generating__step-info">
                      <span className="generating__step-label">{agent.label}</span>
                      <span className="generating__step-desc">
                        {AGENT_DESCRIPTIONS[agent.id] || ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Message */}
          {generationError && (
            <div className="generating__error">
              <AlertCircle size={16} />
              <span>{generationError}</span>
            </div>
          )}

          {/* Collapsible Streaming Preview */}
          {previewText && !generationError && (
            <div className={`generating__preview ${previewOpen ? 'generating__preview--open' : ''}`}>
              <button
                type="button"
                className="generating__preview-header"
                onClick={() => setPreviewOpen(!previewOpen)}
              >
                <div className="generating__preview-header-left">
                  <Loader2 size={14} className="spin" />
                  <span>{generationAgentLabel || 'Agent'} is writing...</span>
                </div>
                <div className="generating__preview-header-right">
                  <Eye size={14} />
                  <span>{previewOpen ? 'Hide' : 'Preview'}</span>
                  <ChevronDown
                    size={14}
                    className={`generating__preview-chevron ${previewOpen ? 'generating__preview-chevron--open' : ''}`}
                  />
                </div>
              </button>
              {previewOpen && (
                <div className="generating__preview-content">
                  <Markdown>{previewText.slice(-2000)}</Markdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
