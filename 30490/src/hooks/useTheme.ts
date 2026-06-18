import { useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import type { Theme } from '@/types';

export interface UseThemeReturn {
  theme: Theme;
  isDark: boolean;
  isLight: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  waveColors: {
    wave: string;
    waveProgress: string;
    centerLine: string;
  };
}

export function useTheme(): UseThemeReturn {
  const theme = useSettingsStore((state) => state.theme);
  const waveColors = useSettingsStore((state) => state.waveColors);
  const setTheme = useSettingsStore((state) => state.actions.setTheme);
  const toggleTheme = useSettingsStore((state) => state.actions.toggleTheme);

  const isDark = useMemo(() => theme === 'dark', [theme]);
  const isLight = useMemo(() => theme === 'light', [theme]);

  const setThemeCallback = useCallback(
    (t: Theme) => {
      setTheme(t);
    },
    [setTheme],
  );

  const toggleThemeCallback = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  return {
    theme,
    isDark,
    isLight,
    setTheme: setThemeCallback,
    toggleTheme: toggleThemeCallback,
    waveColors,
  };
}
