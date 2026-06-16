const cron = require('node-cron');
const colors = require('colors');

const ScrapeOrchestrator = require('./scraper/orchestrator');
const AlertEngine = require('./alert/engine');
const CliInterface = require('./cli/interface');
const { getDb, taskLogs, closeDb } = require('./store/db');
const { runMigrations } = require('./store/migrations');
const { dbConfig, schedulerConfig, getCarrierList } = require('./config/carriers');
const logger = require('./utils/logger');

class FreightMonitorApp {
  constructor() {
    this.orchestrator = null;
    this.alertEngine = null;
    this.cli = null;
    this.cronJobs = [];
    this.isRunning = false;
  }

  async init() {
    console.log('\n🚢 初始化国际货运运价采集监控系统...\n'.cyan.bold);

    try {
      console.log('📦 初始化数据库...'.yellow);
      runMigrations();
      getDb();
      console.log('✅ 数据库初始化完成\n'.green);

      console.log('⚙️  加载船公司配置...'.yellow);
      const carriers = getCarrierList();
      console.log(`✅ 已加载 ${carriers.length} 家船公司/平台配置\n`.green);

      this.orchestrator = new ScrapeOrchestrator();
      this.alertEngine = new AlertEngine();
      this.cli = new CliInterface();

      this._scheduleCleanup();

      console.log('✅ 系统初始化完成\n'.green.bold);
      
      return true;
    } catch (error) {
      console.error('❌ 系统初始化失败:'.red, error.message);
      logger.error('系统初始化失败', error);
      throw error;
    }
  }

  startScheduledScraping() {
    console.log('\n⏰ 启动定时采集任务...'.yellow);
    
    const carriers = getCarrierList();
    let scheduledCount = 0;

    for (const carrier of carriers) {
      if (carrier.frequency) {
        try {
          const job = cron.schedule(carrier.frequency, async () => {
            logger.info(`定时触发: ${carrier.name} 运价采集`);
            await this._runCarrierScrape(carrier.id);
          }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
          });
          
          this.cronJobs.push({ carrierId: carrier.id, job });
          scheduledCount++;
          logger.info(`已调度 ${carrier.name}: ${carrier.frequency}`);
        } catch (e) {
          logger.warn(`调度失败 ${carrier.name}: ${e.message}`);
        }
      }
    }

    const alertJob = cron.schedule('*/30 * * * *', () => {
      logger.info('定时执行预警检查');
      try {
        const result = this.alertEngine.runAllChecks();
        if (result.totalAlerts > 0) {
          logger.warn(`检测到 ${result.totalAlerts} 条新预警`);
        }
      } catch (e) {
        logger.error('预警检查失败:', e);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.cronJobs.push({ carrierId: 'alert_engine', job: alertJob });

    console.log(`✅ 已启动 ${scheduledCount} 个采集定时任务 + 1 个预警检查任务\n`.green);
    this.isRunning = true;
  }

  async _runCarrierScrape(carrierId) {
    try {
      const result = await this.orchestrator.runAll(['rates', 'space']);
      
      if (result) {
        const alertResult = this.alertEngine.runAllChecks();
        if (alertResult.totalAlerts > 0) {
          logger.warn(`采集完成，检测到 ${alertResult.totalAlerts} 条预警`);
        }
      }
    } catch (error) {
      logger.error(`定时采集失败 (${carrierId}):`, error);
    }
  }

  _scheduleCleanup() {
    const cleanupJob = cron.schedule('0 2 * * *', () => {
      logger.info('执行日志清理...');
      try {
        const deleted = taskLogs.cleanupOldRecords(dbConfig.logRetentionDays);
        logger.info(`已清理 ${deleted} 条旧日志`);
      } catch (e) {
        logger.error('日志清理失败:', e);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.cronJobs.push({ carrierId: 'log_cleanup', job: cleanupJob });
  }

  async startInteractiveMode() {
    await this.cli.start();
  }

  async runOnce(taskTypes = ['rates', 'space']) {
    logger.info('执行单次全量采集...');
    try {
      const result = await this.orchestrator.runAll(taskTypes);
      logger.info(`采集完成: 成功 ${result.success}, 失败 ${result.failed}`);
      
      const alertResult = this.alertEngine.runAllChecks();
      logger.info(`预警检查完成: 新增 ${alertResult.totalAlerts} 条`);
      
      return { scrapeResult: result, alertResult };
    } catch (error) {
      logger.error('单次采集失败:', error);
      throw error;
    }
  }

  async shutdown() {
    console.log('\n\n🛑 正在关闭系统...'.yellow);
    
    console.log('  停止定时任务...'.grey);
    this.cronJobs.forEach(({ job }) => {
      if (job && job.stop) job.stop();
    });
    this.cronJobs = [];

    console.log('  停止采集器...'.grey);
    if (this.orchestrator) {
      await this.orchestrator.stop();
    }

    console.log('  关闭数据库...'.grey);
    closeDb();

    console.log('✅ 系统已安全关闭\n'.green);
    this.isRunning = false;
  }
}

const app = new FreightMonitorApp();

async function main() {
  const args = process.argv.slice(2);
  
  try {
    await app.init();

    if (args.includes('--once')) {
      console.log('\n📋 模式: 单次采集\n'.cyan);
      const taskTypes = args.includes('--rates') ? ['rates'] :
                        args.includes('--space') ? ['space'] :
                        args.includes('--schedules') ? ['schedules'] :
                        args.includes('--surcharges') ? ['surcharges'] :
                        ['rates', 'space'];
      await app.runOnce(taskTypes);
      console.log('\n✅ 单次采集完成\n'.green.bold);
      await app.shutdown();
      process.exit(0);
    }
    
    else if (args.includes('--daemon')) {
      console.log('\n📋 模式: 后台守护进程\n'.cyan);
      app.startScheduledScraping();
      console.log('\n✅ 守护模式已启动，按 Ctrl+C 退出\n'.green);
      
      process.on('SIGINT', async () => {
        await app.shutdown();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        await app.shutdown();
        process.exit(0);
      });
    }
    
    else {
      console.log('\n📋 模式: 交互式菜单\n'.cyan);
      await app.startInteractiveMode();
    }
    
  } catch (error) {
    console.error('\n❌ 系统运行出错:'.red, error.message);
    logger.error('系统运行出错', error);
    
    try {
      await app.shutdown();
    } catch (e) {}
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  FreightMonitorApp,
  app
};
