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
        logger.info(`${this.name} 登录成功`, this.name);
      }

      await page.close();
      return success;
    } catch (error) {
      logger.error(`${this.name} 登录失败: ${error.message}`, this.name);
      return false;
    }
  }

  async _doLogin(page) {
    return true;
  }

  async safeNavigate(page, url, options = {}) {
    return await retry(
      async (attempt) => {
        if (attempt > 0) {
          logger.info(`重试导航到 ${url} (第 ${attempt + 1} 次)`, this.name);
        }

        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: options.timeout || config.browser.timeout,
        });

        if (!response || !response.ok()) {
          throw new Error(`页面加载失败: ${response?.status() || 'no response'}`);
        }

        const hasCaptcha = await this._checkCaptcha(page);
        if (hasCaptcha) {
          logger.info('检测到验证码，正在处理...', this.name);
          const solved = await this._handleCaptcha(page);
          if (!solved) {
            throw new Error('验证码处理失败');
          }
        }

        return response;
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
