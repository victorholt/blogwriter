'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Mic, ChevronDown, Merge } from 'lucide-react';
import { fetchVoicePresets, mergeVoices } from '@/lib/api';
import { normalizeBrandVoice } from '@/lib/brand-voice-compat';
import { useWizardStore } from '@/stores/wizard-store';
import { useAuthStore } from '@/stores/auth-store';
import type { BrandVoice } from '@/types';

type PresetItem = { id: number; name: string; formattedVoice: string };

export default function PresetVoicePicker(): React.ReactElement | null {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PresetItem | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const brandVoice = useWizardStore((s) => s.brandVoice);
  const loadPresetVoice = useWizardStore((s) => s.loadPresetVoice);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVoicePresets().then((res) => {
      if (res.success && res.data) {
        setPresets(res.data);
      }
      setLoading(false);
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingPreset(null);
        setMergeError(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const positionMenu = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuHeight = Math.min(presets.length * 48 + 16, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < menuHeight);
  }, [presets.length]);

  function handleToggle(): void {
    if (!open) positionMenu();
    setOpen(!open);
    setPendingPreset(null);
    setMergeError(null);
  }

  function handleSelect(preset: PresetItem): void {
    // If user has an existing voice and is authenticated, show merge/replace choice
    if (brandVoice && isAuthenticated) {
      setPendingPreset(preset);
      setMergeError(null);
      return;
    }
    doReplace(preset);
  }

  function doReplace(preset: PresetItem): void {
    try {
      const voice = JSON.parse(preset.formattedVoice) as BrandVoice;
      loadPresetVoice(preset.id, preset.name, voice);
      setPendingPreset(null);
      setOpen(false);
    } catch {
      // Skip if JSON is invalid
    }
  }

  async function doMerge(preset: PresetItem): Promise<void> {
    if (!brandVoice) return;
    setMerging(true);
    setMergeError(null);
    try {
      const presetVoice = JSON.parse(preset.formattedVoice) as BrandVoice;
      const result = await mergeVoices({ userVoice: brandVoice, presetVoice });
      if (result.success && result.data) {
        const normalized = normalizeBrandVoice(result.data.mergedVoice as Record<string, unknown>);
        loadPresetVoice(preset.id, preset.name, normalized);
        setPendingPreset(null);
        setOpen(false);
      } else {
        setMergeError(result.error || 'Merge failed');
      }
    } catch {
      setMergeError('Failed to merge voices. Please try again.');
    } finally {
      setMerging(false);
    }
  }

  // Don't render if still loading or no presets
  if (loading || presets.length === 0) return null;

  return (
    <div ref={containerRef} className="download-btn">
      <button
        type="button"
        className="btn btn--accent-blue"
        onClick={handleToggle}
        disabled={merging}
      >
        {merging ? <Loader2 size={14} className="spin" /> : <Mic size={14} />}
        Preset Voices
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className={`download-menu download-menu--wide ${dropUp ? 'download-menu--up' : ''}`}>
          {pendingPreset ? (
            <div className="preset-picker__merge-choice">
              {merging ? (
                <div className="preset-picker__merging">
                  <Loader2 size={16} className="spin" />
                  <span>Merging voices&hellip;</span>
                </div>
              ) : (
                <>
                  <p className="preset-picker__merge-label">
                    Apply &ldquo;{pendingPreset.name}&rdquo; style?
                  </p>
                  {mergeError && (
                    <p className="preset-picker__merge-error">{mergeError}</p>
                  )}
                  <div className="preset-picker__merge-actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => doMerge(pendingPreset)}
                    >
                      <Merge size={12} />
                      Merge
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--outline"
                      onClick={() => doReplace(pendingPreset)}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => setPendingPreset(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="download-menu__item"
                onClick={() => handleSelect(preset)}
              >
                <span className="download-menu__icon">
                  <Mic size={14} />
                </span>
                {preset.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
