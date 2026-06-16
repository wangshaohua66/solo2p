import { createLogger } from '../utils/logger.js';

const logger = createLogger('Filter');

const DEFAULT_CONFIG = {
  minDiscountRate: 0,
  maxDiscountRate: 100,
  minArea: 0,
  maxArea: Infinity,
  minAssessPrice: 0,
  maxAssessPrice: Infinity,
  targetAreas: [],
  statuses: [],
  roundWeights: {
    '一拍': 1.0,
    '二拍': 1.2,
    '变卖': 1.3
  },
  areaScores: {},
  highValueThreshold: 3
};

function calculateDiscountRate(auction) {
  if (!auction) {
    logger.warn('计算价差率失败：标的对象为空');
    return null;
  }

  const startPrice = Number(auction.start_price) || 0;
  const assessPrice = Number(auction.assess_price) || 0;

  if (assessPrice <= 0) {
    logger.warn(`计算价差率失败：评估价无效 [${auction.title || '未知标的'}] assessPrice=${assessPrice}`);
    return null;
  }

  const discountRate = (startPrice / assessPrice) * 100;
  return Number(discountRate.toFixed(2));
}

function isTargetArea(address, targetAreas) {
  if (!address) {
    logger.warn('区域判断失败：地址为空');
    return false;
  }

  if (!targetAreas || targetAreas.length === 0) {
    return true;
  }

  const addressStr = String(address);
  return targetAreas.some(area => addressStr.includes(area));
}

function isPriceRange(assessPrice, min, max) {
  const price = Number(assessPrice) || 0;
  const minPrice = Number(min) || 0;
  const maxPrice = max === undefined || max === null ? Infinity : Number(max);

  if (price <= 0) {
    logger.warn(`价格范围判断：评估价无效 price=${price}`);
    return false;
  }

  return price >= minPrice && price <= maxPrice;
}

function isAreaRange(area, min, max) {
  const areaNum = Number(area) || 0;
  const minArea = Number(min) || 0;
  const maxArea = max === undefined || max === null ? Infinity : Number(max);

  if (areaNum <= 0) {
    logger.warn(`面积范围判断：面积无效 area=${area}`);
    return false;
  }

  return areaNum >= minArea && areaNum <= maxArea;
}

function getRoundWeight(round, roundWeights) {
  if (!round) {
    logger.warn('轮次权重获取：轮次为空，使用默认权重1.0');
    return 1.0;
  }

  const weights = roundWeights || DEFAULT_CONFIG.roundWeights;
  const roundStr = String(round);

  for (const [key, weight] of Object.entries(weights)) {
    if (roundStr.includes(key)) {
      return Number(weight) || 1.0;
    }
  }

  logger.warn(`轮次权重获取：未匹配到轮次 [${roundStr}]，使用默认权重1.0`);
  return 1.0;
}

function calculateScore(auction, config) {
  if (!auction) {
    logger.warn('计算综合评分失败：标的对象为空');
    return 0;
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const discountRate = calculateDiscountRate(auction);

  if (discountRate === null) {
    logger.warn(`综合评分计算：价差率无效，标的 [${auction.title || '未知'}] 得分为0`);
    return 0;
  }

  let score = 0;

  const discountScore = Math.max(0, Math.min(100, (100 - discountRate) * 1.2));
  score += discountScore * 0.5;

  const roundWeight = getRoundWeight(auction.round, cfg.roundWeights);
  const roundScore = Math.min(100, (roundWeight - 1) * 400);
  score += roundScore * 0.3;

  let areaBonus = 0;
  if (cfg.areaScores && Object.keys(cfg.areaScores).length > 0) {
    const address = auction.address || '';
    for (const [area, areaScore] of Object.entries(cfg.areaScores)) {
      if (address.includes(area)) {
        areaBonus = Math.max(areaBonus, Number(areaScore) || 0);
        break;
      }
    }
  }
  score += areaBonus * 0.2;

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

function calculateStarRating(auction, config) {
  const score = calculateScore(auction, config);

  let stars = 1;
  if (score >= 80) stars = 5;
  else if (score >= 65) stars = 4;
  else if (score >= 50) stars = 3;
  else if (score >= 30) stars = 2;
  else stars = 1;

  return {
    score,
    stars,
    starDisplay: '★'.repeat(stars) + '☆'.repeat(5 - stars),
    isHighValue: stars >= (config?.highValueThreshold || DEFAULT_CONFIG.highValueThreshold)
  };
}

function sortAuctions(auctions, sortBy = 'score', order = 'desc') {
  if (!Array.isArray(auctions) || auctions.length === 0) {
    return [];
  }

  const sortFunctions = {
    score: (a, b) => (b.score || 0) - (a.score || 0),
    discountRate: (a, b) => (a.discountRate || 100) - (b.discountRate || 100),
    assess_price: (a, b) => (b.assess_price || 0) - (a.assess_price || 0),
    start_price: (a, b) => (b.start_price || 0) - (a.start_price || 0),
    area: (a, b) => (b.area || 0) - (a.area || 0),
    auction_date: (a, b) => new Date(a.auction_date || 0) - new Date(b.auction_date || 0)
  };

  const sortFn = sortFunctions[sortBy] || sortFunctions.score;
  const sorted = [...auctions].sort(sortFn);

  if (order === 'asc') {
    sorted.reverse();
  }

  logger.debug(`排序完成：按 [${sortBy}] ${order === 'desc' ? '降序' : '升序'}，共 ${sorted.length} 条`);
  return sorted;
}

function filterAuctions(auctions, options = {}) {
  if (!Array.isArray(auctions) || auctions.length === 0) {
    logger.warn('筛选失败：标的列表为空');
    return { filtered: [], total: 0, highValue: [], details: [] };
  }

  const config = { ...DEFAULT_CONFIG, ...options };
  const total = auctions.length;
  const details = [];
  const filtered = [];
  const highValue = [];

  logger.info(`开始筛选：共 ${total} 条标的，最小价差率=${config.minDiscountRate}%，最大价差率=${config.maxDiscountRate}%`);

  for (const auction of auctions) {
    const detail = {
      auction: { ...auction },
      passed: true,
      reasons: [],
      discountRate: null,
      score: 0,
      stars: 0,
      starDisplay: '',
      isHighValue: false
    };

    const discountRate = calculateDiscountRate(auction);
    detail.discountRate = discountRate;
    detail.auction.discountRate = discountRate;

    if (discountRate !== null) {
      if (discountRate < config.minDiscountRate) {
        detail.passed = false;
        detail.reasons.push(`价差率 ${discountRate}% 低于最小值 ${config.minDiscountRate}%`);
      }
      if (discountRate > config.maxDiscountRate) {
        detail.passed = false;
        detail.reasons.push(`价差率 ${discountRate}% 高于最大值 ${config.maxDiscountRate}%`);
      }
    } else {
      detail.passed = false;
      detail.reasons.push('价差率计算失败（评估价无效）');
    }

    if (config.targetAreas && config.targetAreas.length > 0) {
      if (!isTargetArea(auction.address, config.targetAreas)) {
        detail.passed = false;
        detail.reasons.push(`不在目标区域内 [${auction.address || '无地址'}]`);
      }
    }

    if (config.minArea > 0 || config.maxArea !== Infinity) {
      if (!isAreaRange(auction.area, config.minArea, config.maxArea)) {
        detail.passed = false;
        detail.reasons.push(`面积 ${auction.area || 0}㎡ 不在范围内 [${config.minArea}-${config.maxArea === Infinity ? '不限' : config.maxArea}]`);
      }
    }

    if (config.minAssessPrice > 0 || config.maxAssessPrice !== Infinity) {
      if (!isPriceRange(auction.assess_price, config.minAssessPrice, config.maxAssessPrice)) {
        detail.passed = false;
        detail.reasons.push(`评估价 ${auction.assess_price || 0}元 不在范围内 [${config.minAssessPrice}-${config.maxAssessPrice === Infinity ? '不限' : config.maxAssessPrice}]`);
      }
    }

    if (config.statuses && config.statuses.length > 0) {
      const status = auction.status || '';
      if (!config.statuses.some(s => status.includes(s))) {
        detail.passed = false;
        detail.reasons.push(`状态 [${status}] 不在允许列表中`);
      }
    }

    const rating = calculateStarRating(auction, config);
    detail.score = rating.score;
    detail.stars = rating.stars;
    detail.starDisplay = rating.starDisplay;
    detail.isHighValue = rating.isHighValue;
    detail.auction.score = rating.score;
    detail.auction.stars = rating.stars;
    detail.auction.starDisplay = rating.starDisplay;
    detail.auction.isHighValue = rating.isHighValue;

    if (detail.passed) {
      filtered.push(detail.auction);
      if (detail.isHighValue) {
        highValue.push(detail.auction);
      }
    }

    details.push(detail);

    const statusText = detail.passed ? '通过' : '未通过';
    const reasonText = detail.reasons.length > 0 ? `原因: ${detail.reasons.join('; ')}` : '';
    logger.debug(`[${statusText}] ${auction.title || '未知标的'} | 价差率: ${discountRate !== null ? discountRate + '%' : '无效'} | ${detail.starDisplay} | ${reasonText}`);
  }

  const sortedFiltered = sortAuctions(filtered, config.sortBy || 'score', config.sortOrder || 'desc');
  const sortedHighValue = sortAuctions(highValue, config.sortBy || 'score', config.sortOrder || 'desc');

  logger.info(`筛选完成：总数 ${total} 条，通过 ${sortedFiltered.length} 条，高价值 ${sortedHighValue.length} 条，通过率 ${((sortedFiltered.length / total) * 100).toFixed(2)}%`);

  return {
    filtered: sortedFiltered,
    total,
    highValue: sortedHighValue,
    details
  };
}

export {
  DEFAULT_CONFIG,
  calculateDiscountRate,
  calculateStarRating,
  calculateScore,
  isTargetArea,
  isPriceRange,
  isAreaRange,
  getRoundWeight,
  sortAuctions,
  filterAuctions
};

export default {
  DEFAULT_CONFIG,
  calculateDiscountRate,
  calculateStarRating,
  calculateScore,
  isTargetArea,
  isPriceRange,
  isAreaRange,
  getRoundWeight,
  sortAuctions,
  filterAuctions
};
