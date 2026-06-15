'use strict';

const fs = require('fs');
const path = require('path');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const EventEmitter = require('events');
const { createTaskLogger, logger } = require('../utils/logger');
const CaptchaHandler = require('../captcha/captchaHandler');

class BasePlatformCollector extends EventEmitter {
  constructor(config, options = {}) {
    super();
    this.config = config;
    this.platformKey = options.platformKey;
    this.driver = null;
    this.taskLogger = null;
    this.task = null;
    this.currentAccount = null;
    this.accountIndex = 0;
    this.sessionExpiryAt = 0;
    this.captchaHandler = options.captchaHandler || new CaptchaHandler();
    this.stopRequested = false;
    this.sessionAlive = false;
    this.systemConfig = options.systemConfig || {};
    this._accountRotations = 0;
  }

  async run(task, signal) {
    this.task = task;
    this.taskLogger = createTaskLogger(task._id?.toString() || String(Date.now()), this.config.code);
    this.taskLogger.info(`开始采集任务 平台=${this.config.name} 数据类型=${task.dataType || 'ALL'}`);
    this.emit('status:running', { platform: this.config.code, taskId: task._id });
    const abort = new AbortController();
    signal?.addEventListener?.('abort', () => { this.stopRequested = true; abort.abort(); });

    try {
      await this._initDriver();
      const loggedIn = await this._ensureLoggedIn();
      if (!loggedIn) throw new Error('登录失败，所有账号均无法通过');

      this.sessionAlive = true;
      this._startSessionKeepalive();

      const dataTypes = task.dataType ? [task.dataType] : (this.config.data_types || []);
      const allRecords = [];
      for (const dataType of dataTypes) {
        if (this.stopRequested) break;
        try {
          this._setContext({ currentStep: `navigate_${dataType}`, dataType });
          await this.navigateToDataType(dataType);
          await this._handlePopups();
          const records = await this.collectPaged(dataType);
          this.taskLogger.info(`[${dataType}] 采集完成 ${records.length} 条`);
          allRecords.push(...records.map((r) => ({ ...r, _dataType: dataType })));
        } catch (err) {
          this.taskLogger.error(`[${dataType}] 采集出错: ${err.message}`);
        }
      }

      this._stopSessionKeepalive();
      this.taskLogger.info(`平台采集完成，合计 ${allRecords.length} 条`);
      this.emit('status:idle', { platform: this.config.code });
      return { records: allRecords, error: null };
    } catch (err) {
      this.taskLogger?.error(`平台任务异常终止: ${err.message}`, { stack: err.stack });
      this.emit('status:error', { platform: this.config.code, error: err.message });
      return { records: [], error: err.message };
    } finally {
      try { await this.driver?.quit(); } catch (_) {}
      this.driver = null;
      this.sessionAlive = false;
    }
  }

  async _initDriver() {
    const opts = new chrome.Options();
    const headless = process.env.HEADLESS !== 'false';
    if (headless) opts.addArguments('--headless=new');
    opts.addArguments('--no-sandbox');
    opts.addArguments('--disable-dev-shm-usage');
    opts.addArguments('--disable-gpu');
    opts.addArguments('--window-size=1920,1080');
    opts.addArguments(`--user-agent=${this.systemConfig.user_agent || 'Mozilla/5.0'}`);
    opts.addArguments('--disable-blink-features=AutomationControlled');
    opts.excludeSwitches('enable-automation');
    opts.setUserPreferences({
      credentials_enable_service: false,
      profile: { password_manager_enabled: false },
      download: { default_directory: '/tmp/downloads' },
    });

    const svc = new chrome.ServiceBuilder();
    if (process.env.CHROMEDRIVER_PATH) svc.setPath(process.env.CHROMEDRIVER_PATH);

    const builder = new Builder()
      .forBrowser('chrome')
      .setChromeOptions(opts)
      .setChromeService(svc);

    this.driver = await builder.build();
    const timeout = this.systemConfig.navigation_timeout_ms || 60000;
    await this.driver.manage().setTimeouts({
      implicit: 5000,
      pageLoad: timeout,
      script: 30000,
    });
    this.taskLogger.debug('Chrome WebDriver 初始化完成');
  }

  async _ensureLoggedIn() {
    const accounts = this.config.auth?.accounts || [];
    const mode = this.config.auth?.mode || 'credentials';
    if (accounts.length === 0) {
      this.taskLogger.warn('未配置账号，尝试免密浏览');
      await this.driver.get(this.config.base_url);
      return true;
    }
    const startIdx = this.accountIndex % accounts.length;
    for (let i = 0; i < accounts.length; i++) {
      const idx = (startIdx + i) % accounts.length;
      const account = accounts[idx];
      this.currentAccount = account;
      this._setContext({ currentAccount: account.username });
      try {
        if (mode === 'cookie' || this.config.auth?.cookie_injection) {
          const injected = await this._tryInjectCookies(account);
          if (injected) {
            this.taskLogger.info(`[${account.username}] Cookie 注入登录成功`);
            this.accountIndex = idx + 1;
            return true;
          }
        }
        await this._performLogin(account);
        const ok = await this._checkLoginSuccess();
        if (ok) {
          this.taskLogger.info(`[${account.username}] 登录成功`);
          await this._saveSessionCookies(account);
          this.accountIndex = idx + 1;
          return true;
        }
        this.taskLogger.warn(`[${account.username}] 登录验证失败`);
      } catch (err) {
        this.taskLogger.warn(`[${account.username}] 登录异常: ${err.message}`);
      }
      this._accountRotations++;
      if (this._accountRotations > accounts.length * 2) {
        throw new Error(`账号轮换次数超限，可能全被风控`);
      }
    }
    return false;
  }

  async _tryInjectCookies(account) {
    try {
      await this.driver.get(this.config.base_url);
      const { Repository } = require('../storage/repository');
      const cached = await Repository.loadSession(this.platformKey, account.username);
      if (!cached || !cached.cookies || !Array.isArray(cached.cookies)) return false;
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) return false;
      for (const ck of cached.cookies) {
        try {
          const safe = { name: ck.name, value: ck.value, domain: ck.domain, path: ck.path || '/' };
          await this.driver.manage().addCookie(safe);
        } catch (_) {}
      }
      await this.driver.navigate().refresh();
      await new Promise((r) => setTimeout(r, 2000));
      return this._checkLoginSuccess();
    } catch (err) {
      this.taskLogger.debug('Cookie 注入失败: ' + err.message);
      return false;
    }
  }

  async _saveSessionCookies(account) {
    try {
      const cookies = await this.driver.manage().getCookies();
      const expires = new Date(Date.now() + 25 * 60 * 1000);
      const { Repository } = require('../storage/repository');
      await Repository.saveSession(this.platformKey, account.username, cookies, expires);
      this.sessionExpiryAt = expires.getTime();
    } catch (_) {}
  }

  async _performLogin(account) {
    await this.driver.get(this.config.login_url || this.config.base_url);
    await this._handleCaptchaIfAny('login');
    const form = this.config.selectors?.login_form || {};
    const usernameSel = form.username_input || form.user || form.username || 'input[type="text"]';
    const passwordSel = form.password_input || form.pwd || form.password || 'input[type="password"]';
    const submitSel = form.submit_button || form.submit || form.login_button || form.login_btn || 'button[type="submit"]';

    const uname = await this._waitForEl(usernameSel, 15000);
    await uname.clear();
    await this._typeHumanized(uname, account.username);
    this.taskLogger.debug(`输入用户名 ${account.username}`);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

    const pwd = await this._waitForEl(passwordSel, 5000);
    await pwd.clear();
    await this._typeHumanized(pwd, account.password);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

    if (form.verify_code || form.captcha) {
      await this._handleCaptchaIfAny('login');
    }
    await this._handleCaptchaIfAny('login');

    const btn = await this._waitForEl(submitSel, 5000);
    await btn.click();
    await new Promise((r) => setTimeout(r, 3000));
  }

  async _checkLoginSuccess() {
    try {
      const curUrl = await this.driver.getCurrentUrl();
      if (curUrl.includes('login') || curUrl.includes('signin') || curUrl.includes('sso')) {
        return false;
      }
      const title = await this.driver.getTitle();
      if (/登录|登陆|login|sign\s*in/i.test(title)) return false;
      const bodyText = await this.driver.findElement(By.css('body')).getText().catch(() => '');
      if (/登录失败|密码错误|账号不存在|验证码错误|captcha/i.test(bodyText)) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  _startSessionKeepalive() {
    const interval = (this.systemConfig.session_refresh_interval_minutes || 10) * 60 * 1000;
    this._keepaliveTimer = setInterval(async () => {
      if (!this.sessionAlive || !this.driver || this.stopRequested) return;
      try {
        await this.driver.executeScript('window.location.reload()');
        await new Promise((r) => setTimeout(r, 3000));
        const loggedIn = await this._checkLoginSuccess();
        if (!loggedIn) {
          this.taskLogger.warn('会话失效，尝试自动重新登录');
          this.sessionAlive = await this._ensureLoggedIn();
          if (!this.sessionAlive) this.emit('status:disconnected', { platform: this.config.code });
        } else {
          this.taskLogger.debug('会话保活刷新完成');
        }
        const remaining = (this.sessionExpiryAt - Date.now()) / 60000;
        if (remaining < 5) {
          this.emit('status:warning', { platform: this.config.code, message: `会话剩余 ${remaining.toFixed(0)} 分钟` });
        }
      } catch (err) {
        this.taskLogger.warn('会话保活异常: ' + err.message);
      }
    }, interval);
  }

  _stopSessionKeepalive() {
    if (this._keepaliveTimer) clearInterval(this._keepaliveTimer);
    this._keepaliveTimer = null;
  }

  async _setContext(ctx) {
    this.taskContext = { ...this.taskContext, ...ctx };
    this.taskContext.taskId = this.task?._id;
    this.taskContext.platform = { code: this.config.code, name: this.config.name };
  }

  async _handleCaptchaIfAny(stage = 'navigate') {
    const capSelectors = this.config.selectors?.captcha_detect || {};
    const detected = await this.captchaHandler.detect(this.driver, capSelectors);
    if (!detected) return true;
    this.emit('status:captcha', { platform: this.config.code, type: detected.type, stage });
    const captchaId = await this.captchaHandler.interrupt(this.taskContext, this.driver, detected, this.config.selectors);
    try {
      const result = await this.captchaHandler.waitForResolution(captchaId, 10 * 60 * 1000);
      await this.captchaHandler.applyResolution(this.driver, detected.type, result, this.config.selectors);
      return true;
    } catch (err) {
      this.taskLogger.error(`验证码处理失败: ${err.message}`);
      return false;
    }
  }

  async _handlePopups() {
    try {
      const buttons = ['button.close', '.modal-close', '.close-btn', '[aria-label="关闭"]', '.ant-modal-close'];
      for (const sel of buttons) {
        const els = await this.driver.findElements(By.css(sel));
        for (const el of els) {
          try { if (await el.isDisplayed()) await el.click(); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  async navigateToDataType(dataType) {
    const nav = this.config.selectors?.navigation || {};
    const map = {
      recall: nav.recall_tab,
      gsp_inspection: nav.gsp_tab,
      license_expiry: nav.license_menu,
      bid_result: nav.winning_announcement || nav.tender_board,
      adr_report: nav.report_notice,
      sampling_result: nav.submenu_drug_check,
      gsp_cert: nav.gsp_tab,
      license_change: nav.license_notice,
      approval_change: nav.expiry_query,
    };
    const sel = map[dataType];
    if (sel) {
      await this._waitAndClick(sel);
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (nav.query_button) {
      try {
        await this._waitAndClick(nav.query_button);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (_) {}
    }
  }

  async collectPaged(dataType) {
    const pagination = this.config.selectors?.pagination || {};
    const tableCfg = this.config.selectors?.data_table || {};
    const records = [];
    const maxPages = Math.min(50, Math.ceil((this.config.collection_depth || 30) / 20));

    for (let page = 1; page <= maxPages; page++) {
      if (this.stopRequested) break;
      try {
        await this._handlePopups();
        await this._handleCaptchaIfAny(`page_${page}`);
        const pageRecords = await this._parseCurrentPage(tableCfg);
        records.push(...pageRecords);
        this.taskLogger.debug(`第 ${page} 页 采集 ${pageRecords.length} 条`);

        const hasMore = await this._goNextPage(pagination);
        if (!hasMore) {
          this.taskLogger.debug('已翻至最后一页');
          break;
        }
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
      } catch (err) {
        this.taskLogger.warn(`翻页出错 (page=${page}): ${err.message}`);
        break;
      }
    }
    if (pagination.scroll_infinite || pagination.auto_scroll) {
      const scrollRecords = await this._scrollCollect(tableCfg, pagination);
      records.push(...scrollRecords);
    }
    return records;
  }

  async _parseCurrentPage(tableCfg) {
    try {
      const html = await this.driver.getPageSource();
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      const rowSel = tableCfg.rows || tableCfg.items || tableCfg.cards || 'tr';
      $(rowSel).each((_, el) => {
        const rec = this._extractRow($, $(el), tableCfg);
        if (rec && (rec.drug_name || rec.approval_no || rec.notice_no)) results.push(rec);
      });
      return results;
    } catch (err) {
      this.taskLogger.warn('页面解析失败: ' + err.message);
      return [];
    }
  }

  _extractRow($, row, cfg) {
    const rec = {};
    const columns = cfg.columns || cfg.fields || cfg.mappings || cfg.parsers || cfg.extractors || cfg.mapping || {};
    const columnMap = cfg.columns_map;

    if (columnMap) {
      const tds = row.find('td, th, .col');
      Object.entries(columnMap).forEach(([key, idx]) => {
        rec[key] = tds.eq(idx).text().trim();
      });
      const link = tds.eq(0).find('a');
      if (link.length) rec.detail_url = link.attr('href') || '';
    } else {
      Object.entries(columns).forEach(([key, sel]) => {
        if (typeof sel === 'number') return;
        try {
          const el = row.find(sel);
          rec[key] = el.length ? (el.text().trim() || el.attr('title') || '') : '';
          if (key === 'detail_url') rec[key] = el.attr('href') || '';
        } catch (_) {}
      });
    }
    const anyLink = row.find('a').first();
    if (!rec.detail_url && anyLink.length) rec.detail_url = anyLink.attr('href') || '';
    return rec;
  }

  async _goNextPage(pagination) {
    const candidates = [pagination.next_button, pagination.next_page, pagination.next, pagination.next_link, pagination.next_btn, 'a.next:not(.disabled)'];
    for (const sel of candidates) {
      if (!sel) continue;
      try {
        const btn = await this.driver.findElement(By.css(sel));
        if (!await btn.isDisplayed()) continue;
        const disabled = await btn.getAttribute('class').then((c) => /disabled|end|none/.test(c || '')).catch(() => false);
        if (disabled) return false;
        await btn.click();
        await new Promise((r) => setTimeout(r, 1500));
        return true;
      } catch (_) {}
    }
    if (pagination.load_more || pagination.more_button) {
      try {
        const btn = await this.driver.findElement(By.css(pagination.load_more || pagination.more_button));
        if (await btn.isDisplayed()) { await btn.click(); await new Promise((r) => setTimeout(r, 1500)); return true; }
      } catch (_) {}
    }
    return false;
  }

  async _scrollCollect(tableCfg, pagination) {
    const records = [];
    const targetSel = this.config.scroll_target || 'body';
    const pause = pagination.scroll_pause_ms || 1200;
    const maxScrolls = Math.floor((this.config.collection_depth || 50) / 5);
    let lastCount = 0;
    for (let i = 0; i < maxScrolls; i++) {
      if (this.stopRequested) break;
      try {
        await this.driver.executeScript(`
          const t = document.querySelector('${targetSel}');
          if (t) t.scrollTop = t.scrollHeight;
          else window.scrollTo(0, document.body.scrollHeight);
        `);
        await new Promise((r) => setTimeout(r, pause));
        const pageRecords = await this._parseCurrentPage(tableCfg);
        if (pageRecords.length > lastCount) {
          records.push(...pageRecords.slice(lastCount));
          lastCount = pageRecords.length;
        } else {
          break;
        }
      } catch (_) { break; }
    }
    return records;
  }

  async _waitForEl(selector, timeoutMs = 10000) {
    return this.driver.wait(until.elementLocated(By.css(selector)), timeoutMs);
  }

  async _waitAndClick(selector, timeoutMs = 10000) {
    const el = await this._waitForEl(selector, timeoutMs);
    await this.driver.wait(until.elementIsVisible(el), timeoutMs);
    await el.click();
  }

  async _typeHumanized(element, text) {
    for (const ch of text) {
      await element.sendKeys(ch);
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
    }
  }

  async waitForNavigation() {
    await this.driver.wait(until.stalenessOf(await this.driver.findElement(By.css('body'))), 15000).catch(() => {});
    await this.driver.wait(until.elementLocated(By.css('body')), 15000);
  }

  async destroy() {
    this.stopRequested = true;
    this._stopSessionKeepalive();
    try { await this.driver?.quit(); } catch (_) {}
    this.driver = null;
  }
}

module.exports = BasePlatformCollector;
