import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';
import {
  ScrapingTask,
  TaskStatus,
  TaskPriority,
  QuoteRequest,
  QuoteResult,
  CustomerInfo,
  CompareResult,
  MultiProductCompareResult,
  RenewalRecord,
  ProductType,
} from '../utils/types';
import { generateId, retryWithBackoff } from '../utils/helpers';
import { PriorityQueue } from '../utils/priority-queue';
import logger from '../utils/logger';
import ScraperFactory from '../scrapers/scraper-factory';
import { QuoteScraper, PolicyScraper } from '../scrapers/base-scraper';
import QuoteComparator from '../engine/comparator';
import RenewalTracker from '../engine/renewal-tracker';
import { getAllCompanyIds } from '../config/profiles';
import { CheckpointManager } from '../utils/checkpoint';

dotenv.config();

export interface TaskRunnerOptions {
  concurrency?: number;
  maxRetries?: number;
  retryDelayBase?: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  taskType: 'quote' | 'renewal' | 'policy';
  config: any;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class TaskRunner extends EventEmitter {
  private static instance: TaskRunner;
  private tasks: Map<string, ScrapingTask> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private queue: any;
  private maxRetries: number;
  private retryDelayBase: number;
  private isRunning: boolean = false;
  private checkpointManager: CheckpointManager;

  private constructor(options?: TaskRunnerOptions) {
    super();
    const concurrency = options?.concurrency ?? parseInt(process.env.MAX_BROWSER_INSTANCES || '4', 10);
    this.maxRetries = options?.maxRetries ?? parseInt(process.env.MAX_RETRY_TIMES || '3', 10);
    this.retryDelayBase = options?.retryDelayBase ?? parseInt(process.env.RETRY_DELAY_BASE || '30000', 10);
    this.checkpointManager = CheckpointManager.getInstance();

    this.queue = new PriorityQueue(concurrency);
  }

  public static getInstance(options?: TaskRunnerOptions): TaskRunner {
    if (!TaskRunner.instance) {
      TaskRunner.instance = new TaskRunner(options);
    }
    return TaskRunner.instance;
  }

  public createQuoteTask(
    companyId: string,
    request: QuoteRequest,
    priority: TaskPriority = 'medium',
    customerId?: string
  ): ScrapingTask {
    const task: ScrapingTask = {
      id: generateId(),
      type: 'quote',
      companyId,
      customerId,
      status: 'pending',
      priority,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };

    this.tasks.set(task.id, task);
    this.checkpointManager.createCheckpointWithId(task.id, 'quote', 5, {
      companyId,
      customerId,
      productType: request.productType,
    });
    logger.info(`创建报价任务: ${task.id} - ${companyId}`);
    return task;
  }

  public createPolicyTask(
    companyId: string,
    priority: TaskPriority = 'medium',
    customerId?: string
  ): ScrapingTask {
    const task: ScrapingTask = {
      id: generateId(),
      type: 'policy',
      companyId,
      customerId,
      status: 'pending',
      priority,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };

    this.tasks.set(task.id, task);
    this.checkpointManager.createCheckpointWithId(task.id, 'policy', 4, {
      companyId,
      customerId,
    });
    logger.info(`创建保单任务: ${task.id} - ${companyId}`);
    return task;
  }

  public createRenewalTask(
    companyId: string,
    priority: TaskPriority = 'high',
    customerId?: string
  ): ScrapingTask {
    const task: ScrapingTask = {
      id: generateId(),
      type: 'renewal',
      companyId,
      customerId,
      status: 'pending',
      priority,
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: this.maxRetries,
    };

    this.tasks.set(task.id, task);
    this.checkpointManager.createCheckpointWithId(task.id, 'renewal', 3, {
      companyId,
      customerId,
    });
    logger.info(`创建续保任务: ${task.id} - ${companyId}`);
    return task;
  }

  public async runQuoteTask(
    taskId: string,
    request: QuoteRequest
  ): Promise<QuoteResult | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.error(`任务不存在: ${taskId}`);
      return null;
    }

    if (task.status === 'running') {
      logger.warn(`任务正在运行中: ${taskId}`);
      return null;
    }

    this.updateTaskStatus(taskId, 'running');
    this.checkpointManager.setStatus(taskId, 'in-progress');

    try {
      const result = await retryWithBackoff(
        async () => {
          const scraper = ScraperFactory.createQuoteScraper(task.companyId, taskId, this.checkpointManager);
          await scraper.initialize();

          scraper.on('progress', (progress: any) => {
            this.updateTaskProgress(taskId, progress.progress, progress.stage);
          });

          const result = await scraper.scrapeQuote(request);
          await scraper.cleanup();
          return result;
        },
        task.maxRetries,
        this.retryDelayBase
      );

      this.updateTaskStatus(taskId, 'completed');
      this.checkpointManager.setStatus(taskId, 'completed');
      return result;
    } catch (error) {
      logger.error(`报价任务执行失败: ${taskId}`, { error: (error as Error).message });
      this.updateTaskStatus(taskId, 'failed', (error as Error).message);
      this.checkpointManager.setStatus(taskId, 'failed');
      return null;
    }
  }

  public async runBatchQuote(
    request: QuoteRequest,
    customer?: CustomerInfo,
    companyIds?: string[]
  ): Promise<CompareResult> {
    const targetCompanies = companyIds || getAllCompanyIds();
    logger.info(`开始批量报价，共 ${targetCompanies.length} 家保险公司`);

    const tasks = targetCompanies.map(companyId => {
      const priority: TaskPriority = 'medium';
      return this.createQuoteTask(companyId, request, priority, customer?.id);
    });

    const results: QuoteResult[] = [];

    const executionPromises = tasks.map(async task => {
      const result = await this.queue.add(
        () => this.runQuoteTask(task.id, request),
        task.priority
      );
      if (result) {
        results.push(result);
      }
      return result;
    });

    await Promise.all(executionPromises);

    const comparator = new QuoteComparator(request.riskLevel);
    const compareResult = comparator.compare(results, request, customer);

    this.emit('batch-quote-complete', {
      request,
      result: compareResult,
    });

    return compareResult;
  }

  public async runBatchMultiProductQuote(
    requestsByProduct: Record<ProductType, QuoteRequest>,
    customer?: CustomerInfo,
    companyIds?: string[]
  ): Promise<MultiProductCompareResult> {
    const productTypes = Object.keys(requestsByProduct) as ProductType[];
    logger.info(`开始多产品并行比价，共 ${productTypes.length} 类产品`);

    const targetCompanies = companyIds || getAllCompanyIds();
    const quotesByProduct: Record<ProductType, QuoteResult[]> = {} as Record<ProductType, QuoteResult[]>;

    const allTasks: { task: ScrapingTask; productType: ProductType }[] = [];

    for (const productType of productTypes) {
      const request = requestsByProduct[productType];
      const tasks = targetCompanies.map(companyId => {
        const task = this.createQuoteTask(companyId, request, 'medium', customer?.id);
        return { task, productType };
      });
      allTasks.push(...tasks);
      quotesByProduct[productType] = [];
    }

    logger.info(`共创建 ${allTasks.length} 个报价任务`);

    const executionPromises = allTasks.map(async ({ task, productType }) => {
      const request = requestsByProduct[productType];
      const result = await this.queue.add(
        () => this.runQuoteTask(task.id, request),
        task.priority
      );
      if (result) {
        quotesByProduct[productType].push(result);
      }
      return result;
    });

    await Promise.all(executionPromises);

    const comparator = new QuoteComparator('medium');
    const multiResult = comparator.compareMultipleProducts(
      quotesByProduct,
      requestsByProduct,
      customer
    );

    this.emit('batch-multi-quote-complete', {
      requests: requestsByProduct,
      result: multiResult,
    });

    return multiResult;
  }

  public async runRenewalCheck(
    customers: CustomerInfo[],
    policies: Map<string, any[]>
  ): Promise<RenewalRecord[]> {
    logger.info(`开始续保检查，共 ${customers.length} 个客户`);

    const tracker = RenewalTracker.getInstance();
    const records = await tracker.checkAllRenewals(customers, policies);

    this.emit('renewal-check-complete', {
      total: records.length,
      records,
    });

    return records;
  }

  public addScheduledTask(task: ScheduledTask): void {
    this.scheduledTasks.set(task.id, task);
    logger.info(`添加定时任务: ${task.name} (${task.cronExpression})`);

    if (task.enabled) {
      this.enableScheduledTask(task.id);
    }
  }

  public enableScheduledTask(taskId: string): void {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      logger.error(`定时任务不存在: ${taskId}`);
      return;
    }

    if (this.cronJobs.has(taskId)) {
      logger.warn(`定时任务已在运行: ${taskId}`);
      return;
    }

    const job = cron.schedule(task.cronExpression, () => {
      this.executeScheduledTask(taskId);
    });

    this.cronJobs.set(taskId, job);
    task.enabled = true;
    task.nextRun = this.getNextRun(task.cronExpression);

    logger.info(`已启用定时任务: ${task.name}`);
  }

  public disableScheduledTask(taskId: string): void {
    const job = this.cronJobs.get(taskId);
    if (job) {
      job.stop();
      this.cronJobs.delete(taskId);
    }

    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = false;
    }

    logger.info(`已禁用定时任务: ${taskId}`);
  }

  private executeScheduledTask(taskId: string): void {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return;

    logger.info(`执行定时任务: ${task.name}`);
    task.lastRun = new Date();
    task.nextRun = this.getNextRun(task.cronExpression);

    this.emit('scheduled-task-run', {
      taskId,
      taskName: task.name,
      taskType: task.taskType,
    });
  }

  private getNextRun(cronExpression: string): Date {
    try {
      const now = new Date();
      const nextDate = new Date(now.getTime() + 60000);
      return nextDate;
    } catch {
      return new Date();
    }
  }

  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    errorMessage?: string
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
    }
    if (status === 'running') {
      task.startedAt = new Date();
    }
    if (errorMessage) {
      task.errorMessage = errorMessage;
    }

    this.emit('task-status-change', {
      taskId,
      status,
      task,
    });

    logger.debug(`任务状态更新: ${taskId} -> ${status}`);
  }

  private updateTaskProgress(taskId: string, progress: number, stage?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = progress;

    this.emit('task-progress', {
      taskId,
      progress,
      stage,
      task,
    });
  }

  public getTask(taskId: string): ScrapingTask | undefined {
    return this.tasks.get(taskId);
  }

  public getAllTasks(): ScrapingTask[] {
    return Array.from(this.tasks.values());
  }

  public getTasksByStatus(status: TaskStatus): ScrapingTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  public getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  public getQueueStats(): { size: number; pending: number; concurrency: number; highPriority?: number; mediumPriority?: number; lowPriority?: number } {
    const stats = this.queue.getQueueStats();
    return stats;
  }

  public pauseTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return false;

    task.status = 'paused';
    logger.info(`任务已暂停: ${taskId}`);
    return true;
  }

  public resumeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    task.status = 'running';
    logger.info(`任务已恢复: ${taskId}`);
    return true;
  }

  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running' || task.status === 'pending') {
      task.status = 'failed';
      task.errorMessage = '任务已取消';
      logger.info(`任务已取消: ${taskId}`);
      return true;
    }

    return false;
  }

  public removeTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  public async shutdown(): Promise<void> {
    logger.info('正在关闭任务调度器...');

    this.cronJobs.forEach(job => job.stop());
    this.cronJobs.clear();

    await this.queue.onIdle();

    this.isRunning = false;
    logger.info('任务调度器已关闭');
  }

  public getConcurrency(): number {
    return this.queue.getConcurrency();
  }

  public setConcurrency(concurrency: number): void {
    this.queue.setConcurrency(concurrency);
    logger.info(`并发数已调整为: ${concurrency}`);
  }
}

export default TaskRunner;
