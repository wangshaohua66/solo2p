'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  lab: {
    name: '区域食品安全检测中心',
    code: 'FSI-001',
    address: '',
    contact: '',
    director: ''
  },
  sample: {
    idPrefix: 'SP',
    idDateFormat: 'YYYYMMDD',
    idSequenceLength: 4
  },
  categories: {
    microorganism: {
      name: '微生物检测',
      projects: ['菌落总数', '大肠菌群', '沙门氏菌', '金黄色葡萄球菌', '霉菌和酵母']
    },
    physicochemical: {
      name: '理化分析',
      projects: ['水分', '灰分', '蛋白质', '脂肪', '酸价', '过氧化值', '铅', '砷', '汞', '镉']
    },
    pesticide: {
      name: '农残检测',
      projects: ['敌敌畏', '乐果', '马拉硫磷', '毒死蜱', '氯氰菊酯', '氰戊菊酯', '溴氰菊酯', '百菌清', '多菌灵', '甲基硫菌灵']
    }
  },
  standards: {
    activeScheme: 'default',
    schemes: {
      default: {
        name: '通用国标方案',
        description: '基于GB 2760、GB 2762、GB 29921等国家标准',
        thresholds: {
          '菌落总数': { unit: 'CFU/g', min: 0, max: 10000, pass: '<=', standard: 'GB 4789.2' },
          '大肠菌群': { unit: 'MPN/100g', min: 0, max: 100, pass: '<=', standard: 'GB 4789.3' },
          '沙门氏菌': { unit: '/25g', min: 0, max: 0, pass: '==', standard: 'GB 4789.4' },
          '金黄色葡萄球菌': { unit: 'CFU/g', min: 0, max: 100, pass: '<=', standard: 'GB 4789.10' },
          '霉菌和酵母': { unit: 'CFU/g', min: 0, max: 500, pass: '<=', standard: 'GB 4789.15' },
          '水分': { unit: '%', min: 0, max: 15, pass: '<=', standard: 'GB 5009.3' },
          '灰分': { unit: '%', min: 0, max: 5, pass: '<=', standard: 'GB 5009.4' },
          '蛋白质': { unit: 'g/100g', min: 0, max: null, pass: '>=', standard: 'GB 5009.5' },
          '脂肪': { unit: 'g/100g', min: 0, max: null, pass: '>=', standard: 'GB 5009.6' },
          '酸价': { unit: 'mgKOH/g', min: 0, max: 3, pass: '<=', standard: 'GB 5009.229' },
          '过氧化值': { unit: 'g/100g', min: 0, max: 0.25, pass: '<=', standard: 'GB 5009.227' },
          '铅': { unit: 'mg/kg', min: 0, max: 0.5, pass: '<=', standard: 'GB 5009.12' },
          '砷': { unit: 'mg/kg', min: 0, max: 0.5, pass: '<=', standard: 'GB 5009.11' },
          '汞': { unit: 'mg/kg', min: 0, max: 0.05, pass: '<=', standard: 'GB 5009.17' },
          '镉': { unit: 'mg/kg', min: 0, max: 0.1, pass: '<=', standard: 'GB 5009.15' },
          '敌敌畏': { unit: 'mg/kg', min: 0, max: 0.05, pass: '<=', standard: 'GB 2763' },
          '乐果': { unit: 'mg/kg', min: 0, max: 0.5, pass: '<=', standard: 'GB 2763' },
          '马拉硫磷': { unit: 'mg/kg', min: 0, max: 2, pass: '<=', standard: 'GB 2763' },
          '毒死蜱': { unit: 'mg/kg', min: 0, max: 0.1, pass: '<=', standard: 'GB 2763' },
          '氯氰菊酯': { unit: 'mg/kg', min: 0, max: 2, pass: '<=', standard: 'GB 2763' },
          '氰戊菊酯': { unit: 'mg/kg', min: 0, max: 0.5, pass: '<=', standard: 'GB 2763' },
          '溴氰菊酯': { unit: 'mg/kg', min: 0, max: 0.5, pass: '<=', standard: 'GB 2763' },
          '百菌清': { unit: 'mg/kg', min: 0, max: 5, pass: '<=', standard: 'GB 2763' },
          '多菌灵': { unit: 'mg/kg', min: 0, max: 3, pass: '<=', standard: 'GB 2763' },
          '甲基硫菌灵': { unit: 'mg/kg', min: 0, max: 5, pass: '<=', standard: 'GB 2763' }
        }
      },
      strict: {
        name: '严格国标方案',
        description: '严于通用国标的检测阈值',
        thresholds: {
          '菌落总数': { unit: 'CFU/g', min: 0, max: 5000, pass: '<=', standard: 'GB 4789.2(严格)' },
          '大肠菌群': { unit: 'MPN/100g', min: 0, max: 10, pass: '<=', standard: 'GB 4789.3(严格)' }
        }
      }
    }
  },
  report: {
    templatePath: './templates',
    defaultFormat: 'text',
    header: '食品安全检测报告'
  },
  data: {
    storagePath: './data',
    samplesFile: 'samples.json',
    sequenceFile: 'sequences.json'
  },
  roles: {
    sampler: { name: '采样员', permissions: ['register', 'view'] },
    tester: { name: '检测员', permissions: ['view', 'input', 'update'] },
    reviewer: { name: '复核员', permissions: ['view', 'review'] },
    approver: { name: '报告签发人', permissions: ['view', 'approve'] }
  },
  statusFlow: {
    pending: { name: '待检', next: ['testing'], color: 'yellow' },
    testing: { name: '检测中', next: ['review', 'exception'], color: 'cyan' },
    review: { name: '复核', next: ['certified', 'testing'], color: 'blue' },
    certified: { name: '出证', next: [], color: 'green' },
    exception: { name: '异常', next: ['testing', 'certified'], color: 'red' }
  },
  parallelTest: {
    minCount: 2,
    maxRSD: 5
  }
};

function getConfigPath() {
  const homeConfig = path.join(os.homedir(), '.food-safety-inspection', 'config.json');
  const localConfig = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(localConfig)) return localConfig;
  if (fs.existsSync(homeConfig)) return homeConfig;
  return localConfig;
}

function loadConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return deepMerge(DEFAULT_CONFIG, userConfig);
    } catch (e) {
      console.error('配置文件读取失败，使用默认配置:', e.message);
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig(config, configPath) {
  const targetPath = configPath || getConfigPath();
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');
  return targetPath;
}

function initConfig(force = false) {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath) && !force) {
    return { exists: true, path: configPath };
  }
  saveConfig(DEFAULT_CONFIG, configPath);
  return { exists: false, path: configPath, config: DEFAULT_CONFIG };
}

function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target));
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function getActiveThresholds(config) {
  const schemeName = config.standards.activeScheme;
  const scheme = config.standards.schemes[schemeName];
  if (!scheme) {
    throw new Error(`未找到阈值方案: ${schemeName}`);
  }
  return scheme.thresholds;
}

function getThreshold(config, projectName) {
  const thresholds = getActiveThresholds(config);
  return thresholds[projectName] || null;
}

function listSchemes(config) {
  const result = [];
  for (const [key, scheme] of Object.entries(config.standards.schemes)) {
    result.push({
      key,
      name: scheme.name,
      description: scheme.description,
      active: key === config.standards.activeScheme,
      projectCount: Object.keys(scheme.thresholds).length
    });
  }
  return result;
}

function setActiveScheme(config, schemeKey) {
  if (!config.standards.schemes[schemeKey]) {
    throw new Error(`阈值方案不存在: ${schemeKey}`);
  }
  config.standards.activeScheme = schemeKey;
  return config;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigPath,
  loadConfig,
  saveConfig,
  initConfig,
  getActiveThresholds,
  getThreshold,
  listSchemes,
  setActiveScheme
};
