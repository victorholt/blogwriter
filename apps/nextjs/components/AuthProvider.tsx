'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import { useWizardStore } from '@/stores/wizard-store';
import * as authApi from '@/lib/auth-api';
import { fetchInitSettings } from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const setAppName = useAppSettingsStore((s) => s.setAppName);
  const applyInitSettings = useWizardStore((s) => s.applyInitSettings);

  useEffect(() => {
    // Single parallel fetch: user identity + all public settings
    Promise.all([authApi.getMe(), fetchInitSettings()]).then(
      ([authResult, settings]) => {
        // Populate auth store
        setAuthState(
          authResult.user ?? null,
          settings.guestModeEnabled,
          settings.registrationEnabled,
        );

        // Populate app settings store
        setAppName(settings.appName);

        // Populate wizard store with blog/debug settings
        applyInitSettings(settings);
      },
    );
  }, [setAuthState, setAppName, applyInitSettings]);

  return <>{children}</>;
}
