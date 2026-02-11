'use client';

import { useEffect, useRef } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import { createBlogStream } from '@/lib/api';
import StepIndicator from '@/components/wizard/StepIndicator';
import StoreInfoStep from '@/components/wizard/StoreInfoStep';
import BrandVoiceStep from '@/components/wizard/BrandVoiceStep';
import DressSelectionStep from '@/components/wizard/DressSelectionStep';
import AdditionalInstructionsStep from '@/components/wizard/AdditionalInstructionsStep';
import GeneratingView from '@/components/GeneratingView';
import ResultView from '@/components/ResultView';

function WizardStep(): React.ReactElement {
  const currentStep = useWizardStore((s) => s.currentStep);

  let content: React.ReactElement;
  switch (currentStep) {
    case 1:
      content = <StoreInfoStep />;
      break;
    case 2:
      content = <BrandVoiceStep />;
      break;
    case 3:
      content = <DressSelectionStep />;
      break;
    case 4:
      content = <AdditionalInstructionsStep />;
      break;
    default:
      content = <StoreInfoStep />;
  }

  return (
    <div key={currentStep} className="step-transition">
      {content}
    </div>
  );
}

function GeneratingWithSSE(): React.ReactElement {
  const sessionId = useWizardStore((s) => s.sessionId);
  const updateGeneration = useWizardStore((s) => s.updateGeneration);
  const appendChunk = useWizardStore((s) => s.appendChunk);
  const clearChunks = useWizardStore((s) => s.clearChunks);
  const setGeneratedBlog = useWizardStore((s) => s.setGeneratedBlog);
  const setGenerationError = useWizardStore((s) => s.setGenerationError);
  const setView = useWizardStore((s) => s.setView);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || connectedRef.current) return;
    connectedRef.current = true;

    const es = createBlogStream(sessionId);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'agent-start':
            updateGeneration(data.agent, data.agentLabel, data.step, data.totalSteps);
            clearChunks();
            break;

          case 'agent-chunk':
            appendChunk(data.chunk);
            break;

          case 'agent-complete':
            // Step completed, will transition on next agent-start
            break;

          case 'complete':
            es.close();
            setGeneratedBlog(data.blog, data.seoMetadata, data.review);
            setView('result');
            break;

          case 'error':
            es.close();
            setGenerationError(data.message || 'Pipeline failed');
            break;
        }
      } catch {
        // Skip malformed events
      }
    };

    es.onerror = () => {
      es.close();
      setGenerationError('Connection to generation pipeline lost');
    };

    return () => {
      es.close();
      connectedRef.current = false;
    };
  }, [sessionId, updateGeneration, appendChunk, clearChunks, setGeneratedBlog, setGenerationError, setView]);

  return <GeneratingView />;
}

export default function Home(): React.ReactElement {
  const view = useWizardStore((s) => s.view);

  if (view === 'generating') {
    return <GeneratingWithSSE />;
  }

  if (view === 'result') {
    return <ResultView />;
  }

  return (
    <div className="page-shell">
      <div className="paper">
        <StepIndicator />
        <WizardStep />
      </div>
    </div>
  );
}
