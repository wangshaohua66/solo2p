import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!__dirname || typeof __dirname !== 'string' || __dirname.trim() === '') {
  throw new Error('无法确定当前目录路径 __dirname');
}

function safeJoin(...parts) {
  const validParts = parts.filter(p => p != null && typeof p === 'string' && p.trim() !== '');
  if (validParts.length === 0) {
    throw new Error('路径拼接失败：所有路径段均为空或无效');
  }
  return path.join(...validParts);
}

const keywordsPath = safeJoin(__dirname, '..', 'data', 'keywords.json');

class KeywordMatcher {
  constructor() {
    this.keywordsConfig = null;
    this.flatKeywords = [];
    this.excludeKeywords = [];
    this.threshold = 60;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await this.loadConfig();
    this.initialized = true;
  }

  async loadConfig() {
    try {
      const config = await fs.readJson(keywordsPath);
      this.keywordsConfig = config;
      this.threshold = config.threshold || 60;
      this.excludeKeywords = config.excludeKeywords || [];
      this.flattenKeywords(config.categories || []);
      logger.info(`关键词配置加载完成, 共 ${this.flatKeywords.length} 个关键词, ${this.excludeKeywords.length} 个排除词`);
    } catch (error) {
      logger.error(`加载关键词配置失败: ${error.message}`);
      throw error;
    }
  }

  flattenKeywords(categories) {
    this.flatKeywords = [];

    for (const category of categories) {
      const categoryWeight = category.weight || 1.0;
      const categoryName = category.name || '未分类';

      for (const kw of category.keywords || []) {
        this.flatKeywords.push({
          word: kw.word,
          weight: kw.weight || 1,
          category: categoryName,
          categoryWeight
        });
      }
    }
  }

  match(announcement) {
    const title = announcement.title || '';
    const content = announcement.content || '';
    const qualification = announcement.qualification || '';
    const fullText = `${title}\n${content}\n${qualification}`;

    const result = {
      score: 0,
      matchedKeywords: [],
      matchedCategories: [],
      excluded: false,
      excludeReason: '',
      isMatched: false
    };

    for (const excludeWord of this.excludeKeywords) {
      if (title.includes(excludeWord)) {
        result.excluded = true;
        result.excludeReason = `标题包含排除词: ${excludeWord}`;
        return result;
      }
    }

    const categoryScores = {};

    for (const kw of this.flatKeywords) {
      let count = 0;
      const regex = new RegExp(kw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      const titleMatches = title.match(regex);
      if (titleMatches) {
        count += titleMatches.length * 2;
      }

      const contentMatches = content.match(regex);
      if (contentMatches) {
        count += contentMatches.length;
      }

      if (count > 0) {
        const weightedScore = kw.weight * kw.categoryWeight * count;
        result.score += weightedScore;
        result.matchedKeywords.push({
          word: kw.word,
          weight: kw.weight,
          category: kw.category,
          count,
          score: weightedScore
        });

        if (!categoryScores[kw.category]) {
          categoryScores[kw.category] = 0;
        }
        categoryScores[kw.category] += weightedScore;
      }
    }

    result.matchedCategories = Object.entries(categoryScores)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);

    result.isMatched = result.score >= this.threshold && !result.excluded;

    return result;
  }

  matchBatch(announcements) {
    const results = [];
    const matched = [];
    const unmatched = [];
    const excluded = [];

    for (const announcement of announcements) {
      const matchResult = this.match(announcement);
      const result = {
        ...announcement,
        matchInfo: matchResult
      };

      results.push(result);

      if (matchResult.excluded) {
        excluded.push(result);
      } else if (matchResult.isMatched) {
        matched.push(result);
      } else {
        unmatched.push(result);
      }
    }

    matched.sort((a, b) => b.matchInfo.score - a.matchInfo.score);

    return {
      total: results.length,
      matched: matched.length,
      unmatched: unmatched.length,
      excluded: excluded.length,
      matchedItems: matched,
      unmatchedItems: unmatched,
      excludedItems: excluded,
      allItems: results
    };
  }

  getThreshold() {
    return this.threshold;
  }

  setThreshold(threshold) {
    this.threshold = threshold;
  }

  getStats() {
    return {
      totalKeywords: this.flatKeywords.length,
      excludeKeywords: this.excludeKeywords.length,
      threshold: this.threshold,
      categories: this.keywordsConfig?.categories?.length || 0
    };
  }
}

const keywordMatcher = new KeywordMatcher();

export default keywordMatcher;
export { KeywordMatcher };
