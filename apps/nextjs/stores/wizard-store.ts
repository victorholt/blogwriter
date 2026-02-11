import { create } from 'zustand';
import type { BrandVoice, BlogReview, Dress, WizardStep, AppView } from '@/types';

interface WizardState {
  // Navigation
  currentStep: WizardStep;
  view: AppView;

  // Step 1: Store Info
  storeUrl: string;
  isAnalyzing: boolean;

  // Step 2: Brand Voice
  brandVoice: BrandVoice | null;
  brandVoiceConfirmed: boolean;

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

  // Result
  generatedBlog: string | null;
  seoMetadata: { title: string; description: string; keywords: string[] } | null;
  review: BlogReview | null;
  generationChunks: string;
  generationAgentLabel: string;
  generationError: string | null;

  // Actions
  setStep: (step: WizardStep) => void;
  setView: (view: AppView) => void;
  setStoreUrl: (url: string) => void;
  setIsAnalyzing: (loading: boolean) => void;
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
  updateGeneration: (agent: string, agentLabel: string, step: number, total: number) => void;
  appendChunk: (chunk: string) => void;
  clearChunks: () => void;
  setGeneratedBlog: (blog: string, seo?: { title: string; description: string; keywords: string[] }, review?: BlogReview) => void;
  setGenerationError: (error: string) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as WizardStep,
  view: 'wizard' as AppView,
  storeUrl: '',
  isAnalyzing: false,
  brandVoice: null,
  brandVoiceConfirmed: false,
  availableDresses: [],
  selectedDressIds: new Set<string>(),
  isDressesLoading: false,
  dressSearchQuery: '',
  dressCategory: '',
  dressPage: 1,
  dressTotalPages: 1,
  dressCategories: [] as string[],
  dressesMap: new Map<string, Dress>(),
  additionalInstructions: '',
  sessionId: null,
  generationAgent: '',
  generationAgentLabel: '',
  generationStep: 0,
  generationTotalSteps: 0,
  generationChunks: '',
  generationError: null,
  generatedBlog: null,
  seoMetadata: null,
  review: null,
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setView: (view) => set({ view }),
  setStoreUrl: (url) => set({ storeUrl: url }),
  setIsAnalyzing: (loading) => set({ isAnalyzing: loading }),
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
  updateGeneration: (agent, agentLabel, step, total) =>
    set({ generationAgent: agent, generationAgentLabel: agentLabel, generationStep: step, generationTotalSteps: total }),
  appendChunk: (chunk) => set((state) => ({ generationChunks: state.generationChunks + chunk })),
  clearChunks: () => set({ generationChunks: '' }),
  setGeneratedBlog: (blog, seo, review) =>
    set({ generatedBlog: blog, seoMetadata: seo ?? null, review: review ?? null }),
  setGenerationError: (error) => set({ generationError: error }),

  reset: () => set({ ...initialState, selectedDressIds: new Set<string>(), dressesMap: new Map<string, Dress>() }),
}));
