import { chromium, Browser, BrowserContext, Page, BrowserContextOptions } from 'playwright';
import UserAgent from 'user-agents';
import dotenv from 'dotenv';
import axios from 'axios';
import { createLogger } from '../utils/logger';
import type { BrowserFingerprint, PlatformType } from '../../types';

dotenv.config();

const logger = createLogger('antiDetect');

const PLATFORM_BASE_DELAYS: Record<PlatformType, { min: number; max: number }> = {
  amazon: { min: 3000, max: 8000 },
  ebay: { min: 2500, max: 6000 },
  shopee: { min: 2000, max: 5000 },
  lazada: { min: 2000, max: 5000 },
  tiktok: { min: 3000, max: 7000 }
};

const VIEWPORT_SIZES = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1024, height: 768 }
];

const LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.8,en-US;q=0.7',
  'en-US,en;q=0.9,es;q=0.8',
  'en-US,en;q=0.9,zh-CN;q=0.7'
];

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai'
];

const PLUGINS = [
  'Chrome PDF Plugin',
  'Chrome PDF Viewer',
  'Native Client',
  'Widevine Content Decryption Module'
];

const MIME_TYPES = [
  'application/pdf',
  'application/x-google-chrome-pdf',
  'application/x-nacl',
  'application/x-pnacl'
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFingerprint(platform?: PlatformType): BrowserFingerprint {
  const userAgentData = new UserAgent();
  const ua = userAgentData.toString();
  
  let viewport = randomPick(VIEWPORT_SIZES);
  if (platform) {
    const platformWeights: number[] = [1920, 1366, 1440, 1536, 1280, 1600, 1024].map(w => {
      return VIEWPORT_SIZES.findIndex(v => v.width === w);
    }).filter(idx => idx !== -1);
    const idx = randomPick(platformWeights) as number;
    viewport = VIEWPORT_SIZES[idx] || viewport;
  }

  const fingerprint: BrowserFingerprint = {
    userAgent: ua,
    viewport,
    platform: ua.includes('Mac') ? 'MacIntel' : ua.includes('Win') ? 'Win32' : 'Linux x86_64',
    language: randomPick(LANGUAGES),
    timezone: randomPick(TIMEZONES),
    webdriver: false,
    plugins: [...PLUGINS].sort(() => Math.random() - 0.5),
    mimeTypes: [...MIME_TYPES].sort(() => Math.random() - 0.5)
  };

  logger.debug('Generated browser fingerprint', {
    userAgent: fingerprint.userAgent.substring(0, 50) + '...',
    viewport: fingerprint.viewport,
    platform: fingerprint.platform,
    timezone: fingerprint.timezone
  });

  return fingerprint;
}

function getStealthScripts(fingerprint: BrowserFingerprint): string {
  return `
    (function() {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => ${fingerprint.webdriver}
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [${fingerprint.plugins.map(p => `
            {
              name: '${p}',
              filename: 'internal-${p.toLowerCase().replace(/\s+/g, '-')}.so',
              description: '${p}',
              length: 1,
              item: function(i) { return this[i]; },
              namedItem: function(name) { return this[name]; }
            }
          `).join(',')}];
          return Object.assign(plugins, {
            item: function(i) { return this[i]; },
            namedItem: function(name) { return this[name]; }
          });
        }
      });

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const mimeTypes = [${fingerprint.mimeTypes.map(m => `
            {
              type: '${m}',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: { name: 'Chrome PDF Plugin' }
            }
          `).join(',')}];
          return Object.assign(mimeTypes, {
            item: function(i) { return this[i]; },
            namedItem: function(name) { return this[name]; }
          });
        }
      });

      Object.defineProperty(navigator, 'platform', {
        get: () => '${fingerprint.platform}'
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['${fingerprint.language.split(';')[0].split(',')[0]}', '${fingerprint.language.split(';')[0].split(',')[1] || 'en'}']
      });

      Object.defineProperty(navigator, 'language', {
        get: () => '${fingerprint.language.split(';')[0].split(',')[0]}'
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${randomInt(4, 12)}
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => ${randomPick([4, 8, 16, 32])}
      });

      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => ${randomInt(0, 5)}
      });

      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      const tzOffset = ${fingerprint.timezone.includes('America') ? randomInt(240, 480) : 
                          fingerprint.timezone.includes('Europe') ? randomInt(-120, 60) :
                          fingerprint.timezone.includes('Asia') ? randomInt(-540, -360) : 0};
      
      Date.prototype.getTimezoneOffset = function() {
        return tzOffset;
      };

      Intl.DateTimeFormat.prototype.resolvedOptions = new Proxy(Intl.DateTimeFormat.prototype.resolvedOptions, {
        apply: function(target, thisArg, args) {
          const result = Reflect.apply(target, thisArg, args);
          result.timeZone = '${fingerprint.timezone}';
          return result;
        }
      });

      Object.defineProperty(screen, 'width', {
        get: () => ${fingerprint.viewport.width}
      });

      Object.defineProperty(screen, 'height', {
        get: () => ${fingerprint.viewport.height}
      });

      Object.defineProperty(screen, 'availWidth', {
        get: () => ${fingerprint.viewport.width}
      });

      Object.defineProperty(screen, 'availHeight', {
        get: () => ${fingerprint.viewport.height - 40}
      });

      Object.defineProperty(window, 'outerWidth', {
        get: () => ${fingerprint.viewport.width}
      });

      Object.defineProperty(window, 'outerHeight', {
        get: () => ${fingerprint.viewport.height + 120}
      });

      Object.defineProperty(window, 'innerWidth', {
        get: () => ${fingerprint.viewport.width}
      });

      Object.defineProperty(window, 'innerHeight', {
        get: () => ${fingerprint.viewport.height}
      });

      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '${randomPick(['4g', '3g', 'wifi'])}',
          downlink: ${randomInt(5, 50)},
          rtt: ${randomInt(20, 150)}
        })
      });

      if (window.chrome) {
        Object.defineProperty(navigator, 'chrome', {
          get: () => ({
            runtime: {
              id: '${randomPick(['mgndgikekgjfcpckkfioiadnlibdjbkf', 'nmmhkkegccagdldgiimedpiccmgmieda'])}'
            },
            loadTimes: function() { return null; },
            csi: function() { return null; }
          })
        });
      }

      delete window.cdc_adoQpoasnfa76pfcZLmcfl_;
      delete window.cdc_asdjflasutopfhvcZLmcfl_;
      delete window.cdc_;
    })();
  `;
}

function generateMousePath(fromX: number, fromY: number, toX: number, toY: number, steps?: number): { x: number; y: number }[] {
  const numSteps = steps || randomInt(20, 40);
  const path: { x: number; y: number }[] = [];
  
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    
    const wobble = Math.sin(t * Math.PI * randomInt(2, 5)) * randomInt(5, 15);
    
    const x = Math.round(fromX + dx * easeT + (Math.random() - 0.5) * wobble);
    const y = Math.round(fromY + dy * easeT + (Math.random() - 0.5) * wobble);
    
    path.push({ x, y });
  }
  
  return path;
}

class AntiDetectManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private fingerprints: Map<string, BrowserFingerprint> = new Map();
  private lastOperationTime: Map<string, number> = new Map();
  private contextCount = 0;
  private maxContexts: number;

  constructor() {
    this.maxContexts = parseInt(process.env.MAX_BROWSERS_PER_PLATFORM || '3', 10);
  }

  async launchBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const headless = process.env.HEADLESS !== 'false';
    const timeout = parseInt(process.env.BROWSER_TIMEOUT || '30000', 10);

    logger.info('Launching browser', { headless, timeout });
    
    const startTime = Date.now();
    this.browser = await chromium.launch({
      headless,
      timeout,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-features=IsolateOrigins,site-per-process',
        `--window-size=${randomPick(VIEWPORT_SIZES).width},${randomPick(VIEWPORT_SIZES).height}`
      ],
      slowMo: randomInt(50, 150)
    });

    const launchTime = Date.now() - startTime;
    logger.info(`Browser launched in ${launchTime}ms`);

    return this.browser;
  }

  async createContext(platform: PlatformType, cookies?: unknown[]): Promise<{ context: BrowserContext; fingerprint: BrowserFingerprint }> {
    await this.launchBrowser();

    if (this.contextCount >= this.maxContexts * 5) {
      logger.warn('Max context limit reached, cleaning up old contexts');
      await this.cleanupOldContexts();
    }

    const contextId = `${platform}-${Date.now()}-${randomInt(1000, 9999)}`;
    const fingerprint = generateFingerprint(platform);
    
    const contextOptions: BrowserContextOptions = {
      viewport: fingerprint.viewport,
      userAgent: fingerprint.userAgent,
      locale: fingerprint.language.split(';')[0].split(',')[0],
      timezoneId: fingerprint.timezone,
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      permissions: ['notifications', 'geolocation'],
      geolocation: this.getGeolocationForTimezone(fingerprint.timezone),
      extraHTTPHeaders: {
        'Accept-Language': fingerprint.language,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
      }
    };

    if (cookies && cookies.length > 0) {
      contextOptions.storageState = {
        cookies: cookies as Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Strict' | 'Lax' | 'None' }>,
        origins: []
      };
    }

    const context = await this.browser!.newContext(contextOptions);
    
    await context.addInitScript(getStealthScripts(fingerprint));
    
    await context.route('**/*', async (route, request) => {
      const url = request.url();
      
      if (url.includes('google-analytics') || url.includes('doubleclick') || url.includes('facebook.com/tr')) {
        await route.abort();
        return;
      }
      
      const headers = { ...request.headers() };
      delete headers['x-requested-with'];
      delete headers['sec-ch-ua'];
      delete headers['sec-ch-ua-mobile'];
      delete headers['sec-ch-ua-platform'];
      
      await route.continue({ headers });
    });

    this.contexts.set(contextId, context);
    this.fingerprints.set(contextId, fingerprint);
    this.lastOperationTime.set(contextId, Date.now());
    this.contextCount++;

    logger.debug(`Created new context for ${platform}`, { contextId, contexts: this.contextCount });
    
    return { context, fingerprint };
  }

  private getGeolocationForTimezone(timezone: string): { latitude: number; longitude: number; accuracy: number } | undefined {
    const locations: Record<string, { latitude: number; longitude: number }> = {
      'America/New_York': { latitude: 40.7128, longitude: -74.0060 },
      'America/Los_Angeles': { latitude: 34.0522, longitude: -118.2437 },
      'Europe/London': { latitude: 51.5074, longitude: -0.1278 },
      'Europe/Berlin': { latitude: 52.5200, longitude: 13.4050 },
      'Asia/Singapore': { latitude: 1.3521, longitude: 103.8198 },
      'Asia/Tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'Asia/Shanghai': { latitude: 31.2304, longitude: 121.4737 }
    };
    
    const loc = locations[timezone];
    if (loc) {
      return { ...loc, accuracy: randomInt(50, 200) };
    }
    return undefined;
  }

  async smartClick(page: Page, selector: string, options?: { force?: boolean; timeout?: number }): Promise<void> {
    const element = await page.waitForSelector(selector, { 
      state: 'visible', 
      timeout: options?.timeout || 15000 
    });
    
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      await element.click({ force: options?.force });
      return;
    }

    const fromX = randomInt(0, 100);
    const fromY = randomInt(0, 100);
    const toX = box.x + box.width / 2 + randomInt(-Math.floor(box.width / 4), Math.floor(box.width / 4));
    const toY = box.y + box.height / 2 + randomInt(-Math.floor(box.height / 4), Math.floor(box.height / 4));

    const path = generateMousePath(fromX, fromY, toX, toY);
    
    await page.mouse.move(fromX, fromY);
    
    for (const point of path) {
      await page.mouse.move(point.x, point.y, { steps: 1 });
      await page.waitForTimeout(randomInt(5, 20));
    }

    await page.waitForTimeout(randomInt(50, 200));
    await page.mouse.down();
    await page.waitForTimeout(randomInt(50, 150));
    await page.mouse.up();
    
    logger.debug('Performed smart click', { selector, x: toX, y: toY });
  }

  async smartType(page: Page, selector: string, text: string, options?: { delay?: number }): Promise<void> {
    const element = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await this.smartClick(page, selector);
    
    const baseDelay = options?.delay || randomInt(80, 150);
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const delay = baseDelay + randomInt(-20, 50);
      
      await page.keyboard.type(char, { delay: Math.max(10, delay) });
      
      if (i > 0 && i % randomInt(5, 15) === 0) {
        await page.waitForTimeout(randomInt(100, 300));
      }
      
      if (randomInt(0, 100) < 5) {
        const backspaces = randomInt(1, 2);
        for (let j = 0; j < backspaces; j++) {
          await page.keyboard.press('Backspace', { delay: randomInt(50, 100) });
        }
        for (let j = 0; j < backspaces; j++) {
          await page.keyboard.type(text[i - backspaces + j], { delay: randomInt(80, 150) });
        }
      }
    }
    
    logger.debug('Performed smart type', { selector, length: text.length });
  }

  async humanScroll(page: Page, targetY?: number): Promise<void> {
    const currentY = await page.evaluate(() => window.scrollY);
    const maxY = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
    const finalY = targetY ?? randomInt(Math.floor(maxY * 0.3), Math.floor(maxY * 0.9));
    
    const distance = finalY - currentY;
    const steps = Math.abs(distance) > 500 ? randomInt(10, 20) : randomInt(5, 10);
    
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const y = Math.round(currentY + distance * easeProgress);
      
      await page.evaluate((scrollY) => {
        window.scrollTo({ top: scrollY, behavior: 'smooth' });
      }, y);
      
      await page.waitForTimeout(randomInt(50, 150));
    }
    
    logger.debug('Performed human scroll', { from: currentY, to: finalY });
  }

  async humanWait(platform: PlatformType, minMultiplier = 0.5, maxMultiplier = 1.5): Promise<void> {
    const base = PLATFORM_BASE_DELAYS[platform] || PLATFORM_BASE_DELAYS.amazon;
    const delay = randomInt(
      Math.floor(base.min * minMultiplier),
      Math.floor(base.max * maxMultiplier)
    );
    await new Promise(resolve => setTimeout(resolve, delay));
    logger.debug(`Human wait for ${platform}`, { delay });
  }

  async waitBetweenOperations(contextId: string, platform: PlatformType): Promise<void> {
    const lastOp = this.lastOperationTime.get(contextId) || 0;
    const elapsed = Date.now() - lastOp;
    
    const base = PLATFORM_BASE_DELAYS[platform] || PLATFORM_BASE_DELAYS.amazon;
    const requiredDelay = randomInt(base.min, base.max);
    
    if (elapsed < requiredDelay) {
      const waitTime = requiredDelay - elapsed;
      logger.debug(`Waiting between operations`, { platform, waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastOperationTime.set(contextId, Date.now());
  }

  async solveCaptcha(page: Page, type: 'slider' | 'click' | 'text'): Promise<boolean> {
    logger.info(`Attempting to solve ${type} captcha`);
    
    if (type === 'slider') {
      return this.solveSliderCaptcha(page);
    } else if (type === 'click') {
      return this.solveClickCaptcha(page);
    }
    
    const apiKey = process.env.CAPTCHA_API_KEY;
    if (!apiKey) {
      logger.warn('No captcha API key configured, manual intervention required');
      return false;
    }
    
    return this.solveWithApi(page, type, apiKey);
  }

  private async solveSliderCaptcha(page: Page): Promise<boolean> {
    try {
      const sliderHandle = await page.$('div.slider-handle, .captcha-drag, .nc_iconfont.btn_slide, .Slider-Move-Container');
      const sliderTrack = await page.$('div.slider-track, .captcha-progress, .nc_bg, .Slider-Container');
      
      if (!sliderHandle || !sliderTrack) {
        logger.warn('Slider captcha elements not found');
        return false;
      }

      const handleBox = await sliderHandle.boundingBox();
      const trackBox = await sliderTrack.boundingBox();
      
      if (!handleBox || !trackBox) return false;

      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      const endX = trackBox.x + trackBox.width - handleBox.width / 2;
      const endY = startY + randomInt(-5, 5);

      const path = generateMousePath(startX, startY, endX, endY, randomInt(30, 50));

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      for (let i = 0; i < path.length; i++) {
        const point = path[i];
        await page.mouse.move(point.x, point.y, { steps: 1 });
        
        if (i % 5 === 0) {
          await page.waitForTimeout(randomInt(10, 30));
        }
      }

      await page.waitForTimeout(randomInt(200, 500));
      await page.mouse.up();
      
      logger.info('Slider captcha attempted');
      return true;
    } catch (error) {
      logger.error('Failed to solve slider captcha', error);
      return false;
    }
  }

  private async dragSlider(
    page: Page,
    sliderHandle: any,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): Promise<void> {
    const path = generateMousePath(fromX, fromY, toX, toY, randomInt(30, 50));

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();

    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      await page.mouse.move(point.x, point.y, { steps: 1 });
      
      if (i % 5 === 0) {
        await page.waitForTimeout(randomInt(10, 30));
      }
    }

    await page.waitForTimeout(randomInt(200, 500));
    await page.mouse.up();
  }

  private async solveClickCaptcha(page: Page): Promise<boolean> {
    logger.warn('Click captcha requires external API or manual intervention');
    return false;
  }

  private async solveWithApi(page: Page, type: string, apiKey: string): Promise<boolean> {
    const service = process.env.CAPTCHA_SERVICE || '2captcha';
    const baseUrl = service === 'capmonster' 
      ? 'https://api.capmonster.cloud' 
      : 'https://2captcha.com';
    
    logger.info(`Using ${service} API for ${type} captcha`);
    
    try {
      let taskId: string | null = null;
      
      if (type === 'slider' || type === 'click') {
        const captchaEl = await page.$('.captcha-container, .geetest_widget, iframe[src*="captcha"]');
        if (!captchaEl) {
          logger.warn('Captcha element not found for API solving');
          return false;
        }
        
        const screenshot = await captchaEl.screenshot({ type: 'png' });
        const base64Image = screenshot.toString('base64');
        logger.debug(`Captcha screenshot taken, size: ${screenshot.length} bytes`);
        
        taskId = await this.createCaptchaTask(baseUrl, apiKey, type, base64Image);
      } else {
        const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
        const base64Image = screenshot.toString('base64');
        logger.debug(`Captcha screenshot taken, size: ${screenshot.length} bytes`);
        
        taskId = await this.createCaptchaTask(baseUrl, apiKey, type, base64Image);
      }
      
      if (!taskId) {
        logger.warn('Failed to create captcha task');
        return false;
      }
      
      logger.debug(`Captcha task created: ${taskId}`);
      
      const solution = await this.pollForResult(baseUrl, apiKey, taskId);
      if (!solution) {
        logger.warn('Failed to get captcha solution');
        return false;
      }
      
      logger.info(`Captcha solved successfully`);
      
      return await this.applyCaptchaSolution(page, type, solution);
    } catch (error) {
      logger.error('Captcha API solving failed', error);
      return false;
    }
  }

  private async createCaptchaTask(
    baseUrl: string,
    apiKey: string,
    type: string,
    base64Image: string
  ): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('key', apiKey);
      formData.append('method', 'base64');
      formData.append('body', base64Image);
      formData.append('json', '1');
      
      if (type === 'slider') {
        formData.append('recaptcha', '1');
      } else if (type === 'click') {
        formData.append('click', '1');
      }
      
      const response = await axios.post(`${baseUrl}/in.php`, formData, {
        timeout: 30000,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const data = response.data;
      if (data.status === 1) {
        return data.request;
      } else {
        logger.warn(`Captcha API error: ${data.request}`);
        return null;
      }
    } catch (error) {
      logger.error('Failed to create captcha task', error);
      return null;
    }
  }

  private async pollForResult(
    baseUrl: string,
    apiKey: string,
    taskId: string,
    maxAttempts = 60,
    intervalMs = 5000
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
      try {
        const response = await axios.get(`${baseUrl}/res.php`, {
          params: {
            key: apiKey,
            action: 'get',
            id: taskId,
            json: '1'
          },
          timeout: 15000
        });
        
        const data = response.data;
        
        if (data.status === 1) {
          return data.request;
        } else if (data.request === 'CAPCHA_NOT_READY') {
          logger.debug(`Captcha not ready yet, attempt ${attempt}/${maxAttempts}`);
          continue;
        } else {
          logger.warn(`Captcha API error: ${data.request}`);
          return null;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          logger.error('Failed to poll captcha result after max attempts', error);
          return null;
        }
        logger.debug(`Poll attempt ${attempt} failed, retrying...`);
      }
    }
    
    logger.warn(`Captcha solving timed out after ${maxAttempts * intervalMs / 1000}s`);
    return null;
  }

  private async applyCaptchaSolution(
    page: Page,
    type: string,
    solution: string
  ): Promise<boolean> {
    try {
      if (type === 'text') {
        const inputSelector = 'input[type="text"][name*="captcha"], input[name*="captcha"], input[name*="verify"]';
        const inputEl = await page.$(inputSelector);
        if (inputEl) {
          await inputEl.fill(solution);
          const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
          if (submitBtn) {
            await this.smartClick(page, 'button[type="submit"], input[type="submit"]');
          }
          await page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => {});
          return true;
        }
      } else if (type === 'slider') {
        const sliderHandle = await page.$('div.slider-handle, .captcha-drag, .nc_iconfont.btn_slide, .Slider-Move-Container');
        if (sliderHandle && solution.includes('|')) {
          const [x, y] = solution.split('|').map(Number);
          const handleBB = await sliderHandle.boundingBox();
          if (handleBB) {
            await this.dragSlider(page, sliderHandle, handleBB.x, handleBB.y, handleBB.x + x, handleBB.y);
            return true;
          }
        }
      } else if (type === 'click') {
        const points = solution.split(';').map(p => {
          const [x, y] = p.split(',').map(Number);
          return { x, y };
        });
        
        const captchaArea = await page.$('.captcha-container, .geetest_widget');
        if (captchaArea) {
          const areaBB = await captchaArea.boundingBox();
          if (areaBB) {
            for (const point of points) {
              await page.mouse.click(areaBB.x + point.x, areaBB.y + point.y);
              await new Promise(r => setTimeout(r, 300));
            }
            const confirmBtn = await page.$('button:has-text("Confirm"), button:has-text("Submit"), .geetest_commit');
            if (confirmBtn) {
              await this.smartClick(page, 'button:has-text("Confirm"), button:has-text("Submit"), .geetest_commit');
            }
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to apply captcha solution', error);
      return false;
    }
  }

  async takeScreenshot(page: Page, name: string): Promise<string> {
    const reportsDir = process.env.LOG_DIR || './logs';
    const filename = `${name}-${Date.now()}.png`;
    const filepath = `${reportsDir}/screenshots/${filename}`;
    
    const fs = await import('fs');
    const path = await import('path');
    
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ path: filepath, fullPage: true });
    logger.info(`Screenshot saved: ${filepath}`);
    
    return filepath;
  }

  private async cleanupOldContexts(): Promise<void> {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    
    for (const [id, context] of this.contexts) {
      const lastOp = this.lastOperationTime.get(id) || 0;
      if (now - lastOp > maxAge) {
        logger.debug(`Cleaning up old context: ${id}`);
        await context.close();
        this.contexts.delete(id);
        this.fingerprints.delete(id);
        this.lastOperationTime.delete(id);
        this.contextCount--;
      }
    }
  }

  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      await context.close();
      this.contexts.delete(contextId);
      this.fingerprints.delete(contextId);
      this.lastOperationTime.delete(contextId);
      this.contextCount--;
      logger.debug(`Context closed: ${contextId}, remaining: ${this.contextCount}`);
    }
  }

  async closeAll(): Promise<void> {
    for (const [id, context] of this.contexts) {
      try {
        await context.close();
      } catch (e) {
        logger.warn(`Error closing context ${id}`, e);
      }
    }
    this.contexts.clear();
    this.fingerprints.clear();
    this.lastOperationTime.clear();
    this.contextCount = 0;
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('All anti-detect resources closed');
  }

  getContextCount(): number {
    return this.contextCount;
  }

  getFingerprint(contextId: string): BrowserFingerprint | undefined {
    return this.fingerprints.get(contextId);
  }
}

export const antiDetect = new AntiDetectManager();

export default AntiDetectManager;
