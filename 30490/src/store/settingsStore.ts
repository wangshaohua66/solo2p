import { create } from 'zustand';
import type { Theme, Language } from '@/types';
import { getDefaultLanguage, saveLanguage } from '@/i18n';
import { logOperation } from '@/db/operations/logOperations';

interface SettingsState {
  theme: Theme;
  language: Language;
  sidebarCollapsed: boolean;
  waveColors: {
    wave: string;
    waveProgress: string;
    centerLine: string;
  };
  actions: {
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    setLanguage: (language: Language) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
  };
}

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const saveTheme = (theme: Theme): void => {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: getStoredTheme(),
  language: getDefaultLanguage(),
  sidebarCollapsed: false,
  waveColors: {
    wave: '#3B82F6',
    waveProgress: '#60A5FA',
    centerLine: 'rgba(255, 255, 255, 0.1)',
  },
  actions: {
    setTheme: (theme: Theme) => {
      saveTheme(theme);
      set({ theme });
      logOperation('theme_change', 'setting', null, { theme });
    },
    toggleTheme: () => {
      const newTheme = get().theme === 'dark' ? 'light' : 'dark';
      get().actions.setTheme(newTheme);
    },
    setLanguage: (language: Language) => {
      saveLanguage(language);
      set({ language });
      logOperation('language_change', 'setting', null, { language });
    },
    toggleSidebar: () => {
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
    },
    setSidebarCollapsed: (collapsed: boolean) => {
      set({ sidebarCollapsed: collapsed });
    },
  },
}));

if (typeof window !== 'undefined') {
  saveTheme(useSettingsStore.getState().theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      useSettingsStore.getState().actions.setTheme(e.matches ? 'dark' : 'light');
    }
  });
}
