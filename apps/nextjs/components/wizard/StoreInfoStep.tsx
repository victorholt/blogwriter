'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { analyzeBrandVoiceStream } from '@/lib/api';
import { Play, Loader2 } from 'lucide-react';

export default function StoreInfoStep(): React.ReactElement {
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const setStoreUrl = useWizardStore((s) => s.setStoreUrl);
  const isAnalyzing = useWizardStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useWizardStore((s) => s.setIsAnalyzing);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const [error, setError] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);

  async function handleNext(): Promise<void> {
    if (!storeUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setStatusLog([]);
    setIsAnalyzing(true);

    try {
      const result = await analyzeBrandVoiceStream(storeUrl, (message) => {
        setStatusLog((prev) => [...prev, message]);
      });

      if (result.success && result.data) {
        setBrandVoice(result.data);
        setStep(2);
      } else {
        setError(result.error ?? 'Analysis failed');
      }
    } catch {
      setError('Failed to analyze the URL. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div>
      <h1 className="step-heading">Store Website</h1>

      <div className="store-input">
        <input
          type="url"
          placeholder="Copy and paste your home page or favorite blog post here"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNext();
          }}
          disabled={isAnalyzing}
          className="store-input__field"
        />

        <button
          onClick={handleNext}
          disabled={isAnalyzing}
          className="btn btn--primary"
        >
          {isAnalyzing ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Play size={12} fill="currentColor" />
          )}
          {isAnalyzing ? 'ANALYZING...' : 'NEXT'}
        </button>
      </div>

      {isAnalyzing && statusLog.length > 0 && (
        <div className="analysis-log">
          {statusLog.map((msg, i) => (
            <div
              key={i}
              className={`analysis-log__item ${i === statusLog.length - 1 ? 'analysis-log__item--active' : 'analysis-log__item--done'}`}
            >
              {i === statusLog.length - 1 ? (
                <Loader2 size={12} className="spin" />
              ) : (
                <span className="analysis-log__check">&#10003;</span>
              )}
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
