'use client';

import { useRef, useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { useAuthStore } from '@/stores/auth-store';
import { CheckSquare, RefreshCw, FileText, FileDown } from 'lucide-react';
import DownloadButton from '@/components/ui/DownloadButton';
import VoicePickerModal from './VoicePickerModal';
import BrandVoiceReview from '@/components/brand-voice/BrandVoiceReview';
import { saveBrandVoice } from '@/lib/api';
import { downloadBrandVoiceAsText, downloadBrandVoiceAsSnapshot } from '@/lib/export-utils';
import type { BrandVoice } from '@/types';

export default function BrandVoiceStep(): React.ReactElement {
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const confirmBrandVoice = useWizardStore((s) => s.confirmBrandVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const savedVoiceId = useWizardStore((s) => s.savedVoiceId);
  const setSavedVoiceId = useWizardStore((s) => s.setSavedVoiceId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);

  if (!brandVoice) return <></>;

  function updateBrandVoice(partial: Partial<BrandVoice>): void {
    setBrandVoice({ ...brandVoice!, ...partial });
  }

  function handleConfirm(): void {
    confirmBrandVoice();
    setStep(3);

    // Fire-and-forget save for authenticated users
    if (isAuthenticated && brandVoice && !savedVoiceId) {
      saveBrandVoice({
        name: brandVoice.brandName || 'Untitled Voice',
        sourceUrl: storeUrl || undefined,
        voiceData: brandVoice,
      })
        .then((result) => {
          if (result.success && result.data) {
            setSavedVoiceId(result.data.id);
          }
        })
        .catch(() => {
          console.warn('[BrandVoice] Failed to save voice to account');
        });
    }
  }

  function handleSnapshotPdf(): void {
    if (!contentRef.current || !brandVoice) return;
    const slug = brandVoice.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadBrandVoiceAsSnapshot(contentRef.current, `${slug}-brand-voice.pdf`);
  }

  return (
    <div>
      <h1 className="step-heading step-heading--serif">Does this sound like you?</h1>
      <p className="step-subtitle">
        After looking at your website, we think we&rsquo;ve captured your store&rsquo;s
        personality. Please review your profile below to ensure it accurately reflects
        your brand before we begin drafting.
      </p>

      <BrandVoiceReview
        brandVoice={brandVoice}
        onUpdate={updateBrandVoice}
        contentRef={contentRef}
      />

      {/* Actions */}
      <div className="step-actions">
        <div className="step-actions__left">
          <DownloadButton
            formats={[
              {
                label: 'Text Document (.txt)',
                icon: <FileText size={14} />,
                onClick: () => downloadBrandVoiceAsText(brandVoice!),
              },
              {
                label: 'PDF Document (.pdf)',
                icon: <FileDown size={14} />,
                onClick: handleSnapshotPdf,
              },
            ]}
          />
        </div>
        <div className="step-actions__right">
          <button className="btn btn--danger-filled" onClick={() => setShowPicker(true)}>
            <RefreshCw size={14} />
            Not quite, try another voice
          </button>
          <button className="btn btn--primary" onClick={handleConfirm}>
            <CheckSquare size={16} />
            Yes, this is me
          </button>
        </div>
      </div>

      {showPicker && <VoicePickerModal onClose={() => setShowPicker(false)} />}
    </div>
  );
}
