'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { ArrowLeft, Pencil, Check, Users, DollarSign, Sparkles, MessageSquareQuote } from 'lucide-react';
import type { BrandVoice } from '@/types';

export default function BrandVoiceStep(): React.ReactElement {
  const brandVoice = useWizardStore((s) => s.brandVoice);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const confirmBrandVoice = useWizardStore((s) => s.confirmBrandVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<BrandVoice | null>(null);

  if (!brandVoice) return <></>;

  function handleEdit(): void {
    setEditData({ ...brandVoice! });
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

  const data = isEditing ? editData! : brandVoice;

  // --- Edit mode: simple form ---
  if (isEditing) {
    return (
      <div>
        <div className="brand-voice__header">
          <h1 className="brand-voice__name">Edit Profile</h1>
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Brand Name</label>
          <input
            className="input"
            value={editData!.brandName}
            onChange={(e) => setEditData({ ...editData!, brandName: e.target.value })}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Summary</label>
          <textarea
            className="textarea"
            value={editData!.summary}
            onChange={(e) => setEditData({ ...editData!, summary: e.target.value })}
            rows={3}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Tone (comma-separated)</label>
          <input
            className="input"
            value={editData!.tone.join(', ')}
            onChange={(e) => setEditData({ ...editData!, tone: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Target Audience</label>
          <input
            className="input"
            value={editData!.targetAudience}
            onChange={(e) => setEditData({ ...editData!, targetAudience: e.target.value })}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Price Range</label>
          <input
            className="input"
            value={editData!.priceRange}
            onChange={(e) => setEditData({ ...editData!, priceRange: e.target.value })}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Unique Selling Points (one per line)</label>
          <textarea
            className="textarea"
            value={editData!.uniqueSellingPoints.join('\n')}
            onChange={(e) => setEditData({ ...editData!, uniqueSellingPoints: e.target.value.split('\n').filter(Boolean) })}
            rows={4}
          />
        </div>

        <div className="brand-voice__section">
          <label className="brand-voice__label">Suggested Blog Tone</label>
          <textarea
            className="textarea"
            value={editData!.suggestedBlogTone}
            onChange={(e) => setEditData({ ...editData!, suggestedBlogTone: e.target.value })}
            rows={2}
          />
        </div>

        <div className="step-actions">
          <button className="btn btn--ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleSaveEdit}>
            <Check size={16} />
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  // --- Display mode: magazine-style profile ---
  return (
    <div>
      {/* Brand name + edit */}
      <div className="brand-voice__header">
        <h1 className="brand-voice__name">{data.brandName}</h1>
        <button className="btn btn--outline" onClick={handleEdit}>
          <Pencil size={14} />
          Edit
        </button>
      </div>

      {/* Summary as hero text */}
      <p className="brand-voice__summary">{data.summary}</p>

      {/* Colorful tone pills */}
      <div className="brand-voice__tone-list">
        {data.tone.map((t) => (
          <span key={t} className="brand-voice__tone-tag">{t}</span>
        ))}
      </div>

      {/* Audience + Price in a 2-column grid */}
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

      {/* Blog Tone as blockquote */}
      <div className="brand-voice__blog-tone">
        <div className="brand-voice__blog-tone-label">
          <MessageSquareQuote size={12} />
          Recommended Blog Voice
        </div>
        <p className="brand-voice__blog-tone-text">{data.suggestedBlogTone}</p>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn--ghost" onClick={() => setStep(1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="btn btn--primary" onClick={handleConfirm}>
          Confirm &amp; Continue
        </button>
      </div>
    </div>
  );
}
