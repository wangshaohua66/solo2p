import logger from './utils/logger';
import fs from 'fs';
import path from 'path';
import { CrawlScheduler } from './crawler/crawl-scheduler';
import { AlertService } from './notifier/alert-service';
import { CliInterface } from './cli/cli-interface';
import { BrowserPool } from './crawler/browser-pool';
import siteRegistry from './crawler/site-registry';
import repository from './storage/repository';
import { CustomerMapping } from './types';

const CUSTOMERS_CONFIG_PATH = path.join(process.cwd(), 'config', 'customers.json');

class PolicyMonitorApp {
  private scheduler: CrawlScheduler;
  private alertService: AlertService;
  private cli: CliInterface;
  private browserPool: BrowserPool;

  constructor() {
    logger.info('='.repeat(60));
    logger.info('社保公积金政策自动化监控系统启动中...');
    logger.info('='.repeat(60));

    this.alertService = new AlertService();
    this.browserPool = new BrowserPool(3);
    this.scheduler = new CrawlScheduler(this.alertService, this.browserPool);
    this.cli = new CliInterface(this.scheduler);

    this.setupConfigListeners();
  }

  private loadCustomers(): void {
    try {
      if (!fs.existsSync(CUSTOMERS_CONFIG_PATH)) {
        logger.warn('Customers config file not found');
        return;
      }
      const raw = fs.readFileSync(CUSTOMERS_CONFIG_PATH, 'utf-8');
      const customers: CustomerMapping[] = JSON.parse(raw);
      let loaded = 0;
      for (const c of customers) {
        repository.upsertCustomer(c);
        loaded++;
      }
      logger.info(`Loaded ${loaded} customer mappings from config file`);
    } catch (err) {
      logger.error(`Failed to load customers config: ${(err as Error).message}`);
    }
  }

  private setupConfigListeners(): void {
    siteRegistry.onConfigChange((sites) => {
      logger.info(`Site config updated: ${sites.length} sites now active`);
    });
  }

  async start(): Promise<void> {
    try {
      this.loadCustomers();

      logger.info('初始化浏览器池（3个实例复用）...');
      await this.browserPool.init();
      logger.info('浏览器池初始化完成');

      const siteCount = siteRegistry.getEnabledSites().length;
      const provinceCount = siteRegistry.getProvinces().length;

      logger.info(`已加载 ${siteCount} 个监控站点，覆盖 ${provinceCount} 个省份`);

      this.scheduler.setupCronJobs();
      logger.info('定时任务已启动: 工作日 08:00 / 12:00 / 17:00 + 每周日 03:00 数据清理');

      this.cli.start();

      const recentChanges = repository.getRecentChanges(5);
      if (recentChanges.length > 0) {
        logger.info(`数据库中已有 ${recentChanges.length} 条近期变更记录`);
      }

      const args = process.argv.slice(2);
      if (args.includes('--now') || args.includes('-n')) {
        logger.info('立即执行一次巡检...');
        await this.scheduler.startCrawl();
      }

    } catch (err) {
      logger.error(`启动失败: ${(err as Error).message}`);
      logger.error((err as Error).stack || '');
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('正在关闭系统...');
    this.scheduler.destroy();
    await this.browserPool.closeAll().catch(err => {
      logger.error(`Browser pool shutdown error: ${err.message}`);
    });
    repository.close();
    siteRegistry.destroy();
    logger.info('系统已安全关闭');
  }
}

const app = new PolicyMonitorApp();

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在优雅退出...');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在优雅退出...');
  await app.shutdown();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error(`未捕获的异常: ${err.message}`, { error: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未处理的 Promise 拒绝: ${reason}`, { promise });
});

app.start().catch(err => {
  logger.error(`启动失败: ${err.message}`);
  process.exit(1);
});

export { app };
export default app;
