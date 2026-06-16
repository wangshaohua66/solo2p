import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { remote } from 'webdriverio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { crawlConfig } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Browser');

const MAX_BROWSERS = 4;
const IDLE_TIMEOUT = 5 * 60 * 1000;
const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots');
const SESSION_TIMEOUT = 30 * 60 * 1000;

const browserPool = new Map();
const idleTimers = new Map();
const sessionTimers = new Map();
const sessionCookies = new Map();

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/105.0.0.0'
];

const LANGUAGES = ['zh-CN', 'zh-TW', 'en-US', 'en-GB'];
const TIMEZONES = ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'America/New_York'];
const RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 }
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomUserAgent() {
  return getRandomItem(USER_AGENTS);
}

function getRandomLanguage() {
  return getRandomItem(LANGUAGES);
}

function getRandomTimezone() {
  return getRandomItem(TIMEZONES);
}

function getRandomResolution() {
  return getRandomItem(RESOLUTIONS);
}

function getDriverType() {
  return crawlConfig.driverType || 'webdriverio';
}

function isWebDriverIO(driver) {
  return driver && typeof driver.$ === 'function';
}

function isSelenium(driver) {
  return driver && typeof driver.findElement === 'function';
}

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    logger.debug(`截图目录已创建: ${SCREENSHOT_DIR}`);
  }
}

function buildChromeOptions() {
  const options = new chrome.Options();
  const userAgent = getRandomUserAgent();
  const language = getRandomLanguage();
  const timezone = getRandomTimezone();
  const resolution = getRandomResolution();

  options.addArguments('--no-sandbox');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-gpu');
  options.addArguments('--start-maximized');
  options.addArguments(`--window-size=${resolution.width},${resolution.height}`);
  options.addArguments(`--lang=${language}`);
  options.addArguments('--disable-infobars');
  options.addArguments('--disable-extensions');
  options.addArguments('--disable-popup-blocking');
  options.addArguments('--disable-notifications');
  options.addArguments('--ignore-certificate-errors');
  options.addArguments('--allow-running-insecure-content');
  options.addArguments(`--user-agent=${userAgent}`);

  options.excludeSwitches('enable-automation');
  options.excludeSwitches('enable-logging');

  options.setUserPreferences({
    'intl.accept_languages': language,
    'profile.default_content_setting_values.notifications': 2,
    'profile.default_content_setting_values.popups': 2,
    'profile.managed_default_content_settings.images': 1,
    'useAutomationExtension': false
  });

  logger.debug(`Chrome配置: UA=${userAgent.substring(0, 50)}..., 语言=${language}, 时区=${timezone}, 分辨率=${resolution.width}x${resolution.height}`);

  return { options, userAgent, language, timezone, resolution };
}

function buildWebdriverIOCaps() {
  const userAgent = getRandomUserAgent();
  const language = getRandomLanguage();
  const timezone = getRandomTimezone();
  const resolution = getRandomResolution();

  const capabilities = {
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--start-maximized',
        `--window-size=${resolution.width},${resolution.height}`,
        `--lang=${language}`,
        '--disable-infobars',
        '--disable-extensions',
        '--disable-popup-blocking',
        '--disable-notifications',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content',
        `--user-agent=${userAgent}`
      ],
      excludeSwitches: ['enable-automation', 'enable-logging'],
      prefs: {
        'intl.accept_languages': language,
        'profile.default_content_setting_values.notifications': 2,
        'profile.default_content_setting_values.popups': 2,
        'profile.managed_default_content_settings.images': 1,
        'useAutomationExtension': false
      }
    }
  };

  return { capabilities, userAgent, language, timezone, resolution };
}

async function applyAntiDetection(driver) {
  if (isWebDriverIO(driver)) {
    await driver.executeScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });
  } else if (isSelenium(driver)) {
    await driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh-CN', 'en-US']
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'zh-CN'
      });

      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      );
    `);
  }
}

async function createNewBrowserWithSelenium(siteId) {
  logger.info(`[Selenium] 正在为站点 [${siteId}] 创建浏览器实例...`);

  const { options, userAgent, language, timezone, resolution } = buildChromeOptions();

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await applyAntiDetection(driver);
    logger.info(`[Selenium] 浏览器实例创建成功 [${siteId}]`);

    return {
      driver,
      driverType: 'selenium',
      siteId,
      userAgent,
      language,
      timezone,
      resolution,
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    };
  } catch (error) {
    logger.error(`[Selenium] 浏览器初始化失败 [${siteId}]: ${error.message}`);
    try {
      await driver.quit();
    } catch (e) {
      // ignore
    }
    throw error;
  }
}

async function createNewBrowserWithWebdriverIO(siteId) {
  logger.info(`[WebdriverIO] 正在为站点 [${siteId}] 创建浏览器实例...`);

  const { capabilities, userAgent, language, timezone, resolution } = buildWebdriverIOCaps();

  const driver = await remote({
    capabilities,
    logLevel: 'warn',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3
  });

  try {
    await applyAntiDetection(driver);
    logger.info(`[WebdriverIO] 浏览器实例创建成功 [${siteId}]`);

    return {
      driver,
      driverType: 'webdriverio',
      siteId,
      userAgent,
      language,
      timezone,
      resolution,
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    };
  } catch (error) {
    logger.error(`[WebdriverIO] 浏览器初始化失败 [${siteId}]: ${error.message}`);
    try {
      await driver.deleteSession();
    } catch (e) {
      // ignore
    }
    throw error;
  }
}

async function createNewBrowser(siteId) {
  const driverType = getDriverType();

  if (driverType === 'webdriverio') {
    try {
      return await createNewBrowserWithWebdriverIO(siteId);
    } catch (wdioError) {
      logger.warn(`WebdriverIO 创建失败，回退到 Selenium: ${wdioError.message}`);
      return await createNewBrowserWithSelenium(siteId);
    }
  } else {
    return await createNewBrowserWithSelenium(siteId);
  }
}

function resetIdleTimer(siteId) {
  if (idleTimers.has(siteId)) {
    clearTimeout(idleTimers.get(siteId));
  }

  const timer = setTimeout(() => {
    logger.info(`浏览器实例闲置超时，自动释放 [${siteId}]`);
    closeBrowser(siteId);
  }, IDLE_TIMEOUT);

  idleTimers.set(siteId, timer);
}

function resetSessionTimer(siteId) {
  if (sessionTimers.has(siteId)) {
    clearTimeout(sessionTimers.get(siteId));
  }

  const timer = setTimeout(() => {
    logger.info(`会话超时，需要重新登录 [${siteId}]`);
    sessionCookies.delete(siteId);
  }, SESSION_TIMEOUT);

  sessionTimers.set(siteId, timer);
}

async function closeBrowser(siteId) {
  logger.info(`正在关闭浏览器实例 [${siteId}]...`);

  if (idleTimers.has(siteId)) {
    clearTimeout(idleTimers.get(siteId));
    idleTimers.delete(siteId);
  }

  if (sessionTimers.has(siteId)) {
    clearTimeout(sessionTimers.get(siteId));
    sessionTimers.delete(siteId);
  }

  const browser = browserPool.get(siteId);
  if (browser) {
    try {
      if (browser.driverType === 'webdriverio') {
        await browser.driver.deleteSession();
      } else {
        await browser.driver.quit();
      }
      logger.info(`浏览器实例已优雅关闭 [${siteId}]`);
    } catch (error) {
      logger.error(`关闭浏览器时出错 [${siteId}]: ${error.message}`);
    } finally {
      browserPool.delete(siteId);
    }
  } else {
    logger.warn(`未找到浏览器实例 [${siteId}]`);
  }
}

export async function createBrowser(siteId) {
  logger.info(`请求浏览器实例 [${siteId}]，当前活跃数: ${getActiveCount()}/${MAX_BROWSERS}`);

  if (browserPool.has(siteId)) {
    logger.debug(`复用现有浏览器实例 [${siteId}]`);
    const browser = browserPool.get(siteId);
    browser.lastUsedAt = Date.now();
    resetIdleTimer(siteId);
    resetSessionTimer(siteId);
    return browser.driver;
  }

  if (browserPool.size >= MAX_BROWSERS) {
    const error = new Error(`浏览器实例数已达上限 (${MAX_BROWSERS})，无法创建新实例`);
    logger.error(error.message);
    throw error;
  }

  const browser = await createNewBrowser(siteId);
  browserPool.set(siteId, browser);
  resetIdleTimer(siteId);
  resetSessionTimer(siteId);

  logger.info(`浏览器实例已创建并加入池 [${siteId}]，当前活跃数: ${getActiveCount()}`);

  return browser.driver;
}

export async function releaseBrowser(siteId) {
  logger.debug(`释放浏览器实例 [${siteId}]`);

  const browser = browserPool.get(siteId);
  if (browser) {
    browser.lastUsedAt = Date.now();
    resetIdleTimer(siteId);
    logger.debug(`浏览器实例已标记为闲置 [${siteId}]`);
  } else {
    logger.warn(`未找到要释放的浏览器实例 [${siteId}]`);
  }
}

export async function injectCookies(driver, cookies) {
  if (!driver || !cookies || cookies.length === 0) {
    logger.warn('Cookie注入失败：参数无效');
    return false;
  }

  try {
    logger.info(`正在注入 ${cookies.length} 个 Cookie...`);

    if (isWebDriverIO(driver)) {
      for (const cookie of cookies) {
        try {
          await driver.setCookies([{
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || undefined,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            expiry: cookie.expiry
          }]);
        } catch (error) {
          logger.debug(`Cookie注入跳过 [${cookie.name}]: ${error.message}`);
        }
      }
    } else if (isSelenium(driver)) {
      for (const cookie of cookies) {
        const cookieObj = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain || '',
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false
        };

        if (cookie.expiry) {
          cookieObj.expiry = cookie.expiry;
        }

        try {
          await driver.manage().addCookie(cookieObj);
        } catch (error) {
          logger.debug(`Cookie注入跳过 [${cookie.name}]: ${error.message}`);
        }
      }
    }

    logger.info('Cookie注入完成');
    return true;
  } catch (error) {
    logger.error(`Cookie注入失败: ${error.message}`);
    return false;
  }
}

export async function saveCookies(driver) {
  if (!driver) {
    logger.warn('保存Cookie失败：driver无效');
    return [];
  }

  try {
    let cookies = [];

    if (isWebDriverIO(driver)) {
      cookies = await driver.getCookies();
    } else if (isSelenium(driver)) {
      cookies = await driver.manage().getCookies();
    }

    logger.info(`成功保存 ${cookies.length} 个 Cookie`);
    return cookies;
  } catch (error) {
    logger.error(`保存Cookie失败: ${error.message}`);
    return [];
  }
}

export async function takeScreenshot(driver, filename) {
  if (!driver) {
    logger.error('截图失败：driver无效');
    return null;
  }

  try {
    ensureScreenshotDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = filename ? `${filename}_${timestamp}.png` : `screenshot_${timestamp}.png`;
    const filePath = path.join(SCREENSHOT_DIR, safeFilename);

    let data;
    if (isWebDriverIO(driver)) {
      data = await driver.takeScreenshot();
    } else if (isSelenium(driver)) {
      data = await driver.takeScreenshot();
    }

    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    logger.info(`截图已保存: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`截图失败: ${error.message}`);
    return null;
  }
}

export async function closeAll() {
  logger.info(`正在关闭所有浏览器实例，当前数量: ${browserPool.size}`);

  const siteIds = Array.from(browserPool.keys());
  const results = await Promise.allSettled(
    siteIds.map(siteId => closeBrowser(siteId))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  logger.info(`所有浏览器关闭完成，成功: ${successCount}/${siteIds.length}`);

  idleTimers.clear();
  sessionTimers.clear();
  sessionCookies.clear();
}

export function getActiveCount() {
  return browserPool.size;
}

export async function checkLoginStatus(driver, checkUrl, checkSelector) {
  if (!driver || !checkUrl) {
    logger.warn('登录状态检测失败：参数无效');
    return false;
  }

  try {
    logger.info(`正在检测登录状态... URL: ${checkUrl}`);

    if (isWebDriverIO(driver)) {
      await driver.url(checkUrl);

      if (checkSelector) {
        try {
          const element = await $(checkSelector);
          await element.waitForExist({ timeout: 5000 });
          logger.info('登录状态检测：已登录');
          return true;
        } catch (error) {
          logger.warn('登录状态检测：未找到登录标识元素');
          return false;
        }
      }

      const currentUrl = await driver.getUrl();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        logger.info('登录状态检测：未登录（跳转至登录页）');
        return false;
      }

      logger.info('登录状态检测：疑似已登录');
      return true;
    } else if (isSelenium(driver)) {
      await driver.get(checkUrl);

      if (checkSelector) {
        try {
          const element = await driver.wait(
            until.elementLocated(By.css(checkSelector)),
            5000
          );
          if (element) {
            logger.info('登录状态检测：已登录');
            return true;
          }
        } catch (error) {
          logger.warn('登录状态检测：未找到登录标识元素');
          return false;
        }
      }

      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        logger.info('登录状态检测：未登录（跳转至登录页）');
        return false;
      }

      logger.info('登录状态检测：疑似已登录');
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`登录状态检测失败: ${error.message}`);
    return false;
  }
}

export async function setPageTimeout(driver, timeoutMs) {
  if (!driver) {
    logger.warn('设置超时失败：driver无效');
    return;
  }

  try {
    if (isSelenium(driver)) {
      await driver.manage().setTimeouts({
        pageLoad: timeoutMs,
        script: timeoutMs,
        implicit: 5000
      });
    }
    logger.debug(`页面超时已设置为: ${timeoutMs}ms`);
  } catch (error) {
    logger.error(`设置页面超时失败: ${error.message}`);
  }
}

export async function getMemoryUsage(driver) {
  if (!driver) {
    logger.warn('获取内存使用失败：driver无效');
    return null;
  }

  try {
    const script = `
      if (window.performance && window.performance.memory) {
        return {
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    `;

    let performance;
    if (isWebDriverIO(driver)) {
      performance = await driver.executeScript(script);
    } else if (isSelenium(driver)) {
      performance = await driver.executeScript(script);
    }

    if (performance) {
      const usedMB = (performance.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (performance.totalJSHeapSize / 1024 / 1024).toFixed(2);
      logger.debug(`内存使用: ${usedMB}MB / ${totalMB}MB`);
    }

    return performance;
  } catch (error) {
    logger.warn(`获取内存使用失败: ${error.message}`);
    return null;
  }
}

export function storeSessionCookies(siteId, cookies) {
  sessionCookies.set(siteId, {
    cookies,
    savedAt: Date.now()
  });
  logger.info(`会话Cookie已存储 [${siteId}]，共 ${cookies.length} 个`);
}

export function getSessionCookies(siteId) {
  const session = sessionCookies.get(siteId);
  if (session) {
    logger.debug(`获取会话Cookie [${siteId}]，共 ${session.cookies.length} 个`);
    return session.cookies;
  }
  logger.debug(`未找到会话Cookie [${siteId}]`);
  return null;
}

export function hasActiveBrowser(siteId) {
  return browserPool.has(siteId);
}

export function getBrowserInfo(siteId) {
  const browser = browserPool.get(siteId);
  if (!browser) return null;

  return {
    siteId: browser.siteId,
    driverType: browser.driverType,
    userAgent: browser.userAgent,
    language: browser.language,
    timezone: browser.timezone,
    resolution: browser.resolution,
    createdAt: browser.createdAt,
    lastUsedAt: browser.lastUsedAt,
    uptime: Date.now() - browser.createdAt,
    idleTime: Date.now() - browser.lastUsedAt
  };
}

export function getDriverTypeConfig() {
  return getDriverType();
}

export function isWebDriverIODriver(driver) {
  return isWebDriverIO(driver);
}

export function isSeleniumDriver(driver) {
  return isSelenium(driver);
}

export default {
  createBrowser,
  releaseBrowser,
  injectCookies,
  saveCookies,
  takeScreenshot,
  closeAll,
  getActiveCount,
  checkLoginStatus,
  setPageTimeout,
  getMemoryUsage,
  storeSessionCookies,
  getSessionCookies,
  hasActiveBrowser,
  getBrowserInfo,
  getDriverType: getDriverTypeConfig,
  isWebDriverIO: isWebDriverIODriver,
  isSelenium: isSeleniumDriver
};
