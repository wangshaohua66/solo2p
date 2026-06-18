import { chromium, Browser } from 'playwright';
import logger from '../utils/logger';
import { sleep } from '../utils/helpers';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

export interface BrowserWorker {
  id: number;
  browser: Browser;
  userAgent: string;
  inUse: boolean;
}

export class BrowserPool {
  private workers: BrowserWorker[] = [];
  private poolSize: number;
  private initialized: boolean = false;
  private waitQueue: Array<{ resolve: (worker: BrowserWorker) => void }> = [];

  constructor(poolSize: number = 3) {
    this.poolSize = Math.max(1, Math.min(10, poolSize));
  }

  async init(): Promise<void> {
    if (this.initialized) {
      logger.warn('Browser pool already initialized');
      return;
    }

    logger.info(`Initializing browser pool with ${this.poolSize} instances`);

    for (let i = 0; i < this.poolSize; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1366,768'
        ]
      });

      const userAgent = USER_AGENTS[i % USER_AGENTS.length];

      this.workers.push({
        id: i,
        browser,
        userAgent,
        inUse: false
      });

      logger.info(`Browser worker #${i} initialized`);
    }

    this.initialized = true;
    logger.info(`Browser pool ready with ${this.workers.length} instances`);
  }

  async acquire(): Promise<BrowserWorker> {
    if (!this.initialized) {
      await this.init();
    }

    const available = this.workers.find(w => !w.inUse);
    if (available) {
      available.inUse = true;
      logger.debug(`Acquired browser worker #${available.id}`);
      return available;
    }

    logger.debug('No available browser worker, waiting in queue...');
    return new Promise<BrowserWorker>(resolve => {
      this.waitQueue.push({ resolve });
    });
  }

  release(worker: BrowserWorker): void {
    worker.inUse = false;
    logger.debug(`Released browser worker #${worker.id}`);

    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      worker.inUse = true;
      next.resolve(worker);
      logger.debug(`Reassigned browser worker #${worker.id} to waiting request`);
    }
  }

  getWorkerCount(): number {
    return this.workers.length;
  }

  getAvailableCount(): number {
    return this.workers.filter(w => !w.inUse).length;
  }

  async runExclusive<T>(task: (worker: BrowserWorker) => Promise<T>): Promise<T> {
    const worker = await this.acquire();
    try {
      return await task(worker);
    } finally {
      this.release(worker);
    }
  }

  async closeAll(): Promise<void> {
    logger.info(`Closing browser pool (${this.workers.length} instances)`);

    this.waitQueue = [];

    for (const worker of this.workers) {
      try {
        await worker.browser.close();
        logger.info(`Browser worker #${worker.id} closed`);
      } catch (err) {
        logger.error(`Failed to close browser worker #${worker.id}: ${(err as Error).message}`);
      }
    }

    this.workers = [];
    this.initialized = false;
    logger.info('Browser pool closed');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export default BrowserPool;
