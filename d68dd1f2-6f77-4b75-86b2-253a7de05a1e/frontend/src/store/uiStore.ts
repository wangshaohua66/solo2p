import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { theme as antdTheme } from 'antd';

type ThemeMode = 'light' | 'dark';

interface UIState {
  themeMode: ThemeMode;
  sidebarCollapsed: boolean;
  language: 'zh-CN' | 'en-US';
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  getAntdAlgorithm: () => any;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      sidebarCollapsed: false,
      language: 'zh-CN',

      setThemeMode: (mode) => set({ themeMode: mode }),

      toggleTheme: () =>
        set((state) => ({
          themeMode: state.themeMode === 'light' ? 'dark' : 'light'
        })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      getAntdAlgorithm: () => {
        return get().themeMode === 'dark'
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm;
      }
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        sidebarCollapsed: state.sidebarCollapsed,
        language: state.language
      })
    }
  )
);
