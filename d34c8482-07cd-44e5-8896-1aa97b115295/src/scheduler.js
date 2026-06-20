const schedule = require('node-schedule');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const chalk = require('chalk');

const config = require('../config/default.json');
const sitesConfig = require('../config/sites.json');

class Scheduler {
  constructor(storage, crawler, comparator, options = {}) {
    this.storage = storage;
    this.crawler = crawler;
    this.comparator = comparator;
    this.options = { ...config.scheduler, ...options };
    this.jobs = new Map();
    this.isRunning = false;
    this.currentRun = null;
    this.logger = this._initLogger();
    this.startTime = null;
  }

  _initLogger() {
    const logDir = path.resolve(config.app.logsDir);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    return winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, `scheduler-${dayjs().format('YYYY-MM-DD')}.log`),
          maxsize: 100 * 1024 * 1024,
          maxFiles: 30
        })
      ]
    });
  }

  getAllSites() {
    const sites = [];
    for (const category of sitesConfig.categories) {
      for (const site of category.sites) {
        sites.push({ ...site, category: category.id });
      }
    }
    return sites;
  }

  async syncSitesToDB() {
    const sites = this.getAllSites();
    for (const site of sites) {
      await this.storage.upsertMonitoredSite(site);
    }
    this.logger.info(`同步 ${sites.length} 个监控站点到数据库`);
    return sites;
  }

  registerJobs() {
    if (!this.options.enabled) {
      this.logger.warn('定时调度已禁用');
      return;
    }

    for (const round of this.options.rounds) {
      const jobId = `round_${round.name}_${uuidv4().slice(0, 8)}`;

      try {
        const job = schedule.scheduleJob(round.time, () => {
          this._executeRound(round).catch((err) => {
            this.logger.error(`定时任务异常 [${round.name}]: ${err.message}`);
          });
        });

        this.jobs.set(jobId, { job, round, id: jobId });
        this.logger.info(
          `已注册定时任务: ${chalk.cyan(round.name)} - Cron: ${chalk.gray(round.time)} - 下次执行: ${chalk.green(job.nextInvocation().toLocaleString())}`
        );
      } catch (err) {
        this.logger.error(`注册定时任务失败 [${round.name}]: ${err.message}`);
      }
    }
  }

  async _executeRound(round) {
    if (this.isRunning) {
      this.logger.warn(`上一轮任务未完成，跳过本轮: ${round.name}`);
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    const roundId = uuidv4();

    this.logger.info(
      `\n${chalk.bgMagenta.white.bold(` ========== 开始执行 [${round.name}] ========== `)}`
    );
    this.logger.info(`轮次ID: ${roundId} | 开始时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);

    try {
      const allSites = await this.syncSitesToDB();
      const taskId = await this.storage.createCrawlTask({
        round_name: round.name,
        batch_id: roundId,
        status: 'running'
      });

      let totalArticles = 0;
      let totalSuccess = 0;
      let totalFailed = 0;
      let suspectedCount = 0;

      const crawlResults = await this.crawler.crawlMultipleSites(allSites, {
        priorityBatch: this.options.priorityBatch,
        onSiteComplete: async (result) => {
          totalArticles += result.totalLinks || 0;
          totalSuccess += result.successCount || 0;
          totalFailed += result.failedCount || 0;

          if (result.success && result.articles) {
            this.logger.info(
              `  → 站点 ${chalk.yellow(result.siteName)}: ` +
              `${chalk.green(result.successCount)}成功 / ` +
              `${chalk.red(result.failedCount)}失败 / ` +
              `${chalk.cyan(result.durationSeconds)}s`
            );

            const articlesWithId = result.articles.map((a, i) => ({
              ...a,
              id: a.crawled_id || (i + 1),
              site_id: result.siteId
            }));

            if (articlesWithId.length > 0) {
              const compareResult = await this.comparator.compareAllArticles(articlesWithId, {
                onProgress: (p) => {
                  if (p.current % 20 === 0 || p.current === p.total) {
                    this.logger.debug(
                      `    比对进度: ${p.current}/${p.total} - 疑似: ${chalk.red(p.suspected)}`
                    );
                  }
                }
              });

              suspectedCount += compareResult.suspected;
              this.logger.info(
                `    比对完成: ${compareResult.comparisons}次比对, ` +
                `${chalk.red(compareResult.suspected)}条疑似, ` +
                `平均耗时 ${chalk.cyan(compareResult.avg_time_ms)}ms`
              );
            }
          }

          await this.storage.updateCrawlTask(taskId, {
            checkpoint: {
              lastSite: result.siteId,
              articlesFound: totalArticles,
              suspectedCount
            }
          });

          const elapsed = (Date.now() - this.startTime) / 1000;
          const maxDuration = this.options.maxDurationHours * 3600;
          if (elapsed > maxDuration) {
            this.logger.warn(`已超过最大执行时长(${this.options.maxDurationHours}h)，中止本轮`);
            throw new Error('MAX_DURATION_EXCEEDED');
          }
        },
        onProgress: (p) => {
          // Progress handled per-site
        }
      });

      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      const crawlerStats = await this.crawler.getStats();

      await this.storage.updateCrawlTask(taskId, {
        status: 'completed',
        total_articles: totalArticles,
        success_count: totalSuccess,
        failed_count: totalFailed,
        suspected_count: suspectedCount,
        end_time: dayjs().format(),
        duration_seconds: durationSeconds
      });

      this.logger.info(
        `\n${chalk.bgGreen.white.bold(` ========== [${round.name}] 完成 ========== `)}`
      );
      this.logger.info(`总站点: ${crawlResults.length}`);
      this.logger.info(`抓取链接: ${totalArticles} | 成功: ${chalk.green(totalSuccess)} | 失败: ${chalk.red(totalFailed)}`);
      this.logger.info(`疑似侵权: ${chalk.red(suspectedCount)} 条`);
      this.logger.info(`请求成功率: ${chalk.cyan(crawlerStats.successRate)}`);
      this.logger.info(`总耗时: ${chalk.cyan(this._formatDuration(durationSeconds))}`);

      this.currentRun = {
        round: round.name,
        roundId,
        taskId,
        totalArticles,
        totalSuccess,
        totalFailed,
        suspectedCount,
        durationSeconds
      };

      return this.currentRun;
    } catch (err) {
      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);

      if (err.message !== 'MAX_DURATION_EXCEEDED') {
        this.logger.error(`轮次执行异常: ${err.message}`, err.stack);
      }

      if (this.currentRun) {
        await this.storage.updateCrawlTask(this.currentRun.taskId, {
          status: 'interrupted',
          end_time: dayjs().format(),
          duration_seconds: durationSeconds,
          error_message: err.message
        });
      }

      this.logger.error(
        `\n${chalk.bgRed.white.bold(` [${round.name}] 中断: ${err.message} `)}`
      );

      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  async runNow(roundName = '手动巡检') {
    return this._executeRound({ name: roundName, time: 'manual' });
  }

  async runSingleSite(siteId, options = {}) {
    const allSites = await this.syncSitesToDB();
    const site = allSites.find((s) => s.id === siteId);

    if (!site) {
      throw new Error(`未找到站点: ${siteId}`);
    }

    this.isRunning = true;
    this.startTime = Date.now();

    this.logger.info(`\n${chalk.bgBlue.white(` 单站点测试: ${site.name} `)}`);

    try {
      const taskId = await this.storage.createCrawlTask({
        round_name: options.roundName || '单站点测试',
        site_id: siteId,
        status: 'running'
      });

      const result = await this.crawler.crawlSite(site, {
        maxArticles: options.maxArticles || 5,
        onProgress: options.onProgress
      });

      let suspectedCount = 0;
      if (result.success && result.articles) {
        const articlesWithId = result.articles.map((a, i) => ({
          ...a,
          id: a.crawled_id || (i + 1),
          site_id: site.id
        }));

        if (articlesWithId.length > 0) {
          const compareResult = await this.comparator.compareAllArticles(articlesWithId, {
            onProgress: options.onCompareProgress
          });
          suspectedCount = compareResult.suspected;
        }
      }

      const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      await this.storage.updateCrawlTask(taskId, {
        status: result.success ? 'completed' : 'failed',
        total_articles: result.totalLinks || 0,
        success_count: result.successCount || 0,
        failed_count: result.failedCount || 0,
        suspected_count: suspectedCount,
        end_time: dayjs().format(),
        duration_seconds: durationSeconds,
        error_message: result.error || null,
        checkpoint: result.checkpoint
      });

      return { ...result, suspectedCount, durationSeconds, taskId };
    } finally {
      this.isRunning = false;
    }
  }

  getRunningStatus() {
    return {
      isRunning: this.isRunning,
      currentRun: this.currentRun,
      nextRuns: Array.from(this.jobs.values()).map(({ round, job }) => ({
        name: round.name,
        cron: round.time,
        nextRun: job ? job.nextInvocation().toISOString() : null
      })),
      uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  }

  listJobs() {
    return Array.from(this.jobs.values()).map(({ id, round, job }) => ({
      id,
      name: round.name,
      cron: round.time,
      nextRun: job ? job.nextInvocation().toISOString() : null
    }));
  }

  cancelJob(jobId) {
    const entry = this.jobs.get(jobId);
    if (entry && entry.job) {
      entry.job.cancel();
      this.jobs.delete(jobId);
      this.logger.info(`已取消任务: ${entry.round.name}`);
      return true;
    }
    return false;
  }

  cancelAllJobs() {
    for (const [id, entry] of this.jobs) {
      if (entry.job) entry.job.cancel();
      this.jobs.delete(id);
    }
    this.logger.info('已取消所有定时任务');
  }

  _formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}

module.exports = Scheduler;
