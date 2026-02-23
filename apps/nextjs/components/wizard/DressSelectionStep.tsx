'use client';

import { useWizardStore } from '@/stores/wizard-store';
import DressMultiSelect from '@/components/ui/DressMultiSelect';
import BrandSelector from './BrandSelector';
import ThemeSelector from './ThemeSelector';
import { ArrowLeft, ArrowRight, Mic } from 'lucide-react';

export default function DressSelectionStep(): React.ReactElement {
  const selectedDressIds = useWizardStore((s) => s.selectedDressIds);
  const toggleDress = useWizardStore((s) => s.toggleDress);
  const clearSelectedDresses = useWizardStore((s) => s.clearSelectedDresses);
  const dressesMap = useWizardStore((s) => s.dressesMap);
  const addDressesToMap = useWizardStore((s) => s.addDressesToMap);
  const selectedBrandSlug = useWizardStore((s) => s.selectedBrandSlug);
  const setStep = useWizardStore((s) => s.setStep);
  const brandVoice = useWizardStore((s) => s.brandVoice);

  const voiceName = brandVoice?.brandName || brandVoice?.summary?.slice(0, 40) || 'Your voice';

  return (
    <div>
      <h1 className="step-heading step-heading--serif">What are we talking about?</h1>
      <p className="step-subtitle">
        Let&rsquo;s define the focus of this post/content request.
      </p>

      {brandVoice && (
        <div className="voice-indicator">
          <Mic size={13} />
          <span className="voice-indicator__name">{voiceName}</span>
          <button className="voice-indicator__change" onClick={() => setStep(2)}>
            Change
          </button>
        </div>
      )}

      <BrandSelector />
      <ThemeSelector />

      <DressMultiSelect
        selectedIds={selectedDressIds}
        onToggle={toggleDress}
        onClear={clearSelectedDresses}
        dressesMap={dressesMap}
        addDressesToMap={addDressesToMap}
        brand={selectedBrandSlug ?? undefined}
        showNames={false}
      />

      {/* Navigation */}
      <div className="step-actions">
        <button className="btn btn--ghost" onClick={() => setStep(2)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          className="btn btn--primary"
          onClick={() => setStep(4)}
          disabled={selectedDressIds.size === 0}
        >
          Next
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
