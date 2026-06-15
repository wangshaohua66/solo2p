'use strict';

const cron = require('node-cron');
const PQueue = require('p-queue').default;
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const repository = require('../storage/repository');
const { createCollectorFromEntry } = require('../platforms');
const DataNormalizer = require('../parser/dataNormalizer');

class TaskScheduler extends EventEmitter {
  constructor(configLoader, dependencies = {}) {
    super();
    this.configLoader = configLoader;
    this.captchaHandler = dependencies.captchaHandler;
    this.alertEngine = dependencies.alertEngine;
    this.schedules = new Map();
    this.activeTasks = new Map();
    this.retryQueue = [];
    this.concurrency = Number(configLoader.get('system.max_parallel_browsers')) || 4;
    this.queue = new PQueue({ concurrency: this.concurrency });
    this.running = false;
    this.retryCheckInterval = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this._registerCronJobs();
    this._startRetryQueue();
    this._startPlatformStatusSync();
    this.configLoader.on('platforms:changed', () => {
      this._reloadSchedules();
    });
    logger.info(`任务调度器启动，并发=${this.concurrency}`);
  }

  async stop() {
    this.running = false;
    for (const [taskId, controller] of this.activeTasks.entries()) {
      try { controller?.abort?.(); } catch (_) {}
    }
    this.schedules.forEach((job) => { try { job.stop(); } catch (_) {} });
    this.schedules.clear();
    this.queue.clear();
    if (this.retryCheckInterval) clearInterval(this.retryCheckInterval);
    logger.info('任务调度器已停止');
  }

  _registerCronJobs() {
    const platforms = this.configLoader.getEnabledPlatforms();
    for (const entry of platforms) {
      const scheduleExpr = entry.schedule || '0 * * * *';
      try {
        const job = cron.schedule(scheduleExpr, () => {
          if (!this.running) return;
          this.schedulePlatformJob(entry, { trigger: 'cron' });
        }, { scheduled: true, timezone: 'Asia/Shanghai' });
        this.schedules.set(entry.key, job);
        logger.debug(`已注册调度 ${entry.code} 表达式: ${scheduleExpr}`);
      } catch (err) {
        logger.error(`Cron 表达式无效: ${entry.code} ${scheduleExpr}`, { error: err.message });
      }
    }
  }

  _reloadSchedules() {
    logger.info('平台配置变更，重载调度...');
    this.schedules.forEach((job) => { try { job.stop(); } catch (_) {} });
    this.schedules.clear();
    this._registerCronJobs();
  }

  _startRetryQueue() {
    this.retryCheckInterval = setInterval(async () => {
      if (!this.running) return;
      const now = Date.now();
      const delays = this.configLoader.get('system.retry.delay_seconds') || [5, 15, 30];
      const eligible = this.retryQueue.filter((t) => {
        const delay = delays[t.attempts] || 60;
        return now >= t.nextRetryAt && this.queue.pending < this.concurrency;
      });
      for (const t of eligible) {
        const idx = this.retryQueue.indexOf(t);
        if (idx > -1) this.retryQueue.splice(idx, 1);
        this._enqueueExecution(t.entry, t.taskDoc, t.opts);
      }
    }, 5000);
  }

  _startPlatformStatusSync() {
    setInterval(() => this.emit('status:sync', this.getStatus()), 3000);
  }

  async schedulePlatformJob(entry, opts = {}) {
    const systemConfig = this.configLoader.get('system') || {};
    const taskDoc = await repository.createTask({
      platform: entry.code,
      platformKey: entry.key,
      platformName: entry.name,
      dataType: opts.dataType || null,
      trigger: opts.trigger || 'manual',
      scheduleExpression: entry.schedule,
      timeoutAt: Date.now() + (entry.timeout_minutes || 8) * 60 * 1000,
      startedAt: null,
      finishedAt: null,
      recordsCollected: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsDuplicate: 0,
      errors: [],
      logs: [],
    });
    logger.info(`调度任务 ${taskDoc._id.toString().substring(0, 8)} 平台=${entry.code} 触发=${opts.trigger}`);
    return this._enqueueExecution(entry, taskDoc, opts);
  }

  _enqueueExecution(entry, taskDoc, opts = {}) {
    const promise = this.queue.add(async () => this._executeTask(entry, taskDoc, opts));
    taskDoc.promise = promise;
    this.activeTasks.set(taskDoc._id.toString(), taskDoc);
    this.emit('task:scheduled', taskDoc);
    return taskDoc;
  }

  async _executeTask(entry, taskDoc, opts) {
    const taskId = taskDoc._id.toString();
    const abort = new AbortController();
    this.activeTasks.set(taskId, { ...taskDoc, abort });
    const timeoutHandle = setTimeout(() => {
      logger.warn(`任务超时: ${taskId.substring(0, 8)}`);
      abort.abort();
    }, (entry.timeout_minutes || 8) * 60 * 1000);

    let collector;
    try {
      await repository.updateTask(taskId, { status: 'running', startedAt: new Date() });
      this.emit('task:started', taskDoc);

      collector = createCollectorFromEntry(entry, {
        captchaHandler: this.captchaHandler,
        systemConfig: this.configLoader.get('system') || {},
      });
      collector.on('status:*', (evt) => this.emit(`platform:${evt.event || 'status'}`, { platform: entry.code, ...evt }));
      collector.on('captcha:pending', (c) => {
        repository.incrementCaptchaCount(taskId).catch(() => {});
        this.emit('captcha:pending', c);
      });

      const { records, error } = await collector.run(taskDoc, abort.signal);
      clearTimeout(timeoutHandle);

      if (error) {
        await repository.updateTask(taskId, {
          status: 'failed',
          finishedAt: new Date(),
          $push: { errors: { at: new Date(), message: error } },
        });
        logger.error(`任务失败 ${taskId.substring(0, 8)}: ${error}`);
        this._maybeRetry(entry, taskDoc, opts);
        this.emit('task:failed', { task: taskDoc, error });
        return { success: false, error };
      }

      const systemConfig = this.configLoader.get('system') || {};
      const urgencyLevels = this.configLoader.getUrgencyLevels();
      const normalizer = new DataNormalizer(urgencyLevels);
      const normalized = [];
      for (const r of records) {
        const dataType = r._dataType;
        delete r._dataType;
        const n = normalizer.normalize(entry, r, dataType);
        if (n) normalized.push(n);
      }
      const summary = await repository.batchUpsertEvents(normalized);

      if (this.alertEngine) {
        const toEvaluate = normalized.slice(0, 200);
        const alerts = await this.alertEngine.evaluateBatch(toEvaluate);
        logger.info(`规则匹配完成: 触发 ${alerts.length} 条告警`);
      }

      await repository.updateTask(taskId, {
        status: 'success',
        finishedAt: new Date(),
        recordsCollected: records.length,
        recordsInserted: summary.inserted,
        recordsUpdated: summary.updated,
        recordsDuplicate: summary.duplicate,
        alertsTriggered: (await repository.findAlerts({ createdAt: { $gte: taskDoc.startedAt || new Date(taskDoc.createdAt) } })).total,
      });

      this.emit('task:completed', {
        task: { ...taskDoc, ...summary },
        records, normalized, summary,
      });
      logger.info(`任务完成 ${taskId.substring(0, 8)} 采集=${records.length} 新增=${summary.inserted} 更新=${summary.updated} 重复=${summary.duplicate}`);
      return { success: true, summary };
    } catch (err) {
      clearTimeout(timeoutHandle);
      await repository.updateTask(taskId, {
        status: 'failed',
        finishedAt: new Date(),
        $push: { errors: { at: new Date(), message: err.message, stack: err.stack } },
      });
      logger.error(`任务异常 ${taskId.substring(0, 8)}`, { error: err.message, stack: err.stack?.substring(0, 300) });
      this._maybeRetry(entry, taskDoc, opts);
      this.emit('task:failed', { task: taskDoc, error: err.message });
      return { success: false, error: err.message };
    } finally {
      this.activeTasks.delete(taskId);
      try { await collector?.destroy(); } catch (_) {}
    }
  }

  _maybeRetry(entry, taskDoc, opts) {
    const maxAttempts = this.configLoader.get('system.retry.max_attempts') || 3;
    if ((taskDoc.attempts || 0) + 1 >= maxAttempts) {
      logger.warn(`任务连续失败超过 ${maxAttempts} 次，升级告警: ${taskDoc._id}`);
      if (this.alertEngine) {
        this.alertEngine.emit('alert:fired', {
          ruleId: 'SYSTEM_ESCALATE',
          urgency: 'HIGH',
          message: `【采集异常升级】平台 ${entry.name}(${entry.code}) 连续失败${maxAttempts}次，建议人工介入`,
        });
      }
      return;
    }
    const delays = this.configLoader.get('system.retry.delay_seconds') || [5, 15, 30];
    const retryItem = {
      entry,
      taskDoc,
      opts,
      attempts: (taskDoc.attempts || 0) + 1,
      nextRetryAt: Date.now() + (delays[taskDoc.attempts || 0] || 60) * 1000,
    };
    this.retryQueue.push(retryItem);
    repository.incrementTaskAttempts(taskDoc._id).catch(() => {});
    logger.info(`任务已加入重试队列: ${taskDoc._id.toString().substring(0, 8)} (第${retryItem.attempts}次)`);
  }

  async runNow(platformKey, dataType = null) {
    const platforms = this.configLoader.getEnabledPlatforms();
    const entry = platforms.find((p) => p.key === platformKey);
    if (!entry) throw new Error(`未找到平台: ${platformKey}`);
    return this.schedulePlatformJob(entry, { trigger: 'manual', dataType });
  }

  async runAllNow() {
    const platforms = this.configLoader.getEnabledPlatforms();
    const tasks = [];
    for (const p of platforms) tasks.push(this.schedulePlatformJob(p, { trigger: 'manual' }));
    return tasks;
  }

  getActiveTasks() {
    return Array.from(this.activeTasks.values()).map((t) => ({
      id: t._id?.toString ? t._id.toString() : String(t._id),
      platform: t.platform,
      status: t.status,
      attempts: t.attempts,
      captchaIntercepts: t.captchaIntercepts,
      dataType: t.dataType || 'ALL',
    }));
  }

  getStatus() {
    const platforms = this.configLoader.getEnabledPlatforms();
    return {
      concurrency: {
        running: this.queue.pending,
        active: this.queue.size,
        max: this.concurrency,
      },
      activeTasks: this.getActiveTasks(),
      retryQueueSize: this.retryQueue.length,
      platforms: platforms.map((p) => ({ key: p.key, code: p.code, name: p.name, enabled: p.enabled })),
    };
  }
}

module.exports = TaskScheduler;
