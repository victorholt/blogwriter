'use client';

import { useState } from 'react';
import { Mail, Save, Check, Loader2 } from 'lucide-react';
import { updateSettings, testSmtp } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

const SMTP_KEYS = [
  { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
  { key: 'smtp_user', label: 'Username', placeholder: 'user@example.com' },
  { key: 'smtp_password', label: 'Password', placeholder: '--------', type: 'password' as const },
  { key: 'smtp_from_email', label: 'From Email', placeholder: 'noreply@example.com' },
  { key: 'smtp_from_name', label: 'From Name', placeholder: 'BlogWriter' },
];

const ENCRYPTION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'ssl', label: 'SSL' },
  { value: 'tls', label: 'TLS' },
] as const;

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
  const encryption = getSmtpValue('smtp_encryption') || 'none';
  const autoTls = getSmtpValue('smtp_auto_tls') !== 'false';
  const authEnabled = getSmtpValue('smtp_auth') !== 'false';

  async function handleSave(): Promise<void> {
    if (!hasEdits) return;
    setSaveStatus('saving');
    const result = await updateSettings(smtpEdits);
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

  function setField(key: string, value: string): void {
    setSmtpEdits((prev) => ({ ...prev, [key]: value }));
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

        {/* Host + Port row */}
        <div className="settings-card__fields">
          <div className="settings-field">
            <label className="settings-field__label">SMTP Host</label>
            <input
              className="input"
              placeholder="smtp.gmail.com"
              value={getSmtpValue('smtp_host')}
              onChange={(e) => setField('smtp_host', e.target.value)}
            />
          </div>
        </div>

        {/* Encryption */}
        <div className="settings-card__fields" style={{ marginTop: 16 }}>
          <div className="settings-field">
            <label className="settings-field__label">Encryption</label>
            <div className="settings-field__radios">
              {ENCRYPTION_OPTIONS.map((opt) => (
                <label key={opt.value} className="settings-field__radio">
                  <input
                    type="radio"
                    name="smtp_encryption"
                    value={opt.value}
                    checked={encryption === opt.value}
                    onChange={() => {
                      setField('smtp_encryption', opt.value);
                      // Auto-set port based on encryption choice
                      if (opt.value === 'ssl' && getSmtpValue('smtp_port') === '587') {
                        setField('smtp_port', '465');
                      } else if (opt.value !== 'ssl' && getSmtpValue('smtp_port') === '465') {
                        setField('smtp_port', '587');
                      }
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="settings-field__hint">
              For most servers TLS is the recommended option. If your SMTP provider offers both SSL and TLS options, we recommend using TLS.
            </p>
          </div>
        </div>

        {/* SMTP Port */}
        <div className="settings-card__fields" style={{ marginTop: 12 }}>
          <div className="settings-field">
            <label className="settings-field__label">SMTP Port</label>
            <input
              className="input"
              style={{ maxWidth: 120 }}
              placeholder={encryption === 'ssl' ? '465' : '587'}
              value={getSmtpValue('smtp_port')}
              onChange={(e) => setField('smtp_port', e.target.value)}
            />
          </div>
        </div>

        {/* Auto TLS (only shown when encryption is None) */}
        {encryption === 'none' && (
          <div className="settings-card__fields" style={{ marginTop: 12 }}>
            <div className="settings-field">
              <Toggle
                checked={autoTls}
                onChange={() => setField('smtp_auto_tls', autoTls ? 'false' : 'true')}
                label="Auto TLS"
                description="By default, TLS encryption is automatically used if the server supports it (recommended). In some cases, due to server misconfigurations, this can cause issues and may need to be disabled."
              />
            </div>
          </div>
        )}

        {/* Authentication toggle */}
        <div className="settings-card__fields" style={{ marginTop: 12 }}>
          <div className="settings-field">
            <Toggle
              checked={authEnabled}
              onChange={() => setField('smtp_auth', authEnabled ? 'false' : 'true')}
              label="Authentication"
              description="Send username and password credentials to the SMTP server."
            />
          </div>
        </div>

        {/* Username / Password / From fields — only when auth is on */}
        {authEnabled && (
          <div className="settings-card__fields" style={{ marginTop: 12 }}>
            {SMTP_KEYS.filter((k) => k.key === 'smtp_user' || k.key === 'smtp_password').map(({ key, label, placeholder, type }) => (
              <div key={key} className="settings-field">
                <label className="settings-field__label">{label}</label>
                <input
                  className="input"
                  type={type || 'text'}
                  placeholder={placeholder}
                  value={getSmtpValue(key)}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        {/* From fields always visible */}
        <div className="settings-card__fields" style={{ marginTop: 12 }}>
          {SMTP_KEYS.filter((k) => k.key === 'smtp_from_email' || k.key === 'smtp_from_name').map(({ key, label, placeholder }) => (
            <div key={key} className="settings-field">
              <label className="settings-field__label">{label}</label>
              <input
                className="input"
                placeholder={placeholder}
                value={getSmtpValue(key)}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}
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
