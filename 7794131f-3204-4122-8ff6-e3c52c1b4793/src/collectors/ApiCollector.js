const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit');
const { logger, verbose } = require('../utils/logger');
const { withRetry, RetryError, ProxyManager } = require('../utils/retry');
const { ensureDir, generateId, businessDate, formatDate } = require('../utils/common');
const { paths, performanceConfig, proxyConfig } = require('../../config/schedule');

class ApiCollector {
  constructor(orgConfig) {
    this.orgConfig = orgConfig;
    this.orgId = orgConfig.id;
    this.orgName = orgConfig.name;
    this.apiConfig = orgConfig.apiConfig || {};
    this.token = null;
    this.tokenExpiresAt = null;
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.concurrencyLimit = pLimit(performanceConfig.maxConcurrentApiRequests);
    const proxyList = orgConfig.proxyList || (proxyConfig && proxyConfig.enabled ? proxyConfig.proxyList : []);
    this.proxyManager = new ProxyManager(proxyList);
    verbose(`[${this.orgId}] 代理配置: ${this.proxyManager.enabled ? this.proxyManager.size + '个节点' : '未启用(直连)'}`);
  }

  _buildSignature(params, timestamp, nonce) {
    const { appKey, appSecret } = this.apiConfig;
    const ordered = Object.keys(params)
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .sort()
      .map((k) => `${k}=${encodeURIComponent(typeof params[k] === 'object' ? JSON.stringify(params[k]) : params[k])}`)
      .join('&');
    const baseString = `${appKey}${timestamp}${nonce}${ordered}${appSecret}`;
    return crypto.createHash('sha256').update(baseString).digest('hex').toUpperCase();
  }

  async _ensureToken() {
    if (this.token && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }
    const authType = this.apiConfig.authType;
    if (authType === 'token') {
      this.token = this.apiConfig.token;
      this.tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    } else if (authType === 'signature') {
      this.token = this.apiConfig.appKey;
      this.tokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
    } else {
      this.token = this.apiConfig.token || '';
      this.tokenExpiresAt = Date.now() + 60 * 60 * 1000;
    }
    verbose(`[${this.orgId}] 获取认证token成功, type=${authType}`);
    return this.token;
  }

  _buildHeaders(extraParams = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Regulator-Collector/1.0',
      'X-Org-Id': this.orgId,
      'X-Request-Id': generateId()
    };
    const authType = this.apiConfig.authType;
    if (authType === 'token' && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (authType === 'signature') {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = generateId();
      const signature = this._buildSignature(extraParams, timestamp, nonce);
      headers['X-App-Key'] = this.apiConfig.appKey;
      headers['X-Timestamp'] = timestamp;
      headers['X-Nonce'] = nonce;
      headers['X-Signature'] = signature;
      headers['X-Sign-Method'] = 'HMAC-SHA256';
    }
    return headers;
  }

  async _rateLimitWait() {
    const rateLimit = this.apiConfig.rateLimit || 100;
    const intervalMs = 60000 / rateLimit;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < intervalMs) {
      const wait = intervalMs - elapsed;
      verbose(`[${this.orgId}] 限流等待 ${wait.toFixed(0)}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async _request(method, endpoint, params = {}, options = {}) {
    const url = `${this.apiConfig.baseUrl}${endpoint}`;
    await this._ensureToken();
    await this._rateLimitWait();
    return this.concurrencyLimit(async () => {
      return withRetry(
        async () => {
          const requestContext = `[${this.orgId}] ${method} ${endpoint}`;
          return this.proxyManager.withProxyRetry(
            async (proxyUrl) => {
              verbose(`[${this.orgId}] API请求 ${method} ${endpoint}${proxyUrl ? ` via代理 ${proxyUrl}` : ' (直连)'}`);
              const headers = this._buildHeaders(params);
              const config = {
                method,
                url,
                headers,
                timeout: options.timeout || 30000,
                params: method === 'GET' ? params : undefined,
                data: method !== 'GET' ? params : undefined,
                validateStatus: (status) => status >= 200 && status < 500
              };
              const axiosProxy = this.proxyManager.toAxiosProxy(proxyUrl);
              if (axiosProxy) {
                config.proxy = axiosProxy;
              }
              const resp = await axios(config);
              if (resp.status === 429) {
                const retryAfter = resp.headers?.['retry-after'];
                const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
                throw Object.assign(new Error('API限流'), {
                  code: 'ERR_RATE_LIMITED',
                  response: resp,
                  isAxiosError: true
                });
              }
              if (resp.status >= 400) {
                throw Object.assign(new Error(`API错误 ${resp.status}: ${resp.statusText}`), {
                  code: `ERR_API_${resp.status}`,
                  response: resp,
                  isAxiosError: resp.status >= 500
                });
              }
              return resp.data;
            },
            { context: requestContext, maxProxySwitches: this.proxyManager.enabled ? proxyConfig.maxProxySwitches : 1 }
          );
        },
        {
          context: `[${this.orgId}] ${method} ${endpoint}`,
          maxRetries: options.maxRetries || performanceConfig.retryStrategy.maxRetries
        }
      );
    });
  }

  async get(endpoint, params = {}, options = {}) {
    return this._request('GET', endpoint, params, options);
  }

  async post(endpoint, data = {}, options = {}) {
    return this._request('POST', endpoint, data, options);
  }

  async _fetchWithPagination(endpoint, params = {}) {
    const pagination = this.apiConfig.pagination || { enabled: false };
    if (!pagination.enabled) {
      return this.get(endpoint, params);
    }
    const pageSize = pagination.pageSize || 1000;
    const allResults = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const pageParams = {
        ...params,
        page,
        pageSize,
        limit: pageSize,
        offset: (page - 1) * pageSize
      };
      const resp = await this.get(endpoint, pageParams);
      const data = this._extractListData(resp);
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allResults.push(...data);
        const total = this._extractTotal(resp);
        if (total && allResults.length >= total) {
          hasMore = false;
        } else if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
          if (page > 100) {
            logger.warn(`[${this.orgId}] ${endpoint} 分页超过100页，停止拉取`);
            hasMore = false;
          }
        }
      }
    }
    verbose(`[${this.orgId}] ${endpoint} 分页拉取完成，共${allResults.length}条记录`);
    return allResults;
  }

  _extractListData(resp) {
    if (Array.isArray(resp)) return resp;
    if (resp?.data && Array.isArray(resp.data)) return resp.data;
    if (resp?.list && Array.isArray(resp.list)) return resp.list;
    if (resp?.items && Array.isArray(resp.items)) return resp.items;
    if (resp?.records && Array.isArray(resp.records)) return resp.records;
    if (resp?.result && Array.isArray(resp.result)) return resp.result;
    if (resp?.payload?.data && Array.isArray(resp.payload.data)) return resp.payload.data;
    return [];
  }

  _extractTotal(resp) {
    if (typeof resp?.total === 'number') return resp.total;
    if (typeof resp?.totalCount === 'number') return resp.totalCount;
    if (typeof resp?.count === 'number') return resp.count;
    if (typeof resp?.data?.total === 'number') return resp.data.total;
    if (typeof resp?.payload?.total === 'number') return resp.payload.total;
    return null;
  }

  async _saveAsJson(data, endpointKey, targetDir) {
    const baseDir = targetDir || path.join(paths.data.raw, this.orgId);
    ensureDir(baseDir);
    const bizDate = businessDate();
    const filename = `${bizDate}_${endpointKey}_${generateId().substring(0, 6)}.json`;
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    const stats = fs.statSync(filePath);
    return {
      filePath,
      filename,
      size: stats.size,
      originalFilename: filename,
      endpointKey,
      orgId: this.orgId,
      orgName: this.orgName,
      source: 'api',
      recordCount: Array.isArray(data) ? data.length : (data?.data?.length || 1),
      collectedAt: new Date().toISOString()
    };
  }

  async collect(options = {}) {
    const startTime = Date.now();
    const endpoints = this.apiConfig.endpoints || {};
    const bizDate = options.businessDate || businessDate();
    const collected = [];
    const errors = [];
    const keys = Object.keys(endpoints);

    for (const key of keys) {
      try {
        const endpoint = endpoints[key];
        verbose(`[${this.orgId}] 拉取接口 ${key}: ${endpoint}`);
        const params = {
          businessDate: bizDate,
          reportDate: bizDate,
          startDate: options.startDate || bizDate,
          endDate: options.endDate || bizDate,
          orgId: this.orgId,
          ...(options.extraParams || {})
        };
        const data = await this._fetchWithPagination(endpoint, params);
        const saved = await this._saveAsJson(data, key, options.targetDir);
        collected.push(saved);
      } catch (err) {
        logger.error(`[${this.orgId}] 接口 ${key} 采集失败: ${err.message}`);
        errors.push({ endpointKey: key, error: err.message, code: err.code });
        if (err instanceof RetryError) {
          throw err;
        }
      }
    }

    if (errors.length > 0 && collected.length === 0) {
      throw new Error(`API采集全部失败: ${errors.map((e) => `${e.endpointKey}:${e.error}`).join('; ')}`);
    }

    return {
      success: collected.length > 0,
      orgId: this.orgId,
      orgName: this.orgName,
      source: 'api',
      files: collected,
      recordCount: collected.reduce((sum, f) => sum + (f.recordCount || 0), 0),
      fileCount: collected.length,
      errors,
      durationMs: Date.now() - startTime,
      collectedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  ApiCollector
};
