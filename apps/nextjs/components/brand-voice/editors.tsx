'use client';

import { useState } from 'react';
import {
  Check, MapPin, Theater, BookOpen, Ban,
  MessageSquareQuote, Users, Sparkles, Plus, X,
} from 'lucide-react';
import EnhancedTextArea from '@/components/ui/EnhancedTextArea';
import TagInput from '@/components/ui/TagInput';
import type { ToneAttribute, VocabularyCategory, WritingRule } from '@/types';

// ─── Inline editor components ───────────────────────────────
// Each editor renders the SAME visual layout as the display view,
// but swaps text for inline-editable inputs that inherit styling.

export function NameEditor({ initial, onSave, onCancel }: {
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

export function LocationEditor({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <div className="brand-voice__location">
        <div className="brand-voice__location-label">
          <MapPin size={12} />
          Location
        </div>
        <input
          className="inline-edit brand-voice__location-value"
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

export function SummaryEditor({ initial, onSave, onCancel }: {
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

export function PersonalityEditor({ initial, onSave, onCancel }: {
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

export function ToneEditor({ initial, onSave, onCancel }: {
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

export function VocabEditor({ initial, onSave, onCancel }: {
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

export function StyleRulesEditor({ initial, onSave, onCancel }: {
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

export function AvoidancesEditor({ initial, onSave, onCancel }: {
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

export function WritingDirectionEditor({ initial, onSave, onCancel }: {
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

export function StatsEditor({ initial, onSave, onCancel }: {
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

export function UspsEditor({ initial, onSave, onCancel }: {
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
