import { getSiteByName } from '../config/sites.js';
import {
  TaobaoParser,
  JdParser,
  GpaiParser,
  DefaultParser
} from './site-parser.js';
import { BaseParser } from './base-parser.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

const parserMap = {
  '阿里拍卖-司法': TaobaoParser,
  '京东拍卖-司法': JdParser,
  '公拍网': GpaiParser
};

const parserCache = new Map();

export function getParser(siteName) {
  if (parserCache.has(siteName)) {
    logger.debug(`[ParserFactory] 从缓存获取解析器: ${siteName}`);
    return parserCache.get(siteName);
  }

  const siteConfig = getSiteByName(siteName);
  if (!siteConfig) {
    logger.error(`[ParserFactory] 未找到站点配置: ${siteName}`);
    throw new Error(`未找到站点配置: ${siteName}`);
  }

  const ParserClass = parserMap[siteName] || DefaultParser;
  const parser = new ParserClass(siteConfig);

  parserCache.set(siteName, parser);
  logger.info(`[ParserFactory] 创建解析器: ${siteName} (${ParserClass.name})`);

  return parser;
}

export function hasCustomParser(siteName) {
  return !!parserMap[siteName];
}

export function registerParser(siteName, ParserClass) {
  if (!(ParserClass.prototype instanceof BaseParser) && ParserClass !== BaseParser) {
    logger.warn(`[ParserFactory] 注册的解析器 ${ParserClass.name} 未继承 BaseParser`);
  }

  parserMap[siteName] = ParserClass;
  if (parserCache.has(siteName)) {
    parserCache.delete(siteName);
  }
  logger.info(`[ParserFactory] 注册解析器: ${siteName} -> ${ParserClass.name}`);
}

export function getSupportedSites() {
  return Object.keys(parserMap);
}

export function clearParserCache() {
  parserCache.clear();
  logger.debug('[ParserFactory] 解析器缓存已清空');
}

export async function parseList(siteName, elements) {
  const parser = getParser(siteName);
  const results = [];

  logger.info(`[ParserFactory] 开始解析列表，共 ${elements.length} 项`);

  for (let i = 0; i < elements.length; i++) {
    try {
      const item = await parser.parseListItem(elements[i]);
      results.push(item);
    } catch (e) {
      logger.error(`[ParserFactory] 第 ${i + 1} 项列表解析失败: ${e.message}`);
      results.push({
        site: siteName,
        source: 'list',
        error: e.message,
        isValid: false
      });
    }
  }

  const validCount = results.filter(r => r.title && r.detailUrl).length;
  logger.info(`[ParserFactory] 列表解析完成，有效 ${validCount}/${results.length} 项`);

  return results;
}

export async function parseDetail(siteName, driver) {
  const parser = getParser(siteName);

  logger.info(`[ParserFactory] 开始解析详情页`);

  try {
    const result = await parser.parseDetailPage(driver);
    logger.info(`[ParserFactory] 详情页解析完成，数据${result.isValid ? '有效' : '无效'}`);
    return result;
  } catch (e) {
    logger.error(`[ParserFactory] 详情页解析失败: ${e.message}`);
    return {
      site: siteName,
      source: 'detail',
      error: e.message,
      isValid: false
    };
  }
}

export default {
  getParser,
  hasCustomParser,
  registerParser,
  getSupportedSites,
  clearParserCache,
  parseList,
  parseDetail,
  BaseParser,
  TaobaoParser,
  JdParser,
  GpaiParser,
  DefaultParser
};
