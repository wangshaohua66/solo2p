import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Site, Grid, User, AppState } from '@/types';
import { generateGridsForSite, splitGrid, mergeGrids } from '@/utils/coordinate';
import { loadFromStorage, saveToStorage } from '@/utils/storage';

interface SiteState {
  sites: Site[];
  grids: Grid[];
  users: User[];
  currentSiteId: string | null;
  selectedGridId: string | null;
  currentUser: User | null;
  currentSite: Site | null;
  isLoading: boolean;
  setCurrentSite: (siteId: string | null) => void;
  setSelectedGrid: (gridId: string | null) => void;
  addSite: (site: Omit<Site, 'id' | 'status'>) => void;
  updateSite: (siteId: string, updates: Partial<Site>) => void;
  deleteSite: (siteId: string) => void;
  getGridsBySite: (siteId: string) => Grid[];
  getSiteById: (siteId: string) => Site | undefined;
  getGridById: (gridId: string) => Grid | undefined;
  updateGridStatus: (gridId: string, status: Grid['status']) => void;
  splitGridById: (gridId: string) => void;
  mergeGridsByIds: (gridIds: string[]) => void;
  updateGridArtifactCount: (gridId: string, delta: number) => void;
  initializeFromStorage: () => void;
  hydrateFromPersisted: (data: { sites: Site[]; grids: Grid[]; users: User[] }) => void;
  hydrate: () => void;
}

const initialUsers: User[] = [
  { id: 'user_1', name: '张教授', role: 'manager' },
  { id: 'user_2', name: '李考古', role: 'recorder' },
  { id: 'user_3', name: '王研究', role: 'researcher' },
  { id: 'user_4', name: '赵记录', role: 'recorder' },
];

export const useSiteStore = create<SiteState>()(
  persist(
    (set, get) => ({
      sites: [],
      grids: [],
      users: initialUsers,
      currentSiteId: null,
      selectedGridId: null,
      currentUser: initialUsers[0],
      get currentSite() {
        const state = get();
        return state.sites.find((s) => s.id === state.currentSiteId) || null;
      },
      isLoading: false,

      setCurrentSite: (siteId) => set({ currentSiteId: siteId, selectedGridId: null }),

      setSelectedGrid: (gridId) => set({ selectedGridId: gridId }),

      addSite: (siteData) => {
        const newSite: Site = {
          ...siteData,
          id: `site_${Date.now()}`,
          status: 'planning',
        };
        const newGrids = generateGridsForSite(newSite.id, newSite.gridRows, newSite.gridCols, '');
        set((state) => ({
          sites: [...state.sites, newSite],
          grids: [...state.grids, ...newGrids],
        }));
      },

      updateSite: (siteId, updates) => {
        set((state) => ({
          sites: state.sites.map((s) => (s.id === siteId ? { ...s, ...updates } : s)),
        }));
      },

      deleteSite: (siteId) => {
        set((state) => ({
          sites: state.sites.filter((s) => s.id !== siteId),
          grids: state.grids.filter((g) => g.siteId !== siteId),
          currentSiteId: state.currentSiteId === siteId ? null : state.currentSiteId,
          selectedGridId: null,
        }));
      },

      getGridsBySite: (siteId) => {
        return get().grids.filter((g) => g.siteId === siteId);
      },

      getSiteById: (siteId) => {
        return get().sites.find((s) => s.id === siteId);
      },

      getGridById: (gridId) => {
        return get().grids.find((g) => g.id === gridId);
      },

      updateGridStatus: (gridId, status) => {
        set((state) => ({
          grids: state.grids.map((g) => (g.id === gridId ? { ...g, status } : g)),
        }));
      },

      splitGridById: (gridId) => {
        const grid = get().getGridById(gridId);
        if (!grid) return;
        const splitGrids = splitGrid(grid);
        set((state) => ({
          grids: [...state.grids.filter((g) => g.id !== gridId), ...splitGrids],
          selectedGridId: splitGrids[0]?.id || null,
        }));
      },

      mergeGridsByIds: (gridIds) => {
        const gridsToMerge = get().grids.filter((g) => gridIds.includes(g.id));
        const merged = mergeGrids(gridsToMerge);
        if (!merged) return;
        set((state) => ({
          grids: [...state.grids.filter((g) => !gridIds.includes(g.id)), merged],
          selectedGridId: merged.id,
        }));
      },

      updateGridArtifactCount: (gridId, delta) => {
        set((state) => ({
          grids: state.grids.map((g) =>
            g.id === gridId ? { ...g, artifactCount: Math.max(0, g.artifactCount + delta) } : g
          ),
        }));
      },

      initializeFromStorage: () => {
        const data = loadFromStorage();
        if (data.sites && data.grids) {
          set({
            sites: data.sites,
            grids: data.grids,
            users: data.users || initialUsers,
          });
        }
      },

      hydrateFromPersisted: (data) => {
        set({
          sites: data.sites,
          grids: data.grids,
          users: data.users || initialUsers,
        });
      },

      hydrate: () => {
        const data = loadFromStorage() as Partial<AppState>;
        if (data.sites && data.grids) {
          set({
            sites: data.sites,
            grids: data.grids,
            users: data.users || initialUsers,
            currentSiteId: data.currentSiteId || null,
            selectedGridId: data.selectedGridId || null,
          });
        }
      },
    }),
    {
      name: 'site-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sites: state.sites,
        grids: state.grids,
        users: state.users,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          saveToStorage({
            sites: state.sites,
            grids: state.grids,
            users: state.users,
          });
        }
      },
    },
  ),
);
