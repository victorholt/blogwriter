'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Plus, Trash2, Star, ExternalLink } from 'lucide-react';
import { fetchSavedVoices, deleteSavedVoice, setDefaultSavedVoice } from '@/lib/api';
import type { SavedVoice } from '@/lib/api';

function VoiceRow({ voice, onDelete, onSetDefault }: {
  voice: SavedVoice;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}): React.ReactElement {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  return (
    <tr
      className="blog-table__row"
      onClick={() => router.push(`/my/voices/${voice.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <td className="blog-table__td blog-table__td--title">
        <div>
          <span className="blog-table__title">
            {voice.name}
          </span>
          <button
            className={`voice-table__default-btn ${voice.isDefault ? 'voice-table__default-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault(voice.id);
            }}
            title={voice.isDefault ? 'Remove as default' : 'Set as default'}
          >
            <Star size={10} />
            {voice.isDefault && <span>default</span>}
          </button>
        </div>
      </td>
      <td className="blog-table__td blog-table__td--url">
        {voice.sourceUrl ? (
          <a
            href={voice.sourceUrl.startsWith('http') ? voice.sourceUrl : `https://${voice.sourceUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="voice-table__url"
            onClick={(e) => e.stopPropagation()}
          >
            {voice.sourceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            <ExternalLink size={11} />
          </a>
        ) : (
          <span className="voice-table__no-url">—</span>
        )}
      </td>
      <td className="blog-table__td blog-table__td--date">
        {new Date(voice.createdAt).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </td>
      <td className="blog-table__td blog-table__td--actions" onClick={(e) => e.stopPropagation()}>
        {confirmDelete ? (
          <div className="blog-table__confirm-delete">
            <span className="blog-table__confirm-text">Delete?</span>
            <button
              className="blog-table__icon-btn blog-table__icon-btn--confirm-del"
              onClick={() => onDelete(voice.id)}
            >
              Yes
            </button>
            <button
              className="blog-table__icon-btn blog-table__icon-btn--cancel"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="blog-table__icon-btn blog-table__icon-btn--delete"
            onClick={() => setConfirmDelete(true)}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function VoicesPage(): React.ReactElement {
  const router = useRouter();
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    const result = await fetchSavedVoices();
    if (result.success && result.data) {
      setVoices(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  async function handleDelete(id: string): Promise<void> {
    const result = await deleteSavedVoice(id);
    if (result.success) {
      setVoices((prev) => prev.filter((v) => v.id !== id));
    }
  }

  async function handleSetDefault(id: string): Promise<void> {
    const targetVoice = voices.find((v) => v.id === id);
    if (!targetVoice) return;

    if (targetVoice.isDefault) {
      // Toggling OFF: clear this voice's default
      setVoices((prev) => prev.map((v) =>
        v.id === id ? { ...v, isDefault: false } : v
      ));
    } else {
      // Toggling ON: set this one, clear others
      setVoices((prev) => prev.map((v) => ({ ...v, isDefault: v.id === id })));
    }

    const result = await setDefaultSavedVoice(id);
    if (!result.success) {
      // Revert on failure
      loadVoices();
    }
  }

  return (
    <div className="blog-dashboard">
      <div className="blog-dashboard__header">
        <div>
          <h1 className="blog-dashboard__title">My Voices</h1>
          {!loading && voices.length > 0 && (
            <p className="blog-dashboard__count">{voices.length} voice{voices.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="blog-dashboard__loading">
          <div className="blog-dashboard__spinner" />
          <p>Loading your voices...</p>
        </div>
      ) : voices.length === 0 ? (
        <div className="blog-dashboard__empty">
          <div className="blog-dashboard__empty-icon">
            <Mic size={40} strokeWidth={1.2} />
          </div>
          <h2 className="blog-dashboard__empty-title">No saved voices yet</h2>
          <p className="blog-dashboard__empty-text">
            When you analyze a website and confirm the brand voice, it&rsquo;s automatically saved here.
          </p>
          <button
            className="btn btn--primary btn--lg"
            onClick={() => router.push('/')}
          >
            <Plus size={16} />
            Create a Brand Voice
          </button>
        </div>
      ) : (
        <div className="blog-table__wrap">
          <table className="blog-table">
            <thead>
              <tr>
                <th className="blog-table__th">Name</th>
                <th className="blog-table__th">Source</th>
                <th className="blog-table__th">Created</th>
                <th className="blog-table__th blog-table__th--actions" />
              </tr>
            </thead>
            <tbody>
              {voices.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  voice={voice}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
