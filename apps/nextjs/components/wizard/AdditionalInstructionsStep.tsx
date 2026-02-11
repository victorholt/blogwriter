'use client';

import { useWizardStore } from '@/stores/wizard-store';
import { startBlogGeneration } from '@/lib/api';
import { ArrowLeft, Sparkles, Globe, Volume2, Shirt } from 'lucide-react';

export default function AdditionalInstructionsStep(): React.ReactElement {
  const additionalInstructions = useWizardStore((s) => s.additionalInstructions);
  const setAdditionalInstructions = useWizardStore((s) => s.setAdditionalInstructions);
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const selectedDressIds = useWizardStore((s) => s.selectedDressIds);
  const setStep = useWizardStore((s) => s.setStep);
  const setView = useWizardStore((s) => s.setView);
  const setSessionId = useWizardStore((s) => s.setSessionId);

  async function handleGenerate(): Promise<void> {
    if (!brandVoice) return;

    const result = await startBlogGeneration({
      storeUrl,
      brandVoice,
      selectedDressIds: Array.from(selectedDressIds),
      additionalInstructions,
    });

    if (result.success && result.data) {
      setSessionId(result.data.sessionId);
      setView('generating');
    }
  }

  return (
    <div>
      <h1 className="step-heading" style={{ color: 'var(--color-gray-800)' }}>
        Additional Instructions
      </h1>
      <p className="instructions-step__subtitle">
        Any special guidance for the blog? This is optional.
      </p>

      <textarea
        className="instructions-step__textarea"
        placeholder="Add topic focus, keywords, tone adjustments, seasonal themes, specific styling tips..."
        value={additionalInstructions}
        onChange={(e) => setAdditionalInstructions(e.target.value)}
        rows={6}
      />

      {/* Session Summary */}
      <div className="session-summary">
        <h3 className="session-summary__title">Summary</h3>
        <div className="session-summary__row">
          <Globe size={16} />
          <span className="session-summary__text">{storeUrl || 'No URL provided'}</span>
        </div>
        <div className="session-summary__row">
          <Volume2 size={16} />
          <span>{brandVoice?.brandName} &mdash; {brandVoice?.tone.slice(0, 3).join(', ')}</span>
        </div>
        <div className="session-summary__row">
          <Shirt size={16} />
          <span>{selectedDressIds.size} dress{selectedDressIds.size !== 1 ? 'es' : ''} selected</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="step-actions">
        <button className="btn btn--ghost" onClick={() => setStep(3)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="btn btn--primary btn--lg" onClick={handleGenerate}>
          <Sparkles size={18} />
          Generate Blog
        </button>
      </div>
    </div>
  );
}
