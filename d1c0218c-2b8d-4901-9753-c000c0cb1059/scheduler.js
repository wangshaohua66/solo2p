const schedule = require('node-schedule');
const dayjs = require('dayjs');
const chalk = require('chalk');
const {
  PLATFORMS,
  PLATFORM_NAMES,
  scheduleConfig,
  inventoryConfig,
  getDateRange
} = require('./config');
const { getOrderFetcher } = require('./orderFetcher');
const { getLogisticsTracker } = require('./logisticsTracker');
const { getInventoryManager } = require('./inventorySync');
const { getStorage } = require('./storage');
const { globalAlertManager } = require('./retryHandler');

const TASK_TYPES = {
  FETCH_ORDERS: 'fetch_orders',
  TRACK_LOGISTICS: 'track_logistics',
  SYNC_INVENTORY: 'sync_inventory',
  DAILY_REPORT: 'daily_report'
};

class TaskScheduler {
  constructor() {
    this.jobs = new Map();
    this.running = false;
    this.concurrencyLimit = scheduleConfig.maxConcurrency;
    this.activeTasks = new Set();
    this.taskQueue = [];
    this.fetchIntervalMinutes = scheduleConfig.pollIntervalMinutes;
    this.lastRunTime = null;
    this.nextRunTime = null;
  }

  _buildCronExpression(minutesInterval) {
    if (minutesInterval >= 1440) {
      const hour = Math.floor(Math.random() * 6);
      return `0 ${hour} * * *`;
    }
    if (minutesInterval >= 60) {
      const hours = Math.floor(minutesInterval / 60);
      return `0 */${hours} * * *`;
    }
    return `*/${minutesInterval} * * * *`;
  }

  _acquireTaskSlot() {
    if (this.activeTasks.size < this.concurrencyLimit) {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.activeTasks.add(taskId);
      return taskId;
    }
    return null;
  }

  _releaseTaskSlot(taskId) {
    this.activeTasks.delete(taskId);
    this._processQueue();
  }

  _processQueue() {
    while (this.taskQueue.length > 0) {
      const slotId = this._acquireTaskSlot();
      if (!slotId) break;

      const queued = this.taskQueue.shift();
      if (!queued) {
        this._releaseTaskSlot(slotId);
        break;
      }

      const { task, resolve, reject } = queued;
      this._executeTask(task, slotId)
        .then(resolve)
        .catch(reject);
    }
  }

  async _executeTask(task, slotId) {
    const startTime = Date.now();
    const timeout = task.timeoutMs || (scheduleConfig.singlePlatformTimeoutMinutes * 60 * 1000);

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`任务超时 (${Math.round(timeout / 60000)} 分钟)`));
      }, timeout);
    });

    try {
      const result = await Promise.race([task.fn(), timeoutPromise]);
      clearTimeout(timeoutHandle);
      return result;
    } catch (err) {
      clearTimeout(timeoutHandle);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      this._releaseTaskSlot(slotId);
    }
  }

  async _enqueueTask(task) {
    const slotId = this._acquireTaskSlot();
    if (slotId) {
      return this._executeTask(task, slotId);
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
    });
  }

  async _runFetchOrdersTask(options = {}) {
    const {
      platforms = PLATFORMS,
      days = 7,
      simulate = false,
      concurrency = this.concurrencyLimit
    } = options;

    console.log(chalk.magenta(`\n[调度器] 执行订单采集任务 @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));

    const dateRange = getDateRange(days);
    const fetcher = getOrderFetcher();

    try {
      const result = await fetcher.fetchAllPlatforms(dateRange, {
        platforms,
        concurrency,
        simulate
      });

      if (result.failed > 0) {
        const failedPlatforms = result.details
          .filter(d => !d.success)
          .map(d => PLATFORM_NAMES[d.platform]);
        console.log(chalk.red(`[调度器] 失败平台: ${failedPlatforms.join(', ')}`));
      }

      return result;
    } catch (err) {
      console.log(chalk.red(`[调度器] 订单采集任务异常: ${err.message}`));
      await globalAlertManager.alertSystemError(err, { task: 'fetch_orders' });
      throw err;
    }
  }

  async _runTrackLogisticsTask(options = {}) {
    const { platforms = PLATFORMS } = options;

    console.log(chalk.magenta(`\n[调度器] 执行物流追踪任务 @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));

    const tracker = getLogisticsTracker();

    try {
      const result = await tracker.trackAllPlatforms({ platforms });
      return result;
    } catch (err) {
      console.log(chalk.red(`[调度器] 物流追踪任务异常: ${err.message}`));
      await globalAlertManager.alertSystemError(err, { task: 'track_logistics' });
      throw err;
    }
  }

  async _runDailyReportTask(options = {}) {
    console.log(chalk.magenta(`\n[调度器] 生成每日报表 @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));

    const storage = await getStorage();
    const { startDateStr, endDateStr } = getDateRange(1);

    try {
      const stats = await storage.getStatistics({
        startDate: startDateStr,
        endDate: endDateStr
      });

      console.log(chalk.cyan(`\n--- 每日统计报表 (${startDateStr}) ---`));
      if (stats.summary.length === 0) {
        console.log(chalk.yellow('  暂无数据'));
      }
      for (const row of stats.summary) {
        const platformName = PLATFORM_NAMES[row.platform] || row.platform;
        console.log(`  ${platformName} | ${row.status} | 订单数:${row.order_count} | 金额:${row.total_amount?.toFixed(2) || 0}`);
      }

      return stats;
    } catch (err) {
      console.log(chalk.red(`[调度器] 每日报表生成异常: ${err.message}`));
      throw err;
    }
  }

  async _runSyncInventoryTask(options = {}) {
    const { platforms = PLATFORMS, cleanupLocks = true } = options;

    console.log(chalk.magenta(`\n[调度器] 执行库存同步任务 @ ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`));

    const inventory = getInventoryManager();

    try {
      if (cleanupLocks) {
        const cleaned = await inventory.cleanupStaleLocks();
        if (cleaned > 0) {
          console.log(chalk.gray(`[库存同步] 清理了 ${cleaned} 个过期锁文件`));
        }
      }

      const results = {};
      for (const platform of platforms) {
        try {
          results[platform] = await inventory.syncPlatformInventory(platform);
        } catch (err) {
          results[platform] = { success: false, error: err.message };
          console.log(chalk.red(`[库存同步] ${PLATFORM_NAMES[platform]} 失败: ${err.message}`));
        }
      }

      const lowStock = await inventory.getLowStockItems();
      if (lowStock.length > 0) {
        console.log(chalk.yellow(`[库存同步] 低库存预警: ${lowStock.length} 个 SKU`));
        for (const inv of lowStock.slice(0, 5)) {
          console.log(chalk.yellow(`  - ${inv.sku} (${PLATFORM_NAMES[inv.platform] || inv.platform}): ${inv.available_quantity}`));
        }
      }

      return { results, low_stock_count: lowStock.length };
    } catch (err) {
      console.log(chalk.red(`[调度器] 库存同步任务异常: ${err.message}`));
      await globalAlertManager.alertSystemError(err, { task: 'sync_inventory' });
      throw err;
    }
  }

  scheduleFetchOrders(options = {}) {
    const interval = options.intervalMinutes || this.fetchIntervalMinutes;
    const cronExpr = this._buildCronExpression(interval);
    const jobKey = TASK_TYPES.FETCH_ORDERS;

    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey).cancel();
    }

    const job = schedule.scheduleJob(cronExpr, (fireDate) => {
      this.lastRunTime = fireDate;
      const nextInv = job.nextInvocation();
      this.nextRunTime = nextInv ? nextInv.toDate() : null;

      console.log(chalk.blue(`\n[定时触发] 订单采集任务，下一次执行: ${this.nextRunTime ? dayjs(this.nextRunTime).format('YYYY-MM-DD HH:mm') : '未知'}`));

      this._enqueueTask({
        fn: () => this._runFetchOrdersTask(options),
        timeoutMs: scheduleConfig.totalCycleTimeoutMinutes * 60 * 1000,
        type: TASK_TYPES.FETCH_ORDERS
      }).catch(err => {
        console.error(chalk.red(`[调度器] 队列任务失败: ${err.message}`));
      });
    });

    this.jobs.set(jobKey, job);
    const nextInv = job.nextInvocation();
    this.nextRunTime = nextInv ? nextInv.toDate() : null;

    console.log(chalk.green(`[调度器] 订单采集任务已配置: 每 ${interval} 分钟执行 (cron: ${cronExpr})`));
    console.log(chalk.green(`  首次执行时间: ${this.nextRunTime ? dayjs(this.nextRunTime).format('YYYY-MM-DD HH:mm:ss') : '立即'}`));

    return job;
  }

  scheduleTrackLogistics(options = {}) {
    const interval = options.intervalMinutes || 30;
    const cronExpr = this._buildCronExpression(interval);
    const jobKey = TASK_TYPES.TRACK_LOGISTICS;

    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey).cancel();
    }

    const job = schedule.scheduleJob(cronExpr, () => {
      console.log(chalk.blue('\n[定时触发] 物流追踪任务'));
      this._enqueueTask({
        fn: () => this._runTrackLogisticsTask(options),
        timeoutMs: 30 * 60 * 1000,
        type: TASK_TYPES.TRACK_LOGISTICS
      }).catch(err => {
        console.error(chalk.red(`[调度器] 物流追踪失败: ${err.message}`));
      });
    });

    this.jobs.set(jobKey, job);
    console.log(chalk.green(`[调度器] 物流追踪任务已配置: 每 ${interval} 分钟执行`));
    return job;
  }

  scheduleDailyReport(options = {}) {
    const hour = options.hour || 9;
    const minute = options.minute || 0;
    const cronExpr = `0 ${minute} ${hour} * * *`;
    const jobKey = TASK_TYPES.DAILY_REPORT;

    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey).cancel();
    }

    const job = schedule.scheduleJob(cronExpr, () => {
      console.log(chalk.blue('\n[定时触发] 每日报表任务'));
      this._enqueueTask({
        fn: () => this._runDailyReportTask(options),
        timeoutMs: 10 * 60 * 1000,
        type: TASK_TYPES.DAILY_REPORT
      }).catch(err => {
        console.error(chalk.red(`[调度器] 报表生成失败: ${err.message}`));
      });
    });

    this.jobs.set(jobKey, job);
    console.log(chalk.green(`[调度器] 每日报表任务已配置: 每天 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} 执行`));
    return job;
  }

  scheduleSyncInventory(options = {}) {
    const interval = options.intervalMinutes || inventoryConfig.syncIntervalMinutes;
    const cronExpr = this._buildCronExpression(interval);
    const jobKey = TASK_TYPES.SYNC_INVENTORY;

    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey).cancel();
    }

    const job = schedule.scheduleJob(cronExpr, () => {
      console.log(chalk.blue('\n[定时触发] 库存同步任务'));
      this._enqueueTask({
        fn: () => this._runSyncInventoryTask(options),
        timeoutMs: 20 * 60 * 1000,
        type: TASK_TYPES.SYNC_INVENTORY
      }).catch(err => {
        console.error(chalk.red(`[调度器] 库存同步失败: ${err.message}`));
      });
    });

    this.jobs.set(jobKey, job);
    console.log(chalk.green(`[调度器] 库存同步任务已配置: 每 ${interval} 分钟执行`));
    return job;
  }

  start(options = {}) {
    if (this.running) {
      console.log(chalk.yellow('[调度器] 已经在运行中'));
      return;
    }

    this.running = true;
    console.log(chalk.magenta.bold('\n==================================='));
    console.log(chalk.magenta.bold('  跨境电商订单采集调度系统已启动  '));
    console.log(chalk.magenta.bold('===================================\n'));

    this.scheduleFetchOrders({
      intervalMinutes: options.fetchInterval || this.fetchIntervalMinutes,
      platforms: options.platforms || PLATFORMS,
      days: options.days || 7,
      simulate: options.simulate || false,
      concurrency: options.concurrency || this.concurrencyLimit
    });

    if (options.trackLogistics !== false) {
      this.scheduleTrackLogistics({
        intervalMinutes: options.logisticsInterval || 30,
        platforms: options.platforms || PLATFORMS
      });
    }

    if (options.dailyReport !== false) {
      this.scheduleDailyReport({
        hour: options.reportHour || 9,
        minute: options.reportMinute || 0
      });
    }

    if (options.syncInventory !== false) {
      this.scheduleSyncInventory({
        intervalMinutes: options.inventoryInterval || inventoryConfig.syncIntervalMinutes,
        platforms: options.platforms || PLATFORMS
      });
    }

    if (options.runOnStart !== false) {
      console.log(chalk.blue('\n[启动时立即执行] 首次全量任务'));
      this._enqueueTask({
        fn: () => this._runFetchOrdersTask(options),
        timeoutMs: scheduleConfig.totalCycleTimeoutMinutes * 60 * 1000,
        type: TASK_TYPES.FETCH_ORDERS
      }).then(() => {
        if (options.trackLogistics !== false) {
          this._enqueueTask({
            fn: () => this._runTrackLogisticsTask(options),
            timeoutMs: 30 * 60 * 1000,
            type: TASK_TYPES.TRACK_LOGISTICS
          });
        }
      }).catch(err => {
        console.error(chalk.red(`启动任务失败: ${err.message}`));
      });
    }

    return this;
  }

  stop() {
    for (const [key, job] of this.jobs) {
      job.cancel();
      console.log(chalk.yellow(`[调度器] 已停止任务: ${key}`));
    }
    this.jobs.clear();
    this.running = false;
    console.log(chalk.green('[调度器] 已停止'));
  }

  triggerNow(taskType, options = {}) {
    const tasks = {
      [TASK_TYPES.FETCH_ORDERS]: () => this._runFetchOrdersTask(options),
      [TASK_TYPES.TRACK_LOGISTICS]: () => this._runTrackLogisticsTask(options),
      [TASK_TYPES.SYNC_INVENTORY]: () => this._runSyncInventoryTask(options),
      [TASK_TYPES.DAILY_REPORT]: () => this._runDailyReportTask(options)
    };

    const taskFn = tasks[taskType];
    if (!taskFn) {
      throw new Error(`未知任务类型: ${taskType}`);
    }

    return this._enqueueTask({
      fn: taskFn,
      timeoutMs: scheduleConfig.totalCycleTimeoutMinutes * 60 * 1000,
      type: taskType
    });
  }

  getStatus() {
    const scheduled = [];
    for (const [key, job] of this.jobs) {
      const nextInv = job.nextInvocation();
      scheduled.push({
        type: key,
        nextRun: nextInv ? dayjs(nextInv.toDate()).format('YYYY-MM-DD HH:mm:ss') : null,
        pendingInvocations: job.pendingInvocations().length
      });
    }

    return {
      running: this.running,
      concurrencyLimit: this.concurrencyLimit,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      scheduledTasks: scheduled,
      lastRunTime: this.lastRunTime ? dayjs(this.lastRunTime).format('YYYY-MM-DD HH:mm:ss') : null,
      nextRunTime: this.nextRunTime ? dayjs(this.nextRunTime).format('YYYY-MM-DD HH:mm:ss') : null
    };
  }

  printStatus() {
    const status = this.getStatus();
    console.log(chalk.cyan('\n========== 调度器状态 =========='));
    console.log(`运行状态: ${status.running ? chalk.green('运行中') : chalk.red('已停止')}`);
    console.log(`并发限制: ${status.concurrencyLimit}`);
    console.log(`活跃任务: ${status.activeTasks}`);
    console.log(`队列任务: ${status.queuedTasks}`);
    if (status.lastRunTime) console.log(`上次执行: ${status.lastRunTime}`);
    if (status.nextRunTime) console.log(`下次执行: ${chalk.yellow(status.nextRunTime)}`);

    if (status.scheduledTasks.length > 0) {
      console.log('\n已调度任务:');
      for (const t of status.scheduledTasks) {
        const typeLabel = {
          [TASK_TYPES.FETCH_ORDERS]: '订单采集',
          [TASK_TYPES.TRACK_LOGISTICS]: '物流追踪',
          [TASK_TYPES.SYNC_INVENTORY]: '库存同步',
          [TASK_TYPES.DAILY_REPORT]: '每日报表'
        }[t.type] || t.type;
        console.log(`  - ${typeLabel}: ${t.nextRun || '无计划'}`);
      }
    }
    console.log('================================\n');
  }
}

let schedulerInstance = null;

function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

module.exports = {
  TaskScheduler,
  TASK_TYPES,
  getScheduler
};
