import { Builder, WebDriver, By, until, Capabilities } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as dotenv from 'dotenv';
import { randomInt, randomFloat, sleep } from '../utils/helpers';
import logger from '../utils/logger';

dotenv.config();

export interface BrowserInstance {
  id: string;
  driver: WebDriver;
  companyId?: string;
  isBusy: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent: string;
  windowSize: { width: number; height: number };
}

export interface AntiDetectionConfig {
  userAgents: string[];
  windowSizes: { width: number; height: number }[];
  timezones: string[];
  languages: string[];
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const WINDOW_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
];

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Chongqing',
  'Asia/Hong_Kong',
  'Asia/Singapore',
];

const LANGUAGES = [
  'zh-CN,zh;q=0.9,en;q=0.8',
  'zh-CN,zh;q=0.9',
  'zh,en-US;q=0.9,en;q=0.8',
];

export class BrowserManager {
  private static instance: BrowserManager;
  private instances: Map<string, BrowserInstance> = new Map();
  private maxInstances: number;
  private headless: boolean;
  private pageLoadTimeout: number;
  private scriptTimeout: number;

  private constructor() {
    this.maxInstances = parseInt(process.env.MAX_BROWSER_INSTANCES || '4', 10);
    this.headless = process.env.HEADLESS_MODE !== 'false';
    this.pageLoadTimeout = parseInt(process.env.PAGE_LOAD_TIMEOUT || '30000', 10);
    this.scriptTimeout = parseInt(process.env.SCRIPT_TIMEOUT || '20000', 10);
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async acquireBrowser(companyId: string): Promise<BrowserInstance> {
    const availableInstance = this.findAvailableInstance();
    
    if (availableInstance) {
      availableInstance.isBusy = true;
      availableInstance.companyId = companyId;
      availableInstance.lastUsedAt = new Date();
      logger.info(`复用浏览器实例: ${availableInstance.id} for ${companyId}`);
      return availableInstance;
    }

    if (this.instances.size >= this.maxInstances) {
      logger.warn('浏览器实例池已满，等待释放...');
      return this.waitForAvailableInstance(companyId);
    }

    const instance = await this.createBrowserInstance(companyId);
    this.instances.set(instance.id, instance);
    logger.info(`创建新浏览器实例: ${instance.id}, 当前总数: ${this.instances.size}`);
    return instance;
  }

  public releaseBrowser(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.isBusy = false;
      instance.companyId = undefined;
      instance.lastUsedAt = new Date();
      logger.debug(`释放浏览器实例: ${instanceId}`);
    }
  }

  public async closeBrowser(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      try {
        await instance.driver.quit();
      } catch (error) {
        logger.error(`关闭浏览器实例失败: ${instanceId}`, { error: (error as Error).message });
      }
      this.instances.delete(instanceId);
      logger.info(`关闭浏览器实例: ${instanceId}, 剩余: ${this.instances.size}`);
    }
  }

  public async closeAllBrowsers(): Promise<void> {
    const closePromises = Array.from(this.instances.keys()).map(id => this.closeBrowser(id));
    await Promise.all(closePromises);
    logger.info('已关闭所有浏览器实例');
  }

  public getInstanceCount(): number {
    return this.instances.size;
  }

  public getBusyCount(): number {
    return Array.from(this.instances.values()).filter(i => i.isBusy).length;
  }

  private findAvailableInstance(): BrowserInstance | undefined {
    return Array.from(this.instances.values()).find(i => !i.isBusy);
  }

  private async waitForAvailableInstance(companyId: string): Promise<BrowserInstance> {
    const maxWaitTime = 300000;
    const checkInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const available = this.findAvailableInstance();
      if (available) {
        available.isBusy = true;
        available.companyId = companyId;
        available.lastUsedAt = new Date();
        return available;
      }
      await sleep(checkInterval);
    }

    throw new Error('等待浏览器实例超时');
  }

  private async createBrowserInstance(companyId: string): Promise<BrowserInstance> {
    const userAgent = USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
    const windowSize = WINDOW_SIZES[randomInt(0, WINDOW_SIZES.length - 1)];
    const timezone = TIMEZONES[randomInt(0, TIMEZONES.length - 1)];
    const language = LANGUAGES[randomInt(0, LANGUAGES.length - 1)];

    const options = new chrome.Options();

    if (this.headless) {
      options.addArguments('--headless=new');
    }

    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments(`--user-agent=${userAgent}`);
    options.addArguments(`--window-size=${windowSize.width},${windowSize.height}`);
    options.addArguments(`--lang=${language.split(',')[0]}`);
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--disable-web-security');
    options.addArguments('--disable-features=IsolateOrigins,site-per-process');

    options.excludeSwitches('enable-automation');
    options.setUserPreferences({
      'useAutomationExtension': false,
      'profile.default_content_setting_values.notifications': 2,
      'profile.managed_default_content_settings.images': 1,
      'intl.accept_languages': language,
    });

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await driver.manage().setTimeouts({
      pageLoad: this.pageLoadTimeout,
      script: this.scriptTimeout,
      implicit: 5000,
    });

    await driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['${language.split(',')[0]}', 'en']
      });
      
      window.chrome = {
        runtime: {}
      };
    `);

    const id = `browser-${Date.now()}-${randomInt(1000, 9999)}`;

    return {
      id,
      driver,
      companyId,
      isBusy: true,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent,
      windowSize,
    };
  }

  public async humanType(driver: WebDriver, element: any, text: string): Promise<void> {
    for (const char of text) {
      await element.sendKeys(char);
      await sleep(randomInt(30, 150));
    }
  }

  public async humanClick(driver: WebDriver, element: any): Promise<void> {
    const actions = driver.actions();
    const rect = await element.getRect();
    
    const offsetX = randomInt(-10, 10);
    const offsetY = randomInt(-10, 10);
    
    await actions
      .move({ x: Math.floor(rect.x + rect.width / 2 + offsetX), y: Math.floor(rect.y + rect.height / 2 + offsetY) })
      .pause(randomInt(100, 300))
      .click()
      .perform();
  }

  public async randomScroll(driver: WebDriver): Promise<void> {
    const scrollDistance = randomInt(100, 500);
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    await driver.executeScript(`
      window.scrollBy(0, ${scrollDistance * direction});
    `);
    
    await sleep(randomInt(500, 2000));
  }

  public async waitForHuman(driver: WebDriver, minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    await sleep(randomInt(minMs, maxMs));
  }

  public getInstanceById(instanceId: string): BrowserInstance | undefined {
    return this.instances.get(instanceId);
  }
}

export default BrowserManager;
