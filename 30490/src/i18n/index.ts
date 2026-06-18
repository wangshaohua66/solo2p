import type { Language } from '@/types';
import zhCN from './zh-CN';
import enUS from './en-US';

export const translations = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export type TranslationKeys = typeof zhCN;

export type NestedKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? NestedKeys<T[K], `${Prefix}${Extract<K, string>}.`>
    : `${Prefix}${Extract<K, string>}`;
}[keyof T];

export type I18nKey = NestedKeys<TranslationKeys>;

const getNestedValue = (obj: Record<string, unknown>, path: string): string | undefined => {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
};

export const translate = (
  language: Language,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const langObj = translations[language];
  if (!langObj) {
    console.warn(`Language ${language} not found`);
    return key;
  }

  let value = getNestedValue(langObj as unknown as Record<string, unknown>, key);

  if (value === undefined) {
    console.warn(`Translation key not found: ${key}`);
    value = key;
  }

  if (params && typeof value === 'string') {
    value = value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() || `{${paramKey}}`;
    });
  }

  return value as string;
};

export const getDefaultLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  const stored = localStorage.getItem('language') as Language | null;
  if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
    return stored;
  }

  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US';
};

export const saveLanguage = (language: Language): void => {
  localStorage.setItem('language', language);
};

export const getEnumTranslation = (
  language: Language,
  enumType: string,
  value: string | null,
): string => {
  if (!value) return '-';
  const key = `${enumType}.${value}`;
  const translated = translate(language, key);
  return translated === key ? value : translated;
};
