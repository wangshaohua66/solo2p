const stringSimilarity = require('string-similarity');
const similarity = require('similarity');
const CryptoJS = require('crypto-js');
const _ = require('lodash');
const pLimit = require('p-limit');

const config = require('../config/default.json');
const Parser = require('./parser');

class Comparator {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.parser = new Parser();
    this.options = { ...config.comparator, ...options };
    this.concurrencyLimit = pLimit(10);
    this.stats = {
      totalComparisons: 0,
      suspectedMatches: 0,
      avgTimeMs: 0
    };
  }

  computeKgrams(text, k = 3) {
    if (!text || text.length < k) return [];
    const grams = new Set();
    const clean = text.replace(/\s+/g, '');
    for (let i = 0; i <= clean.length - k; i++) {
      grams.add(clean.slice(i, i + k));
    }
    return Array.from(grams);
  }

  computeWinnowingFingerprint(text, k = null, windowSize = null) {
    k = k || this.options.fingerprintKgrams;
    windowSize = windowSize || this.options.fingerprintWindowSize;

    if (!text || text.length < k) return [];

    const grams = this.computeKgrams(text, k);
    if (grams.length === 0) return [];

    const hashes = grams.map((g) => {
      const h = CryptoJS.MD5(g).toString();
      return { gram: g, hash: h, value: parseInt(h.slice(0, 8), 16) };
    });

    const fingerprints = [];
    for (let i = 0; i <= hashes.length - windowSize; i++) {
      const window = hashes.slice(i, i + windowSize);
      const min = window.reduce((prev, curr) => (curr.value < prev.value ? curr : prev));
      fingerprints.push(min.hash);
    }

    return _.uniq(fingerprints);
  }

  jaccardSimilarity(setA, setB) {
    if (!setA.length || !setB.length) return 0;
    const a = new Set(setA);
    const b = new Set(setB);
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
  }

  cosineSimilarity(vecA, vecB) {
    const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of keys) {
      const a = vecA[key] || 0;
      const b = vecB[key] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  computeKeywordVector(text, topN = null) {
    topN = topN || this.options.keywordTopN;
    const keywords = this.parser.extractKeywords(text, topN);

    const freq = {};
    for (const word of keywords) {
      freq[word] = (freq[word] || 0) + 1;
    }

    const total = Object.values(freq).reduce((a, b) => a + b, 0) || 1;
    const normalized = {};
    for (const [word, count] of Object.entries(freq)) {
      normalized[word] = count / total;
    }

    return { keywords, vector: normalized };
  }

  computeTitleSimilarity(titleA, titleB) {
    if (!titleA || !titleB) return 0;

    const cleanA = titleA.replace(/\s+/g, '');
    const cleanB = titleB.replace(/\s+/g, '');

    const methods = [];

    try {
      methods.push(stringSimilarity.compareTwoStrings(cleanA, cleanB));
    } catch (e) { methods.push(0); }

    try {
      methods.push(similarity(cleanA, cleanB));
    } catch (e) { methods.push(0); }

    const gramsA = this.computeKgrams(cleanA, 2);
    const gramsB = this.computeKgrams(cleanB, 2);
    methods.push(this.jaccardSimilarity(gramsA, gramsB));

    const fpA = this.computeWinnowingFingerprint(cleanA, 2, 3);
    const fpB = this.computeWinnowingFingerprint(cleanB, 2, 3);
    methods.push(this.jaccardSimilarity(fpA, fpB));

    return _.mean(methods.filter((m) => !isNaN(m)));
  }

  computeContentSimilarity(contentA, contentB) {
    if (!contentA || !contentB) return 0;

    const cleanA = contentA.replace(/\s+/g, '');
    const cleanB = contentB.replace(/\s+/g, '');

    if (cleanA.length < 50 || cleanB.length < 50) return 0;

    const methods = [];

    const sampleLen = Math.min(2000, Math.floor(cleanA.length / 2), Math.floor(cleanB.length / 2));
    const sampleA = cleanA.slice(0, sampleLen);
    const sampleB = cleanB.slice(0, sampleLen);

    const gramsA = this.computeKgrams(sampleA, 3);
    const gramsB = this.computeKgrams(sampleB, 3);
    methods.push(this.jaccardSimilarity(gramsA, gramsB) * 1.1);

    const fpA = this.computeWinnowingFingerprint(sampleA, 3, 5);
    const fpB = this.computeWinnowingFingerprint(sampleB, 3, 5);
    methods.push(this.jaccardSimilarity(fpA, fpB) * 1.2);

    const { vector: vecA, keywords: kwA } = this.computeKeywordVector(cleanA, 50);
    const { vector: vecB, keywords: kwB } = this.computeKeywordVector(cleanB, 50);
    methods.push(this.cosineSimilarity(vecA, vecB));

    const matchedKeywords = kwA.filter((k) => kwB.includes(k));
    const keywordOverlap = matchedKeywords.length / Math.max(kwA.length, kwB.length, 1);
    methods.push(keywordOverlap * 0.9);

    let longestCommon = 0;
    const shorter = cleanA.length < cleanB.length ? cleanA : cleanB;
    const longer = cleanA.length < cleanB.length ? cleanB : cleanA;
    const checkLen = 20;
    for (let i = 0; i <= shorter.length - checkLen; i += 5) {
      const sub = shorter.slice(i, i + checkLen);
      if (longer.includes(sub)) {
        longestCommon += checkLen;
        i += checkLen - 1;
      }
    }
    const lcsRatio = longestCommon / Math.min(cleanA.length, cleanB.length);
    methods.push(lcsRatio * 1.3);

    const result = _.mean(methods.filter((m) => !isNaN(m) && isFinite(m)));
    return Math.min(1, result);
  }

  determineMatchType(titleSim, contentSim) {
    if (contentSim >= 0.85 && titleSim >= 0.8) return 'exact_copy';
    if (contentSim >= 0.7) return 'substantial_copy';
    if (contentSim >= 0.5 && titleSim >= 0.6) return 'partial_rewrite';
    if (titleSim >= 0.8) return 'title_copy';
    if (contentSim >= 0.4) return 'content_fragment';
    return 'weak_similarity';
  }

  isSuspectedInfringement(titleSim, contentSim) {
    const { titleSimilarityThreshold, contentSimilarityThreshold, eitherThreshold } = this.options;

    if (eitherThreshold) {
      return titleSim >= titleSimilarityThreshold || contentSim >= contentSimilarityThreshold;
    }
    return titleSim >= titleSimilarityThreshold && contentSim >= contentSimilarityThreshold;
  }

  async compareArticle(crawledArticle, originalArticles) {
    const startTime = Date.now();
    const { id: crawledId, site_id, title, content } = crawledArticle;

    if (!title || !content || content.length < this.options.minArticleLength) {
      return [];
    }

    const matches = [];
    const batchSize = this.options.maxComparisonBatch;

    for (let i = 0; i < originalArticles.length; i += batchSize) {
      const batch = originalArticles.slice(i, i + batchSize);

      for (const orig of batch) {
        this.stats.totalComparisons++;

        let titleSim = 0;
        if (title && orig.title) {
          titleSim = this.computeTitleSimilarity(title, orig.title);
        }

        if (titleSim < 0.1) {
          const { keywords: origKw } = orig.keyword_vector
            ? { keywords: Object.keys(JSON.parse(orig.keyword_vector || '{}')) }
            : this.computeKeywordVector(orig.content || '', 30);
          const crawledKw = this.parser.extractKeywords(title + ' ' + content.slice(0, 500), 30);
          const shared = origKw.filter((k) => crawledKw.includes(k)).length;
          if (shared < 2) continue;
        }

        const contentSim = this.computeContentSimilarity(content || '', orig.content || '');
        const overallScore = (titleSim * 0.4 + contentSim * 0.6);

        if (this.isSuspectedInfringement(titleSim, contentSim)) {
          this.stats.suspectedMatches++;

          const { keywords: origKw } = this.computeKeywordVector(orig.content || '', 20);
          const crawledKw = this.parser.extractKeywords(content || '', 20);
          const matchedKw = origKw.filter((k) => crawledKw.includes(k));

          matches.push({
            original_article_id: orig.article_id,
            crawled_article_id: crawledId,
            site_id,
            title_similarity: parseFloat(titleSim.toFixed(4)),
            content_similarity: parseFloat(contentSim.toFixed(4)),
            overall_score: parseFloat(overallScore.toFixed(4)),
            match_type: this.determineMatchType(titleSim, contentSim),
            is_suspected: 1,
            is_confirmed: 0,
            matched_keywords: matchedKw,
            similarity_details: {
              algorithm: {
                title: ['dice', 'levenshtein', 'kgram_jaccard', 'winnowing'],
                content: ['kgram_jaccard', 'winnowing_fingerprint', 'cosine_keyword', 'keyword_overlap', 'lcs_fragment']
              },
              thresholds: {
                title: this.options.titleSimilarityThreshold,
                content: this.options.contentSimilarityThreshold
              }
            }
          });
        }
      }
    }

    const elapsed = Date.now() - startTime;
    this.stats.avgTimeMs = (this.stats.avgTimeMs + elapsed) / 2;

    matches.sort((a, b) => b.overall_score - a.overall_score);
    return matches.slice(0, 5);
  }

  async compareAllArticles(crawledArticles, options = {}) {
    const { onProgress = null } = options;

    const originalArticles = await this.storage.getAllOriginalArticlesForComparison();
    this._comparisonStart = Date.now();

    if (originalArticles.length === 0) {
      return {
        total: 0,
        suspected: 0,
        matches: [],
        warning: '原创稿件库为空，请先导入稿件数据'
      };
    }

    const allMatches = [];
    const limit = pLimit(this.options.maxComparisonBatch / 10 || 10);

    const tasks = crawledArticles.map((crawled, idx) =>
      limit(async () => {
        try {
          const matches = await this.compareArticle(crawled, originalArticles);

          for (const match of matches) {
            const matchId = await this.storage.addInfringementMatch(match);
            allMatches.push({ ...match, match_id: matchId });
          }

          if (onProgress) {
            onProgress({
              current: idx + 1,
              total: crawledArticles.length,
              suspected: allMatches.length,
              article_title: crawled.title ? crawled.title.slice(0, 30) + '...' : '(无标题)'
            });
          }

          return matches;
        } catch (err) {
          console.error(`比对失败 [${idx + 1}]: ${err.message}`);
          return [];
        }
      })
    );

    await Promise.all(tasks);

    allMatches.sort((a, b) => b.overall_score - a.overall_score);

    return {
      total: crawledArticles.length,
      original_count: originalArticles.length,
      comparisons: this.stats.totalComparisons,
      suspected: allMatches.length,
      avg_time_ms: this.stats.avgTimeMs.toFixed(0),
      matches: allMatches
    };
  }

  getStats() {
    return {
      ...this.stats,
      configurations: {
        titleThreshold: this.options.titleSimilarityThreshold,
        contentThreshold: this.options.contentSimilarityThreshold,
        eitherThreshold: this.options.eitherThreshold
      }
    };
  }
}

module.exports = Comparator;
