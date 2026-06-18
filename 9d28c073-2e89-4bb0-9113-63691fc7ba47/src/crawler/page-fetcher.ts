import { chromium, Browser, BrowserContext, Page, Request, Response } from 'playwright';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import { sleep, randomInt, exponentialBackoff, withTimeout } from '../utils/helpers';
import { SiteConfig } from '../types';

export interface FetchResult {
  success: boolean;
  url: string;
  html?: string;
  title?: string;
  status?: number;
  error?: string;
  captchaDetected?: boolean;
  screenshotPath?: string;
  duration: number;
}

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

export class PageFetcher {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private siteConfig: SiteConfig;
  private requestCount: number = 0;
  private captchaSites: Set<string> = new Set();

  constructor(siteConfig: SiteConfig) {
    this.siteConfig = siteConfig;
  }

  async init(): Promise<void> {
    const siteLogger = logger.getLogger(this.siteConfig.id);
    siteLogger.info('Initializing browser context');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1366,768'
      ]
    });

    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1366, height: 768 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    this.context.setDefaultTimeout(this.siteConfig.crawlStrategy.timeout);

    this.page = await this.context.newPage();

    await this.injectStealthScripts();

    await this.setupRequestInterception();

    siteLogger.info('Browser context initialized');
  }

  private async injectStealthScripts(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);

      (window as any).chrome = {
        runtime: {}
      };
    });
  }

  private async setupRequestInterception(): Promise<void> {
    if (!this.page) return;

    await this.page.route('**/*', (route: Request | any) => {
      const request = route.request ? route.request() : route;
      const url = request.url();
      const resourceType = request.resourceType();

      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        if (Math.random() < 0.7) {
          route.abort ? route.abort() : route.abort('blockedbyclient');
          return;
        }
      }

      if (url.includes('captcha') || url.includes('verify') || url.includes('checkcode')) {
        logger.getLogger(this.siteConfig.id).debug('Captcha-related request detected', { url });
      }

      route.continue ? route.continue() : (route as any).continue();
    });
  }

  async fetch(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    const siteLogger = logger.getLogger(this.siteConfig.id);

    if (!this.page || !this.browser) {
      await this.init();
    }

    if (this.captchaSites.has(this.siteConfig.id)) {
      return {
        success: false,
        url,
        error: 'Site requires manual captcha handling',
        captchaDetected: true,
        duration: Date.now() - startTime
      };
    }

    const maxRetries = this.siteConfig.crawlStrategy.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = exponentialBackoff(attempt - 1, 2000);
          siteLogger.warn(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, { url });
          await sleep(delay);
        }

        const result = await withTimeout(
          this.doFetch(url),
          this.siteConfig.crawlStrategy.timeout + 5000,
          `Page fetch timed out after ${this.siteConfig.crawlStrategy.timeout}ms`
        );

        if (result.captchaDetected) {
          siteLogger.warn('Captcha detected, marking site for manual review', { url });
          this.captchaSites.add(this.siteConfig.id);
          return result;
        }

        if (result.success) {
          this.requestCount++;
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
      } catch (err) {
        lastError = err as Error;
        siteLogger.error(`Fetch attempt ${attempt + 1} failed: ${(err as Error).message}`, { url });
      }
    }

    const screenshotPath = await this.takeScreenshot('error');
    siteLogger.error(`All ${maxRetries + 1} fetch attempts failed`, { url, screenshotPath });

    return {
      success: false,
      url,
      error: lastError?.message,
      duration: Date.now() - startTime
    };
  }

  private async doFetch(url: string): Promise<FetchResult> {
    const startTime = Date.now();
    const siteLogger = logger.getLogger(this.siteConfig.id);

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const delay = randomInt(
      this.siteConfig.crawlStrategy.requestIntervalMin * 1000,
      this.siteConfig.crawlStrategy.requestIntervalMax * 1000
    );
    if (this.requestCount > 0) {
      siteLogger.debug(`Waiting ${delay}ms before next request`);
      await sleep(delay);
    }

    const response = await this.page.goto(url, {
      waitUntil: this.siteConfig.crawlStrategy.dynamicLoading ? 'networkidle' : 'domcontentloaded',
      timeout: this.siteConfig.crawlStrategy.timeout
    });

    if (this.siteConfig.crawlStrategy.dynamicLoading) {
      await sleep(2000);
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }

    const captchaDetected = await this.detectCaptcha();

    if (captchaDetected) {
      const screenshotPath = await this.takeScreenshot('captcha');
      return {
        success: false,
        url,
        captchaDetected: true,
        screenshotPath,
        duration: Date.now() - startTime
      };
    }

    const html = await this.page.content();
    const title = await this.page.title();
    const status = response?.status();

    if (status && status >= 400) {
      return {
        success: false,
        url,
        status,
        error: `HTTP ${status}`,
        duration: Date.now() - startTime
      };
    }

    siteLogger.debug('Page fetched successfully', { url, status, duration: Date.now() - startTime });

    return {
      success: true,
      url,
      html,
      title,
      status,
      duration: Date.now() - startTime
    };
  }

  private async detectCaptcha(): Promise<boolean> {
    if (!this.page) return false;

    const captchaIndicators = [
      'img[src*="captcha"]',
      'img[src*="verify"]',
      'img[src*="checkcode"]',
      'img[src*="ValidateCode"]',
      '#captcha',
      '.captcha',
      '#verify',
      '.verify',
      '.slider-captcha',
      '.geetest',
      '.tcaptcha'
    ];

    for (const selector of captchaIndicators) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const box = await element.boundingBox();
          if (box && box.width > 20 && box.height > 20) {
            return true;
          }
        }
      } catch {
        // ignore
      }
    }

    const pageTitle = await this.page.title().catch(() => '');
    if (/验证码|验证|captcha/i.test(pageTitle)) {
      return true;
    }

    return false;
  }

  async trySolveSliderCaptcha(): Promise<boolean> {
    if (!this.page) return false;

    const siteLogger = logger.getLogger(this.siteConfig.id);
    siteLogger.info('Attempting to solve slider captcha');

    const sliderSelectors = [
      '.slider-btn',
      '.slide-btn',
      '.captcha-slider-btn',
      '.geetest_slider_button',
      '#sliderBtn',
      '.btn_slide'
    ];

    for (const selector of sliderSelectors) {
      try {
        const slider = await this.page.$(selector);
        if (slider) {
          const sliderBox = await slider.boundingBox();
          const trackSelector = selector.replace(/btn|button/i, 'track');
          const track = await this.page.$(trackSelector).catch(() => null);
          const trackBox = track ? await track.boundingBox() : null;

          if (sliderBox) {
            const distance = trackBox ? trackBox.width - sliderBox.width : 200;

            await slider.hover();
            await this.page.mouse.down();

            const steps = 20 + Math.floor(Math.random() * 10);
            for (let i = 0; i < steps; i++) {
              const xOffset = (distance / steps) * (i + 1) * (0.95 + Math.random() * 0.1);
              const yOffset = Math.sin(i * 0.5) * 2;
              await this.page.mouse.move(
                sliderBox.x + sliderBox.width / 2 + xOffset,
                sliderBox.y + sliderBox.height / 2 + yOffset
              );
              await sleep(10 + Math.random() * 20);
            }

            await this.page.mouse.up();
            await sleep(1500);

            const stillHasCaptcha = await this.detectCaptcha();
            if (!stillHasCaptcha) {
              siteLogger.info('Slider captcha solved successfully');
              return true;
            }
          }
        }
      } catch (err) {
        siteLogger.debug(`Slider attempt failed for ${selector}: ${(err as Error).message}`);
      }
    }

    siteLogger.warn('Failed to solve slider captcha');
    return false;
  }

  async takeScreenshot(type: 'error' | 'captcha' | 'debug'): Promise<string> {
    if (!this.page) return '';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.siteConfig.id}-${type}-${timestamp}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    try {
      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.getLogger(this.siteConfig.id).debug(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (err) {
      logger.getLogger(this.siteConfig.id).error(`Failed to take screenshot: ${(err as Error).message}`);
      return '';
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.init();
    }
    return this.page!;
  }

  async resetCaptchaStatus(): Promise<void> {
    this.captchaSites.delete(this.siteConfig.id);
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  async close(): Promise<void> {
    const siteLogger = logger.getLogger(this.siteConfig.id);
    siteLogger.info(`Closing browser, total requests: ${this.requestCount}`);

    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.page = null;
  }
}

export default PageFetcher;
