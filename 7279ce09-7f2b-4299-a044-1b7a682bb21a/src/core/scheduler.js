import schedule from 'node-schedule';
import PQueue from 'p-queue';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { getSitesByPriority, getSiteByName } from '../config/sites.js';
import { createBrowser, releaseBrowser, injectCookies, takeScreenshot, hasActiveBrowser } from './browser.js';
import { traverseListPage, closePopups, waitForDynamicContent } from './navigator.js';
import { getParser } from '../parsers/index.js';
import { filterAuctions } from './filter.js';
import alertManager from './alert.js';

const logger = createLogger('Scheduler');

const MAX_CONCURRENCY = 4;
const MAX_RETRIES = 3;
const SITE_TIMEOUT = 3 * 60 * 1000;
const RETRY_BASE_DELAY = 60 * 1000;

const SITE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  RETRYING: 'retrying',
  FAILED: 'failed',
  SUCCESS: 'success'
};

class AuctionScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.concurrency = options.concurrency || MAX_CONCURRENCY;
    this.maxRetries = options.maxRetries || MAX_RETRIES;
    this.siteTimeout = options.siteTimeout || SITE_TIMEOUT;
    this.retryBaseDelay = options.retryBaseDelay || RETRY_BASE_DELAY;
    this.repository = options.repository || null;
    this.filterConfig = options.filterConfig || {};
    this.demoMode = options.demoMode !== false;

    this.scheduleJobs = new Map();
    this.queue = null;
    this.isRunning = false;
    this.isCancelling = false;

    this.siteStates = new Map();
    this.currentRunStats = null;
    this.runStartTime = null;

    this._initSiteStates();
    this._initQueue();
  }

  _initSiteStates() {
    const sites = getSitesByPriority();
    for (const site of sites) {
      this.siteStates.set(site.name, {
        name: site.name,
        priority: site.priority,
        status: SITE_STATUS.IDLE,
        retryCount: 0,
        consecutiveFailures: 0,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        stats: {
          collected: 0,
          newItems: 0,
          filtered: 0,
          errors: 0
        },
        duration: 0
      });
    }
    logger.info(`[Scheduler] 初始化 ${sites.length} 个站点状态`);
  }

  _initQueue() {
    this.queue = new PQueue({
      concurrency: this.concurrency,
      autoStart: false
    });

    this.queue.on('add', () => {
      logger.debug(`[Scheduler] 任务加入队列，待执行: ${this.queue.size}`);
    });

    this.queue.on('next', () => {
      logger.debug(`[Scheduler] 任务开始执行，剩余: ${this.queue.size}, 进行中: ${this.queue.pending}`);
    });

    this.queue.on('idle', () => {
      logger.info('[Scheduler] 队列空闲，所有任务执行完毕');
    });

    logger.info(`[Scheduler] 并发队列已初始化，并发数: ${this.concurrency}`);
  }

  startSchedule(cronExpression) {
    if (this.scheduleJobs.has('crawl')) {
      logger.warn('[Scheduler] 采集定时任务已存在，先停止旧任务');
      this.stopSchedule();
    }

    const job = schedule.scheduleJob(cronExpression, () => {
      logger.info(`[Scheduler] 定时任务触发，开始执行采集任务`);
      this.runOnce();
    });

    this.scheduleJobs.set('crawl', {
      job,
      cronExpression,
      type: 'crawl'
    });

    this.isRunning = true;
    logger.info(`[Scheduler] 定时任务已启动，Cron: ${cronExpression}`);
    return true;
  }

  startReportSchedule(cronExpression) {
    if (this.scheduleJobs.has('report')) {
      logger.warn('[Scheduler] 日报定时任务已存在，先停止旧任务');
      this._stopJob('report');
    }

    const job = schedule.scheduleJob(cronExpression, () => {
      logger.info('[Scheduler] 定时任务触发，开始生成日报');
      this._generateDailyReport();
    });

    this.scheduleJobs.set('report', {
      job,
      cronExpression,
      type: 'report'
    });

    logger.info(`[Scheduler] 日报定时任务已启动，Cron: ${cronExpression}`);
    return true;
  }

  stopSchedule() {
    for (const [name, jobInfo] of this.scheduleJobs) {
      try {
        jobInfo.job.cancel();
        logger.info(`[Scheduler] 已停止定时任务: ${name}`);
      } catch (error) {
        logger.error(`[Scheduler] 停止定时任务失败: ${name}, ${error.message}`);
      }
    }
    this.scheduleJobs.clear();
    this.isRunning = false;
    logger.info('[Scheduler] 所有定时任务已停止');
    return true;
  }

  _stopJob(jobName) {
    const jobInfo = this.scheduleJobs.get(jobName);
    if (jobInfo) {
      jobInfo.job.cancel();
      this.scheduleJobs.delete(jobName);
      logger.info(`[Scheduler] 已停止定时任务: ${jobName}`);
    }
  }

  async runOnce() {
    if (this.queue.isPaused) {
      this.queue.start();
    }

    if (this.queue.pending > 0 || this.queue.size > 0) {
      logger.warn('[Scheduler] 已有任务在执行中，跳过本次执行');
      return this._buildCurrentStats();
    }

    this.isCancelling = false;
    this.runStartTime = Date.now();
    this._resetRunStats();
    this._resetSiteStats();

    const sites = this._getSitesByPriority();
    logger.info(`[Scheduler] 开始全量采集，共 ${sites.length} 个站点`);

    for (const site of sites) {
      const state = this.siteStates.get(site.name);
      if (state.status === SITE_STATUS.PAUSED) {
        logger.info(`[Scheduler] 站点已暂停，跳过: ${site.name}`);
        continue;
      }

      this.queue.add(() => this._executeSiteWithRetry(site.name));
    }

    if (this.queue.size === 0 && this.queue.pending === 0) {
      logger.warn('[Scheduler] 没有可执行的站点');
      return this._buildCurrentStats();
    }

    this.queue.start();

    try {
      await this.queue.onIdle();
      const stats = this._buildCurrentStats();
      this.emit('allComplete', stats);
      logger.info(`[Scheduler] 全量采集完成，总耗时: ${this._formatDuration(stats.totalDuration)}`);
      return stats;
    } catch (error) {
      logger.error(`[Scheduler] 全量采集异常: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  async runSite(siteName) {
    const site = getSiteByName(siteName);
    if (!site) {
      const error = new Error(`未找到站点: ${siteName}`);
      logger.error(`[Scheduler] ${error.message}`);
      throw error;
    }

    const state = this.siteStates.get(siteName);
    if (state.status === SITE_STATUS.PAUSED) {
      logger.warn(`[Scheduler] 站点已暂停: ${siteName}`);
      return { success: false, reason: 'paused' };
    }

    if (state.status === SITE_STATUS.RUNNING || state.status === SITE_STATUS.RETRYING) {
      logger.warn(`[Scheduler] 站点正在运行中: ${siteName}`);
      return { success: false, reason: 'running' };
    }

    if (this.queue.isPaused) {
      this.queue.start();
    }

    this.isCancelling = false;

    const result = await this._executeSiteWithRetry(siteName);
    return result;
  }

  async _executeSiteWithRetry(siteName) {
    const state = this.siteStates.get(siteName);
    if (!state) {
      const error = new Error(`站点状态不存在: ${siteName}`);
      logger.error(`[Scheduler] ${error.message}`);
      throw error;
    }

    if (state.status === SITE_STATUS.PAUSED) {
      logger.info(`[Scheduler] 站点已暂停，跳过执行: ${siteName}`);
      return { success: false, site: siteName, reason: 'paused' };
    }

    if (this.isCancelling) {
      logger.info(`[Scheduler] 任务已取消，跳过: ${siteName}`);
      return { success: false, site: siteName, reason: 'cancelled' };
    }

    const siteStartTime = Date.now();
    state.retryCount = 0;
    state.lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (this.isCancelling) {
        logger.info(`[Scheduler] 任务已取消，停止重试: ${siteName}`);
        break;
      }

      if (attempt > 0) {
        const delay = this._getRetryDelay(attempt);
        state.status = SITE_STATUS.RETRYING;
        state.retryCount = attempt;
        logger.info(`[Scheduler] 站点 ${siteName} 第 ${attempt} 次重试，等待 ${delay / 1000}秒`);
        await this._sleep(delay);

        if (this.isCancelling) {
          break;
        }
      }

      this.emit('siteStart', {
        site: siteName,
        attempt: attempt + 1,
        startTime: new Date()
      });

      state.status = attempt > 0 ? SITE_STATUS.RETRYING : SITE_STATUS.RUNNING;
      state.lastRunAt = new Date();

      try {
        const result = await this._executeWithTimeout(siteName);

        state.status = SITE_STATUS.SUCCESS;
        state.lastSuccessAt = new Date();
        state.consecutiveFailures = 0;
        state.duration = Date.now() - siteStartTime;

        if (result.stats) {
          state.stats = { ...state.stats, ...result.stats };
        }

        this.emit('siteComplete', {
          site: siteName,
          success: true,
          stats: state.stats,
          duration: state.duration,
          attempt: attempt + 1
        });

        logger.info(`[Scheduler] 站点采集成功: ${siteName}, 耗时: ${this._formatDuration(state.duration)}`);
        return { success: true, site: siteName, stats: state.stats };

      } catch (error) {
        state.lastError = error.message;
        logger.error(`[Scheduler] 站点采集失败: ${siteName}, 第 ${attempt + 1} 次尝试, 错误: ${error.message}`);

        this.emit('siteError', {
          site: siteName,
          error: error.message,
          attempt: attempt + 1,
          maxRetries: this.maxRetries
        });

        if (attempt === this.maxRetries) {
          state.status = SITE_STATUS.FAILED;
          state.consecutiveFailures++;
          state.duration = Date.now() - siteStartTime;

          if (state.consecutiveFailures >= 3) {
            state.status = SITE_STATUS.PAUSED;
            logger.error(`[Scheduler] 站点连续失败 ${state.consecutiveFailures} 次，已自动暂停: ${siteName}`);
            this.emit('sitePaused', {
              site: siteName,
              reason: 'consecutive_failures',
              consecutiveFailures: state.consecutiveFailures
            });
          }

          return { success: false, site: siteName, error: error.message };
        }
      }
    }

    return { success: false, site: siteName, reason: 'cancelled' };
  }

  async _executeWithTimeout(siteName) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`站点采集超时 (${this.siteTimeout / 1000}秒)`));
      }, this.siteTimeout);

      this._crawlSite(siteName)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async _crawlSite(siteName) {
    logger.info(`开始采集站点: ${siteName}`);

    const siteConfig = getSiteByName(siteName);
    if (!siteConfig) {
      throw new Error(`未找到站点配置: ${siteName}`);
    }

    const state = this.siteStates.get(siteName);
    const stats = {
      collected: 0,
      newItems: 0,
      filtered: 0,
      errors: 0
    };

    let driver = null;

    try {
      if (this.demoMode) {
        return await this._crawlSiteDemo(siteName, siteConfig, state, stats);
      }

      driver = await createBrowser(siteName);
      logger.debug(`浏览器已创建: ${siteName}`);

      if (siteConfig.login && siteConfig.login.required) {
        await this._handleLogin(driver, siteConfig);
      }

      const listItems = await traverseListPage(driver, siteConfig, {
        maxPages: siteConfig.pagination.maxPages,
        lastCrawlTime: state.lastSuccessAt
      });

      stats.collected = listItems.length;
      logger.info(`获取到 ${listItems.length} 条列表项: ${siteName}`);

      const parser = getParser(siteName);
      const auctions = [];

      for (let i = 0; i < listItems.length; i++) {
        if (this.isCancelling) break;

        try {
          const item = listItems[i];
          const auctionData = await parser.parseListItem(item);

          if (auctionData && auctionData.title) {
            auctions.push(auctionData);
          }
        } catch (itemError) {
          stats.errors++;
          logger.warn(`解析列表项解析失败 (${i + 1}/${listItems.length}): ${itemError.message}`);
        }
      }

      if (this.repository) {
        for (const auction of auctions) {
          try {
            const result = this.repository.insertOrUpdateAuction({
              ...auction,
              court: siteConfig.name,
              site_name: siteName
            });

            if (result.isNew) {
              stats.newItems++;
            }
          } catch (dbError) {
                stats.errors++;
            logger.warn(`存储标的存储失败: ${dbError.message}`);
          }
        }

        if (stats.newItems > 0) {
          logger.info(`新增 ${stats.newItems} 条标的: ${siteName}`);
        }

        this.repository.recordCrawlLog({
          site_name: siteName,
          crawl_time: new Date().toISOString(),
          total_count: stats.collected,
          new_count: stats.newItems,
          filtered_count: stats.filtered,
          error_count: stats.errors,
          status: 'success',
          duration_ms: Date.now() - state.lastRunAt?.getTime() || 0
        });
      }

      if (Object.keys(this.filterConfig).length > 0 && auctions.length > 0) {
        const filterResult = filterAuctions(auctions, this.filterConfig);
        stats.filtered = filterResult.filtered.length;
        logger.info(`筛选后剩余 ${filterResult.filtered.length} 条高价值标的: ${siteName}`);
      }

      state.stats = stats;
      await releaseBrowser(siteName);

      return {
        success: true,
        stats
      };
    } catch (error) {
      stats.errors++;
      logger.error(`站点采集失败: ${siteName}, ${error.message}`);

      let screenshotPath = null;
      if (driver) {
        try {
          screenshotPath = await takeScreenshot(driver, `error_${siteName}_${Date.now()}`);
          logger.info(`错误截图已保存: ${screenshotPath}`);
        } catch (screenshotError) {
          logger.warn(`截图失败: ${screenshotError.message}`);
        }
      }

      try {
        const errorMsg = error.message || '';
        const isSelectorError = /selector|选择器|waitFor|超时|timeout|not found|找不到/i.test(errorMsg);

        if (isSelectorError) {
          await alertManager.selectorFailed(siteName, errorMsg, screenshotPath, {});
        } else {
          await alertManager.crawlError(siteName, errorMsg, { screenshotPath });
        }
      } catch (alertError) {
        logger.warn(`告警推送失败: ${alertError.message}`);
      }

      throw error;
    }
  }

  async _crawlSiteDemo(siteName, siteConfig, state, stats) {
    logger.info(`[演示模式 - 模拟采集: ${siteName}`);

    const mockCount = Math.floor(Math.random() * 80) + 40;
    stats.collected = mockCount;

    const mockAuctions = this._generateMockAuctions(siteName, mockCount);

    if (this.repository) {
      for (const auction of mockAuctions) {
        try {
          const result = this.repository.insertOrUpdateAuction(auction);
          if (result.isNew) {
            stats.newItems++;
          }
          if (result.isChanged) {
            stats.changed = (stats.changed || 0) + 1;
          }
        } catch (dbError) {
          stats.errors++;
          logger.debug(`存储失败: ${dbError.message}`);
        }
      }

      this.repository.recordCrawlLog({
        site_name: siteName,
        crawl_time: new Date().toISOString(),
        total_count: stats.collected,
        new_count: stats.newItems,
        filtered_count: 0,
        error_count: stats.errors,
        status: 'success',
        duration_ms: Math.floor(Math.random() * 30000) + 5000
      });
    }

    if (Object.keys(this.filterConfig).length > 0 && mockAuctions.length > 0) {
      const filterResult = filterAuctions(mockAuctions, this.filterConfig);
      stats.filtered = filterResult.highValue ? filterResult.highValue.length : 0;
    }

    state.stats = stats;

    await this._sleep(800 + Math.random() * 1500);

    logger.info(`演示采集完成: ${siteName}, 共${stats.collected}条, 新增${stats.newItems}条`);

    return {
      success: true,
      stats
    };
  }

  _generateMockAuctions(siteName, count) {
    const courts = ['朝阳区人民法院', '海淀区人民法院', '东城区人民法院', '西城区人民法院', '丰台区人民法院'];
    const districts = ['朝阳区', '海淀区', '东城区', '西城区', '丰台区', '石景山区', '通州区'];
    const streets = ['建国路', '中关村大街', '长安街', '王府井大街', '三里屯路', '望京街', '国贸路'];
    const rounds = ['一拍', '二拍', '变卖'];
    const statuses = ['即将开始', '进行中', '已结束'];

    const auctions = [];
    const baseTime = Date.now();

    for (let i = 0; i < count; i++) {
      const area = Math.floor(Math.random() * 150) + 50;
      const assessPrice = (Math.floor(Math.random() * 500) + 100) * 10000;
      const discount = 0.5 + Math.random() * 0.4;
      const startPrice = Math.floor(assessPrice * discount);
      const caseNo = `(${new Date().getFullYear()})京${Math.floor(Math.random() * 1000 + 100)
        .toString().padStart(4, '0')}执${Math.floor(Math.random() * 10000).toString().padStart(6, '0')}号`;

      const district = districts[Math.floor(Math.random() * districts.length)];
      const street = streets[Math.floor(Math.random() * streets.length)];
      const buildingNo = Math.floor(Math.random() * 30) + 1;
      const roomNo = Math.floor(Math.random() * 2000) + 101;

      auctions.push({
        court: siteName,
        case_no: caseNo,
        title: `${district}${street}${buildingNo}号${roomNo}室房产`,
        address: `北京市${district}${street}${buildingNo}号${roomNo}室`,
        area: parseFloat(area.toFixed(2)),
        assess_price: assessPrice,
        start_price: startPrice,
        current_price: Math.floor(startPrice * (1 + Math.random() * 0.1)),
        auction_date: new Date(baseTime + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
        round: rounds[Math.floor(Math.random() * rounds.length)],
        court_name: courts[Math.floor(Math.random() * courts.length)],
        notice_url: `https://example.com/auction/${caseNo.replace(/[()]/g, '')}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        bid_count: Math.floor(Math.random() * 50),
        site_name: siteName
      });
    }

    return auctions;
  }

  async _handleLogin(driver, siteConfig) {
    const siteName = siteConfig.name;
    logger.info(`处理登录: ${siteName}`);

    const loginConfig = siteConfig.login;

    try {
      if (loginConfig.loginType === 'cookie' && loginConfig.cookies) {
        await injectCookies(driver, loginConfig.cookies);
        logger.info('Cookie注入完成');
      } else if (loginConfig.loginType === 'password' && loginConfig.username && loginConfig.password) {
        logger.info('使用账号密码登录（待实现具体登录流程');
      } else {
        const reason = '登录配置不完整或登录类型不支持';
        logger.error(`登录失败: ${siteName}, ${reason}`);
        await alertManager.loginFailed(siteName, reason, { loginType: loginConfig.loginType });
        throw new Error(reason);
      }
    } catch (error) {
      logger.error(`登录处理异常: ${siteName}, ${error.message}`);
      await alertManager.loginFailed(siteName, error.message, { loginType: loginConfig.loginType });
      throw error;
    }
  }

  _getRetryDelay(attempt) {
    const delay = this.retryBaseDelay * Math.pow(2, attempt - 1);
    return delay;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const sites = this._getSitesByPriority();
    const siteStatuses = sites.map(site => {
      const state = this.siteStates.get(site.name);
      return state ? this._formatSiteState(state) : null;
    }).filter(Boolean);

    const runningCount = siteStatuses.filter(s =>
      s.status === SITE_STATUS.RUNNING || s.status === SITE_STATUS.RETRYING
    ).length;

    const successCount = siteStatuses.filter(s => s.status === SITE_STATUS.SUCCESS).length;
    const failedCount = siteStatuses.filter(s => s.status === SITE_STATUS.FAILED).length;
    const pausedCount = siteStatuses.filter(s => s.status === SITE_STATUS.PAUSED).length;

    const totalStats = this._aggregateStats();

    return {
      isRunning: this.queue.pending > 0 || this.queue.size > 0,
      isCancelling: this.isCancelling,
      concurrency: this.concurrency,
      pendingTasks: this.queue.size,
      runningTasks: this.queue.pending,
      totalSites: siteStatuses.length,
      runningCount,
      successCount,
      failedCount,
      pausedCount,
      sites: siteStatuses,
      stats: totalStats,
      totalDuration: this.runStartTime ? Date.now() - this.runStartTime : 0,
      scheduleJobs: Array.from(this.scheduleJobs.keys()).map(name => ({
        name,
        cronExpression: this.scheduleJobs.get(name).cronExpression,
        type: this.scheduleJobs.get(name).type,
        nextInvocation: this.scheduleJobs.get(name).job.nextInvocation()
      }))
    };
  }

  getSiteStatus(siteName) {
    const state = this.siteStates.get(siteName);
    if (!state) {
      return null;
    }
    return this._formatSiteState(state);
  }

  _formatSiteState(state) {
    return {
      name: state.name,
      priority: state.priority,
      status: state.status,
      retryCount: state.retryCount,
      consecutiveFailures: state.consecutiveFailures,
      lastRunAt: state.lastRunAt,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      stats: { ...state.stats },
      duration: state.duration
    };
  }

  pauseSite(siteName) {
    const state = this.siteStates.get(siteName);
    if (!state) {
      logger.error(`[Scheduler] 未找到站点: ${siteName}`);
      return false;
    }

    if (state.status === SITE_STATUS.PAUSED) {
      logger.warn(`[Scheduler] 站点已暂停: ${siteName}`);
      return true;
    }

    state.status = SITE_STATUS.PAUSED;
    logger.info(`[Scheduler] 站点已暂停: ${siteName}`);
    return true;
  }

  resumeSite(siteName) {
    const state = this.siteStates.get(siteName);
    if (!state) {
      logger.error(`[Scheduler] 未找到站点: ${siteName}`);
      return false;
    }

    if (state.status !== SITE_STATUS.PAUSED) {
      logger.warn(`[Scheduler] 站点未处于暂停状态: ${siteName}`);
      return true;
    }

    state.status = SITE_STATUS.IDLE;
    state.consecutiveFailures = 0;
    logger.info(`[Scheduler] 站点已恢复: ${siteName}`);
    return true;
  }

  setSitePriority(siteName, priority) {
    const state = this.siteStates.get(siteName);
    if (!state) {
      logger.error(`[Scheduler] 未找到站点: ${siteName}`);
      return false;
    }

    state.priority = priority;
    logger.info(`[Scheduler] 站点优先级已更新: ${siteName} -> ${priority}`);
    return true;
  }

  cancel() {
    logger.info('[Scheduler] 正在取消所有任务...');
    this.isCancelling = true;
    this.queue.pause();
    this.queue.clear();
    logger.info('[Scheduler] 所有任务已取消');
    return true;
  }

  async shutdown() {
    logger.info('[Scheduler] 正在优雅关闭...');

    this.isCancelling = true;
    this.stopSchedule();

    if (this.queue) {
      this.queue.pause();
      this.queue.clear();
    }

    for (const [siteName, state] of this.siteStates) {
      if (state.status === SITE_STATUS.RUNNING || state.status === SITE_STATUS.RETRYING) {
        state.status = SITE_STATUS.IDLE;
        logger.debug(`[Scheduler] 重置站点状态: ${siteName}`);
      }
    }

    this.isRunning = false;
    logger.info('[Scheduler] 已优雅关闭');
    return true;
  }

  _getSitesByPriority() {
    const sites = getSitesByPriority();
    return sites.sort((a, b) => {
      const stateA = this.siteStates.get(a.name);
      const stateB = this.siteStates.get(b.name);
      const priorityA = stateA?.priority ?? a.priority;
      const priorityB = stateB?.priority ?? b.priority;
      return priorityA - priorityB;
    });
  }

  _resetRunStats() {
    this.currentRunStats = {
      totalSites: 0,
      successSites: 0,
      failedSites: 0,
      totalCollected: 0,
      totalNew: 0,
      totalFiltered: 0,
      totalErrors: 0,
      startTime: new Date(),
      endTime: null,
      totalDuration: 0
    };
  }

  _resetSiteStats() {
    for (const state of this.siteStates.values()) {
      state.stats = {
        collected: 0,
        newItems: 0,
        filtered: 0,
        errors: 0
      };
      if (state.status !== SITE_STATUS.PAUSED) {
        state.status = SITE_STATUS.IDLE;
      }
      state.retryCount = 0;
      state.duration = 0;
      state.lastError = null;
    }
  }

  _aggregateStats() {
    const stats = {
      collected: 0,
      newItems: 0,
      filtered: 0,
      errors: 0
    };

    for (const state of this.siteStates.values()) {
      stats.collected += state.stats.collected || 0;
      stats.newItems += state.stats.newItems || 0;
      stats.filtered += state.stats.filtered || 0;
      stats.errors += state.stats.errors || 0;
    }

    return stats;
  }

  _buildCurrentStats() {
    const sites = this._getSitesByPriority();
    const results = [];
    let totalCollected = 0;
    let totalNew = 0;
    let totalFiltered = 0;
    let totalErrors = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const site of sites) {
      const state = this.siteStates.get(site.name);
      if (state) {
        results.push(this._formatSiteState(state));
        totalCollected += state.stats.collected || 0;
        totalNew += state.stats.newItems || 0;
        totalFiltered += state.stats.filtered || 0;
        totalErrors += state.stats.errors || 0;
        if (state.status === SITE_STATUS.SUCCESS) successCount++;
        if (state.status === SITE_STATUS.FAILED) failedCount++;
      }
    }

    return {
      totalSites: sites.length,
      successSites: successCount,
      failedSites: failedCount,
      totalCollected,
      totalNew,
      totalFiltered,
      totalErrors,
      totalDuration: this.runStartTime ? Date.now() - this.runStartTime : 0,
      sites: results
    };
  }

  async _generateDailyReport() {
    logger.info('[Scheduler] 开始生成日报...');

    const stats = this._aggregateStats();
    const report = {
      date: new Date().toISOString().split('T')[0],
      stats,
      sites: Array.from(this.siteStates.values()).map(s => ({
        name: s.name,
        status: s.status,
        lastRunAt: s.lastRunAt,
        lastSuccessAt: s.lastSuccessAt,
        consecutiveFailures: s.consecutiveFailures
      }))
    };

    this.emit('reportGenerated', report);
    logger.info('[Scheduler] 日报生成完成');
    return report;
  }

  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  }
}

export { AuctionScheduler, SITE_STATUS };
export default AuctionScheduler;
