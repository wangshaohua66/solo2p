const puppeteer = require('puppeteer');
const { sessions } = require('../../store/db');
const logger = require('../../utils/logger');
const { createParser } = require('../parser');

class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.parser = createParser(config.selectors);
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async initBrowser(headless = true) {
    logger.debug(`[${this.config.name}] 启动浏览器`);
    this.browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800'
      ],
      timeout: 30000
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.setDefaultTimeout(this.config.timeout || 30000);
    
    await this._restoreSession();
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this._saveSession();
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      logger.debug(`[${this.config.name}] 浏览器已关闭`);
    }
  }

  async _restoreSession() {
    const session = sessions.get(this.config.id);
    if (session && session.cookies && session.cookies.length > 0) {
      try {
        await this.page.setCookie(...session.cookies);
        logger.debug(`[${this.config.name}] 已恢复会话`);
        this.isLoggedIn = true;
      } catch (e) {
        logger.warn(`[${this.config.name}] 会话恢复失败: ${e.message}`);
      }
    }
  }

  async _saveSession() {
    try {
      if (this.page) {
        const cookies = await this.page.cookies();
        sessions.save(this.config.id, cookies, {});
        sessions.updateLastUsed(this.config.id);
        logger.debug(`[${this.config.name}] 会话已保存`);
      }
    } catch (e) {
      logger.warn(`[${this.config.name}] 会话保存失败: ${e.message}`);
    }
  }

  async login() {
    if (!this.config.credentials.username) {
      logger.warn(`[${this.config.name}] 未配置登录凭据，跳过登录`);
      return false;
    }

    logger.info(`[${this.config.name}] 开始登录`);
    
    try {
      await this.page.goto(this.config.loginUrl, {
        waitUntil: this.config.waitStrategy.login || 'networkidle2',
        timeout: this.config.timeout
      });

      const { usernameInput, passwordInput, submitButton } = this.config.selectors;

      await this.page.waitForSelector(usernameInput, { timeout: 10000 });
      await this.page.type(usernameInput, this.config.credentials.username, { delay: 50 });
      await this.page.type(passwordInput, this.config.credentials.password, { delay: 50 });
      
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
          .catch(() => {}),
        this.page.click(submitButton)
      ]);

      const loggedIn = await this._verifyLogin();
      if (loggedIn) {
        this.isLoggedIn = true;
        await this._saveSession();
        logger.info(`[${this.config.name}] 登录成功`);
      } else {
        logger.warn(`[${this.config.name}] 登录验证失败`);
      }
      
      return loggedIn;
    } catch (error) {
      logger.error(`[${this.config.name}] 登录失败: ${error.message}`);
      sessions.invalidate(this.config.id);
      return false;
    }
  }

  async _verifyLogin() {
    const { loginForm } = this.config.selectors;
    try {
      const formExists = await this.page.$(loginForm);
      return !formExists;
    } catch (e) {
      return true;
    }
  }

  async ensureLoggedIn() {
    if (!this.isLoggedIn) {
      return await this.login();
    }
    return true;
  }

  async fetchRates(route) {
    if (!this.config.rateUrl) return [];

    const url = this._buildUrl(this.config.rateUrl, route);
    logger.debug(`[${this.config.name}] 采集运价: ${route.from} -> ${route.to} (${route.type})`);

    try {
      await this.ensureLoggedIn();
      
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      if (this.config.waitStrategy.rates === 'waitForSelector' && this.config.selectors.rateTable) {
        await this.page.waitForSelector(this.config.selectors.rateTable, { timeout: 15000 });
      }

      await this.page.waitForTimeout(2000);

      const html = await this.page.content();
      const rates = this.parser.parseRates(html, this.config.id, this.config.name);
      
      rates.forEach(r => {
        r.port_from = r.port_from || route.from;
        r.port_to = r.port_to || route.to;
        r.container_type = r.container_type || route.type;
        r.source_url = url;
      });

      return rates;
    } catch (error) {
      logger.error(`[${this.config.name}] 运价采集失败: ${error.message}`);
      throw error;
    }
  }

  async fetchSpaceAvailability(route) {
    if (!this.config.spaceUrl) return [];

    const url = this._buildUrl(this.config.spaceUrl, route);
    logger.debug(`[${this.config.name}] 采集舱位: ${route.from} -> ${route.to}`);

    try {
      await this.ensureLoggedIn();
      
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      if (this.config.waitStrategy.space === 'waitForSelector' && this.config.selectors.spaceStatus) {
        await this.page.waitForSelector(this.config.selectors.spaceStatus, { timeout: 15000 });
      }

      await this.page.waitForTimeout(1500);

      const html = await this.page.content();
      const spaces = this.parser.parseSpaceAvailability(html, this.config.id, this.config.name);
      
      spaces.forEach(s => {
        s.port_from = s.port_from || route.from;
        s.port_to = s.port_to || route.to;
        s.container_type = s.container_type || route.type;
      });

      return spaces;
    } catch (error) {
      logger.error(`[${this.config.name}] 舱位采集失败: ${error.message}`);
      throw error;
    }
  }

  async fetchSchedules(route) {
    if (!this.config.scheduleUrl) return [];

    const url = this._buildUrl(this.config.scheduleUrl, route);
    logger.debug(`[${this.config.name}] 采集船期: ${route.from} -> ${route.to}`);

    try {
      await this.ensureLoggedIn();
      
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      if (this.config.waitStrategy.schedules === 'waitForSelector' && this.config.selectors.scheduleRow) {
        await this.page.waitForSelector(this.config.selectors.scheduleRow, { timeout: 15000 });
      }

      await this.page.waitForTimeout(1500);

      const html = await this.page.content();
      const schedules = this.parser.parseSchedules(html, this.config.id, this.config.name);
      
      schedules.forEach(s => {
        s.port_from = s.port_from || route.from;
        s.port_to = s.port_to || route.to;
      });

      return schedules;
    } catch (error) {
      logger.error(`[${this.config.name}] 船期采集失败: ${error.message}`);
      throw error;
    }
  }

  async fetchSurcharges() {
    if (!this.config.surchargeUrl) return [];

    logger.debug(`[${this.config.name}] 采集附加费`);

    try {
      await this.ensureLoggedIn();
      
      await this.page.goto(this.config.surchargeUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      if (this.config.selectors.surchargeItem) {
        await this.page.waitForSelector(this.config.selectors.surchargeItem, { timeout: 15000 }).catch(() => {});
      }

      await this.page.waitForTimeout(1500);

      const html = await this.page.content();
      const surcharges = this.parser.parseSurcharges(html, this.config.id, this.config.name);
      
      surcharges.forEach(s => {
        s.source_url = this.config.surchargeUrl;
      });

      return surcharges;
    } catch (error) {
      logger.error(`[${this.config.name}] 附加费采集失败: ${error.message}`);
      throw error;
    }
  }

  _buildUrl(baseUrl, route) {
    if (!route) return baseUrl;
    const url = new URL(baseUrl);
    if (route.from) url.searchParams.set('from', route.from);
    if (route.to) url.searchParams.set('to', route.to);
    if (route.type) url.searchParams.set('container', route.type);
    return url.toString();
  }

  async takeScreenshot(path) {
    if (this.page) {
      await this.page.screenshot({ path, fullPage: true });
    }
  }

  getCarrierInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      fullName: this.config.fullName,
      baseUrl: this.config.baseUrl,
      priority: this.config.priority,
      frequency: this.config.frequency,
      routes: this.config.routes
    };
  }
}

module.exports = BaseAdapter;
