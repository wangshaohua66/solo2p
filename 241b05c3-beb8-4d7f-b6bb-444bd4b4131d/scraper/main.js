#!/usr/bin/env node

const { Command } = require('commander');
const cron = require('node-cron');
const chalk = require('chalk');

const { getBrowserPool } = require('./browser-pool');
const GgzyPlatform = require('./platforms/ggzy');
const ProvincialPlatform = require('./platforms/provincial');
const { getCollusionAnalyzer } = require('./analyzers/collusion');
const { getEvidenceCollector } = require('./evidence');
const { getAlertService } = require('./alert');
const { getReportGenerator } = require('./report');
const { getStore } = require('../db/store');
const logger = require('./utils/logger');
const config = require('../config/config');
const { sleep } = require('./utils/retry');

class SupervisionSystem {
  constructor() {
    this.store = getStore();
    this.analyzer = getCollusionAnalyzer();
    this.evidenceCollector = getEvidenceCollector();
    this.alertService = getAlertService();
    this.reportGenerator = getReportGenerator();
    this.browserPool = null;
    this.platforms = {};
    this.isRunning = false;
    this.stats = {
      totalItems: 0,
      totalRisks: 0,
      currentPlatform: '',
      currentPage: 0,
    };
  }

  async init() {
    logger.info('初始化公共资源交易监督系统...', 'System');

    this.browserPool = await getBrowserPool();
    this.platforms.ggzy = new GgzyPlatform(this.browserPool);
    this.platforms.provincial = new ProvincialPlatform(this.browserPool);

    logger.success('系统初始化完成', 'System');
  }

  async startInspection() {
    if (this.isRunning) {
      logger.warn('巡查任务已在运行中', 'System');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    logger.info('========== 开始巡查 ==========', 'System');
    this._printStatus();

    try {
      for (const [platformName, platform] of Object.entries(this.platforms)) {
        this.stats.currentPlatform = config.platforms[platformName]?.name || platformName;
        logger.info(`开始抓取 ${this.stats.currentPlatform}...`, 'System');

        try {
          await this._crawlPlatform(platformName, platform);
        } catch (error) {
          logger.error(`${this.stats.currentPlatform} 抓取失败: ${error.message}`, 'System');
          this.store.updateCrawlTask(platformName, 'list', {
            status: 'failed',
            error_msg: error.message,
          });
        }
      }

      logger.info('开始风险分析...', 'System');
      const risks = this.analyzer.analyzeAll();
      this.stats.totalRisks += risks.length;

      const highRisks = risks.filter(r => r.riskScore >= config.analysis.highRiskThreshold);
      if (highRisks.length > 0) {
        logger.risk(`发现 ${highRisks.length} 个高危风险事件`, 'System');

        for (const risk of highRisks) {
          await this.alertService.sendHighRiskAlert(risk);
          await sleep(1000);
        }
      }

      this.store.updateCrawlTask('system', 'inspection', {
        status: 'success',
        total_count: this.stats.totalItems,
        last_crawl_date: new Date().toISOString(),
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.success(`========== 巡查完成 ==========`, 'System');
      logger.success(`总耗时: ${duration}秒 | 抓取条目: ${this.stats.totalItems} | 风险事件: ${this.stats.totalRisks}`, 'System');
      this._printStatus();
    } catch (error) {
      logger.error(`巡查任务异常: ${error.message}`, 'System');
      logger.error(error.stack, 'System');
    } finally {
      this.isRunning = false;
    }
  }

  async _crawlPlatform(platformName, platform) {
    const contextWrapper = await this.browserPool.acquire();
    let pageNum = 1;
    let hasNext = true;
    let platformItems = 0;
    const maxPages = config.platforms[platformName]?.maxPages || 200;

    try {
      while (hasNext && pageNum <= maxPages) {
        this.stats.currentPage = pageNum;
        logger.info(`抓取第 ${pageNum} 页...`, this.stats.currentPlatform);

        try {
          const result = await platform.fetchList(pageNum, contextWrapper);
          const newItems = this.store.batchInsertProjects(result.items);

          platformItems += newItems;
          this.stats.totalItems += newItems;

          logger.info(`第 ${pageNum} 页完成，新增 ${newItems} 条记录`, this.stats.currentPlatform);

          hasNext = result.hasNext;
          pageNum++;

          await sleep(500 + Math.random() * 1000);
        } catch (pageError) {
          logger.warn(`第 ${pageNum} 页抓取失败: ${pageError.message}，重试中...`, this.stats.currentPlatform);

          try {
            await this.browserPool.markUnhealthy(contextWrapper, pageError);
            const newContext = await this.browserPool.acquire();
            const result = await platform.fetchList(pageNum, newContext);
            const newItems = this.store.batchInsertProjects(result.items);

            platformItems += newItems;
            this.stats.totalItems += newItems;

            hasNext = result.hasNext;
            pageNum++;
          } catch (retryError) {
            logger.error(`第 ${pageNum} 页重试失败，跳过: ${retryError.message}`, this.stats.currentPlatform);
            pageNum++;
          }
        }

        this._printStatus();
      }

      this.store.updateCrawlTask(platformName, 'list', {
        status: 'success',
        total_count: platformItems,
        last_crawl_date: new Date().toISOString(),
      });

      logger.success(`${this.stats.currentPlatform} 抓取完成，共新增 ${platformItems} 条`, this.stats.currentPlatform);
    } finally {
      await this.browserPool.release(contextWrapper);
    }
  }

  _printStatus() {
    const stats = {
      platform: this.stats.currentPlatform || '-',
      page: this.stats.currentPage,
      items: this.stats.totalItems,
      risks: this.stats.totalRisks,
    };
    logger.status(stats);
  }

  async getStatus() {
    const dbStats = this.store.getStats();
    const poolStats = this.browserPool ? this.browserPool.getStats() : { totalContexts: 0, healthyContexts: 0, totalPages: 0 };
    const tasks = this.store.getCrawlTasks();

    console.log('\n' + chalk.bold.blue('=== 系统状态 ===\n'));

    console.log(chalk.bold('📊 数据统计'));
    console.log(`  项目总数: ${chalk.green(dbStats.projectCount)}`);
    console.log(`  投标人总数: ${chalk.green(dbStats.bidderCount)}`);
    console.log(`  风险事件总数: ${chalk.yellow(dbStats.riskCount)}`);
    console.log(`  高危风险: ${chalk.red.bold(dbStats.highRiskCount)}`);
    console.log(`  今日新增: ${chalk.cyan(dbStats.todayProjects)}\n`);

    console.log(chalk.bold('🌐 浏览器池'));
    console.log(`  上下文总数: ${poolStats.totalContexts}`);
    console.log(`  健康上下文: ${poolStats.healthyContexts}`);
    console.log(`  活跃页面: ${poolStats.totalPages}\n`);

    console.log(chalk.bold('📋 抓取任务'));
    for (const task of tasks) {
      const statusColor = task.status === 'success' ? chalk.green : chalk.red;
      console.log(`  [${statusColor(task.status)}] ${task.platform} - ${task.task_type}`);
      console.log(`    最后更新: ${task.updated_at || '-'}`);
      console.log(`    总数: ${task.total_count || 0}`);
    }
    console.log();

    if (this.isRunning) {
      console.log(chalk.yellow('⚡ 巡查任务正在执行中...\n'));
    }
  }

  startScheduler() {
    logger.info('启动定时巡查调度器...', 'Scheduler');
    logger.info(`工作日每日巡查: ${config.cron.dailyPattern} (${config.cron.timezone})`, 'Scheduler');
    logger.info(`周报生成: ${config.cron.weeklyReportPattern} (${config.cron.timezone})`, 'Scheduler');

    cron.schedule(config.cron.dailyPattern, async () => {
      logger.info('定时任务触发：每日巡查', 'Scheduler');
      try {
        await this.startInspection();
      } catch (error) {
        logger.error(`定时巡查失败: ${error.message}`, 'Scheduler');
      }
    }, {
      timezone: config.cron.timezone,
    });

    cron.schedule(config.cron.weeklyReportPattern, async () => {
      logger.info('定时任务触发：生成周报', 'Scheduler');
      try {
        const { path, stats } = this.reportGenerator.generateWeeklyReport();
        logger.success(`周报已生成: ${path}`, 'Scheduler');
        await this.alertService.sendDailySummary();
      } catch (error) {
        logger.error(`周报生成失败: ${error.message}`, 'Scheduler');
      }
    }, {
      timezone: config.cron.timezone,
    });

    logger.success('调度器已启动，按 Ctrl+C 退出', 'Scheduler');

    process.on('SIGINT', async () => {
      logger.info('正在关闭系统...', 'System');
      if (this.browserPool) {
        await this.browserPool.close();
      }
      this.store.close();
      process.exit(0);
    });
  }

  async generateReport(type = 'weekly') {
    logger.info(`生成${type === 'weekly' ? '周' : '每日'}报告...`, 'Report');

    let result;
    if (type === 'weekly') {
      result = this.reportGenerator.generateWeeklyReport();
    } else {
      result = this.reportGenerator.generateDailyReport();
    }

    logger.success(`报告已生成: ${result.path}`, 'Report');
    console.log(`\n报告路径: ${chalk.cyan(result.path)}\n`);

    return result;
  }

  async close() {
    if (this.browserPool) {
      await this.browserPool.close();
    }
    this.store.close();
  }
}

const program = new Command();
let system = null;

program
  .name('bidding-supervision')
  .description('公共资源交易监督系统 - 多平台抓取与串标风险分析')
  .version('1.0.0');

program
  .command('start')
  .description('启动一次完整巡查')
  .option('-p, --platform <platform>', '指定抓取平台 (ggzy/provincial/all)', 'all')
  .option('--headless <boolean>', '是否无头模式', 'true')
  .action(async (options) => {
    try {
      system = new SupervisionSystem();
      await system.init();
      await system.startInspection();
      await system.close();
    } catch (error) {
      console.error(chalk.red(`启动失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('schedule')
  .description('启动定时调度模式')
  .action(async () => {
    try {
      system = new SupervisionSystem();
      await system.init();
      system.startScheduler();
    } catch (error) {
      console.error(chalk.red(`启动调度器失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成巡查报告')
  .option('-t, --type <type>', '报告类型 (weekly/daily)', 'weekly')
  .action(async (options) => {
    try {
      system = new SupervisionSystem();
      await system.init();
      await system.generateReport(options.type);
      await system.close();
    } catch (error) {
      console.error(chalk.red(`生成报告失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('查看系统状态')
  .action(async () => {
    try {
      system = new SupervisionSystem();
      await system.init();
      await system.getStatus();
      await system.close();
    } catch (error) {
      console.error(chalk.red(`获取状态失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('执行风险分析')
  .option('-y, --year <year>', '指定分析年份')
  .action(async (options) => {
    try {
      system = new SupervisionSystem();
      await system.init();
      const year = options.year || new Date().getFullYear().toString();
      const risks = system.analyzer.analyzeAll(year);
      console.log(`\n分析完成，发现 ${risks.length} 个风险事件\n`);
      for (const risk of risks) {
        const color = risk.riskScore >= 85 ? chalk.red : chalk.yellow;
        console.log(color(`  [${risk.riskScore.toFixed(1)}分] ${risk.riskType}: ${risk.projectName || risk.projectNo}`));
      }
      console.log();
      await system.close();
    } catch (error) {
      console.error(chalk.red(`分析失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});

module.exports = { SupervisionSystem };
