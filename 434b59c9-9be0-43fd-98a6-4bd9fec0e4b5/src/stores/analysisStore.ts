import { create } from 'zustand';
import type {
  SequenceData,
  Viewport,
  Selection,
  Mutation,
  Primer,
  QualityData,
  Annotation,
  ActiveTab,
  PrimerConfigParams,
} from '@/types';
import { generateId } from '@/utils/storage';

interface AnalysisState {
  currentSequence: SequenceData | null;
  viewMode: 'nucleotide' | 'aminoacid';
  viewport: Viewport;
  selection: Selection | null;
  mutations: Mutation[];
  primers: Primer[];
  qualityData: QualityData | null;
  annotations: Annotation[];
  activeTab: ActiveTab;
  primerConfig: PrimerConfigParams;
  qualityThreshold: number;
  searchQuery: string;
  searchResults: number[];
  
  setSequence: (seq: SequenceData | null) => void;
  setViewMode: (mode: 'nucleotide' | 'aminoacid') => void;
  setViewport: (vp: Partial<Viewport>) => void;
  setSelection: (sel: Selection | null) => void;
  addMutation: (m: Omit<Mutation, 'id'>) => void;
  updateMutation: (id: string, patch: Partial<Mutation>) => void;
  removeMutation: (id: string) => void;
  setMutations: (mutations: Mutation[]) => void;
  addPrimer: (p: Omit<Primer, 'id'>) => void;
  updatePrimer: (id: string, patch: Partial<Primer>) => void;
  removePrimer: (id: string) => void;
  deletePrimer: (id: string) => void;
  setPrimers: (primers: Primer[]) => void;
  setQualityData: (data: QualityData | null) => void;
  addAnnotation: (a: Omit<Annotation, 'id'>) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setPrimerConfig: (config: Partial<PrimerConfigParams>) => void;
  setQualityThreshold: (threshold: number) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: number[]) => void;
  resetAnalysis: () => void;
}

const defaultPrimerConfig: PrimerConfigParams = {
  productSizeMin: 100,
  productSizeMax: 500,
  tmMin: 55,
  tmMax: 65,
  gcMin: 40,
  gcMax: 60,
  primerLengthMin: 18,
  primerLengthMax: 25,
  qualityThreshold: 20,
  checkHairpin: true,
  checkDimer: true,
  checkThreePrimeSpecificity: true,
  naConcentration: 50,
  primerConcentration: 200,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  currentSequence: null,
  viewMode: 'nucleotide',
  viewport: { start: 0, end: 100, zoom: 1, offset: 0 },
  selection: null,
  mutations: [],
  primers: [],
  qualityData: null,
  annotations: [],
  activeTab: 'sequence',
  primerConfig: defaultPrimerConfig,
  qualityThreshold: 20,
  searchQuery: '',
  searchResults: [],

  setSequence: (seq) => {
    if (seq) {
      set({
        currentSequence: seq,
        viewport: { start: 0, end: Math.min(seq.length, 200), zoom: 1, offset: 0 },
      });
    } else {
      set({ currentSequence: null });
    }
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setViewport: (vp) => set((state) => ({ viewport: { ...state.viewport, ...vp } })),
  setSelection: (sel) => set({ selection: sel }),
  addMutation: (m) =>
    set((state) => ({ mutations: [...state.mutations, { ...m, id: generateId('mut_') }] })),
  updateMutation: (id, patch) =>
    set((state) => ({
      mutations: state.mutations.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMutation: (id) =>
    set((state) => ({ mutations: state.mutations.filter((m) => m.id !== id) })),
  setMutations: (mutations) => set({ mutations }),
  addPrimer: (p) =>
    set((state) => ({ primers: [...state.primers, { ...p, id: generateId('primer_') }] })),
  updatePrimer: (id, patch) =>
    set((state) => ({
      primers: state.primers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removePrimer: (id) =>
    set((state) => ({ primers: state.primers.filter((p) => p.id !== id) })),
  deletePrimer: (id) =>
    set((state) => ({ primers: state.primers.filter((p) => p.id !== id) })),
  setPrimers: (primers) => set({ primers }),
  setQualityData: (data) => set({ qualityData: data }),
  addAnnotation: (a) =>
    set((state) => ({ annotations: [...state.annotations, { ...a, id: generateId('ann_') }] })),
  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: state.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  removeAnnotation: (id) =>
    set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) })),
  setAnnotations: (annotations) => set({ annotations }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPrimerConfig: (config) =>
    set((state) => ({ primerConfig: { ...state.primerConfig, ...config } })),
  setQualityThreshold: (threshold) => set({ qualityThreshold: threshold }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  resetAnalysis: () =>
    set({
      currentSequence: null,
      viewport: { start: 0, end: 100, zoom: 1, offset: 0 },
      selection: null,
      mutations: [],
      primers: [],
      qualityData: null,
      annotations: [],
      searchQuery: '',
      searchResults: [],
    }),
}));
