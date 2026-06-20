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
const { SESSION_STATUS } = require('./loginManager');
const dayjs = require('dayjs');

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  RETRYING: 'retrying',
  INTERRUPTED: 'interrupted'
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
    this.preAssignedQueue = new Map();

    if (this.loginManager) {
      this.loginManager.on('sessionCrashed', ({ accountId }) => this._handleSessionCrashed(accountId));
      this.loginManager.on('networkDown', ({ accountId }) => this._handleSessionCrashed(accountId));
    }
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

    const totalTaskCount = participants.length * scaleCodes.length;
    const assignments = concurrencyMonitor.pickAccountsByWeight(totalTaskCount);
    logger.info(`[dispatcher] 预拆分任务: 总${totalTaskCount}个, 账号分配: ${JSON.stringify(assignments)}`);

    const flatAssignments = [];
    for (const a of assignments) {
      for (let i = 0; i < a.slots; i++) flatAssignments.push(a.accountId);
    }
    this._shuffleArray(flatAssignments);

    const tasks = [];
    let idx = 0;
    for (const p of participants) {
      for (const code of scaleCodes) {
        const assignedAccount = flatAssignments[idx % flatAssignments.length] || null;
        tasks.push({
          id: uuidv4(),
          batch_id: batchId,
          participant_id: p.id,
          scale_code: code,
          account_id: assignedAccount,
          status: TASK_STATUS.PENDING,
          priority
        });
        idx++;
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

    this.preAssignedQueue.set(batchId, assignments);
    store.logOperation('info', 'dispatcher', `创建批次 ${batchId}`, {
      enterpriseName, participantCount: participants.length, taskCount: tasks.length, scaleCodes, assignments,
      timeWindowStart: timeWindow?.start, timeWindowEnd: timeWindow?.end
    });

    logger.info(`[dispatcher] 批次创建成功: ${batchId} 企业=${enterpriseName} 人数=${participants.length} 任务数=${tasks.length} 预分配=${assignments.length}账号`);
    this.emit('batchCreated', { batchId, enterpriseName, participantCount: participants.length, taskCount: tasks.length, assignments });
    return { batchId, participantCount: participants.length, taskCount: tasks.length, batchDir, assignments };
  }

  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
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

  _pickBestAccountExcluding(excludedAccountIds = []) {
    const excluded = new Set(excludedAccountIds.filter(Boolean));
    let best = null;
    let bestScore = -Infinity;
    const accounts = concurrencyMonitor.getAccountsSnapshot();
    for (const acc of accounts) {
      if (!acc.enabled) continue;
      if (excluded.has(acc.id)) continue;
      if (acc.remaining < 1) continue;
      const session = this.loginManager && this.loginManager.getHealthySession(acc.id);
      if (!session) continue;
      const score = acc.remaining - (acc.currentConcurrency * 0.1);
      if (score > bestScore) {
        bestScore = score;
        best = acc.id;
      }
    }
    return best;
  }

  async _dispatchPending() {
    if (concurrencyMonitor.isAllAccountsFull()) return;
    const pending = store.getPendingTasks(30);
    if (pending.length === 0) return;
    if (!this._excludedAccounts) this._excludedAccounts = new Map();

    let dispatched = 0;
    for (const task of pending) {
      if (this.activeTasks.has(task.id)) continue;
      const excludedAccountId = this._excludedAccounts.get(task.id);
      const excludedList = excludedAccountId ? [excludedAccountId] : [];

      let targetAccount = task.account_id;
      if (targetAccount && excludedAccountId && targetAccount === excludedAccountId) {
        targetAccount = null;
      }
      if (targetAccount) {
        const session = this.loginManager.getHealthySession(targetAccount);
        if (!session || concurrencyMonitor.getAccountCapacity(targetAccount) <= 0) {
          targetAccount = this._pickBestAccountExcluding(excludedList);
        }
      } else {
        targetAccount = this._pickBestAccountExcluding(excludedList);
      }
      if (!targetAccount) {
        logger.debug(`[dispatcher] 任务 ${task.id} 无可用账号（排除: ${excludedAccountId || '无'}），等待中`);
        continue;
      }
      const session = this.loginManager.getHealthySession(targetAccount);
      if (!session) {
        logger.warn(`[dispatcher] 账号 ${targetAccount} 会话不健康，跳过`);
        continue;
      }
      if (!concurrencyMonitor.acquireSlot(targetAccount)) continue;
      store.updateTask(task.id, { account_id: targetAccount });
      this._executeTask(task, targetAccount, session).catch(err => {
        logger.error(`[dispatcher] 任务执行异常 ${task.id}: ${err.message}`);
        concurrencyMonitor.releaseSlot(targetAccount);
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
      const isInterrupt = /(crashed|interrupt|disconnect|session|no such window|chrome not reachable|JS error|javascript error)/i.test(err.message || '');
      if (isInterrupt) {
        store.updateTask(task.id, { status: TASK_STATUS.INTERRUPTED, error_msg: `异常中断: ${err.message}` });
        logger.warn(`[dispatcher] 任务异常中断 ${task.id}: ${err.message}`);
      }
      await this._handleTaskFailure(task, accountId, err.message, isInterrupt);
    } finally {
      concurrencyMonitor.releaseSlot(accountId);
      this.activeTasks.delete(task.id);
    }
  }

  async _runAssessmentFlow(session, task) {
    const browser = session.getBrowser();
    if (!browser) return { success: false, error: '浏览器会话不可用' };
    const scaleCfg = configLoader.getScaleConfig(task.scale_code);
    if (!scaleCfg) return { success: false, error: `未知量表: ${task.scale_code}` };

    try {
      const participantInfo = { name: task.participant_name, employee_id: task.employee_id };
      const scalePage = createScalePage(browser, task.scale_code);
      const assessmentUrl = `${this.platformCfg.baseUrl}/assessment/${task.scale_code.toLowerCase()}?t=${task.id}`;
      await scalePage.navigateTo(assessmentUrl);
      store.updateTask(task.id, { last_heartbeat: new Date().toISOString() });
      await scalePage.startAssessment(participantInfo);
      store.updateTask(task.id, { last_heartbeat: new Date().toISOString() });
      await scalePage.fillAllAnswersAuto('random');
      store.updateTask(task.id, { last_heartbeat: new Date().toISOString() });
      await scalePage.submit();
      await browser.pause(3000);
      const completed = await scalePage.isCompleted();
      if (!completed) await browser.pause(5000);
      const reportUrl = await scalePage.getReportUrl();
      return { success: true, reportUrl };
    } catch (err) {
      logger.warn(`[dispatcher] 测评流程异常 ${task.id}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async _handleTaskFailure(task, failedAccountId, errorMsg, isInterrupted = false) {
    const retryCount = store.incrementTaskRetry(task.id);
    if (retryCount < this.maxRetryAttempts) {
      store.updateTask(task.id, {
        status: TASK_STATUS.PENDING,
        account_id: null,
        error_msg: errorMsg
      });
      this._excludeFailedAccountFromRetry(task.id, failedAccountId);
      const label = isInterrupted ? '异常中断后重分配' : '失败后重试';
      logger.warn(`[dispatcher] 任务 ${task.id} ${label} (排除账号${failedAccountId}), 第 ${retryCount + 1} 次尝试: ${errorMsg}`);
      store.logOperation('warn', 'dispatcher', `${label} ${task.id}`, { error: errorMsg, retryCount, excludedAccount: failedAccountId });
    } else {
      store.updateTask(task.id, {
        status: isInterrupted ? TASK_STATUS.INTERRUPTED : TASK_STATUS.FAILED,
        error_msg: errorMsg
      });
      logger.error(`[dispatcher] 任务 ${task.id} 达到最大重试次数 ${this.maxRetryAttempts}，标记${isInterrupted ? '异常中断' : '失败'}: ${errorMsg}`);
      store.logOperation('error', 'dispatcher', `任务最终失败 ${task.id}`, { error: errorMsg, retryCount, interrupted: isInterrupted });
      this._updateBatchProgress(task.batch_id);
    }
  }

  _excludeFailedAccountFromRetry(taskId, failedAccountId) {
    if (!this._excludedAccounts) this._excludedAccounts = new Map();
    this._excludedAccounts.set(taskId, failedAccountId);
    setTimeout(() => this._excludedAccounts.delete(taskId), 5 * 60 * 1000);
  }

  async _handleSessionCrashed(accountId) {
    logger.warn(`[dispatcher] 账号 ${accountId} 会话崩溃/网络中断，重新分配其未完成任务`);
    const running = store.getRunningTasks().filter(t => t.account_id === accountId);
    for (const task of running) {
      store.updateTask(task.id, {
        status: TASK_STATUS.INTERRUPTED,
        account_id: null,
        error_msg: `账号${accountId}会话崩溃，任务中断`
      });
      const retryCount = store.incrementTaskRetry(task.id);
      if (retryCount < this.maxRetryAttempts) {
        store.updateTask(task.id, { status: TASK_STATUS.PENDING, error_msg: `账号${accountId}崩溃重分配` });
        this._excludeFailedAccountFromRetry(task.id, accountId);
      } else {
        store.updateTask(task.id, { status: TASK_STATUS.INTERRUPTED });
        this._updateBatchProgress(task.batch_id);
      }
    }
    concurrencyMonitor.setAccountConcurrency(accountId, 0);
    this.emit('tasksReassigned', { accountId, count: running.length });
  }

  async _pollRunningTasks() {
    const running = store.getRunningTasks();
    const now = Date.now();
    for (const task of running) {
      const lastHb = task.last_heartbeat ? new Date(task.last_heartbeat).getTime() : 0;
      const startedAt = task.started_at ? new Date(task.started_at).getTime() : now;
      const hbStale = now - lastHb > (this.schedulerCfg.statusPollIntervalSec || 90) * 2000;
      const timedOut = now - startedAt > this.taskTimeoutMs;

      if (timedOut) {
        logger.warn(`[dispatcher] 任务 ${task.id} 超时 (${Math.round((now - startedAt) / 60000)}分钟)，重试分配其他账号`);
        store.updateTask(task.id, { status: TASK_STATUS.TIMEOUT, error_msg: '测评超时未完成' });
        await this._handleTaskFailure(task, task.account_id, '测评超时未完成', false);
        if (task.account_id) concurrencyMonitor.releaseSlot(task.account_id);
      } else if (hbStale && task.account_id) {
        const session = this.loginManager && this.loginManager.getSession(task.account_id);
        if (!session || (session.status !== SESSION_STATUS.ONLINE && session.status !== SESSION_STATUS.LOGGING_IN)) {
          logger.warn(`[dispatcher] 任务 ${task.id} 心跳过期且账号${task.account_id}异常，标记中断`);
          store.updateTask(task.id, { status: TASK_STATUS.INTERRUPTED, error_msg: '心跳过期或账号会话异常' });
          await this._handleTaskFailure(task, task.account_id, '心跳过期-疑似页面崩溃/JS错误', true);
          if (task.account_id) concurrencyMonitor.releaseSlot(task.account_id);
        } else {
          store.updateTask(task.id, { last_heartbeat: new Date().toISOString() });
        }
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
    const failed = tasks.filter(t => t.status === TASK_STATUS.FAILED || t.status === TASK_STATUS.INTERRUPTED).length;
    const allDone = completed + failed >= tasks.length;
    store.updateBatchStatus(batchId, allDone ? BATCH_STATUS.COMPLETED : BATCH_STATUS.RUNNING, {
      completed_count: completed,
      failed_count: failed
    });
    this.emit('batchProgress', { batchId, total: tasks.length, completed, failed, interrupted: tasks.filter(t => t.status === TASK_STATUS.INTERRUPTED).length, allDone });
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
