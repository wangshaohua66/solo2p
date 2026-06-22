import * as crypto from 'crypto';
import { Browser, Page, BrowserContext } from 'playwright';
import {
  PlatformConfig,
  AnnouncementListItem,
  Announcement,
  AnnouncementType,
  ProjectCategory,
  CrawlLogEntry
} from '../../types';
import { logCrawl, logger } from '../../utils/logger';
import { ANNOUNCEMENT_TYPE_PATTERNS, CATEGORY_PATTERNS } from '../../config/platforms';
import * as dayjs from 'dayjs';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  multiplier: number;
}

export interface CrawlContext {
  browser: Browser;
  context: BrowserContext;
  headless: boolean;
  verbose: boolean;
}

export abstract class BasePlatformAdapter {
  protected config: PlatformConfig;
  protected retryOptions: RetryOptions;
  protected crawlContext?: CrawlContext;
  protected lastRequestTime: number = 0;
  protected cookiesPath: string;

  constructor(config: PlatformConfig) {
    this.config = config;
    this.retryOptions = {
      maxRetries: 3,
      initialDelayMs: 1000,
      multiplier: 2
    };
    this.cookiesPath = `./data/cookies/${config.id}.json`;
  }

  setCrawlContext(context: CrawlContext): void {
    this.crawlContext = context;
  }

  getConfig(): PlatformConfig {
    return this.config;
  }

  abstract login(): Promise<boolean>;

  abstract isLoggedIn(page: Page): Promise<boolean>;

  abstract fetchList(pageNum: number): Promise<AnnouncementListItem[]>;

  abstract fetchDetail(url: string): Promise<Announcement | null>;

  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    url: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const durationMs = Date.now() - startTime;

        this.logCrawlEntry({
          timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
          platform: this.config.name,
          url,
          statusCode: 200,
          durationMs
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        const delayMs = this.retryOptions.initialDelayMs * Math.pow(this.retryOptions.multiplier, attempt);

        logger.warn(`[${this.config.name}] ${operationName} 失败 (尝试 ${attempt + 1}/${this.retryOptions.maxRetries + 1}): ${lastError.message}`);

        if (attempt < this.retryOptions.maxRetries) {
          await this.sleep(delayMs);
        }
      }
    }

    this.logCrawlEntry({
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
      platform: this.config.name,
      url,
      statusCode: 500,
      durationMs: 0,
      error: lastError?.message
    });

    throw lastError!;
  }

  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.rateLimit) {
      await this.sleep(this.config.rateLimit - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected logCrawlEntry(entry: CrawlLogEntry): void {
    logCrawl(entry);
  }

  protected async createPage(): Promise<Page> {
    if (!this.crawlContext) {
      throw new Error('Crawl context not set');
    }
    const page = await this.crawlContext.context.newPage();
    page.setDefaultTimeout(this.config.timeout.listPage);
    return page;
  }

  protected async safeNavigate(page: Page, url: string, timeout?: number): Promise<void> {
    await this.rateLimit();
    await page.goto(url, {
      timeout: timeout || this.config.timeout.listPage,
      waitUntil: 'domcontentloaded'
    });
  }

  protected async waitForDynamicContent(page: Page, selector: string): Promise<void> {
    try {
      await page.waitForSelector(selector, {
        timeout: this.config.timeout.detailPage,
        state: 'visible'
      });
    } catch (error) {
      logger.warn(`[${this.config.name}] 等待元素超时: ${selector}`);
    }
  }

  protected detectAnnouncementType(title: string): AnnouncementType {
    for (const [type, patterns] of Object.entries(ANNOUNCEMENT_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(title)) {
          return type as AnnouncementType;
        }
      }
    }
    return AnnouncementType.TENDER_NOTICE;
  }

  protected detectProjectCategory(title: string, content: string): ProjectCategory {
    const combinedText = `${title} ${content}`;
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combinedText)) {
          return category as ProjectCategory;
        }
      }
    }
    return ProjectCategory.GOVERNMENT_PROCUREMENT;
  }

  protected generateFingerprint(url: string, title: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${url}|${title}`);
    return hash.digest('hex');
  }

  protected normalizeUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    return new URL(url, this.config.baseUrl).href;
  }

  protected async resolveCaptcha(page: Page, imgSelector: string): Promise<string> {
    if (!this.config.loginConfig?.ocrServiceUrl) {
      logger.warn(`[${this.config.name}] 未配置OCR服务，需要手动处理验证码`);
      return '';
    }

    const captchaImg = await page.locator(imgSelector);
    const screenshot = await captchaImg.screenshot();

    try {
      const response = await fetch(this.config.loginConfig.ocrServiceUrl, {
        method: 'POST',
        body: screenshot,
        headers: { 'Content-Type': 'image/png' }
      });

      if (response.ok) {
        const data = await response.json();
        return data.text || '';
      }
    } catch (error) {
      logger.error(`[${this.config.name}] OCR识别失败: ${(error as Error).message}`);
    }

    return '';
  }

  protected async saveCookies(): Promise<void> {
    if (!this.crawlContext) return;

    const fs = await import('fs');
    const path = await import('path');

    const cookiesDir = path.dirname(this.cookiesPath);
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }

    const cookies = await this.crawlContext.context.cookies();
    fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
    logger.info(`[${this.config.name}] Cookie已保存`);
  }

  protected async loadCookies(): Promise<boolean> {
    if (!this.crawlContext) return false;

    const fs = await import('fs');

    try {
      if (fs.existsSync(this.cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf-8'));
        await this.crawlContext.context.addCookies(cookies);
        logger.info(`[${this.config.name}] Cookie已加载`);
        return true;
      }
    } catch (error) {
      logger.warn(`[${this.config.name}] Cookie加载失败: ${(error as Error).message}`);
    }

    return false;
  }
}
