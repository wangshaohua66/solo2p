import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Stratum, Artifact, ArtifactFormData, SearchFilters } from '@/types';
import { loadFromStorage, saveToStorage } from '@/utils/storage';
import { validateArtifact, validateStratum } from '@/validation/schemas';

interface ArtifactState {
  strata: Stratum[];
  artifacts: Artifact[];
  selectedStratumId: string | null;
  searchFilters: SearchFilters;
  isLoading: boolean;
  setSelectedStratum: (stratumId: string | null) => void;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  addStratum: (stratum: Omit<Stratum, 'id'>) => void;
  updateStratum: (stratumId: string, updates: Partial<Stratum>) => void;
  deleteStratum: (stratumId: string) => void;
  getStrataByGrid: (gridId: string) => Stratum[];
  getStratumById: (stratumId: string) => Stratum | undefined;
  addArtifact: (artifactData: ArtifactFormData & { gridId: string; stratumId: string; siteId: string }) => Artifact | null;
  updateArtifact: (artifactId: string, updates: Partial<Artifact>) => void;
  deleteArtifact: (artifactId: string) => void;
  getArtifactsByStratum: (stratumId: string) => Artifact[];
  getArtifactsByGrid: (gridId: string) => Artifact[];
  getArtifactsBySite: (siteId: string) => Artifact[];
  searchArtifacts: (filters: SearchFilters) => Artifact[];
  getArtifactById: (artifactId: string) => Artifact | undefined;
  getArtifactsStats: () => {
    total: number;
    byCategory: { category: string; count: number }[];
    byPeriod: { period: string; count: number }[];
    bySite: { siteId: string; count: number }[];
    byCondition: Record<string, number>;
    goodCondition: number;
  };
  hydrateFromPersisted: (data: { strata: Stratum[]; artifacts: Artifact[] }) => void;
  hydrate: () => void;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      strata: [],
      artifacts: [],
      selectedStratumId: null,
      searchFilters: {},
      isLoading: false,

      setSelectedStratum: (stratumId) => set({ selectedStratumId: stratumId }),

      setSearchFilters: (filters) => set((state) => ({ searchFilters: { ...state.searchFilters, ...filters } })),

      addStratum: (stratumData) => {
        const validation = validateStratum(stratumData);
        if (!validation.success) {
          console.error('Stratum validation failed:', validation.error);
          return;
        }
        const newStratum: Stratum = {
          ...stratumData,
          id: `stratum_${Date.now()}`,
        };
        set((state) => ({
          strata: [...state.strata, newStratum],
        }));
      },

      updateStratum: (stratumId, updates) => {
        set((state) => ({
          strata: state.strata.map((s) =>
            s.id === stratumId ? { ...s, ...updates } : s
          ),
        }));
      },

      deleteStratum: (stratumId) => {
        set((state) => ({
          strata: state.strata.filter((s) => s.id !== stratumId),
          artifacts: state.artifacts.filter((a) => a.stratumId !== stratumId),
          selectedStratumId: state.selectedStratumId === stratumId ? null : state.selectedStratumId,
        }));
      },

      getStrataByGrid: (gridId) => {
        return get().strata
          .filter((s) => s.gridId === gridId)
          .sort((a, b) => a.layerIndex - b.layerIndex);
      },

      getStratumById: (stratumId) => {
        return get().strata.find((s) => s.id === stratumId);
      },

      addArtifact: (artifactData) => {
        const validation = validateArtifact(artifactData);
        if (!validation.success) {
          console.error('Artifact validation failed:', validation.error);
          return null;
        }
        const now = new Date().toISOString();
        const newArtifact: Artifact = {
          ...artifactData,
          subcategory: artifactData.subcategory || '',
          period: artifactData.period || '',
          notes: artifactData.notes || '',
          id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          artifacts: [...state.artifacts, newArtifact],
        }));
        return newArtifact;
      },

      updateArtifact: (artifactId, updates) => {
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === artifactId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          ),
        }));
      },

      deleteArtifact: (artifactId) => {
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.id !== artifactId),
        }));
      },

      getArtifactsByStratum: (stratumId) => {
        return get().artifacts.filter((a) => a.stratumId === stratumId);
      },

      getArtifactsByGrid: (gridId) => {
        return get().artifacts.filter((a) => a.gridId === gridId);
      },

      getArtifactsBySite: (siteId) => {
        return get().artifacts.filter((a) => a.siteId === siteId);
      },

      searchArtifacts: (filters) => {
        const { keyword, category, period, siteId, condition, startDate, endDate } = filters;
        return get().artifacts.filter((a) => {
          if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            if (
              !a.name.toLowerCase().includes(lowerKeyword) &&
              !a.notes.toLowerCase().includes(lowerKeyword)
            ) {
              return false;
            }
          }
          if (category && a.category !== category) {
            return false;
          }
          if (period && a.period !== period) {
            return false;
          }
          if (siteId && a.siteId !== siteId) {
            return false;
          }
          if (condition && a.condition !== condition) {
            return false;
          }
          if (startDate && new Date(a.createdAt) < new Date(startDate)) {
            return false;
          }
          if (endDate && new Date(a.createdAt) > new Date(endDate)) {
            return false;
          }
          return true;
        });
      },

      getArtifactById: (artifactId) => {
        return get().artifacts.find((a) => a.id === artifactId);
      },

      getArtifactsStats: () => {
        const artifacts = get().artifacts;
        const byCategory: { category: string; count: number }[] = [];
        const byPeriod: { period: string; count: number }[] = [];
        const bySite: { siteId: string; count: number }[] = [];
        const byCondition: Record<string, number> = {};
        const categoryMap: Record<string, number> = {};
        const periodMap: Record<string, number> = {};
        const siteMap: Record<string, number> = {};
        let goodCondition = 0;

        artifacts.forEach((a) => {
          categoryMap[a.category] = (categoryMap[a.category] || 0) + a.quantity;
          periodMap[a.period || '未标注'] = (periodMap[a.period || '未标注'] || 0) + a.quantity;
          siteMap[a.siteId] = (siteMap[a.siteId] || 0) + a.quantity;
          byCondition[a.condition] = (byCondition[a.condition] || 0) + a.quantity;
          if (a.condition === '完好') {
            goodCondition += a.quantity;
          }
        });

        Object.entries(categoryMap).forEach(([category, count]) => {
          byCategory.push({ category, count });
        });
        Object.entries(periodMap).forEach(([period, count]) => {
          byPeriod.push({ period, count });
        });
        Object.entries(siteMap).forEach(([siteId, count]) => {
          bySite.push({ siteId, count });
        });

        return {
          total: artifacts.reduce((sum, a) => sum + a.quantity, 0),
          byCategory,
          byPeriod,
          bySite,
          byCondition,
          goodCondition,
        };
      },

      hydrateFromPersisted: (data) => {
        set({
          strata: data.strata,
          artifacts: data.artifacts,
        });
      },

      hydrate: () => {
        const data = loadFromStorage();
        if (data.strata && data.artifacts) {
          set({
            strata: data.strata,
            artifacts: data.artifacts,
          });
        }
      },
    }),
    {
      name: 'artifact-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        strata: state.strata,
        artifacts: state.artifacts,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          saveToStorage({
            strata: state.strata,
            artifacts: state.artifacts,
          });
        }
      },
    },
  ),
);
