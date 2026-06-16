import { createLogger, closeAllLoggers } from './utils/logger.js';
import {
  printLogo,
  printHelp,
  createSiteProgressBars,
  updateSiteProgress,
  printHighValueAlert,
  printSummaryReport,
  printStatus,
  formatPrice
} from './utils/cli.js';
import config from './config/index.js';
import repository from './store/repository.js';
import AuctionScheduler from './core/scheduler.js';
import { filterAuctions } from './core/filter.js';
import dailyReport from './report/daily-report.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Main');

let scheduler = null;
let progressBars = null;
let isShuttingDown = false;

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || 'start';
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options };
}

function ensureDirectories() {
  const dirs = [
    path.resolve(__dirname, '../data'),
    path.resolve(__dirname, '../data/reports'),
    path.resolve(__dirname, '../logs'),
    path.resolve(__dirname, '../screenshots')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`创建目录: ${dir}`);
    }
  }
}

async function initSystem() {
  logger.info('正在初始化系统...');

  ensureDirectories();

  try {
    await repository.initDb(config.db.path);
    const dbType = repository.getDbType();
    logger.info(`数据存储初始化完成 (${dbType === 'sqlite' ? 'SQLite' : '内存存储'})`);
  } catch (error) {
    logger.error(`数据存储初始化失败: ${error.message}`);
    throw error;
  }

  try {
    scheduler = new AuctionScheduler({
      concurrency: config.crawl.concurrency,
      maxRetries: config.crawl.maxRetries,
      repository: repository,
      filterConfig: config.filter,
      demoMode: process.env.DEMO_MODE !== 'false'
    });
    logger.info('调度器初始化完成');
  } catch (error) {
    logger.error(`调度器初始化失败: ${error.message}`);
    throw error;
  }

  setupSignalHandlers();

  logger.info('系统初始化完成');
}

function setupSignalHandlers() {
  process.on('SIGINT', async () => {
    if (isShuttingDown) {
      logger.warn('收到第二次 SIGINT，强制退出');
      process.exit(1);
    }
    logger.info('收到 SIGINT 信号，正在优雅关闭...');
    await gracefulShutdown();
  });

  process.on('SIGTERM', async () => {
    logger.info('收到 SIGTERM 信号，正在优雅关闭...');
    await gracefulShutdown();
  });

  process.on('uncaughtException', (error) => {
    logger.error(`未捕获的异常: ${error.message}`);
    logger.error(error.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`未处理的 Promise 拒绝: ${reason}`);
  });
}

async function gracefulShutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('开始优雅关闭...');

  try {
    if (scheduler) {
      await scheduler.shutdown();
      logger.info('调度器已关闭');
    }

    if (progressBars) {
      progressBars.multibar.stop();
    }

    repository.closeDb();
    logger.info('数据库已关闭');

    closeAllLoggers();
    logger.info('日志系统已关闭');

    logger.info('系统已优雅关闭');
    process.exit(0);
  } catch (error) {
    logger.error(`优雅关闭失败: ${error.message}`);
    process.exit(1);
  }
}

function setupSchedulerEvents() {
  if (!scheduler) return;

  scheduler.on('siteStart', (data) => {
    logger.debug(`站点开始采集: ${data.site}, 第 ${data.attempt} 次尝试`);
    if (progressBars && progressBars.bars.has(data.site)) {
      const bar = progressBars.bars.get(data.site);
      updateSiteProgress(bar, { status: 'running', collected: 0 });
    }
  });

  scheduler.on('siteComplete', (data) => {
    logger.info(`站点采集完成: ${data.site}, 新增 ${data.stats.newItems} 条`);
    if (progressBars && progressBars.bars.has(data.site)) {
      const bar = progressBars.bars.get(data.site);
      updateSiteProgress(bar, {
        status: 'success',
        collected: data.stats.collected,
        newItems: data.stats.newItems,
        filtered: data.stats.filtered,
        errors: data.stats.errors
      });
    }

    if (data.stats && data.stats.newItems > 0) {
      checkHighValueItems(data.site);
    }
  });

  scheduler.on('siteError', (data) => {
    logger.error(`站点采集错误: ${data.site}, ${data.error}`);
    if (progressBars && progressBars.bars.has(data.site)) {
      const bar = progressBars.bars.get(data.site);
      const status = data.attempt < data.maxRetries ? 'retrying' : 'failed';
      updateSiteProgress(bar, { status, errors: data.attempt });
    }
  });

  scheduler.on('allComplete', (stats) => {
    logger.info('所有站点采集完成');
    if (progressBars) {
      progressBars.multibar.stop();
      progressBars = null;
    }
    printSummaryReport(stats);
  });

  scheduler.on('reportGenerated', (report) => {
    logger.info('日报生成完成');
  });
}

function checkHighValueItems(siteName) {
  try {
    const { list: recentAuctions } = repository.getAuctions(
      {},
      { sortBy: 'created_at', sortOrder: 'desc', pageSize: 20 }
    );

    const filterConfig = {
      ...config.filter,
      highValueThreshold: 4
    };

    const { highValue } = filterAuctions(recentAuctions, filterConfig);

    if (highValue && highValue.length > 0) {
      for (const auction of highValue.slice(0, 3)) {
        printHighValueAlert(auction);
      }
    }
  } catch (error) {
    logger.debug(`检查高价值标的失败: ${error.message}`);
  }
}

async function cmdStart() {
  printLogo();
  logger.info('启动定时服务模式');

  await initSystem();
  setupSchedulerEvents();

  scheduler.startSchedule(config.schedule.crawlSchedule);
  scheduler.startReportSchedule(config.schedule.reportSchedule);

  logger.info(`采集定时任务已启动: ${config.schedule.crawlSchedule}`);
  logger.info(`日报定时任务已启动: ${config.schedule.reportSchedule}`);
  logger.info('按 Ctrl+C 停止服务');

  const status = scheduler.getStatus();
  printStatus(status);
}

async function cmdCrawl(options) {
  printLogo();
  logger.info('启动立即采集模式');

  await initSystem();
  setupSchedulerEvents();

  const siteName = options.site;

  if (siteName) {
    logger.info(`采集单个站点: ${siteName}`);
    progressBars = createSiteProgressBars([siteName]);

    try {
      const result = await scheduler.runSite(siteName);
      if (progressBars) {
        progressBars.multibar.stop();
        progressBars = null;
      }

      const status = scheduler.getStatus();
      printSummaryReport({
        ...status.stats,
        totalSites: 1,
        successSites: result.success ? 1 : 0,
        failedSites: result.success ? 0 : 1,
        totalDuration: status.totalDuration,
        sites: status.sites.filter(s => s.name === siteName)
      });
    } catch (error) {
      logger.error(`采集失败: ${error.message}`);
      if (progressBars) {
        progressBars.multibar.stop();
        progressBars = null;
      }
      process.exit(1);
    }
  } else {
    logger.info('执行全量采集');
    progressBars = createSiteProgressBars();

    try {
      const stats = await scheduler.runOnce();
      printSummaryReport(stats);
    } catch (error) {
      logger.error(`全量采集失败: ${error.message}`);
      if (progressBars) {
        progressBars.multibar.stop();
        progressBars = null;
      }
      process.exit(1);
    }
  }

  await gracefulShutdown();
}

async function cmdReport() {
  printLogo();
  logger.info('生成今日日报');

  await initSystem();

  try {
    const reportData = await dailyReport.buildReportData(repository, {
      days: 1,
      highValueStars: 3
    });

    const html = dailyReport.generateDailyReport(reportData);

    const outputDir = path.resolve(__dirname, '../data/reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const outputPath = path.join(outputDir, `report_${today}.html`);
    dailyReport.saveReport(html, outputPath);

    const stats = reportData.stats;

    console.log('');
    console.log('📊 今日数据统计:');
    console.log(`   总标的数: ${stats.totalCount}`);
    console.log(`   今日新增: ${stats.newCount}`);
    console.log(`   高价值标的: ${stats.highValueCount}`);
    console.log(`   变更记录: ${stats.changedCount}`);
    console.log('');

    if (reportData.highValueAuctions && reportData.highValueAuctions.length > 0) {
      console.log('🌟 高价值标的 Top 10:');
      console.log('');
      reportData.highValueAuctions.slice(0, 10).forEach((auction, index) => {
        const price = auction.start_price || auction.current_price || 0;
        const assessPrice = auction.assess_price || 0;
        const discount = assessPrice > 0 ? ((price / assessPrice) * 100).toFixed(1) : 'N/A';

        console.log(`  ${index + 1}. ${auction.starDisplay || ''} ${auction.title || auction.address || '未知'}`);
        console.log(`     价格: ¥${formatPrice(price)} / 评估: ¥${formatPrice(assessPrice)} (${discount}%)`);
        if (auction.address) {
          console.log(`     地址: ${auction.address}`);
        }
        console.log('');
      });
    }

    console.log(`📄 完整报告已保存: ${outputPath}`);
    console.log('');

    logger.info('日报生成完成');
  } catch (error) {
    logger.error(`生成日报失败: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }

  await gracefulShutdown();
}

async function cmdStatus() {
  printLogo();
  logger.info('查看系统状态');

  await initSystem();

  try {
    const status = scheduler.getStatus();

    const totalCount = repository.countAuctions();

    printStatus({
      ...status,
      totalAuctions: totalCount
    });

    logger.info('状态查询完成');
  } catch (error) {
    logger.error(`状态查询失败: ${error.message}`);
    process.exit(1);
  }

  await gracefulShutdown();
}

async function cmdExport(options) {
  printLogo();
  logger.info('导出数据');

  await initSystem();

  try {
    const format = options.csv ? 'csv' : (options.json ? 'json' : 'csv');
    const outputPath = options.output || path.resolve(__dirname, `../data/auctions_${Date.now()}.${format}`);

    const { list: auctions } = repository.getAuctions(
      {},
      { sortBy: 'created_at', sortOrder: 'desc', pageSize: 10000 }
    );

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (format === 'csv') {
      dailyReport.exportCSV(auctions, outputPath);
    } else {
      fs.writeFileSync(outputPath, JSON.stringify(auctions, null, 2), 'utf-8');
      logger.info(`JSON 导出完成: ${outputPath}, 共 ${auctions.length} 条记录`);
    }

    console.log('');
    console.log(`✅ 数据导出成功！`);
    console.log(`   格式: ${format.toUpperCase()}`);
    console.log(`   数量: ${auctions.length} 条`);
    console.log(`   文件: ${outputPath}`);
    console.log('');
  } catch (error) {
    logger.error(`导出数据失败: ${error.message}`);
    process.exit(1);
  }

  await gracefulShutdown();
}

async function main() {
  const { command, options } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'start':
        await cmdStart();
        break;
      case 'crawl':
        await cmdCrawl(options);
        break;
      case 'report':
        await cmdReport();
        break;
      case 'status':
        await cmdStatus();
        break;
      case 'export':
        await cmdExport(options);
        break;
      case 'help':
      case '--help':
      case '-h':
        printLogo();
        printHelp();
        break;
      default:
        console.log(`未知命令: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error(`命令执行失败: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
