'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { updateSettings } from '@/lib/admin-api';
import { useAppSettingsStore } from '@/stores/app-settings-store';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

export default function GeneralSettingsSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();
  const setGlobalAppName = useAppSettingsStore((s) => s.setAppName);
  const setGlobalGtmId = useAppSettingsStore((s) => s.setGtmId);
  const [appName, setAppName] = useState(allSettings.app_name || 'BlogWriter');
  const [savingAppName, setSavingAppName] = useState(false);
  const [appUrl, setAppUrl] = useState(allSettings.app_url || '');
  const [savingAppUrl, setSavingAppUrl] = useState(false);
  const [gtmId, setGtmId] = useState(allSettings.gtm_id || '');
  const [savingGtmId, setSavingGtmId] = useState(false);

  async function handleToggle(key: string, currentlyOn: boolean): Promise<void> {
    const newValue = currentlyOn ? 'false' : 'true';
    const result = await updateSettings({ [key]: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  async function handleSaveAppName(): Promise<void> {
    if (!appName.trim()) return;
    setSavingAppName(true);
    const result = await updateSettings({ app_name: appName.trim() });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setGlobalAppName(appName.trim());
    }
    setSavingAppName(false);
  }

  async function handleSaveAppUrl(): Promise<void> {
    setSavingAppUrl(true);
    // Strip trailing slash before saving
    const value = appUrl.trim().replace(/\/$/, '');
    setAppUrl(value);
    const result = await updateSettings({ app_url: value });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
    setSavingAppUrl(false);
  }

  async function handleSaveGtmId(): Promise<void> {
    setSavingGtmId(true);
    const value = gtmId.trim();
    const result = await updateSettings({ gtm_id: value });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setGlobalGtmId(value);
    }
    setSavingGtmId(false);
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <Settings size={18} />
        General Settings
      </h2>

      <div className="settings-card">
        <div className="settings-field">
          <label className="settings-field__label">Application Name</label>
          <p className="settings-field__current" style={{ fontFamily: 'inherit' }}>
            The name shown in the navigation bar and browser title.
          </p>
          <div className="settings-field__row">
            <input
              className="input"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              maxLength={100}
            />
            <button
              className="btn btn--primary"
              onClick={handleSaveAppName}
              disabled={savingAppName || !appName.trim() || appName.trim() === (allSettings.app_name || 'BlogWriter')}
            >
              {savingAppName ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-field">
          <label className="settings-field__label">Website URL</label>
          <p className="settings-field__current" style={{ fontFamily: 'inherit' }}>
            The public URL of this app (e.g. <code>https://app.example.com</code>). Used as the base for links in emails. Trailing slashes are stripped automatically.
          </p>
          <div className="settings-field__row">
            <input
              className="input"
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="https://app.example.com"
              maxLength={500}
            />
            <button
              className="btn btn--primary"
              onClick={handleSaveAppUrl}
              disabled={savingAppUrl || appUrl.trim().replace(/\/$/, '') === (allSettings.app_url || '')}
            >
              {savingAppUrl ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-field">
          <label className="settings-field__label">GTM Container ID</label>
          <p className="settings-field__current" style={{ fontFamily: 'inherit' }}>
            Enter your Google Tag Manager container ID (e.g., GTM-XXXXXXX). Leave empty to disable tracking.
          </p>
          <div className="settings-field__row">
            <input
              className="input"
              value={gtmId}
              onChange={(e) => setGtmId(e.target.value)}
              placeholder="GTM-XXXXXXX"
              maxLength={20}
            />
            <button
              className="btn btn--primary"
              onClick={handleSaveGtmId}
              disabled={savingGtmId || gtmId.trim() === (allSettings.gtm_id || '')}
            >
              {savingGtmId ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.guest_mode_enabled !== 'false'}
          onChange={() => handleToggle('guest_mode_enabled', allSettings.guest_mode_enabled !== 'false')}
          label="Guest Mode"
          description="When enabled, unauthenticated users can use the wizard without logging in. Guest blogs are not saved to any workspace."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.registration_enabled !== 'false'}
          onChange={() => handleToggle('registration_enabled', allSettings.registration_enabled !== 'false')}
          label="User Registration"
          description="When disabled, new users cannot create accounts. Only existing users can log in."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.blog_sharing_enabled === 'true'}
          onChange={() => handleToggle('blog_sharing_enabled', allSettings.blog_sharing_enabled === 'true')}
          label="Blog Sharing"
          description="When enabled, a Share button appears on the blog preview, allowing users to create public read-only links to their generated posts."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.docs_enabled !== 'false'}
          onChange={() => handleToggle('docs_enabled', allSettings.docs_enabled !== 'false')}
          label="Documentation"
          description="When enabled, the Docs section is accessible to all users via the footer and mobile navigation."
        />
      </div>
    </section>
  );
}
