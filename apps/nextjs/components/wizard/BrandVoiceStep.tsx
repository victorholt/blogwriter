'use client';

import { useState, useRef } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import {
  Check, CheckSquare, Users, Sparkles,
  MessageSquareQuote, Plus, X, Theater, BookOpen, Ban,
  FileText, FileDown, Mic,
} from 'lucide-react';
import EditableSection from '@/components/ui/EditableSection';
import EnhancedTextArea from '@/components/ui/EnhancedTextArea';
import TagInput from '@/components/ui/TagInput';
import DownloadButton from '@/components/ui/DownloadButton';
import PresetVoicePicker from './PresetVoicePicker';
import { downloadBrandVoiceAsText, downloadBrandVoiceAsSnapshot } from '@/lib/export-utils';
import type { BrandVoice, ToneAttribute, VocabularyCategory, WritingRule } from '@/types';

// ─── Inline editor components ───────────────────────────────
// Each editor renders the SAME visual layout as the display view,
// but swaps text for inline-editable inputs that inherit styling.

function NameEditor({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <div className="brand-voice__header">
        <input
          className="inline-edit brand-voice__name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function SummaryEditor({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <EnhancedTextArea
        value={draft}
        onChange={setDraft}
        rows={4}
      />
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function PersonalityEditor({ initial, onSave, onCancel }: {
  initial: { archetype: string; description: string };
  onSave: (v: { archetype: string; description: string }) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <div className="brand-voice__personality">
        <div className="brand-voice__section-title">
          <Theater size={12} />
          Brand Personality
        </div>
        <input
          className="inline-edit brand-voice__personality-archetype"
          value={draft.archetype}
          onChange={(e) => setDraft({ ...draft, archetype: e.target.value })}
          autoFocus
        />
        <EnhancedTextArea
          value={draft.description}
          onChange={(v) => setDraft({ ...draft, description: v })}
          placeholder="Description"
          rows={3}
        />
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function ToneEditor({ initial, onSave, onCancel }: {
  initial: ToneAttribute[];
  onSave: (v: ToneAttribute[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ToneAttribute[]>(() => structuredClone(initial));
  const update = (i: number, field: keyof ToneAttribute, value: string) => {
    const next = [...draft];
    next[i] = { ...next[i], [field]: value };
    setDraft(next);
  };
  return (
    <>
      <div className="brand-voice__tone-section">
        <div className="brand-voice__section-title">Tone Attributes</div>
        <div className="brand-voice__tone-attrs">
          {draft.map((attr, i) => (
            <div key={i} className="brand-voice__tone-attr">
              <input
                className="inline-edit brand-voice__tone-attr-name"
                value={attr.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="Tone name"
              />
              <EnhancedTextArea
                value={attr.description}
                onChange={(v) => update(i, 'description', v)}
                placeholder="Description"
                rows={3}
              />
              <button
                className="editable-section__remove-btn"
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setDraft([...draft, { name: '', description: '' }])}>
          <Plus size={14} /> Add tone
        </button>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function VocabEditor({ initial, onSave, onCancel }: {
  initial: VocabularyCategory[];
  onSave: (v: VocabularyCategory[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<VocabularyCategory[]>(() => structuredClone(initial));
  const updateCategory = (i: number, value: string) => {
    const next = [...draft];
    next[i] = { ...next[i], category: value };
    setDraft(next);
  };
  const updateTerms = (i: number, terms: string[]) => {
    const next = [...draft];
    next[i] = { ...next[i], terms };
    setDraft(next);
  };
  return (
    <>
      <div className="brand-voice__vocab">
        <div className="brand-voice__section-title">Vocabulary</div>
        {draft.map((cat, i) => (
          <div key={i} className="brand-voice__vocab-group">
            <input
              className="inline-edit brand-voice__vocab-category"
              value={cat.category}
              onChange={(e) => updateCategory(i, e.target.value)}
              placeholder="Category name"
            />
            <TagInput
              tags={cat.terms}
              onChange={(terms) => updateTerms(i, terms)}
              placeholder="Type a term and press Enter"
            />
            <button
              className="editable-section__remove-btn"
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => setDraft([...draft, { category: '', terms: [] }])}>
          <Plus size={14} /> Add category
        </button>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function StyleRulesEditor({ initial, onSave, onCancel }: {
  initial: WritingRule[];
  onSave: (v: WritingRule[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<WritingRule[]>(() => structuredClone(initial));
  const update = (i: number, field: keyof WritingRule, value: string) => {
    const next = [...draft];
    next[i] = { ...next[i], [field]: value };
    setDraft(next);
  };
  return (
    <>
      <div className="brand-voice__style-rules">
        <div className="brand-voice__section-title">
          <BookOpen size={12} />
          Writing Style
        </div>
        {draft.map((rule, i) => (
          <div key={i} className="brand-voice__style-rule">
            <input
              className="inline-edit brand-voice__style-rule-name"
              value={rule.rule}
              onChange={(e) => update(i, 'rule', e.target.value)}
              placeholder="Rule name"
            />
            <EnhancedTextArea
              value={rule.description}
              onChange={(v) => update(i, 'description', v)}
              placeholder="Description"
              rows={3}
            />
            <button
              className="editable-section__remove-btn"
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => setDraft([...draft, { rule: '', description: '' }])}>
          <Plus size={14} /> Add rule
        </button>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function AvoidancesEditor({ initial, onSave, onCancel }: {
  initial: WritingRule[];
  onSave: (v: WritingRule[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<WritingRule[]>(() => structuredClone(initial));
  const update = (i: number, field: keyof WritingRule, value: string) => {
    const next = [...draft];
    next[i] = { ...next[i], [field]: value };
    setDraft(next);
  };
  return (
    <>
      <div className="brand-voice__avoidances">
        <div className="brand-voice__section-title">
          <Ban size={12} />
          Avoidances
        </div>
        {draft.map((rule, i) => (
          <div key={i} className="brand-voice__avoidance">
            <input
              className="inline-edit brand-voice__avoidance-name"
              value={rule.rule}
              onChange={(e) => update(i, 'rule', e.target.value)}
              placeholder="Avoidance"
            />
            <EnhancedTextArea
              value={rule.description}
              onChange={(v) => update(i, 'description', v)}
              placeholder="Description"
              rows={3}
            />
            <button
              className="editable-section__remove-btn"
              onClick={() => setDraft(draft.filter((_, j) => j !== i))}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => setDraft([...draft, { rule: '', description: '' }])}>
          <Plus size={14} /> Add avoidance
        </button>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function WritingDirectionEditor({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <div className="brand-voice__blog-tone">
        <div className="brand-voice__blog-tone-label">
          <MessageSquareQuote size={12} />
          Writing Direction
        </div>
        <EnhancedTextArea
          value={draft}
          onChange={setDraft}
          rows={4}
        />
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function StatsEditor({ initial, onSave, onCancel }: {
  initial: { targetAudience: string; businessType: string };
  onSave: (v: { targetAudience: string; businessType: string }) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <div className="brand-voice__stats">
        <div className="brand-voice__stat">
          <div className="brand-voice__stat-label">
            <Users size={12} />
            Target Audience
          </div>
          <EnhancedTextArea
            value={draft.targetAudience}
            onChange={(v) => setDraft({ ...draft, targetAudience: v })}
            placeholder="Describe the target audience..."
            rows={3}
          />
        </div>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft)}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

function UspsEditor({ initial, onSave, onCancel }: {
  initial: string[];
  onSave: (v: string[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(() => [...initial]);
  const update = (i: number, value: string) => {
    const next = [...draft];
    next[i] = value;
    setDraft(next);
  };
  return (
    <>
      <div className="brand-voice__usps">
        <div className="brand-voice__section-title">
          <Sparkles size={12} />
          What Sets Them Apart
        </div>
        <div className="brand-voice__usp-list">
          {draft.map((point, i) => (
            <div key={i} className="brand-voice__usp">
              <span className="brand-voice__usp-icon">{i + 1}</span>
              <input
                className="inline-edit"
                value={point}
                onChange={(e) => update(i, e.target.value)}
                style={{ flex: 1, fontSize: 14, color: 'var(--color-gray-700)' }}
              />
              <button
                className="editable-section__remove-btn"
                style={{ position: 'static', opacity: 1, flexShrink: 0 }}
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setDraft([...draft, ''])}>
          <Plus size={14} /> Add point
        </button>
      </div>
      <div className="editable-section__actions">
        <button className="btn btn--outline" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={() => onSave(draft.filter(Boolean))}><Check size={14} /> Save</button>
      </div>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────

export default function BrandVoiceStep(): React.ReactElement {
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const confirmBrandVoice = useWizardStore((s) => s.confirmBrandVoice);
  const rejectBrandVoice = useWizardStore((s) => s.rejectBrandVoice);
  const loadPresetVoice = useWizardStore((s) => s.loadPresetVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!brandVoice) return <></>;

  function updateBrandVoice(partial: Partial<BrandVoice>): void {
    setBrandVoice({ ...brandVoice!, ...partial });
  }

  function handleConfirm(): void {
    setEditingSectionId(null);
    confirmBrandVoice();
    setStep(3);
  }

  function handleTryAgain(): void {
    setEditingSectionId(null);
    rejectBrandVoice();
  }

  function handleSnapshotPdf(): void {
    if (!contentRef.current || !brandVoice) return;
    const slug = brandVoice.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadBrandVoiceAsSnapshot(contentRef.current, `${slug}-brand-voice.pdf`);
  }

  function handlePresetSelected(presetId: number, name: string, voice: BrandVoice): void {
    loadPresetVoice(presetId, name, voice);
    setShowPresetPicker(false);
  }

  return (
    <div>
      <h1 className="step-heading step-heading--serif">Does this sound like you?</h1>
      <p className="step-subtitle">
        After looking at your website, we think we&rsquo;ve captured your store&rsquo;s
        personality. Please review your profile below to ensure it accurately reflects
        your brand before we begin drafting. If the voice isn&rsquo;t quite right, you
        can select from our curated personas below, instead.
      </p>

      {/* Brand voice content — captured for PDF snapshot */}
      <div ref={contentRef}>

      {/* Brand name */}
      <EditableSection
        sectionId="name"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <NameEditor
            initial={brandVoice.brandName}
            onSave={(v) => { updateBrandVoice({ brandName: v }); onSave(); }}
            onCancel={onCancel}
          />
        )}
      >
        <div className="brand-voice__header">
          <h2 className="brand-voice__name">{brandVoice.brandName}</h2>
        </div>
      </EditableSection>

      {/* Summary */}
      <EditableSection
        sectionId="summary"
        editingSectionId={editingSectionId}
        onEditingChange={setEditingSectionId}
        renderEdit={({ onSave, onCancel }) => (
          <SummaryEditor
            initial={brandVoice.summary}
            onSave={(v) => { updateBrandVoice({ summary: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ personality: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ toneAttributes: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ vocabulary: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ writingStyle: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ avoidances: v }); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ writingDirection: v }); onSave(); }}
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

      {/* Audience + Price + Business Type */}
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
            onSave={(v) => { updateBrandVoice(v); onSave(); }}
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
              onSave={(v) => { updateBrandVoice({ uniqueSellingPoints: v }); onSave(); }}
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

      </div>{/* end contentRef wrapper */}

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
          <button className="btn btn--accent-blue" onClick={() => setShowPresetPicker(true)}>
            <Mic size={14} />
            Load Preset Voice
          </button>
          <button className="btn btn--primary" onClick={handleConfirm}>
            <CheckSquare size={16} />
            Yes
          </button>
        </div>
      </div>

      {/* Preset voice picker modal */}
      {showPresetPicker && (
        <PresetVoicePicker
          onSelect={handlePresetSelected}
          onCancel={() => setShowPresetPicker(false)}
        />
      )}
    </div>
  );
}
