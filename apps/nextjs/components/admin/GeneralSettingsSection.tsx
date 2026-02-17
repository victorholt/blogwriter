'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { updateSettings } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

export default function GeneralSettingsSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();
  const [appName, setAppName] = useState(allSettings.app_name || 'BlogWriter');
  const [savingAppName, setSavingAppName] = useState(false);

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
    }
    setSavingAppName(false);
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
    </section>
  );
}
