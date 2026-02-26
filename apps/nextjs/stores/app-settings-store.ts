import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AppSettingsState {
  appName: string;
  gtmId: string;
  feedbackEnabled: boolean;
  docsEnabled: boolean;
  settingsReady: boolean;
  setAppName: (name: string) => void;
  setGtmId: (id: string) => void;
  setFeedbackEnabled: (enabled: boolean) => void;
  setDocsEnabled: (enabled: boolean) => void;
  setSettingsReady: (ready: boolean) => void;
  fetchAppSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  appName: 'BlogWriter',
  gtmId: '',
  feedbackEnabled: false,
  docsEnabled: true,
  settingsReady: false,

  setAppName: (name) => set({ appName: name || 'BlogWriter' }),
  setGtmId: (id) => set({ gtmId: id || '' }),
  setFeedbackEnabled: (enabled) => set({ feedbackEnabled: enabled }),
  setDocsEnabled: (enabled) => set({ docsEnabled: enabled }),
  setSettingsReady: (ready) => set({ settingsReady: ready }),

  fetchAppSettings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/app`);
      const data = await res.json();
      set({ appName: data.appName || 'BlogWriter' });
    } catch {
      // Keep default on failure
    }
  },
}));
