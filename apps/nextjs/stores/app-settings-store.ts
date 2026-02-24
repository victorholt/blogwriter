import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AppSettingsState {
  appName: string;
  gtmId: string;
  setAppName: (name: string) => void;
  setGtmId: (id: string) => void;
  fetchAppSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  appName: 'BlogWriter',
  gtmId: '',

  setAppName: (name) => set({ appName: name || 'BlogWriter' }),
  setGtmId: (id) => set({ gtmId: id || '' }),

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
