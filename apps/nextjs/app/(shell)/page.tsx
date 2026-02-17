'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useWizardStore } from '@/stores/wizard-store';
import { createBlogStream, fetchSessionStatus } from '@/lib/api';
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

/**
 * Poll the session status after SSE drops. The backend keeps generating even
 * when the client disconnects, so we check if the result is already there.
 * Polls every 3s up to ~2 minutes before giving up.
 */
async function pollSessionStatus(
  sessionId: string,
  setGeneratedBlog: (blog: string, seo: any, review: any) => void,
  setView: (v: 'wizard' | 'generating' | 'result') => void,
  setGenerationError: (msg: string) => void,
  setGenerationRecovering: (recovering: boolean) => void,
): Promise<void> {
  setGenerationRecovering(true);
  const MAX_POLLS = 40;
  const INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    try {
      const result = await fetchSessionStatus(sessionId);
      if (result.success && result.status === 'completed' && result.blog) {
        setGenerationRecovering(false);
        setGeneratedBlog(result.blog, result.seoMetadata ?? null, result.review ?? null);
        setView('result');
        return;
      }
      if (result.status === 'error') {
        setGenerationError('Generation failed on the server');
        return;
      }
      // Still generating — wait and poll again
    } catch {
      // Network error on poll — keep trying
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  // Exhausted all polls
  setGenerationError('Connection to generation pipeline lost');
}

function GeneratingWithSSE(): React.ReactElement {
  const sessionId = useWizardStore((s) => s.sessionId);
  const updateGeneration = useWizardStore((s) => s.updateGeneration);
  const appendChunk = useWizardStore((s) => s.appendChunk);
  const clearChunks = useWizardStore((s) => s.clearChunks);
  const setGeneratedBlog = useWizardStore((s) => s.setGeneratedBlog);
  const setGenerationError = useWizardStore((s) => s.setGenerationError);
  const setGenerationRecovering = useWizardStore((s) => s.setGenerationRecovering);
  const setView = useWizardStore((s) => s.setView);
  const setBlogTraceId = useWizardStore((s) => s.setBlogTraceId);
  const setAgentOutput = useWizardStore((s) => s.setAgentOutput);
  const addPipelineAgent = useWizardStore((s) => s.addPipelineAgent);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || connectedRef.current) return;
    connectedRef.current = true;

    const es = createBlogStream(sessionId);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'pipeline-info':
            // Add all pipeline agents upfront so the timeline is complete
            for (const agent of data.agents) {
              addPipelineAgent(agent.id, agent.label);
            }
            break;

          case 'agent-start':
            addPipelineAgent(data.agent, data.agentLabel);
            updateGeneration(data.agent, data.agentLabel, data.step, data.totalSteps);
            clearChunks();
            // Store traceId for this agent step
            if (data.traceId) {
              setBlogTraceId(data.agent, data.traceId);
            }
            break;

          case 'agent-chunk':
            appendChunk(data.chunk);
            break;

          case 'agent-complete':
            // Store this agent's full output for diff comparison
            if (data.output) {
              setAgentOutput(data.agent, data.output);
            }
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
      // Don't immediately fail — the backend may still be generating.
      // Poll the session status to recover the result if it completed.
      pollSessionStatus(sessionId, setGeneratedBlog, setView, setGenerationError, setGenerationRecovering);
    };

    return () => {
      es.close();
      connectedRef.current = false;
    };
  }, [sessionId, updateGeneration, appendChunk, clearChunks, setGeneratedBlog, setGenerationError, setGenerationRecovering, setView, setBlogTraceId, setAgentOutput, addPipelineAgent]);

  return <GeneratingView />;
}

export default function Home(): React.ReactElement {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, guestModeEnabled } = useAuthStore();
  const view = useWizardStore((s) => s.view);
  const currentStep = useWizardStore((s) => s.currentStep);

  // Redirect to login when guest mode is off and user isn't authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !guestModeEnabled) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, guestModeEnabled, router]);

  // Warn before refresh/close when user has made progress
  useEffect(() => {
    const hasProgress = currentStep > 1 || view === 'generating' || view === 'result';
    if (!hasProgress) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [currentStep, view]);

  if (view === 'result') {
    return <ResultView />;
  }

  return (
    <>
      <StepIndicator />
      {view === 'generating' ? <GeneratingWithSSE /> : <WizardStep />}
    </>
  );
}
