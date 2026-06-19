const fs = require('fs');
const path = require('path');
const { remote } = require('webdriverio');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const dayjs = require('dayjs');
const chalk = require('chalk');
const axios = require('axios');

const {
  cookieConfig,
  chromeConfig,
  ocrConfig,
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
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({}, null, 2));
    }
  }

  _load() {
    try {
      this._cookies = JSON.parse(fs.readFileSync(this.storagePath, 'utf-8') || '{}');
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
    if (expiresAt.isBefore(refreshThreshold)) return null;
    return data.cookies;
  }

  isSessionValid(platform) {
    const data = this._cookies[platform];
    if (!data) return false;
    return dayjs(data.expiresAt).isAfter(dayjs());
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
    if (platform) delete this._cookies[platform];
    else this._cookies = {};
    this._save();
  }

  getAllPlatforms() {
    return Object.keys(this._cookies);
  }
}

class CaptchaOCR {
  constructor(options = {}) {
    this.engine = options.engine || ocrConfig.engine;
    this.tesseractLang = options.tesseractLang || ocrConfig.tesseractLang;
    this.ocrSpaceApiKey = options.ocrSpaceApiKey || ocrConfig.ocrSpaceApiKey;
    this.ocrSpaceUrl = ocrConfig.ocrSpaceUrl;
    this.screenshotDir = options.screenshotDir || ocrConfig.screenshotDir;
    this.maxRetries = options.maxRetries || ocrConfig.maxOcrRetries;
    this._tesseractWorker = null;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async _getTesseractWorker() {
    if (!this._tesseractWorker) {
      this._tesseractWorker = await Tesseract.createWorker(this.tesseractLang, 1, {
        logger: () => {}
      });
    }
    return this._tesseractWorker;
  }

  async _preprocessImage(imageBuffer) {
    try {
      const image = await Jimp.read(imageBuffer);
      image
        .greyscale()
        .contrast(0.5)
        .normalize()
        .invert();

      if (image.getWidth() < 200) {
        image.scale(2, Jimp.RESIZE_BILINEAR);
      }

      return await image.getBufferAsync(Jimp.MIME_PNG);
    } catch (err) {
      console.warn(chalk.yellow(`OCR 图像预处理失败，使用原图: ${err.message}`));
      return imageBuffer;
    }
  }

  async _recognizeWithTesseract(imageBuffer) {
    const worker = await this._getTesseractWorker();
    const processed = await this._preprocessImage(imageBuffer);
    const { data } = await worker.recognize(processed);
    const text = (data.text || '').replace(/\s+/g, '').trim();
    const confidence = data.confidence || 0;
    return { text, confidence, engine: 'tesseract' };
  }

  async _recognizeWithOcrSpace(imageBuffer) {
    if (!this.ocrSpaceApiKey) {
      throw new Error('OCR Space API Key 未配置');
    }

    const base64 = imageBuffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append('base64Image', `data:image/png;base64,${base64}`);
    formData.append('language', this.tesseractLang === 'chi_sim' || this.tesseractLang === 'chi_tra' ? 'chs' : 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    const resp = await axios.post(this.ocrSpaceUrl, formData, {
      headers: {
        apikey: this.ocrSpaceApiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    if (resp.data?.IsErroredOnProcessing) {
      throw new Error(resp.data?.ErrorMessage || 'OCR Space 处理失败');
    }

    const parsedText = resp.data?.ParsedResults?.[0]?.ParsedText || '';
    const text = parsedText.replace(/\s+/g, '').trim();
    const confidence = resp.data?.ParsedResults?.[0]?.FileParseExitCode === 1 ? 90 : 50;
    return { text, confidence, engine: 'ocrspace' };
  }

  async recognize(imageBuffer) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let result;
        if (this.engine === 'ocrspace' && this.ocrSpaceApiKey) {
          result = await this._recognizeWithOcrSpace(imageBuffer);
        } else {
          result = await this._recognizeWithTesseract(imageBuffer);
        }

        if (result.text && result.text.length >= 3) {
          if (result.confidence < 60 && attempt < this.maxRetries) {
            console.log(chalk.yellow(`  OCR 置信度较低(${result.confidence}%)，重试...`));
            continue;
          }
          return result;
        }
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    throw new Error(`OCR 识别失败: ${lastError?.message || '未知错误'}`);
  }

  async saveScreenshot(imageBuffer, label = 'captcha') {
    const filename = `${label}_${dayjs().format('YYYYMMDD_HHmmss')}_${Math.random().toString(36).slice(2, 6)}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    return filepath;
  }

  async terminate() {
    if (this._tesseractWorker) {
      try {
        await this._tesseractWorker.terminate();
      } catch (err) { /* ignore */ }
      this._tesseractWorker = null;
    }
  }
}

class BrowserManager {
  constructor() {
    this.browsers = new Map();
  }

  _buildWdioOptions(platform) {
    const args = [];

    if (chromeConfig.headless) args.push('--headless=new');
    if (chromeConfig.noSandbox) args.push('--no-sandbox');
    if (chromeConfig.disableDevShmUsage) args.push('--disable-dev-shm-usage');
    if (chromeConfig.windowSize) {
      const [w, h] = chromeConfig.windowSize.split(',').map(Number);
      args.push(`--window-size=${w},${h}`);
    }
    (chromeConfig.additionalArgs || []).forEach(a => args.push(a));

    const userDataDir = chromeConfig.userDataDir
      ? path.resolve(chromeConfig.userDataDir, platform)
      : path.resolve(__dirname, 'data', 'chrome_profile', platform);

    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    args.push(`--user-data-dir=${userDataDir}`);

    const prefs = {};
    if (chromeConfig.disableImages) {
      prefs['profile.managed_default_content_settings.images'] = 2;
    }
    prefs['credentials_enable_service'] = false;
    prefs['profile.password_manager_enabled'] = false;

    return {
      logLevel: 'error',
      waitforTimeout: fetchConfig.elementWaitTimeout,
      waitforInterval: 500,
      connectionRetryTimeout: fetchConfig.pageLoadTimeout,
      connectionRetryCount: 2,
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args,
          prefs,
          excludeSwitches: ['enable-automation'],
          binary: chromeConfig.binary || undefined
        },
        acceptInsecureCerts: true,
        timeouts: {
          pageLoad: fetchConfig.pageLoadTimeout,
          script: fetchConfig.navigationTimeout,
          implicit: 3000
        }
      }
    };
  }

  async createBrowser(platform) {
    if (this.browsers.has(platform)) return this.browsers.get(platform);

    const options = this._buildWdioOptions(platform);
    const browser = await remote(options);

    await browser.setWindowSize(1920, 1080);

    this.browsers.set(platform, browser);
    return browser;
  }

  async getBrowser(platform) {
    return this.browsers.get(platform) || this.createBrowser(platform);
  }

  async closeBrowser(platform) {
    const browser = this.browsers.get(platform);
    if (browser) {
      try { await browser.deleteSession(); } catch (err) { /* ignore */ }
      this.browsers.delete(platform);
    }
  }

  async closeAll() {
    for (const [platform] of this.browsers) {
      await this.closeBrowser(platform);
    }
  }
}

class AuthManager {
  constructor() {
    this.cookieStore = new CookieStore();
    this.browserManager = new BrowserManager();
    this.ocr = new CaptchaOCR();
  }

  async _applyCookies(browser, url, cookies) {
    await browser.url(url);
    await browser.pause(1500);

    for (const cookie of cookies) {
      try {
        const cookieData = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: !!cookie.secure,
          httpOnly: !!cookie.httpOnly
        };
        if (cookie.expiry) cookieData.expiry = cookie.expiry;
        await browser.setCookies([cookieData]);
      } catch (err) { /* skip individual */ }
    }
    await browser.url(url);
    await browser.pause(2000);
  }

  async _collectCookies(browser) {
    const cookies = await browser.getCookies();
    return cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expiry: c.expiry
    }));
  }

  async _isLoggedIn(browser, platform) {
    try {
      const url = await browser.getUrl();
      if (/login|signin|SignIn/i.test(url)) return false;

      const logoutSelectors = [
        '[href*="logout"]',
        '[id*="logout"]',
        '//*[contains(text(),"退出") or contains(text(),"注销") or contains(text(),"Logout") or contains(text(),"Sign Out")]'
      ];

      for (const sel of logoutSelectors) {
        try {
          const elements = sel.startsWith('/')
            ? await browser.$$(sel)
            : await browser.$$(sel);
          if (elements.length > 0) return true;
        } catch (err) { /* continue */ }
      }

      const protectedSelectors = [
        '[id*="order"]',
        '[class*="order"]',
        '[id*="dashboard"]',
        '[class*="dashboard"]',
        '[data-testid*="seller"]'
      ];

      for (const sel of protectedSelectors) {
        try {
          const elements = await browser.$$(sel);
          if (elements.length > 0) return true;
        } catch (err) { /* continue */ }
      }

      return false;
    } catch (err) {
      return false;
    }
  }

  async _findCaptchaElements(browser) {
    const captchaSelectors = [
      '#captchacharacters',
      '[id*="captcha"]',
      '[class*="captcha"]',
      '#recaptcha',
      '.g-recaptcha',
      'iframe[src*="captcha"]',
      'img[src*="captcha"]',
      'img[src*="verify"]',
      'img[src*="ValidateCode"]',
      '.captcha-img',
      '#captcha_image',
      '[alt*="验证码"]',
      '[alt*="captcha"]'
    ];

    for (const sel of captchaSelectors) {
      try {
        const el = await browser.$(sel);
        if (await el.isExisting() && await el.isDisplayed()) {
          return { el, selector: sel, type: sel.includes('iframe') || sel.includes('recaptcha') ? 'recaptcha' : 'image' };
        }
      } catch (err) { /* continue */ }
    }
    return null;
  }

  async _findCaptchaInput(browser) {
    const inputSelectors = [
      'input[name*="captcha"]',
      'input[name*="Captcha"]',
      'input[id*="captcha"]',
      'input[id*="Captcha"]',
      'input[placeholder*="验证"]',
      'input[placeholder*="captcha"]',
      'input[aria-label*="captcha"]',
      '#captcha-input',
      '.captcha-input input',
      'input[type="text"][maxlength="6"]',
      'input[type="text"][maxlength="4"]'
    ];

    for (const sel of inputSelectors) {
      try {
        const el = await browser.$(sel);
        if (await el.isExisting() && await el.isDisplayed()) return el;
      } catch (err) { /* continue */ }
    }
    return null;
  }

  async _handleCaptcha(browser, platform) {
    const captchaInfo = await this._findCaptchaElements(browser);
    if (!captchaInfo) return false;

    console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 检测到图形验证码，正在识别...`));

    if (captchaInfo.type === 'recaptcha') {
      console.log(chalk.yellow(`  检测到 reCAPTCHA，请手动完成（设置 CHROME_HEADLESS=false 显示浏览器），等待 30 秒...`));
      if (chromeConfig.headless) {
        console.log(chalk.yellow(`  提示：当前为无头模式，reCAPTCHA 需要非无头模式处理`));
      }
      await browser.pause(30000);
      return true;
    }

    try {
      const captchaEl = captchaInfo.el;
      const screenshot = await captchaEl.takeScreenshot();
      const screenshotBuf = Buffer.from(screenshot, 'base64');

      const savedPath = await this.ocr.saveScreenshot(screenshotBuf, `${platform}_captcha`);
      console.log(chalk.cyan(`  验证码截图已保存: ${path.basename(savedPath)}`));

      const ocrResult = await this.ocr.recognize(screenshotBuf);
      console.log(chalk.cyan(`  OCR识别结果: "${ocrResult.text}" (置信度: ${ocrResult.confidence?.toFixed(1)}%, 引擎: ${ocrResult.engine})`));

      if (ocrResult.text) {
        const inputEl = await this._findCaptchaInput(browser);
        if (inputEl) {
          await inputEl.clearValue();
          await inputEl.setValue(ocrResult.text);
          console.log(chalk.green(`  已自动填入验证码`));
          await browser.pause(1000);
          return true;
        }
      }
    } catch (ocrErr) {
      console.log(chalk.red(`  OCR识别失败: ${ocrErr.message}，请手动输入（等待 20 秒）...`));
      if (chromeConfig.headless) {
        console.log(chalk.yellow(`  提示：请设置 CHROMEME_HEADLESS=false 显示浏览器`));
      }
      await browser.pause(20000);
      return true;
    }

    return false;
  }

  async _fillInput(browser, selectors, value) {
    for (const sel of selectors) {
      try {
        const el = sel.startsWith('/') ? await browser.$(sel) : await browser.$(sel);
        if (await el.isExisting() && await el.isDisplayed()) {
          await el.setValue(value);
          return true;
        }
      } catch (err) { /* continue */ }
    }
    return false;
  }

  async _clickElement(browser, selectors) {
    for (const sel of selectors) {
      try {
        const el = sel.startsWith('/') ? await browser.$(sel) : await browser.$(sel);
        if (await el.isExisting() && await el.isDisplayed() && await el.isClickable()) {
          await el.click();
          await browser.pause(2000);
          return true;
        }
      } catch (err) { /* continue */ }
    }
    return false;
  }

  async _doLogin(browser, platform) {
    const credentials = getCredentials(platform);
    const loginUrl = getPlatformUrl(platform, 'login');

    await browser.url(loginUrl);
    await browser.pause(3000);

    await this._handleCaptcha(browser, platform);

    const usernameSelectors = [
      '#ap_email',
      '#email',
      '[name="email"]',
      '[name="username"]',
      '[id*="email"]',
      '[id*="username"]',
      'input[type="email"]',
      'input[type="text"]'
    ];
    await this._fillInput(browser, usernameSelectors, credentials.username);
    await browser.pause(1000);

    const continueSelectors = [
      '#continue',
      '[id*="continue"]',
      '//button[contains(@value,"Continue") or contains(.,"继续")]'
    ];
    await this._clickElement(browser, continueSelectors);

    const passwordSelectors = [
      '#ap_password',
      '#password',
      '[name="password"]',
      '[id*="password"]',
      'input[type="password"]'
    ];
    await this._fillInput(browser, passwordSelectors, credentials.password);
    await browser.pause(1000);

    const submitSelectors = [
      '#signInSubmit',
      '#submit',
      '[id*="submit"]',
      '[id*="login"]',
      '[type="submit"]',
      '//button[contains(@value,"Sign in") or contains(@value,"Login") or contains(.,"登录") or contains(.,"登入")]'
    ];
    await this._clickElement(browser, submitSelectors);

    await this._handleCaptcha(browser, platform);

    if (credentials.otpSecret) {
      const otpSelectors = [
        '#auth-mfa-otpcode',
        '[id*="otp"]',
        '[id*="verification"]',
        '[name*="otp"]',
        '[name*="verification"]',
        'input[maxlength="6"]'
      ];

      for (const sel of otpSelectors) {
        try {
          const el = await browser.$(sel);
          if (await el.isExisting() && await el.isDisplayed()) {
            console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 检测到二次验证(OTP)，请手动输入（等待 30 秒）...`));
            await browser.pause(30000);
            break;
          }
        } catch (err) { /* continue */ }
      }
    }

    await browser.pause(3000);
    const loggedIn = await this._isLoggedIn(browser, platform);

    if (loggedIn) {
      const cookies = await this._collectCookies(browser);
      this.cookieStore.setCookies(platform, cookies);
      console.log(chalk.green(`[${PLATFORM_NAMES[platform]}] 登录成功，会话已保存`));
      return true;
    }

    console.log(chalk.red(`[${PLATFORM_NAMES[platform]}] 登录失败`));
    await globalAlertManager.alertLoginFailure(platform, new Error('登录流程完成但未检测到登录态'));
    return false;
  }

  async ensureLogin(platform, forceRelogin = false) {
    if (!PLATFORMS.includes(platform)) throw new Error(`未知平台: ${platform}`);

    const browser = await this.browserManager.getBrowser(platform);

    if (!forceRelogin) {
      const savedCookies = this.cookieStore.getCookies(platform);
      if (savedCookies) {
        const ordersUrl = getPlatformUrl(platform, 'orders');
        await this._applyCookies(browser, ordersUrl, savedCookies);

        if (await this._isLoggedIn(browser, platform)) {
          const sessionInfo = this.cookieStore.getSessionInfo(platform);
          console.log(chalk.cyan(`[${PLATFORM_NAMES[platform]}] 复用已保存会话（剩余 ${Math.max(0, sessionInfo?.minutesRemaining || 0)} 分钟）`));
          return { browser, loggedIn: true, reused: true };
        }
        console.log(chalk.yellow(`[${PLATFORM_NAMES[platform]}] 保存的会话已失效，重新登录...`));
      }
    }

    const success = await this._doLogin(browser, platform);
    return { browser, loggedIn: success, reused: false };
  }

  async logout(platform) {
    this.cookieStore.clearCookies(platform);
    await this.browserManager.closeBrowser(platform);
  }

  getSessionStatus(platform) {
    return this.cookieStore.getSessionInfo(platform);
  }

  getAllSessionStatus() {
    const status = {};
    for (const p of PLATFORMS) status[p] = this.cookieStore.getSessionInfo(p);
    return status;
  }

  async closeAllBrowsers() {
    await this.ocr.terminate();
    await this.browserManager.closeAll();
  }
}

let authManagerInstance = null;

function getAuthManager() {
  if (!authManagerInstance) authManagerInstance = new AuthManager();
  return authManagerInstance;
}

module.exports = {
  CookieStore,
  CaptchaOCR,
  BrowserManager,
  AuthManager,
  getAuthManager
};
