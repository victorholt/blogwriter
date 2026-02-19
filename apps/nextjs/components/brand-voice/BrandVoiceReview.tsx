'use client';

import { useState, type RefObject } from 'react';
import {
  Users, Sparkles, MapPin, MessageSquareQuote,
  Theater, BookOpen, Ban,
} from 'lucide-react';
import EditableSection from '@/components/ui/EditableSection';
import {
  NameEditor, LocationEditor, SummaryEditor, PersonalityEditor,
  ToneEditor, VocabEditor, StyleRulesEditor, AvoidancesEditor,
  WritingDirectionEditor, StatsEditor, UspsEditor,
} from './editors';
import type { BrandVoice } from '@/types';

interface BrandVoiceReviewProps {
  brandVoice: BrandVoice;
  onUpdate: (partial: Partial<BrandVoice>) => void;
  contentRef?: RefObject<HTMLDivElement | null>;
}

export default function BrandVoiceReview({
  brandVoice,
  onUpdate,
  contentRef,
}: BrandVoiceReviewProps): React.ReactElement {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  return (
    <div ref={contentRef}>

    {/* Brand name */}
    <EditableSection
      sectionId="name"
      editingSectionId={editingSectionId}
      onEditingChange={setEditingSectionId}
      renderEdit={({ onSave, onCancel }) => (
        <NameEditor
          initial={brandVoice.brandName}
          onSave={(v) => { onUpdate({ brandName: v }); onSave(); }}
          onCancel={onCancel}
        />
      )}
    >
      <div className="brand-voice__header">
        <h2 className="brand-voice__name">{brandVoice.brandName}</h2>
      </div>
    </EditableSection>

    {/* Location */}
    {brandVoice.location && (
      <EditableSection
        sectionId="location"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <LocationEditor
            initial={brandVoice.location}
            onSave={(v) => { onUpdate({ location: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
        <div className="brand-voice__location">
          <div className="brand-voice__location-label">
            <MapPin size={12} />
            Location
          </div>
          <p className="brand-voice__location-value">{brandVoice.location}</p>
        </div>
      </EditableSection>
    )}

    {/* Summary */}
    <EditableSection
      sectionId="summary"
      editingSectionId={editingSectionId}
      onEditingChange={setEditingSectionId}
      renderEdit={({ onSave, onCancel }) => (
        <SummaryEditor
          initial={brandVoice.summary}
          onSave={(v) => { onUpdate({ summary: v }); onSave(); }}
          onCancel={onCancel}
        />
      )}
    >
      <p className="brand-voice__summary">{brandVoice.summary}</p>
    </EditableSection>

    {/* Personality card */}
    {brandVoice.personality && (
      <EditableSection
        sectionId="personality"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <PersonalityEditor
            initial={brandVoice.personality}
            onSave={(v) => { onUpdate({ personality: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
        <div className="brand-voice__personality">
          <div className="brand-voice__section-title">
            <Theater size={12} />
            Brand Personality
          </div>
          <div className="brand-voice__personality-archetype">{brandVoice.personality.archetype}</div>
          <p className="brand-voice__personality-desc">{brandVoice.personality.description}</p>
        </div>
      </EditableSection>
    )}

    {/* Tone Attributes */}
    {brandVoice.toneAttributes?.length > 0 && (
      <EditableSection
        sectionId="tone"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <ToneEditor
            initial={brandVoice.toneAttributes}
            onSave={(v) => { onUpdate({ toneAttributes: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
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
      </EditableSection>
    )}

    {/* Vocabulary */}
    {brandVoice.vocabulary?.length > 0 && (
      <EditableSection
        sectionId="vocabulary"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <VocabEditor
            initial={brandVoice.vocabulary}
            onSave={(v) => { onUpdate({ vocabulary: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
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
      </EditableSection>
    )}

    {/* Writing Style */}
    {brandVoice.writingStyle?.length > 0 && (
      <EditableSection
        sectionId="writingStyle"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <StyleRulesEditor
            initial={brandVoice.writingStyle}
            onSave={(v) => { onUpdate({ writingStyle: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
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
      </EditableSection>
    )}

    {/* Avoidances */}
    {brandVoice.avoidances?.length > 0 && (
      <EditableSection
        sectionId="avoidances"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <AvoidancesEditor
            initial={brandVoice.avoidances}
            onSave={(v) => { onUpdate({ avoidances: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
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
      </EditableSection>
    )}

    {/* Writing Direction */}
    {brandVoice.writingDirection && (
      <EditableSection
        sectionId="writingDirection"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <WritingDirectionEditor
            initial={brandVoice.writingDirection}
            onSave={(v) => { onUpdate({ writingDirection: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
        <div className="brand-voice__blog-tone">
          <div className="brand-voice__blog-tone-label">
            <MessageSquareQuote size={12} />
            Writing Direction
          </div>
          <p className="brand-voice__blog-tone-text">{brandVoice.writingDirection}</p>
        </div>
      </EditableSection>
    )}

    {/* Audience + Business Type */}
    <EditableSection
      sectionId="stats"
      editingSectionId={editingSectionId}
      onEditingChange={setEditingSectionId}
      renderEdit={({ onSave, onCancel }) => (
        <StatsEditor
          initial={{
            targetAudience: brandVoice.targetAudience,
            businessType: brandVoice.businessType,
          }}
          onSave={(v) => { onUpdate(v); onSave(); }}
          onCancel={onCancel}
        />
      )}
    >
      <div className="brand-voice__stats">
        <div className="brand-voice__stat">
          <div className="brand-voice__stat-label">
            <Users size={12} />
            Target Audience
          </div>
          <p className="brand-voice__stat-value">{brandVoice.targetAudience}</p>
        </div>
      </div>
    </EditableSection>

    {/* Unique Selling Points */}
    {brandVoice.uniqueSellingPoints?.length > 0 && (
      <EditableSection
        sectionId="usps"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <UspsEditor
            initial={brandVoice.uniqueSellingPoints}
            onSave={(v) => { onUpdate({ uniqueSellingPoints: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
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
      </EditableSection>
    )}

    </div>
  );
}
