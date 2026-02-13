'use client';

import { useWizardStore } from '@/stores/wizard-store';
import { Store, Volume2, Star, FileEdit, Check, RotateCcw } from 'lucide-react';
import type { WizardStep } from '@/types';

const STEPS: { id: WizardStep; label: string; icon: typeof Store }[] = [
  { id: 1, label: 'STORE INFO', icon: Store },
  { id: 2, label: 'BRAND VOICE', icon: Volume2 },
  { id: 3, label: 'WEDDING DRESSES', icon: Star },
  { id: 4, label: 'ADDITIONAL INSTRUCTIONS', icon: FileEdit },
];

export default function StepIndicator(): React.ReactElement {
  const currentStep = useWizardStore((s) => s.currentStep);
  const view = useWizardStore((s) => s.view);
  const setStep = useWizardStore((s) => s.setStep);
  const setView = useWizardStore((s) => s.setView);
  const resetGenerationForRetry = useWizardStore((s) => s.resetGenerationForRetry);
  const reset = useWizardStore((s) => s.reset);

  const isGenerating = view === 'generating';

  function handleStepClick(stepId: WizardStep): void {
    if (isGenerating) {
      // Cancel generation and navigate to the clicked step
      resetGenerationForRetry();
      setStep(stepId);
      setView('wizard');
    } else if (stepId < currentStep) {
      setStep(stepId);
    }
  }

  const activeStep = STEPS.find((s) => s.id === currentStep)!;
  const ActiveIcon = activeStep.icon;
  const progress = isGenerating ? 100 : ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <>
      {/* Mobile: progress bar + current step label */}
      <div className="step-indicator-mobile">
        <div className="step-indicator-mobile__bar">
          <div
            className="step-indicator-mobile__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="step-indicator-mobile__row">
          <div className="step-indicator-mobile__label">
            {isGenerating ? (
              <span>Writing blog post&hellip;</span>
            ) : (
              <>
                <ActiveIcon size={14} />
                <span>
                  Step {currentStep} of {STEPS.length} &mdash; {activeStep.label}
                </span>
              </>
            )}
          </div>
          <button type="button" onClick={reset} className="step-indicator__reset">
            <RotateCcw size={12} />
            <span className="step-indicator__reset__text">Start Over</span>
          </button>
        </div>
      </div>

      {/* Desktop: full horizontal layout */}
      <nav className="step-indicator-desktop">
        {STEPS.map((step) => {
          const isCompleted = isGenerating || step.id < currentStep;
          const isActive = !isGenerating && step.id === currentStep;
          const isPending = !isGenerating && step.id > currentStep;
          const Icon = step.icon;

          let modifier = 'step-indicator__btn--pending';
          if (isActive) modifier = 'step-indicator__btn--active';
          if (isCompleted) modifier = 'step-indicator__btn--completed';

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(step.id)}
              disabled={isPending}
              className={`step-indicator__btn ${modifier}`}
            >
              {isCompleted ? <Check size={16} /> : <Icon size={16} />}
              <span>{step.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={reset} className="step-indicator__reset">
          <RotateCcw size={12} />
          <span className="step-indicator__reset__text">Start Over</span>
        </button>
      </nav>
    </>
  );
}
