import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://writer.essensedesigns.com:4444';

interface AppSettingsState {
  appName: string;
  setAppName: (name: string) => void;
  fetchAppSettings: () => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  appName: 'BlogWriter',

  setAppName: (name) => set({ appName: name || 'BlogWriter' }),

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
