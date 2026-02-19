'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { History, Loader2, Mic, Trash2, ChevronDown } from 'lucide-react';
import { fetchSavedVoices, fetchSavedVoice, deleteSavedVoice } from '@/lib/api';
import { useWizardStore } from '@/stores/wizard-store';
import type { SavedVoice } from '@/lib/api';

export default function SavedVoicePicker(): React.ReactElement | null {
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadSavedVoice = useWizardStore((s) => s.loadSavedVoice);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSavedVoices().then((res) => {
      if (res.success && res.data) {
        setVoices(res.data);
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
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const positionMenu = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuHeight = Math.min(voices.length * 52 + 16, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < menuHeight);
  }, [voices.length]);

  function handleToggle(): void {
    if (!open) positionMenu();
    setOpen(!open);
  }

  async function handleSelect(voice: SavedVoice): Promise<void> {
    setSelectingId(voice.id);
    const res = await fetchSavedVoice(voice.id);
    if (res.success && res.data) {
      loadSavedVoice(res.data.id, res.data.voiceData, res.data.sourceUrl);
      setOpen(false);
    }
    setSelectingId(null);
  }

  async function handleDelete(e: React.MouseEvent, id: string): Promise<void> {
    e.stopPropagation();
    setDeletingId(id);
    const res = await deleteSavedVoice(id);
    if (res.success) {
      setVoices((prev) => prev.filter((v) => v.id !== id));
    }
    setDeletingId(null);
  }

  // Don't render if still loading or no voices
  if (loading || voices.length === 0) return null;

  // Single voice: button that loads directly
  if (voices.length === 1) {
    const voice = voices[0];
    return (
      <button
        className="btn btn--accent"
        onClick={() => handleSelect(voice)}
        disabled={selectingId !== null}
      >
        {selectingId ? <Loader2 size={14} className="spin" /> : <History size={14} />}
        My Voice
      </button>
    );
  }

  // Multiple voices: dropdown
  return (
    <div ref={containerRef} className="download-btn">
      <button
        type="button"
        className="btn btn--accent"
        onClick={handleToggle}
      >
        <History size={14} />
        My Voices
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className={`download-menu download-menu--wide ${dropUp ? 'download-menu--up' : ''}`}>
          {voices.map((voice) => (
            <button
              key={voice.id}
              type="button"
              className="download-menu__item"
              onClick={() => handleSelect(voice)}
              disabled={selectingId === voice.id}
            >
              <span className="download-menu__icon">
                {selectingId === voice.id
                  ? <Loader2 size={14} className="spin" />
                  : <Mic size={14} />}
              </span>
              <span className="download-menu__label">
                {voice.name}
                {voice.isDefault && <span className="download-menu__badge">default</span>}
              </span>
              <button
                type="button"
                className="download-menu__delete"
                onClick={(e) => handleDelete(e, voice.id)}
                disabled={deletingId === voice.id}
                title="Delete"
              >
                {deletingId === voice.id
                  ? <Loader2 size={12} className="spin" />
                  : <Trash2 size={12} />}
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
