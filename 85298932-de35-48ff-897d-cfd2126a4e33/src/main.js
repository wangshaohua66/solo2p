const readline = require('readline');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');
const concurrencyMonitor = require('./concurrencyMonitor');
const { LoginManager, SESSION_STATUS } = require('./loginManager');
const { TaskDispatcher, BATCH_STATUS } = require('./taskDispatcher');
const ReportCollector = require('./reportCollector');

const CSI = '\x1b[';
const HIDE_CURSOR = CSI + '?25l';
const SHOW_CURSOR = CSI + '?25h';
const SAVE_CURSOR = CSI + 's';
const RESTORE_CURSOR = CSI + 'u';
const CLEAR_SCREEN_FROM_CURSOR = CSI + '0J';
const MOVE_UP = (n) => CSI + n + 'A';
const MOVE_DOWN = (n) => CSI + n + 'B';
const MOVE_COL = (n) => CSI + n + 'G';
const CLEAR_LINE = CSI + '2K';
const CLEAR_LINE_FROM_CURSOR = CSI + '0K';

class DashboardCLI {
  constructor() {
    this.loginManager = new LoginManager();
    this.taskDispatcher = new TaskDispatcher(this.loginManager);
    this.reportCollector = new ReportCollector(this.loginManager);
    this.currentBatchId = null;
    this.uiRefreshTimer = null;
    this.running = false;
    this._statusRegionLines = 0;
    this._captchaAlerted = new Set();
    this._bindEvents();
  }

  _cursorUp(n = 1) {
    if (process.stdout.isTTY) process.stdout.write(MOVE_UP(n));
  }

  _cursorToCol(col = 1) {
    if (process.stdout.isTTY) process.stdout.write(MOVE_COL(col));
  }

  _clearLine() {
    if (process.stdout.isTTY) process.stdout.write(CLEAR_LINE);
  }

  _clearFromCursor() {
    if (process.stdout.isTTY) process.stdout.write(CLEAR_SCREEN_FROM_CURSOR);
  }

  _saveCursor() {
    if (process.stdout.isTTY) process.stdout.write(SAVE_CURSOR);
  }

  _restoreCursor() {
    if (process.stdout.isTTY) process.stdout.write(RESTORE_CURSOR);
  }

  _hideCursor() {
    if (process.stdout.isTTY) process.stdout.write(HIDE_CURSOR);
  }

  _showCursor() {
    if (process.stdout.isTTY) process.stdout.write(SHOW_CURSOR);
  }

  _beepAlert() {
    try {
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        execSync('afplay /System/Library/Sounds/Glass.aiff &', { stdio: 'ignore' });
      }
      if (process.stdout.isTTY) process.stdout.write('\u0007');
    } catch (e) { /* ignore */ }
  }

  _bindEvents() {
    concurrencyMonitor.on('capacityWarning', (w) => {
      logger.warn(`账号容量预警: ${w.accountId} 剩余 ${w.remaining}/${w.max}`);
    });
    this.taskDispatcher.on('batchProgress', (p) => {
      if (p.batchId === this.currentBatchId) {
        this._updateBatchProgress(p);
      }
    });
    this.taskDispatcher.on('batchCreated', (b) => {
      this.currentBatchId = b.batchId;
      logger.info(`批次已创建，企业: ${b.enterpriseName}, 人数: ${b.participantCount}, 任务数: ${b.taskCount}`);
    });
    this.reportCollector.on('reportDownloaded', (r) => {
      logger.debug(`报告下载完成: ${r.filePath}`);
    });
    this.loginManager.on('captchaRequired', (info) => {
      const key = `${info.accountId}_${Date.now()}`;
      if (!this._captchaAlerted.has(info.accountId)) {
        this._captchaAlerted.add(info.accountId);
        this._beepAlert();
        logger.warn(`!!! 检测到验证码，请在主菜单选择"处理验证码" - 账号 ${info.accountId} (${info.username})`);
        setTimeout(() => this._captchaAlerted.delete(info.accountId), 60000);
      }
    });
  }

  async start() {
    console.clear();
    this._showBanner();
    this.running = true;
    this._startUiRefresh();
    await this._showMainMenu();
  }

  _showBanner() {
    const lines = [
      '',
      chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'),
      chalk.cyan.bold('║          人才测评自动化调度系统 v1.0                          ║'),
      chalk.cyan.bold('║     多账号会话管理 · 智能任务调度 · 报告自动归档             ║'),
      chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'),
      ''
    ];
    lines.forEach(l => console.log(l));
  }

  _startUiRefresh() {
    this.uiRefreshTimer = setInterval(() => {
      if (this.running) this._renderStatusRegion();
    }, 3000);
  }

  _renderStatusRegion() {
    if (!process.stdout.isTTY) {
      this._renderStatusBar();
      return;
    }
    const snapshot = this.taskDispatcher.getStatusSnapshot();
    const reportStatus = this.reportCollector.getStatus();
    const scaleCfg = configLoader.getAllScales();

    const captchaAccounts = this.loginManager.getCaptchaRequiredAccounts();

    const lines = [];
    lines.push(chalk.gray('─'.repeat(80)));

    const statusParts = [
      snapshot.running ? chalk.green('[运行中]') : chalk.red('[已停止]'),
      snapshot.paused ? chalk.yellow('[已暂停]') : '',
      `活跃任务: ${snapshot.activeTaskCount}`,
      `待处理: ${snapshot.summary.tasks?.pending || 0}`,
      `已完成: ${snapshot.summary.tasks?.completed || 0}`,
      `失败: ${snapshot.summary.tasks?.failed || 0}`,
      `中断: ${snapshot.summary.tasks?.interrupted || 0}`,
      `报告队列: ${reportStatus.queueSize}`,
      `下载中: ${reportStatus.activeDownloads}/${reportStatus.concurrency}`
    ].filter(Boolean);
    lines.push(`  ${chalk.bold('系统状态:')} ${statusParts.join('  ')}`);

    if (captchaAccounts.length > 0) {
      const names = captchaAccounts.map(c => `${c.accountId}(${c.username})`).join(', ');
      lines.push(`  ${chalk.magenta.bold('⚠ 验证码待处理:')} ${chalk.magenta(names)}`);
    }

    lines.push(chalk.gray('─'.repeat(80)));

    const accounts = snapshot.accounts || [];
    const sessions = new Map((snapshot.sessions || []).map(s => [s.accountId, s]));

    const cols = 4;
    const rows = Math.ceil(accounts.length / cols);
    for (let r = 0; r < rows; r++) {
      const rowAccounts = accounts.slice(r * cols, r * cols + cols);
      const cardLines = [[], [], [], []];
      for (const acc of rowAccounts) {
        const session = sessions.get(acc.id);
        const statusColor = acc.remaining <= 0 ? chalk.red
          : acc.remaining <= 10 ? chalk.yellow
          : chalk.green;
        const statusLabel = acc.remaining <= 0 ? '超限'
          : acc.remaining <= 10 ? '忙碌' : '空闲';
        const sessionStatus = session?.status || 'offline';
        const sessionLabel = {
          online: chalk.green('●'),
          offline: chalk.gray('○'),
          logging_in: chalk.yellow('◐'),
          captcha_required: chalk.magenta('?'),
          error: chalk.red('✕'),
          crashed: chalk.red('✖'),
          network_down: chalk.yellow('⏚')
        }[sessionStatus] || chalk.gray('○');
        const barWidth = 12;
        const usage = Math.min(100, acc.usagePercent);
        const filled = Math.round((usage / 100) * barWidth);
        const empty = barWidth - filled;
        const bar = statusColor('█'.repeat(filled) + '░'.repeat(empty));
        cardLines[0].push(`┌──────────────────┐`);
        cardLines[1].push(`│ ${sessionLabel} ${chalk.bold(acc.id)}  ${statusColor(statusLabel.padEnd(4))}  │`);
        cardLines[2].push(`│ ${bar} ${String(usage).padStart(3)}%│`);
        cardLines[3].push(`│ ${acc.currentConcurrency}/${acc.maxConcurrency} 剩${String(acc.remaining).padStart(2)}    │`);
      }
      for (const line of cardLines) {
        lines.push('  ' + line.join('  '));
      }
      if (r < rows - 1) lines.push('');
    }
    lines.push('');

    if (this._statusRegionLines > 0) {
      this._cursorUp(this._statusRegionLines);
    }
    this._saveCursor();
    this._hideCursor();
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) this._cursorToCol(1);
      this._clearLine();
      if (i < lines.length - 1) {
        process.stdout.write(lines[i] + '\n');
      } else {
        process.stdout.write(lines[i]);
      }
    }
    if (lines.length < this._statusRegionLines) {
      const extra = this._statusRegionLines - lines.length;
      for (let i = 0; i < extra; i++) {
        process.stdout.write('\n');
        this._clearLine();
      }
      this._cursorUp(extra);
    }
    this._restoreCursor();
    this._showCursor();
    this._statusRegionLines = lines.length;
  }

  _renderStatusBar() {
    const snapshot = this.taskDispatcher.getStatusSnapshot();
    const reportStatus = this.reportCollector.getStatus();

    const statusLine = [
      snapshot.running ? chalk.green('[运行中]') : chalk.red('[已停止]'),
      snapshot.paused ? chalk.yellow('[已暂停]') : '',
      `活跃任务: ${snapshot.activeTaskCount}`,
      `待处理: ${snapshot.summary.tasks?.pending || 0}`,
      `已完成: ${snapshot.summary.tasks?.completed || 0}`,
      `失败: ${snapshot.summary.tasks?.failed || 0}`,
      `中断: ${snapshot.summary.tasks?.interrupted || 0}`,
      `报告队列: ${reportStatus.queueSize}`,
      `下载中: ${reportStatus.activeDownloads}/${reportStatus.concurrency}`
    ].filter(Boolean).join('  ');

    console.log(chalk.gray('─'.repeat(80)));
    console.log(`  ${chalk.bold('系统状态:')} ${statusLine}`);
    console.log(chalk.gray('─'.repeat(80)));
  }

  async _showMainMenu() {
    while (this.running) {
      const captchaAccounts = this.loginManager.getCaptchaRequiredAccounts();
      const choices = [
        { name: '1. 启动测评批次（导入CSV）', value: 'start_batch' },
        { name: '2. 查看当前批次进度', value: 'view_progress' },
        { name: '3. 启动所有账号会话', value: 'start_sessions' },
        { name: '4. 重启指定账号会话', value: 'restart_session' },
        { name: '5. 暂停任务调度', value: 'pause' },
        { name: '6. 恢复任务调度', value: 'resume' },
        { name: '7. 查看历史批次', value: 'list_batches' },
        { name: '8. 查看/导出日志', value: 'view_logs' },
        { name: '9. 查看量表配置', value: 'view_scales' },
        { name: '10. 停止系统并退出', value: 'exit' }
      ];
      if (captchaAccounts.length > 0) {
        const captchaHint = `★ 处理验证码 (${captchaAccounts.length}个账号待处理)`;
        choices.splice(0, 0, new inquirer.Separator(chalk.magenta('═'.repeat(50))));
        choices.splice(1, 0, { name: chalk.magenta.bold(captchaHint), value: 'handle_captcha' });
        choices.splice(2, 0, new inquirer.Separator(chalk.magenta('═'.repeat(50))));
      }
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: '请选择操作',
        pageSize: 20,
        choices
      }]);
      try {
        await this._handleMenuChoice(choice);
      } catch (err) {
        console.error(chalk.red(`操作失败: ${err.message}`));
        logger.error(`菜单操作失败: ${err.message}`);
      }
      if (choice === 'exit') break;
    }
  }

  async _handleMenuChoice(choice) {
    switch (choice) {
      case 'start_batch': await this._actionStartBatch(); break;
      case 'view_progress': await this._actionViewProgress(); break;
      case 'start_sessions': await this._actionStartSessions(); break;
      case 'restart_session': await this._actionRestartSession(); break;
      case 'pause': this._actionPause(); break;
      case 'resume': this._actionResume(); break;
      case 'list_batches': await this._actionListBatches(); break;
      case 'view_logs': await this._actionViewLogs(); break;
      case 'view_scales': this._actionViewScales(); break;
      case 'handle_captcha': await this._actionHandleCaptcha(); break;
      case 'exit': await this._actionExit(); break;
    }
  }

  async _actionStartBatch() {
    const scales = configLoader.getAllScales();
    const answers = await inquirer.prompt([
      { type: 'input', name: 'enterpriseName', message: '企业名称：', validate: v => v.trim().length > 0 || '请输入企业名称' },
      { type: 'input', name: 'csvPath', message: '参测人员CSV路径：', default: './data/sample_participants.csv',
        validate: async (v) => { const ok = await fs.pathExists(path.resolve(v)); return ok || '文件不存在'; } },
      { type: 'checkbox', name: 'scaleCodes', message: '选择量表组合（多选）：', choices: scales.map(s => ({ name: `${s.code} - ${s.name} (约${s.estimatedMinutes}分钟)`, value: s.code })),
        validate: v => v.length > 0 || '至少选择一个量表' },
      { type: 'input', name: 'timeWindowStart', message: '测评时间窗口开始 (YYYY-MM-DD HH:mm，留空不限)：', default: '',
        validate: (v) => {
          if (!v.trim()) return true;
          const d = dayjs(v, 'YYYY-MM-DD HH:mm', true);
          return d.isValid() || '时间格式错误，请使用 YYYY-MM-DD HH:mm';
        }
      },
      { type: 'input', name: 'timeWindowEnd', message: '测评时间窗口结束 (YYYY-MM-DD HH:mm，留空不限)：', default: '',
        validate: (v) => {
          if (!v.trim()) return true;
          const d = dayjs(v, 'YYYY-MM-DD HH:mm', true);
          return d.isValid() || '时间格式错误，请使用 YYYY-MM-DD HH:mm';
        }
      },
      { type: 'list', name: 'priority', message: '优先级：', choices: [
        { name: '紧急（插队）', value: 10 },
        { name: '高', value: 8 },
        { name: '普通', value: 5 },
        { name: '低', value: 2 }
      ], default: 5 },
      { type: 'confirm', name: 'autoStart', message: '创建后自动启动调度？', default: true }
    ]);

    if (!this.taskDispatcher.running && answers.autoStart) {
      this.taskDispatcher.start();
      this.reportCollector.start();
    }
    if (!this.loginManager.started) {
      await this.loginManager.startAll();
    }

    const timeWindow = {};
    if (answers.timeWindowStart.trim()) {
      timeWindow.start = dayjs(answers.timeWindowStart.trim(), 'YYYY-MM-DD HH:mm').toISOString();
    }
    if (answers.timeWindowEnd.trim()) {
      timeWindow.end = dayjs(answers.timeWindowEnd.trim(), 'YYYY-MM-DD HH:mm').toISOString();
    }

    const result = await this.taskDispatcher.createBatchFromCSV({
      enterpriseName: answers.enterpriseName.trim(),
      csvPath: answers.csvPath,
      scaleCodes: answers.scaleCodes,
      priority: answers.priority,
      timeWindow: Object.keys(timeWindow).length > 0 ? timeWindow : undefined
    });
    console.log(chalk.green(`\n✓ 批次创建成功！\n  批次ID: ${result.batchId}\n  参测人数: ${result.participantCount}\n  任务总数: ${result.taskCount}\n  归档目录: ${result.batchDir}\n`));
    if (timeWindow.start || timeWindow.end) {
      console.log(chalk.cyan(`  时间窗口: ${timeWindow.start ? dayjs(timeWindow.start).format('YYYY-MM-DD HH:mm') : '不限'} ~ ${timeWindow.end ? dayjs(timeWindow.end).format('YYYY-MM-DD HH:mm') : '不限'}\n`));
    }
    store.logOperation('info', 'cli', '创建批次', result);
    this._startBatchProgressBar(result);
  }

  async _actionHandleCaptcha() {
    const accounts = this.loginManager.getCaptchaRequiredAccounts();
    if (accounts.length === 0) {
      console.log(chalk.yellow('\n当前无需要处理验证码的账号\n'));
      return;
    }
    const choices = accounts.map(a => ({
      name: `${a.accountId} (${a.username})`,
      value: a.accountId
    }));
    choices.push({ name: '全部标记为已处理并重试', value: '__all__' });
    choices.push({ name: '返回主菜单', value: '__cancel__' });

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: '选择需要处理验证码的账号',
      choices
    }]);

    if (selected === '__cancel__') return;

    const toProcess = selected === '__all__' ? accounts.map(a => a.accountId) : [selected];
    console.log(chalk.blue(`\n正在重试 ${toProcess.length} 个账号的验证码处理...`));

    for (const accId of toProcess) {
      console.log(`  处理账号 ${accId}...`);
      await this.loginManager.resolveCaptcha(accId, { manual: true });
      await new Promise(r => setTimeout(r, 2000));
      const session = this.loginManager.getSession(accId);
      if (session && session.status === SESSION_STATUS.ONLINE) {
        console.log(chalk.green(`    ✓ 账号 ${accId} 已恢复在线`));
      } else if (session && session.status === SESSION_STATUS.CAPTCHA_REQUIRED) {
        console.log(chalk.yellow(`    ⚠ 账号 ${accId} 仍需验证码，请在浏览器中手动完成`));
      } else {
        console.log(chalk.red(`    ✗ 账号 ${accId} 状态: ${session?.status || 'unknown'}`));
      }
    }
    console.log('');
  }

  async _startBatchProgressBar(result) {
    const total = result.taskCount;
    const bar = new cliProgress.SingleBar({
      format: `${chalk.cyan('测评进度')} |${chalk.green('{bar}')}| {percentage}% | {value}/{total} | 预计剩余: {eta}s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true
    });
    bar.start(total, 0);
    const handler = (p) => {
      if (p.batchId === this.currentBatchId) {
        const done = p.completed + (p.failed || 0) + (p.interrupted || 0);
        bar.update(done, { eta: Math.max(0, Math.round((total - done) * 30)) });
        if (p.allDone) {
          bar.stop();
          this.taskDispatcher.off('batchProgress', handler);
          console.log(chalk.green(`\n✓ 批次 ${this.currentBatchId} 处理完成！成功 ${p.completed}，失败 ${p.failed || 0}，中断 ${p.interrupted || 0}\n`));
        }
      }
    };
    this.taskDispatcher.on('batchProgress', handler);
  }

  _updateBatchProgress(p) {
    logger.info(`批次进度 ${p.batchId}: ${(p.completed || 0) + (p.failed || 0) + (p.interrupted || 0)}/${p.total} (成功${p.completed}/失败${p.failed}/中断${p.interrupted})`);
  }

  async _actionViewProgress() {
    const batches = store.listBatches('running');
    if (batches.length === 0) {
      console.log(chalk.yellow('\n当前无进行中的批次\n'));
      return;
    }
    for (const b of batches) {
      const prog = this.taskDispatcher.getBatchProgress(b.id);
      const total = prog?.total || 0;
      const done = (prog?.tasks?.completed || 0) + (prog?.tasks?.failed || 0) + (prog?.tasks?.interrupted || 0);
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      console.log(`\n  ${chalk.bold(b.enterprise_name)} (${b.id.substring(0, 8)})`);
      console.log(`  量表: ${b.scale_codes.join(', ')}  |  人数: ${b.total_participants}`);
      if (b.time_window_start || b.time_window_end) {
        console.log(`  时间窗口: ${b.time_window_start ? dayjs(b.time_window_start).format('YYYY-MM-DD HH:mm') : '不限'} ~ ${b.time_window_end ? dayjs(b.time_window_end).format('YYYY-MM-DD HH:mm') : '不限'}`);
      }
      console.log(`  完成: ${done}/${total} (${pct}%)  成功:${prog?.tasks?.completed || 0}  失败:${prog?.tasks?.failed || 0}  中断:${prog?.tasks?.interrupted || 0}  进行中:${prog?.tasks?.running || 0}  待处理:${prog?.tasks?.pending || 0}\n`);
    }
  }

  async _actionStartSessions() {
    console.log(chalk.blue('\n正在启动所有账号会话...'));
    if (!this.loginManager.started) {
      await this.loginManager.startAll();
    } else {
      await this.loginManager.loginAll();
    }
    if (!this.taskDispatcher.running) this.taskDispatcher.start();
    if (!this.reportCollector.running) this.reportCollector.start();
    console.log(chalk.green('✓ 系统服务已启动\n'));
  }

  async _actionRestartSession() {
    const accounts = configLoader.getAccounts();
    const { accountId } = await inquirer.prompt([{
      type: 'list', name: 'accountId', message: '选择要重启的账号：',
      choices: accounts.map(a => ({ name: `${a.id} (${a.username})`, value: a.id }))
    }]);
    console.log(chalk.blue(`\n正在重启账号 ${accountId}...`));
    const ok = await this.loginManager.restartSession(accountId);
    console.log(ok ? chalk.green(`✓ 账号 ${accountId} 重启成功\n`) : chalk.red(`✗ 账号 ${accountId} 重启失败\n`));
  }

  _actionPause() {
    this.taskDispatcher.pause();
    console.log(chalk.yellow('\n⏸ 任务调度已暂停\n'));
  }

  _actionResume() {
    this.taskDispatcher.resume();
    console.log(chalk.green('\n▶ 任务调度已恢复\n'));
  }

  async _actionListBatches() {
    const batches = store.listBatches();
    if (batches.length === 0) {
      console.log(chalk.yellow('\n暂无历史批次\n'));
      return;
    }
    const statusColor = {
      pending: chalk.gray, running: chalk.blue, completed: chalk.green,
      failed: chalk.red, paused: chalk.yellow, archived: chalk.cyan
    };
    console.log('');
    console.log(chalk.bold('  ID'.padEnd(10) + '企业名称'.padEnd(20) + '量表'.padEnd(15) + '人数'.padEnd(6) + '状态'.padEnd(10) + '创建时间'));
    console.log(chalk.gray('  ' + '─'.repeat(80)));
    for (const b of batches.slice(0, 20)) {
      const stColor = statusColor[b.status] || chalk.white;
      console.log(`  ${b.id.substring(0, 8).padEnd(10)}${b.enterprise_name.substring(0, 18).padEnd(20)}${b.scale_codes.join(',').substring(0, 13).padEnd(15)}${String(b.total_participants).padEnd(6)}${stColor(b.status.padEnd(10))}${dayjs(b.created_at).format('MM-DD HH:mm')}`);
    }
    console.log('');
  }

  async _actionViewLogs() {
    const logsDir = path.resolve('./logs');
    const files = await fs.readdir(logsDir).catch(() => []);
    const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();
    if (logFiles.length === 0) {
      console.log(chalk.yellow('\n暂无日志文件\n'));
      return;
    }
    const { file, action } = await inquirer.prompt([
      { type: 'list', name: 'file', message: '选择日志文件：', choices: logFiles },
      { type: 'list', name: 'action', message: '操作：', choices: [{ name: '查看最近50行', value: 'view' }, { name: '导出文件路径', value: 'path' }] }
    ]);
    const fullPath = path.join(logsDir, file);
    if (action === 'view') {
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).slice(-50);
      console.log('');
      lines.forEach(l => console.log('  ' + l));
      console.log('');
    } else {
      console.log(chalk.blue(`\n日志文件路径: ${fullPath}\n`));
    }
  }

  _actionViewScales() {
    const scales = configLoader.getAllScales();
    console.log('');
    console.log(chalk.bold('  编码'.padEnd(10) + '名称'.padEnd(30) + '预计时长'));
    console.log(chalk.gray('  ' + '─'.repeat(55)));
    for (const s of scales) {
      console.log(`  ${s.code.padEnd(10)}${s.name.padEnd(30)}${s.estimatedMinutes}分钟`);
    }
    console.log('');
  }

  async _actionExit() {
    console.log(chalk.blue('\n正在安全关闭系统...'));
    this.running = false;
    if (this.uiRefreshTimer) clearInterval(this.uiRefreshTimer);
    this._showCursor();
    try { this.taskDispatcher.stop(); } catch (e) { /* ignore */ }
    try { this.reportCollector.stop(); } catch (e) { /* ignore */ }
    try { await this.loginManager.stopAll(); } catch (e) { /* ignore */ }
    try { store.close(); } catch (e) { /* ignore */ }
    console.log(chalk.green('✓ 系统已安全退出\n'));
    process.exit(0);
  }
}

async function main() {
  const cli = new DashboardCLI();
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n收到中断信号，正在安全关闭...'));
    cli.running = false;
    cli._showCursor();
    try { cli.taskDispatcher.stop(); } catch (e) { }
    try { cli.reportCollector.stop(); } catch (e) { }
    try { await cli.loginManager.stopAll(); } catch (e) { }
    try { store.close(); } catch (e) { }
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`未捕获异常: ${err.message}\n${err.stack}`);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(`未处理的Promise拒绝: ${reason}`);
  });
  await cli.start();
}

if (require.main === module) {
  main().catch(err => {
    console.error(chalk.red(`启动失败: ${err.message}`));
    logger.error(`系统启动失败: ${err.message}\n${err.stack}`);
    process.exit(1);
  });
}

module.exports = { DashboardCLI };
