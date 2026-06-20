'use strict';

const vault = require('node-vault');
const { pLimit, retry, isRetryableError, getHttpStatus, AppError, ERROR_CODES, toAppError } = require('./util');

const MAX_CONCURRENCY = 10;

class VaultClient {
  constructor(profile) {
    this.profile = profile;
    this.cfg = (profile && profile.vault) || {};
    this.mount = this.cfg.mount || 'secret';
    this.kvVersion = Number(this.cfg.kvVersion || 2);
    this.endpoint = this.cfg.endpoint || '';
    this.namespace = this.cfg.namespace || '';
    this._limit = pLimit(MAX_CONCURRENCY);
    this.client = vault({
      apiVersion: 'v1',
      endpoint: this.endpoint,
      token: (this.cfg.auth && this.cfg.auth.token) || ''
    });
    if (this.namespace) {
      this.client.headers = this.client.headers || {};
      this.client.headers['X-Vault-Namespace'] = this.namespace;
    }
  }

  async login() {
    const auth = this.cfg.auth || {};
    if (auth.method === 'token') {
      if (!auth.token) throw toAppError(new Error('Vault token is empty'), ERROR_CODES.VAULT_AUTH_FAILED);
      this.client.token = auth.token;
      return true;
    }
    if (auth.method === 'approle') {
      const res = await this._call(() => this.client.approleLogin({
        role_id: auth.roleId,
        secret_id: auth.secretId
      }), 'approleLogin');
      this.client.token = res.auth.client_token;
      return true;
    }
    throw toAppError(new Error(`Unsupported auth method: ${auth.method}`), ERROR_CODES.VAULT_AUTH_FAILED);
  }

  async _call(fn, label) {
    return retry(fn, {
      retries: 3,
      baseDelay: 400,
      onRetry: (err, attempt, delay) => {
        const status = getHttpStatus(err);
        if (status === 429) {
          err.rateLimited = true;
        }
        if (!process.env.SC_QUIET_RETRY) {
          process.stderr.write(`[retry] ${label} attempt ${attempt} failed (status=${status}, code=${err && err.code}); waiting ${Math.round(delay)}ms\n`);
        }
      }
    });
  }

  _wrapNodeVaultError(err, label) {
    const status = getHttpStatus(err);
    if (status === 429) return toAppError(err, ERROR_CODES.VAULT_RATE_LIMITED);
    if (status === 403 || status === 401) return toAppError(err, ERROR_CODES.VAULT_AUTH_FAILED);
    if (status === 404) return toAppError(err, ERROR_CODES.VAULT_NOT_FOUND);
    if (status === 0 || (err && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code))) {
      return toAppError(err, ERROR_CODES.VAULT_UNREACHABLE);
    }
    return toAppError(err, ERROR_CODES.VAULT_UNREACHABLE);
  }

  _dataPath(logicalPath) {
    const p = logicalPath.replace(/^\/+/, '');
    if (this.kvVersion === 2) return `${this.mount}/data/${p}`;
    return `${this.mount}/${p}`;
  }

  _metaPath(logicalPath) {
    const p = logicalPath.replace(/^\/+/, '');
    if (this.kvVersion === 2) return `${this.mount}/metadata/${p}`;
    return `${this.mount}/${p}`;
  }

  async status() {
    try {
      const res = await this._call(() => this.client.healthStatus(), 'health');
      return { reachable: true, initialized: !!(res && res.initialized), sealed: !!(res && res.sealed), version: res && res.version };
    } catch (err) {
      if (err && err.response && err.response.statusCode === 429) {
        return { reachable: true, sealed: false, standby: true };
      }
      throw this._wrapNodeVaultError(err, 'status');
    }
  }

  async listKeys(logicalPath) {
    const path = this._metaPath(logicalPath || '');
    try {
      const res = await this._call(() => this.client.list(path), `list:${path}`);
      return (res && res.data && res.data.keys) || [];
    } catch (err) {
      const status = getHttpStatus(err);
      if (status === 404) return [];
      throw this._wrapNodeVaultError(err, `list:${path}`);
    }
  }

  async readSecret(logicalPath) {
    const path = this._dataPath(logicalPath);
    try {
      const res = await this._call(() => this.client.read(path), `read:${path}`);
      if (this.kvVersion === 2) {
        return {
          data: (res && res.data && res.data.data) || {},
          metadata: (res && res.data && res.data.metadata) || {},
          path: logicalPath
        };
      }
      return { data: (res && res.data) || {}, metadata: {}, path: logicalPath };
    } catch (err) {
      throw this._wrapNodeVaultError(err, `read:${path}`);
    }
  }

  async writeSecret(logicalPath, data, options) {
    const path = this._dataPath(logicalPath);
    const opts = options || {};
    try {
      let body;
      if (this.kvVersion === 2) {
        body = { data, options: { cas: opts.cas !== undefined ? opts.cas : 0 } };
      } else {
        body = data;
      }
      await this._call(() => this.client.write(path, body), `write:${path}`);
      return { path: logicalPath, written: true };
    } catch (err) {
      throw this._wrapNodeVaultError(err, `write:${path}`);
    }
  }

  async deleteSecret(logicalPath) {
    const path = this._metaPath(logicalPath);
    try {
      await this._call(() => this.client.delete(path), `delete:${path}`);
      return { path: logicalPath, deleted: true };
    } catch (err) {
      throw this._wrapNodeVaultError(err, `delete:${path}`);
    }
  }

  async listAll(logicalPrefix) {
    const root = (logicalPrefix || '').replace(/^\/+/, '');
    const results = [];
    const walk = async (prefix) => {
      const keys = await this.listKeys(prefix);
      for (const key of keys) {
        const child = prefix ? `${prefix}/${key}` : key;
        if (key.endsWith('/')) {
          await walk(child.replace(/\/$/, ''));
        } else {
          results.push(child);
        }
      }
    };
    await walk(root);
    return results;
  }

  async readMany(logicalPaths, onProgress) {
    const limit = pLimit(MAX_CONCURRENCY);
    const tasks = logicalPaths.map((p) => limit(async () => {
      try {
        const secret = await this.readSecret(p);
        if (onProgress) onProgress(p);
        return { path: p, data: secret.data, metadata: secret.metadata, ok: true };
      } catch (err) {
        return { path: p, error: err.message, code: err.code, ok: false };
      }
    }));
    return Promise.all(tasks);
  }

  async batchWrite(updates, onProgress) {
    const limit = pLimit(MAX_CONCURRENCY);
    const tasks = updates.map((u) => limit(async () => {
      try {
        await this.writeSecret(u.path, u.data, u.options);
        if (onProgress) onProgress(u.path, true);
        return { path: u.path, ok: true };
      } catch (err) {
        if (onProgress) onProgress(u.path, false);
        return { path: u.path, ok: false, error: err.message, code: err.code };
      }
    }));
    return Promise.all(tasks);
  }
}

module.exports = { VaultClient, MAX_CONCURRENCY };
