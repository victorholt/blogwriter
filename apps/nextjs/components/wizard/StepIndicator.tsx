'use client';

import { useWizardStore } from '@/stores/wizard-store';
import { Store, Volume2, Star, FileEdit, Check } from 'lucide-react';
import type { WizardStep } from '@/types';

const STEPS: { id: WizardStep; label: string; icon: typeof Store }[] = [
  { id: 1, label: 'STORE INFO', icon: Store },
  { id: 2, label: 'BRAND VOICE', icon: Volume2 },
  { id: 3, label: 'WEDDING DRESSES', icon: Star },
  { id: 4, label: 'ADDITIONAL INSTRUCTIONS', icon: FileEdit },
];

export default function StepIndicator(): React.ReactElement {
  const currentStep = useWizardStore((s) => s.currentStep);
  const setStep = useWizardStore((s) => s.setStep);

  function handleStepClick(stepId: WizardStep): void {
    if (stepId < currentStep) {
      setStep(stepId);
    }
  }

  const activeStep = STEPS.find((s) => s.id === currentStep)!;
  const ActiveIcon = activeStep.icon;
  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

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
            <ActiveIcon size={16} />
            <span>
              Step {currentStep} of {STEPS.length} &mdash; {activeStep.label}
            </span>
          </div>
          {currentStep < STEPS.length && (
            <span className="step-indicator-mobile__next">
              Next: {STEPS[currentStep].label}
            </span>
          )}
        </div>
      </div>

      {/* Desktop: full horizontal layout */}
      <nav className="step-indicator-desktop">
        {STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isPending = step.id > currentStep;
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
              {isCompleted ? <Check size={20} /> : <Icon size={20} />}
              <span>{step.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
