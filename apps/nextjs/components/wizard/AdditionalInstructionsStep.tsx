'use client';

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { startBlogGeneration, fetchThemes, fetchBrandLabels } from '@/lib/api';
import { ArrowLeft, Sparkles, Globe, Image, Link2, Tag, Palette, Megaphone, X, AlertTriangle } from 'lucide-react';
import EnhancedTextArea from '@/components/ui/EnhancedTextArea';
import type { Dress, Theme, BrandLabel } from '@/types';

export default function AdditionalInstructionsStep(): React.ReactElement {
  const additionalInstructions = useWizardStore((s) => s.additionalInstructions);
  const setAdditionalInstructions = useWizardStore((s) => s.setAdditionalInstructions);
  const callToAction = useWizardStore((s) => s.callToAction);
  const setCallToAction = useWizardStore((s) => s.setCallToAction);
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const selectedDressIds = useWizardStore((s) => s.selectedDressIds);
  const dressesMap = useWizardStore((s) => s.dressesMap);
  const generateImages = useWizardStore((s) => s.generateImages);
  const generateLinks = useWizardStore((s) => s.generateLinks);
  const selectedThemeId = useWizardStore((s) => s.selectedThemeId);
  const selectedBrandSlug = useWizardStore((s) => s.selectedBrandSlug);
  const debugMode = useWizardStore((s) => s.debugMode);
  const setStep = useWizardStore((s) => s.setStep);
  const setView = useWizardStore((s) => s.setView);
  const setSessionId = useWizardStore((s) => s.setSessionId);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [brands, setBrands] = useState<BrandLabel[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    fetchThemes().then((r) => { if (r.success && r.data) setThemes(r.data); });
    fetchBrandLabels().then((r) => { if (r.success && r.data) setBrands(r.data); });
  }, []);

  const selectedThemeName = themes.find((t) => t.id === selectedThemeId)?.name;
  const selectedBrandName = brands.find((b) => b.slug === selectedBrandSlug)?.displayName;

  const selectedDresses = Array.from(selectedDressIds)
    .map((id) => dressesMap.get(id))
    .filter(Boolean) as Dress[];

  async function handleGenerate(): Promise<void> {
    if (!brandVoice) return;

    // Merge CTA into additional instructions for the API
    let instructions = additionalInstructions;
    if (callToAction.trim()) {
      const ctaLine = `\nCall to Action: Include the following call-to-action in the blog post: "${callToAction.trim()}"`;
      instructions = instructions ? instructions + ctaLine : ctaLine.trim();
    }

    const result = await startBlogGeneration({
      storeUrl,
      brandVoice,
      selectedDressIds: Array.from(selectedDressIds),
      additionalInstructions: instructions,
      themeId: selectedThemeId ?? undefined,
      brandLabelSlug: selectedBrandSlug ?? undefined,
    });

    if (result.success && result.data) {
      setSessionId(result.data.sessionId);
      setView('generating');
    }
  }

  return (
    <div>
      <h1 className="step-heading step-heading--serif">Anything else we should know?</h1>
      <p className="step-subtitle">
        Add any special guidance or preferences for the blog post. This is completely
        optional &mdash; we&rsquo;ll handle the rest.
      </p>

      {/* Call to Action */}
      <div className="instructions-step__cta">
        <label className="instructions-step__cta-label">
          <Megaphone size={14} />
          Call to Action
          <span className="instructions-step__cta-optional">Optional</span>
        </label>
        <p className="instructions-step__cta-hint">
          A specific message or action you want readers to take, like &ldquo;Book your appointment
          today&rdquo; or &ldquo;Shop the collection online.&rdquo;
        </p>
        <EnhancedTextArea
          value={callToAction}
          onChange={setCallToAction}
          placeholder="e.g. Book your bridal appointment online at..."
          rows={2}
        />
      </div>

      {/* Additional Instructions */}
      <label className="instructions-step__label">
        Additional Instructions
        <span className="instructions-step__cta-optional">Optional</span>
      </label>
      <textarea
        className="instructions-step__textarea"
        placeholder="Add topic focus, keywords, tone adjustments, seasonal themes, specific styling tips..."
        value={additionalInstructions}
        onChange={(e) => setAdditionalInstructions(e.target.value)}
        rows={5}
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
          {brandVoice?.summary && (
            <p className="session-summary__voice-summary">{brandVoice.summary}</p>
          )}
          {brandVoice?.personality?.archetype && (
            <div className="session-summary__personality">
              {brandVoice.personality.archetype}
            </div>
          )}
          {brandVoice?.toneAttributes && brandVoice.toneAttributes.length > 0 && (
            <div className="session-summary__tones">
              {brandVoice.toneAttributes.map((t) => (
                <span key={t.name} className="session-summary__tone-tag">{t.name}</span>
              ))}
            </div>
          )}
        </div>

        {/* Theme & Brand Label */}
        {(selectedThemeName || selectedBrandName) && (
          <>
            <div className="session-summary__divider" />
            <div className="session-summary__section">
              {selectedThemeName && (
                <div className="session-summary__meta-row">
                  <Palette size={13} />
                  <span className="session-summary__meta-label">Theme:</span>
                  <span className="session-summary__meta-value">{selectedThemeName}</span>
                </div>
              )}
              {selectedBrandName && (
                <div className="session-summary__meta-row">
                  <Tag size={13} />
                  <span className="session-summary__meta-label">Brand:</span>
                  <span className="session-summary__meta-value">{selectedBrandName}</span>
                </div>
              )}
            </div>
          </>
        )}

        {callToAction.trim() && (
          <>
            <div className="session-summary__divider" />
            <div className="session-summary__section">
              <div className="session-summary__section-label">Call to Action</div>
              <div className="session-summary__cta">
                <Megaphone size={14} />
                <span>&ldquo;{callToAction.trim()}&rdquo;</span>
              </div>
            </div>
          </>
        )}

        <div className="session-summary__divider" />

        {/* Selected Dresses */}
        <div className="session-summary__section">
          <div className="session-summary__section-label">
            Dresses ({selectedDresses.length})
          </div>
          <div className="session-summary__dress-badges">
            {selectedDresses.map((dress) => (
              <span key={dress.externalId} className="session-summary__dress-badge">
                {dress.styleId || dress.name}
              </span>
            ))}
          </div>
        </div>

        {debugMode && (
          <>
            <div className="session-summary__divider" />
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
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="step-actions">
        <button className="btn btn--ghost" onClick={() => setStep(3)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="btn btn--primary btn--lg" onClick={() => setShowDisclaimer(true)}>
          <Sparkles size={18} />
          Generate Blog
        </button>
      </div>

      {/* AI Disclaimer Modal */}
      {showDisclaimer && (
        <div className="modal-overlay" onClick={() => setShowDisclaimer(false)}>
          <div className="modal ai-disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">Before we generate&hellip;</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setShowDisclaimer(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal__body">
              <div className="ai-disclaimer-modal__banner">
                <AlertTriangle size={18} />
                <span>AI-Generated Content Disclaimer</span>
              </div>
              <p className="ai-disclaimer-modal__text">
                All blog content produced by this Service is generated entirely by artificial
                intelligence. This content does not represent the views, opinions, or endorsements
                of the platform, its operators, or any affiliated parties.
              </p>
              <p className="ai-disclaimer-modal__text">
                AI-generated content may contain factual inaccuracies, outdated information,
                inappropriate suggestions, fabricated details, or errors of any kind.
              </p>
              <p className="ai-disclaimer-modal__text ai-disclaimer-modal__text--strong">
                You are solely responsible for reviewing, editing, and verifying all AI-generated
                content before publishing, distributing, or using it in any capacity.
              </p>
              <div className="ai-disclaimer-modal__actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => setShowDisclaimer(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => { setShowDisclaimer(false); handleGenerate(); }}
                >
                  <Sparkles size={16} />
                  I understand, generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
