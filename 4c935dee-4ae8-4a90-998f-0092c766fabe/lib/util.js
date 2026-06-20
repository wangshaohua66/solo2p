'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pLimit(concurrency) {
  const max = Math.max(1, concurrency || 1);
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || queue.length === 0) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(() => fn())
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        next();
      });
  };

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

function getHttpStatus(err) {
  if (!err) return 0;
  if (err.response && typeof err.response.status === 'number') return err.response.status;
  if (err.response && typeof err.response.statusCode === 'number') return err.response.statusCode;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.code === 'number') return err.code;
  return 0;
}

function isRetryableError(err) {
  const status = getHttpStatus(err);
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  if (err && err.code) {
    const retryable = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'ECONNREFUSED'];
    if (retryable.includes(err.code)) return true;
  }
  return false;
}

function getRetryAfterMs(err) {
  if (!err || !err.response) return 0;
  const headers = err.response.headers || {};
  const retryAfter = headers['retry-after'] || headers['Retry-After'];
  if (!retryAfter) return 0;
  const secs = Number(retryAfter);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return 0;
}

async function retry(fn, options) {
  const opts = options || {};
  const retries = opts.retries !== undefined ? opts.retries : 3;
  const baseDelay = opts.baseDelay || 500;
  const factor = opts.factor || 2;
  const maxDelay = opts.maxDelay || 8000;
  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isRetryableError(err)) throw err;
      const retryAfter = getRetryAfterMs(err);
      const exp = baseDelay * Math.pow(factor, attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelay);
      let delay = Math.min(exp + jitter, maxDelay);
      if (retryAfter > 0) delay = retryAfter;
      if (opts.onRetry) opts.onRetry(err, attempt, delay);
      await sleep(delay);
    }
  }
}

function truncate(str, len) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= len) return s;
  return `${s.slice(0, len - 1)}…`;
}

function parseDuration(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const match = String(str).match(/^(\d+)(ms|s|m|h|d|w)?$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return value * (mult[unit] || 1);
}

function asyncIterator(items) {
  return items.slice();
}

function chunks(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

class AppError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'AppError';
    this.code = code || 'EAPP';
    this.details = details || {};
  }
}

const ERROR_CODES = {
  VAULT_UNREACHABLE: { code: 'E_VAULT_UNREACHABLE', hint: '检查 Vault endpoint 地址、网络连通性及 token 是否有效。可用 SC_VAULT_ADDR/SC_VAULT_TOKEN 覆盖。' },
  VAULT_AUTH_FAILED: { code: 'E_VAULT_AUTH', hint: 'Vault 认证失败，请确认 token 或角色配置，必要时重新登录。' },
  VAULT_NOT_FOUND: { code: 'E_VAULT_NOT_FOUND', hint: '指定的 Vault 路径不存在，请核对 mount 与路径。' },
  VAULT_RATE_LIMITED: { code: 'E_VAULT_RATE_LIMITED', hint: 'Vault 限流，已自动退避重试。请降低并发或稍后重试。' },
  K8S_UNREACHABLE: { code: 'E_K8S_UNREACHABLE', hint: '无法连接 Kubernetes API，请确认 kubeconfig/context 是否正确。' },
  K8S_NOT_FOUND: { code: 'E_K8S_NOT_FOUND', hint: 'Kubernetes Secret 不存在，请核对命名空间与名称。' },
  CERT_PARSE_FAILED: { code: 'E_CERT_PARSE', hint: '证书解析失败，请确认文件为合法的 PEM/DER X.509 证书。' },
  ROTATE_FAILED: { code: 'E_ROTATE_FAILED', hint: '密钥轮换失败，已尝试回滚关联 Secret，请检查审计日志。' },
  CONFIG_INVALID: { code: 'E_CONFIG', hint: '配置无效，请检查 profile 配置或环境变量。' },
  IO_ERROR: { code: 'E_IO', hint: '文件读写错误，请检查路径与权限。' },
  VALIDATION: { code: 'E_VALIDATION', hint: '参数校验失败，请检查命令参数。' }
};

function toAppError(err, map) {
  if (err && err.code === (map && map.code)) return err;
  const e = new AppError(err ? err.message : String(err), map && map.code, { cause: err });
  e.hint = map && map.hint;
  e.cause = err;
  return e;
}

module.exports = {
  sleep,
  pLimit,
  retry,
  isRetryableError,
  getHttpStatus,
  truncate,
  parseDuration,
  chunks,
  AppError,
  ERROR_CODES,
  toAppError
};
