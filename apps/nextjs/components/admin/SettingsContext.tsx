'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchSettings, updateSettings, fetchAppVersion } from '@/lib/admin-api';

type AuthState = 'loading' | 'authorized' | 'not-authenticated' | 'forbidden';

interface SettingsContextValue {
  authorized: boolean | null;
  authState: AuthState;
  allSettings: Record<string, string>;
  setAllSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleUpdateSettings: (updates: Record<string, string>) => Promise<boolean>;
  appVersion: string;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [allSettings, setAllSettings] = useState<Record<string, string>>({});
  const [appVersion, setAppVersion] = useState('');

  const loadData = useCallback(async () => {
    const settingsResult = await fetchSettings();
    if (!settingsResult.success) {
      setAuthorized(false);
      setAuthState(settingsResult.status === 403 ? 'forbidden' : 'not-authenticated');
      return;
    }
    setAuthorized(true);
    setAuthState('authorized');
    setAllSettings(settingsResult.data ?? {});

    fetchAppVersion().then((v) => {
      if (v.success && v.data) setAppVersion(v.data.version);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateSettings = useCallback(async (updates: Record<string, string>): Promise<boolean> => {
    const result = await updateSettings(updates);
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      return true;
    }
    return false;
  }, []);

  return (
    <SettingsContext.Provider value={{ authorized, authState, allSettings, setAllSettings, handleUpdateSettings, appVersion, reload: loadData }}>
      {children}
    </SettingsContext.Provider>
  );
}
