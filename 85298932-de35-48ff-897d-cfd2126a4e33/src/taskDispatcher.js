const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');
const concurrencyMonitor = require('./concurrencyMonitor');
const { createScalePage } = require('./pageObjects');
const dayjs = require('dayjs');

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  RETRYING: 'retrying'
};

const BATCH_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  ARCHIVED: 'archived'
};

class TaskDispatcher extends EventEmitter {
  constructor(loginManager) {
    super();
    this.loginManager = loginManager;
    this.schedulerCfg = configLoader.getSchedulerConfig();
    this.platformCfg = configLoader.getPlatformConfig();
    this.running = false;
    this.paused = false;
    this.dispatchTimer = null;
    this.pollTimer = null;
    this.activeTasks = new Map();
    this.maxRetryAttempts = this.schedulerCfg.maxRetryAttempts || 3;
    this.taskTimeoutMs = (this.schedulerCfg.taskTimeoutMinutes || 30) * 60 * 1000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._startDispatchLoop();
    this._startPollLoop();
    logger.info('[dispatcher] 任务调度器已启动');
    this.emit('started');
  }

  stop() {
    this.running = false;
    if (this.dispatchTimer) { clearTimeout(this.dispatchTimer); this.dispatchTimer = null; }
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    logger.info('[dispatcher] 任务调度器已停止');
    this.emit('stopped');
  }

  pause() {
    this.paused = true;
    logger.info('[dispatcher] 任务调度已暂停');
    this.emit('paused');
  }

  resume() {
    this.paused = false;
    logger.info('[dispatcher] 任务调度已恢复');
    this.emit('resumed');
  }

  async createBatchFromCSV(options) {
    const { enterpriseName, csvPath, scaleCodes, priority = 5, timeWindow } = options;
    if (!enterpriseName || !csvPath || !scaleCodes || scaleCodes.length === 0) {
      throw new Error('缺少必要参数: enterpriseName, csvPath, scaleCodes');
    }
    const csvAbs = path.resolve(csvPath);
    if (!await fs.pathExists(csvAbs)) {
      throw new Error(`CSV文件不存在: ${csvAbs}`);
    }
    const raw = await fs.readFile(csvAbs, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
    if (records.length === 0) throw new Error('CSV文件为空');

    const batchId = uuidv4();
    const batchDir = this._getBatchDir(enterpriseName, batchId);
    await fs.ensureDir(batchDir);

    const participants = records.map(r => ({
      id: uuidv4(),
      name: r.name || r.姓名 || r.Name || 'unknown',
      employee_id: r.employee_id || r.工号 || r.employeeId || '',
      department: r.department || r.部门 || r.Department || '',
      email: r.email || r.邮箱 || r.Email || '',
      phone: r.phone || r.手机 || r.Phone || '',
      extra_data: r
    }));

    const tasks = [];
    for (const p of participants) {
      for (const code of scaleCodes) {
        tasks.push({
          id: uuidv4(),
          batch_id: batchId,
          participant_id: p.id,
          scale_code: code,
          status: TASK_STATUS.PENDING,
          priority
        });
      }
    }

    store.insertBatch({
      id: batchId,
      enterprise_name: enterpriseName,
      scale_codes: scaleCodes,
      time_window_start: timeWindow?.start,
      time_window_end: timeWindow?.end,
      priority,
      status: BATCH_STATUS.RUNNING,
      total_participants: participants.length,
      report_archive_dir: batchDir
    });
    store.insertParticipants(batchId, participants);
    store.insertTasks(tasks);
    store.logOperation('info', 'dispatcher', `创建批次 ${batchId}`, {
      enterpriseName, participantCount: participants.length, taskCount: tasks.length, scaleCodes
    });

    logger.info(`[dispatcher] 批次创建成功: ${batchId} 企业=${enterpriseName} 人数=${participants.length} 任务数=${tasks.length}`);
    this.emit('batchCreated', { batchId, enterpriseName, participantCount: participants.length, taskCount: tasks.length });
    return { batchId, participantCount: participants.length, taskCount: tasks.length, batchDir };
  }

  _getBatchDir(enterpriseName, batchId) {
    const reportsCfg = configLoader.getReportsConfig();
    const base = path.resolve(reportsCfg.baseDir || './reports');
    const safeName = enterpriseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    const shortId = batchId.substring(0, 8);
    return path.join(base, `${safeName}_${dayjs().format('YYYYMMDD')}_${shortId}`);
  }

  _startDispatchLoop() {
    const tick = async () => {
      if (!this.running) return;
      try {
        if (!this.paused) {
          await this._dispatchPending();
        }
      } catch (err) {
        logger.error(`[dispatcher] 调度循环异常: ${err.message}`);
      } finally {
        this.dispatchTimer = setTimeout(tick, 3000);
      }
    };
    tick();
  }

  _startPollLoop() {
    const interval = (this.schedulerCfg.statusPollIntervalSec || 90) * 1000;
    const tick = async () => {
      if (!this.running) return;
      try {
        await this._pollRunningTasks();
      } catch (err) {
        logger.error(`[dispatcher] 状态轮询异常: ${err.message}`);
      } finally {
        this.pollTimer = setTimeout(tick, interval);
      }
    };
    this.pollTimer = setTimeout(tick, interval);
  }

  async _dispatchPending() {
    if (concurrencyMonitor.isAllAccountsFull()) return;
    const pending = store.getPendingTasks(20);
    if (pending.length === 0) return;

    let dispatched = 0;
    for (const task of pending) {
      if (this.activeTasks.has(task.id)) continue;
      const accountId = concurrencyMonitor.pickBestAccount(1);
      if (!accountId) {
        logger.debug('[dispatcher] 无可用账号容量，等待中');
        break;
      }
      const session = this.loginManager.getHealthySession(accountId);
      if (!session) {
        logger.warn(`[dispatcher] 账号 ${accountId} 会话不健康，跳过`);
        continue;
      }
      if (!concurrencyMonitor.acquireSlot(accountId)) continue;
      this._executeTask(task, accountId, session).catch(err => {
        logger.error(`[dispatcher] 任务执行异常 ${task.id}: ${err.message}`);
        concurrencyMonitor.releaseSlot(accountId);
      });
      dispatched++;
    }
    if (dispatched > 0) {
      logger.debug(`[dispatcher] 本次分发 ${dispatched} 个任务`);
      this.emit('tasksDispatched', dispatched);
    }
  }

  async _executeTask(task, accountId, session) {
    this.activeTasks.set(task.id, { accountId, startedAt: Date.now(), task });
    store.updateTask(task.id, {
      account_id: accountId,
      status: TASK_STATUS.RUNNING,
      started_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString()
    });

    try {
      logger.info(`[dispatcher] 开始执行任务 ${task.id} [${task.scale_code}] ${task.participant_name} -> ${accountId}`);
      const result = await this._runAssessmentFlow(session, task);
      if (result.success) {
        store.updateTask(task.id, {
          status: TASK_STATUS.COMPLETED,
          completed_at: new Date().toISOString(),
          report_url: result.reportUrl || null
        });
        this._updateBatchProgress(task.batch_id);
        logger.info(`[dispatcher] 任务完成 ${task.id} [${task.scale_code}]`);
      } else {
        throw new Error(result.error || '测评流程执行失败');
      }
    } catch (err) {
      await this._handleTaskFailure(task, accountId, err.message);
    } finally {
      concurrencyMonitor.releaseSlot(accountId);
      this.activeTasks.delete(task.id);
    }
  }

  async _runAssessmentFlow(session, task) {
    const driver = session.getDriver();
    if (!driver) return { success: false, error: '浏览器驱动不可用' };
    const scaleCfg = configLoader.getScaleConfig(task.scale_code);
    if (!scaleCfg) return { success: false, error: `未知量表: ${task.scale_code}` };

    try {
      const participantInfo = { name: task.participant_name, employee_id: task.employee_id };
      const scalePage = createScalePage(driver, task.scale_code);
      const assessmentUrl = `${this.platformCfg.baseUrl}/assessment/${task.scale_code.toLowerCase()}?t=${task.id}`;
      await scalePage.navigateTo(assessmentUrl);
      await scalePage.startAssessment(participantInfo);
      await scalePage.fillAllAnswersAuto('random');
      await scalePage.submit();
      await driver.sleep(3000);
      const completed = await scalePage.isCompleted();
      if (!completed) {
        await driver.sleep(5000);
      }
      const reportUrl = await scalePage.getReportUrl();
      return { success: true, reportUrl };
    } catch (err) {
      logger.warn(`[dispatcher] 测评流程异常 ${task.id}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async _handleTaskFailure(task, accountId, errorMsg) {
    const retryCount = store.incrementTaskRetry(task.id);
    if (retryCount < this.maxRetryAttempts) {
      store.updateTask(task.id, { status: TASK_STATUS.PENDING, account_id: null, error_msg: errorMsg });
      logger.warn(`[dispatcher] 任务 ${task.id} 失败，准备第 ${retryCount + 1} 次重试: ${errorMsg}`);
      store.logOperation('warn', 'dispatcher', `任务失败准备重试 ${task.id}`, { error: errorMsg, retryCount });
    } else {
      store.updateTask(task.id, { status: TASK_STATUS.FAILED, error_msg: errorMsg });
      logger.error(`[dispatcher] 任务 ${task.id} 达到最大重试次数 ${this.maxRetryAttempts}，标记失败: ${errorMsg}`);
      store.logOperation('error', 'dispatcher', `任务最终失败 ${task.id}`, { error: errorMsg, retryCount });
      this._updateBatchProgress(task.batch_id);
    }
  }

  async _pollRunningTasks() {
    const running = store.getRunningTasks();
    const now = Date.now();
    for (const task of running) {
      const lastHb = task.last_heartbeat ? new Date(task.last_heartbeat).getTime() : 0;
      const startedAt = task.started_at ? new Date(task.started_at).getTime() : now;
      if (now - startedAt > this.taskTimeoutMs) {
        logger.warn(`[dispatcher] 任务 ${task.id} 超时 (${(now - startedAt) / 60000}分钟)，准备重试`);
        store.updateTask(task.id, { status: TASK_STATUS.TIMEOUT, error_msg: '测评超时未完成' });
        await this._handleTaskFailure(task, task.account_id, '测评超时未完成');
        if (task.account_id) concurrencyMonitor.releaseSlot(task.account_id);
      } else if (task.account_id) {
        store.updateTask(task.id, { last_heartbeat: new Date().toISOString() });
      }
    }
    store.cleanOldRecords();
  }

  _updateBatchProgress(batchId) {
    const tasks = store.getTasksByBatch(batchId);
    if (tasks.length === 0) return;
    const completed = tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length;
    const failed = tasks.filter(t => t.status === TASK_STATUS.FAILED).length;
    const allDone = completed + failed >= tasks.length;
    store.updateBatchStatus(batchId, allDone ? BATCH_STATUS.COMPLETED : BATCH_STATUS.RUNNING, {
      completed_count: completed,
      failed_count: failed
    });
    this.emit('batchProgress', { batchId, total: tasks.length, completed, failed, allDone });
  }

  getBatchProgress(batchId) {
    const batch = store.getBatch(batchId);
    if (!batch) return null;
    const tasks = store.getTasksByBatch(batchId);
    const statusCount = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return { batch, tasks: statusCount, total: tasks.length };
  }

  listActiveBatches() {
    return store.listBatches();
  }

  getStatusSnapshot() {
    const summary = store.getDashboardSummary();
    const accounts = concurrencyMonitor.getAccountsSnapshot();
    const sessions = this.loginManager ? this.loginManager.getSessionsSnapshot() : [];
    return {
      paused: this.paused,
      running: this.running,
      summary,
      accounts,
      sessions,
      activeTaskCount: this.activeTasks.size
    };
  }
}

module.exports = { TaskDispatcher, TASK_STATUS, BATCH_STATUS };
