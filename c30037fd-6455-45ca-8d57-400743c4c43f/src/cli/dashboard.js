'use strict';

const readline = require('readline');
const EventEmitter = require('events');
const chalk = require('chalk');
const Table = require('cli-table3');
const inquirer = require('inquirer');
const ora = require('ora');
const { format } = require('date-fns');
const { logger } = require('../utils/logger');
const repository = require('../storage/repository');

const STATUS_COLORS = {
  connected: { icon: '●', color: chalk.green, label: '已连接' },
  warning: { icon: '●', color: chalk.yellow, label: '会话即将超时' },
  disconnected: { icon: '●', color: chalk.red, label: '断开' },
  captcha: { icon: '●', color: chalk.blue, label: '等待验证码' },
  running: { icon: '◉', color: chalk.cyan, label: '采集中' },
  idle: { icon: '○', color: chalk.gray, label: '空闲' },
  unknown: { icon: '?', color: chalk.gray, label: '未知' },
};

class CLIDashboard extends EventEmitter {
  constructor(scheduler, captchaHandler, alertEngine, configLoader, reportGenerator) {
    super();
    this.scheduler = scheduler;
    this.captchaHandler = captchaHandler;
    this.alertEngine = alertEngine;
    this.configLoader = configLoader;
    this.reportGenerator = reportGenerator;

    this.platformStatus = new Map();
    this.logBuffer = [];
    this.maxLogLines = 200;
    this.running = false;
    this.intervalHandles = [];
    this._boundHandlers = {};

    this._setupInitialPlatformStatus();
  }

  _setupInitialPlatformStatus() {
    const platforms = this.configLoader.getEnabledPlatforms();
    for (const p of platforms) {
      this.platformStatus.set(p.code, { status: 'unknown', message: '待初始化', updatedAt: new Date() });
    }
  }

  async start(launcher = null) {
    this.launcher = launcher;
    this.running = true;
    this._bindEventListeners();
    this._startStatusRefresh();
    this._drawIntro();
    this._drawFull();
    this._startPrompt();
  }

  _bindEventListeners() {
    const handlers = {
      'task:started': (task) => {
        this.platformStatus.set(task.platform, { status: 'running', message: '任务已启动', updatedAt: new Date() });
        this._appendLog('info', `任务启动 ${this._tid(task._id)} 平台=${task.platform}`, { platform: task.platform });
        this._drawHeader();
      },
      'task:completed': ({ task, summary }) => {
        this.platformStatus.set(task.platform, { status: 'connected', message: `采集${summary.inserted + summary.updated}条`, updatedAt: new Date() });
        this._appendLog('info', `任务完成 ${this._tid(task._id)} 新增=${summary.inserted} 更新=${summary.updated} 去重=${summary.duplicate}`, { platform: task.platform });
        this._drawFull();
      },
      'task:failed': ({ task, error }) => {
        this.platformStatus.set(task.platform, { status: 'disconnected', message: '任务失败', updatedAt: new Date() });
        this._appendLog('error', `任务失败 ${this._tid(task._id)} ${error}`, { platform: task.platform });
        this._drawFull();
      },
      'captcha:pending': (c) => {
        this.platformStatus.set(c.platform, { status: 'captcha', message: `验证码待处理 id=${c.captchaId?.substring?.(0, 8) || ''}`, updatedAt: new Date() });
        this._appendLog('warn', `【验证码拦截】${c.platformName || c.platform} 请使用 "${chalk.bold('captcha list')}" 查看`, { platform: c.platform, urgent: true });
        this._drawFull();
      },
      'status:captcha': ({ platform }) => {
        const cur = this.platformStatus.get(platform) || {};
        this.platformStatus.set(platform, { ...cur, status: 'captcha', message: '等待人工验证码', updatedAt: new Date() });
        this._drawHeader();
      },
      'status:running': ({ platform }) => {
        this.platformStatus.set(platform, { status: 'running', message: '执行采集', updatedAt: new Date() });
        this._drawHeader();
      },
      'status:idle': ({ platform }) => {
        this.platformStatus.set(platform, { status: 'connected', message: '采集完成', updatedAt: new Date() });
        this._drawHeader();
      },
      'status:error': ({ platform, error }) => {
        this.platformStatus.set(platform, { status: 'disconnected', message: error?.substring?.(0, 20) || '错误', updatedAt: new Date() });
        this._drawFull();
      },
      'status:warning': ({ platform, message }) => {
        this.platformStatus.set(platform, { status: 'warning', message: message?.substring?.(0, 20) || '', updatedAt: new Date() });
        this._drawHeader();
      },
    };

    for (const [evt, fn] of Object.entries(handlers)) {
      this._boundHandlers[evt] = fn;
      this.scheduler?.on?.(evt, fn);
      this.launcher?.on?.(evt, fn);
    }

    this.alertEngine?.on?.('alert:fired', (alert) => {
      const colorMap = { CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warn', LOW: 'info' };
      this._appendLog(colorMap[alert.urgency] || 'info', `[告警${alert.urgency}] ${alert.message}`, { alert: true, urgency: alert.urgency });
    });

    if (this.captchaHandler) {
      const h1 = (c) => {
        this._appendLog('info', `验证码已解决: ${c.captchaId?.substring?.(0, 8) || ''}`);
        this._drawFull();
      };
      this.captchaHandler.on('captcha:resolved', h1);
      this._boundHandlers['_captcha_resolved'] = h1;
    }
  }

  _startStatusRefresh() {
    this.intervalHandles.push(setInterval(() => {
      if (!this.running) return;
      const now = Date.now();
      for (const [code, st] of this.platformStatus.entries()) {
        if (st.status === 'running' || st.status === 'captcha') continue;
        const age = (now - new Date(st.updatedAt).getTime()) / 1000;
        if (age > 600) {
          st.status = 'warning';
          st.message = '长时间无活动';
        }
      }
      this._drawHeader();
    }, 30000));

    this.intervalHandles.push(setInterval(() => {
      if (!this.running) return;
      const tasks = this.scheduler?.getActiveTasks?.() || [];
      for (const t of tasks) {
        const cur = this.platformStatus.get(t.platform) || {};
        cur.status = 'running';
        cur.message = `任务运行中 (${t.attempts || 1}次)`;
        cur.updatedAt = new Date();
        this.platformStatus.set(t.platform, cur);
      }
    }, 5000));
  }

  _appendLog(level, message, meta = {}) {
    const now = format(new Date(), 'HH:mm:ss');
    const entry = { time: now, level, message, meta };
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxLogLines) this.logBuffer.splice(0, this.logBuffer.length - this.maxLogLines);
    this._drawLogArea();
  }

  _tid(id) {
    if (!id) return '';
    const s = typeof id === 'object' ? id.toString() : String(id);
    return s.substring(0, 8);
  }

  _drawIntro() {
    process.stdout.write('\x1B[2J\x1B[0f');
    const lines = [
      chalk.bold.blue('╔════════════════════════════════════════════════════════════════════════════════════╗'),
      chalk.bold.blue('║') + chalk.bold.white('         省级医药流通集团 药品合规数据采集与监控系统 v1.0                       ') + chalk.bold.blue('║'),
      chalk.bold.blue('╚════════════════════════════════════════════════════════════════════════════════════╝'),
      '',
      chalk.cyan('  支持命令: ') + chalk.white('tasks | captcha | run | report | config | alerts | events | clear | help | exit'),
      '',
    ];
    process.stdout.write(lines.join('\n') + '\n');
  }

  _drawFull() {
    this._drawHeader();
    this._drawLogArea();
  }

  _drawHeader() {
    const tasks = this.scheduler?.getActiveTasks?.() || [];
    const retryQ = this.scheduler?.retryQueue?.length || 0;
    const pendingCap = Array.from(this.platformStatus.values()).filter((s) => s.status === 'captcha').length;

    const icons = Array.from(this.platformStatus.entries()).map(([code, st]) => {
      const s = STATUS_COLORS[st.status] || STATUS_COLORS.unknown;
      return `${s.color(s.icon)}${chalk.gray(' ' + code)}`;
    }).join('  ');

    const line1 = chalk.bgBlue.black(` 平台状态: `) + ` ${icons} ` + chalk.bgBlue.black(`  运行任务=${tasks.length}  重试队列=${retryQ}  待处理验证码=${pendingCap} `);
    const detailLines = Array.from(this.platformStatus.entries()).map(([code, st]) => {
      const s = STATUS_COLORS[st.status] || STATUS_COLORS.unknown;
      return `  ${s.color(s.icon)} ${chalk.bold(code.padEnd(16))} ${s.label.padEnd(10)} ${chalk.gray(st.message || '')}`;
    });

    const headerRow = this._getHeaderRow();
    process.stdout.write(headerRow + line1 + '\n' + detailLines.join('\n') + '\n\n');
  }

  _getHeaderRow() {
    return typeof process.stdout.moveCursor === 'function' && typeof process.stdout.clearLine === 'function'
      ? (() => { process.stdout.moveCursor(0, -(this._lastHeaderLines || 8)); process.stdout.clearScreenDown?.(); return ''; })()
      : '\n' + chalk.bold('═══════════════════════════════════════════════════════════════') + '\n';
  }

  _drawLogArea() {
    const viewLines = this._availableLogLines();
    const start = Math.max(0, this.logBuffer.length - viewLines);
    const visible = this.logBuffer.slice(start);

    const sep = chalk.bold('─'.repeat(80));
    const header = chalk.bold.blue(`── 实时日志区 (${this.logBuffer.length} 条，显示最近${visible.length}条) ──`);
    const out = visible.map((e) => this._formatLog(e)).join('\n');

    process.stdout.write(sep + '\n' + header + '\n' + out + '\n' + sep + '\n');
  }

  _availableLogLines() {
    const rows = process.stdout.rows || 40;
    return Math.max(8, rows - 22);
  }

  _formatLog(entry) {
    const { time, level, message, meta } = entry;
    let colorFn = chalk.white;
    let prefix = 'INFO ';
    switch (level) {
      case 'error': case 'alert': colorFn = chalk.red; prefix = chalk.red.bold('ERROR'); break;
      case 'warn': colorFn = chalk.yellow; prefix = chalk.yellow.bold('WARN '); break;
      case 'info': colorFn = chalk.green; prefix = chalk.green.bold('INFO '); break;
      case 'debug': colorFn = chalk.blue; prefix = chalk.blue.bold('DEBUG'); break;
    }
    if (meta?.urgency === 'CRITICAL') colorFn = chalk.red.bold;
    else if (meta?.urgency === 'HIGH') colorFn = chalk.yellow.bold;
    else if (meta?.urgency === 'MEDIUM') colorFn = chalk.yellow;
    const tag = meta?.platform ? chalk.cyan(`[${meta.platform}]`) : '';
    return ` ${chalk.gray(time)} ${prefix} ${tag} ${colorFn(message)}`;
  }

  _startPrompt() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: chalk.green('合规监控 > ') });
    this.rl.on('line', (line) => this._handleCommand(line.trim()));
    this.rl.on('close', () => {
      if (this.running) {
        this.running = false;
        this.stop();
      }
    });
    this.rl.prompt();
  }

  async _handleCommand(line) {
    if (!line) { this.rl.prompt(); return; }
    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case 'help': case '?': this._printHelp(); break;
        case 'tasks': await this._cmdTasks(args); break;
        case 'captcha': await this._cmdCaptcha(args); break;
        case 'run': await this._cmdRun(args); break;
        case 'report': await this._cmdReport(args); break;
        case 'config': await this._cmdConfig(args); break;
        case 'alerts': await this._cmdAlerts(args); break;
        case 'events': await this._cmdEvents(args); break;
        case 'status': this._drawFull(); break;
        case 'clear': this.logBuffer = []; this._drawFull(); process.stdout.write(chalk.green('日志已清空\n')); break;
        case 'exit': case 'quit': case 'q':
          process.stdout.write(chalk.yellow('正在停止服务...\n'));
          this.running = false;
          this.emit('request:stop');
          setTimeout(() => process.exit(0), 3000);
          return;
        default:
          process.stdout.write(chalk.red(`未知命令: ${cmd}，输入 help 查看帮助\n`));
      }
    } catch (err) {
      process.stdout.write(chalk.red(`命令执行失败: ${err.message}\n`));
      logger.error('CLI命令错误', { cmd, args, error: err.message });
    }
    this.rl.prompt();
  }

  _printHelp() {
    const h = new Table({ head: ['命令', '说明', '示例'] });
    h.push(
      ['help / ?', '查看帮助', 'help'],
      ['status', '刷新显示', 'status'],
      ['tasks [list|stop <id>]', '查看任务列表 / 停止任务', 'tasks list'],
      ['captcha [list|solve <id>]', '处理验证码任务', 'captcha list'],
      ['run <platformKey|all> [dataType]', '手动触发采集', 'run nmpa recall'],
      ['report [weekly|monthly]', '生成合规报告', 'report weekly'],
      ['config [platforms|rules]', '查看配置', 'config platforms'],
      ['alerts [limit]', '查看最近告警', 'alerts 50'],
      ['events [keyword] [limit]', '查询事件', 'events 阿莫西林'],
      ['clear', '清空日志区', 'clear'],
      ['exit / quit', '退出系统', 'exit'],
    );
    process.stdout.write(h.toString() + '\n');
  }

  async _cmdTasks(args) {
    const sub = args[0] || 'list';
    if (sub === 'stop') {
      const id = args[1];
      if (!id) return process.stdout.write(chalk.red('请指定任务ID\n'));
      process.stdout.write(chalk.yellow(`任务取消请求 ${id}\n`));
      return;
    }
    const { items, total } = await repository.findTasks({}, { sort: { createdAt: -1 }, limit: 20 });
    const t = new Table({ head: ['ID', '平台', '类型', '状态', '采集', '新增/更新/去重', '错误', '时间'] });
    for (const task of items) {
      t.push([
        this._tid(task._id),
        task.platform,
        task.dataType || 'ALL',
        this._colorStatus(task.status),
        task.recordsCollected || 0,
        `${task.recordsInserted || 0}/${task.recordsUpdated || 0}/${task.recordsDuplicate || 0}`,
        (task.errors || []).length,
        task.finishedAt ? format(new Date(task.finishedAt), 'MM-dd HH:mm') : format(new Date(task.createdAt), 'MM-dd HH:mm'),
      ]);
    }
    process.stdout.write(`任务列表 (共${total}条，显示最近20条)\n${t.toString()}\n`);
  }

  _colorStatus(s) {
    switch (s) {
      case 'success': return chalk.green('成功');
      case 'failed': return chalk.red('失败');
      case 'running': return chalk.cyan('运行中');
      case 'pending': return chalk.yellow('等待中');
      default: return chalk.gray(s || '-');
    }
  }

  async _cmdCaptcha(args) {
    const sub = args[0] || 'list';
    if (sub === 'list') {
      const pending = await this.captchaHandler.listPending(20);
      if (!pending.length) {
        process.stdout.write(chalk.green('当前无待处理验证码任务 ✔\n'));
        return;
      }
      const t = new Table({ head: ['ID', '平台', '类型', '任务ID', '截图', 'URL', '时间'] });
      for (const c of pending) {
        t.push([
          c.captchaId.substring(0, 10),
          c.platformName || c.platform,
          c.type,
          this._tid(c.taskId),
          c.screenshot ? '是' : '否',
          (c.pageUrl || '').substring(0, 40),
          format(new Date(c.createdAt), 'MM-dd HH:mm'),
        ]);
      }
      process.stdout.write(`待处理验证码 (${pending.length}条)\n${t.toString()}\n  使用 "${chalk.bold('captcha solve <ID>')}" 来处理\n`);
      return;
    }
    if (sub === 'solve') {
      const id = args[1];
      if (!id) return process.stdout.write(chalk.red('请指定验证码ID\n'));
      const list = await this.captchaHandler.listPending(100);
      const item = list.find((c) => c.captchaId.startsWith(id));
      if (!item) return process.stdout.write(chalk.red(`未找到验证码任务 ${id}\n`));
      process.stdout.write(chalk.bold(`\n═══ 验证码处理 ═══\n`));
      process.stdout.write(`平台: ${chalk.cyan(item.platformName || item.platform)}\n`);
      process.stdout.write(`类型: ${chalk.yellow(item.type)}\n`);
      process.stdout.write(`页面: ${chalk.gray(item.pageUrl || '')}\n`);
      if (item.screenshot) {
        process.stdout.write(`\n截图已保存: ${chalk.blue(item.screenshot)}\n`);
        try {
          const terminalImage = require('terminal-image');
          const fs = require('fs');
          if (fs.existsSync(item.screenshot)) {
            const preview = await terminalImage.file(item.screenshot, { width: 60, height: 20 });
            process.stdout.write(preview + '\n');
          }
        } catch (_) {
          process.stdout.write(chalk.gray('(终端不支持图片预览，请手动打开截图文件)\n'));
        }
      }
      const answers = await inquirer.prompt([
        { type: 'input', name: 'result', message: `请输入验证码结果${item.type === 'slider' ? '(滑块拖动像素数，如240)' : ''}:`, validate: (v) => !!v || '不能为空' },
        { type: 'input', name: 'operator', message: '操作员姓名：', default: 'compliance_officer' },
      ]);
      const ok = await this.captchaHandler.submitSolution(item.captchaId, answers.result, answers.operator);
      if (ok) process.stdout.write(chalk.green(`✔ 验证码结果已提交，任务将自动恢复\n`));
    }
  }

  async _cmdRun(args) {
    const target = args[0];
    const dataType = args[1] || null;
    if (!target) return process.stdout.write(chalk.red('请指定平台key 或 all\n'));
    const spinner = ora('正在调度...').start();
    try {
      if (target === 'all') {
        const tasks = await this.scheduler.runAllNow();
        spinner.succeed(`已调度 ${tasks.length} 个平台的采集任务`);
      } else {
        const task = await this.scheduler.runNow(target, dataType);
        spinner.succeed(`任务已调度 ${this._tid(task._id)} 平台=${task.platform}`);
      }
    } catch (err) {
      spinner.fail(err.message);
    }
  }

  async _cmdReport(args) {
    const type = args[0] || 'weekly';
    const spinner = ora(`生成${type === 'weekly' ? '周报' : type === 'monthly' ? '月报' : '报告'}...`).start();
    try {
      const report = type === 'monthly'
        ? await this.reportGenerator.generateMonthly()
        : await this.reportGenerator.generateWeekly();
      spinner.succeed(`报告已生成: ${chalk.blue(report.filePath)}`);
      process.stdout.write(`  标题: ${chalk.bold(report.title)}\n`);
      process.stdout.write(`  周期: ${format(new Date(report.from), 'yyyy-MM-dd')} ~ ${format(new Date(report.to), 'yyyy-MM-dd')}\n`);
      process.stdout.write(`  事件总数: ${report.summary?.find?.(s => s.label === '合规事件总数')?.value || '-'}\n`);
      process.stdout.write(`  紧急/重要: ${report.summary?.find?.(s => s.label === '紧急/重要事件')?.value || '-'}\n`);
    } catch (err) {
      spinner.fail('报告生成失败: ' + err.message);
      logger.error('报告生成失败', { error: err.message });
    }
  }

  async _cmdConfig(args) {
    const sub = args[0] || 'platforms';
    if (sub === 'platforms') {
      const platforms = this.configLoader.getEnabledPlatforms();
      const t = new Table({ head: ['Key', 'Code', '名称', '数据类型', '调度Cron', '超时'] });
      for (const p of platforms) {
        t.push([p.key, p.code, p.name, (p.data_types || []).join(','), p.schedule || '-', (p.timeout_minutes || 8) + '分钟']);
      }
      process.stdout.write(`已启用平台 (${platforms.length}个)\n${t.toString()}\n`);
      return;
    }
    if (sub === 'rules') {
      const rules = this.configLoader.getAlertRules();
      const t = new Table({ head: ['ID', '名称', '优先级', '状态', '动作'] });
      for (const [k, r] of Object.entries(rules)) {
        t.push([r.id || k, r.name, r.priority || '-', r.enabled === false ? chalk.red('停用') : chalk.green('启用'), r.action?.type || '-']);
      }
      process.stdout.write(`告警规则 (${Object.keys(rules).length}条)\n${t.toString()}\n`);
      return;
    }
    process.stdout.write(chalk.gray(JSON.stringify(this.configLoader.get(sub), null, 2).substring(0, 4000)) + '\n');
  }

  async _cmdAlerts(args) {
    const limit = Number(args[0]) || 50;
    const { items, total } = await repository.findAlerts({}, { limit });
    const t = new Table({ head: ['时间', '级别', '规则', '药品', '消息'] });
    for (const a of items) {
      const color = a.urgency === 'CRITICAL' ? chalk.red : a.urgency === 'HIGH' ? chalk.yellow : chalk.blue;
      t.push([
        format(new Date(a.createdAt), 'MM-dd HH:mm'),
        color(a.urgency),
        a.ruleId || '-',
        (a.drugName || '').substring(0, 12),
        (a.message || '').substring(0, 60),
      ]);
    }
    process.stdout.write(`最近告警 (共${total}，显示${items.length})\n${t.toString()}\n`);
  }

  async _cmdEvents(args) {
    const kw = args[0];
    const limit = Number(args[1]) || 30;
    const filter = {};
    if (kw) {
      filter['$or'] = [
        { drug_name: { $regex: kw, $options: 'i' } },
        { approval_no: { $regex: kw, $options: 'i' } },
        { title: { $regex: kw, $options: 'i' } },
      ];
    }
    const { items, total } = await repository.findEvents(filter, { limit });
    const t = new Table({ head: ['时间', '类型', '级别', '药品', '批准文号', '来源'] });
    for (const e of items) {
      const uColor = e.urgency === 'CRITICAL' ? chalk.red : e.urgency === 'HIGH' ? chalk.yellow : e.urgency === 'MEDIUM' ? chalk.yellow : chalk.blue;
      t.push([
        e.publish_date || '-',
        e.event_type,
        uColor(e.urgency || '-'),
        (e.drug_name || '').substring(0, 14),
        (e.approval_no || '').substring(0, 14),
        e.source_platform,
      ]);
    }
    process.stdout.write(`合规事件 (${kw ? `关键词: ${kw} ` : ''}共${total}条，显示${items.length})\n${t.toString()}\n`);
  }

  stop() {
    this.running = false;
    for (const h of this.intervalHandles) clearInterval(h);
    this.intervalHandles = [];
    try { this.rl?.close?.(); } catch (_) {}
    for (const [evt, fn] of Object.entries(this._boundHandlers)) {
      this.scheduler?.off?.(evt, fn);
      this.launcher?.off?.(evt, fn);
    }
    this._boundHandlers = {};
    logger.info('CLI仪表盘已停止');
  }
}

module.exports = CLIDashboard;
