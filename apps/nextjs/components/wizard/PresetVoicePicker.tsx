'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Mic } from 'lucide-react';
import { fetchVoicePresets } from '@/lib/api';
import type { BrandVoice } from '@/types';

interface PresetVoicePickerProps {
  onSelect: (presetId: number, name: string, voice: BrandVoice) => void;
  onCancel: () => void;
}

export default function PresetVoicePicker({ onSelect, onCancel }: PresetVoicePickerProps): React.ReactElement {
  const [presets, setPresets] = useState<{ id: number; name: string; formattedVoice: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVoicePresets().then((res) => {
      if (res.success && res.data) {
        setPresets(res.data);
      }
      setLoading(false);
    });
  }, []);

  function handleSelect(preset: { id: number; name: string; formattedVoice: string }): void {
    try {
      const voice = JSON.parse(preset.formattedVoice) as BrandVoice;
      onSelect(preset.id, preset.name, voice);
    } catch {
      // Skip if JSON is invalid
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Load Preset Voice</h2>
          <button className="modal__close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="modal__body">
          {loading ? (
            <div className="preset-picker__loading">
              <Loader2 size={20} className="spin" />
            </div>
          ) : presets.length === 0 ? (
            <p className="preset-picker__empty">
              No voice presets available. Create one in Settings.
            </p>
          ) : (
            <div className="preset-picker__list">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-picker__item"
                  onClick={() => handleSelect(preset)}
                >
                  <Mic size={14} className="preset-picker__icon" />
                  <span className="preset-picker__name">{preset.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
