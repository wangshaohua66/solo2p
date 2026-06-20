'use strict';

/**
 * 配置加载器：读取 config/banks.yml，合并默认值，注入环境变量占位。
 * 对外暴露：getConfig() / getBank(code) / getBanks() / getNotifier()。
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');

const CONFIG_PATH = path.resolve(process.cwd(), 'config/banks.yml');

let _cache = null;

function deepMerge(base, override) {
  if (Array.isArray(base)) return override !== undefined ? override : base;
  if (typeof base === 'object' && base !== null) {
    const out = { ...base };
    if (override && typeof override === 'object') {
      for (const k of Object.keys(override)) {
        out[k] = deepMerge(base[k], override[k]);
      }
    }
    return out;
  }
  return override !== undefined ? override : base;
}

function load() {
  if (_cache) return _cache;
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`配置文件不存在: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const doc = yaml.load(raw);
  if (!doc || !Array.isArray(doc.banks)) {
    throw new Error('配置文件格式错误：缺少 banks 列表');
  }
  _cache = doc;
  logger.success(`配置加载完成，共 ${doc.banks.length} 家银行`);
  return _cache;
}

function getConfig() {
  return load();
}

function getDefaults() {
  return load().defaults || {};
}

function getBanks() {
  return load().banks || [];
}

function getBank(code) {
  const b = getBanks().find((x) => x.code === code);
  if (!b) throw new Error(`未找到银行配置: ${code}`);
  return b;
}

function getCenterSystem() {
  return load().center_system || {};
}

function getNotifier() {
  return load().notifier || {};
}

function envValue(name) {
  const v = process.env[name];
  if (v === undefined || v === '') return null;
  return v;
}

module.exports = {
  load,
  getConfig,
  getDefaults,
  getBanks,
  getBank,
  getCenterSystem,
  getNotifier,
  envValue,
};
