import { remote } from 'webdriverio';
import * as dotenv from 'dotenv';
import { randomInt, randomFloat, sleep } from '../utils/helpers';
import logger from '../utils/logger';

dotenv.config();

export interface BrowserInstance {
  id: string;
  driver: WebdriverIO.Browser;
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
        await instance.driver.deleteSession();
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

    const args: string[] = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--user-agent=${userAgent}`,
      `--window-size=${windowSize.width},${windowSize.height}`,
      `--lang=${language.split(',')[0]}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ];

    if (this.headless) {
      args.push('--headless=new');
    }

    const driver = await remote({
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args,
          excludeSwitches: ['enable-automation'],
          prefs: {
            'useAutomationExtension': false,
            'profile.default_content_setting_values.notifications': 2,
            'profile.managed_default_content_settings.images': 1,
            'intl.accept_languages': language,
          },
        },
        timeouts: {
          pageLoad: this.pageLoadTimeout,
          script: this.scriptTimeout,
          implicit: 5000,
        },
      },
      logLevel: 'silent',
    });

    await driver.setTimeout({
      pageLoad: this.pageLoadTimeout,
      script: this.scriptTimeout,
      implicit: 5000,
    });

    await driver.execute(`
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

    await this.injectWebGLSpoof(driver);

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

  public async humanType(driver: WebdriverIO.Browser, element: WebdriverIO.Element, text: string): Promise<void> {
    for (const char of text) {
      await element.addValue(char);
      await sleep(randomInt(30, 150));
    }
  }

  public async humanClick(driver: WebdriverIO.Browser, element: WebdriverIO.Element): Promise<void> {
    const location = await element.getLocation();
    const size = await element.getSize();
    
    const targetX = Math.floor(location.x + size.width / 2 + randomInt(-10, 10));
    const targetY = Math.floor(location.y + size.height / 2 + randomInt(-10, 10));
    
    await this.moveMouseBezier(driver, targetX, targetY);
    await sleep(randomInt(100, 300));
    
    await driver.action('pointer')
      .move({ x: targetX, y: targetY, duration: 0 })
      .pause(randomInt(50, 150))
      .down({ button: 0 })
      .pause(randomInt(20, 50))
      .up({ button: 0 })
      .perform();
  }

  private async moveMouseBezier(driver: WebdriverIO.Browser, targetX: number, targetY: number): Promise<void> {
    const startPos = await this.getMousePosition(driver);
    const startX = startPos.x;
    const startY = startPos.y;
    
    const cp1x = startX + (targetX - startX) * 0.3 + randomInt(-50, 50);
    const cp1y = startY + (targetY - startY) * 0.1 + randomInt(-30, 30);
    const cp2x = startX + (targetX - startX) * 0.7 + randomInt(-50, 50);
    const cp2y = startY + (targetY - startY) * 0.9 + randomInt(-30, 30);
    
    const steps = 20 + randomInt(0, 10);
    
    const action = driver.action('pointer');
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.floor(
        Math.pow(1 - t, 3) * startX +
        3 * Math.pow(1 - t, 2) * t * cp1x +
        3 * (1 - t) * Math.pow(t, 2) * cp2x +
        Math.pow(t, 3) * targetX
      );
      const y = Math.floor(
        Math.pow(1 - t, 3) * startY +
        3 * Math.pow(1 - t, 2) * t * cp1y +
        3 * (1 - t) * Math.pow(t, 2) * cp2y +
        Math.pow(t, 3) * targetY
      );
      
      action.move({ x, y, duration: randomInt(5, 15) });
    }
    
    await action.perform();
  }

  private async getMousePosition(driver: WebdriverIO.Browser): Promise<{ x: number; y: number }> {
    try {
      const pos = await driver.execute(`
        if (window.__mousePos) {
          return window.__mousePos;
        }
        return { x: 0, y: 0 };
      `) as { x: number; y: number };
      return pos;
    } catch {
      return { x: 0, y: 0 };
    }
  }

  private async injectWebGLSpoof(driver: WebdriverIO.Browser): Promise<void> {
    const glVendorList = [
      'Google Inc. (Intel)',
      'Intel Inc.',
      'NVIDIA Corporation',
      'AMD',
      'Intel Open Source Technology Center',
    ];
    const glRendererList = [
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon Pro 5500M Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ];
    const extensions = [
      'ANGLE_instanced_arrays',
      'EXT_blend_minmax',
      'EXT_color_buffer_half_float',
      'EXT_disjoint_timer_query',
      'EXT_float_blend',
      'EXT_frag_depth',
      'EXT_shader_texture_lod',
      'EXT_texture_compression_rgtc',
      'EXT_texture_filter_anisotropic',
      'WEBKIT_EXT_texture_filter_anisotropic',
      'EXT_sRGB',
      'KHR_parallel_shader_compile',
      'OES_element_index_uint',
      'OES_fbo_render_mipmap',
      'OES_standard_derivatives',
      'OES_texture_float',
      'OES_texture_float_linear',
      'OES_texture_half_float',
      'OES_texture_half_float_linear',
      'OES_vertex_array_object',
      'WEBGL_color_buffer_float',
      'WEBGL_compressed_texture_s3tc',
      'WEBKIT_WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_s3tc_srgb',
      'WEBGL_debug_renderer_info',
      'WEBGL_debug_shaders',
      'WEBGL_depth_texture',
      'WEBKIT_WEBGL_depth_texture',
      'WEBGL_draw_buffers',
      'WEBGL_lose_context',
      'WEBKIT_WEBGL_lose_context',
      'WEBGL_multi_draw',
    ];

    const randomVendor = glVendorList[randomInt(0, glVendorList.length - 1)];
    const randomRenderer = glRendererList[randomInt(0, glRendererList.length - 1)];
    
    const numExtensions = randomInt(20, extensions.length);
    const shuffled = [...extensions].sort(() => 0.5 - Math.random());
    const randomExtensions = JSON.stringify(shuffled.slice(0, numExtensions));

    await driver.execute(`
      (function() {
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
        const originalGetExtension = WebGLRenderingContext.prototype.getExtension;

        const SPOOF_VENDOR = '${randomVendor}';
        const SPOOF_RENDERER = '${randomRenderer}';
        const SPOOF_EXTENSIONS = ${randomExtensions};

        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) {
            return SPOOF_VENDOR;
          }
          if (param === 37446) {
            return SPOOF_RENDERER;
          }
          if (param === 7936) {
            return SPOOF_VENDOR;
          }
          if (param === 7937) {
            return SPOOF_RENDERER;
          }
          return originalGetParameter.apply(this, arguments);
        };

        WebGLRenderingContext.prototype.getSupportedExtensions = function() {
          return SPOOF_EXTENSIONS.slice();
        };

        WebGLRenderingContext.prototype.getExtension = function(name) {
          if (SPOOF_EXTENSIONS.indexOf(name) === -1) {
            return null;
          }
          return originalGetExtension.apply(this, arguments);
        };

        if (typeof WebGL2RenderingContext !== 'undefined') {
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 37445) {
              return SPOOF_VENDOR;
            }
            if (param === 37446) {
              return SPOOF_RENDERER;
            }
            if (param === 7936) {
              return SPOOF_VENDOR;
            }
            if (param === 7937) {
              return SPOOF_RENDERER;
            }
            return WebGLRenderingContext.prototype.getParameter.apply(this, arguments);
          };
          WebGL2RenderingContext.prototype.getSupportedExtensions = function() {
            return SPOOF_EXTENSIONS.slice();
          };
        }
      })();
    `);
  }

  public async randomScroll(driver: WebdriverIO.Browser): Promise<void> {
    const scrollDistance = randomInt(100, 500);
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    await driver.execute(`
      window.scrollBy(0, ${scrollDistance * direction});
    `);
    
    await sleep(randomInt(500, 2000));
  }

  public async waitForHuman(driver: WebdriverIO.Browser, minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    await sleep(randomInt(minMs, maxMs));
  }

  public getInstanceById(instanceId: string): BrowserInstance | undefined {
    return this.instances.get(instanceId);
  }
}

export default BrowserManager;
