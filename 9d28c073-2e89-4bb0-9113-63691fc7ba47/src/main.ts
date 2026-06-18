import logger from './utils/logger';
import { CrawlScheduler } from './crawler/crawl-scheduler';
import { AlertService } from './notifier/alert-service';
import { CliInterface } from './cli/cli-interface';
import siteRegistry from './crawler/site-registry';
import repository from './storage/repository';

class PolicyMonitorApp {
  private scheduler: CrawlScheduler;
  private alertService: AlertService;
  private cli: CliInterface;

  constructor() {
    logger.info('='.repeat(60));
    logger.info('社保公积金政策自动化监控系统启动中...');
    logger.info('='.repeat(60));

    this.alertService = new AlertService();
    this.scheduler = new CrawlScheduler(this.alertService);
    this.cli = new CliInterface(this.scheduler);

    this.setupConfigListeners();
  }

  private setupConfigListeners(): void {
    siteRegistry.onConfigChange((sites) => {
      logger.info(`Site config updated: ${sites.length} sites now active`);
    });
  }

  async start(): Promise<void> {
    try {
      const siteCount = siteRegistry.getEnabledSites().length;
      const provinceCount = siteRegistry.getProvinces().length;

      logger.info(`已加载 ${siteCount} 个监控站点，覆盖 ${provinceCount} 个省份`);

      this.scheduler.setupCronJobs();
      logger.info('定时任务已启动: 工作日 08:00 / 12:00 / 17:00');

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
