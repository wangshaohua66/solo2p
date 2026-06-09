import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { db } from '../storage/db';
import { authManager } from '../common/authManager';
import { amazonAdapter } from '../platforms/amazon';
import { ebayAdapter } from '../platforms/ebay';
import { shopeeAdapter } from '../platforms/shopee';
import { lazadaAdapter } from '../platforms/lazada';
import { tiktokAdapter } from '../platforms/tiktok';
import type { PlatformType, SKUData, ListingResult, TaskConfig, PlatformAdapter } from '../../types';

const logger = createLogger('task-scheduler');

export interface TaskProgress {
  total: number;
  completed: number;
  failed: number;
  active: number;
  currentSKU?: string;
  currentPlatform?: PlatformType;
}

export interface PlatformQueueItem {
  sku: SKUData;
  platform: PlatformType;
  site: string;
  priority: number;
  retryCount: number;
}

class TaskScheduler extends EventEmitter {
  private taskConfig: TaskConfig | null = null;
  private platformAdapters: Map<PlatformType, PlatformAdapter>;
  private platformQueues: Map<PlatformType, PlatformQueueItem[]>;
  private activeTasks: Set<string>;
  private isRunning: boolean;
  private isPaused: boolean;
  private progress: TaskProgress;
  private maxConcurrentPerPlatform: number;
  private results: ListingResult[];

  constructor() {
    super();
    this.platformAdapters = new Map();
    this.platformQueues = new Map();
    this.activeTasks = new Set();
    this.isRunning = false;
    this.isPaused = false;
    this.progress = { total: 0, completed: 0, failed: 0, active: 0 };
    this.maxConcurrentPerPlatform = 3;
    this.results = [];
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    this.platformAdapters.set('amazon', amazonAdapter);
    this.platformAdapters.set('ebay', ebayAdapter);
    this.platformAdapters.set('shopee', shopeeAdapter);
    this.platformAdapters.set('lazada', lazadaAdapter);
    this.platformAdapters.set('tiktok', tiktokAdapter);

    for (const platform of this.platformAdapters.keys()) {
      this.platformQueues.set(platform, []);
    }
  }

  public async initialize(config: TaskConfig): Promise<void> {
    this.taskConfig = config;
    this.maxConcurrentPerPlatform = config.concurrencyPerPlatform || 3;
    this.results = [];
    this.progress = { total: 0, completed: 0, failed: 0, active: 0 };
    
    for (const queue of this.platformQueues.values()) {
      queue.length = 0;
    }
    this.activeTasks.clear();

    logger.info(`Task scheduler initialized with config: ${config.id}`, {
      platforms: config.platforms,
      batchSize: config.batchSize,
      concurrency: config.concurrencyPerPlatform
    });
  }

  public async loadSKUs(skuList: SKUData[], resumeFrom?: string): Promise<void> {
    if (!this.taskConfig) {
      throw new Error('Scheduler not initialized. Call initialize() first.');
    }

    let startIndex = 0;
    if (resumeFrom) {
      const resumeIndex = skuList.findIndex(s => s.sku === resumeFrom);
      if (resumeIndex > 0) {
        startIndex = resumeIndex;
        logger.info(`Resuming from SKU: ${resumeFrom}, skipping ${startIndex} items`);
      }
    }

    const skusToProcess = skuList.slice(startIndex, startIndex + (this.taskConfig.batchSize || skuList.length));
    
    for (const sku of skusToProcess) {
      for (const platform of this.taskConfig.platforms) {
        const account = authManager.getNextAccount(platform);
        if (!account) {
          logger.warn(`No active account for platform: ${platform}, skipping`);
          continue;
        }

        const sites = account.sites;
        for (const site of sites) {
          const existing = db.getSKUStatus(sku.sku, platform, site);
          if (existing && existing.status === 'active') {
            logger.debug(`SKU ${sku.sku} already active on ${platform} ${site}, skipping`);
            continue;
          }

          if (existing && existing.status === 'manual_review') {
            logger.debug(`SKU ${sku.sku} in manual review on ${platform} ${site}, skipping`);
            continue;
          }

          const retryCount = existing?.retryCount || 0;
          if (retryCount >= 3) {
            logger.warn(`SKU ${sku.sku} failed 3 times on ${platform} ${site}, moving to manual review`);
            db.addToManualQueue({
              sku: sku.sku,
              platform,
              site,
              reason: 'Max retry count exceeded',
              createdAt: Date.now()
            });
            continue;
          }

          const queue = this.platformQueues.get(platform);
          if (queue) {
            queue.push({
              sku,
              platform,
              site,
              priority: 1,
              retryCount
            });
          }
        }
      }
    }

    let total = 0;
    for (const queue of this.platformQueues.values()) {
      total += queue.length;
    }
    this.progress.total = total;

    logger.info(`Loaded ${total} tasks across ${this.taskConfig.platforms.length} platforms`);
    this.emit('progress', this.getProgress());
  }

  public async start(): Promise<ListingResult[]> {
    if (this.isRunning) {
      throw new Error('Scheduler is already running');
    }

    this.isRunning = true;
    this.isPaused = false;
    logger.info('Starting task scheduler');
    this.emit('start');

    await this.processQueues();

    this.isRunning = false;
    logger.info(`Task scheduler completed: ${this.progress.completed} completed, ${this.progress.failed} failed`);
    this.emit('complete', this.results);

    return this.results;
  }

  private async processQueues(): Promise<void> {
    while (this.isRunning && !this.isPaused && this.hasPendingTasks()) {
      for (const [platform, adapter] of this.platformAdapters) {
        if (this.isPaused || !this.isRunning) break;

        const activeCount = this.getActiveCountForPlatform(platform);
        if (activeCount >= this.maxConcurrentPerPlatform) {
          continue;
        }

        if (adapter.isCircuitBreakerOpen()) {
          if (activeCount === 0) {
            logger.warn(`Circuit breaker open for ${platform}, skipping`);
          }
          continue;
        }

        const queue = this.platformQueues.get(platform);
        if (!queue || queue.length === 0) {
          continue;
        }

        const task = queue.shift();
        if (!task) continue;

        this.executeTask(task, adapter)
          .then(result => {
            this.handleTaskResult(task, result);
          })
          .catch(error => {
            this.handleTaskError(task, error);
          });
      }

      if (this.hasActiveTasks()) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    while (this.hasActiveTasks()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async executeTask(item: PlatformQueueItem, adapter: PlatformAdapter): Promise<ListingResult> {
    const taskId = `${item.platform}-${item.sku.sku}-${item.site}-${Date.now()}`;
    this.activeTasks.add(taskId);
    this.progress.active = this.activeTasks.size;
    this.progress.currentSKU = item.sku.sku;
    this.progress.currentPlatform = item.platform;

    logger.info(`Starting task: ${item.sku.sku} on ${item.platform} ${item.site}`, {
      retryCount: item.retryCount
    });
    this.emit('taskStart', item);

    try {
      const account = authManager.getNextAccount(item.platform);
      if (!account) {
        throw new Error(`No account available for ${item.platform}`);
      }

      const result = await adapter.uploadListing(item.sku, account, item.site);
      return result;
    } finally {
      this.activeTasks.delete(taskId);
      this.progress.active = this.activeTasks.size;
    }
  }

  private handleTaskResult(item: PlatformQueueItem, result: ListingResult): void {
    this.results.push(result);

    if (result.status === 'active' || result.status === 'under_review') {
      this.progress.completed++;
      logger.info(`Task completed: ${item.sku.sku} on ${item.platform} ${item.site}`, {
        status: result.status,
        listingId: result.listingId
      });
    } else if (result.status === 'rejected') {
      this.progress.failed++;
      logger.warn(`Task rejected: ${item.sku.sku} on ${item.platform} ${item.site}`, {
        reason: result.rejectReason
      });
    } else if (result.status === 'failed') {
      this.progress.failed++;
      logger.error(`Task failed: ${item.sku.sku} on ${item.platform} ${item.site}`, {
        error: result.errorMessage
      });

      if (item.retryCount < 2) {
        const queue = this.platformQueues.get(item.platform);
        if (queue) {
          queue.push({
            ...item,
            retryCount: item.retryCount + 1,
            priority: 2
          });
          queue.sort((a, b) => b.priority - a.priority);
          logger.info(`Requeued ${item.sku.sku} for retry (attempt ${item.retryCount + 2})`);
          this.progress.failed--;
        }
      } else {
        db.addToManualQueue({
          sku: item.sku.sku,
          platform: item.platform,
          site: item.site,
          reason: result.errorMessage || 'Max retries exceeded',
          createdAt: Date.now()
        });
        logger.warn(`${item.sku.sku} moved to manual review after 3 failures`);
      }
    }

    this.checkCircuitBreaker();
    this.emit('progress', this.getProgress());
    this.emit('taskComplete', item, result);
  }

  private handleTaskError(item: PlatformQueueItem, error: Error): void {
    this.progress.failed++;
    logger.error(`Task error: ${item.sku.sku} on ${item.platform} ${item.site}`, error);

    const result: ListingResult = {
      taskId: '',
      sku: item.sku.sku,
      platform: item.platform,
      accountId: '',
      site: item.site,
      status: 'failed',
      errorMessage: error.message,
      startedAt: Date.now(),
      completedAt: Date.now(),
      retryCount: item.retryCount + 1
    };

    this.results.push(result);

    if (item.retryCount < 2) {
      const queue = this.platformQueues.get(item.platform);
      if (queue) {
        queue.push({
          ...item,
          retryCount: item.retryCount + 1,
          priority: 2
        });
        queue.sort((a, b) => b.priority - a.priority);
        logger.info(`Requeued ${item.sku.sku} for retry (attempt ${item.retryCount + 2})`);
        this.progress.failed--;
      }
    } else {
      db.addToManualQueue({
        sku: item.sku.sku,
        platform: item.platform,
        site: item.site,
        reason: error.message,
        createdAt: Date.now()
      });
    }

    this.checkCircuitBreaker();
    this.emit('progress', this.getProgress());
    this.emit('taskError', item, error);
  }

  private checkCircuitBreaker(): void {
    const total = this.progress.completed + this.progress.failed;
    if (total < 10) return;

    const errorRate = this.progress.failed / total;
    const threshold = parseFloat(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '0.3');

    if (errorRate >= threshold) {
      logger.error(`Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(threshold * 100)}%, circuit breaker triggered`);
      this.emit('circuitBreakerOpen', errorRate);
      this.stop();
    }
  }

  private hasPendingTasks(): boolean {
    for (const queue of this.platformQueues.values()) {
      if (queue.length > 0) return true;
    }
    return false;
  }

  private hasActiveTasks(): boolean {
    return this.activeTasks.size > 0;
  }

  private getActiveCountForPlatform(platform: PlatformType): number {
    let count = 0;
    for (const taskId of this.activeTasks) {
      if (taskId.startsWith(platform + '-')) {
        count++;
      }
    }
    return count;
  }

  public getProgress(): TaskProgress {
    return { ...this.progress };
  }

  public pause(): void {
    this.isPaused = true;
    logger.info('Task scheduler paused');
    this.emit('pause');
  }

  public resume(): void {
    this.isPaused = false;
    logger.info('Task scheduler resumed');
    this.emit('resume');
    this.processQueues();
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    logger.info('Task scheduler stopped');
    this.emit('stop');
  }

  public async close(): Promise<void> {
    this.stop();

    for (const adapter of this.platformAdapters.values()) {
      try {
        await adapter.close();
      } catch (e) {
        logger.error('Error closing adapter', e);
      }
    }

    logger.info('Task scheduler closed');
  }

  public getResults(): ListingResult[] {
    return [...this.results];
  }
}

export const taskScheduler = new TaskScheduler();

export default TaskScheduler;
