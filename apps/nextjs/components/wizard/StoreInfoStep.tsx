'use client';

import { useState } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { analyzeBrandVoiceStream } from '@/lib/api';
import { Play, Loader2, Check, ArrowRight } from 'lucide-react';
import InsightPopup from '@/components/InsightPopup';

export default function StoreInfoStep(): React.ReactElement {
  const storeUrl = useWizardStore((s) => s.storeUrl);
  const setStoreUrl = useWizardStore((s) => s.setStoreUrl);
  const isAnalyzing = useWizardStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useWizardStore((s) => s.setIsAnalyzing);
  const setBrandVoice = useWizardStore((s) => s.setBrandVoice);
  const setStep = useWizardStore((s) => s.setStep);
  const statusLog = useWizardStore((s) => s.analysisStatusLog);
  const appendStatusLog = useWizardStore((s) => s.appendStatusLog);
  const clearStatusLog = useWizardStore((s) => s.clearStatusLog);
  const analysisComplete = useWizardStore((s) => s.analysisComplete);
  const setAnalysisComplete = useWizardStore((s) => s.setAnalysisComplete);
  const debugData = useWizardStore((s) => s.analysisDebugData);
  const appendDebugData = useWizardStore((s) => s.appendDebugData);
  const setBrandVoiceTraceId = useWizardStore((s) => s.setBrandVoiceTraceId);
  const invalidateUrlDependentState = useWizardStore((s) => s.invalidateUrlDependentState);

  const [error, setError] = useState<string | null>(null);

  // Map status log messages to debug events by matching patterns
  function getDebugEventForMessage(msg: string, msgIndex: number): import('@/types').DebugEvent | null {
    if (debugData.length === 0) return null;

    if (msg.startsWith('Scraping ')) {
      const scrapeIndex = statusLog.slice(0, msgIndex + 1).filter(m => m.startsWith('Scraping ')).length - 1;
      const toolCalls = debugData.filter(e => e.kind === 'tool-call');
      return toolCalls[scrapeIndex] ?? null;
    }
    if (msg === 'Reading page content...') {
      const readIndex = statusLog.slice(0, msgIndex + 1).filter(m => m === 'Reading page content...').length - 1;
      const toolResults = debugData.filter(e => e.kind === 'tool-result');
      return toolResults[readIndex] ?? null;
    }
    if (msg === 'Building brand profile...') {
      return debugData.find(e => e.kind === 'raw-response') ?? null;
    }
    return null;
  }

  async function handleAnalyze(): Promise<void> {
    if (!storeUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (analysisComplete) return;

    setError(null);
    clearStatusLog();
    setIsAnalyzing(true);

    try {
      const result = await analyzeBrandVoiceStream(
        storeUrl,
        (message) => { appendStatusLog(message); },
        (data) => { appendDebugData(data); },
      );

      if (result.success && result.data) {
        setBrandVoice(result.data);
        setAnalysisComplete(true);
        if (result.traceId) {
          setBrandVoiceTraceId(result.traceId);
        }
      } else {
        setError(result.error ?? 'Analysis failed');
      }
    } catch {
      setError('Failed to analyze the URL. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleUrlChange(value: string): void {
    setStoreUrl(value);
    if (analysisComplete) {
      invalidateUrlDependentState();
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
          onChange={(e) => handleUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !analysisComplete) handleAnalyze();
          }}
          disabled={isAnalyzing || analysisComplete}
          className="store-input__field"
        />

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || analysisComplete}
          className={`btn ${analysisComplete ? 'btn--outline' : 'btn--primary'}`}
        >
          {isAnalyzing ? (
            <Loader2 size={14} className="spin" />
          ) : analysisComplete ? (
            <Check size={14} />
          ) : (
            <Play size={12} fill="currentColor" />
          )}
          {isAnalyzing ? 'Analyzing...' : analysisComplete ? 'Analyzed' : 'Analyze'}
        </button>
      </div>

      {/* Active analysis log (during analysis) */}
      {isAnalyzing && statusLog.length > 0 && (
        <div className="analysis-log">
          {statusLog.map((msg, i) => {
            const isDone = i < statusLog.length - 1;
            const debugEvent = isDone ? getDebugEventForMessage(msg, i) : null;
            return (
              <div
                key={i}
                className={`analysis-log__item ${isDone ? 'analysis-log__item--done' : 'analysis-log__item--active'}`}
              >
                {isDone ? (
                  <span className="analysis-log__check">&#10003;</span>
                ) : (
                  <Loader2 size={12} className="spin" />
                )}
                <span>{msg}</span>
                {debugEvent && <InsightPopup event={debugEvent} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed analysis log */}
      {!isAnalyzing && analysisComplete && statusLog.length > 0 && (
        <div className="analysis-log analysis-log--complete">
          {statusLog.map((msg, i) => {
            const debugEvent = getDebugEventForMessage(msg, i);
            return (
              <div key={i} className="analysis-log__item analysis-log__item--done">
                <span className="analysis-log__check">&#10003;</span>
                <span>{msg}</span>
                {debugEvent && <InsightPopup event={debugEvent} />}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {/* Navigation footer — matches Steps 2-4 pattern */}
      {analysisComplete && (
        <div className="step-actions">
          <div />
          <button className="btn btn--primary" onClick={() => setStep(2)}>
            Next
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
