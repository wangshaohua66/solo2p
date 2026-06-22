import { Browser, BrowserContext, chromium, firefox, webkit } from 'playwright';
import PQueue from 'p-queue';
import { BasePlatformAdapter, CrawlContext } from './platforms/base';
import { PLATFORM_CONFIGS, NATIONAL_PLATFORM_CONFIG } from '../config/platforms';
import { ProvincialPlatformAdapter } from './platforms/impl/provincial';
import { City01Adapter } from './platforms/impl/city/city-01';
import { City02Adapter } from './platforms/impl/city/city-02';
import {
  CrawlResult,
  Announcement,
  HealthStats,
  CrawlTask,
  AnnouncementListItem
} from '../types';
import { logger } from '../utils/logger';
import { AnnouncementParser } from '../processors/announcement';
import { ChangeDetector } from '../processors/change-detector';
import { Repository } from '../storage/repository';
import { Notifier } from '../alert/notifier';
import * as EventEmitter from 'events';
import * as dayjs from 'dayjs';

export interface OrchestratorOptions {
  headless?: boolean;
  concurrency?: number;
  platformIds?: string[];
  verbose?: boolean;
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

export interface OrchestratorEvents {
  on(event: 'platform-start', listener: (platformId: string, platformName: string) => void): this;
  on(event: 'platform-complete', listener: (result: CrawlResult) => void): this;
  on(event: 'announcement-crawled', listener: (announcement: Announcement) => void): this;
  on(event: 'progress', listener: (platformId: string, current: number, total: number) => void): this;
  on(event: 'error', listener: (platformId: string, error: Error) => void): this;
}

export class CrawlerOrchestrator extends EventEmitter implements OrchestratorEvents {
  private options: Required<OrchestratorOptions>;
  private adapters: Map<string, BasePlatformAdapter> = new Map();
  private browser!: Browser;
  private context!: BrowserContext;
  private queue!: PQueue;
  private repository: Repository;
  private parser: AnnouncementParser;
  private changeDetector: ChangeDetector;
  private notifier: Notifier;
  private healthStats: Map<string, HealthStats> = new Map();
  private isRunning: boolean = false;

  constructor(options: OrchestratorOptions = {}) {
    super();
    this.options = {
      headless: true,
      concurrency: 3,
      platformIds: [],
      verbose: false,
      browserType: 'chromium',
      ...options
    };

    this.repository = new Repository();
    this.parser = new AnnouncementParser();
    this.changeDetector = new ChangeDetector();
    this.notifier = new Notifier();
  }

  async initialize(): Promise<void> {
    const browserMap = { chromium, firefox, webkit };
    const browserType = browserMap[this.options.browserType];

    this.browser = await browserType.launch({
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    this.queue = new PQueue({
      concurrency: this.options.concurrency,
      autoStart: false
    });

    this.initializeAdapters();
    this.initializeHealthStats();
    await this.repository.initialize();
  }

  private initializeAdapters(): void {
    const allConfigs = [NATIONAL_PLATFORM_CONFIG, ...PLATFORM_CONFIGS];
    const crawlContext: CrawlContext = {
      browser: this.browser,
      context: this.context,
      headless: this.options.headless,
      verbose: this.options.verbose
    };

    const adapterMap: Record<string, new (config: any) => BasePlatformAdapter> = {
      'provincial': ProvincialPlatformAdapter,
      'city-01': City01Adapter,
      'city-02': City02Adapter
    };

    for (const config of allConfigs) {
      if (this.options.platformIds.length > 0 && !this.options.platformIds.includes(config.id)) {
        continue;
      }

      const AdapterClass = adapterMap[config.id] || City01Adapter;
      const adapter = new AdapterClass(config);
      adapter.setCrawlContext(crawlContext);
      this.adapters.set(config.id, adapter);
    }

    logger.info(`已初始化 ${this.adapters.size} 个平台适配器`);
  }

  private initializeHealthStats(): void {
    for (const config of [NATIONAL_PLATFORM_CONFIG, ...PLATFORM_CONFIGS]) {
      if (this.options.platformIds.length > 0 && !this.options.platformIds.includes(config.id)) {
        continue;
      }

      this.healthStats.set(config.id, {
        platformId: config.id,
        successRate: 100,
        avgResponseTimeMs: 0,
        consecutiveFailures: 0,
        status: 'healthy',
        backoffMultiplier: 1
      });
    }
  }

  async start(): Promise<CrawlResult[]> {
    if (this.isRunning) {
      throw new Error('Crawler is already running');
    }

    this.isRunning = true;
    logger.info('爬虫调度引擎启动');

    const results: CrawlResult[] = [];
    const tasks: Promise<CrawlResult>[] = [];

    for (const [platformId, adapter] of this.adapters) {
      const task = this.crawlPlatform(platformId, adapter);
      tasks.push(task);
      this.queue.add(() => task);
    }

    this.queue.start();

    try {
      const completedResults = await Promise.all(tasks);
      results.push(...completedResults);
    } catch (error) {
      logger.error(`爬虫执行出错: ${(error as Error).message}`);
    } finally {
      await this.cleanup();
    }

    this.isRunning = false;
    return results;
  }

  private async crawlPlatform(platformId: string, adapter: BasePlatformAdapter): Promise<CrawlResult> {
    const config = adapter.getConfig();
    const startTime = Date.now();
    const failedUrls: string[] = [];
    let listCount = 0;
    let detailCount = 0;
    let success = true;
    let error: string | undefined;

    this.emit('platform-start', platformId, config.name);
    logger.info(`[${config.name}] 开始抓取`);

    try {
      const healthStats = this.healthStats.get(platformId)!;

      if (healthStats.status === 'paused') {
        logger.warn(`[${config.name}] 平台已暂停，跳过抓取`);
        return {
          platformId,
          platformName: config.name,
          success: false,
          listCount: 0,
          detailCount: 0,
          failedUrls: [],
          durationMs: 0,
          error: 'Platform paused'
        };
      }

      if (config.requiresLogin) {
        const loggedIn = await adapter.login();
        if (!loggedIn) {
          throw new Error('登录失败');
        }
        logger.info(`[${config.name}] 登录成功`);
      }

      const allListItems: AnnouncementListItem[] = [];
      const maxPages = config.pagination.maxPages;

      for (let pageNum = config.pagination.startPage || 1; pageNum <= maxPages; pageNum++) {
        try {
          const listItems = await adapter.fetchList(pageNum);
          listCount += listItems.length;
          allListItems.push(...listItems);

          this.emit('progress', platformId, pageNum, maxPages);

          if (listItems.length === 0) {
            logger.info(`[${config.name}] 第 ${pageNum} 页无数据，停止翻页`);
            break;
          }

          if (pageNum < maxPages) {
            await adapter['sleep'](500);
          }
        } catch (pageError) {
          logger.error(`[${config.name}] 第 ${pageNum} 页抓取失败: ${(pageError as Error).message}`);
          failedUrls.push(`${config.listUrl}?page=${pageNum}`);
        }
      }

      const newItems = await this.filterNewItems(platformId, allListItems);
      logger.info(`[${config.name}] 发现 ${newItems.length} 条新公告`);

      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        try {
          const announcement = await this.crawlDetailWithRetry(adapter, item);
          if (announcement) {
            detailCount++;

            const parsedAnnouncement = this.parser.parse(announcement);
            await this.changeDetector.detectAndAssociate(parsedAnnouncement);

            const saved = await this.repository.saveAnnouncement(parsedAnnouncement);
            if (saved) {
              this.emit('announcement-crawled', parsedAnnouncement);
              await this.notifier.checkAndNotify(parsedAnnouncement);
            }
          }

          this.emit('progress', platformId, i + 1, newItems.length);
        } catch (detailError) {
          logger.error(`[${config.name}] 详情抓取失败 ${item.detailUrl}: ${(detailError as Error).message}`);
          failedUrls.push(item.detailUrl);
        }
      }

      this.updateHealthStats(platformId, true, Date.now() - startTime);

    } catch (e) {
      success = false;
      error = (e as Error).message;
      logger.error(`[${config.name}] 抓取失败: ${error}`);
      this.updateHealthStats(platformId, false, Date.now() - startTime);
      this.emit('error', platformId, e as Error);
    }

    const durationMs = Date.now() - startTime;
    const result: CrawlResult = {
      platformId,
      platformName: config.name,
      success,
      listCount,
      detailCount,
      failedUrls,
      durationMs,
      error
    };

    this.emit('platform-complete', result);
    logger.info(`[${config.name}] 抓取完成: 列表${listCount}条, 详情${detailCount}条, 耗时${(durationMs / 1000).toFixed(2)}秒`);

    return result;
  }

  private async crawlDetailWithRetry(
    adapter: BasePlatformAdapter,
    item: AnnouncementListItem
  ): Promise<Announcement | null> {
    const task: CrawlTask = {
      platformId: adapter.getConfig().id,
      url: item.detailUrl,
      type: 'detail',
      retries: 0,
      maxRetries: 3
    };

    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        return await adapter.fetchDetail(item.detailUrl);
      } catch (error) {
        task.retries++;
        if (task.retries <= task.maxRetries) {
          const delay = 1000 * Math.pow(2, task.retries - 1);
          logger.warn(`[${adapter.getConfig().name}] 详情重试 (${task.retries}/${task.maxRetries}): ${item.detailUrl}`);
          await adapter['sleep'](delay);
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  private async filterNewItems(
    platformId: string,
    items: AnnouncementListItem[]
  ): Promise<AnnouncementListItem[]> {
    const fingerprints = items.map(item =>
      adapter => adapter['generateFingerprint'](item.detailUrl, item.title)
    );

    const dummyAdapter = this.adapters.get(platformId);
    if (!dummyAdapter) return items;

    const fps = items.map(item => {
      const hash = require('crypto').createHash('sha256');
      hash.update(`${item.detailUrl}|${item.title}`);
      return hash.digest('hex');
    });

    const existingFingerprints = await this.repository.getExistingFingerprints(fps);

    return items.filter((_, index) => !existingFingerprints.has(fps[index]));
  }

  private updateHealthStats(platformId: string, success: boolean, responseTimeMs: number): void {
    const stats = this.healthStats.get(platformId);
    if (!stats) return;

    const config = this.adapters.get(platformId)?.getConfig();
    if (!config) return;

    if (success) {
      stats.consecutiveFailures = 0;
      stats.backoffMultiplier = 1;
    } else {
      stats.consecutiveFailures++;
      stats.backoffMultiplier = Math.min(stats.backoffMultiplier * 2, 16);

      if (stats.consecutiveFailures >= 10) {
        stats.status = 'paused';
        logger.error(`[${config.name}] 连续失败10次，平台已暂停`);
      } else if (stats.consecutiveFailures >= 3) {
        stats.status = 'degraded';
        logger.warn(`[${config.name}] 连续失败${stats.consecutiveFailures}次，已降频`);
      }
    }

    const totalRequests = 100;
    const successCount = success ? totalRequests : totalRequests - 1;
    stats.successRate = Math.round((successCount / totalRequests) * 100);
    stats.avgResponseTimeMs = Math.round((stats.avgResponseTimeMs * 0.9) + (responseTimeMs * 0.1));
    stats.lastCrawlTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  getHealthStats(): Map<string, HealthStats> {
    return new Map(this.healthStats);
  }

  getAdapter(platformId: string): BasePlatformAdapter | undefined {
    return this.adapters.get(platformId);
  }

  getAdapters(): BasePlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  async pausePlatform(platformId: string): Promise<void> {
    const stats = this.healthStats.get(platformId);
    if (stats) {
      stats.status = 'paused';
      logger.info(`平台已暂停: ${platformId}`);
    }
  }

  async resumePlatform(platformId: string): Promise<void> {
    const stats = this.healthStats.get(platformId);
    if (stats) {
      stats.status = 'healthy';
      stats.consecutiveFailures = 0;
      stats.backoffMultiplier = 1;
      logger.info(`平台已恢复: ${platformId}`);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.context.close();
      await this.browser.close();
      await this.repository.close();
      logger.info('资源已清理');
    } catch (error) {
      logger.error(`清理资源失败: ${(error as Error).message}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.queue.pause();
    this.queue.clear();
    await this.cleanup();
    this.isRunning = false;
    logger.info('爬虫已停止');
  }
}
