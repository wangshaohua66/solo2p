const { delay } = require('./common');
const { logger } = require('./logger');
const { performanceConfig } = require('../../config/schedule');

const RetryError = class extends Error {
  constructor(message, { code, cause, attempt, maxRetries }) {
    super(message);
    this.name = 'RetryError';
    this.code = code;
    this.cause = cause;
    this.attempt = attempt;
    this.maxRetries = maxRetries;
  }
};

const isRetryableError = (error) => {
  if (!error) return false;
  const retryableCodes = [
    'ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'ETIMEDOUT',
    'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN',
    'NETWORK_ERROR', 'ERR_NETWORK', 'ECONNABORTED'
  ];
  if (retryableCodes.includes(error.code)) return true;
  if (error.isAxiosError) {
    const status = error.response?.status;
    if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  }
  if (error.statusCode && [408, 429, 500, 502, 503, 504].includes(error.statusCode)) return true;
  return false;
};

const getRetryAfterSeconds = (error) => {
  if (error?.response?.headers) {
    const retryAfter = error.response.headers['retry-after'];
    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed * 1000;
    }
  }
  return null;
};

const withRetry = async (
  fn,
  {
    maxRetries = performanceConfig.retryStrategy.maxRetries,
    delays = performanceConfig.retryStrategy.delays,
    onRetry,
    onError,
    shouldRetry = isRetryableError,
    context = ''
  } = {}
) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      if (attempt > 0 && onRetry) {
        onRetry({ attempt, success: true, context });
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !shouldRetry(error)) {
        if (onError) {
          onError({ error, attempt, maxRetries, context });
        }
        throw new RetryError(
          `${context ? context + ': ' : ''}操作失败，已重试${attempt}次: ${error.message}`,
          {
            code: error.code || 'UNKNOWN_ERROR',
            cause: error,
            attempt,
            maxRetries
          }
        );
      }
      let delayMs = delays[attempt] || delays[delays.length - 1];
      const retryAfter = getRetryAfterSeconds(error);
      if (retryAfter) {
        delayMs = Math.max(delayMs, retryAfter);
        logger.warn(`${context || '任务'}被限流，按Retry-After头等待${(delayMs / 1000).toFixed(0)}秒后重试(${attempt + 1}/${maxRetries})`);
      } else {
        logger.warn(`${context || '任务'}失败，${(delayMs / 1000).toFixed(0)}秒后重试(${attempt + 1}/${maxRetries})，原因: ${error.message}`);
      }
      if (onRetry) {
        onRetry({ attempt, success: false, error, delayMs, context });
      }
      await delay(delayMs);
    }
  }
  throw lastError;
};

class RetryQueue {
  constructor(options = {}) {
    this.failedItems = [];
    this.maxRetries = options.maxRetries || 3;
    this.storagePath = options.storagePath || null;
  }

  add(item) {
    const queueItem = {
      ...item,
      retries: item.retries || 0,
      firstFailedAt: item.firstFailedAt || new Date().toISOString(),
      lastFailedAt: new Date().toISOString()
    };
    this.failedItems.push(queueItem);
    this._persist();
    return queueItem;
  }

  getItems() {
    return [...this.failedItems];
  }

  getRetryableItems() {
    return this.failedItems.filter((item) => (item.retries || 0) < this.maxRetries);
  }

  remove(id) {
    this.failedItems = this.failedItems.filter((item) => item.id !== id);
    this._persist();
  }

  clear() {
    this.failedItems = [];
    this._persist();
  }

  incrementRetry(id) {
    const item = this.failedItems.find((it) => it.id === id);
    if (item) {
      item.retries = (item.retries || 0) + 1;
      item.lastFailedAt = new Date().toISOString();
      this._persist();
    }
    return item;
  }

  _persist() {
    if (this.storagePath) {
      try {
        const fs = require('fs');
        const { ensureDir } = require('./common');
        const path = require('path');
        ensureDir(path.dirname(this.storagePath));
        fs.writeFileSync(this.storagePath, JSON.stringify(this.failedItems, null, 2));
      } catch (e) {
        logger.error(`持久化失败队列出错: ${e.message}`);
      }
    }
  }

  load() {
    if (this.storagePath) {
      try {
        const fs = require('fs');
        if (fs.existsSync(this.storagePath)) {
          const data = fs.readFileSync(this.storagePath, 'utf8');
          this.failedItems = JSON.parse(data || '[]');
        }
      } catch (e) {
        logger.error(`加载失败队列出错: ${e.message}`);
        this.failedItems = [];
      }
    }
  }
}

class ProxyManager {
  constructor(proxyList = []) {
    this.proxyList = (Array.isArray(proxyList) ? proxyList : []).filter(Boolean);
    this.currentIndex = 0;
    this.failureCounts = new Map();
    this.rotationCount = 0;
  }

  get enabled() {
    return this.proxyList.length > 0;
  }

  get size() {
    return this.proxyList.length;
  }

  current() {
    return this.enabled ? this.proxyList[this.currentIndex] : null;
  }

  rotate() {
    if (!this.enabled) return null;
    this.currentIndex = (this.currentIndex + 1) % this.proxyList.length;
    this.rotationCount++;
    return this.current();
  }

  getFailureCount(proxyUrl) {
    return this.failureCounts.get(proxyUrl) || 0;
  }

  toAxiosProxy(proxyUrl) {
    if (!proxyUrl) return undefined;
    try {
      const u = new URL(proxyUrl);
      const cfg = { host: u.hostname, port: parseInt(u.port, 10) || 8080 };
      const proto = u.protocol.replace(':', '');
      if (['http', 'https', 'socks5', 'socks5h', 'socks4', 'socks4a'].includes(proto)) {
        cfg.protocol = proto;
      }
      if (u.username) {
        cfg.auth = {
          username: decodeURIComponent(u.username),
          password: decodeURIComponent(u.password || '')
        };
      }
      return cfg;
    } catch (e) {
      logger.warn(`解析代理地址失败: ${proxyUrl}, ${e.message}`);
      return undefined;
    }
  }

  isNetworkError(err) {
    if (!err) return false;
    const code = err.code || '';
    const networkCodes = [
      'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT',
      'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH',
      'EPIPE', 'ESOCKETTIMEDOUT', 'ERR_PROXY_CONNECTION_FAILED',
      'ERR_NETWORK'
    ];
    if (networkCodes.includes(code)) return true;
    if (err.isAxiosError && err.message && /network|timeout|proxy|socket|ECONN/gi.test(err.message)) return true;
    return false;
  }

  async withProxyRetry(fn, { context = '', maxProxySwitches } = {}) {
    const totalAttempts = maxProxySwitches || this.proxyList.length || 1;
    let lastError;
    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      const proxy = this.enabled ? this.current() : null;
      try {
        return await fn(proxy);
      } catch (err) {
        lastError = err;
        if (!this.isNetworkError(err)) {
          throw err;
        }
        const failedProxy = proxy || '直连';
        this.failureCounts.set(failedProxy, (this.failureCounts.get(failedProxy) || 0) + 1);
        logger.warn(`代理切换重试 [${context || '请求'}] 第${attempt + 1}/${totalAttempts}次: 节点[${failedProxy}]网络异常(${err.code || err.message})，切换下一代理`);
        if (this.enabled) this.rotate();
      }
    }
    throw lastError;
  }
}

module.exports = {
  withRetry,
  RetryQueue,
  RetryError,
  isRetryableError,
  getRetryAfterSeconds,
  ProxyManager
};
