'use client';

import { useWizardStore } from '@/stores/wizard-store';
import { Check, Loader2, Circle, AlertCircle } from 'lucide-react';
import AgentInsight from '@/components/AgentInsight';

const PIPELINE_AGENTS = [
  { id: 'blog-writer', label: 'Blog Writer', description: 'Drafting the blog post with dress details' },
  { id: 'blog-editor', label: 'Blog Editor', description: 'Polishing grammar, flow, and tone' },
  { id: 'seo-specialist', label: 'SEO Specialist', description: 'Optimizing for search engines' },
  { id: 'senior-editor', label: 'Senior Editor', description: 'Final editorial review' },
  { id: 'blog-reviewer', label: 'Blog Reviewer', description: 'Quality assessment and scoring' },
];

function getStepStatus(agentId: string, currentAgent: string, currentStep: number): 'pending' | 'active' | 'complete' {
  const agentIndex = PIPELINE_AGENTS.findIndex((a) => a.id === agentId);
  const currentIndex = PIPELINE_AGENTS.findIndex((a) => a.id === currentAgent);

  if (agentIndex < currentIndex) return 'complete';
  if (agentIndex === currentIndex && currentStep > 0) return 'active';
  if (currentStep > agentIndex + 1) return 'complete';
  return 'pending';
}

export default function GeneratingView(): React.ReactElement {
  const generationAgent = useWizardStore((s) => s.generationAgent);
  const generationAgentLabel = useWizardStore((s) => s.generationAgentLabel);
  const generationStep = useWizardStore((s) => s.generationStep);
  const generationTotalSteps = useWizardStore((s) => s.generationTotalSteps);
  const generationChunks = useWizardStore((s) => s.generationChunks);
  const generationError = useWizardStore((s) => s.generationError);
  const blogTraceIds = useWizardStore((s) => s.blogTraceIds);

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
            {PIPELINE_AGENTS.map((agent, idx) => {
              const status = generationError
                ? (getStepStatus(agent.id, generationAgent, generationStep) === 'complete' ? 'complete' : 'pending')
                : getStepStatus(agent.id, generationAgent, generationStep);
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
                      <span className="generating__step-desc">{agent.description}</span>
                    </div>
                  </div>
                  {status === 'complete' && blogTraceIds[agent.id] && (
                    <AgentInsight
                      traceId={blogTraceIds[agent.id]}
                      agentLabel={agent.label}
                    />
                  )}
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

          {/* Streaming Preview */}
          {generationChunks && !generationError && (
            <div className="generating__preview">
              <div className="generating__preview-header">
                <Loader2 size={14} className="spin" />
                <span>{generationAgentLabel || 'Agent'} is writing...</span>
              </div>
              <div className="generating__preview-text">
                {generationChunks.slice(-800)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
