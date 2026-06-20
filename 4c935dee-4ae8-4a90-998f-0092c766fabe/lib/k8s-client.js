'use strict';

const k8s = require('@kubernetes/client-node');
const { pLimit, retry, getHttpStatus, toAppError, ERROR_CODES } = require('./util');

const MAX_CONCURRENCY = 10;

function decodeSecretData(data) {
  const out = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    try {
      out[key] = Buffer.from(value, 'base64').toString('utf8');
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function encodeSecretData(data) {
  const out = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    out[key] = Buffer.from(String(value), 'utf8').toString('base64');
  }
  return out;
}

class K8sClient {
  constructor(profile) {
    this.profile = profile;
    this.cfg = (profile && profile.k8s) || {};
    this.defaultNamespace = this.cfg.namespace || 'default';
    this.context = this.cfg.context || '';
    this.kc = new k8s.KubeConfig();
    this._loaded = false;
    this._limit = pLimit(MAX_CONCURRENCY);
  }

  load() {
    if (this._loaded) return;
    const kubeconfig = process.env.KUBECONFIG || this.cfg.kubeconfig;
    try {
      if (kubeconfig) {
        this.kc.loadFromFile(kubeconfig);
      } else if (process.env.KUBERNETES_SERVICE_HOST) {
        this.kc.loadFromCluster();
      } else {
        this.kc.loadFromDefault();
      }
    } catch (err) {
      throw toAppError(new Error(`Failed to load kubeconfig: ${err.message}`), ERROR_CODES.K8S_UNREACHABLE);
    }
    if (this.context) {
      try { this.kc.setCurrentContext(this.context); } catch { /* ignore unknown context */ }
    }
    this._loaded = true;
  }

  _api() {
    this.load();
    return this.kc.makeApiClient(k8s.CoreV1Api);
  }

  _ns(namespace) {
    return namespace || this.kc.getContextObject(this.kc.currentContext).namespace || this.defaultNamespace;
  }

  _wrapError(err, label) {
    const status = getHttpStatus(err);
    if (status === 404) return toAppError(err, ERROR_CODES.K8S_NOT_FOUND);
    if (status === 0 || (err && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code))) {
      return toAppError(err, ERROR_CODES.K8S_UNREACHABLE);
    }
    return toAppError(err, ERROR_CODES.K8S_UNREACHABLE);
  }

  async _call(fn, label) {
    return retry(fn, {
      retries: 3,
      baseDelay: 400,
      onRetry: (err, attempt, delay) => {
        if (!process.env.SC_QUIET_RETRY) {
          process.stderr.write(`[retry] k8s ${label} attempt ${attempt} failed (status=${getHttpStatus(err)}); waiting ${Math.round(delay)}ms\n`);
        }
      }
    });
  }

  async listSecrets(namespace) {
    const ns = this._ns(namespace);
    try {
      const api = this._api();
      const res = await this._call(() => api.listNamespacedSecret(ns), `list:${ns}`);
      const items = (res && res.body && res.body.items) || [];
      return items.map((it) => ({
        name: it.metadata.name,
        namespace: it.metadata.namespace || ns,
        type: it.type || 'Opaque',
        keys: Object.keys(it.data || {}),
        resourceVersion: it.metadata.resourceVersion
      }));
    } catch (err) {
      throw this._wrapError(err, `list:${ns}`);
    }
  }

  async readSecret(name, namespace) {
    const ns = this._ns(namespace);
    try {
      const api = this._api();
      const res = await this._call(() => api.readNamespacedSecret(name, ns), `read:${ns}/${name}`);
      const item = res && res.body;
      if (!item) return null;
      return {
        name: item.metadata.name,
        namespace: item.metadata.namespace || ns,
        type: item.type || 'Opaque',
        data: decodeSecretData(item.data),
        resourceVersion: item.metadata.resourceVersion
      };
    } catch (err) {
      throw this._wrapError(err, `read:${ns}/${name}`);
    }
  }

  async _buildSecretBody(name, ns, data, type) {
    return {
      apiVersion: 'v1',
      kind: 'Secret',
      type: type || 'Opaque',
      metadata: { name, namespace: ns },
      data: encodeSecretData(data)
    };
  }

  async writeSecret(name, data, options) {
    const opts = options || {};
    const ns = this._ns(opts.namespace);
    const api = this._api();
    const body = await this._buildSecretBody(name, ns, data, opts.type);
    try {
      await this._call(() => api.createNamespacedSecret(ns, body), `create:${ns}/${name}`);
      return { name, namespace: ns, created: true, updated: false };
    } catch (err) {
      if (getHttpStatus(err) === 409 || getHttpStatus(err) === 400) {
        try {
          await this._call(() => api.replaceNamespacedSecret(name, ns, body), `replace:${ns}/${name}`);
          return { name, namespace: ns, created: false, updated: true };
        } catch (err2) {
          throw this._wrapError(err2, `replace:${ns}/${name}`);
        }
      }
      throw this._wrapError(err, `create:${ns}/${name}`);
    }
  }

  async patchSecret(name, data, namespace) {
    const ns = this._ns(namespace);
    const api = this._api();
    const patch = { data: encodeSecretData(data) };
    try {
      await this._call(() => api.patchNamespacedSecret(name, ns, patch), `patch:${ns}/${name}`);
      return { name, namespace: ns, patched: true };
    } catch (err) {
      throw this._wrapError(err, `patch:${ns}/${name}`);
    }
  }

  async deleteSecret(name, namespace) {
    const ns = this._ns(namespace);
    const api = this._api();
    try {
      await this._call(() => api.deleteNamespacedSecret(name, ns), `delete:${ns}/${name}`);
      return { name, namespace: ns, deleted: true };
    } catch (err) {
      throw this._wrapError(err, `delete:${ns}/${name}`);
    }
  }

  async readMany(items, onProgress) {
    const limit = pLimit(MAX_CONCURRENCY);
    const tasks = items.map((it) => limit(async () => {
      try {
        const secret = await this.readSecret(it.name, it.namespace);
        if (onProgress) onProgress(it.name, true);
        return { name: it.name, namespace: it.namespace, data: secret ? secret.data : {}, ok: true };
      } catch (err) {
        if (onProgress) onProgress(it.name, false);
        return { name: it.name, namespace: it.namespace, ok: false, error: err.message, code: err.code };
      }
    }));
    return Promise.all(tasks);
  }
}

module.exports = { K8sClient, decodeSecretData, encodeSecretData, MAX_CONCURRENCY };
