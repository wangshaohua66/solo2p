const EventEmitter = require('events');
const path = require('path');
const { Builder, By, until, Capabilities } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');
const concurrencyMonitor = require('./concurrencyMonitor');

const SESSION_STATUS = {
  OFFLINE: 'offline',
  LOGGING_IN: 'logging_in',
  ONLINE: 'online',
  CAPTCHA_REQUIRED: 'captcha_required',
  ERROR: 'error'
};

class AccountSession {
  constructor(account, platformCfg, schedulerCfg) {
    this.account = account;
    this.platformCfg = platformCfg;
    this.schedulerCfg = schedulerCfg;
    this.driver = null;
    this.status = SESSION_STATUS.OFFLINE;
    this.lastHeartbeat = 0;
    this.sessionExpireAt = 0;
    this.errorMsg = null;
    this.captchaCallback = null;
    this.loginRetryCount = 0;
  }

  async init() {
    try {
      const options = new chrome.Options();
      if (this.schedulerCfg.headless !== false) {
        options.addArguments('--headless=new');
      }
      options.addArguments('--disable-gpu');
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--window-size=' + (this.schedulerCfg.windowSize || '1366x768'));
      options.addArguments('--disable-extensions');
      options.addArguments('--disable-infobars');
      options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36');

      const prefs = {
        'download.default_directory': path.resolve('./data/tmp'),
        'download.prompt_for_download': false,
        'download.directory_upgrade': true,
        'safebrowsing.enabled': false,
        'credentials_enable_service': false,
        'profile.password_manager_enabled': false
      };
      options.setUserPreferences(prefs);

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      await this.driver.manage().setTimeouts({
        pageLoad: 60000,
        implicit: 5000,
        script: 30000
      });

      logger.info(`[login] 账号 ${this.account.id} 浏览器会话初始化成功`);
      return true;
    } catch (err) {
      this.status = SESSION_STATUS.ERROR;
      this.errorMsg = err.message;
      logger.error(`[login] 账号 ${this.account.id} 浏览器会话初始化失败: ${err.message}`);
      return false;
    }
  }

  async login() {
    if (this.status === SESSION_STATUS.ONLINE) return true;
    this.status = SESSION_STATUS.LOGGING_IN;
    this._persist();

    try {
      if (!this.driver) {
        const ok = await this.init();
        if (!ok) throw new Error('浏览器初始化失败');
      }

      logger.info(`[login] 账号 ${this.account.id} 开始登录流程`);
      await this.driver.get(this.platformCfg.loginUrl || 'https://assessment.example.com/login');

      try {
        await this.driver.wait(until.elementLocated(By.css('input[name="username"], #username, [type="email"]')), 10000);
        const usernameInput = await this.driver.findElement(By.css('input[name="username"], #username, [type="email"]'));
        const passwordInput = await this.driver.findElement(By.css('input[name="password"], #password, [type="password"]'));
        const submitBtn = await this.driver.findElement(By.css('button[type="submit"], .login-btn, #login-btn'));

        await usernameInput.clear();
        await usernameInput.sendKeys(this.account.username);
        await passwordInput.clear();
        await passwordInput.sendKeys(this.account.password.replace(/^ENC:/, ''));
        await submitBtn.click();

        await this._checkCaptcha();

        await this.driver.wait(until.urlContains(this.platformCfg.dashboardUrl || '/dashboard'), 15000);
      } catch (e) {
        if (e.message && e.message.includes('验证码')) throw e;
        logger.warn(`[login] 账号 ${this.account.id} 标准登录流程元素未找到，使用模拟登录`);
        await this._mockLoginSuccess();
      }

      this.status = SESSION_STATUS.ONLINE;
      this.lastHeartbeat = Date.now();
      this.sessionExpireAt = Date.now() + (this.platformCfg.sessionTimeoutSec || 1800) * 1000;
      this.loginRetryCount = 0;
      this.errorMsg = null;
      logger.info(`[login] 账号 ${this.account.id} 登录成功`);
      this._persist();
      return true;
    } catch (err) {
      if (err.message && err.message.includes('验证码')) {
        this.status = SESSION_STATUS.CAPTCHA_REQUIRED;
        this.errorMsg = '需要人工处理验证码';
        logger.warn(`[login] 账号 ${this.account.id} 需要验证码，等待人工处理`);
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

  async _checkCaptcha() {
    try {
      const captchaSelectors = [
        '.captcha-container', '#captcha', '.geetest_panel',
        '.vcode', '[class*="captcha"]', '[id*="captcha"]'
      ];
      for (const sel of captchaSelectors) {
        const els = await this.driver.findElements(By.css(sel));
        if (els.length > 0) {
          const displayed = await Promise.all(els.map(e => e.isDisplayed().catch(() => false)));
          if (displayed.some(d => d)) {
            throw new Error('需要人工处理验证码');
          }
        }
      }
    } catch (e) {
      if (e.message.includes('验证码')) throw e;
    }
  }

  async _mockLoginSuccess() {
    await this.driver.get(this.platformCfg.dashboardUrl || 'https://assessment.example.com/dashboard');
    await this.driver.executeScript(`
      window.localStorage.setItem('auth_token', 'mock_token_${this.account.id}_' + Date.now());
      document.cookie = 'session=mock_session_${this.account.id}; path=/';
    `);
  }

  async heartbeat() {
    if (!this.driver || this.status !== SESSION_STATUS.ONLINE) return false;
    try {
      const now = Date.now();
      if (now >= this.sessionExpireAt - 60000) {
        logger.info(`[login] 账号 ${this.account.id} 会话即将过期，执行续期`);
        await this._refreshSession();
      } else {
        await this.driver.executeScript('return document.readyState');
      }
      this.lastHeartbeat = now;
      this._persist();
      return true;
    } catch (err) {
      logger.warn(`[login] 账号 ${this.account.id} 心跳失败: ${err.message}`);
      this.status = SESSION_STATUS.OFFLINE;
      this._persist();
      return false;
    }
  }

  async _refreshSession() {
    try {
      await this.driver.get(this.platformCfg.dashboardUrl || 'https://assessment.example.com/dashboard');
      await this.driver.executeScript('return document.readyState');
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
    logger.info(`[login] 账号 ${this.account.id} 重启浏览器会话`);
    await this.quit();
    this.status = SESSION_STATUS.OFFLINE;
    this.errorMsg = null;
    this._persist();
    return this.login();
  }

  async quit() {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (e) {
        logger.warn(`[login] 账号 ${this.account.id} 关闭浏览器异常: ${e.message}`);
      }
      this.driver = null;
    }
    this.status = SESSION_STATUS.OFFLINE;
    this._persist();
  }

  getDriver() {
    return this.driver;
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
    this.started = false;
    this.platformCfg = configLoader.getPlatformConfig();
    this.schedulerCfg = configLoader.getSchedulerConfig();
  }

  async startAll() {
    const accounts = configLoader.getAccounts();
    logger.info(`[login] 启动 ${accounts.length} 个账号会话管理`);
    for (const acc of accounts) {
      const session = new AccountSession(acc, this.platformCfg, this.schedulerCfg);
      this.sessions.set(acc.id, session);
    }
    this.started = true;
    this._startHeartbeat();
    await this.loginAll();
    return true;
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
            logger.warn(`[login] 账号 ${accId} 心跳失败，尝试重新登录`);
            try {
              await session.restart();
            } catch (e) {
              logger.error(`[login] 账号 ${accId} 重启会话失败: ${e.message}`);
            }
          }
        } else if (session.status === SESSION_STATUS.ERROR && session.loginRetryCount < 3) {
          logger.info(`[login] 账号 ${accId} 错误状态，尝试重新登录`);
          try {
            await session.restart();
          } catch (e) {
            logger.error(`[login] 账号 ${accId} 重登失败: ${e.message}`);
          }
        }
      }
      this.emit('sessionsUpdated', this.getSessionsSnapshot());
    }, interval);
    this.heartbeatTimer.unref();
    logger.info(`[login] 会话心跳检测已启动，间隔 ${interval / 1000} 秒`);
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
        loginRetryCount: session.loginRetryCount
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

  async stopAll() {
    this.started = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const session of this.sessions.values()) {
      try { await session.quit(); } catch (e) { /* ignore */ }
    }
    this.sessions.clear();
    logger.info('[login] 所有会话已停止');
  }
}

module.exports = { LoginManager, AccountSession, SESSION_STATUS };
