const { chromium } = require('playwright');
const EventEmitter = require('events');
const logger = require('./utils/logger');
const config = require('../config/config');

class BrowserPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.poolSize = options.poolSize || config.browser.poolSize;
    this.maxPoolSize = options.maxPoolSize || config.browser.maxPoolSize;
    this.headless = options.headless ?? config.browser.headless;
    this.contexts = [];
    this.browser = null;
    this.isInitialized = false;
    this.userAgentIndex = 0;
    this.proxyList = options.proxyList || [];
    this.proxyIndex = 0;
    this._healthCheckInterval = null;
  }

  async init() {
    if (this.isInitialized) return;

    logger.info('初始化浏览器池...', 'BrowserPool');

    const launchOptions = {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    this.browser = await chromium.launch(launchOptions);

    this._isClosing = false;

    this.browser.on('disconnected', () => {
      if (this._isClosing) return;
      logger.warn('浏览器意外断开，正在重启...', 'BrowserPool');
      this.isInitialized = false;
      this._recover();
    });

    for (let i = 0; i < this.poolSize; i++) {
      const context = await this._createContext(i);
      this.contexts.push(context);
    }

    this._startHealthCheck();
    this.isInitialized = true;
    logger.info(`浏览器池初始化完成，共 ${this.poolSize} 个上下文`, 'BrowserPool');
  }

  async _createContext(id) {
    const userAgent = this._getNextUserAgent();
    const proxy = this._getNextProxy();

    const contextOptions = {
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      ignoreHTTPSErrors: true,
    };

    if (proxy) {
      contextOptions.proxy = proxy;
    }

    const context = await this.browser.newContext(contextOptions);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
      window.chrome = { runtime: {} };
    });

    const contextWrapper = {
      id,
      context,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      requestCount: 0,
      errorCount: 0,
      isHealthy: true,
      cookies: {},
      userAgent,
      proxy,
      pages: new Set(),
    };

    context.on('page', (page) => {
      contextWrapper.pages.add(page);
      page.on('close', () => contextWrapper.pages.delete(page));
    });

    return contextWrapper;
  }

  _getNextUserAgent() {
    const ua = config.browser.userAgents[this.userAgentIndex % config.browser.userAgents.length];
    this.userAgentIndex++;
    return ua;
  }

  _getNextProxy() {
    if (this.proxyList.length === 0) return null;
    const proxy = this.proxyList[this.proxyIndex % this.proxyList.length];
    this.proxyIndex++;
    return proxy;
  }

  async acquire() {
    if (!this.isInitialized) {
      await this.init();
    }

    let bestContext = null;
    let minPages = Infinity;

    for (const ctx of this.contexts) {
      if (ctx.isHealthy && ctx.pages.size < minPages) {
        bestContext = ctx;
        minPages = ctx.pages.size;
      }
    }

    if (!bestContext) {
      if (this.contexts.length < this.maxPoolSize) {
        logger.info('所有上下文繁忙，扩展池大小...', 'BrowserPool');
        bestContext = await this._createContext(this.contexts.length);
        this.contexts.push(bestContext);
      } else {
        throw new Error('浏览器池已达到最大容量且所有上下文均不可用');
      }
    }

    bestContext.lastUsed = Date.now();
    bestContext.requestCount++;

    return bestContext;
  }

  async release(contextWrapper) {
    for (const page of contextWrapper.pages) {
      try {
        await page.close();
      } catch (e) {
        // ignore
      }
    }
    contextWrapper.pages.clear();
  }

  async _recoverContext(contextWrapper) {
    logger.warn(`恢复崩溃的上下文 #${contextWrapper.id}...`, 'BrowserPool');

    try {
      await contextWrapper.context.close();
    } catch (e) {
      // ignore
    }

    const newContext = await this._createContext(contextWrapper.id);
    const index = this.contexts.findIndex(c => c.id === contextWrapper.id);
    if (index !== -1) {
      this.contexts[index] = newContext;
    }

    logger.info(`上下文 #${contextWrapper.id} 已恢复`, 'BrowserPool');
    return newContext;
  }

  async markUnhealthy(contextWrapper, error) {
    contextWrapper.isHealthy = false;
    contextWrapper.errorCount++;
    logger.warn(`上下文 #${contextWrapper.id} 标记为不健康，错误: ${error.message}`, 'BrowserPool');

    if (contextWrapper.errorCount >= 3) {
      await this._recoverContext(contextWrapper);
    } else {
      setTimeout(() => {
        contextWrapper.isHealthy = true;
      }, 30000);
    }
  }

  _startHealthCheck() {
    this._healthCheckInterval = setInterval(async () => {
      for (const ctx of this.contexts) {
        if (!ctx.isHealthy) continue;

        const idleTime = Date.now() - ctx.lastUsed;
        if (idleTime > 30 * 60 * 1000 && this.contexts.length > this.poolSize) {
          logger.info(`回收闲置上下文 #${ctx.id}`, 'BrowserPool');
          try {
            await ctx.context.close();
          } catch (e) { /* ignore */ }
          this.contexts = this.contexts.filter(c => c.id !== ctx.id);
        }
      }
    }, 60 * 1000);
  }

  async saveCookies(platform, contextWrapper, cookies) {
    contextWrapper.cookies[platform] = cookies;
    if (cookies && cookies.length > 0) {
      await contextWrapper.context.addCookies(cookies);
    }
  }

  async getCookies(contextWrapper, platform) {
    if (contextWrapper.cookies[platform]) {
      return contextWrapper.cookies[platform];
    }
    const pages = [...contextWrapper.pages];
    if (pages.length > 0) {
      return await pages[0].context().cookies();
    }
    return [];
  }

  async newPage(contextWrapper) {
    const page = await contextWrapper.context.newPage();
    page.setDefaultTimeout(config.browser.timeout);

    page.on('pageerror', (error) => {
      logger.debug(`页面错误: ${error.message}`, `Context-${contextWrapper.id}`);
    });

    return page;
  }

  async close() {
    this._isClosing = true;

    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
    }

    for (const ctx of this.contexts) {
      try {
        await ctx.context.close();
      } catch (e) { /* ignore */ }
    }

    if (this.browser) {
      await this.browser.close();
    }

    this.isInitialized = false;
    this.contexts = [];
    logger.info('浏览器池已关闭', 'BrowserPool');
  }

  getStats() {
    return {
      totalContexts: this.contexts.length,
      healthyContexts: this.contexts.filter(c => c.isHealthy).length,
      totalPages: this.contexts.reduce((sum, c) => sum + c.pages.size, 0),
      totalRequests: this.contexts.reduce((sum, c) => sum + c.requestCount, 0),
    };
  }

  async _recover() {
    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      for (let i = 0; i < this.contexts.length; i++) {
        this.contexts[i] = await this._createContext(i);
      }

      this.isInitialized = true;
      this.emit('recovered');
      logger.success('浏览器池恢复完成', 'BrowserPool');
    } catch (error) {
      logger.error(`浏览器池恢复失败: ${error.message}`, 'BrowserPool');
      setTimeout(() => this._recover(), 5000);
    }
  }
}

let poolInstance = null;

async function getBrowserPool() {
  if (!poolInstance) {
    poolInstance = new BrowserPool();
    await poolInstance.init();
  }
  return poolInstance;
}

module.exports = {
  BrowserPool,
  getBrowserPool,
};
