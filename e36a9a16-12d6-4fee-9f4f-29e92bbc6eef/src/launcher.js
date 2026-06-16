import puppeteer from 'puppeteer';
import logger from './logger.js';

class BrowserPool {
  constructor(options = {}) {
    this.maxInstances = options.maxInstances || 3;
    this.pagesPerBrowser = options.pagesPerBrowser || 5;
    this.headless = options.headless !== undefined ? options.headless : 'new';
    
    this.browsers = [];
    this.waitingQueue = [];
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    logger.info(`初始化浏览器池, 最大实例数: ${this.maxInstances}, 单实例页面数: ${this.pagesPerBrowser}`);
    this.isInitialized = true;
  }

  async launchBrowser() {
    if (this.browsers.length >= this.maxInstances) {
      throw new Error('已达到最大浏览器实例数');
    }

    logger.info('启动新的浏览器实例');
    
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const browserInfo = {
      browser,
      pages: [],
      pageCount: 0,
      createdAt: Date.now()
    };

    this.browsers.push(browserInfo);
    return browserInfo;
  }

  async getAvailableBrowser() {
    for (const browserInfo of this.browsers) {
      if (browserInfo.pageCount < this.pagesPerBrowser) {
        return browserInfo;
      }
    }

    if (this.browsers.length < this.maxInstances) {
      return await this.launchBrowser();
    }

    return null;
  }

  async acquirePage(siteId = 'default') {
    const browserInfo = await this.getAvailableBrowser();
    
    if (!browserInfo) {
      logger.debug('没有可用浏览器实例，加入等待队列');
      return new Promise((resolve, reject) => {
        this.waitingQueue.push({ resolve, reject, siteId });
      });
    }

    const page = await browserInfo.browser.newPage();
    browserInfo.pageCount++;
    
    const pageInfo = {
      page,
      siteId,
      index: browserInfo.pageCount,
      browserInfo
    };

    logger.debug(`获取页面实例, 站点: ${siteId}, 浏览器页面数: ${browserInfo.pageCount}/${this.pagesPerBrowser}`);
    
    return pageInfo;
  }

  async releasePage(pageInfo) {
    const { page, browserInfo } = pageInfo;
    
    try {
      await page.close();
    } catch (error) {
      logger.warn(`关闭页面失败: ${error.message}`);
    }
    
    browserInfo.pageCount--;
    
    logger.debug(`释放页面实例, 浏览器页面数: ${browserInfo.pageCount}/${this.pagesPerBrowser}`);

    if (browserInfo.pageCount <= 0 && this.browsers.length > 1) {
      await this.refreshBrowser(browserInfo);
    }

    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      try {
        const pageInfo = await this.acquirePage(waiting.siteId);
        waiting.resolve(pageInfo);
      } catch (error) {
        waiting.reject(error);
      }
    }
  }

  async refreshBrowser(browserInfo) {
    const index = this.browsers.indexOf(browserInfo);
    if (index === -1) return;

    logger.info('刷新浏览器实例以防止内存泄漏');
    
    try {
      await browserInfo.browser.close();
    } catch (error) {
      logger.warn(`关闭旧浏览器实例失败: ${error.message}`);
    }
    
    this.browsers.splice(index, 1);
    
    const newBrowser = await this.launchBrowser();
    logger.info('浏览器实例刷新完成');
  }

  async closeAll() {
    logger.info('关闭所有浏览器实例');
    
    for (const browserInfo of this.browsers) {
      try {
        await browserInfo.browser.close();
      } catch (error) {
        logger.warn(`关闭浏览器实例失败: ${error.message}`);
      }
    }
    
    this.browsers = [];
    this.isInitialized = false;
    
    logger.info('所有浏览器实例已关闭');
  }

  getStats() {
    return {
      browserCount: this.browsers.length,
      maxInstances: this.maxInstances,
      totalPages: this.browsers.reduce((sum, b) => sum + b.pageCount, 0),
      waitingQueue: this.waitingQueue.length
    };
  }
}

const browserPool = new BrowserPool();

export default browserPool;
export { BrowserPool };
