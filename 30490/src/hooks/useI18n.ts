import { useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { translate, getEnumTranslation } from '@/i18n';
import type { Language } from '@/types';

export interface UseI18nReturn {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getEnum: (enumType: string, value: string | null) => string;
}

export function useI18n(): UseI18nReturn {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.actions.setLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(language, key, params);
    },
    [language],
  );

  const getEnum = useCallback(
    (enumType: string, value: string | null) => {
      return getEnumTranslation(language, enumType, value);
    },
    [language],
  );

  const setLanguageCallback = useCallback(
    (lang: Language) => {
      setLanguage(lang);
    },
    [setLanguage],
  );

  return useMemo(
    () => ({
      language,
      setLanguage: setLanguageCallback,
      t,
      getEnum,
    }),
    [language, setLanguageCallback, t, getEnum],
  );
}
