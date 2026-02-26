'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useWizardStore } from '@/stores/wizard-store';
import { fetchSavedVoices, fetchSavedVoice } from '@/lib/api';
import type { SavedVoice } from '@/lib/api';

export interface NewBlogFlowState {
  trigger: () => Promise<void>;
  loadingVoices: boolean;
  showModal: boolean;
  voices: SavedVoice[];
  handleSelectVoice: (voiceId: string) => Promise<void>;
  handleNewVoice: () => void;
  closeModal: () => void;
}

export function useNewBlogFlow(): NewBlogFlowState {
  const [showModal, setShowModal] = useState(false);
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const startWithDefaultVoice = useWizardStore((s) => s.startWithDefaultVoice);
  const startNewVoice = useWizardStore((s) => s.startNewVoice);
  const router = useRouter();
  const pathname = usePathname();

  const trigger = useCallback(async () => {
    if (!isAuthenticated) {
      startNewVoice();
      if (pathname !== '/new') router.push('/new');
      return;
    }
    setLoadingVoices(true);
    try {
      const result = await fetchSavedVoices();
      if (result.success && result.data?.length) {
        setVoices(result.data);
        setShowModal(true);
      } else {
        startNewVoice();
        if (pathname !== '/new') router.push('/new');
      }
    } catch {
      startNewVoice();
      if (pathname !== '/new') router.push('/new');
    } finally {
      setLoadingVoices(false);
    }
  }, [isAuthenticated, pathname, router, startNewVoice]);

  const handleSelectVoice = useCallback(async (voiceId: string) => {
    setShowModal(false);
    try {
      const result = await fetchSavedVoice(voiceId);
      if (result.success && result.data) {
        startWithDefaultVoice(result.data.id, result.data.voiceData, result.data.sourceUrl);
        if (pathname !== '/new') router.push('/new');
      }
    } catch {
      startNewVoice();
      if (pathname !== '/new') router.push('/new');
    }
  }, [pathname, router, startNewVoice, startWithDefaultVoice]);

  const handleNewVoice = useCallback(() => {
    setShowModal(false);
    startNewVoice();
    if (pathname !== '/new') router.push('/new');
  }, [pathname, router, startNewVoice]);

  const closeModal = useCallback(() => setShowModal(false), []);

  return {
    trigger,
    loadingVoices,
    showModal,
    voices,
    handleSelectVoice,
    handleNewVoice,
    closeModal,
  };
}
