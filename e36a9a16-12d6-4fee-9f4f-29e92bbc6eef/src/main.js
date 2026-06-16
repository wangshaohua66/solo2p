import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import cron from 'node-cron';
import chalk from 'chalk';
import dayjs from 'dayjs';

import logger from './logger.js';
import browserPool from './launcher.js';
import SiteFetcher from './fetcher.js';
import SiteParser from './parser.js';
import keywordMatcher from './matcher.js';
import WechatNotifier from './notifier.js';
import changeTracker from './tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!__dirname || typeof __dirname !== 'string' || __dirname.trim() === '') {
  throw new Error('无法确定当前目录路径 __dirname');
}

function safeJoin(...parts) {
  const validParts = parts.filter(p => p != null && typeof p === 'string' && p.trim() !== '');
  if (validParts.length === 0) {
    throw new Error('路径拼接失败：所有路径段均为空或无效');
  }
  return path.join(...validParts);
}

const configPath = safeJoin(__dirname, '..', 'config', 'sites.yaml');
const keywordsPath = safeJoin(__dirname, '..', 'data', 'keywords.json');

class BidMonitorApp {
  constructor() {
    this.config = null;
    this.fetchers = new Map();
    this.parsers = new Map();
    this.notifier = null;
    this.cronTasks = new Map();
    this.isRunning = false;
    this.scanStartTime = null;
    this.siteResults = new Map();
  }

  async init() {
    logger.info(chalk.cyan('🚀 政府采购公告监控系统启动中...'));

    await this.loadConfig();
    await keywordMatcher.init();
    await changeTracker.init();
    await browserPool.init();

    this.initSites();
    this.initNotifier();
    this.setupFileWatchers();

    logger.info(chalk.green('✅ 系统初始化完成'));
    this.printSystemInfo();
  }

  async loadConfig() {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.parse(fileContent);
      logger.info(`配置文件加载成功, 共 ${this.config.sites?.length || 0} 个站点`);
    } catch (error) {
      logger.error(`加载配置文件失败: ${error.message}`);
      throw error;
    }
  }

  initSites() {
    const sites = this.config.sites || [];
    const globalConfig = this.config.global || {};

    for (const site of sites) {
      const fetcher = new SiteFetcher(site, globalConfig);
      const parser = new SiteParser(site);
      this.fetchers.set(site.id, fetcher);
      this.parsers.set(site.id, parser);
    }
  }

  initNotifier() {
    const wechatConfig = this.config.wechat || {};
    this.notifier = new WechatNotifier(wechatConfig.webhookUrl, {
      retryCount: wechatConfig.retryCount || 3
    });

    if (wechatConfig.webhookUrl) {
      logger.info('企业微信推送已启用');
    } else {
      logger.warn(chalk.yellow('⚠️  企业微信推送未配置（wechat.webhookUrl 为空）'));
    }
  }

  setupFileWatchers() {
    let sitesDebounce = null;
    fs.watch(configPath, (eventType) => {
      if (eventType === 'change') {
        clearTimeout(sitesDebounce);
        sitesDebounce = setTimeout(async () => {
          logger.info(chalk.blue('🔄 检测到站点配置文件变更，正在重新加载...'));
          try {
            await this.loadConfig();
            this.initSites();
            this.scheduleTasks();
            logger.info(chalk.green('✅ 站点配置已热更新'));
          } catch (error) {
            logger.error(`配置热更新失败: ${error.message}`);
          }
        }, 1000);
      }
    });

    let keywordsDebounce = null;
    fs.watch(keywordsPath, (eventType) => {
      if (eventType === 'change') {
        clearTimeout(keywordsDebounce);
        keywordsDebounce = setTimeout(async () => {
          logger.info(chalk.blue('🔄 检测到关键词配置文件变更，正在重新加载...'));
          try {
            await keywordMatcher.loadConfig();
            logger.info(chalk.green('✅ 关键词配置已热更新'));
          } catch (error) {
            logger.error(`关键词配置热更新失败: ${error.message}`);
          }
        }, 1000);
      }
    });

    logger.info('配置文件热更新监听已启动');
  }

  scheduleTasks() {
    for (const task of this.cronTasks.values()) {
      task.stop();
    }
    this.cronTasks.clear();

    const sites = this.config.sites || [];

    for (const site of sites) {
      if (site.schedule) {
        try {
          const task = cron.schedule(site.schedule, async () => {
            logger.info(chalk.cyan(`⏰ 定时任务触发: ${site.name}`));
            await this.crawlSite(site.id);
          }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
          });

          this.cronTasks.set(site.id, task);
          logger.debug(`定时任务已注册: ${site.name} - ${site.schedule}`);
        } catch (error) {
          logger.error(`注册定时任务失败 [${site.name}]: ${error.message}`);
        }
      }
    }

    logger.info(`共注册 ${this.cronTasks.size} 个定时任务`);
  }

  async crawlAllSites() {
    const MAX_DURATION_SECONDS = 480;
    const sites = this.config.sites || [];
    logger.info(chalk.cyan(`📡 开始全量抓取, 共 ${sites.length} 个站点`));

    this.scanStartTime = Date.now();
    this.siteResults.clear();

    const results = [];
    const allAnnouncements = [];
    const allChanges = [];
    let isTimeout = false;

    for (const site of sites) {
      if (isTimeout) {
        results.push({
          siteId: site.id,
          siteName: site.name,
          success: false,
          error: '全量抓取超时，跳过后续站点',
          announcements: [],
          changes: []
        });
        continue;
      }

      try {
        const result = await this.crawlSite(site.id);
        results.push(result);
        allAnnouncements.push(...(result.announcements || []));
        allChanges.push(...(result.changes || []));
      } catch (error) {
        logger.error(`站点抓取失败 [${site.name}]: ${error.message}`);
        results.push({
          siteId: site.id,
          siteName: site.name,
          success: false,
          error: error.message,
          announcements: [],
          changes: []
        });
      }

      const elapsedSeconds = (Date.now() - this.scanStartTime) / 1000;
      if (elapsedSeconds > MAX_DURATION_SECONDS) {
        isTimeout = true;
        logger.error(chalk.red(`⚠️  全量抓取已超时 (${elapsedSeconds.toFixed(1)}s > ${MAX_DURATION_SECONDS}s), 跳过剩余站点`));
      }
    }

    const duration = ((Date.now() - this.scanStartTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.success).length;
    const totalAnnouncements = allAnnouncements.length;
    const totalChanges = allChanges.length;

    if (isTimeout || parseFloat(duration) > MAX_DURATION_SECONDS) {
      logger.error(chalk.red(`⚠️  全量抓取超时告警: 耗时 ${duration}s, 超过约束 ${MAX_DURATION_SECONDS}s (8分钟), 成功 ${successCount}/${sites.length} 个站点`));
    } else {
      logger.info(chalk.green(`✅ 全量抓取完成, 成功 ${successCount}/${sites.length} 个站点, 共 ${totalAnnouncements} 条公告, ${totalChanges} 条变更, 耗时 ${duration}s`));
    }

    return {
      results,
      announcements: allAnnouncements,
      changes: allChanges,
      duration: parseFloat(duration),
      successCount,
      totalSites: sites.length,
      isTimeout,
      timeoutThreshold: MAX_DURATION_SECONDS,
      status: isTimeout ? 'timeout' : 'success'
    };
  }

  async crawlSite(siteId) {
    const site = this.config.sites?.find(s => s.id === siteId);
    if (!site) {
      throw new Error(`未找到站点: ${siteId}`);
    }

    const fetcher = this.fetchers.get(siteId);
    const parser = this.parsers.get(siteId);

    if (!fetcher || !parser) {
      throw new Error(`站点未初始化: ${siteId}`);
    }

    logger.info(chalk.blue(`📡 开始抓取: ${site.name}`));
    const siteStartTime = Date.now();

    try {
      const listHtml = await fetcher.fetchList();
      const listItems = parser.parseList(listHtml);

      logger.info(`  列表页解析完成, 共 ${listItems.length} 条记录`);

      const changes = await changeTracker.checkChanges(listItems, siteId);

      const announcements = [];
      const detailCount = Math.min(listItems.length, 10);

      for (let i = 0; i < detailCount; i++) {
        const item = listItems[i];
        if (!item.link) continue;

        try {
          const detailHtml = await fetcher.fetchDetail(item.link);
          const detail = parser.parseDetail(detailHtml, item);
          announcements.push(detail);
        } catch (detailError) {
          logger.warn(`  详情页抓取失败 [${item.title}]: ${detailError.message}`);
          announcements.push({
            ...item,
            content: '',
            budget: null,
            projectNo: '',
            bidDeadline: null,
            openTime: null,
            qualification: '',
            contact: '',
            detailError: detailError.message
          });
        }
      }

      const duration = ((Date.now() - siteStartTime) / 1000).toFixed(1);

      const result = {
        siteId,
        siteName: site.name,
        success: true,
        count: announcements.length,
        changeCount: changes.length,
        duration: parseFloat(duration),
        announcements,
        changes
      };

      this.siteResults.set(siteId, result);

      logger.info(chalk.green(`  ✅ 抓取完成: ${site.name}, ${announcements.length} 条公告, ${changes.length} 条变更, 耗时 ${duration}s`));

      return result;
    } catch (error) {
      const duration = ((Date.now() - siteStartTime) / 1000).toFixed(1);
      logger.error(chalk.red(`  ❌ 抓取失败: ${site.name}, 错误: ${error.message}, 耗时 ${duration}s`));

      const result = {
        siteId,
        siteName: site.name,
        success: false,
        error: error.message,
        duration: parseFloat(duration),
        announcements: [],
        changes: []
      };

      this.siteResults.set(siteId, result);
      return result;
    }
  }

  async processAndNotify(announcements, options = {}) {
    const { dryRun = false } = options;

    logger.info(chalk.cyan('🔍 开始关键词匹配...'));
    const matchResult = keywordMatcher.matchBatch(announcements);

    logger.info(`  匹配完成: 总 ${matchResult.total} 条, 命中 ${matchResult.matched} 条, 排除 ${matchResult.excluded} 条`);

    for (const item of matchResult.matchedItems) {
      changeTracker.addTrackedProject(item);
    }

    if (dryRun) {
      logger.info(chalk.yellow('⚠️  Dry-run模式，不推送企业微信消息'));
      this.printMatchResult(matchResult);
    } else {
      logger.info(chalk.cyan('📤 推送企业微信消息...'));
      const success = await this.notifier.sendDailyBriefing(matchResult);
      if (success) {
        logger.info(chalk.green('✅ 企业微信推送成功'));
      } else {
        logger.error(chalk.red('❌ 企业微信推送失败'));
      }
      this.printMatchResult(matchResult);
    }

    await changeTracker.saveTrackedProjects();
    return matchResult;
  }

  printMatchResult(matchResult) {
    console.log('\n');
    console.log(chalk.cyan('══════════════════════════════════════════='));
    console.log(chalk.cyan('           📋 每日招标简报预览'));
    console.log(chalk.cyan('══════════════════════════════════════════='));
    console.log();
    console.log(chalk.white(`统计: 总数 ${matchResult.total} | 命中 ${matchResult.matched} | 未命中 ${matchResult.unmatched} | 排除 ${matchResult.excluded}`));
    console.log();

    if (matchResult.matchedItems.length === 0) {
      console.log(chalk.gray('  暂无匹配的招标公告'));
    } else {
      matchResult.matchedItems.slice(0, 10).forEach((item, index) => {
        const score = item.matchInfo?.score?.toFixed(1) || '0';
        const budget = item.budget?.display || '未知';
        const deadline = item.bidDeadline ? dayjs(item.bidDeadline).format('MM-DD') : '未知';

        console.log(chalk.white(`  ${index + 1}. ${item.title}`));
        console.log(chalk.gray(`     💰 ${budget} | ⏰ ${deadline} | ⭐ ${score}分 | 📍 ${item.siteName}`));

        if (item.hasChange || item.isChange || item.isClarification) {
          console.log(chalk.yellow('     ⚠️  有变更/补遗'));
        }
        console.log();
      });

      if (matchResult.matchedItems.length > 10) {
        console.log(chalk.gray(`  ... 还有 ${matchResult.matchedItems.length - 10} 条未显示`));
      }
    }

    console.log();
    console.log(chalk.cyan('══════════════════════════════════════════='));
    console.log();
  }

  printSystemInfo() {
    const stats = browserPool.getStats();
    const matcherStats = keywordMatcher.getStats();
    const trackerStats = changeTracker.getStats();

    console.log('\n');
    console.log(chalk.cyan('╔══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║     政府采购公告监控系统 v1.0          ║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════╣'));
    console.log(chalk.white(`  📡 监控站点: ${this.config.sites?.length || 0} 个`));
    console.log(chalk.white(`  🏷️  业务关键词: ${matcherStats.totalKeywords} 个`));
    console.log(chalk.white(`  📌 关注项目: ${trackerStats.totalTracked} 个`));
    console.log(chalk.white(`  🖥️  浏览器池: ${stats.browserCount}/${stats.maxInstances} 实例`));
    console.log(chalk.white(`  🔔 企业微信: ${this.notifier?.enabled ? '已启用' : '未配置'}`));
    console.log(chalk.cyan('╚══════════════════════════════════════════╝'));
    console.log();
  }

  async start() {
    if (this.isRunning) {
      logger.warn('系统已在运行中');
      return;
    }

    await this.init();
    this.scheduleTasks();
    this.isRunning = true;

    logger.info(chalk.green('🎉 系统已启动，等待定时任务触发'));
    logger.info(chalk.gray('提示: 按 Ctrl+C 停止程序'));
  }

  async runOnce(options = {}) {
    const { dryRun = false, siteId = null } = options;

    await this.init();
    this.isRunning = true;

    let crawlResult;

    if (siteId) {
      logger.info(chalk.blue(`🔬 单站点测试模式: ${siteId}`));
      const result = await this.crawlSite(siteId);
      crawlResult = {
        results: [result],
        announcements: result.announcements || [],
        changes: result.changes || [],
        totalSites: 1,
        successCount: result.success ? 1 : 0
      };
    } else {
      crawlResult = await this.crawlAllSites();
    }

    if (crawlResult.announcements.length > 0) {
      await this.processAndNotify(crawlResult.announcements, { dryRun });
    }

    if (crawlResult.changes && crawlResult.changes.length > 0 && !dryRun) {
      logger.info(chalk.yellow(`⚠️  检测到 ${crawlResult.changes.length} 条变更公告`));
      for (const change of crawlResult.changes) {
        await this.notifier.sendChangeAlert(change.trackedProject, change.type);
      }
    }

    await this.cleanup();
    return crawlResult;
  }

  async cleanup() {
    logger.info('正在清理资源...');
    await browserPool.closeAll();
    this.isRunning = false;
    logger.info('资源清理完成');
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    siteId: null,
    schedule: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--schedule' || arg === '-S') {
      options.schedule = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('--site=') || arg.startsWith('-s=')) {
      const parts = arg.split('=');
      if (parts.length >= 2) {
        const value = parts.slice(1).join('=');
        if (value && value.trim()) {
          options.siteId = value.trim();
        }
      }
    } else if (arg === '--site' || arg === '-s') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          options.siteId = nextArg;
          i++;
        }
      }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
政府采购公告监控系统

用法:
  node src/main.js [选项]

选项:
  --dry-run, -d       试运行模式，仅抓取不推送
  --site <id>, -s     指定单站点测试（支持空格或等号分隔）
  --schedule, -S      启动定时调度模式
  --help, -h          显示帮助信息

示例:
  node src/main.js --dry-run              # 全量抓取，不推送
  node src/main.js --site city-a-ggzy     # 测试单个站点（空格分隔）
  node src/main.js --site=city-a-ggzy     # 测试单个站点（等号分隔）
  npm run test-site -- --site=province-ggzy  # 通过npm脚本测试单站点
  node src/main.js --schedule             # 启动定时任务
  `);
}

async function main() {
  const options = parseArgs();
  const app = new BidMonitorApp();

  try {
    if (options.schedule) {
      await app.start();

      process.on('SIGINT', async () => {
        logger.info('收到停止信号，正在优雅退出...');
        await app.cleanup();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('收到终止信号，正在优雅退出...');
        await app.cleanup();
        process.exit(0);
      });
    } else {
      await app.runOnce(options);
    }
  } catch (error) {
    logger.error(chalk.red(`程序运行失败: ${error.message}`));
    logger.error(error.stack);
    try {
      await app.cleanup();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

main();

export default BidMonitorApp;
