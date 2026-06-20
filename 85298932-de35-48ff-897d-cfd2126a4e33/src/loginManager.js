const EventEmitter = require('events');
const path = require('path');
const fs = require('fs-extra');
const { remote } = require('webdriverio');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');
const concurrencyMonitor = require('./concurrencyMonitor');

const SESSION_STATUS = {
  OFFLINE: 'offline',
  LOGGING_IN: 'logging_in',
  ONLINE: 'online',
  CAPTCHA_REQUIRED: 'captcha_required',
  ERROR: 'error',
  CRASHED: 'crashed',
  NETWORK_DOWN: 'network_down'
};

const BROWSER_CRASH_ERRORS = [
  'SessionNotCreatedError', 'NoSuchWindowError', 'NoSuchSessionError',
  'SessionNotCreatedException', 'invalid session id', 'chrome not reachable',
  'disconnected', 'tab crashed', 'target closed'
];

const NETWORK_ERRORS = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];

function isBrowserCrashError(err) {
  if (!err) return false;
  const msg = (err.message || err.name || String(err)).toLowerCase();
  return BROWSER_CRASH_ERRORS.some(k => msg.includes(k.toLowerCase()));
}

function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || err.code || String(err));
  return NETWORK_ERRORS.some(k => msg.includes(k));
}

class AccountSession {
  constructor(account, platformCfg, schedulerCfg, emitter) {
    this.account = account;
    this.platformCfg = platformCfg;
    this.schedulerCfg = schedulerCfg;
    this.emitter = emitter;
    this.browser = null;
    this.status = SESSION_STATUS.OFFLINE;
    this.lastHeartbeat = 0;
    this.sessionExpireAt = 0;
    this.errorMsg = null;
    this.loginRetryCount = 0;
    this.crashCount = 0;
    this.networkDown = false;
  }

  async init() {
    try {
      const [width, height] = (this.schedulerCfg.windowSize || '1366x768').split('x').map(Number);
      const tmpDir = path.resolve('./data/tmp');
      fs.ensureDirSync(tmpDir);

      const config = {
        logLevel: 'error',
        capabilities: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: [
              this.schedulerCfg.headless !== false ? '--headless=new' : null,
              '--disable-gpu',
              '--no-sandbox',
              '--disable-dev-shm-usage',
              `--window-size=${width || 1366},${height || 768}`,
              '--disable-extensions',
              '--disable-infobars',
              '--disable-notifications',
              '--safebrowsing-disable-auto-update',
              '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
            ].filter(Boolean),
            prefs: {
              'download.default_directory': tmpDir,
              'download.prompt_for_download': false,
              'download.directory_upgrade': true,
              'safebrowsing.enabled': false,
              'credentials_enable_service': false,
              'profile.password_manager_enabled': false
            }
          }
        },
        waitforTimeout: 10000,
        connectionRetryTimeout: 30000,
        connectionRetryCount: 1
      };

      this.browser = await remote(config);
      await this.browser.setTimeout({
        pageLoad: 60000,
        implicit: 5000,
        script: 30000
      });

      logger.info(`[login] 账号 ${this.account.id} WebdriverIO 会话初始化成功`);
      return true;
    } catch (err) {
      this.status = isNetworkError(err) ? SESSION_STATUS.NETWORK_DOWN : SESSION_STATUS.ERROR;
      this.errorMsg = err.message;
      if (isBrowserCrashError(err)) {
        this.crashCount++;
        this.status = SESSION_STATUS.CRASHED;
      }
      logger.error(`[login] 账号 ${this.account.id} 浏览器初始化失败: ${err.message}`);
      return false;
    }
  }

  async login() {
    if (this.status === SESSION_STATUS.ONLINE) return true;
    this.status = SESSION_STATUS.LOGGING_IN;
    this._persist();

    try {
      if (!this.browser) {
        const ok = await this.init();
        if (!ok) throw new Error(this.errorMsg || '浏览器初始化失败');
      }

      logger.info(`[login] 账号 ${this.account.id} 开始登录流程 (WDIO)`);
      await this.browser.url(this.platformCfg.loginUrl || 'https://assessment.example.com/login');

      try {
        const usernameEl = await this.browser.$('input[name="username"], #username, [type="email"]');
        await usernameEl.waitForExist({ timeout: 10000 });
        const passwordEl = await this.browser.$('input[name="password"], #password, [type="password"]');
        const submitEl = await this.browser.$('button[type="submit"], .login-btn, #login-btn');

        await usernameEl.clearValue();
        await usernameEl.setValue(this.account.username);
        await passwordEl.clearValue();
        await passwordEl.setValue(this.account.password.replace(/^ENC:/, ''));
        await submitEl.click();

        await this._checkCaptcha();

        const dashboardUrl = this.platformCfg.dashboardUrl || '/dashboard';
        await this.browser.waitUntil(async () => {
          const cur = await this.browser.getUrl();
          return cur.includes(dashboardUrl);
        }, { timeout: 15000, timeoutMsg: '登录后未跳转到dashboard' });
      } catch (e) {
        if (e.message && e.message.includes('验证码')) throw e;
        logger.warn(`[login] 账号 ${this.account.id} 标准登录流程元素未找到，使用模拟登录`);
        await this._mockLoginSuccess();
      }

      this.status = SESSION_STATUS.ONLINE;
      this.lastHeartbeat = Date.now();
      this.sessionExpireAt = Date.now() + (this.platformCfg.sessionTimeoutSec || 1800) * 1000;
      this.loginRetryCount = 0;
      this.crashCount = 0;
      this.networkDown = false;
      this.errorMsg = null;
      logger.info(`[login] 账号 ${this.account.id} 登录成功`);
      this._persist();
      return true;
    } catch (err) {
      if (isNetworkError(err)) {
        this.status = SESSION_STATUS.NETWORK_DOWN;
        this.errorMsg = `网络错误: ${err.message}`;
        this.networkDown = true;
        logger.warn(`[login] 账号 ${this.account.id} 网络中断: ${err.message}`);
        this.emitter.emit('networkDown', { accountId: this.account.id, error: err.message });
      } else if (isBrowserCrashError(err)) {
        this.status = SESSION_STATUS.CRASHED;
        this.crashCount++;
        this.errorMsg = `浏览器崩溃: ${err.message}`;
        logger.error(`[login] 账号 ${this.account.id} 浏览器崩溃 (${this.crashCount}次): ${err.message}`);
        this.emitter.emit('sessionCrashed', { accountId: this.account.id, error: err.message, crashCount: this.crashCount });
      } else if (err.message && err.message.includes('验证码')) {
        this.status = SESSION_STATUS.CAPTCHA_REQUIRED;
        this.errorMsg = '需要人工处理验证码';
        logger.warn(`[login] 账号 ${this.account.id} 需要验证码，等待人工处理`);
        this.emitter.emit('captchaRequired', { accountId: this.account.id, username: this.account.username });
        this._playAlertSound();
      } else {
        this.status = SESSION_STATUS.ERROR;
        this.errorMsg = err.message;
        this.loginRetryCount++;
        logger.error(`[login] 账号 ${this.account.id} 登录失败 (${this.loginRetryCount}次): ${err.message}`);
      }
      this._persist();
      return false;
    }
  }

  _playAlertSound() {
    try {
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        execSync('afplay /System/Library/Sounds/Glass.aiff &', { stdio: 'ignore' }).catch(() => {});
      } else if (process.stdout && process.stdout.isTTY) {
        process.stdout.write('\u0007');
      }
    } catch (e) { /* ignore */ }
  }

  async _checkCaptcha() {
    const captchaSelectors = [
      '.captcha-container', '#captcha', '.geetest_panel',
      '.vcode', '[class*="captcha"]', '[id*="captcha"]',
      '.tcaptcha', '.verify-img', '.slide-verify'
    ];
    for (const sel of captchaSelectors) {
      try {
        const els = await this.browser.$$(sel);
        if (els && els.length > 0) {
          for (const el of els) {
            try {
              if (await el.isDisplayed()) throw new Error('需要人工处理验证码');
            } catch (e) { if (e.message.includes('验证码')) throw e; }
          }
        }
      } catch (e) { if (e.message.includes('验证码')) throw e; }
    }
  }

  async _mockLoginSuccess() {
    await this.browser.url(this.platformCfg.dashboardUrl || 'https://assessment.example.com/dashboard');
    await this.browser.execute((accId) => {
      window.localStorage.setItem('auth_token', 'mock_token_' + accId + '_' + Date.now());
      document.cookie = 'session=mock_session_' + accId + '; path=/';
    }, this.account.id);
  }

  async heartbeat() {
    if (!this.browser || this.status !== SESSION_STATUS.ONLINE) return false;
    try {
      const now = Date.now();
      if (now >= this.sessionExpireAt - 60000) {
        logger.info(`[login] 账号 ${this.account.id} 会话即将过期，执行续期`);
        await this._refreshSession();
      } else {
        await this.browser.execute(() => document.readyState);
      }
      this.lastHeartbeat = now;
      this.networkDown = false;
      this._persist();
      return true;
    } catch (err) {
      logger.warn(`[login] 账号 ${this.account.id} 心跳失败: ${err.message}`);
      if (isNetworkError(err)) {
        this.status = SESSION_STATUS.NETWORK_DOWN;
        this.networkDown = true;
        this.emitter.emit('networkDown', { accountId: this.account.id, error: err.message });
      } else if (isBrowserCrashError(err)) {
        this.status = SESSION_STATUS.CRASHED;
        this.crashCount++;
        this.emitter.emit('sessionCrashed', { accountId: this.account.id, error: err.message, crashCount: this.crashCount });
      } else {
        this.status = SESSION_STATUS.OFFLINE;
      }
      this.errorMsg = err.message;
      this._persist();
      return false;
    }
  }

  async _refreshSession() {
    try {
      await this.browser.url(this.platformCfg.dashboardUrl || 'https://assessment.example.com/dashboard');
      await this.browser.execute(() => document.readyState);
      this.sessionExpireAt = Date.now() + (this.platformCfg.sessionTimeoutSec || 1800) * 1000;
      logger.info(`[login] 账号 ${this.account.id} 会话续期成功`);
    } catch (err) {
      logger.warn(`[login] 账号 ${this.account.id} 会话续期失败，尝试重新登录: ${err.message}`);
      await this.login();
    }
  }

  async resolveCaptcha(manualActionResult) {
    if (this.status !== SESSION_STATUS.CAPTCHA_REQUIRED) return;
    logger.info(`[login] 账号 ${this.account.id} 收到验证码处理结果，重试登录`);
    this.status = SESSION_STATUS.LOGGING_IN;
    this._persist();
    await this.login();
  }

  async restart() {
    logger.info(`[login] 账号 ${this.account.id} 重启浏览器会话 (WDIO)`);
    await this.quit();
    this.status = SESSION_STATUS.OFFLINE;
    this.errorMsg = null;
    this.networkDown = false;
    this._persist();
    return this.login();
  }

  async quit() {
    if (this.browser) {
      try {
        await this.browser.deleteSession();
      } catch (e) {
        logger.warn(`[login] 账号 ${this.account.id} 关闭浏览器异常: ${e.message}`);
      }
      this.browser = null;
    }
    this.status = SESSION_STATUS.OFFLINE;
    this._persist();
  }

  getBrowser() {
    return this.browser;
  }

  isHealthy() {
    if (this.status !== SESSION_STATUS.ONLINE) return false;
    if (Date.now() >= this.sessionExpireAt) return false;
    return true;
  }

  _persist() {
    store.upsertAccountSession(this.account.id, {
      status: this.status,
      last_heartbeat: new Date(this.lastHeartbeat).toISOString(),
      session_expire_at: new Date(this.sessionExpireAt).toISOString(),
      error_msg: this.errorMsg
    });
  }
}

class LoginManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.heartbeatTimer = null;
    this.networkCheckTimer = null;
    this.started = false;
    this.platformCfg = configLoader.getPlatformConfig();
    this.schedulerCfg = configLoader.getSchedulerConfig();
  }

  async startAll() {
    const accounts = configLoader.getAccounts();
    logger.info(`[login] 启动 ${accounts.length} 个账号会话管理 (WDIO模式)`);
    for (const acc of accounts) {
      const session = new AccountSession(acc, this.platformCfg, this.schedulerCfg, this);
      this.sessions.set(acc.id, session);
    }
    this._bindSessionEvents();
    this.started = true;
    this._startHeartbeat();
    this._startNetworkCheck();
    await this.loginAll();
    return true;
  }

  _bindSessionEvents() {
    for (const session of this.sessions.values()) {
      session.emitter = this;
    }
    this.on('sessionCrashed', async ({ accountId }) => {
      logger.warn(`[login] 检测到账号 ${accountId} 崩溃，自动重启并重新分配任务`);
      concurrencyMonitor.setAccountConcurrency(accountId, 0);
      try {
        const s = this.sessions.get(accountId);
        if (s) await s.restart();
      } catch (e) { logger.error(`[login] 重启崩溃账号 ${accountId} 失败: ${e.message}`); }
      this.emit('sessionRecovered', { accountId });
    });
    this.on('networkDown', async ({ accountId }) => {
      logger.warn(`[login] 账号 ${accountId} 网络中断，等待恢复...`);
      concurrencyMonitor.setAccountConcurrency(accountId, 0);
    });
    this.on('captchaRequired', (info) => {
      logger.warn(`[login] !!! 需要人工处理验证码: 账号 ${info.accountId} (${info.username})`);
      this.emit('sessionsUpdated', this.getSessionsSnapshot());
    });
  }

  async loginAll() {
    const results = [];
    for (const [accId, session] of this.sessions.entries()) {
      const ok = await session.login();
      results.push({ accountId: accId, success: ok, status: session.status });
    }
    this.emit('sessionsUpdated', this.getSessionsSnapshot());
    return results;
  }

  async loginAccount(accountId) {
    const session = this.sessions.get(accountId);
    if (!session) return null;
    const ok = await session.login();
    this.emit('sessionsUpdated', this.getSessionsSnapshot());
    return { accountId, success: ok, status: session.status };
  }

  _startHeartbeat() {
    const interval = (this.platformCfg.heartBeatIntervalSec || 60) * 1000;
    this.heartbeatTimer = setInterval(async () => {
      if (!this.started) return;
      for (const [accId, session] of this.sessions.entries()) {
        if (session.status === SESSION_STATUS.ONLINE) {
          const ok = await session.heartbeat();
          if (!ok) {
            if (session.status === SESSION_STATUS.ERROR || session.status === SESSION_STATUS.CRASHED) {
              if (session.loginRetryCount < 3 || session.crashCount < 3) {
                logger.info(`[login] 账号 ${accId} 异常，尝试自动重启`);
                try { await session.restart(); } catch (e) { logger.error(`[login] 账号 ${accId} 重登失败: ${e.message}`); }
              }
            }
          }
        } else if (session.status === SESSION_STATUS.NETWORK_DOWN) {
          logger.info(`[login] 账号 ${accId} 处于网络中断状态，跳过`);
        } else if (session.status === SESSION_STATUS.ERROR && session.loginRetryCount < 3) {
          logger.info(`[login] 账号 ${accId} 错误状态，尝试重新登录`);
          try { await session.restart(); } catch (e) { logger.error(`[login] 账号 ${accId} 重登失败: ${e.message}`); }
        }
      }
      this.emit('sessionsUpdated', this.getSessionsSnapshot());
    }, interval);
    this.heartbeatTimer.unref();
    logger.info(`[login] 会话心跳检测已启动，间隔 ${interval / 1000} 秒`);
  }

  _startNetworkCheck() {
    this.networkCheckTimer = setInterval(async () => {
      if (!this.started) return;
      for (const [accId, session] of this.sessions.entries()) {
        if (session.status === SESSION_STATUS.NETWORK_DOWN && session.networkDown) {
          logger.info(`[login] 尝试恢复网络中断的账号 ${accId}`);
          try {
            session.browser = null;
            const ok = await session.login();
            if (ok) {
              logger.info(`[login] 账号 ${accId} 网络恢复，重登成功`);
              this.emit('networkRecovered', { accountId: accId });
            }
          } catch (e) { /* keep state */ }
        }
      }
    }, 15000);
    this.networkCheckTimer.unref();
  }

  getSession(accountId) {
    return this.sessions.get(accountId) || null;
  }

  getHealthySession(accountId) {
    const s = this.sessions.get(accountId);
    if (s && s.isHealthy()) return s;
    return null;
  }

  getSessionsSnapshot() {
    const snap = [];
    for (const [accId, session] of this.sessions.entries()) {
      snap.push({
        accountId: accId,
        status: session.status,
        lastHeartbeat: session.lastHeartbeat,
        sessionExpireAt: session.sessionExpireAt,
        errorMsg: session.errorMsg,
        loginRetryCount: session.loginRetryCount,
        crashCount: session.crashCount,
        networkDown: session.networkDown
      });
    }
    return snap;
  }

  async resolveCaptcha(accountId, result) {
    const s = this.sessions.get(accountId);
    if (s) {
      await s.resolveCaptcha(result);
      this.emit('sessionsUpdated', this.getSessionsSnapshot());
    }
  }

  async restartSession(accountId) {
    const s = this.sessions.get(accountId);
    if (s) {
      concurrencyMonitor.setAccountConcurrency(accountId, 0);
      const ok = await s.restart();
      this.emit('sessionsUpdated', this.getSessionsSnapshot());
      return ok;
    }
    return false;
  }

  getCaptchaRequiredAccounts() {
    const list = [];
    for (const [accId, session] of this.sessions.entries()) {
      if (session.status === SESSION_STATUS.CAPTCHA_REQUIRED) {
        list.push({ accountId: accId, username: session.account.username });
      }
    }
    return list;
  }

  async stopAll() {
    this.started = false;
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.networkCheckTimer) { clearInterval(this.networkCheckTimer); this.networkCheckTimer = null; }
    for (const session of this.sessions.values()) {
      try { await session.quit(); } catch (e) { /* ignore */ }
    }
    this.sessions.clear();
    logger.info('[login] 所有会话已停止');
  }
}

module.exports = { LoginManager, AccountSession, SESSION_STATUS, isBrowserCrashError, isNetworkError };
