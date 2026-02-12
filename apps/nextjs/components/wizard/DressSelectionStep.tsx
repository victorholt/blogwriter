'use client';

import { useWizardStore } from '@/stores/wizard-store';
import DressMultiSelect from '@/components/ui/DressMultiSelect';
import BrandSelector from './BrandSelector';
import ThemeSelector from './ThemeSelector';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function DressSelectionStep(): React.ReactElement {
  const selectedDressIds = useWizardStore((s) => s.selectedDressIds);
  const toggleDress = useWizardStore((s) => s.toggleDress);
  const clearSelectedDresses = useWizardStore((s) => s.clearSelectedDresses);
  const dressesMap = useWizardStore((s) => s.dressesMap);
  const addDressesToMap = useWizardStore((s) => s.addDressesToMap);
  const selectedBrandSlug = useWizardStore((s) => s.selectedBrandSlug);
  const setStep = useWizardStore((s) => s.setStep);

  return (
    <div>
      <h1 className="step-heading step-heading--serif">What are we talking about?</h1>
      <p className="step-subtitle">
        Let&rsquo;s define the focus of this post/content request.
      </p>

      <BrandSelector />
      <ThemeSelector />

      <DressMultiSelect
        selectedIds={selectedDressIds}
        onToggle={toggleDress}
        onClear={clearSelectedDresses}
        dressesMap={dressesMap}
        addDressesToMap={addDressesToMap}
        brand={selectedBrandSlug ?? undefined}
      />

      {/* Selection count */}
      <div
        className={`selection-count ${selectedDressIds.size > 0 ? 'selection-count--active' : 'selection-count--empty'}`}
        style={{ marginTop: '16px' }}
      >
        {selectedDressIds.size} dress{selectedDressIds.size !== 1 ? 'es' : ''} selected
      </div>

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
