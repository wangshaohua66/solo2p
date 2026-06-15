const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { retry } = require('../utils/retry');
const CaptchaSolver = require('../utils/captcha');
const config = require('../../config/config');

class BasePlatform {
  constructor(name, platformConfig, browserPool) {
    this.name = name;
    this.config = platformConfig;
    this.browserPool = browserPool;
    this.captchaSolver = new CaptchaSolver();
    this.isLoggedIn = false;
    this.loginExpiry = 0;
    this.sessionDuration = 2 * 60 * 60 * 1000;
    this.sessionRefreshInterval = null;
    this.sessionRefreshRatio = 0.7;
    this.currentContext = null;
    this.lastRefreshTime = 0;
    this.refreshAttempts = 0;
    this.maxRefreshAttempts = 3;
  }

  async login(username, password) {
    throw new Error('子类必须实现 login 方法');
  }

  async fetchList(page = 1, context) {
    throw new Error('子类必须实现 fetchList 方法');
  }

  async fetchDetail(url, context) {
    throw new Error('子类必须实现 fetchDetail 方法');
  }

  async ensureLogin(contextWrapper) {
    const now = Date.now();
    if (this.isLoggedIn && now < this.loginExpiry) {
      return true;
    }

    try {
      const page = await this.browserPool.newPage(contextWrapper);
      const success = await this._doLogin(page);

      if (success) {
        this.isLoggedIn = true;
        this.loginExpiry = now + this.sessionDuration;
        this.lastRefreshTime = now;
        this.currentContext = contextWrapper;
        logger.info(`${this.name} 登录成功，Session 有效期 ${(this.sessionDuration / 1000 / 60).toFixed(0)} 分钟`, this.name);
        this._startSessionRenewer(contextWrapper);
      }

      await page.close();
      return success;
    } catch (error) {
      logger.error(`${this.name} 登录失败: ${error.message}`, this.name);
      return false;
    }
  }

  _startSessionRenewer(contextWrapper) {
    this._stopSessionRenewer();

    const refreshDelay = this.sessionDuration * this.sessionRefreshRatio;
    logger.debug(`Session 续期定时器已启动，将在 ${(refreshDelay / 1000 / 60).toFixed(0)} 分钟后续期`, this.name);

    this.sessionRefreshInterval = setTimeout(async () => {
      await this._refreshSession(contextWrapper);
    }, refreshDelay);
  }

  _stopSessionRenewer() {
    if (this.sessionRefreshInterval) {
      clearTimeout(this.sessionRefreshInterval);
      this.sessionRefreshInterval = null;
    }
  }

  async _refreshSession(contextWrapper) {
    if (!this.isLoggedIn) {
      logger.debug('未登录，跳过 Session 续期', this.name);
      return;
    }

    const now = Date.now();
    logger.info(`正在主动续期 Session... (距上次刷新 ${((now - this.lastRefreshTime) / 1000 / 60).toFixed(1)} 分钟)`, this.name);

    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt < this.maxRefreshAttempts; attempt++) {
      try {
        const page = await this.browserPool.newPage(contextWrapper);

        try {
          success = await this._doRefreshSession(page);

          if (success) {
            this.loginExpiry = Date.now() + this.sessionDuration;
            this.lastRefreshTime = Date.now();
            this.refreshAttempts = 0;
            logger.success(`Session 续期成功，新有效期 ${(this.sessionDuration / 1000 / 60).toFixed(0)} 分钟`, this.name);
            break;
          }
        } finally {
          await page.close();
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Session 续期第 ${attempt + 1} 次失败: ${error.message}`, this.name);

        if (this.browserPool && this.browserPool.proxyList?.length > 0) {
          logger.info('续期失败，尝试切换代理...', this.name);
          await this.browserPool.rotateProxyForContext(contextWrapper);
        }

        await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
      }
    }

    if (!success) {
      this.refreshAttempts++;
      logger.warn(`Session 续期失败 ${this.refreshAttempts} 次，将重新登录`, this.name);

      if (this.refreshAttempts >= 2) {
        this.isLoggedIn = false;
        logger.error('Session 续期多次失败，登录态已失效', this.name);
      }
    }

    this._startSessionRenewer(contextWrapper);
  }

  async _doRefreshSession(page) {
    try {
      const refreshUrl = this.config.refreshUrl || this.config.baseUrl + '/user/center';

      const response = await page.goto(refreshUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      if (!response || !response.ok()) {
        return false;
      }

      const isStillLoggedIn = await page.evaluate(() => {
        return !!(
          document.querySelector('.user-info') ||
          document.querySelector('.username') ||
          document.querySelector('.avatar') ||
          document.querySelector('.logout') ||
          document.cookie.includes('session') ||
          document.cookie.includes('token')
        );
      });

      if (isStillLoggedIn) {
        const cookies = await page.context().cookies();
        logger.debug(`续期后 Cookie 数量: ${cookies.length}`, this.name);
        return true;
      }

      return false;
    } catch (error) {
      logger.debug(`Session 续期异常: ${error.message}`, this.name);
      return false;
    }
  }

  async forceRefreshSession(contextWrapper) {
    logger.info('强制执行 Session 续期', this.name);
    await this._refreshSession(contextWrapper);
    return this.isLoggedIn;
  }

  getSessionStatus() {
    const now = Date.now();
    const remaining = this.loginExpiry - now;

    return {
      isLoggedIn: this.isLoggedIn,
      loginExpiry: this.loginExpiry,
      remainingSeconds: Math.max(0, Math.floor(remaining / 1000)),
      remainingMinutes: Math.max(0, Math.floor(remaining / 1000 / 60)),
      lastRefreshTime: this.lastRefreshTime,
      refreshAttempts: this.refreshAttempts,
    };
  }

  async _doLogin(page) {
    return true;
  }

  async safeNavigate(page, url, contextWrapper, options = {}) {
    let lastStatusCode = null;

    return await retry(
      async (attempt) => {
        if (attempt > 0) {
          logger.info(`重试导航到 ${url} (第 ${attempt + 1} 次)`, this.name);

          if (contextWrapper && this.browserPool) {
            const switched = await this.browserPool.handleRequestFailure(
              contextWrapper,
              lastStatusCode,
              new Error(lastStatusCode ? `HTTP ${lastStatusCode}` : 'unknown error')
            );
            if (switched) {
              const newPage = await this.browserPool.newPage(contextWrapper);
              try {
                await page.close();
              } catch (e) { /* ignore */ }
              page = newPage;
              logger.info('已切换代理，使用新页面重试', this.name);
            }
          }
        }

        let response;
        try {
          response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: options.timeout || config.browser.timeout,
          });
        } catch (navError) {
          lastStatusCode = null;
          throw navError;
        }

        const statusCode = response?.status();
        lastStatusCode = statusCode;

        if (!response || !response.ok()) {
          if (statusCode && this.browserPool?.isBannedStatusCode(statusCode)) {
            logger.warn(`检测到封禁状态码 ${statusCode}，将切换代理重试`, this.name);
          }
          throw new Error(`页面加载失败: ${statusCode || 'no response'}`);
        }

        const hasCaptcha = await this._checkCaptcha(page);
        if (hasCaptcha) {
          logger.info('检测到验证码，正在处理...', this.name);
          const solved = await this._handleCaptcha(page);
          if (!solved) {
            throw new Error('验证码处理失败');
          }
        }

        return { response, page };
      },
      {
        maxRetries: config.retry.maxRetries,
        baseDelay: config.retry.baseDelay,
        onRetry: (attempt, error, delay) => {
          logger.warn(`导航重试 ${attempt}/${config.retry.maxRetries}: ${error.message}，等待 ${delay}ms`, this.name);
        },
      }
    );
  }

  async _checkCaptcha(page) {
    const captchaSelectors = [
      'img.captcha',
      '#captcha',
      '.verify-code',
      'img[src*="captcha"]',
      'img[src*="verify"]',
    ];

    for (const selector of captchaSelectors) {
      if (await page.$(selector)) {
        return true;
      }
    }
    return false;
  }

  async _handleCaptcha(page) {
    const captchaImg = await page.$('img[src*="captcha"], img.captcha, #captchaImg');
    if (!captchaImg) return false;

    const screenshot = await captchaImg.screenshot();
    const result = await this.captchaSolver.solveTextCaptcha(screenshot);

    if (result) {
      const input = await page.$('input[name*="captcha"], input#captcha, .captcha-input');
      if (input) {
        await input.fill(result);
        return true;
      }
    }

    return false;
  }

  parseHTML(html) {
    return cheerio.load(html, {
      decodeEntities: false,
      xmlMode: false,
    });
  }

  extractText($, selector) {
    return $(selector).text().trim();
  }

  extractTable($, tableSelector) {
    const rows = [];
    $(tableSelector).find('tr').each((i, row) => {
      const cells = [];
      $(row).find('th, td').each((j, cell) => {
        cells.push($(cell).text().trim());
      });
      if (cells.length > 0) {
        rows.push(cells);
      }
    });
    return rows;
  }

  async scrollToBottom(page, scrollDelay = 800) {
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrolls = 0;
    const maxScrolls = 20;

    while (previousHeight !== currentHeight && scrolls < maxScrolls) {
      previousHeight = currentHeight;
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(scrollDelay);
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      scrolls++;
    }
  }

  async waitForPageStable(page, checkInterval = 500, maxWait = 5000) {
    let lastDOMContent = '';
    let stableCount = 0;
    const requiredStable = 3;
    let waited = 0;

    while (waited < maxWait && stableCount < requiredStable) {
      const currentDOM = await page.evaluate(() => document.body.innerHTML.length.toString());
      if (currentDOM === lastDOMContent) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      lastDOMContent = currentDOM;
      await page.waitForTimeout(checkInterval);
      waited += checkInterval;
    }
  }
}

module.exports = BasePlatform;
