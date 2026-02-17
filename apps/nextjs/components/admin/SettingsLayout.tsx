'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldX } from 'lucide-react';
import { SettingsProvider, useSettings } from './SettingsContext';
import SettingsSidebar from './SettingsSidebar';

function SettingsShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { authorized, authState, appVersion } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (authState === 'not-authenticated') {
      router.replace('/login');
    }
  }, [authState, router]);

  if (authState === 'loading' || authState === 'not-authenticated') {
    return (
      <div className="settings-loading">
        <Loader2 size={24} className="spin" />
      </div>
    );
  }

  if (authState === 'forbidden') {
    return (
      <div className="status-page">
        <div className="status-page__icon status-page__icon--denied">
          <ShieldX size={36} strokeWidth={1.5} />
        </div>
        <h1 className="status-page__title">Access Denied</h1>
        <p className="status-page__text">
          You need an admin account to access settings. Contact your administrator if you believe this is a mistake.
        </p>
        <div className="status-page__actions">
          <button className="btn btn--ghost" onClick={() => router.push('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        {appVersion && <span className="settings-version">v{appVersion}</span>}
      </div>
      <p className="settings-subtitle">Manage API keys, agent models, and product API configuration</p>

      <div className="settings-layout">
        <SettingsSidebar basePath="/settings" />
        <div className="settings-layout__content">
          {children}
        </div>
      </div>
    </>
  );
}

export default function SettingsLayoutWrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SettingsProvider>
      <SettingsShell>{children}</SettingsShell>
    </SettingsProvider>
  );
}
