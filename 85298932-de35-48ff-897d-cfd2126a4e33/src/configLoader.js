const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'accounts.yaml');

let cachedConfig = null;
let lastMtime = 0;

function loadConfig(force = false) {
  try {
    const stat = fs.statSync(CONFIG_PATH);
    if (cachedConfig && !force && stat.mtimeMs === lastMtime) {
      return cachedConfig;
    }
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = yaml.load(content);
    lastMtime = stat.mtimeMs;
    return cachedConfig;
  } catch (err) {
    throw new Error(`加载配置文件失败: ${err.message}`);
  }
}

function getAccounts() {
  const cfg = loadConfig();
  return (cfg.accounts || []).filter(a => a.enabled !== false);
}

function getPlatformConfig() {
  return loadConfig().platform || {};
}

function getSchedulerConfig() {
  return loadConfig().scheduler || {};
}

function getScaleConfig(code) {
  const cfg = loadConfig();
  const scales = cfg.scales || [];
  return scales.find(s => s.code === code) || null;
}

function getAllScales() {
  return loadConfig().scales || [];
}

function getStorageConfig() {
  return loadConfig().storage || {};
}

function getReportsConfig() {
  return loadConfig().reports || {};
}

module.exports = {
  loadConfig,
  getAccounts,
  getPlatformConfig,
  getSchedulerConfig,
  getScaleConfig,
  getAllScales,
  getStorageConfig,
  getReportsConfig
};
