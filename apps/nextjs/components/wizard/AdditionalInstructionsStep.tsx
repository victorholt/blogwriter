'use client';

import { useWizardStore } from '@/stores/wizard-store';
import { startBlogGeneration } from '@/lib/api';
import { ArrowLeft, Sparkles, Globe, Shirt, Image, Link2 } from 'lucide-react';
import type { Dress } from '@/types';

/** Convert slugs like "stella-york" to "Stella York" */
function formatDesigner(raw: string): string {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdditionalInstructionsStep(): React.ReactElement {
  const additionalInstructions = useWizardStore((s) => s.additionalInstructions);
  const setAdditionalInstructions = useWizardStore((s) => s.setAdditionalInstructions);
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const selectedDressIds = useWizardStore((s) => s.selectedDressIds);
  const dressesMap = useWizardStore((s) => s.dressesMap);
  const generateImages = useWizardStore((s) => s.generateImages);
  const generateLinks = useWizardStore((s) => s.generateLinks);
  const setStep = useWizardStore((s) => s.setStep);
  const setView = useWizardStore((s) => s.setView);
  const setSessionId = useWizardStore((s) => s.setSessionId);

  const selectedDresses = Array.from(selectedDressIds)
    .map((id) => dressesMap.get(id))
    .filter(Boolean) as Dress[];

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
        {/* Brand & Store */}
        <div className="session-summary__section">
          <div className="session-summary__section-label">Brand</div>
          <div className="session-summary__brand-name">
            {brandVoice?.brandName || 'Unknown Brand'}
          </div>
          <div className="session-summary__url">
            <Globe size={13} />
            <span>{storeUrl || 'No URL provided'}</span>
          </div>
          {brandVoice && brandVoice.tone.length > 0 && (
            <div className="session-summary__tones">
              {brandVoice.tone.map((t) => (
                <span key={t} className="session-summary__tone-tag">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="session-summary__divider" />

        {/* Selected Dresses */}
        <div className="session-summary__section">
          <div className="session-summary__section-label">
            Dresses ({selectedDresses.length})
          </div>
          <div className="session-summary__dresses">
            {selectedDresses.map((dress) => (
              <div key={dress.externalId} className="session-summary__dress">
                {dress.imageUrl ? (
                  <img
                    className="session-summary__dress-thumb"
                    src={dress.imageUrl}
                    alt={dress.name}
                  />
                ) : (
                  <span className="session-summary__dress-thumb session-summary__dress-thumb--fallback">
                    <Shirt size={16} />
                  </span>
                )}
                <div className="session-summary__dress-info">
                  <span className="session-summary__dress-name">{dress.name}</span>
                  {(dress.designer || dress.styleId) && (
                    <span className="session-summary__dress-meta">
                      {dress.designer && formatDesigner(dress.designer)}
                      {dress.designer && dress.styleId && ' · '}
                      {dress.styleId}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="session-summary__divider" />

        {/* Settings */}
        <div className="session-summary__section">
          <div className="session-summary__section-label">Settings</div>
          <div className="session-summary__settings">
            <span className={`session-summary__setting-pill ${generateImages ? 'session-summary__setting-pill--on' : ''}`}>
              <Image size={12} />
              Images {generateImages ? 'On' : 'Off'}
            </span>
            <span className={`session-summary__setting-pill ${generateLinks ? 'session-summary__setting-pill--on' : ''}`}>
              <Link2 size={12} />
              Links {generateLinks ? 'On' : 'Off'}
            </span>
          </div>
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
