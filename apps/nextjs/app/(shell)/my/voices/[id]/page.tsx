'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, FileDown, Save, Check, Mic } from 'lucide-react';
import BrandVoiceReview from '@/components/brand-voice/BrandVoiceReview';
import DownloadButton from '@/components/ui/DownloadButton';
import { fetchSavedVoice, updateSavedVoice } from '@/lib/api';
import type { SavedVoiceDetail } from '@/lib/api';
import { downloadBrandVoiceAsText, downloadBrandVoiceAsSnapshot } from '@/lib/export-utils';
import type { BrandVoice } from '@/types';

export default function VoiceDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [voice, setVoice] = useState<SavedVoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchSavedVoice(params.id as string).then((result) => {
        if (result.success && result.data) {
          setVoice(result.data);
        }
        setLoading(false);
      });
    }
  }, [params.id]);

  function handleUpdate(partial: Partial<BrandVoice>): void {
    if (!voice) return;
    setVoice({
      ...voice,
      voiceData: { ...voice.voiceData, ...partial },
    });
    setHasChanges(true);
    setSaved(false);
  }

  async function handleSave(): Promise<void> {
    if (!voice || saving) return;
    setSaving(true);
    try {
      const result = await updateSavedVoice(voice.id, {
        name: voice.voiceData.brandName,
        voiceData: voice.voiceData,
      });
      if (result.success) {
        setHasChanges(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      console.error('[VoiceDetail] Failed to save');
    }
    setSaving(false);
  }

  function handleSnapshotPdf(): void {
    if (!contentRef.current || !voice) return;
    const slug = voice.voiceData.brandName
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadBrandVoiceAsSnapshot(contentRef.current, `${slug}-brand-voice.pdf`);
  }

  if (loading) {
    return (
      <div className="voice-detail">
        <div className="blog-detail__loading">
          <div className="blog-dashboard__spinner" />
          <p>Loading voice...</p>
        </div>
      </div>
    );
  }

  if (!voice) {
    return (
      <div className="blog-detail__not-found">
        <Mic size={36} strokeWidth={1.5} />
        <h2>Voice Not Found</h2>
        <p>This voice may have been deleted or doesn&rsquo;t exist.</p>
        <button className="btn btn--primary" onClick={() => router.push('/my/voices')}>
          Back to Voices
        </button>
      </div>
    );
  }

  return (
    <div className="voice-detail">
      {/* Action bar */}
      <div className="result__action-bar">
        <button
          className="result__action-btn"
          onClick={() => router.push('/my/voices')}
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <div className="result__action-divider" />
        <DownloadButton
          formats={[
            {
              label: 'Text Document (.txt)',
              icon: <FileText size={14} />,
              onClick: () => downloadBrandVoiceAsText(voice.voiceData),
            },
            {
              label: 'PDF Document (.pdf)',
              icon: <FileDown size={14} />,
              onClick: handleSnapshotPdf,
            },
          ]}
        />
        {hasChanges && (
          <>
            <div className="result__action-divider" />
            <button
              className="result__action-btn result__action-btn--green"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </>
        )}
        {saved && (
          <>
            <div className="result__action-divider" />
            <span className="result__action-btn result__action-btn--copied">
              <Check size={14} />
              <span>Saved!</span>
            </span>
          </>
        )}
      </div>

      {/* Brand voice review content */}
      <BrandVoiceReview
        brandVoice={voice.voiceData}
        onUpdate={handleUpdate}
        contentRef={contentRef}
      />

      {/* Footer metadata */}
      <div className="blog-detail__footer">
        <span className="blog-detail__footer-label">
          {voice.sourceUrl
            ? voice.sourceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
            : 'Brand Voice'}
        </span>
        <span>
          {new Date(voice.updatedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}
