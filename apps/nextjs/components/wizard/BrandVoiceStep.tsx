'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import {
  ArrowLeft, Pencil, Check, Users, DollarSign, Sparkles,
  MessageSquareQuote, RefreshCw, Plus, X, Theater, BookOpen, Ban,
} from 'lucide-react';
import type { BrandVoice, ToneAttribute, VocabularyCategory, WritingRule } from '@/types';

export default function BrandVoiceStep(): React.ReactElement {
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const confirmBrandVoice = useWizardStore((s) => s.confirmBrandVoice);
  const rejectBrandVoice = useWizardStore((s) => s.rejectBrandVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<BrandVoice | null>(null);

  if (!brandVoice) return <></>;

  function handleEdit(): void {
    setEditData(structuredClone(brandVoice!));
    setIsEditing(true);
  }

  function handleSaveEdit(): void {
    if (editData) {
      setBrandVoice(editData);
    }
    setIsEditing(false);
  }

  function handleConfirm(): void {
    confirmBrandVoice();
    setStep(3);
  }

  function handleTryAgain(): void {
    rejectBrandVoice();
  }

  const data = isEditing ? editData! : brandVoice;

  // --- Edit helpers ---
  function updateToneAttr(index: number, field: keyof ToneAttribute, value: string): void {
    const next = [...editData!.toneAttributes];
    next[index] = { ...next[index], [field]: value };
    setEditData({ ...editData!, toneAttributes: next });
  }
  function addToneAttr(): void {
    setEditData({ ...editData!, toneAttributes: [...editData!.toneAttributes, { name: '', description: '' }] });
  }
  function removeToneAttr(index: number): void {
    setEditData({ ...editData!, toneAttributes: editData!.toneAttributes.filter((_, i) => i !== index) });
  }

  function updateVocabCategory(index: number, field: string, value: string): void {
    const next = [...editData!.vocabulary];
    if (field === 'category') {
      next[index] = { ...next[index], category: value };
    } else {
      next[index] = { ...next[index], terms: value.split(',').map((t) => t.trim()).filter(Boolean) };
    }
    setEditData({ ...editData!, vocabulary: next });
  }
  function addVocabCategory(): void {
    setEditData({ ...editData!, vocabulary: [...editData!.vocabulary, { category: '', terms: [] }] });
  }
  function removeVocabCategory(index: number): void {
    setEditData({ ...editData!, vocabulary: editData!.vocabulary.filter((_, i) => i !== index) });
  }

  function updateRule(list: 'writingStyle' | 'avoidances', index: number, field: keyof WritingRule, value: string): void {
    const next = [...editData![list]];
    next[index] = { ...next[index], [field]: value };
    setEditData({ ...editData!, [list]: next });
  }
  function addRule(list: 'writingStyle' | 'avoidances'): void {
    setEditData({ ...editData!, [list]: [...editData![list], { rule: '', description: '' }] });
  }
  function removeRule(list: 'writingStyle' | 'avoidances', index: number): void {
    setEditData({ ...editData!, [list]: editData![list].filter((_, i) => i !== index) });
  }

  // --- Edit mode ---
  if (isEditing) {
    return (
      <div>
        <div className="brand-voice__header">
          <h1 className="brand-voice__name">Edit Voice Profile</h1>
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Brand Name</label>
          <input className="input" value={editData!.brandName} onChange={(e) => setEditData({ ...editData!, brandName: e.target.value })} />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Summary</label>
          <textarea className="textarea" value={editData!.summary} onChange={(e) => setEditData({ ...editData!, summary: e.target.value })} rows={3} />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Target Audience</label>
          <input className="input" value={editData!.targetAudience} onChange={(e) => setEditData({ ...editData!, targetAudience: e.target.value })} />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Price Range</label>
          <input className="input" value={editData!.priceRange} onChange={(e) => setEditData({ ...editData!, priceRange: e.target.value })} />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Business Type</label>
          <input className="input" value={editData!.businessType} onChange={(e) => setEditData({ ...editData!, businessType: e.target.value })} />
        </div>

        {/* Personality */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Personality Archetype</label>
          <input className="input" value={editData!.personality.archetype} onChange={(e) => setEditData({ ...editData!, personality: { ...editData!.personality, archetype: e.target.value } })} />
        </div>
        <div className="brand-voice__section">
          <label className="brand-voice__label">Personality Description</label>
          <textarea className="textarea" value={editData!.personality.description} onChange={(e) => setEditData({ ...editData!, personality: { ...editData!.personality, description: e.target.value } })} rows={3} />
        </div>

        {/* Tone Attributes */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Tone Attributes</label>
          {editData!.toneAttributes.map((attr, i) => (
            <div key={i} className="brand-voice__edit-row">
              <input className="input" placeholder="Name" value={attr.name} onChange={(e) => updateToneAttr(i, 'name', e.target.value)} />
              <textarea className="textarea" placeholder="Description" value={attr.description} onChange={(e) => updateToneAttr(i, 'description', e.target.value)} rows={2} />
              <button className="btn btn--ghost btn--sm" onClick={() => removeToneAttr(i)}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={addToneAttr}><Plus size={14} /> Add tone</button>
        </div>

        {/* Vocabulary */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Vocabulary Categories</label>
          {editData!.vocabulary.map((cat, i) => (
            <div key={i} className="brand-voice__edit-row">
              <input className="input" placeholder="Category name" value={cat.category} onChange={(e) => updateVocabCategory(i, 'category', e.target.value)} />
              <input className="input" placeholder="Terms (comma-separated)" value={cat.terms.join(', ')} onChange={(e) => updateVocabCategory(i, 'terms', e.target.value)} />
              <button className="btn btn--ghost btn--sm" onClick={() => removeVocabCategory(i)}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={addVocabCategory}><Plus size={14} /> Add category</button>
        </div>

        {/* Writing Style */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Writing Style Rules</label>
          {editData!.writingStyle.map((rule, i) => (
            <div key={i} className="brand-voice__edit-row">
              <input className="input" placeholder="Rule" value={rule.rule} onChange={(e) => updateRule('writingStyle', i, 'rule', e.target.value)} />
              <textarea className="textarea" placeholder="Description" value={rule.description} onChange={(e) => updateRule('writingStyle', i, 'description', e.target.value)} rows={2} />
              <button className="btn btn--ghost btn--sm" onClick={() => removeRule('writingStyle', i)}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={() => addRule('writingStyle')}><Plus size={14} /> Add rule</button>
        </div>

        {/* Avoidances */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Avoidances</label>
          {editData!.avoidances.map((rule, i) => (
            <div key={i} className="brand-voice__edit-row">
              <input className="input" placeholder="Rule" value={rule.rule} onChange={(e) => updateRule('avoidances', i, 'rule', e.target.value)} />
              <textarea className="textarea" placeholder="Description" value={rule.description} onChange={(e) => updateRule('avoidances', i, 'description', e.target.value)} rows={2} />
              <button className="btn btn--ghost btn--sm" onClick={() => removeRule('avoidances', i)}><X size={14} /></button>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" onClick={() => addRule('avoidances')}><Plus size={14} /> Add avoidance</button>
        </div>

        {/* Writing Direction */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Writing Direction</label>
          <textarea className="textarea" value={editData!.writingDirection} onChange={(e) => setEditData({ ...editData!, writingDirection: e.target.value })} rows={3} />
        </div>

        {/* USPs */}
        <div className="brand-voice__section">
          <label className="brand-voice__label">Unique Selling Points (one per line)</label>
          <textarea className="textarea" value={editData!.uniqueSellingPoints.join('\n')} onChange={(e) => setEditData({ ...editData!, uniqueSellingPoints: e.target.value.split('\n').filter(Boolean) })} rows={4} />
        </div>

        <div className="step-actions">
          <button className="btn btn--ghost" onClick={() => setIsEditing(false)}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSaveEdit}>
            <Check size={16} />
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // --- Display mode: rich structured profile ---
  return (
    <div>
      {/* Brand name + actions */}
      <div className="brand-voice__header">
        <h1 className="brand-voice__name">{data.brandName}</h1>
      </div>

      {/* Summary */}
      <p className="brand-voice__summary">{data.summary}</p>

      {/* Personality card */}
      {data.personality && (
        <div className="brand-voice__personality">
          <div className="brand-voice__section-title">
            <Theater size={12} />
            Brand Personality
          </div>
          <div className="brand-voice__personality-archetype">{data.personality.archetype}</div>
          <p className="brand-voice__personality-desc">{data.personality.description}</p>
        </div>
      )}

      {/* Tone Attributes */}
      {data.toneAttributes?.length > 0 && (
        <div className="brand-voice__tone-section">
          <div className="brand-voice__section-title">Tone Attributes</div>
          <div className="brand-voice__tone-attrs">
            {data.toneAttributes.map((attr, i) => (
              <div key={i} className="brand-voice__tone-attr">
                <div className="brand-voice__tone-attr-name">{attr.name}</div>
                <p className="brand-voice__tone-attr-desc">{attr.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocabulary */}
      {data.vocabulary?.length > 0 && (
        <div className="brand-voice__vocab">
          <div className="brand-voice__section-title">Vocabulary</div>
          {data.vocabulary.map((cat, i) => (
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
      {data.writingStyle?.length > 0 && (
        <div className="brand-voice__style-rules">
          <div className="brand-voice__section-title">
            <BookOpen size={12} />
            Writing Style
          </div>
          {data.writingStyle.map((rule, i) => (
            <div key={i} className="brand-voice__style-rule">
              <div className="brand-voice__style-rule-name">{i + 1}. {rule.rule}</div>
              <p className="brand-voice__style-rule-desc">{rule.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Avoidances */}
      {data.avoidances?.length > 0 && (
        <div className="brand-voice__avoidances">
          <div className="brand-voice__section-title">
            <Ban size={12} />
            Avoidances
          </div>
          {data.avoidances.map((rule, i) => (
            <div key={i} className="brand-voice__avoidance">
              <div className="brand-voice__avoidance-name">{rule.rule}</div>
              <p className="brand-voice__avoidance-desc">{rule.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Writing Direction */}
      {data.writingDirection && (
        <div className="brand-voice__blog-tone">
          <div className="brand-voice__blog-tone-label">
            <MessageSquareQuote size={12} />
            Writing Direction
          </div>
          <p className="brand-voice__blog-tone-text">{data.writingDirection}</p>
        </div>
      )}

      {/* Audience + Price + Business Type */}
      <div className="brand-voice__stats">
        <div className="brand-voice__stat">
          <div className="brand-voice__stat-label">
            <Users size={12} />
            Target Audience
          </div>
          <p className="brand-voice__stat-value">{data.targetAudience}</p>
        </div>
        <div className="brand-voice__stat">
          <div className="brand-voice__stat-label">
            <DollarSign size={12} />
            Price Positioning
          </div>
          <p className="brand-voice__stat-value brand-voice__stat-value--price">{data.priceRange}</p>
        </div>
      </div>

      {/* Unique Selling Points */}
      {data.uniqueSellingPoints?.length > 0 && (
        <div className="brand-voice__usps">
          <div className="brand-voice__section-title">
            <Sparkles size={12} />
            What Sets Them Apart
          </div>
          <div className="brand-voice__usp-list">
            {data.uniqueSellingPoints.map((point, i) => (
              <div key={i} className="brand-voice__usp">
                <span className="brand-voice__usp-icon">{i + 1}</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn--ghost" onClick={() => setStep(1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="step-actions__right">
          <button className="btn btn--outline" onClick={handleTryAgain}>
            <RefreshCw size={14} />
            Try Again
          </button>
          <button className="btn btn--outline" onClick={handleEdit}>
            <Pencil size={14} />
            Edit
          </button>
          <button className="btn btn--primary" onClick={handleConfirm}>
            <Check size={16} />
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
