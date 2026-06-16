import { remote } from 'webdriverio';
import { getBrowserPoolConfig } from '../config.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('browserPool');

const MEMORY_CHECK_INTERVAL_MS = 30000;
const TOTAL_MEMORY_LIMIT_MB = 1200;
const PER_INSTANCE_MEMORY_LIMIT_MB = 280;

class BrowserInstance {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.browser = null;
    this.inUse = false;
    this.lastUsed = Date.now();
    this.cookies = new Map();
    this.loginStates = new Map();
    this.keepAliveIntervals = new Map();
    this.idleTimer = null;
    this.crashed = false;
    this.lastMemoryMB = 0;
  }

  async init() {
    const opts = {
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1366,768',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-sync',
            '--no-first-run',
            '--disable-default-apps',
            `--max-old-space-size=${this.config.maxMemoryMB || 280}`,
          ],
        },
      },
      logLevel: 'error',
      waitforTimeout: this.config.elementWaitTimeoutMs || 15000,
      connectionRetryCount: 1,
    };

    try {
      this.browser = await remote(opts);
      await this.browser.setWindowSize(1366, 768);
      log.info(`Browser instance #${this.id} initialized`);
      this.crashed = false;
      this._startIdleTimer();
      return true;
    } catch (err) {
      log.error(`Failed to init browser #${this.id}`, { error: err.message });
      this.crashed = true;
      return false;
    }
  }

  _startIdleTimer() {
    this._clearIdleTimer();
    const timeout = this.config.idleTimeoutMs || 300000;
    this.idleTimer = setTimeout(async () => {
      if (!this.inUse) {
        log.info(`Browser #${this.id} idle timeout, recycling`);
        await this.destroy();
      }
    }, timeout);
  }

  _clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  async acquire() {
    if (this.crashed || !this.browser) {
      const ok = await this.init();
      if (!ok) throw new Error(`Browser #${this.id} unavailable after rebuild`);
    }
    this.inUse = true;
    this.lastUsed = Date.now();
    this._clearIdleTimer();
    return this.browser;
  }

  release() {
    this.inUse = false;
    this.lastUsed = Date.now();
    this._startIdleTimer();
  }

  async saveCookies(platform) {
    if (!this.browser) return;
    try {
      const cookies = await this.browser.getAllCookies();
      this.cookies.set(platform, cookies);
      log.debug(`Saved cookies for ${platform} on browser #${this.id}`);
    } catch (err) {
      log.warn(`Failed to save cookies for ${platform}`, { error: err.message });
    }
  }

  async restoreCookies(platform) {
    if (!this.browser || !this.cookies.has(platform)) return;
    try {
      const cookies = this.cookies.get(platform);
      for (const cookie of cookies) {
        await this.browser.setCookies(cookie);
      }
      log.debug(`Restored cookies for ${platform} on browser #${this.id}`);
    } catch (err) {
      log.warn(`Failed to restore cookies for ${platform}`, { error: err.message });
    }
  }

  setLoginState(platform, loggedIn) {
    this.loginStates.set(platform, loggedIn);
  }

  isLoggedIn(platform) {
    return this.loginStates.get(platform) || false;
  }

  startKeepAlive(platform, url, intervalMs) {
    this.stopKeepAlive(platform);
    const timer = setInterval(async () => {
      if (!this.browser || this.crashed) {
        this.stopKeepAlive(platform);
        return;
      }
      try {
        const currentUrl = await this.browser.getUrl();
        const handles = await this.browser.getWindowHandles();
        if (handles.length > 1) {
          const original = handles[0];
          const keepAliveTab = handles[handles.length - 1];
          await this.browser.switchToWindow(keepAliveTab);
          await this.browser.url(url);
          await this.browser.pause(1000);
          await this.browser.switchToWindow(original);
        } else {
          const originalUrl = currentUrl;
          await this.browser.url(url);
          await this.browser.pause(1000);
          await this.browser.url(originalUrl);
        }
        log.debug(`Keep-alive ping for ${platform} on browser #${this.id}`);
      } catch (err) {
        log.warn(`Keep-alive failed for ${platform}`, { error: err.message });
        this.loginStates.set(platform, false);
      }
    }, intervalMs);
    this.keepAliveIntervals.set(platform, timer);
    log.info(`Keep-alive started for ${platform} every ${intervalMs}ms`);
  }

  stopKeepAlive(platform) {
    const timer = this.keepAliveIntervals.get(platform);
    if (timer) {
      clearInterval(timer);
      this.keepAliveIntervals.delete(platform);
      log.info(`Keep-alive stopped for ${platform}`);
    }
  }

  async destroy() {
    this._clearIdleTimer();
    for (const [platform] of this.keepAliveIntervals) {
      this.stopKeepAlive(platform);
    }
    try {
      if (this.browser) {
        await this.browser.deleteSession();
      }
    } catch (err) {
      log.debug(`Error closing browser #${this.id}`, { error: err.message });
    }
    this.browser = null;
    this.crashed = true;
    log.info(`Browser #${this.id} destroyed`);
  }

  async checkHealth() {
    if (!this.browser || this.crashed) return false;
    try {
      await this.browser.getTitle();
      return true;
    } catch {
      this.crashed = true;
      return false;
    }
  }

  async getMemoryUsageMB() {
    if (!this.browser || this.crashed) {
      this.lastMemoryMB = 0;
      return 0;
    }
    try {
      const metrics = await this.browser.executeDevToolsProtocolMethod(
        'Performance.getMetrics',
        {}
      );
      const metricsList = metrics?.metrics || metrics?.result?.metrics || [];
      let jsHeapUsed = 0;
      let jsHeapTotal = 0;
      for (const m of metricsList) {
        if (m.name === 'JSHeapUsedSize') {
          jsHeapUsed = m.value;
        }
        if (m.name === 'JSHeapTotalSize') {
          jsHeapTotal = m.value;
        }
      }
      const memoryMB = Math.max(jsHeapUsed, jsHeapTotal) / (1024 * 1024);
      this.lastMemoryMB = Math.round(memoryMB * 10) / 10;
      log.debug(`Browser #${this.id} memory: ${this.lastMemoryMB} MB`);
      return this.lastMemoryMB;
    } catch (err) {
      log.debug(`Failed to get memory for browser #${this.id} via CDP`, { error: err.message });
      try {
        const mem = await this.browser.execute(() => {
          if (performance && performance.memory) {
            return performance.memory.usedJSHeapSize;
          }
          return 0;
        });
        const memoryMB = mem / (1024 * 1024);
        this.lastMemoryMB = Math.round(memoryMB * 10) / 10;
        return this.lastMemoryMB;
      } catch (innerErr) {
        log.debug(`Failed to get memory for browser #${this.id} via JS API`, { error: innerErr.message });
        return this.lastMemoryMB;
      }
    }
  }
}

class BrowserPool {
  constructor() {
    this.instances = [];
    this.config = getBrowserPoolConfig();
    this.maxSize = this.config.maxInstances || 4;
    this._initPromise = null;
    this._memoryMonitorTimer = null;
    this._totalMemoryMB = 0;
    this._perInstanceMemory = {};
  }

  async initialize(count) {
    const target = Math.min(count || this.maxSize, this.maxSize);
    log.info(`Initializing browser pool with ${target} instances`, {
      totalMemoryLimitMB: TOTAL_MEMORY_LIMIT_MB,
      perInstanceLimitMB: PER_INSTANCE_MEMORY_LIMIT_MB,
    });

    const initPromises = [];
    for (let i = 0; i < target; i++) {
      const instance = new BrowserInstance(i, this.config);
      this.instances.push(instance);
      initPromises.push(instance.init());
    }

    const results = await Promise.allSettled(initPromises);
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    log.info(`Browser pool initialized: ${successCount}/${target} instances ready`);

    if (successCount > 0) {
      this.startMemoryMonitor();
    }

    return successCount;
  }

  async acquire() {
    for (const inst of this.instances) {
      if (!inst.inUse) {
        try {
          await inst.acquire();
          log.debug(`Acquired browser #${inst.id}`);
          return inst;
        } catch (err) {
          log.warn(`Failed to acquire browser #${inst.id}, trying next`, { error: err.message });
          continue;
        }
      }
    }

    const crashedInst = this.instances.find((inst) => inst.crashed);
    if (crashedInst) {
      log.info(`Rebuilding crashed browser #${crashedInst.id}`);
      const ok = await crashedInst.init();
      if (ok) {
        await crashedInst.acquire();
        return crashedInst;
      }
    }

    log.warn('All browser instances in use, waiting...');
    return this._waitForAvailable();
  }

  async _waitForAvailable(maxWaitMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      for (const inst of this.instances) {
        if (!inst.inUse) {
          try {
            await inst.acquire();
            return inst;
          } catch {
            continue;
          }
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timeout waiting for available browser instance');
  }

  release(instance) {
    instance.release();
    log.debug(`Released browser #${instance.id}`);
  }

  async rebuild(instance) {
    log.info(`Rebuilding browser #${instance.id}`);
    await instance.destroy();
    const ok = await instance.init();
    if (!ok) {
      throw new Error(`Failed to rebuild browser #${instance.id}`);
    }
    for (const [platform] of instance.cookies) {
      await instance.restoreCookies(platform);
    }
    log.info(`Browser #${instance.id} rebuilt with cookie restoration`);
    return instance;
  }

  startMemoryMonitor() {
    if (this._memoryMonitorTimer) {
      return;
    }
    log.info('Starting memory monitor', { intervalMs: MEMORY_CHECK_INTERVAL_MS });
    this._memoryMonitorTimer = setInterval(async () => {
      try {
        await this._checkMemoryUsage();
      } catch (err) {
        log.debug('Memory monitor check error', { error: err.message });
      }
    }, MEMORY_CHECK_INTERVAL_MS);
  }

  stopMemoryMonitor() {
    if (this._memoryMonitorTimer) {
      clearInterval(this._memoryMonitorTimer);
      this._memoryMonitorTimer = null;
      log.info('Memory monitor stopped');
    }
  }

  async _checkMemoryUsage() {
    let totalMB = 0;
    const perInstance = {};

    const checkPromises = this.instances.map(async (inst) => {
      if (inst.crashed || !inst.browser) {
        perInstance[inst.id] = 0;
        return;
      }
      try {
        const memMB = await inst.getMemoryUsageMB();
        perInstance[inst.id] = memMB;
        totalMB += memMB;

        if (memMB > PER_INSTANCE_MEMORY_LIMIT_MB) {
          log.warn(`Browser #${inst.id} memory exceeds limit`, {
            instanceId: inst.id,
            memoryMB: memMB,
            limitMB: PER_INSTANCE_MEMORY_LIMIT_MB,
          });
        }
      } catch (err) {
        perInstance[inst.id] = inst.lastMemoryMB;
        totalMB += inst.lastMemoryMB;
        log.debug(`Failed to check memory for browser #${inst.id}`, { error: err.message });
      }
    });

    await Promise.allSettled(checkPromises);

    this._totalMemoryMB = Math.round(totalMB * 10) / 10;
    this._perInstanceMemory = perInstance;

    if (totalMB > TOTAL_MEMORY_LIMIT_MB) {
      log.error('Browser pool total memory exceeds limit', {
        totalMemoryMB: this._totalMemoryMB,
        limitMB: TOTAL_MEMORY_LIMIT_MB,
        perInstance,
      });
    } else {
      log.debug('Browser pool memory check passed', {
        totalMemoryMB: this._totalMemoryMB,
        limitMB: TOTAL_MEMORY_LIMIT_MB,
      });
    }
  }

  getMemoryStats() {
    return {
      totalMemoryMB: this._totalMemoryMB,
      limitMB: TOTAL_MEMORY_LIMIT_MB,
      perInstance: this._perInstanceMemory,
      perInstanceLimitMB: PER_INSTANCE_MEMORY_LIMIT_MB,
    };
  }

  async destroyAll() {
    this.stopMemoryMonitor();
    log.info('Destroying all browser instances');
    await Promise.allSettled(this.instances.map((inst) => inst.destroy()));
    this.instances = [];
    this._totalMemoryMB = 0;
    this._perInstanceMemory = {};
  }

  getStatus() {
    return this.instances.map((inst) => ({
      id: inst.id,
      inUse: inst.inUse,
      crashed: inst.crashed,
      loginStates: Object.fromEntries(inst.loginStates),
      lastUsed: inst.lastUsed,
    }));
  }
}

let _pool = null;

export function getBrowserPool() {
  if (!_pool) {
    _pool = new BrowserPool();
  }
  return _pool;
}

export function resetBrowserPool() {
  _pool = null;
}

export { BrowserInstance, BrowserPool };
