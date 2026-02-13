'use client';

import { useRef, useCallback } from 'react';
import {
  Theater,
  BookOpen,
  Ban,
  MessageSquareQuote,
  Users,
  Sparkles,
  FileText,
  FileDown,
} from 'lucide-react';
import type { BrandVoice } from '@/types';
import DownloadButton from './DownloadButton';
import { downloadBrandVoiceAsText, downloadBrandVoiceAsSnapshot } from '@/lib/export-utils';

interface BrandVoicePreviewProps {
  brandVoice: BrandVoice;
  showDownload?: boolean;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

export default function BrandVoicePreview({
  brandVoice,
  showDownload = false,
  contentRef: externalRef,
}: BrandVoicePreviewProps): React.ReactElement {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = externalRef || internalRef;

  const handleSnapshotPdf = useCallback(async () => {
    if (!ref.current) return;
    await downloadBrandVoiceAsSnapshot(ref.current, `${brandVoice.brandName || 'brand-voice'}.pdf`);
  }, [ref, brandVoice.brandName]);

  return (
    <div className="brand-voice-preview">
      {showDownload && (
        <div className="brand-voice-preview__actions">
          <DownloadButton
            formats={[
              {
                label: 'Text Document (.txt)',
                icon: <FileText size={14} />,
                onClick: () => downloadBrandVoiceAsText(brandVoice),
              },
              {
                label: 'PDF Document (.pdf)',
                icon: <FileDown size={14} />,
                onClick: handleSnapshotPdf,
              },
            ]}
          />
        </div>
      )}

      <div ref={ref} className="brand-voice">
        {/* Brand name */}
        <div className="brand-voice__header">
          <h2 className="brand-voice__name">{brandVoice.brandName}</h2>
        </div>

        {/* Summary */}
        <p className="brand-voice__summary">{brandVoice.summary}</p>

        {/* Personality card */}
        {brandVoice.personality && (
          <div className="brand-voice__personality">
            <div className="brand-voice__section-title">
              <Theater size={12} />
              Brand Personality
            </div>
            <div className="brand-voice__personality-archetype">{brandVoice.personality.archetype}</div>
            <p className="brand-voice__personality-desc">{brandVoice.personality.description}</p>
          </div>
        )}

        {/* Tone Attributes */}
        {brandVoice.toneAttributes?.length > 0 && (
          <div className="brand-voice__tone-section">
            <div className="brand-voice__section-title">Tone Attributes</div>
            <div className="brand-voice__tone-attrs">
              {brandVoice.toneAttributes.map((attr, i) => (
                <div key={i} className="brand-voice__tone-attr">
                  <div className="brand-voice__tone-attr-name">{attr.name}</div>
                  <p className="brand-voice__tone-attr-desc">{attr.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocabulary */}
        {brandVoice.vocabulary?.length > 0 && (
          <div className="brand-voice__vocab">
            <div className="brand-voice__section-title">Vocabulary</div>
            {brandVoice.vocabulary.map((cat, i) => (
              <div key={i} className="brand-voice__vocab-group">
                <div className="brand-voice__vocab-category">{cat.category}</div>
                <div className="brand-voice__vocab-terms">
                  {cat.terms.map((term, j) => (
                    <span key={j} className="brand-voice__vocab-term">{term}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Writing Style */}
        {brandVoice.writingStyle?.length > 0 && (
          <div className="brand-voice__style-rules">
            <div className="brand-voice__section-title">
              <BookOpen size={12} />
              Writing Style
            </div>
            {brandVoice.writingStyle.map((rule, i) => (
              <div key={i} className="brand-voice__style-rule">
                <div className="brand-voice__style-rule-name">{i + 1}. {rule.rule}</div>
                <p className="brand-voice__style-rule-desc">{rule.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Avoidances */}
        {brandVoice.avoidances?.length > 0 && (
          <div className="brand-voice__avoidances">
            <div className="brand-voice__section-title">
              <Ban size={12} />
              Avoidances
            </div>
            {brandVoice.avoidances.map((rule, i) => (
              <div key={i} className="brand-voice__avoidance">
                <div className="brand-voice__avoidance-name">{rule.rule}</div>
                <p className="brand-voice__avoidance-desc">{rule.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Writing Direction */}
        {brandVoice.writingDirection && (
          <div className="brand-voice__blog-tone">
            <div className="brand-voice__blog-tone-label">
              <MessageSquareQuote size={12} />
              Writing Direction
            </div>
            <p className="brand-voice__blog-tone-text">{brandVoice.writingDirection}</p>
          </div>
        )}

        {/* Audience + Business Type */}
        <div className="brand-voice__stats">
          <div className="brand-voice__stat">
            <div className="brand-voice__stat-label">
              <Users size={12} />
              Target Audience
            </div>
            <p className="brand-voice__stat-value">{brandVoice.targetAudience}</p>
          </div>
        </div>

        {/* Unique Selling Points */}
        {brandVoice.uniqueSellingPoints?.length > 0 && (
          <div className="brand-voice__usps">
            <div className="brand-voice__section-title">
              <Sparkles size={12} />
              What Sets Them Apart
            </div>
            <div className="brand-voice__usp-list">
              {brandVoice.uniqueSellingPoints.map((point, i) => (
                <div key={i} className="brand-voice__usp">
                  <span className="brand-voice__usp-icon">{i + 1}</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
