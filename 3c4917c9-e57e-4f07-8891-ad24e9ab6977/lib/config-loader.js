import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  fileExists, dirExists, resolvePath, expandTilde,
  safeJsonParse, mergeDeep, getHomeDir
} from './utils.js';
import { createError, ErrorCodes } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GLOBAL_CONFIG_DIR = path.join(getHomeDir(), '.config', 'config-drift');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_NAME = '.driftrc.json';
const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, 'data');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  environments: {},
  baseline: null,
  scan: {
    filePatterns: [
      '**/*.yaml', '**/*.yml', '**/*.json', '**/.env*',
      '**/application*.yaml', '**/application*.yml', '**/application*.properties'
    ],
    ignorePatterns: [
      'node_modules/**', '.git/**', 'dist/**', 'build/**',
      'logs/**', '*.bak', '*.tmp', '.driftrc.json'
    ],
    maxFileSize: 10 * 1024 * 1024,
    followSymlinks: false
  },
  drift: {
    severityLevels: {
      critical: { weight: 4, alert: true },
      high: { weight: 3, alert: true },
      medium: { weight: 2, alert: false },
      low: { weight: 1, alert: false },
      info: { weight: 0, alert: false }
    },
    criticalKeys: [
      'database', 'datasource', 'jdbc', 'redis', 'mq', 'kafka',
      'rabbitmq', 'elasticsearch', 'mongodb', 'url', 'host', 'port',
      'timeout', 'connection', 'pool'
    ]
  },
  secrets: {
    enabledRules: [],
    customRules: [],
    masking: {
      enabled: true,
      defaultVisibleStart: 2,
      defaultVisibleEnd: 2,
      maskChar: '*'
    },
    kms: {
      provider: null,
      address: null,
      tokenEnv: null
    }
  },
  history: {
    dataDir: DEFAULT_DATA_DIR,
    maxRecords: 10000,
    autoSnapshot: true,
    snapshotInterval: 3600
  },
  report: {
    outputDir: path.join(PROJECT_ROOT, 'reports'),
    defaultFormat: 'console',
    timestampReports: true,
    includeSensitive: false
  },
  logging: {
    level: 'info',
    fileLevel: 'debug',
    consoleLevel: 'info'
  },
  sync: {
    createBackup: true,
    backupDir: path.join(PROJECT_ROOT, 'backups'),
    confirmBeforeDelete: true,
    preserveTimestamps: false
  },
  ui: {
    color: true,
    progress: true,
    interactive: true,
    tableStyle: 'default'
  }
};

let cachedConfig = null;
let cachedConfigPath = null;

function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return safeJsonParse(content, null);
  } catch (error) {
    throw createError(
      `加载配置文件失败: ${filePath} - ${error.message}`,
      ErrorCodes.PARSE_ERROR,
      { filePath, originalError: error.message }
    );
  }
}

function findProjectConfig(startDir = process.cwd()) {
  let currentDir = resolvePath(startDir);
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    const configPath = path.join(currentDir, PROJECT_CONFIG_NAME);
    if (fileExists(configPath)) {
      return configPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return null;
}

function applyEnvOverrides(config) {
  const result = { ...config };

  const envPrefix = 'CONFIG_DRIFT_';
  const envKeys = Object.keys(process.env).filter((k) => k.startsWith(envPrefix));

  for (const envKey of envKeys) {
    const configPath = envKey.slice(envPrefix.length).toLowerCase().replace(/__/g, '.');
    const value = process.env[envKey];
    const parsedValue = parseEnvValue(value);
    setByPath(result, configPath, parsedValue);
  }

  if (process.env.DEBUG || process.env.CD_DEBUG) {
    result.logging = result.logging || {};
    result.logging.level = 'debug';
  }

  if (process.env.NO_COLOR) {
    result.ui = result.ui || {};
    result.ui.color = false;
  }

  return result;
}

function parseEnvValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    const parsed = safeJsonParse(value, null);
    if (parsed !== null) return parsed;
  }
  return value;
}

function setByPath(obj, pathStr, value) {
  const keys = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function loadConfig(options = {}) {
  const {
    configPath = null,
    noCache = false,
    skipEnv = false,
    cwd = process.cwd()
  } = options;

  if (cachedConfig && !noCache && cachedConfigPath === configPath) {
    return cachedConfig;
  }

  let config = { ...DEFAULT_CONFIG };

  if (dirExists(GLOBAL_CONFIG_DIR) && fileExists(GLOBAL_CONFIG_PATH)) {
    const globalConfig = loadJsonFile(GLOBAL_CONFIG_PATH);
    if (globalConfig) {
      config = mergeDeep(config, globalConfig);
    }
  }

  let projectConfigPath = configPath;
  if (!projectConfigPath) {
    projectConfigPath = findProjectConfig(cwd);
  } else {
    projectConfigPath = resolvePath(projectConfigPath);
  }

  if (projectConfigPath && fileExists(projectConfigPath)) {
    const projectConfig = loadJsonFile(projectConfigPath);
    if (projectConfig) {
      config = mergeDeep(config, projectConfig);
    }
  }

  if (!skipEnv) {
    config = applyEnvOverrides(config);
  }

  cachedConfig = config;
  cachedConfigPath = projectConfigPath;

  return config;
}

function reloadConfig(options = {}) {
  cachedConfig = null;
  cachedConfigPath = null;
  return loadConfig({ ...options, noCache: true });
}

function getConfig(options = {}) {
  if (!cachedConfig) {
    return loadConfig(options);
  }
  return cachedConfig;
}

function saveProjectConfig(config, targetPath = null) {
  const savePath = targetPath
    ? resolvePath(targetPath)
    : path.join(process.cwd(), PROJECT_CONFIG_NAME);

  const dir = path.dirname(savePath);
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const cleanConfig = sanitizeConfig(config);

  try {
    fs.writeFileSync(savePath, JSON.stringify(cleanConfig, null, 2) + '\n', 'utf-8');
    cachedConfig = mergeDeep(DEFAULT_CONFIG, cleanConfig);
    cachedConfigPath = savePath;
    return savePath;
  } catch (error) {
    throw createError(
      `保存配置文件失败: ${savePath} - ${error.message}`,
      ErrorCodes.PERMISSION_DENIED,
      { filePath: savePath, originalError: error.message }
    );
  }
}

function sanitizeConfig(config) {
  const result = { ...config };
  if (result.logging?.fileLevel) {
  }
  return result;
}

function isInitialized() {
  if (cachedConfig) {
    return Object.keys(cachedConfig.environments || {}).length > 0;
  }
  const config = loadConfig();
  return Object.keys(config.environments || {}).length > 0;
}

function addEnvironment(name, envConfig) {
  const config = getConfig();
  config.environments = config.environments || {};
  config.environments[name] = {
    name: envConfig.name || name,
    path: resolvePath(envConfig.path),
    description: envConfig.description || '',
    tags: envConfig.tags || [],
    createdAt: new Date().toISOString(),
    ...envConfig
  };
  return config;
}

function removeEnvironment(name) {
  const config = getConfig();
  if (config.environments && config.environments[name]) {
    delete config.environments[name];
  }
  return config;
}

function getEnvironment(name) {
  const config = getConfig();
  return config.environments?.[name] || null;
}

function listEnvironments() {
  const config = getConfig();
  return Object.entries(config.environments || {}).map(([key, value]) => ({
    id: key,
    ...value
  }));
}

function setBaseline(envName) {
  const config = getConfig();
  config.baseline = envName;
  return config;
}

function getBaseline() {
  const config = getConfig();
  return config.baseline || null;
}

function getDataDir() {
  const config = getConfig();
  const dir = config.history?.dataDir || DEFAULT_DATA_DIR;
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getReportsDir() {
  const config = getConfig();
  const dir = config.report?.outputDir || path.join(PROJECT_ROOT, 'reports');
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getBackupsDir() {
  const config = getConfig();
  const dir = config.sync?.backupDir || path.join(PROJECT_ROOT, 'backups');
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export {
  DEFAULT_CONFIG,
  PROJECT_CONFIG_NAME,
  GLOBAL_CONFIG_PATH,
  loadConfig,
  reloadConfig,
  getConfig,
  saveProjectConfig,
  isInitialized,
  addEnvironment,
  removeEnvironment,
  getEnvironment,
  listEnvironments,
  setBaseline,
  getBaseline,
  getDataDir,
  getReportsDir,
  getBackupsDir,
  findProjectConfig,
  PROJECT_ROOT
};

export default getConfig;
