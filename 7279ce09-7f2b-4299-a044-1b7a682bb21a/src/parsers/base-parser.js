import { By } from 'selenium-webdriver';
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

export class BaseParser {
  constructor(siteConfig) {
    this.siteConfig = siteConfig;
    this.siteName = siteConfig.name;
    this.selectors = siteConfig.selectors || {};
    logger.info(`[${this.siteName}] 解析器初始化完成`);
  }

  async parseListItem(element) {
    logger.debug(`[${this.siteName}] 开始解析列表项`);
    const data = {
      title: null,
      detailUrl: null,
      currentPrice: null,
      auctionDate: null
    };

    const listSelectors = this.selectors.list || {};

    try {
      const titleEl = await element.findElement(By.css(listSelectors.titleSelector));
      data.title = await titleEl.getText();
      data.title = data.title.trim();
      logger.debug(`[${this.siteName}] 列表标题提取成功: ${data.title}`);
    } catch (e) {
      logger.warn(`[${this.siteName}] 列表标题提取失败: ${e.message}`);
    }

    try {
      const linkEl = await element.findElement(By.css(listSelectors.detailLinkSelector));
      data.detailUrl = await linkEl.getAttribute('href');
      if (data.detailUrl && !data.detailUrl.startsWith('http')) {
        data.detailUrl = new URL(data.detailUrl, this.siteConfig.baseUrl).href;
      }
      logger.debug(`[${this.siteName}] 详情链接提取成功: ${data.detailUrl}`);
    } catch (e) {
      logger.warn(`[${this.siteName}] 详情链接提取失败: ${e.message}`);
    }

    try {
      const priceEl = await element.findElement(By.css(listSelectors.priceSelector));
      const priceText = await priceEl.getText();
      data.currentPrice = this.cleanPrice(priceText);
      logger.debug(`[${this.siteName}] 列表当前价提取成功: ${data.currentPrice}分`);
    } catch (e) {
      logger.warn(`[${this.siteName}] 列表当前价提取失败: ${e.message}`);
    }

    try {
      const dateEl = await element.findElement(By.css(listSelectors.dateSelector));
      const dateText = await dateEl.getText();
      data.auctionDate = this.cleanDate(dateText);
      logger.debug(`[${this.siteName}] 列表拍卖日期提取成功: ${data.auctionDate}`);
    } catch (e) {
      logger.warn(`[${this.siteName}] 列表拍卖日期提取失败: ${e.message}`);
    }

    data.site = this.siteName;
    data.source = 'list';

    logger.debug(`[${this.siteName}] 列表项解析完成`);
    return data;
  }

  async parseDetailPage(driver) {
    logger.info(`[${this.siteName}] 开始解析详情页`);
    const data = {
      title: null,
      address: null,
      area: null,
      assessPrice: null,
      startPrice: null,
      auctionDate: null,
      round: null,
      court: null,
      noticeUrl: null,
      currentPrice: null,
      status: null,
      bidCount: null
    };

    const detailSelectors = this.selectors.detail || {};

    const fieldMap = {
      title: { selector: detailSelectors.title, type: 'text', clean: 'text' },
      address: { selector: detailSelectors.address, type: 'text', clean: 'text' },
      area: { selector: detailSelectors.area, type: 'text', clean: 'area' },
      assessPrice: { selector: detailSelectors.assessPrice, type: 'text', clean: 'price' },
      startPrice: { selector: detailSelectors.startPrice, type: 'text', clean: 'price' },
      currentPrice: { selector: detailSelectors.currentPrice, type: 'text', clean: 'price' },
      auctionDate: { selector: detailSelectors.auctionDate, type: 'text', clean: 'date' },
      round: { selector: detailSelectors.round, type: 'text', clean: 'text' },
      court: { selector: detailSelectors.court, type: 'text', clean: 'text' },
      status: { selector: detailSelectors.status, type: 'text', clean: 'text' },
      bidCount: { selector: detailSelectors.bidCount, type: 'text', clean: 'number' }
    };

    for (const [fieldName, config] of Object.entries(fieldMap)) {
      if (!config.selector) {
        logger.debug(`[${this.siteName}] 字段 ${fieldName} 无选择器配置，跳过`);
        continue;
      }

      try {
        data[fieldName] = await this.extractField(driver, config);
        if (data[fieldName] !== null) {
          logger.debug(`[${this.siteName}] 字段 ${fieldName} 提取成功: ${data[fieldName]}`);
        } else {
          logger.warn(`[${this.siteName}] 字段 ${fieldName} 提取结果为空`);
        }
      } catch (e) {
        logger.warn(`[${this.siteName}] 字段 ${fieldName} 提取失败: ${e.message}`);
        data[fieldName] = null;
      }
    }

    try {
      if (detailSelectors.noticeUrl) {
        const noticeEl = await driver.findElement(By.css(detailSelectors.noticeUrl));
        data.noticeUrl = await noticeEl.getAttribute('href');
        if (data.noticeUrl && !data.noticeUrl.startsWith('http')) {
          data.noticeUrl = new URL(data.noticeUrl, this.siteConfig.baseUrl).href;
        }
        logger.debug(`[${this.siteName}] 公告链接提取成功: ${data.noticeUrl}`);
      }
    } catch (e) {
      logger.warn(`[${this.siteName}] 公告链接提取失败: ${e.message}`);
      data.noticeUrl = null;
    }

    data.site = this.siteName;
    data.source = 'detail';

    const isValid = this.validateData(data);
    data.isValid = isValid;

    if (isValid) {
      logger.info(`[${this.siteName}] 详情页解析完成，数据有效`);
    } else {
      logger.warn(`[${this.siteName}] 详情页解析完成，数据无效（缺少必填字段）`);
    }

    return data;
  }

  async extractField(driver, selectorConfig) {
    const { selector, type = 'text', clean = 'text', selectorType = 'css' } = selectorConfig;

    let by;
    if (selectorType === 'xpath') {
      by = By.xpath(selector);
    } else {
      by = By.css(selector);
    }

    let element;
    try {
      element = await driver.findElement(by);
    } catch (e) {
      logger.debug(`[${this.siteName}] 元素未找到: ${selector}`);
      return null;
    }

    let value;
    switch (type) {
      case 'text':
        value = await element.getText();
        break;
      case 'html':
        value = await element.getAttribute('innerHTML');
        break;
      case 'attribute':
        value = await element.getAttribute(selectorConfig.attrName || 'href');
        break;
      default:
        value = await element.getText();
    }

    if (!value || value.trim() === '') {
      return null;
    }

    value = value.trim();

    switch (clean) {
      case 'price':
        return this.cleanPrice(value);
      case 'area':
        return this.cleanArea(value);
      case 'date':
        return this.cleanDate(value);
      case 'number':
        return this.cleanNumber(value);
      case 'text':
      default:
        return value;
    }
  }

  cleanPrice(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let cleaned = text.trim();
    cleaned = cleaned.replace(/[￥¥\s,，]/g, '');

    let isWan = false;
    let isYuan = false;

    if (/万/.test(cleaned)) {
      isWan = true;
      cleaned = cleaned.replace(/万/g, '');
    }
    if (/元/.test(cleaned)) {
      isYuan = true;
      cleaned = cleaned.replace(/元/g, '');
    }

    const match = cleaned.match(/-?\d+\.?\d*/);
    if (!match) {
      logger.warn(`[${this.siteName}] 价格解析失败，无法提取数字: ${text}`);
      return null;
    }

    let price = parseFloat(match[0]);

    if (isWan) {
      price = price * 10000;
    }

    const priceInFen = Math.round(price * 100);

    return priceInFen;
  }

  cleanArea(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let cleaned = text.trim();
    cleaned = cleaned.replace(/[㎡平方米平米平\u33A1]/g, '');
    cleaned = cleaned.replace(/[，,\s]/g, '');

    const match = cleaned.match(/-?\d+\.?\d*/);
    if (!match) {
      logger.warn(`[${this.siteName}] 面积解析失败，无法提取数字: ${text}`);
      return null;
    }

    let area = parseFloat(match[0]);
    area = Math.round(area * 100) / 100;

    return area;
  }

  cleanDate(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let cleaned = text.trim();

    cleaned = cleaned
      .replace(/年/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '')
      .replace(/号/g, '')
      .replace(/\./g, '-')
      .replace(/\//g, '-');

    const datePatterns = [
      /(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      /(\d{2})-(\d{2})-(\d{2})/,
      /(\d{4})(\d{2})(\d{2})/
    ];

    let match = null;
    let patternIndex = -1;

    for (let i = 0; i < datePatterns.length; i++) {
      match = cleaned.match(datePatterns[i]);
      if (match) {
        patternIndex = i;
        break;
      }
    }

    if (!match) {
      logger.warn(`[${this.siteName}] 日期解析失败: ${text}`);
      return null;
    }

    let year, month, day, hour = 0, minute = 0, second = 0;

    switch (patternIndex) {
      case 0:
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
        hour = parseInt(match[4], 10) || 0;
        minute = parseInt(match[5], 10) || 0;
        second = parseInt(match[6], 10) || 0;
        break;
      case 1:
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
        break;
      case 2:
        year = 2000 + parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
        break;
      case 3:
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
        break;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      logger.warn(`[${this.siteName}] 日期解析结果无效: ${text}`);
      return null;
    }

    const date = new Date(year, month - 1, day, hour, minute, second);

    if (isNaN(date.getTime())) {
      logger.warn(`[${this.siteName}] 日期对象创建失败: ${text}`);
      return null;
    }

    return date.toISOString();
  }

  cleanNumber(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const cleaned = text.replace(/[，,\s次出价]/g, '');
    const match = cleaned.match(/\d+/);

    if (!match) {
      logger.warn(`[${this.siteName}] 数字解析失败: ${text}`);
      return null;
    }

    return parseInt(match[0], 10);
  }

  validateData(data) {
    const requiredFields = ['title', 'address', 'startPrice'];
    const missingFields = [];

    for (const field of requiredFields) {
      if (data[field] === null || data[field] === undefined || data[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      logger.warn(`[${this.siteName}] 数据验证失败，缺少必填字段: ${missingFields.join(', ')}`);
      return false;
    }

    logger.debug(`[${this.siteName}] 数据验证通过`);
    return true;
  }
}

export default BaseParser;
