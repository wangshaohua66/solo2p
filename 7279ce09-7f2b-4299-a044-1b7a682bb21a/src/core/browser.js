import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[BrowserManager][${level.toUpperCase()}]`;
  console.log(`${prefix} ${timestamp} - ${message}`);
}

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    log(`截图目录已创建: ${SCREENSHOT_DIR}`);
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

  log(`Chrome配置: UA=${userAgent.substring(0, 50)}..., 语言=${language}, 时区=${timezone}, 分辨率=${resolution.width}x${resolution.height}`);

  return { options, userAgent, language, timezone, resolution };
}

async function createNewBrowser(siteId) {
  log(`正在为站点 [${siteId}] 创建新的浏览器实例...`);

  const { options, userAgent, language, timezone, resolution } = buildChromeOptions();

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['${language}', 'zh-CN', 'en-US']
      });

      Object.defineProperty(navigator, 'language', {
        get: () => '${language}'
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

      Intl.DateTimeFormat.prototype.resolvedOptions = new Proxy(
        Intl.DateTimeFormat.prototype.resolvedOptions,
        {
          apply: function(target, thisArg, args) {
            const result = target.apply(thisArg, args);
            result.timeZone = '${timezone}';
            return result;
          }
        }
      );
    `);

    log(`浏览器实例创建成功 [${siteId}]`);

    return {
      driver,
      siteId,
      userAgent,
      language,
      timezone,
      resolution,
      createdAt: Date.now(),
      lastUsedAt: Date.now()
    };
  } catch (error) {
    log(`浏览器初始化失败 [${siteId}]: ${error.message}`, 'error');
    try {
      await driver.quit();
    } catch (e) {
      // ignore
    }
    throw error;
  }
}

function resetIdleTimer(siteId) {
  if (idleTimers.has(siteId)) {
    clearTimeout(idleTimers.get(siteId));
  }

  const timer = setTimeout(() => {
    log(`浏览器实例闲置超时，自动释放 [${siteId}]`);
    closeBrowser(siteId);
  }, IDLE_TIMEOUT);

  idleTimers.set(siteId, timer);
  log(`闲置超时计时器已重置 [${siteId}]，超时时间: ${IDLE_TIMEOUT / 60000}分钟`);
}

function resetSessionTimer(siteId) {
  if (sessionTimers.has(siteId)) {
    clearTimeout(sessionTimers.get(siteId));
  }

  const timer = setTimeout(() => {
    log(`会话超时，需要重新登录 [${siteId}]`);
    sessionCookies.delete(siteId);
  }, SESSION_TIMEOUT);

  sessionTimers.set(siteId, timer);
}

async function closeBrowser(siteId) {
  log(`正在关闭浏览器实例 [${siteId}]...`);

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
      await browser.driver.quit();
      log(`浏览器实例已优雅关闭 [${siteId}]`);
    } catch (error) {
      log(`关闭浏览器时出错 [${siteId}]: ${error.message}`, 'error');
    } finally {
      browserPool.delete(siteId);
    }
  } else {
    log(`未找到浏览器实例 [${siteId}]`);
  }
}

export async function createBrowser(siteId) {
  log(`请求浏览器实例 [${siteId}]，当前活跃数: ${getActiveCount()}/${MAX_BROWSERS}`);

  if (browserPool.has(siteId)) {
    log(`复用现有浏览器实例 [${siteId}]`);
    const browser = browserPool.get(siteId);
    browser.lastUsedAt = Date.now();
    resetIdleTimer(siteId);
    resetSessionTimer(siteId);
    return browser.driver;
  }

  if (browserPool.size >= MAX_BROWSERS) {
    const error = new Error(`浏览器实例数已达上限 (${MAX_BROWSERS})，无法创建新实例`);
    log(error.message, 'error');
    throw error;
  }

  const browser = await createNewBrowser(siteId);
  browserPool.set(siteId, browser);
  resetIdleTimer(siteId);
  resetSessionTimer(siteId);

  log(`浏览器实例已创建并加入池 [${siteId}]，当前活跃数: ${getActiveCount()}`);

  return browser.driver;
}

export async function releaseBrowser(siteId) {
  log(`释放浏览器实例 [${siteId}]`);

  const browser = browserPool.get(siteId);
  if (browser) {
    browser.lastUsedAt = Date.now();
    resetIdleTimer(siteId);
    log(`浏览器实例已标记为闲置 [${siteId}]`);
  } else {
    log(`未找到要释放的浏览器实例 [${siteId}]`, 'warn');
  }
}

export async function injectCookies(driver, cookies) {
  if (!driver || !cookies || cookies.length === 0) {
    log('Cookie注入失败：参数无效', 'warn');
    return false;
  }

  try {
    log(`正在注入 ${cookies.length} 个 Cookie...`);

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
        log(`Cookie注入跳过 [${cookie.name}]: ${error.message}`, 'warn');
      }
    }

    log('Cookie注入完成');
    return true;
  } catch (error) {
    log(`Cookie注入失败: ${error.message}`, 'error');
    return false;
  }
}

export async function saveCookies(driver) {
  if (!driver) {
    log('保存Cookie失败：driver无效', 'warn');
    return [];
  }

  try {
    const cookies = await driver.manage().getCookies();
    log(`成功保存 ${cookies.length} 个 Cookie`);
    return cookies;
  } catch (error) {
    log(`保存Cookie失败: ${error.message}`, 'error');
    return [];
  }
}

export async function takeScreenshot(driver, filename) {
  if (!driver) {
    log('截图失败：driver无效', 'error');
    return null;
  }

  try {
    ensureScreenshotDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = filename ? `${filename}_${timestamp}.png` : `screenshot_${timestamp}.png`;
    const filePath = path.join(SCREENSHOT_DIR, safeFilename);

    const data = await driver.takeScreenshot();
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    log(`截图已保存: ${filePath}`);
    return filePath;
  } catch (error) {
    log(`截图失败: ${error.message}`, 'error');
    return null;
  }
}

export async function closeAll() {
  log(`正在关闭所有浏览器实例，当前数量: ${browserPool.size}`);

  const siteIds = Array.from(browserPool.keys());
  const results = await Promise.allSettled(
    siteIds.map(siteId => closeBrowser(siteId))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  log(`所有浏览器关闭完成，成功: ${successCount}/${siteIds.length}`);

  idleTimers.clear();
  sessionTimers.clear();
  sessionCookies.clear();
}

export function getActiveCount() {
  return browserPool.size;
}

export async function checkLoginStatus(driver, checkUrl, checkSelector) {
  if (!driver || !checkUrl) {
    log('登录状态检测失败：参数无效', 'warn');
    return false;
  }

  try {
    log(`正在检测登录状态... URL: ${checkUrl}`);

    await driver.get(checkUrl);

    if (checkSelector) {
      try {
        const element = await driver.wait(
          until.elementLocated(By.css(checkSelector)),
          5000
        );
        if (element) {
          log('登录状态检测：已登录');
          return true;
        }
      } catch (error) {
        log('登录状态检测：未找到登录标识元素', 'warn');
        return false;
      }
    }

    const currentUrl = await driver.getCurrentUrl();
    log(`当前页面URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('signin')) {
      log('登录状态检测：未登录（跳转至登录页）');
      return false;
    }

    log('登录状态检测：疑似已登录');
    return true;
  } catch (error) {
    log(`登录状态检测失败: ${error.message}`, 'error');
    return false;
  }
}

export async function setPageTimeout(driver, timeoutMs) {
  if (!driver) {
    log('设置超时失败：driver无效', 'warn');
    return;
  }

  try {
    await driver.manage().setTimeouts({
      pageLoad: timeoutMs,
      script: timeoutMs,
      implicit: 5000
    });
    log(`页面超时已设置为: ${timeoutMs}ms`);
  } catch (error) {
    log(`设置页面超时失败: ${error.message}`, 'error');
  }
}

export async function getMemoryUsage(driver) {
  if (!driver) {
    log('获取内存使用失败：driver无效', 'warn');
    return null;
  }

  try {
    const performance = await driver.executeScript(`
      if (window.performance && window.performance.memory) {
        return {
          totalJSHeapSize: window.performance.memory.totalJSHeapSize,
          usedJSHeapSize: window.performance.memory.usedJSHeapSize,
          jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    `);

    if (performance) {
      const usedMB = (performance.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (performance.totalJSHeapSize / 1024 / 1024).toFixed(2);
      log(`内存使用: ${usedMB}MB / ${totalMB}MB`);
    }

    return performance;
  } catch (error) {
    log(`获取内存使用失败: ${error.message}`, 'warn');
    return null;
  }
}

export function storeSessionCookies(siteId, cookies) {
  sessionCookies.set(siteId, {
    cookies,
    savedAt: Date.now()
  });
  log(`会话Cookie已存储 [${siteId}]，共 ${cookies.length} 个`);
}

export function getSessionCookies(siteId) {
  const session = sessionCookies.get(siteId);
  if (session) {
    log(`获取会话Cookie [${siteId}]，共 ${session.cookies.length} 个`);
    return session.cookies;
  }
  log(`未找到会话Cookie [${siteId}]`);
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
  getBrowserInfo
};
