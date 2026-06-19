const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { SYSTEM_CONFIG } = require('../../config/hospitals');

const logger = createLogger('CrawlerBase');

class CrawlerBase {
  constructor(options = {}) {
    this.options = {
      headless: options.headless ?? SYSTEM_CONFIG.headless,
      pageTimeout: options.pageTimeout ?? SYSTEM_CONFIG.pageTimeout,
      scriptTimeout: options.scriptTimeout ?? SYSTEM_CONFIG.scriptTimeout,
      implicitWait: options.implicitWait ?? SYSTEM_CONFIG.implicitWait,
      ...options
    };

    this.browser = null;
    this.isLoggedIn = false;
    this.hospitalConfig = null;
  }

  async launch() {
    logger.info('启动浏览器实例...');

    const chromeArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      `--window-size=1920,1080`
    ];

    if (this.options.headless) {
      chromeArgs.push('--headless');
    }

    const capabilities = {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: chromeArgs,
        prefs: {
          'profile.default_content_setting_values': {
            images: 1,
            javascript: 1,
            cookies: 1,
            plugins: 2,
            popups: 2,
            geolocation: 2,
            notifications: 2,
            auto_select_certificate: 0
          },
          'credentials_enable_service': false,
          'profile.password_manager_enabled': false
        }
      }
    };

    try {
      this.browser = await remote({
        logLevel: 'warn',
        capabilities,
        waitforTimeout: this.options.implicitWait,
        connectionRetryTimeout: 30000,
        connectionRetryCount: 2
      });

      await this.browser.setTimeout({
        pageLoad: this.options.pageTimeout,
        script: this.options.scriptTimeout,
        implicit: this.options.implicitWait
      });

      await this.browser.setWindowSize(1920, 1080);

      logger.info('浏览器实例启动成功');
      return true;
    } catch (err) {
      logger.error(`浏览器启动失败: ${err.message}`);
      throw err;
    }
  }

  async navigateTo(url) {
    logger.debug(`导航到: ${url}`);
    try {
      await this.browser.url(url);
      return true;
    } catch (err) {
      logger.error(`页面导航失败 ${url}: ${err.message}`);
      throw err;
    }
  }

  async waitForElement(selector, timeout = 10000, reverse = false) {
    try {
      const element = await this.browser.$(selector);
      await element.waitForExist({ timeout, reverse });
      return element;
    } catch (err) {
      if (!reverse) {
        logger.debug(`等待元素超时: ${selector}`);
      }
      return null;
    }
  }

  async waitForClickable(selector, timeout = 10000) {
    try {
      const element = await this.browser.$(selector);
      await element.waitForClickable({ timeout });
      return element;
    } catch (err) {
      logger.debug(`等待元素可点击超时: ${selector}`);
      return null;
    }
  }

  async waitForVisible(selector, timeout = 10000) {
    try {
      const element = await this.browser.$(selector);
      await element.waitForDisplayed({ timeout });
      return element;
    } catch (err) {
      logger.debug(`等待元素可见超时: ${selector}`);
      return null;
    }
  }

  async waitForPageLoad(timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const state = await this.browser.execute(() => document.readyState);
      if (state === 'complete') return true;
      await this.sleep(500);
    }
    throw new Error('页面加载超时');
  }

  async click(selector) {
    try {
      const element = await this.waitForClickable(selector);
      if (element) {
        await element.click();
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`点击元素失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async type(selector, text, delay = 50) {
    try {
      const element = await this.waitForVisible(selector);
      if (element) {
        await element.clearValue();
        for (const char of text) {
          await element.addValue(char);
          await this.sleep(delay);
        }
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`输入文本失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async getText(selector) {
    try {
      const element = await this.browser.$(selector);
      if (await element.isExisting()) {
        return await element.getText();
      }
      return null;
    } catch (err) {
      logger.debug(`获取文本失败 ${selector}: ${err.message}`);
      return null;
    }
  }

  async getAttribute(selector, attr) {
    try {
      const element = await this.browser.$(selector);
      if (await element.isExisting()) {
        return await element.getAttribute(attr);
      }
      return null;
    } catch (err) {
      logger.debug(`获取属性失败 ${selector}[${attr}]: ${err.message}`);
      return null;
    }
  }

  async getInnerHTML(selector) {
    try {
      return await this.browser.execute((sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerHTML : null;
      }, selector);
    } catch (err) {
      return null;
    }
  }

  async $$(selector) {
    try {
      return await this.browser.$$(selector);
    } catch (err) {
      logger.debug(`查找元素列表失败 ${selector}: ${err.message}`);
      return [];
    }
  }

  async takeScreenshot(filename = null) {
    try {
      const screenshotDir = SYSTEM_CONFIG.screenshotDir;
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fname = filename || `screenshot-${ts}.png`;
      const filePath = path.join(screenshotDir, fname);

      await this.browser.saveScreenshot(filePath);
      logger.debug(`截图已保存: ${filePath}`);
      return filePath;
    } catch (err) {
      logger.error(`截图失败: ${err.message}`);
      return null;
    }
  }

  async executeScript(script, ...args) {
    try {
      return await this.browser.execute(script, ...args);
    } catch (err) {
      logger.error(`执行脚本失败: ${err.message}`);
      throw err;
    }
  }

  async scrollToElement(selector) {
    try {
      await this.browser.execute((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, selector);
      return true;
    } catch (err) {
      return false;
    }
  }

  async scrollToBottom() {
    try {
      await this.browser.execute(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.sleep(500);
      return true;
    } catch (err) {
      return false;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getCurrentUrl() {
    try {
      return await this.browser.getUrl();
    } catch (err) {
      return null;
    }
  }

  async getTitle() {
    try {
      return await this.browser.getTitle();
    } catch (err) {
      return null;
    }
  }

  async back() {
    try {
      await this.browser.back();
      return true;
    } catch (err) {
      return false;
    }
  }

  async forward() {
    try {
      await this.browser.forward();
      return true;
    } catch (err) {
      return false;
    }
  }

  async refresh() {
    try {
      await this.browser.refresh();
      return true;
    } catch (err) {
      return false;
    }
  }

  async getCookies() {
    try {
      return await this.browser.getCookies();
    } catch (err) {
      return [];
    }
  }

  async setCookies(cookies) {
    try {
      await this.browser.setCookies(cookies);
      return true;
    } catch (err) {
      logger.error(`设置Cookies失败: ${err.message}`);
      return false;
    }
  }

  async clearCookies() {
    try {
      await this.browser.deleteCookies();
      this.isLoggedIn = false;
      return true;
    } catch (err) {
      return false;
    }
  }

  async switchToFrame(selector) {
    try {
      const frame = await this.browser.$(selector);
      await this.browser.switchToFrame(frame);
      return true;
    } catch (err) {
      return false;
    }
  }

  async switchToParentFrame() {
    try {
      await this.browser.switchToParentFrame();
      return true;
    } catch (err) {
      return false;
    }
  }

  async hasElement(selector) {
    try {
      const element = await this.browser.$(selector);
      return await element.isExisting();
    } catch (err) {
      return false;
    }
  }

  async isElementVisible(selector) {
    try {
      const element = await this.browser.$(selector);
      return await element.isDisplayed();
    } catch (err) {
      return false;
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.deleteSession();
        logger.info('浏览器实例已关闭');
      } catch (err) {
        logger.error(`关闭浏览器失败: ${err.message}`);
      }
      this.browser = null;
      this.isLoggedIn = false;
    }
  }
}

module.exports = CrawlerBase;
