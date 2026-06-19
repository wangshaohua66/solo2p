const fs = require('fs');
const path = require('path');
const { Builder, By, until, Capabilities } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const dayjs = require('dayjs');
const chalk = require('chalk');
const {
  cookieConfig,
  chromeConfig,
  getPlatformUrl,
  getCredentials,
  fetchConfig,
  PLATFORMS,
  PLATFORM_NAMES
} = require('./config');
const { globalAlertManager } = require('./retryHandler');

class CookieStore {
  constructor(storagePath = cookieConfig.storagePath) {
    this.storagePath = storagePath;
    this._cookies = {};
    this._ensureFile();
    this._load();
  }

  _ensureFile() {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({}, null, 2));
    }
  }

  _load() {
    try {
      const content = fs.readFileSync(this.storagePath, 'utf-8');
      this._cookies = JSON.parse(content || '{}');
    } catch (err) {
      console.warn(chalk.yellow(`Cookie文件加载失败，将重新创建: ${err.message}`));
      this._cookies = {};
    }
  }

  _save() {
    fs.writeFileSync(this.storagePath, JSON.stringify(this._cookies, null, 2));
  }

  setCookies(platform, cookies, metadata = {}) {
    this._cookies[platform] = {
      cookies,
      savedAt: dayjs().toISOString(),
      expiresAt: metadata.expiresAt || dayjs().add(cookieConfig.sessionExpiryHours, 'hour').toISOString(),
      ...metadata
    };
    this._save();
  }

  getCookies(platform) {
    const data = this._cookies[platform];
    if (!data) return null;

    const expiresAt = dayjs(data.expiresAt);
    const refreshThreshold = dayjs().add(cookieConfig.refreshThresholdMinutes, 'minute');

    if (expiresAt.isBefore(refreshThreshold)) {
      return null;
    }

    return data.cookies;
  }

  isSessionValid(platform) {
    const data = this._cookies[platform];
    if (!data) return false;
    const expiresAt = dayjs(data.expiresAt);
    return expiresAt.isAfter(dayjs());
  }

  getSessionInfo(platform) {
    const data = this._cookies[platform];
    if (!data) return null;
    return {
      savedAt: data.savedAt,
      expiresAt: data.expiresAt,
      isExpired: dayjs(data.expiresAt).isBefore(dayjs()),
      minutesRemaining: dayjs(data.expiresAt).diff(dayjs(), 'minute')
    };
  }

  clearCookies(platform) {
    if (platform) {
      delete this._cookies[platform];
    } else {
      this._cookies = {};
    }
    this._save();
  }

  getAllPlatforms() {
    return Object.keys(this._cookies);
  }
}

class BrowserManager {
  constructor() {
    this.drivers = new Map();
  }

  _buildChromeOptions() {
    const options = new chrome.Options();

    if (chromeConfig.headless) {
      options.addArguments('--headless=new');
    }
    if (chromeConfig.noSandbox) {
      options.addArguments('--no-sandbox');
    }
    if (chromeConfig.disableDevShmUsage) {
      options.addArguments('--disable-dev-shm-usage');
    }
    if (chromeConfig.windowSize) {
      options.addArguments(`--window-size=${chromeConfig.windowSize}`);
    }
    if (chromeConfig.userDataDir) {
      const dir = path.resolve(chromeConfig.userDataDir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      options.addArguments(`--user-data-dir=${dir}`);
    }
    if (chromeConfig.disableImages) {
      options.setUserPreferences({
        profile: {
          managed_default_content_settings: {
            images: 2
          }
        }
      });
    }

    (chromeConfig.additionalArgs || []).forEach(arg => {
      options.addArguments(arg);
    });

    options.excludeSwitches('enable-automation');
    options.addArguments('--disable-blink-features=AutomationControlled');

    return options;
  }

  async createDriver(platform) {
    if (this.drivers.has(platform)) {
      return this.drivers.get(platform);
    }

    const options = this._buildChromeOptions();
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .withCapabilities(Capabilities.chrome().set('acceptInsecureCerts', true))
      .build();

    await driver.manage().setTimeouts({
      pageLoadTimeout: fetchConfig.pageLoadTimeout,
      scriptTimeout: fetchConfig.navigationTimeout,
      implicit: 3000
    });

    await driver.manage().window().setRect({ width: 1920, height: 1080 });

    this.drivers.set(platform, driver);
    return driver;
  }

  async getDriver(platform) {
    return this.drivers.get(platform) || this.createDriver(platform);
  }

  async closeDriver(platform) {
    const driver = this.drivers.get(platform);
    if (driver) {
      try {
        await driver.quit();
      } catch (err) {
        // ignore
      }
      this.drivers.delete(platform);
    }
  }

  async closeAll() {
    for (const [platform] of this.drivers) {
      await this.closeDriver(platform);
    }
  }
}

class AuthManager {
  constructor() {
    this.cookieStore = new CookieStore();
    this.browserManager = new BrowserManager();
  }

  async _applyCookies(driver, url, cookies) {
    await driver.get(url);
    for (const cookie of cookies) {
      try {
        const cookieData = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false
        };
        if (cookie.expiry) {
          cookieData.expiry = cookie.expiry;
        }
        await driver.manage().addCookie(cookieData);
      } catch (err) {
        // ignore individual cookie errors
      }
    }
    await driver.get(url);
    await driver.sleep(2000);
  }

  async _collectCookies(driver) {
    return await driver.manage().getCookies();
  }

  async _isLoggedIn(driver, platform) {
    try {
      const loginUrl = getPlatformUrl(platform, 'login');
      const currentUrl = await driver.getCurrentUrl();

      if (currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('SignIn')) {
        return false;
      }

      const logoutSelectors = [
        By.css('[href*="logout"]'),
        By.css('[id*="logout"]'),
        By.xpath('//*[contains(text(), "退出") or contains(text(), "注销") or contains(text(), "Logout") or contains(text(), "Sign Out")]')
      ];

      for (const selector of logoutSelectors) {
        try {
          const elements = await driver.findElements(selector);
          if (elements.length > 0) return true;
        } catch (err) { /* continue */ }
      }

      const protectedSelectors = [
        By.css('[id*="order"]'),
        By.css('[class*="order"]'),
        By.css('[id*="dashboard"]'),
        By.css('[class*="dashboard"]'),
        By.css('[data-testid*="seller"]')
      ];

      for (const selector of protectedSelectors) {
        try {
          const elements = await driver.findElements(selector);
          if (elements.length > 0) return true;
        } catch (err) { /* continue */ }
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  async _handleCaptcha(driver, platform) {
    const captchaSelectors = [
      By.css('#captchacharacters'),
      By.css('[id*="captcha"]'),
      By.css('[class*="captcha"]'),
      By.css('#recaptcha'),
      By.css('.g-recaptcha'),
      By.css('iframe[src*="captcha"]')
    ];

    for (const selector of captchaSelectors) {
      try {
        const elements = await driver.findElements(selector);
        if (elements.length > 0) {
          console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 检测到验证码，需要手动处理...`));
          if (chromeConfig.headless) {
            console.log(chalk.yellow(`  提示：请设置 CHROME_HEADLESS=false 以非无头模式启动，手动完成验证`));
          }
          await driver.sleep(15000);
          return true;
        }
      } catch (err) { /* continue */ }
    }
    return false;
  }

  async _doLogin(driver, platform) {
    const credentials = getCredentials(platform);
    const loginUrl = getPlatformUrl(platform, 'login');

    await driver.get(loginUrl);
    await driver.sleep(3000);

    await this._handleCaptcha(driver, platform);

    const usernameSelectors = [
      By.css('#ap_email'),
      By.css('#email'),
      By.css('[name="email"]'),
      By.css('[name="username"]'),
      By.css('[id*="email"]'),
      By.css('[id*="username"]'),
      By.css('input[type="email"]'),
      By.css('input[type="text"]')
    ];

    let usernameInput = null;
    for (const selector of usernameSelectors) {
      try {
        const el = await driver.wait(until.elementLocated(selector), 5000);
        if (await el.isDisplayed()) {
          usernameInput = el;
          break;
        }
      } catch (err) { /* continue */ }
    }

    if (usernameInput) {
      await usernameInput.clear();
      await usernameInput.sendKeys(credentials.username);
      await driver.sleep(1000);
    }

    const continueSelectors = [
      By.css('#continue'),
      By.css('[id*="continue"]'),
      By.xpath('//*[contains(@value, "Continue") or contains(text(), "继续") or contains(@id, "next")]')
    ];

    for (const selector of continueSelectors) {
      try {
        const elements = await driver.findElements(selector);
        for (const el of elements) {
          if (await el.isDisplayed() && await el.isEnabled()) {
            await el.click();
            await driver.sleep(2000);
            break;
          }
        }
      } catch (err) { /* continue */ }
    }

    const passwordSelectors = [
      By.css('#ap_password'),
      By.css('#password'),
      By.css('[name="password"]'),
      By.css('[id*="password"]'),
      By.css('input[type="password"]')
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        const el = await driver.wait(until.elementLocated(selector), 5000);
        if (await el.isDisplayed()) {
          passwordInput = el;
          break;
        }
      } catch (err) { /* continue */ }
    }

    if (passwordInput) {
      await passwordInput.clear();
      await passwordInput.sendKeys(credentials.password);
      await driver.sleep(1000);
    }

    const submitSelectors = [
      By.css('#signInSubmit'),
      By.css('#submit'),
      By.css('[id*="submit"]'),
      By.css('[id*="login"]'),
      By.css('[type="submit"]'),
      By.xpath('//*[contains(@value, "Sign in") or contains(@value, "Login") or contains(text(), "登录") or contains(text(), "登入")]')
    ];

    for (const selector of submitSelectors) {
      try {
        const elements = await driver.findElements(selector);
        for (const el of elements) {
          if (await el.isDisplayed() && await el.isEnabled()) {
            await el.click();
            await driver.sleep(3000);
            break;
          }
        }
      } catch (err) { /* continue */ }
    }

    await this._handleCaptcha(driver, platform);

    if (credentials.otpSecret) {
      const otpSelectors = [
        By.css('#auth-mfa-otpcode'),
        By.css('[id*="otp"]'),
        By.css('[id*="verification"]'),
        By.css('[name*="otp"]'),
        By.css('[name*="verification"]'),
        By.css('input[maxlength="6"]')
      ];

      for (const selector of otpSelectors) {
        try {
          const el = await driver.wait(until.elementLocated(selector), 5000);
          if (await el.isDisplayed()) {
            console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 检测到二次验证，请手动输入OTP...`));
            await driver.sleep(20000);
            break;
          }
        } catch (err) { /* continue */ }
      }
    }

    await driver.sleep(3000);
    const loggedIn = await this._isLoggedIn(driver, platform);

    if (loggedIn) {
      const cookies = await this._collectCookies(driver);
      this.cookieStore.setCookies(platform, cookies);
      console.log(chalk.green(`[${PLATFORM_NAMES[platform]}] 登录成功，会话已保存`));
      return true;
    }

    console.log(chalk.red(`[${PLATFORM_NAMES[platform]}] 登录失败`));
    await globalAlertManager.alertLoginFailure(platform, new Error('登录流程完成但未检测到登录态'));
    return false;
  }

  async ensureLogin(platform, forceRelogin = false) {
    if (!PLATFORMS.includes(platform)) {
      throw new Error(`未知平台: ${platform}`);
    }

    const driver = await this.browserManager.getDriver(platform);

    if (!forceRelogin) {
      const savedCookies = this.cookieStore.getCookies(platform);
      if (savedCookies) {
        const ordersUrl = getPlatformUrl(platform, 'orders');
        await this._applyCookies(driver, ordersUrl, savedCookies);
        await driver.sleep(2000);

        if (await this._isLoggedIn(driver, platform)) {
          const sessionInfo = this.cookieStore.getSessionInfo(platform);
          console.log(chalk.cyan(`[${PLATFORM_NAMES[platform]}] 复用已保存会话（剩余 ${Math.max(0, sessionInfo?.minutesRemaining || 0)} 分钟）`));
          return { driver, loggedIn: true, reused: true };
        }

        console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 保存的会话已失效，重新登录...`));
      }
    }

    const success = await this._doLogin(driver, platform);
    return { driver, loggedIn: success, reused: false };
  }

  async logout(platform) {
    this.cookieStore.clearCookies(platform);
    await this.browserManager.closeDriver(platform);
  }

  getSessionStatus(platform) {
    return this.cookieStore.getSessionInfo(platform);
  }

  getAllSessionStatus() {
    const status = {};
    for (const platform of PLATFORMS) {
      status[platform] = this.cookieStore.getSessionInfo(platform);
    }
    return status;
  }

  async closeAllBrowsers() {
    await this.browserManager.closeAll();
  }
}

let authManagerInstance = null;

function getAuthManager() {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager();
  }
  return authManagerInstance;
}

module.exports = {
  CookieStore,
  BrowserManager,
  AuthManager,
  getAuthManager
};
