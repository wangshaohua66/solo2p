const { pinyin } = require('pinyin-pro');
const stringSimilarity = require('string-similarity');
const _ = require('lodash');
const moment = require('moment');
const { getLogger } = require('../logger/appLogger');
const { getConfig } = require('../config');

const logger = getLogger();

const MATCH_TYPES = {
  EXACT: 'exact',
  PINYIN: 'pinyin',
  ACRONYM: 'acronym',
  SIMILAR: 'similar'
};

const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .toLowerCase()
    .replace(/[\s\-_·\.。，,（）()\[\]【】""''「」]/g, '')
    .replace(/[™®©]/g, '')
    .trim();
}

function getPinyin(name) {
  if (!name) return '';
  const normalized = normalizeName(name);
  return pinyin(normalized, { toneType: 'none', separator: '' });
}

function getAcronym(name) {
  if (!name) return '';
  const normalized = normalizeName(name);
  const py = pinyin(normalized, { toneType: 'none', separator: ' ' });
  return py.split(' ').map(word => word[0]).join('').toLowerCase();
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
}

function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  
  const ns1 = normalizeName(s1);
  const ns2 = normalizeName(s2);
  
  if (ns1 === ns2) return 1.0;
  
  const maxLen = Math.max(ns1.length, ns2.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshteinDistance(ns1, ns2);
  const editSimilarity = 1 - (distance / maxLen);
  
  const diceSimilarity = stringSimilarity.compareTwoStrings(ns1, ns2);
  
  const weightedScore = (editSimilarity * 0.4) + (diceSimilarity * 0.6);
  
  return Math.max(0, Math.min(1, weightedScore));
}

function getGlyphSimilarity(s1, s2) {
  const radicalMap = {
    '氵': ['河', '湖', '海', '江', '洋', '波', '浪', '清', '洗', '流'],
    '木': ['林', '森', '树', '村', '板', '枝', '根', '栋', '梁', '柱'],
    '艹': ['草', '花', '茶', '菜', '芳', '芬', '茂', '荣', '莲', '荷'],
    '口': ['吃', '喝', '唱', '叫', '喊', '听', '咬', '吹', '呼', '吸'],
    '扌': ['打', '拉', '推', '提', '抱', '抓', '拍', '抬', '挑', '挖'],
    '钅': ['金', '银', '铜', '铁', '钢', '钱', '钟', '链', '锁', '针'],
    '女': ['妈', '姐', '妹', '姑', '姨', '娘', '婆', '媳', '嫂', '妻'],
    '亻': ['他', '你', '们', '作', '做', '住', '位', '休', '体', '何'],
    '讠': ['说', '话', '语', '记', '认', '让', '许', '讲', '读', '请']
  };
  
  const ns1 = normalizeName(s1);
  const ns2 = normalizeName(s2);
  
  let radicalScore = 0;
  for (const radical of Object.keys(radicalMap)) {
    const chars = radicalMap[radical];
    const has1 = ns1.split('').some(c => chars.includes(c));
    const has2 = ns2.split('').some(c => chars.includes(c));
    if (has1 && has2) radicalScore += 0.1;
  }
  
  const structureScore = calculateStructureSimilarity(ns1, ns2);
  
  return Math.min(0.3, radicalScore + structureScore);
}

function calculateStructureSimilarity(s1, s2) {
  if (s1.length === s2.length) return 0.1;
  if (Math.abs(s1.length - s2.length) <= 1) return 0.05;
  return 0;
}

function checkExactMatch(trademarkName, clientTrademark) {
  const tmNorm = normalizeName(trademarkName);
  const clientNorm = normalizeName(clientTrademark.name);
  
  if (tmNorm === clientNorm) {
    return {
      match: true,
      type: MATCH_TYPES.EXACT,
      score: 1.0,
      details: '精确匹配'
    };
  }
  
  return { match: false, type: null, score: 0, details: '' };
}

function checkPinyinMatch(trademarkName, clientTrademark) {
  const tmPinyin = getPinyin(trademarkName);
  const clientPinyin = getPinyin(clientTrademark.name);
  
  if (!tmPinyin || !clientPinyin) {
    return { match: false, type: null, score: 0, details: '' };
  }
  
  if (tmPinyin === clientPinyin) {
    return {
      match: true,
      type: MATCH_TYPES.PINYIN,
      score: 0.9,
      details: `拼音完全匹配: ${tmPinyin}`
    };
  }
  
  const similarity = calculateSimilarity(tmPinyin, clientPinyin);
  if (similarity >= 0.85) {
    return {
      match: true,
      type: MATCH_TYPES.PINYIN,
      score: similarity,
      details: `拼音近似匹配: ${tmPinyin} vs ${clientPinyin}`
    };
  }
  
  return { match: false, type: null, score: 0, details: '' };
}

function checkAcronymMatch(trademarkName, clientTrademark) {
  const tmAcronym = getAcronym(trademarkName);
  const clientAcronym = getAcronym(clientTrademark.name);
  
  if (!tmAcronym || !clientAcronym || tmAcronym.length < 2 || clientAcronym.length < 2) {
    return { match: false, type: null, score: 0, details: '' };
  }
  
  if (tmAcronym === clientAcronym) {
    return {
      match: true,
      type: MATCH_TYPES.ACRONYM,
      score: 0.85,
      details: `首字母匹配: ${tmAcronym}`
    };
  }
  
  return { match: false, type: null, score: 0, details: '' };
}

function checkSimilarMatch(trademarkName, clientTrademark, thresholds) {
  const baseSimilarity = calculateSimilarity(trademarkName, clientTrademark.name);
  const glyphBonus = getGlyphSimilarity(trademarkName, clientTrademark.name);
  const totalScore = Math.min(1, baseSimilarity + glyphBonus);
  
  if (totalScore >= thresholds.low) {
    const type = totalScore >= thresholds.high ? MATCH_TYPES.EXACT : 
                 totalScore >= thresholds.medium ? MATCH_TYPES.SIMILAR : 
                 MATCH_TYPES.SIMILAR;
    
    return {
      match: true,
      type,
      score: totalScore,
      details: `字形相似度: ${(totalScore * 100).toFixed(1)}%`
    };
  }
  
  return { match: false, type: null, score: 0, details: '' };
}

function checkClassMatch(trademarkClass, clientClass) {
  if (!trademarkClass || !clientClass) return true;
  
  const tmClasses = trademarkClass.toString().split(',').map(c => parseInt(c.trim()));
  const clientClasses = clientClass.toString().split(',').map(c => parseInt(c.trim()));
  
  return tmClasses.some(c => clientClasses.includes(c));
}

function calculateRiskLevel(score, riskLevels) {
  if (score >= riskLevels.high) return RISK_LEVELS.HIGH;
  if (score >= riskLevels.medium) return RISK_LEVELS.MEDIUM;
  if (score >= riskLevels.low) return RISK_LEVELS.LOW;
  return null;
}

function calculateOppositionDeadline(announcementDate, announcementType) {
  if (!announcementDate) return null;
  
  const isPreliminary = announcementType && 
    announcementType.includes('初审');
  
  if (isPreliminary) {
    return moment(announcementDate).add(3, 'months').format('YYYY-MM-DD');
  }
  
  return null;
}

async function matchTrademarks(announcementTrademarks, clientTrademarks) {
  const startTime = Date.now();
  const config = getConfig('matcher', {});
  const modes = config.modes || { exact: true, pinyin: true, acronym: true };
  const thresholds = config.similarity?.threshold || { high: 0.9, medium: 0.75, low: 0.6 };
  const riskLevels = config.similarity?.riskLevels || { high: 0.85, medium: 0.7, low: 0.55 };
  const batchSize = config.batchSize || 50;
  
  logger.info(`Starting trademark matching`, {
    announcementCount: announcementTrademarks.length,
    clientCount: clientTrademarks.length,
    modes
  });
  
  const matches = [];
  const matchChecks = [];
  
  if (modes.exact) matchChecks.push(checkExactMatch);
  if (modes.pinyin) matchChecks.push(checkPinyinMatch);
  if (modes.acronym) matchChecks.push(checkAcronymMatch);
  matchChecks.push((tm, ct) => checkSimilarMatch(tm, ct, thresholds));
  
  for (let i = 0; i < announcementTrademarks.length; i += batchSize) {
    const batch = announcementTrademarks.slice(i, i + batchSize);
    
    for (const atm of batch) {
      for (const ctm of clientTrademarks) {
        if (!checkClassMatch(atm.classNumber, ctm.class_number)) {
          continue;
        }
        
        let bestMatch = null;
        
        for (const checkFn of matchChecks) {
          const result = checkFn(atm.trademark_name || atm.trademarkName, {
            name: ctm.trademark_name,
            classNumber: ctm.class_number
          });
          
          if (result.match && (!bestMatch || result.score > bestMatch.score)) {
            bestMatch = result;
          }
        }
        
        if (bestMatch) {
          const riskLevel = calculateRiskLevel(bestMatch.score, riskLevels);
          const oppositionDeadline = calculateOppositionDeadline(
            atm.announcement_date || atm.announcementDate,
            atm.announcement_type || atm.announcementType
          );
          
          const isOpposable = oppositionDeadline !== null;
          const clientThreshold = ctm.risk_threshold || 'medium';
          const thresholdValue = { low: 0.55, medium: 0.7, high: 0.85 };
          
          if (riskLevel && bestMatch.score >= thresholdValue[clientThreshold]) {
            matches.push({
              trademarkId: atm.id,
              clientTrademarkId: ctm.id,
              matchType: bestMatch.type,
              similarityScore: bestMatch.score,
              riskLevel,
              isOpposable,
              oppositionDeadline,
              details: bestMatch.details,
              trademarkData: atm,
              clientTrademarkData: ctm
            });
          }
        }
      }
    }
    
    if (i + batchSize < announcementTrademarks.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  const uniqueMatches = _.uniqBy(matches, m => 
    `${m.trademarkId}-${m.clientTrademarkId}-${m.matchType}`
  );
  
  const duration = Date.now() - startTime;
  logger.info(`Trademark matching completed`, {
    totalProcessed: announcementTrademarks.length,
    matchesFound: uniqueMatches.length,
    durationMs: duration,
    highRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.HIGH).length,
    mediumRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.MEDIUM).length,
    lowRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.LOW).length
  });
  
  return {
    success: true,
    matches: uniqueMatches,
    totalProcessed: announcementTrademarks.length,
    durationMs: duration,
    stats: {
      highRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.HIGH).length,
      mediumRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.MEDIUM).length,
      lowRisk: uniqueMatches.filter(m => m.riskLevel === RISK_LEVELS.LOW).length
    }
  };
}

function matchSingleTrademark(trademark, clientTrademarks, options = {}) {
  const config = getConfig('matcher', {});
  const modes = config.modes || { exact: true, pinyin: true, acronym: true };
  const thresholds = config.similarity?.threshold || { high: 0.9, medium: 0.75, low: 0.6 };
  const riskLevels = config.similarity?.riskLevels || { high: 0.85, medium: 0.7, low: 0.55 };
  
  const matchChecks = [];
  if (modes.exact) matchChecks.push(checkExactMatch);
  if (modes.pinyin) matchChecks.push(checkPinyinMatch);
  if (modes.acronym) matchChecks.push(checkAcronymMatch);
  matchChecks.push((tm, ct) => checkSimilarMatch(tm, ct, thresholds));
  
  const results = [];
  
  for (const ctm of clientTrademarks) {
    if (!checkClassMatch(trademark.classNumber || trademark.class_number, ctm.classNumber || ctm.class_number)) {
      continue;
    }
    
    let bestMatch = null;
    
    for (const checkFn of matchChecks) {
      const result = checkFn(trademark.trademarkName || trademark.trademark_name, {
        name: ctm.trademarkName || ctm.trademark_name,
        classNumber: ctm.classNumber || ctm.class_number
      });
      
      if (result.match && (!bestMatch || result.score > bestMatch.score)) {
        bestMatch = result;
      }
    }
    
    if (bestMatch) {
      const riskLevel = calculateRiskLevel(bestMatch.score, riskLevels);
      results.push({
        clientTrademark: ctm,
        matchType: bestMatch.type,
        similarityScore: bestMatch.score,
        riskLevel,
        details: bestMatch.details
      });
    }
  }
  
  return results.sort((a, b) => b.similarityScore - a.similarityScore);
}

module.exports = {
  matchTrademarks,
  matchSingleTrademark,
  calculateSimilarity,
  normalizeName,
  getPinyin,
  getAcronym,
  calculateOppositionDeadline,
  calculateRiskLevel,
  MATCH_TYPES,
  RISK_LEVELS
};
