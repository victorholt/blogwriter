'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';

export default function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const fetchAppSettings = useAppSettingsStore((s) => s.fetchAppSettings);

  useEffect(() => {
    checkAuth();
    fetchAppSettings();
  }, [checkAuth, fetchAppSettings]);

  return <>{children}</>;
}
