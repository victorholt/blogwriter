'use client';

import { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, Check, Trash2, RefreshCw } from 'lucide-react';
import { clearCache, fetchDressCacheStats, clearDressCache, syncDresses } from '@/lib/admin-api';

export default function CacheSection(): React.ReactElement {
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'cleared' | 'error'>('idle');
  const [cacheMessage, setCacheMessage] = useState('');
  const [dressCacheCount, setDressCacheCount] = useState<number | null>(null);
  const [dressClearStatus, setDressClearStatus] = useState<'idle' | 'clearing' | 'cleared' | 'error'>('idle');
  const [dressSyncStatus, setDressSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [dressSyncMessage, setDressSyncMessage] = useState('');

  const loadDressCacheStats = useCallback(async () => {
    const result = await fetchDressCacheStats();
    if (result.success) setDressCacheCount(result.data?.total ?? 0);
  }, []);

  useEffect(() => {
    loadDressCacheStats();
  }, [loadDressCacheStats]);

  async function handleClearCache(): Promise<void> {
    setCacheStatus('clearing');
    const result = await clearCache();
    if (result.success) {
      setCacheStatus('cleared');
      setCacheMessage(`Cleared ${result.data?.cleared ?? 0} cached entries`);
      setTimeout(() => setCacheStatus('idle'), 3000);
    } else {
      setCacheStatus('error');
      setCacheMessage('Failed to clear cache');
      setTimeout(() => setCacheStatus('idle'), 3000);
    }
  }

  async function handleClearDressCache(): Promise<void> {
    setDressClearStatus('clearing');
    const result = await clearDressCache();
    if (result.success) {
      setDressClearStatus('cleared');
      setDressCacheCount(0);
      setTimeout(() => setDressClearStatus('idle'), 3000);
    } else {
      setDressClearStatus('error');
      setTimeout(() => setDressClearStatus('idle'), 3000);
    }
  }

  async function handleSyncDresses(): Promise<void> {
    setDressSyncStatus('syncing');
    setDressSyncMessage('');
    const result = await syncDresses();
    if (result.success && result.data) {
      setDressSyncStatus('synced');
      setDressCacheCount(result.data.synced);
      const breakdown = Object.entries(result.data.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      setDressSyncMessage(`Synced ${result.data.synced} dresses (${breakdown})`);
      setTimeout(() => setDressSyncStatus('idle'), 5000);
    } else {
      setDressSyncStatus('error');
      setDressSyncMessage('Failed to sync dresses from API');
      setTimeout(() => setDressSyncStatus('idle'), 3000);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__heading">
        <Database size={18} />
        Cache
      </h2>

      <div className="settings-card">
        <h3 className="settings-card__title">Brand Voice Cache</h3>
        <p className="settings-field__label" style={{ marginBottom: 12 }}>
          Brand voice analysis results are cached for 7 days. Clear the cache to force fresh analysis on next request.
        </p>
        <div className="settings-field__row">
          <button
            className="btn btn--outline btn--danger"
            onClick={handleClearCache}
            disabled={cacheStatus === 'clearing'}
          >
            {cacheStatus === 'clearing' ? (
              <Loader2 size={14} className="spin" />
            ) : cacheStatus === 'cleared' ? (
              <Check size={14} />
            ) : (
              <Trash2 size={14} />
            )}
            {cacheStatus === 'cleared' ? cacheMessage : cacheStatus === 'clearing' ? 'Clearing...' : 'Clear Brand Voice Cache'}
          </button>
        </div>
        {cacheStatus === 'error' && (
          <p className="error-text">{cacheMessage}</p>
        )}
      </div>

      <div className="settings-card">
        <h3 className="settings-card__title">Dress Cache</h3>
        <p className="settings-field__label" style={{ marginBottom: 12 }}>
          Cached dresses from the external product API. Cache is only cleared manually.
          {dressCacheCount !== null && (
            <strong> Currently {dressCacheCount} dresses cached.</strong>
          )}
        </p>
        <div className="settings-field__row">
          <button
            className="btn btn--outline btn--danger"
            onClick={handleClearDressCache}
            disabled={dressClearStatus === 'clearing' || dressSyncStatus === 'syncing'}
          >
            {dressClearStatus === 'clearing' ? (
              <Loader2 size={14} className="spin" />
            ) : dressClearStatus === 'cleared' ? (
              <Check size={14} />
            ) : (
              <Trash2 size={14} />
            )}
            {dressClearStatus === 'cleared' ? 'Cleared' : dressClearStatus === 'clearing' ? 'Clearing...' : 'Clear Dress Cache'}
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSyncDresses}
            disabled={dressSyncStatus === 'syncing' || dressClearStatus === 'clearing'}
          >
            {dressSyncStatus === 'syncing' ? (
              <Loader2 size={14} className="spin" />
            ) : dressSyncStatus === 'synced' ? (
              <Check size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
            {dressSyncStatus === 'syncing' ? 'Syncing...' : dressSyncStatus === 'synced' ? 'Synced' : 'Sync All Dresses'}
          </button>
        </div>
        {dressSyncMessage && (
          <p className={dressSyncStatus === 'error' ? 'error-text' : 'settings-field__current'} style={{ marginTop: 8 }}>
            {dressSyncMessage}
          </p>
        )}
        {dressClearStatus === 'error' && (
          <p className="error-text">Failed to clear dress cache</p>
        )}
      </div>
    </section>
  );
}
