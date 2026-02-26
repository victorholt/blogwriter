'use client';

import { RotateCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { SavedVoice } from '@/lib/api';

interface NewBlogModalProps {
  showModal: boolean;
  voices: SavedVoice[];
  handleSelectVoice: (voiceId: string) => Promise<void>;
  handleNewVoice: () => void;
  closeModal: () => void;
}

export default function NewBlogModal({
  showModal,
  voices,
  handleSelectVoice,
  handleNewVoice,
  closeModal,
}: NewBlogModalProps): React.ReactElement {
  return (
    <Modal open={showModal} onClose={closeModal} title="Start a new blog">
      <p className="new-blog-modal__subtitle">Choose a brand voice or start fresh.</p>
      <ul className="new-blog-modal__list">
        {voices.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="new-blog-modal__voice-btn"
              onClick={() => handleSelectVoice(v.id)}
            >
              <span className="new-blog-modal__name">{v.name}</span>
              {v.isDefault && <span className="new-blog-modal__badge">Default</span>}
              {v.sourceUrl && (
                <span className="new-blog-modal__url">{v.sourceUrl}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <hr className="new-blog-modal__sep" />
      <button type="button" className="new-blog-modal__fresh-btn" onClick={handleNewVoice}>
        <RotateCcw size={14} />
        Start fresh
      </button>
    </Modal>
  );
}
