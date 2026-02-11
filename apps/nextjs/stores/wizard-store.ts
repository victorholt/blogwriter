import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BrandVoice, BlogReview, Dress, WizardStep, AppView, DebugEvent } from '@/types';

interface WizardState {
  // Navigation
  currentStep: WizardStep;
  view: AppView;

  // Step 1: Store Info
  storeUrl: string;
  isAnalyzing: boolean;
  analysisStatusLog: string[];
  analysisComplete: boolean;
  analysisDebugData: DebugEvent[];
  brandVoiceTraceId: string | null;

  // Step 2: Brand Voice
  brandVoice: BrandVoice | null;
  brandVoiceConfirmed: boolean;
  previousBrandVoice: BrandVoice | null;
  brandVoiceAttemptCount: number;

  // Step 3: Theme & Brand
  selectedThemeId: number | null;
  selectedBrandSlug: string | null;

  // Step 3: Dresses
  availableDresses: Dress[];
  selectedDressIds: Set<string>;
  isDressesLoading: boolean;
  dressSearchQuery: string;
  dressCategory: string;
  dressPage: number;
  dressTotalPages: number;
  dressCategories: string[];
  dressesMap: Map<string, Dress>;

  // Step 4: Instructions
  additionalInstructions: string;

  // Generation
  sessionId: string | null;
  generationAgent: string;
  generationStep: number;
  generationTotalSteps: number;
  generationPipeline: { id: string; label: string }[];
  blogTraceIds: Record<string, string>;

  // Result
  generatedBlog: string | null;
  seoMetadata: { title: string; description: string; keywords: string[] } | null;
  review: BlogReview | null;
  generationChunks: string;
  generationAgentLabel: string;
  generationError: string | null;
  agentOutputs: Record<string, string>;

  // Debug
  debugMode: boolean;

  // Blog settings
  timelineStyle: 'preview-bar' | 'timeline' | 'stepper';
  generateImages: boolean;
  generateLinks: boolean;

  // Actions
  setStep: (step: WizardStep) => void;
  setView: (view: AppView) => void;
  setStoreUrl: (url: string) => void;
  setIsAnalyzing: (loading: boolean) => void;
  appendStatusLog: (message: string) => void;
  clearStatusLog: () => void;
  setAnalysisComplete: (complete: boolean) => void;
  appendDebugData: (event: DebugEvent) => void;
  setBrandVoiceTraceId: (id: string | null) => void;
  setBrandVoice: (bv: BrandVoice) => void;
  confirmBrandVoice: () => void;
  setAvailableDresses: (dresses: Dress[]) => void;
  toggleDress: (id: string) => void;
  setDressesLoading: (loading: boolean) => void;
  setDressSearch: (query: string) => void;
  setDressCategory: (category: string) => void;
  setDressPage: (page: number) => void;
  setDressPagination: (totalPages: number) => void;
  setDressCategories: (categories: string[]) => void;
  addDressesToMap: (dresses: Dress[]) => void;
  clearSelectedDresses: () => void;
  setAdditionalInstructions: (text: string) => void;
  setSessionId: (id: string) => void;
  addPipelineAgent: (id: string, label: string) => void;
  updateGeneration: (agent: string, agentLabel: string, step: number, total: number) => void;
  appendChunk: (chunk: string) => void;
  clearChunks: () => void;
  setGeneratedBlog: (blog: string, seo?: { title: string; description: string; keywords: string[] }, review?: BlogReview) => void;
  setGenerationError: (error: string) => void;
  setBlogTraceId: (agentId: string, traceId: string) => void;
  setAgentOutput: (agentId: string, output: string) => void;
  setDebugMode: (enabled: boolean) => void;
  setTimelineStyle: (style: 'preview-bar' | 'timeline' | 'stepper') => void;
  setGenerateImages: (enabled: boolean) => void;
  setGenerateLinks: (enabled: boolean) => void;
  setSelectedTheme: (id: number | null) => void;
  setSelectedBrand: (slug: string | null) => void;
  rejectBrandVoice: () => void;
  resetGenerationForRetry: () => void;
  invalidateUrlDependentState: () => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as WizardStep,
  view: 'wizard' as AppView,
  storeUrl: '',
  isAnalyzing: false,
  analysisStatusLog: [] as string[],
  analysisComplete: false,
  analysisDebugData: [] as DebugEvent[],
  brandVoiceTraceId: null as string | null,
  brandVoice: null as BrandVoice | null,
  brandVoiceConfirmed: false,
  previousBrandVoice: null as BrandVoice | null,
  brandVoiceAttemptCount: 0,
  availableDresses: [] as Dress[],
  selectedDressIds: new Set<string>(),
  isDressesLoading: false,
  dressSearchQuery: '',
  dressCategory: '',
  dressPage: 1,
  dressTotalPages: 1,
  dressCategories: [] as string[],
  dressesMap: new Map<string, Dress>(),
  selectedThemeId: null as number | null,
  selectedBrandSlug: null as string | null,
  additionalInstructions: '',
  sessionId: null as string | null,
  generationAgent: '',
  generationAgentLabel: '',
  generationStep: 0,
  generationTotalSteps: 0,
  generationPipeline: [] as { id: string; label: string }[],
  generationChunks: '',
  generationError: null as string | null,
  generatedBlog: null as string | null,
  seoMetadata: null as { title: string; description: string; keywords: string[] } | null,
  review: null as BlogReview | null,
  blogTraceIds: {} as Record<string, string>,
  agentOutputs: {} as Record<string, string>,
  debugMode: false,
  timelineStyle: 'preview-bar' as const,
  generateImages: true,
  generateLinks: true,
};

// Custom storage adapter that handles Set/Map serialization
const customStorage = {
  getItem: (name: string) => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Deserialize Set and Map from JSON-safe formats
    if (parsed?.state) {
      if (Array.isArray(parsed.state.selectedDressIds)) {
        parsed.state.selectedDressIds = new Set(parsed.state.selectedDressIds);
      }
      if (Array.isArray(parsed.state.dressesMap)) {
        parsed.state.dressesMap = new Map(parsed.state.dressesMap);
      }
    }

    return parsed;
  },
  setItem: (name: string, value: unknown) => {
    const val = value as { state: Record<string, unknown> };
    const serializable = { ...val, state: { ...val.state } };

    // Serialize Set and Map to JSON-safe formats
    if (serializable.state.selectedDressIds instanceof Set) {
      serializable.state.selectedDressIds = [...serializable.state.selectedDressIds];
    }
    if (serializable.state.dressesMap instanceof Map) {
      serializable.state.dressesMap = [...serializable.state.dressesMap.entries()];
    }

    localStorage.setItem(name, JSON.stringify(serializable));
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),
      setView: (view) => set({ view }),
      setStoreUrl: (url) => set({ storeUrl: url }),
      setIsAnalyzing: (loading) => set({ isAnalyzing: loading }),
      appendStatusLog: (message) =>
        set((state) => ({ analysisStatusLog: [...state.analysisStatusLog, message] })),
      clearStatusLog: () => set({ analysisStatusLog: [], analysisComplete: false, analysisDebugData: [], brandVoiceTraceId: null }),
      setAnalysisComplete: (complete) => set({ analysisComplete: complete }),
      appendDebugData: (event) =>
        set((state) => ({ analysisDebugData: [...state.analysisDebugData, event] })),
      setBrandVoiceTraceId: (id) => set({ brandVoiceTraceId: id }),
      setBrandVoice: (bv) => set({ brandVoice: bv }),
      confirmBrandVoice: () => set({ brandVoiceConfirmed: true }),

      setAvailableDresses: (dresses) => set({ availableDresses: dresses }),
      toggleDress: (id) =>
        set((state) => {
          const next = new Set(state.selectedDressIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { selectedDressIds: next };
        }),
      setDressesLoading: (loading) => set({ isDressesLoading: loading }),
      setDressSearch: (query) => set({ dressSearchQuery: query }),
      setDressCategory: (category) => set({ dressCategory: category }),
      setDressPage: (page) => set({ dressPage: page }),
      setDressPagination: (totalPages) => set({ dressTotalPages: totalPages }),
      setDressCategories: (categories) => set({ dressCategories: categories }),
      addDressesToMap: (dresses) =>
        set((state) => {
          const next = new Map(state.dressesMap);
          for (const d of dresses) next.set(d.externalId, d);
          return { dressesMap: next };
        }),
      clearSelectedDresses: () => set({ selectedDressIds: new Set<string>() }),

      setAdditionalInstructions: (text) => set({ additionalInstructions: text }),
      setSessionId: (id) => set({ sessionId: id }),
      addPipelineAgent: (id, label) =>
        set((state) => {
          if (state.generationPipeline.some((a) => a.id === id)) return state;
          return { generationPipeline: [...state.generationPipeline, { id, label }] };
        }),
      updateGeneration: (agent, agentLabel, step, total) =>
        set({ generationAgent: agent, generationAgentLabel: agentLabel, generationStep: step, generationTotalSteps: total }),
      appendChunk: (chunk) => set((state) => ({ generationChunks: state.generationChunks + chunk })),
      clearChunks: () => set({ generationChunks: '' }),
      setGeneratedBlog: (blog, seo, review) =>
        set({ generatedBlog: blog, seoMetadata: seo ?? null, review: review ?? null }),
      setGenerationError: (error) => set({ generationError: error }),
      setBlogTraceId: (agentId, traceId) =>
        set((state) => ({ blogTraceIds: { ...state.blogTraceIds, [agentId]: traceId } })),
      setAgentOutput: (agentId, output) =>
        set((state) => ({ agentOutputs: { ...state.agentOutputs, [agentId]: output } })),
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      setTimelineStyle: (style) => set({ timelineStyle: style }),
      setGenerateImages: (enabled) => set({ generateImages: enabled }),
      setGenerateLinks: (enabled) => set({ generateLinks: enabled }),
      setSelectedTheme: (id) => set({ selectedThemeId: id }),
      setSelectedBrand: (slug) => set({ selectedBrandSlug: slug, selectedDressIds: new Set<string>() }),

      rejectBrandVoice: () =>
        set((state) => ({
          previousBrandVoice: state.brandVoice,
          brandVoice: null,
          brandVoiceConfirmed: false,
          analysisComplete: false,
          analysisStatusLog: [],
          analysisDebugData: [],
          brandVoiceTraceId: null,
          brandVoiceAttemptCount: state.brandVoiceAttemptCount + 1,
          currentStep: 1 as WizardStep,
        })),

      resetGenerationForRetry: () =>
        set({
          sessionId: null,
          generationAgent: '',
          generationAgentLabel: '',
          generationStep: 0,
          generationTotalSteps: 0,
          generationPipeline: [],
          generationChunks: '',
          generationError: null,
          generatedBlog: null,
          seoMetadata: null,
          review: null,
          blogTraceIds: {},
          agentOutputs: {},
        }),

      invalidateUrlDependentState: () =>
        set({
          analysisComplete: false,
          analysisStatusLog: [],
          analysisDebugData: [],
          brandVoiceTraceId: null,
          brandVoice: null,
          brandVoiceConfirmed: false,
          previousBrandVoice: null,
          brandVoiceAttemptCount: 0,
          sessionId: null,
          generatedBlog: null,
          seoMetadata: null,
          review: null,
          generationChunks: '',
          generationAgent: '',
          generationAgentLabel: '',
          generationStep: 0,
          generationTotalSteps: 0,
          generationPipeline: [],
          generationError: null,
          blogTraceIds: {},
          agentOutputs: {},
        }),

      reset: () => {
        // Clear persisted storage then reset state
        if (typeof window !== 'undefined') {
          localStorage.removeItem('blogwriter-wizard');
        }
        set({
          ...initialState,
          selectedDressIds: new Set<string>(),
          dressesMap: new Map<string, Dress>(),
          analysisStatusLog: [],
          analysisDebugData: [],
          blogTraceIds: {},
          agentOutputs: {},
        });
      },
    }),
    {
      name: 'blogwriter-wizard',
      storage: customStorage as any,
      partialize: (state) => ({
        currentStep: state.currentStep,
        view: state.view,
        storeUrl: state.storeUrl,
        analysisStatusLog: state.analysisStatusLog,
        analysisComplete: state.analysisComplete,
        analysisDebugData: state.analysisDebugData,
        brandVoiceTraceId: state.brandVoiceTraceId,
        brandVoice: state.brandVoice,
        brandVoiceConfirmed: state.brandVoiceConfirmed,
        previousBrandVoice: state.previousBrandVoice,
        brandVoiceAttemptCount: state.brandVoiceAttemptCount,
        selectedThemeId: state.selectedThemeId,
        selectedBrandSlug: state.selectedBrandSlug,
        selectedDressIds: state.selectedDressIds,
        dressesMap: state.dressesMap,
        additionalInstructions: state.additionalInstructions,
        sessionId: state.sessionId,
        generatedBlog: state.generatedBlog,
        seoMetadata: state.seoMetadata,
        review: state.review,
        blogTraceIds: state.blogTraceIds,
        agentOutputs: state.agentOutputs,
        generationPipeline: state.generationPipeline,
        debugMode: state.debugMode,
      }),
    },
  ),
);
