'use client';

import { useState } from 'react';
import { Mail, Save, Check, Loader2 } from 'lucide-react';
import { updateSettings, testSmtp } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

const SMTP_KEYS = [
  { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
  { key: 'smtp_port', label: 'SMTP Port', placeholder: '587' },
  { key: 'smtp_user', label: 'Username', placeholder: 'user@example.com' },
  { key: 'smtp_password', label: 'Password', placeholder: '--------', type: 'password' as const },
  { key: 'smtp_from_email', label: 'From Email', placeholder: 'noreply@example.com' },
  { key: 'smtp_from_name', label: 'From Name', placeholder: 'BlogWriter' },
];

export default function EmailSmtpSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  const [smtpEdits, setSmtpEdits] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  function getSmtpValue(key: string): string {
    return smtpEdits[key] ?? allSettings[key] ?? '';
  }

  const hasEdits = Object.keys(smtpEdits).length > 0;

  async function handleSave(): Promise<void> {
    if (!hasEdits) return;
    setSaveStatus('saving');
    const result = await updateSettings( smtpEdits);
    if (result.success) {
      setSaveStatus('saved');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setSmtpEdits({});
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handleTest(): Promise<void> {
    setTestStatus('testing');
    setTestMessage('');
    const result = await testSmtp();
    if (result.success) {
      setTestStatus('success');
      setTestMessage('SMTP connection successful');
      setTimeout(() => setTestStatus('idle'), 3000);
    } else {
      setTestStatus('error');
      setTestMessage(result.error || 'SMTP connection failed');
      setTimeout(() => setTestStatus('idle'), 5000);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <Mail size={18} />
        Email / SMTP Configuration
      </h2>

      <div className="settings-card">
        <p className="settings-field__label" style={{ marginBottom: 12 }}>
          Configure SMTP settings for password reset emails and blog sharing notifications.
        </p>
        <div className="settings-card__fields">
          {SMTP_KEYS.map(({ key, label, placeholder, type }) => (
            <div key={key} className="settings-field">
              <label className="settings-field__label">{label}</label>
              <input
                className="input"
                type={type || 'text'}
                placeholder={placeholder}
                value={getSmtpValue(key)}
                onChange={(e) => setSmtpEdits((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="settings-card__fields" style={{ marginTop: 12 }}>
          <div className="settings-field">
            <Toggle
              checked={allSettings.smtp_secure !== 'false'}
              onChange={async () => {
                const newValue = allSettings.smtp_secure === 'false' ? 'true' : 'false';
                const result = await updateSettings( { smtp_secure: newValue });
                if (result.success && result.data) {
                  setAllSettings((prev) => ({ ...prev, ...result.data }));
                }
              }}
              label="Use TLS/SSL"
              description="Enable secure connection to SMTP server."
            />
          </div>
        </div>

        <div className="settings-card__footer">
          <span className="settings-card__updated">
            {hasEdits ? 'Unsaved changes' : 'No changes'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn--outline"
              onClick={handleTest}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' ? (
                <Loader2 size={14} className="spin" />
              ) : testStatus === 'success' ? (
                <Check size={14} />
              ) : (
                <Mail size={14} />
              )}
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              className={`btn ${hasEdits ? 'btn--primary' : 'btn--outline'}`}
              onClick={handleSave}
              disabled={!hasEdits || saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <Loader2 size={14} className="spin" />
              ) : saveStatus === 'saved' ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              {saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
        {saveStatus === 'error' && (
          <p className="error-text">Failed to save SMTP settings</p>
        )}
        {testMessage && (
          <p className={testStatus === 'error' ? 'error-text' : 'settings-field__current'} style={{ marginTop: 8 }}>
            {testMessage}
          </p>
        )}
      </div>
    </section>
  );
}
