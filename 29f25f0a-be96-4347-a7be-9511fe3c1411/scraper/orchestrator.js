const { getCarrierList } = require('../config/carriers');
const { createAdapter } = require('./adapters');
const { rateSnapshots, spaceStatus, schedules, surchargeChanges } = require('../store/db');
const logger = require('../utils/logger');
const { schedulerConfig } = require('../config/carriers');

class ScrapeOrchestrator {
  constructor(options = {}) {
    this.maxPuppeteerInstances = options.maxPuppeteerInstances || schedulerConfig.maxPuppeteerInstances;
    this.maxConcurrentPerSite = options.maxConcurrentPerSite || schedulerConfig.maxConcurrentPerSite;
    this.defaultTimeout = options.defaultTimeout || schedulerConfig.defaultTimeout;
    this.memoryLimitMB = options.memoryLimitMB || schedulerConfig.memoryLimitMB || 512;
    this.memoryCheckInterval = options.memoryCheckInterval || 1;
    
    this.activeBrowsers = new Map();
    this.taskQueue = [];
    this.runningTasks = new Set();
    this.isRunning = false;
    this.results = {};
    this.listeners = {};
    this.memoryWarningEmitted = false;
    this.lastMemoryCheck = 0;
    this.memoryHistory = [];
  }

  _checkMemoryUsage() {
    const now = Date.now();
    if (now - this.lastMemoryCheck < 1000) {
      return { overLimit: false, usedMB: 0 };
    }
    
    this.lastMemoryCheck = now;
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    
    this.memoryHistory.push({ time: now, heapUsedMB, heapTotalMB, rssMB });
    if (this.memoryHistory.length > 10) {
      this.memoryHistory.shift();
    }
    
    const overLimit = heapUsedMB > this.memoryLimitMB;
    
    if (overLimit && !this.memoryWarningEmitted) {
      logger.warn(
        `内存使用超过阈值: 当前 ${heapUsedMB}MB / 限制 ${this.memoryLimitMB}MB, ` +
        `RSS: ${rssMB}MB, HeapTotal: ${heapTotalMB}MB`
      );
      this.memoryWarningEmitted = true;
      this.emit('memoryWarning', {
        usedMB: heapUsedMB,
        limitMB: this.memoryLimitMB,
        rssMB,
        heapTotalMB
      });
    } else if (!overLimit && this.memoryWarningEmitted) {
      logger.info(`内存使用已恢复正常: ${heapUsedMB}MB / ${this.memoryLimitMB}MB`);
      this.memoryWarningEmitted = false;
      this.emit('memoryNormal', { usedMB: heapUsedMB, limitMB: this.memoryLimitMB });
    }
    
    return {
      overLimit,
      usedMB: heapUsedMB,
      totalMB: heapTotalMB,
      rssMB,
      history: [...this.memoryHistory]
    };
  }

  async _forceMemoryCleanup() {
    logger.warn('执行强制内存清理，关闭所有空闲浏览器...');
    
    for (const [carrierId, adapter] of this.activeBrowsers) {
      let inUse = false;
      for (const taskId of this.runningTasks) {
        const task = this.results.tasks?.find(t => t.id === taskId);
        if (task && task.carrierId === carrierId) {
          inUse = true;
          break;
        }
      }
      
      if (!inUse) {
        try {
          await adapter.closeBrowser();
          this.activeBrowsers.delete(carrierId);
          logger.debug(`已关闭 ${carrierId} 浏览器以释放内存`);
        } catch (e) {
          logger.warn(`关闭浏览器失败 ${carrierId}: ${e.message}`);
        }
      }
    }
    
    if (global.gc) {
      global.gc();
      logger.debug('已调用垃圾回收');
    }
    
    const memAfter = process.memoryUsage();
    logger.info(`内存清理完成，当前使用: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
  }

  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      limitMB: this.memoryLimitMB,
      overLimit: Math.round(memUsage.heapUsed / 1024 / 1024) > this.memoryLimitMB,
      history: [...this.memoryHistory]
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  buildTaskQueue(taskTypes = ['rates', 'space', 'schedules', 'surcharges']) {
    this.taskQueue = [];
    const carriers = getCarrierList();

    carriers.sort((a, b) => a.priority - b.priority);

    for (const carrier of carriers) {
      for (const taskType of taskTypes) {
        const task = this._createTask(carrier, taskType);
        if (task) {
          this.taskQueue.push(task);
        }
      }
    }

    logger.info(`任务队列已构建，共 ${this.taskQueue.length} 个任务`);
    this.emit('queueBuilt', { count: this.taskQueue.length, tasks: this.taskQueue.map(t => t.id) });
    
    return this.taskQueue;
  }

  _createTask(carrier, taskType) {
    const hasUrl = this._hasTaskUrl(carrier, taskType);
    if (!hasUrl) return null;

    const routes = carrier.routes || [];
    const taskId = `${carrier.id}-${taskType}-${Date.now()}`;

    return {
      id: taskId,
      carrierId: carrier.id,
      carrierName: carrier.name,
      taskType,
      priority: carrier.priority,
      status: 'pending',
      routes: routes,
      retryCount: 0,
      maxRetries: carrier.retry?.maxRetries || 3,
      createdAt: new Date().toISOString()
    };
  }

  _hasTaskUrl(carrier, taskType) {
    switch (taskType) {
      case 'rates': return !!carrier.rateUrl;
      case 'space': return !!carrier.spaceUrl;
      case 'schedules': return !!carrier.scheduleUrl;
      case 'surcharges': return !!carrier.surchargeUrl;
      default: return false;
    }
  }

  async runAll(taskTypes) {
    if (this.isRunning) {
      logger.warn('采集任务已在运行中');
      return null;
    }

    this.isRunning = true;
    this.results = {
      total: 0,
      success: 0,
      failed: 0,
      tasks: []
    };

    this.buildTaskQueue(taskTypes);
    this.emit('scrapeStart', { total: this.taskQueue.length });

    try {
      await this._processQueue();
      this.results.total = this.taskQueue.length;
    } catch (error) {
      logger.error('采集调度异常:', error);
    } finally {
      await this._cleanupBrowsers();
      this.isRunning = false;
      this.emit('scrapeComplete', this.results);
    }

    return this.results;
  }

  async _processQueue() {
    while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
      while (this._canStartNewTask() && this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        this._startTask(task);
      }

      if (this.runningTasks.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  _canStartNewTask() {
    if (this.activeBrowsers.size >= this.maxPuppeteerInstances) {
      return false;
    }
    
    const memoryCheck = this._checkMemoryUsage();
    if (memoryCheck.overLimit) {
      logger.debug(`内存超限 (${memoryCheck.usedMB}MB > ${this.memoryLimitMB}MB)，暂不启动新任务`);
      return false;
    }
    
    return true;
  }

  async _startTask(task) {
    this.runningTasks.add(task.id);
    task.status = 'running';
    
    this.emit('taskStart', task);
    logger.info(`[${task.carrierName}] 开始任务: ${task.taskType}`);

    const taskLogger = logger.createTaskLogger(
      task.id,
      task.carrierId,
      task.carrierName,
      task.taskType
    );
    await taskLogger.start();

    try {
      const result = await this._executeTaskWithRetry(task);
      task.status = 'success';
      task.result = result;
      this.results.success++;
      this.results.tasks.push({ id: task.id, status: 'success', ...result });
      await taskLogger.success();
      this.emit('taskSuccess', task);
      logger.info(`[${task.carrierName}] 任务完成: ${task.taskType}, 解析 ${result.parsedCount} 条记录`);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      this.results.failed++;
      this.results.tasks.push({ id: task.id, status: 'failed', error: error.message });
      await taskLogger.fail(error);
      this.emit('taskFailed', task);
      logger.error(`[${task.carrierName}] 任务失败: ${task.taskType} - ${error.message}`);
    } finally {
      this.runningTasks.delete(task.id);
      
      const memoryCheck = this._checkMemoryUsage();
      if (memoryCheck.overLimit) {
        logger.warn(
          `任务完成后内存超限: ${memoryCheck.usedMB}MB / ${this.memoryLimitMB}MB, ` +
          `触发内存清理`
        );
        this.emit('memoryWarning', memoryCheck);
        await this._forceMemoryCleanup();
      }
    }
  }

  async _executeTaskWithRetry(task) {
    const carrier = getCarrierList().find(c => c.id === task.carrierId);
    let lastError;

    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        task.retryCount = attempt;
        
        if (attempt > 0) {
          const delay = this._calculateBackoff(attempt, carrier);
          logger.info(`[${task.carrierName}] 第 ${attempt + 1} 次重试 (延迟 ${delay}ms)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await this._executeTask(task, carrier);
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`[${task.carrierName}] 任务执行失败 (尝试 ${attempt + 1}/${task.maxRetries + 1}): ${error.message}`);
      }
    }

    throw lastError;
  }

  _calculateBackoff(attempt, carrier) {
    const retryConfig = carrier?.retry || { initialDelay: 1000, backoffMultiplier: 2 };
    return retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
  }

  async _executeTask(task, carrier) {
    let adapter = this.activeBrowsers.get(task.carrierId);
    
    if (!adapter) {
      adapter = createAdapter(carrier);
      await adapter.initBrowser(true);
      this.activeBrowsers.set(task.carrierId, adapter);
    }

    let records = [];
    let parsedCount = 0;

    switch (task.taskType) {
      case 'rates':
        records = await this._scrapeRates(adapter, task);
        parsedCount = records.length;
        if (records.length > 0) {
          rateSnapshots.insertBatch(records);
        }
        break;

      case 'space':
        records = await this._scrapeSpace(adapter, task);
        parsedCount = records.length;
        if (records.length > 0) {
          spaceStatus.insertBatch(records);
        }
        break;

      case 'schedules':
        records = await this._scrapeSchedules(adapter, task);
        parsedCount = records.length;
        if (records.length > 0) {
          schedules.insertBatch(records);
        }
        break;

      case 'surcharges':
        records = await this._scrapeSurcharges(adapter, task);
        parsedCount = records.length;
        if (records.length > 0) {
          surchargeChanges.insertBatch(records);
        }
        break;
    }

    return {
      taskType: task.taskType,
      parsedCount,
      records
    };
  }

  async _scrapeRates(adapter, task) {
    const allRates = [];
    const routes = task.routes || [];

    for (const route of routes) {
      try {
        const rates = await adapter.fetchRates(route);
        allRates.push(...rates);
      } catch (e) {
        logger.warn(`[${task.carrierName}] 运价采集失败 (${route.from}->${route.to}): ${e.message}`);
      }
    }

    return allRates;
  }

  async _scrapeSpace(adapter, task) {
    const allSpace = [];
    const routes = task.routes || [];

    for (const route of routes) {
      try {
        const space = await adapter.fetchSpaceAvailability(route);
        allSpace.push(...space);
      } catch (e) {
        logger.warn(`[${task.carrierName}] 舱位采集失败 (${route.from}->${route.to}): ${e.message}`);
      }
    }

    return allSpace;
  }

  async _scrapeSchedules(adapter, task) {
    const allSchedules = [];
    const routes = task.routes || [];

    for (const route of routes) {
      try {
        const sched = await adapter.fetchSchedules(route);
        allSchedules.push(...sched);
      } catch (e) {
        logger.warn(`[${task.carrierName}] 船期采集失败 (${route.from}->${route.to}): ${e.message}`);
      }
    }

    return allSchedules;
  }

  async _scrapeSurcharges(adapter, task) {
    try {
      const surcharges = await adapter.fetchSurcharges();
      return surcharges;
    } catch (e) {
      logger.warn(`[${task.carrierName}] 附加费采集失败: ${e.message}`);
      return [];
    }
  }

  async _cleanupBrowsers() {
    logger.info('清理浏览器实例...');
    for (const [carrierId, adapter] of this.activeBrowsers) {
      try {
        await adapter.closeBrowser();
      } catch (e) {
        logger.warn(`关闭浏览器失败 (${carrierId}): ${e.message}`);
      }
    }
    this.activeBrowsers.clear();
  }

  getStats() {
    const memoryStats = this.getMemoryStats();
    return {
      queued: this.taskQueue.length,
      running: this.runningTasks.size,
      activeBrowsers: this.activeBrowsers.size,
      isRunning: this.isRunning,
      results: this.results,
      memory: memoryStats
    };
  }

  getProgress() {
    const total = this.taskQueue.length + this.runningTasks.size + this.results.success + this.results.failed;
    const completed = this.results.success + this.results.failed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      completed,
      success: this.results.success,
      failed: this.results.failed,
      percent
    };
  }

  async stop() {
    logger.info('正在停止采集调度器...');
    this.taskQueue = [];
    await this._cleanupBrowsers();
    this.isRunning = false;
    this.emit('scrapeStopped', {});
  }
}

module.exports = ScrapeOrchestrator;
