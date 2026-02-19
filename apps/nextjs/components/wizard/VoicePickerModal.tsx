'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Mic, History, Star } from 'lucide-react';
import { fetchVoicePresets, mergeVoices, fetchSavedVoices, fetchSavedVoice } from '@/lib/api';
import { normalizeBrandVoice } from '@/lib/brand-voice-compat';
import { useWizardStore } from '@/stores/wizard-store';
import { useAuthStore } from '@/stores/auth-store';
import type { BrandVoice } from '@/types';
import type { SavedVoice } from '@/lib/api';

interface VoicePickerModalProps {
  onClose: () => void;
}

export default function VoicePickerModal({ onClose }: VoicePickerModalProps): React.ReactElement {
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [presets, setPresets] = useState<{ id: number; name: string; formattedVoice: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mergingId, setMergingId] = useState<number | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const brandVoice = useWizardStore((s) => s.brandVoice);
  const loadPresetVoice = useWizardStore((s) => s.loadPresetVoice);
  const loadSavedVoice = useWizardStore((s) => s.loadSavedVoice);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isBusy = mergingId !== null || selectingId !== null;

  useEffect(() => {
    Promise.all([
      isAuthenticated ? fetchSavedVoices() : Promise.resolve({ success: true, data: [] }),
      fetchVoicePresets(),
    ]).then(([savedRes, presetRes]) => {
      if (savedRes.success && savedRes.data) setSavedVoices(savedRes.data as SavedVoice[]);
      if (presetRes.success && presetRes.data) setPresets(presetRes.data);
      setLoadingData(false);
    });
  }, [isAuthenticated]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !isBusy) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, isBusy]);

  async function handleSelectSaved(voice: SavedVoice): Promise<void> {
    setSelectingId(voice.id);
    setError(null);
    const res = await fetchSavedVoice(voice.id);
    if (res.success && res.data) {
      loadSavedVoice(res.data.id, res.data.voiceData, res.data.sourceUrl);
      onClose();
    } else {
      setError('Failed to load voice.');
    }
    setSelectingId(null);
  }

  async function handleSelectPreset(preset: { id: number; name: string; formattedVoice: string }): Promise<void> {
    setError(null);
    try {
      const presetVoice = JSON.parse(preset.formattedVoice) as BrandVoice;

      // If user has an existing voice and is authenticated, auto-merge
      if (brandVoice && isAuthenticated) {
        setMergingId(preset.id);
        const result = await mergeVoices({ userVoice: brandVoice, presetVoice });
        if (result.success && result.data) {
          const normalized = normalizeBrandVoice(result.data.mergedVoice as Record<string, unknown>);
          loadPresetVoice(preset.id, preset.name, normalized);
          onClose();
        } else {
          setError(result.error || 'Merge failed. Please try again.');
        }
        setMergingId(null);
      } else {
        // No existing voice or not authenticated — just load the preset directly
        loadPresetVoice(preset.id, preset.name, presetVoice);
        onClose();
      }
    } catch {
      setError('Failed to load preset voice.');
      setMergingId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={isBusy ? undefined : onClose}>
      <div className="modal voice-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Choose a different voice</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={isBusy}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal__body">
          <p className="voice-picker-modal__intro">
            Select a voice that better represents your brand. Preset styles will be blended
            with your store&rsquo;s identity to keep things personal.
          </p>

          {error && (
            <p className="voice-picker-modal__error">{error}</p>
          )}

          {loadingData ? (
            <div className="voice-picker-modal__loading">
              <Loader2 size={20} className="spin" />
            </div>
          ) : (
            <>
              {/* Saved voices */}
              {savedVoices.length > 0 && (
                <div className="voice-picker-modal__section">
                  <h3 className="voice-picker-modal__section-title">My Voices</h3>
                  <div className="voice-picker-modal__list">
                    {savedVoices.map((voice) => (
                      <button
                        key={voice.id}
                        type="button"
                        className="voice-picker-modal__item"
                        onClick={() => handleSelectSaved(voice)}
                        disabled={isBusy}
                      >
                        <span className="voice-picker-modal__icon">
                          {selectingId === voice.id
                            ? <Loader2 size={16} className="spin" />
                            : <History size={16} />}
                        </span>
                        <span className="voice-picker-modal__name">
                          {voice.name}
                          {voice.isDefault && (
                            <span className="voice-picker-modal__badge">
                              <Star size={8} />
                              default
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preset voices */}
              {presets.length > 0 && (
                <div className="voice-picker-modal__section">
                  <h3 className="voice-picker-modal__section-title">Preset Styles</h3>
                  <div className="voice-picker-modal__list">
                    {presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="voice-picker-modal__item"
                        onClick={() => handleSelectPreset(preset)}
                        disabled={isBusy}
                      >
                        <span className="voice-picker-modal__icon">
                          {mergingId === preset.id
                            ? <Loader2 size={16} className="spin" />
                            : <Mic size={16} />}
                        </span>
                        <span className="voice-picker-modal__name">{preset.name}</span>
                        {mergingId === preset.id && (
                          <span className="voice-picker-modal__status">Merging&hellip;</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {savedVoices.length === 0 && presets.length === 0 && (
                <p className="voice-picker-modal__empty">
                  No alternative voices available.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
