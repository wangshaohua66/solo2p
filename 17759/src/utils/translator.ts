import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from './logger';

dotenv.config();

const logger = createLogger('translator');

export type TargetLanguage = 'en' | 'es' | 'pt' | 'id';

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: TargetLanguage;
  truncated: boolean;
  originalLength: number;
  translatedLength: number;
}

export interface PlatformLengthLimits {
  amazon: { title: number; description: number };
  ebay: { title: number; description: number };
  shopee: { title: number; description: number };
  lazada: { title: number; description: number };
  tiktok: { title: number; description: number };
}

export const PLATFORM_LENGTH_LIMITS: PlatformLengthLimits = {
  amazon: { title: 200, description: 2000 },
  ebay: { title: 80, description: 5000 },
  shopee: { title: 60, description: 3000 },
  lazada: { title: 60, description: 3000 },
  tiktok: { title: 30, description: 500 }
};

export const LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  id: 'Indonesian'
};

class Translator {
  private apiKey: string;
  private service: string;
  private cache: Map<string, TranslationResult> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.apiKey = process.env.TRANSLATION_API_KEY || '';
    this.service = process.env.TRANSLATION_SERVICE || 'mock';
    
    if (!this.apiKey && this.service !== 'mock') {
      logger.warn('No translation API key configured, using mock translations');
      this.service = 'mock';
    }
  }

  async translate(
    text: string,
    targetLang: TargetLanguage,
    sourceLang = 'auto'
  ): Promise<TranslationResult> {
    const cacheKey = `${sourceLang}:${targetLang}:${text}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      this.cacheHits++;
      logger.debug(`Cache hit for translation`, { targetLang, length: text.length });
      return cached;
    }

    this.cacheMisses++;
    logger.debug(`Translating text`, { targetLang, length: text.length, sourceLang });

    let result: TranslationResult;
    
    if (this.service === 'google') {
      result = await this.translateWithGoogle(text, targetLang, sourceLang);
    } else if (this.service === 'deepl') {
      result = await this.translateWithDeepL(text, targetLang, sourceLang);
    } else {
      result = this.mockTranslate(text, targetLang, sourceLang);
    }

    this.cache.set(cacheKey, result);
    
    if (this.cache.size > 10000) {
      this.cleanupCache();
    }

    return result;
  }

  async translateWithPlatformLimit(
    text: string,
    targetLang: TargetLanguage,
    platform: keyof PlatformLengthLimits,
    field: 'title' | 'description',
    sourceLang = 'auto'
  ): Promise<TranslationResult> {
    const limit = PLATFORM_LENGTH_LIMITS[platform][field];
    const result = await this.translate(text, targetLang, sourceLang);
    
    if (result.translated.length > limit) {
      const truncated = this.truncateSmart(result.translated, limit);
      result.translated = truncated;
      result.truncated = true;
      result.translatedLength = truncated.length;
      
      logger.debug(`Translation truncated for ${platform} ${field}`, {
        original: result.originalLength,
        translated: result.translatedLength,
        limit
      });
    }

    return result;
  }

  async translateAndTruncate(
    text: string,
    targetLang: TargetLanguage,
    field: 'title' | 'description',
    platform: keyof PlatformLengthLimits,
    sourceLang = 'en'
  ): Promise<string> {
    if (targetLang === sourceLang) {
      const limit = PLATFORM_LENGTH_LIMITS[platform][field];
      return this.truncateSmart(text, limit);
    }
    
    const result = await this.translateWithPlatformLimit(
      text,
      targetLang,
      platform,
      field,
      sourceLang
    );
    
    return result.translated;
  }

  async translateMulti(
    text: string,
    targetLangs: TargetLanguage[],
    sourceLang = 'auto'
  ): Promise<Record<TargetLanguage, TranslationResult>> {
    const results = {} as Record<TargetLanguage, TranslationResult>;
    
    for (const lang of targetLangs) {
      results[lang] = await this.translate(text, lang, sourceLang);
    }
    
    return results;
  }

  async translateSkuTexts(
    title: string,
    description: string,
    platform: keyof PlatformLengthLimits,
    locales: TargetLanguage[] = ['en', 'es', 'pt', 'id'],
    sourceLang = 'en'
  ): Promise<{
    title: Record<TargetLanguage, string>;
    description: Record<TargetLanguage, string>;
  }> {
    const translatedTitles = {} as Record<TargetLanguage, string>;
    const translatedDescriptions = {} as Record<TargetLanguage, string>;

    for (const lang of locales) {
      if (lang === sourceLang) {
        const titleResult = this.truncateSmart(title, PLATFORM_LENGTH_LIMITS[platform].title);
        const descResult = this.truncateSmart(description, PLATFORM_LENGTH_LIMITS[platform].description);
        
        translatedTitles[lang] = titleResult;
        translatedDescriptions[lang] = descResult;
      } else {
        const [titleResult, descResult] = await Promise.all([
          this.translateWithPlatformLimit(title, lang, platform, 'title', sourceLang),
          this.translateWithPlatformLimit(description, lang, platform, 'description', sourceLang)
        ]);
        
        translatedTitles[lang] = titleResult.translated;
        translatedDescriptions[lang] = descResult.translated;
      }
    }

    return {
      title: translatedTitles,
      description: translatedDescriptions
    };
  }

  private async translateWithGoogle(
    text: string,
    targetLang: TargetLanguage,
    sourceLang: string
  ): Promise<TranslationResult> {
    try {
      const response = await axios.post(
        'https://translation.googleapis.com/language/translate/v2',
        {
          q: text,
          target: targetLang,
          source: sourceLang === 'auto' ? undefined : sourceLang,
          format: 'text'
        },
        {
          params: { key: this.apiKey },
          timeout: 10000
        }
      );

      const translation = response.data.data.translations[0];
      
      return {
        original: text,
        translated: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage || sourceLang,
        targetLang,
        truncated: false,
        originalLength: text.length,
        translatedLength: translation.translatedText.length
      };
    } catch (error) {
      logger.error('Google translation API failed', error);
      return this.mockTranslate(text, targetLang, sourceLang);
    }
  }

  private async translateWithDeepL(
    text: string,
    targetLang: TargetLanguage,
    sourceLang: string
  ): Promise<TranslationResult> {
    const deeplLangMap: Record<TargetLanguage, string> = {
      en: 'EN',
      es: 'ES',
      pt: 'PT',
      id: 'ID'
    };

    try {
      const response = await axios.post(
        'https://api-free.deepl.com/v2/translate',
        {
          text: [text],
          target_lang: deeplLangMap[targetLang],
          source_lang: sourceLang === 'auto' ? undefined : sourceLang.toUpperCase()
        },
        {
          headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` },
          timeout: 10000
        }
      );

      const translation = response.data.translations[0];
      
      return {
        original: text,
        translated: translation.text,
        sourceLang: translation.detected_source_language?.toLowerCase() || sourceLang,
        targetLang,
        truncated: false,
        originalLength: text.length,
        translatedLength: translation.text.length
      };
    } catch (error) {
      logger.error('DeepL translation API failed', error);
      return this.mockTranslate(text, targetLang, sourceLang);
    }
  }

  private mockTranslate(
    text: string,
    targetLang: TargetLanguage,
    sourceLang: string
  ): TranslationResult {
    const suffixMap: Record<TargetLanguage, string> = {
      en: '',
      es: ' [ES]',
      pt: ' [PT]',
      id: ' [ID]'
    };

    const translated = text + suffixMap[targetLang];
    const detectedLang = sourceLang === 'auto' ? 'en' : sourceLang;

    logger.debug('Using mock translation', { targetLang });

    return {
      original: text,
      translated,
      sourceLang: detectedLang,
      targetLang,
      truncated: false,
      originalLength: text.length,
      translatedLength: translated.length
    };
  }

  private truncateSmart(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const sentenceEndRegex = /[.!?。！？]/;
    const commaRegex = /[,，;；]/;
    
    let truncateAt = maxLength;
    
    for (let i = maxLength; i > Math.floor(maxLength * 0.7); i--) {
      if (sentenceEndRegex.test(text[i])) {
        truncateAt = i + 1;
        break;
      }
    }
    
    if (truncateAt === maxLength) {
      for (let i = maxLength; i > Math.floor(maxLength * 0.7); i--) {
        if (commaRegex.test(text[i])) {
          truncateAt = i + 1;
          break;
        }
      }
    }
    
    if (truncateAt === maxLength) {
      for (let i = maxLength; i > Math.floor(maxLength * 0.7); i--) {
        if (text[i] === ' ') {
          truncateAt = i;
          break;
        }
      }
    }

    return text.substring(0, truncateAt).trim() + '...';
  }

  private cleanupCache(): void {
    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, 1000);
    
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
    
    logger.debug(`Cleaned translation cache, removed ${toRemove.length} entries`);
  }

  getStats(): { cacheHits: number; cacheMisses: number; cacheSize: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheSize: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('Translation cache cleared');
  }
}

export const translator = new Translator();

export default Translator;
