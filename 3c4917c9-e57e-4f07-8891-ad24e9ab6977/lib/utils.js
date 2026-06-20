import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function hashContent(content, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(content).digest('hex');
}

export function hashFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return hashContent(content);
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return format
    .replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

export function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return -1;
  }
}

export function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function dirExists(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function ensureDir(dirPath) {
  if (!dirExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function flattenObject(obj, prefix = '', separator = '.') {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey, separator));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

export function unflattenObject(flat, separator = '.') {
  const result = {};
  for (const [key, value] of Object.entries(flat || {})) {
    const keys = key.split(separator);
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item));
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone(obj[key]);
    }
  }
  return result;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(a[key], b[key]));
}

export function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function truncate(str, maxLength = 100, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

export function maskString(str, options = {}) {
  const {
    visibleStart = 2,
    visibleEnd = 2,
    maskChar = '*',
    fixedLength = null
  } = options;

  if (!str) return '';
  if (fixedLength !== null) {
    return maskChar.repeat(fixedLength);
  }
  if (str.length <= visibleStart + visibleEnd) {
    return maskChar.repeat(str.length);
  }
  return (
    str.substring(0, visibleStart) +
    maskChar.repeat(str.length - visibleStart - visibleEnd) +
    str.substring(str.length - visibleEnd)
  );
}

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchAnyPattern(str, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(str);
    }
    return new RegExp(pattern, 'i').test(str);
  });
}

export function globToRegExp(glob) {
  const escaped = escapeRegExp(glob)
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function matchGlob(filePath, patterns = []) {
  return patterns.some((pattern) => {
    const regex = globToRegExp(pattern);
    return regex.test(filePath) || filePath.includes(pattern.replace(/\*/g, ''));
  });
}

export function getHomeDir() {
  return os.homedir();
}

export function expandTilde(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(getHomeDir(), filePath.slice(2));
  }
  return filePath;
}

export function resolvePath(...paths) {
  let resolved = path.resolve(...paths);
  resolved = expandTilde(resolved);
  return resolved;
}

export function parseEnvFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      let [, key, value] = match;
      value = value.trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

export function parsePropertiesFile(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  let currentKey = null;
  let currentValue = '';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;

    if (line.endsWith('\\') && !line.endsWith('\\\\')) {
      currentValue += line.slice(0, -1);
      if (currentKey === null) {
        const eqIdx = currentValue.indexOf('=');
        const colIdx = currentValue.indexOf(':');
        const sepIdx = eqIdx === -1 ? colIdx : (colIdx === -1 ? eqIdx : Math.min(eqIdx, colIdx));
        if (sepIdx > -1) {
          currentKey = currentValue.substring(0, sepIdx).trim();
          currentValue = currentValue.substring(sepIdx + 1).trim();
        }
      }
      continue;
    }

    if (currentKey !== null) {
      currentValue += line;
      result[currentKey] = currentValue;
      currentKey = null;
      currentValue = '';
    } else {
      const eqIdx = line.indexOf('=');
      const colIdx = line.indexOf(':');
      const sepIdx = eqIdx === -1 ? colIdx : (colIdx === -1 ? eqIdx : Math.min(eqIdx, colIdx));
      if (sepIdx > -1) {
        const key = line.substring(0, sepIdx).trim();
        const value = line.substring(sepIdx + 1).trim();
        result[key] = value;
      } else {
        result[line] = '';
      }
    }
  }
  return result;
}

export function objectToEnvString(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj || {})) {
    const strValue = typeof value === 'string' && /[\s"'=]/.test(value)
      ? `"${value.replace(/"/g, '\\"')}"`
      : String(value);
    lines.push(`${key}=${strValue}`);
  }
  return lines.join('\n');
}

export function objectToPropertiesString(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj || {})) {
    lines.push(`${key}=${value}`);
  }
  return lines.join('\n');
}

export function chunkArray(array, size = 10) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    }
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function getOrDefault(obj, path, defaultValue = undefined) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, key)) {
      return defaultValue;
    }
    current = current[key];
  }
  return current;
}
