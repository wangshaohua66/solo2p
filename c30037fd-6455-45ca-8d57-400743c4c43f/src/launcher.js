'use strict';

const path = require('path');
const EventEmitter = require('events');
const ConfigLoader = require('./utils/configLoader');
const { logger } = require('./utils/logger');
const repository = require('./storage/repository');
const CaptchaHandler = require('./captcha/captchaHandler');
const AlertEngine = require('./alert/alertEngine');
const TaskScheduler = require('./scheduler/taskScheduler');
const ReportGenerator = require('./report/reportGenerator');
const CLIDashboard = require('./cli/dashboard');

class ComplianceMonitorLauncher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.configLoader = null;
    this.repository = repository;
    this.captchaHandler = null;
    this.alertEngine = null;
    this.scheduler = null;
    this.reportGenerator = null;
    this.dashboard = null;
    this.started = false;
  }

  async init() {
    if (this.started) return this;
    const configDir = this.options.configDir || process.env.CONFIG_DIR || path.resolve(process.cwd(), 'config');
    this.configLoader = new ConfigLoader(configDir);
    await this.configLoader.init();
    logger.info(`配置加载完成，启用平台: ${this.configLoader.getEnabledPlatforms().length} 个`);

    try {
      await this.repository.init();
    } catch (err) {
      logger.error('存储层初始化失败', { error: err.message });
      if (!process.env.ALLOW_NO_DB) throw err;
    }

    this.captchaHandler = new CaptchaHandler(this.configLoader.get('system') || {});
    this.alertEngine = new AlertEngine(this.configLoader.getAlertRules(), this.configLoader.getUrgencyLevels());
    this.scheduler = new TaskScheduler(this.configLoader, {
      captchaHandler: this.captchaHandler,
      alertEngine: this.alertEngine,
    });
    this.reportGenerator = new ReportGenerator();
    this.dashboard = new CLIDashboard(
      this.scheduler, this.captchaHandler, this.alertEngine, this.configLoader, this.reportGenerator
    );

    this._forwardEvents();
    this._registerHotReload();
    this.started = true;
    logger.info('合规监控引擎初始化完成');
    return this;
  }

  _forwardEvents() {
    const forward = (src, events) => {
      for (const evt of events) {
        src.on(evt, (...args) => this.emit(evt, ...args));
      }
    };
    forward(this.scheduler, [
      'task:scheduled', 'task:started', 'task:completed', 'task:failed', 'status:sync',
    ]);
    forward(this.captchaHandler, ['captcha:pending', 'captcha:resolved']);
    forward(this.alertEngine, ['alert:fired']);
    forward(this.dashboard, ['request:stop']);
  }

  _registerHotReload() {
    this.configLoader.on('alertRules:changed', ({ new: n }) => {
      this.alertEngine.reload(n?.alert_rules || {}, n?.urgency_levels || {});
      logger.info('告警规则已热重载');
    });
    this.configLoader.on('config:changed', () => {
      this.emit('config:changed');
    });
  }

  async start() {
    await this.init();
    this.dashboard.on('request:stop', async () => this.stop());
    await this.scheduler.start();
    await this.dashboard.start(this);

    process.on('SIGINT', async () => {
      logger.info('SIGINT 收到，准备关闭...');
      await this.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM 收到，准备关闭...');
      await this.stop();
      process.exit(0);
    });
    process.on('uncaughtException', (err) => {
      logger.error('未捕获异常', { error: err.message, stack: err.stack?.substring(0, 500) });
    });
    process.on('unhandledRejection', (reason, p) => {
      logger.error('未处理的Promise拒绝', { reason: String(reason).substring(0, 500) });
    });
    logger.info('合规监控引擎已启动，按 Ctrl+C 退出');
    return this;
  }

  async stop() {
    logger.info('关闭合规监控引擎...');
    try { await this.scheduler?.stop?.(); } catch (e) { logger.warn('调度器关闭异常: ' + e.message); }
    try { this.dashboard?.stop?.(); } catch (_) {}
    try { await this.repository?.close?.(); } catch (_) {}
    try { this.configLoader?.stop?.(); } catch (_) {}
    this.started = false;
    logger.info('合规监控引擎已安全关闭');
  }

  get(name) {
    switch (name) {
      case 'scheduler': return this.scheduler;
      case 'configLoader': return this.configLoader;
      case 'captcha': return this.captchaHandler;
      case 'alert': return this.alertEngine;
      case 'report': return this.reportGenerator;
      case 'dashboard': return this.dashboard;
      case 'repository': return this.repository;
      default: return null;
    }
  }
}

async function main() {
  const launcher = new ComplianceMonitorLauncher();
  await launcher.start();
  return launcher;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}

module.exports = ComplianceMonitorLauncher;
module.exports.main = main;
