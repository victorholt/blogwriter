'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Check, Key, Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { updateSettings, fetchOpenRouterCredits, type OpenRouterCredits } from '@/lib/admin-api';
import Toggle from '@/components/ui/Toggle';
import { useSettings } from './SettingsContext';

function formatCredits(value: number): string {
  return value.toFixed(4);
}

export default function ApiConfigSection(): React.ReactElement {
  const { allSettings, setAllSettings } = useSettings();

  const [apiKey, setApiKey] = useState('');
  const [apiKeyDisplay, setApiKeyDisplay] = useState(allSettings.openrouter_api_key ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [credits, setCredits] = useState<OpenRouterCredits | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState('');
  const [creditsOpen, setCreditsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin:credits-open') === '1';
    }
    return false;
  });

  const loadCredits = useCallback(async () => {
    setCreditsLoading(true);
    setCreditsError('');
    try {
      const result = await fetchOpenRouterCredits();
      if (result.success && result.data) {
        setCredits(result.data);
      } else {
        setCreditsError(result.error || 'Failed to load');
      }
    } catch {
      setCreditsError('Failed to connect');
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  // Fetch credits when the collapsible opens for the first time
  useEffect(() => {
    if (creditsOpen && !credits && !creditsLoading && apiKeyDisplay) {
      loadCredits();
    }
  }, [creditsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Reset credits so next open re-fetches
      setCredits(null);
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

  const hasLimit = credits && credits.limit !== null && credits.limit > 0;
  const percent = hasLimit
    ? Math.min(((credits.limit! - (credits.limit_remaining ?? 0)) / credits.limit!) * 100, 100)
    : 0;

  let barClass = 'credits__bar-fill';
  if (hasLimit && credits.limit_remaining !== null) {
    const pct = (credits.limit_remaining / credits.limit!) * 100;
    if (pct < 10) barClass += ' credits__bar-fill--low';
    else if (pct < 25) barClass += ' credits__bar-fill--warn';
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

        {/* Collapsible usage section */}
        {apiKeyDisplay && (
          <div className="credits">
            <button
              className="credits__toggle"
              onClick={() => setCreditsOpen((v) => {
                const next = !v;
                localStorage.setItem('admin:credits-open', next ? '1' : '0');
                return next;
              })}
            >
              {creditsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Usage
              {credits && !creditsOpen && (
                <span className="credits__inline-value">
                  {formatCredits(credits.usage)} used
                </span>
              )}
            </button>

            {creditsOpen && (
              <div className="credits__body">
                {creditsLoading && !credits ? (
                  <div className="credits__status">
                    <Loader2 size={12} className="spin" />
                    <span>Loading...</span>
                  </div>
                ) : creditsError && !credits ? (
                  <div className="credits__status credits__status--error">
                    <span>{creditsError}</span>
                    <button className="btn btn--sm btn--ghost" onClick={loadCredits}>Retry</button>
                  </div>
                ) : credits ? (
                  <>
                    <div className="credits__rows">
                      <div className="credits__row">
                        <span className="credits__label">Total used</span>
                        <span className="credits__value">{formatCredits(credits.usage)}</span>
                      </div>
                      {hasLimit && (
                        <>
                          <div className="credits__row">
                            <span className="credits__label">Remaining</span>
                            <span className="credits__value">{formatCredits(credits.limit_remaining ?? 0)}</span>
                          </div>
                          <div className="credits__row">
                            <span className="credits__label">Limit</span>
                            <span className="credits__value">{formatCredits(credits.limit!)}</span>
                          </div>
                          <div className="credits__bar">
                            <div className={barClass} style={{ width: `${percent}%` }} />
                          </div>
                        </>
                      )}
                      {!hasLimit && (
                        <div className="credits__row">
                          <span className="credits__label">Limit</span>
                          <span className="credits__value credits__value--muted">None set</span>
                        </div>
                      )}
                      {credits.is_free_tier && (
                        <div className="credits__row">
                          <span className="credits__label">Tier</span>
                          <span className="credits__value credits__value--muted">Free</span>
                        </div>
                      )}
                    </div>
                    <button
                      className="credits__refresh"
                      onClick={loadCredits}
                      disabled={creditsLoading}
                    >
                      {creditsLoading ? <Loader2 size={10} className="spin" /> : <RefreshCw size={10} />}
                      Refresh
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
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
