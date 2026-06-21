const { logger } = require('../logger');
const config = require('../config');

class By {
  constructor(using, value) {
    this.using = using;
    this.value = value;
  }

  static css(selector) {
    return new By('css', selector);
  }

  static id(id) {
    return new By('css', `#${id}`);
  }

  static name(name) {
    return new By('css', `[name="${name}"]`);
  }

  static className(className) {
    return new By('css', `.${className}`);
  }

  static xpath(xpath) {
    return new By('xpath', xpath);
  }

  static linkText(text) {
    return new By('linkText', text);
  }

  static partialLinkText(text) {
    return new By('partialLinkText', text);
  }

  static tagName(tagName) {
    return new By('css', tagName);
  }

  toSelector() {
    if (this.using === 'css') return this.value;
    if (this.using === 'xpath') return this.value;
    if (this.using === 'linkText') return `=${this.value}`;
    if (this.using === 'partialLinkText') return `*=${this.value}`;
    return this.value;
  }

  toString() {
    return `By.${this.using}("${this.value}")`;
  }
}

class UntilCondition {
  constructor(type, selector, options = {}) {
    this.type = type;
    this.selector = selector;
    this.options = options;
  }
}

const until = {
  elementLocated: (by) => new UntilCondition('elementLocated', by),
  elementIsVisible: (by) => new UntilCondition('elementVisible', by),
  elementIsEnabled: (by) => new UntilCondition('elementEnabled', by),
  elementIsClickable: (by) => new UntilCondition('elementClickable', by),
  urlContains: (text) => new UntilCondition('urlContains', text),
  titleContains: (text) => new UntilCondition('titleContains', text),
  titleIs: (title) => new UntilCondition('titleIs', title),
  alertIsPresent: () => new UntilCondition('alertPresent', null)
};

const Key = {
  ENTER: 'Enter',
  RETURN: 'Enter',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  SPACE: ' ',
  BACK_SPACE: 'Backspace',
  DELETE: 'Delete',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  SHIFT: 'Shift',
  CONTROL: 'Control',
  ALT: 'Alt',
  META: 'Meta'
};

class WebElement {
  constructor(element, adapter) {
    this.element = element;
    this.adapter = adapter;
  }

  async click() {
    await this.element.click();
  }

  async sendKeys(text) {
    if (Array.isArray(text)) {
      text = text.join('');
    }
    await this.element.setValue(text);
  }

  async clear() {
    await this.element.clearValue();
  }

  async getText() {
    return await this.element.getText();
  }

  async getAttribute(name) {
    return await this.element.getAttribute(name);
  }

  async getCssValue(name) {
    return await this.element.getCSSProperty(name);
  }

  async getTagName() {
    return await this.element.getTagName();
  }

  async isDisplayed() {
    return await this.element.isDisplayed();
  }

  async isEnabled() {
    return await this.element.isEnabled();
  }

  async isSelected() {
    return await this.element.isSelected();
  }

  async takeScreenshot() {
    return await this.element.takeScreenshot();
  }

  async submit() {
    await this.element.submitForm();
  }

  async findElement(by) {
    const selector = by instanceof By ? by.toSelector() : by;
    const el = await this.element.$(selector);
    return new WebElement(el, this.adapter);
  }

  async findElements(by) {
    const selector = by instanceof By ? by.toSelector() : by;
    const elements = await this.element.$$(selector);
    return elements.map(el => new WebElement(el, this.adapter));
  }

  getWebdriverIOElement() {
    return this.element;
  }
}

class WebDriverAdapter {
  constructor(options = {}) {
    this.browser = null;
    this.options = options;
    this.isConnected = false;
    this.driverType = 'webdriverio';
  }

  async init() {
    try {
      const { remote } = require('webdriverio');
      const platformConfig = config.getPlatformConfig(options.platform || 'environmental');
      
      const headless = process.env.HEADLESS !== 'false' && 
                       process.env.NODE_ENV === 'production';
      
      const capabilities = {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-popup-blocking',
            '--disable-notifications'
          ]
        }
      };

      if (headless) {
        capabilities['goog:chromeOptions'].args.push('--headless=new');
      }

      if (process.env.CHROME_BINARY) {
        capabilities['goog:chromeOptions'].binary = process.env.CHROME_BINARY;
      }

      logger.info('初始化 WebDriverIO Chrome 浏览器');
      
      this.browser = await remote({
        capabilities,
        logLevel: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'warn',
        waitforTimeout: platformConfig.pageTimeout || 15000,
        waitforInterval: 500
      });

      if (platformConfig.pageTimeout) {
        await this.browser.setTimeout({
          pageLoad: platformConfig.pageTimeout,
          script: platformConfig.pageTimeout,
          implicit: 5000
        });
      }

      this.isConnected = true;
      logger.info('WebDriverIO 浏览器初始化完成');
      return true;
    } catch (error) {
      logger.error('WebDriverIO 初始化失败', error.message);
      throw error;
    }
  }

  async get(url) {
    logger.debug(`导航到: ${url}`);
    await this.browser.url(url);
  }

  async getCurrentUrl() {
    return await this.browser.getUrl();
  }

  async getTitle() {
    return await this.browser.getTitle();
  }

  async getPageSource() {
    return await this.browser.getPageSource();
  }

  $(selector) {
    const sel = selector instanceof By ? selector.toSelector() : selector;
    const element = this.browser.$(sel);
    return new WebElement(element, this);
  }

  async findElement(by) {
    return this.$(by);
  }

  async findElements(by) {
    const selector = by instanceof By ? by.toSelector() : by;
    const elements = await this.browser.$$(selector);
    return elements.map(el => new WebElement(el, this));
  }

  async wait(condition, timeout = 10000) {
    if (typeof condition === 'function') {
      const result = await this.browser.waitUntil(async () => {
        return await condition(this.browser);
      }, {
        timeout,
        timeoutMsg: '等待超时'
      });
      return result;
    }
    
    if (condition instanceof UntilCondition) {
      switch (condition.type) {
        case 'elementLocated': {
          const selector = condition.selector instanceof By 
            ? condition.selector.toSelector() 
            : condition.selector;
          const element = this.browser.$(selector);
          await element.waitForExist({ timeout });
          return new WebElement(element, this);
        }
        case 'elementVisible':
        case 'elementClickable':
        case 'elementEnabled': {
          const selector = condition.selector instanceof By 
            ? condition.selector.toSelector() 
            : condition.selector;
          const element = this.browser.$(selector);
          if (condition.type === 'elementClickable') {
            await element.waitForClickable({ timeout });
          } else {
            await element.waitForDisplayed({ timeout });
          }
          return new WebElement(element, this);
        }
        case 'urlContains': {
          await this.browser.waitUntil(async () => {
            const url = await this.browser.getUrl();
            return url.includes(condition.selector);
          }, { timeout, timeoutMsg: 'URL不包含预期文本' });
          return true;
        }
        case 'titleContains': {
          await this.browser.waitUntil(async () => {
            const title = await this.browser.getTitle();
            return title.includes(condition.selector);
          }, { timeout, timeoutMsg: '标题不包含预期文本' });
          return true;
        }
        case 'alertPresent': {
          try {
            await this.browser.waitUntil(async () => {
              try {
                await this.browser.getAlertText();
                return true;
              } catch (e) {
                return false;
              }
            }, { timeout });
            return true;
          } catch (e) {
            return false;
          }
        }
        default:
          return null;
      }
    }
    
    return null;
  }

  async sleep(ms) {
    await this.browser.pause(ms);
  }

  static By = By;
  static until = until;
  static Key = Key;

  async executeScript(script, ...args) {
    return await this.browser.execute(script, ...args);
  }

  async executeAsyncScript(script, ...args) {
    return await this.browser.executeAsync(script, ...args);
  }

  async takeScreenshot() {
    return await this.browser.takeScreenshot();
  }

  async saveScreenshot(filepath) {
    await this.browser.saveScreenshot(filepath);
  }

  manage() {
    const self = this;
    return {
      setTimeouts: async ({ pageLoad, script, implicit }) => {
        await self.browser.setTimeout({ pageLoad, script, implicit });
      },
      getCookies: async () => await self.browser.getCookies(),
      addCookie: async (cookie) => await self.browser.setCookies([cookie]),
      deleteAllCookies: async () => await self.browser.deleteAllCookies(),
      window: () => ({
        setSize: async (width, height) => {
          await self.browser.setWindowSize(width, height);
        },
        getSize: async () => await self.browser.getWindowSize()
      })
    };
  }

  navigate() {
    const self = this;
    return {
      back: async () => await self.browser.back(),
      forward: async () => await self.browser.forward(),
      refresh: async () => await self.browser.refresh()
    };
  }

  switchTo() {
    const self = this;
    return {
      frame: async (id) => await self.browser.switchToFrame(id),
      defaultContent: async () => await self.browser.switchToParentFrame(),
      alert: () => ({
        accept: async () => await self.browser.acceptAlert(),
        dismiss: async () => await self.browser.dismissAlert(),
        getText: async () => await self.browser.getAlertText(),
        sendKeys: async (text) => await self.browser.sendAlertText(text)
      }),
      window: async (handle) => await self.browser.switchToWindow(handle)
    };
  }

  async getAllWindowHandles() {
    return await this.browser.getWindowHandles();
  }

  async switchToWindow(handle) {
    await this.browser.switchToWindow(handle);
  }

  async closeWindow() {
    await this.browser.closeWindow();
  }

  async quit() {
    if (this.browser) {
      try {
        await this.browser.deleteSession();
        logger.info('WebDriverIO 会话已关闭');
      } catch (e) {
        logger.warn('关闭 WebDriverIO 会话失败', e.message);
      }
      this.browser = null;
      this.isConnected = false;
    }
  }

  getBrowser() {
    return this.browser;
  }

  isConnected_() {
    return this.isConnected;
  }
}

class SeleniumWebDriverAdapter extends WebDriverAdapter {
  constructor(options = {}) {
    super(options);
    this.driverType = 'selenium';
    this.driver = null;
  }

  async init() {
    try {
      const { Builder, By, until } = require('selenium-webdriver');
      const chrome = require('selenium-webdriver/chrome');
      const platformConfig = config.getPlatformConfig(this.options.platform || 'environmental');
      
      const headless = process.env.HEADLESS !== 'false' && 
                       process.env.NODE_ENV === 'production';
      
      const builder = new Builder().forBrowser('chrome');
      const options = new chrome.Options();
      
      if (headless) {
        options.addArguments('--headless=new');
      }
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');
      options.addArguments('--disable-gpu');
      options.addArguments('--window-size=1920,1080');
      options.addArguments('--disable-popup-blocking');
      options.addArguments('--disable-notifications');
      
      if (process.env.CHROME_BINARY) {
        options.setChromeBinaryPath(process.env.CHROME_BINARY);
      }
      
      builder.setChromeOptions(options);
      
      logger.info('初始化 Selenium Chrome 浏览器');
      this.driver = await builder.build();
      
      if (platformConfig.pageTimeout) {
        await this.driver.manage().setTimeouts({
          pageLoad: platformConfig.pageTimeout,
          script: platformConfig.pageTimeout,
          implicit: 5000
        });
      }
      
      this.isConnected = true;
      this.By = By;
      this.until = until;
      
      logger.info('Selenium 浏览器初始化完成');
      return true;
    } catch (error) {
      logger.error('Selenium 初始化失败', error.message);
      throw error;
    }
  }

  async get(url) {
    await this.driver.get(url);
  }

  async getCurrentUrl() {
    return await this.driver.getCurrentUrl();
  }

  async getTitle() {
    return await this.driver.getTitle();
  }

  async findElement(selector) {
    const { By } = require('selenium-webdriver');
    const el = await this.driver.findElement(By.css(selector));
    return {
      click: async () => await el.click(),
      sendKeys: async (text) => await el.sendKeys(text),
      clear: async () => await el.clear(),
      getText: async () => await el.getText(),
      getAttribute: async (name) => await el.getAttribute(name),
      isDisplayed: async () => await el.isDisplayed(),
      isEnabled: async () => await el.isEnabled(),
      takeScreenshot: async () => await el.takeScreenshot(),
      waitForExist: async (timeout) => {
        const { until } = require('selenium-webdriver');
        await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
      }
    };
  }

  async findElements(selector) {
    const { By } = require('selenium-webdriver');
    const elements = await this.driver.findElements(By.css(selector));
    return elements.map(el => ({
      click: async () => await el.click(),
      getText: async () => await el.getText(),
      isDisplayed: async () => await el.isDisplayed()
    }));
  }

  async wait(condition, timeout = 10000) {
    return await this.driver.wait(condition, timeout);
  }

  get until() {
    return require('selenium-webdriver').until;
  }

  get By() {
    return require('selenium-webdriver').By;
  }

  async executeScript(script, ...args) {
    return await this.driver.executeScript(script, ...args);
  }

  async takeScreenshot() {
    return await this.driver.takeScreenshot();
  }

  async manage() {
    return this.driver.manage();
  }

  async navigate() {
    return this.driver.navigate();
  }

  async switchTo() {
    return this.driver.switchTo();
  }

  async quit() {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (e) {
        logger.warn('关闭 Selenium 会话失败', e.message);
      }
      this.driver = null;
      this.isConnected = false;
    }
  }

  getDriver() {
    return this.driver;
  }
}

function createDriver(options = {}) {
  const useWebdriverIO = process.env.USE_WEBDRIVERIO !== 'false';
  
  if (useWebdriverIO) {
    logger.info('使用 WebdriverIO 驱动');
    return new WebDriverAdapter(options);
  } else {
    logger.info('使用 Selenium WebDriver 驱动');
    return new SeleniumWebDriverAdapter(options);
  }
}

module.exports = {
  WebDriverAdapter,
  SeleniumWebDriverAdapter,
  WebElement,
  createDriver,
  By,
  until,
  Key
};
