'use client';

import { useState } from 'react';
import { Save, Check, Key, Loader2 } from 'lucide-react';
import { updateSettings } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

export default function ApiConfigSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  const [apiKey, setApiKey] = useState('');
  const [apiKeyDisplay, setApiKeyDisplay] = useState(allSettings.openrouter_api_key ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSaveApiKey(): Promise<void> {
    if (!apiKey) return;
    setSaveStatus('saving');
    const result = await updateSettings({ openrouter_api_key: apiKey });
    if (result.success) {
      setSaveStatus('saved');
      setApiKeyDisplay(result.data?.openrouter_api_key ?? '');
      setAllSettings((prev) => ({ ...prev, ...result.data }));
      setApiKey('');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handleToggleDebug(): Promise<void> {
    const newValue = allSettings.debug_mode === 'true' ? 'false' : 'true';
    const result = await updateSettings({ debug_mode: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  async function handleToggleInsights(): Promise<void> {
    const newValue = allSettings.insights_enabled === 'true' ? 'false' : 'true';
    const result = await updateSettings({ insights_enabled: newValue });
    if (result.success && result.data) {
      setAllSettings((prev) => ({ ...prev, ...result.data }));
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <Key size={18} />
        API Configuration
      </h2>

      <div className="settings-card">
        <label className="settings-field__label">OpenRouter API Key</label>
        {apiKeyDisplay && (
          <p className="settings-field__current">Current: {apiKeyDisplay}</p>
        )}
        <div className="settings-field__row">
          <input
            type="password"
            className="input"
            placeholder="sk-or-v1-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            className="btn btn--primary"
            onClick={handleSaveApiKey}
            disabled={!apiKey || saveStatus === 'saving'}
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
        {saveStatus === 'error' && (
          <p className="error-text">Failed to save API key</p>
        )}
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.debug_mode === 'true'}
          onChange={() => handleToggleDebug()}
          label="Debug Mode"
          description="When enabled, brand voice analysis streams diagnostic data (scraped content, raw AI response)."
        />
      </div>

      <div className="settings-card">
        <Toggle
          checked={allSettings.insights_enabled !== 'false'}
          onChange={() => handleToggleInsights()}
          label="Agent Insights Collection"
          description="When disabled, agent trace data is not collected. Disable to reduce overhead if insights impact performance."
        />
      </div>
    </section>
  );
}
