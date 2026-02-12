'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { startBlogGeneration } from '@/lib/api';
import { Check, Loader2, Circle, AlertCircle, ChevronDown, RotateCcw, ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';

// Generic step labels — hide agent identities from users
const STEP_LABELS: Record<string, string> = {
  'blog-writer': 'Writing the first draft',
  'blog-editor': 'Polishing and refining',
  'seo-specialist': 'Optimizing for search',
  'senior-editor': 'Final review',
  'blog-reviewer': 'Quality check',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  'blog-writer': 'Drafting your blog post with dress details and brand voice',
  'blog-editor': 'Refining grammar, flow, and tone',
  'seo-specialist': 'Adding keywords and meta descriptions',
  'senior-editor': 'Final editorial polish',
  'blog-reviewer': 'Scoring quality and readability',
};

function getStepLabel(agentId: string, fallbackLabel: string): string {
  return STEP_LABELS[agentId] || fallbackLabel;
}

function getNextLabel(agentId: string, fallbackLabel: string): string {
  return STEP_LABELS[agentId] || fallbackLabel;
}

export default function GeneratingView(): React.ReactElement {
  const generationAgent = useWizardStore((s) => s.generationAgent);
  const generationAgentLabel = useWizardStore((s) => s.generationAgentLabel);
  const generationStep = useWizardStore((s) => s.generationStep);
  const generationTotalSteps = useWizardStore((s) => s.generationTotalSteps);
  const generationChunks = useWizardStore((s) => s.generationChunks);
  const generationError = useWizardStore((s) => s.generationError);
  const generationPipeline = useWizardStore((s) => s.generationPipeline);
  const agentOutputs = useWizardStore((s) => s.agentOutputs);
  const timelineStyle = useWizardStore((s) => s.timelineStyle);
  const resetGenerationForRetry = useWizardStore((s) => s.resetGenerationForRetry);
  const setSessionId = useWizardStore((s) => s.setSessionId);
  const setView = useWizardStore((s) => s.setView);
  const setStep = useWizardStore((s) => s.setStep);
  const setGenerationError = useWizardStore((s) => s.setGenerationError);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // When chunks are empty between agents, show the last completed agent's output
  const previewText = useMemo(() => {
    if (generationChunks) return generationChunks;
    const completedAgents = generationPipeline.filter((a) => agentOutputs[a.id]);
    if (completedAgents.length > 0) {
      return agentOutputs[completedAgents[completedAgents.length - 1].id];
    }
    return '';
  }, [generationChunks, generationPipeline, agentOutputs]);

  // Auto-scroll preview to bottom as new chunks arrive
  useEffect(() => {
    if (previewOpen && previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [previewText, previewOpen]);

  // Derived: next agent for preview-bar mode
  const currentAgentIndex = generationPipeline.findIndex((a) => a.id === generationAgent);
  const nextAgent = currentAgentIndex >= 0 && currentAgentIndex < generationPipeline.length - 1
    ? generationPipeline[currentAgentIndex + 1]
    : null;

  async function handleRetry(): Promise<void> {
    setIsRetrying(true);
    try {
      const { storeUrl, brandVoice, selectedDressIds, additionalInstructions } = useWizardStore.getState();
      if (!brandVoice) return;

      const result = await startBlogGeneration({
        storeUrl,
        brandVoice,
        selectedDressIds: Array.from(selectedDressIds),
        additionalInstructions,
      });

      if (result.success && result.data) {
        resetGenerationForRetry();
        setSessionId(result.data.sessionId);
      } else {
        setGenerationError(result.error || 'Failed to restart generation');
      }
    } catch {
      setGenerationError('Failed to connect to server');
    } finally {
      setIsRetrying(false);
    }
  }

  function handleCancel(): void {
    resetGenerationForRetry();
    setStep(4);
    setView('wizard');
  }

  function getStepStatus(agentId: string): 'pending' | 'active' | 'complete' {
    const agentIdx = generationPipeline.findIndex((a) => a.id === agentId);
    const currentIdx = generationPipeline.findIndex((a) => a.id === generationAgent);

    if (agentIdx < currentIdx) return 'complete';
    if (agentIdx === currentIdx) return 'active';
    return 'pending';
  }

  // Shared preview content block (used by timeline and stepper modes)
  function renderPreview(): React.ReactElement | null {
    if (!previewText || generationError) return null;
    return (
      <div className={`generating__preview ${previewOpen ? 'generating__preview--open' : ''}`}>
        <button
          type="button"
          className="generating__preview-header"
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          <div className="generating__preview-header-left">
            <Loader2 size={14} className="spin" />
            <span>{generationAgent ? `${getStepLabel(generationAgent, 'Working')}...` : 'Working...'}</span>
          </div>
          <div className="generating__preview-header-right">
            <span>{previewOpen ? 'Hide' : 'Preview'}</span>
            <ChevronDown
              size={14}
              className={`generating__preview-chevron ${previewOpen ? 'generating__preview-chevron--open' : ''}`}
            />
          </div>
        </button>
        {previewOpen && (
          <div ref={previewRef} className="generating__preview-content">
            <Markdown>{previewText.slice(-2000)}</Markdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="paper">
        <div className="generating">
          <h1 className="step-heading step-heading--serif">Let&rsquo;s write!</h1>
          <p className="step-subtitle">
            {generationError
              ? 'An error occurred during generation'
              : 'Sit tight while we draft an initial version of your post'}
          </p>

          {/* MODE: Preview Bar */}
          {timelineStyle === 'preview-bar' && !generationError && (
            <div className={`generating__bar ${previewOpen ? 'generating__bar--open' : ''}`}>
              <button
                type="button"
                className="generating__bar-header"
                onClick={() => setPreviewOpen(!previewOpen)}
              >
                <div className="generating__bar-left">
                  {generationAgent ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Circle size={14} />
                  )}
                  <span className="generating__bar-current">
                    {generationAgent ? `${getStepLabel(generationAgent, generationAgentLabel || '')}...` : 'Starting...'}
                  </span>
                </div>
                <div className="generating__bar-right">
                  {nextAgent ? (
                    <span className="generating__bar-next">Up Next: {getNextLabel(nextAgent.id, nextAgent.label)}</span>
                  ) : generationAgent ? (
                    <span className="generating__bar-next">Final step</span>
                  ) : null}
                  <ChevronDown
                    size={14}
                    className={`generating__preview-chevron ${previewOpen ? 'generating__preview-chevron--open' : ''}`}
                  />
                </div>
              </button>
              {previewOpen && previewText && (
                <div ref={previewRef} className="generating__preview-content">
                  <Markdown>{previewText.slice(-2000)}</Markdown>
                </div>
              )}
            </div>
          )}

          {/* MODE: Vertical Timeline */}
          {timelineStyle === 'timeline' && (
            <>
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
                          <span className="generating__step-label">{getStepLabel(agent.id, agent.label)}</span>
                          <span className="generating__step-desc">
                            {STEP_DESCRIPTIONS[agent.id] || ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {renderPreview()}
            </>
          )}

          {/* MODE: Horizontal Stepper */}
          {timelineStyle === 'stepper' && (
            <>
              <div className="generating__stepper">
                {generationPipeline.map((agent, idx) => {
                  const status = generationError
                    ? (getStepStatus(agent.id) === 'complete' ? 'complete' : 'pending')
                    : getStepStatus(agent.id);
                  const isActive = status === 'active' && !generationError;
                  const isLast = idx === generationPipeline.length - 1;

                  return (
                    <div key={agent.id} className="generating__stepper-item">
                      <div className={`generating__stepper-dot generating__stepper-dot--${status}`}>
                        {status === 'complete' ? (
                          <Check size={12} />
                        ) : isActive ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          <span className="generating__stepper-number">{idx + 1}</span>
                        )}
                      </div>
                      <span className={`generating__stepper-label generating__stepper-label--${status}`}>
                        {getStepLabel(agent.id, agent.label)}
                      </span>
                      {!isLast && (
                        <div className={`generating__stepper-line generating__stepper-line--${status}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              {renderPreview()}
            </>
          )}

          {/* Error Message + Actions (shared) */}
          {generationError && (
            <>
              <div className="generating__error">
                <AlertCircle size={16} />
                <span>{generationError}</span>
              </div>
              <div className="generating__error-actions">
                <button className="btn btn--ghost" onClick={handleCancel} disabled={isRetrying}>
                  <ArrowLeft size={16} />
                  Back to Wizard
                </button>
                <button className="btn btn--primary" onClick={handleRetry} disabled={isRetrying}>
                  {isRetrying ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />}
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
