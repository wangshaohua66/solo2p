const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_CONFIG = {
  sources: [],
  patterns: [],
  alerts: [],
  archive: {
    path: './archive',
    retention_days: 30,
    compress: true
  },
  monitoring: {
    concurrency: 8,
    max_memory_mb: 500,
    watch_delay_ms: 500
  }
};

function validateSource(source, index) {
  const errors = [];
  const prefix = `sources[${index}]`;

  if (!source.name || typeof source.name !== 'string') {
    errors.push(`${prefix}.name: required string`);
  }
  if (!source.path || typeof source.path !== 'string') {
    errors.push(`${prefix}.path: required string (glob pattern)`);
  }
  if (source.encoding && typeof source.encoding !== 'string') {
    errors.push(`${prefix}.encoding: must be string`);
  }
  if (source.parser && !['nginx', 'json', 'csv', 'regex', 'auto'].includes(source.parser)) {
    errors.push(`${prefix}.parser: must be one of nginx, json, csv, regex, auto`);
  }
  if (source.parser === 'regex' && !source.regex) {
    errors.push(`${prefix}.regex: required when parser is 'regex'`);
  }
  if (source.regex) {
    try {
      new RegExp(source.regex);
    } catch (e) {
      errors.push(`${prefix}.regex: invalid regular expression - ${e.message}`);
    }
  }
  if (source.timestamp_field && typeof source.timestamp_field !== 'string') {
    errors.push(`${prefix}.timestamp_field: must be string`);
  }
  if (source.timestamp_format && typeof source.timestamp_format !== 'string') {
    errors.push(`${prefix}.timestamp_format: must be string`);
  }

  return errors;
}

function validatePattern(pattern, index) {
  const errors = [];
  const prefix = `patterns[${index}]`;

  if (!pattern.name || typeof pattern.name !== 'string') {
    errors.push(`${prefix}.name: required string`);
  }
  if (pattern.composite && pattern.composite.operator) {
    if (!['AND', 'OR', 'NOT'].includes(pattern.composite.operator)) {
      errors.push(`${prefix}.composite.operator: must be AND, OR, or NOT`);
    }
    if (!Array.isArray(pattern.composite.patterns)) {
      errors.push(`${prefix}.composite.patterns: must be array of pattern names`);
    }
  } else {
    if (!pattern.regex || typeof pattern.regex !== 'string') {
      errors.push(`${prefix}.regex: required string`);
    } else {
      try {
        new RegExp(pattern.regex);
      } catch (e) {
        errors.push(`${prefix}.regex: invalid regular expression - ${e.message}`);
      }
    }
  }
  if (pattern.severity && !['info', 'warn', 'error', 'critical'].includes(pattern.severity)) {
    errors.push(`${prefix}.severity: must be one of info, warn, error, critical`);
  }

  return errors;
}

function validateAlert(alert, index) {
  const errors = [];
  const prefix = `alerts[${index}]`;

  if (!alert.name || typeof alert.name !== 'string') {
    errors.push(`${prefix}.name: required string`);
  }
  if (!alert.metric || typeof alert.metric !== 'string') {
    errors.push(`${prefix}.metric: required string (e.g. error_rate, response_time, match_count)`);
  }
  if (typeof alert.threshold === 'undefined') {
    errors.push(`${prefix}.threshold: required number`);
  } else if (typeof alert.threshold !== 'number') {
    errors.push(`${prefix}.threshold: must be number`);
  }
  if (alert.comparator && !['>', '>=', '<', '<=', '=='].includes(alert.comparator)) {
    errors.push(`${prefix}.comparator: must be one of >, >=, <, <=, ==`);
  }
  if (alert.silence_minutes && typeof alert.silence_minutes !== 'number') {
    errors.push(`${prefix}.silence_minutes: must be number`);
  }
  if (alert.window_minutes && typeof alert.window_minutes !== 'number') {
    errors.push(`${prefix}.window_minutes: must be number`);
  }

  return errors;
}

function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return ['Config must be an object'];
  }

  if (!Array.isArray(config.sources)) {
    errors.push('sources: must be an array');
  } else {
    config.sources.forEach((s, i) => {
      errors.push(...validateSource(s, i));
    });
  }

  if (config.patterns && !Array.isArray(config.patterns)) {
    errors.push('patterns: must be an array');
  } else if (config.patterns) {
    config.patterns.forEach((p, i) => {
      errors.push(...validatePattern(p, i));
    });
  }

  if (config.alerts && !Array.isArray(config.alerts)) {
    errors.push('alerts: must be an array');
  } else if (config.alerts) {
    config.alerts.forEach((a, i) => {
      errors.push(...validateAlert(a, i));
    });
  }

  if (config.archive) {
    if (config.archive.path && typeof config.archive.path !== 'string') {
      errors.push('archive.path: must be string');
    }
    if (config.archive.retention_days && typeof config.archive.retention_days !== 'number') {
      errors.push('archive.retention_days: must be number');
    }
  }

  return errors;
}

function mergeDefaults(config) {
  return {
    sources: config.sources || DEFAULT_CONFIG.sources,
    patterns: config.patterns || DEFAULT_CONFIG.patterns,
    alerts: config.alerts || DEFAULT_CONFIG.alerts,
    archive: { ...DEFAULT_CONFIG.archive, ...(config.archive || {}) },
    monitoring: { ...DEFAULT_CONFIG.monitoring, ...(config.monitoring || {}) },
    correlation: config.correlation || null
  };
}

async function loadConfig(configPath) {
  const resolvedPath = path.resolve(configPath);

  const exists = await fs.pathExists(resolvedPath);
  if (!exists) {
    throw new Error(`Configuration file not found: ${resolvedPath}`);
  }

  const stat = await fs.stat(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`Configuration path is not a file: ${resolvedPath}`);
  }

  let rawConfig;
  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    rawConfig = yaml.load(content);
  } catch (e) {
    if (e.name === 'YAMLException') {
      throw new Error(`YAML syntax error in ${resolvedPath}: ${e.message}`);
    }
    throw new Error(`Failed to read config file ${resolvedPath}: ${e.message}`);
  }

  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('Configuration file must contain a valid YAML object');
  }

  const errors = validateConfig(rawConfig);
  if (errors.length > 0) {
    throw new Error(`Configuration validation errors:\n  ${errors.join('\n  ')}`);
  }

  return mergeDefaults(rawConfig);
}

function getDefaultConfigPath() {
  return path.join(process.cwd(), 'logwatch.yml');
}

function generateDefaultConfigYaml() {
  return yaml.dump({
    sources: [
      {
        name: 'nginx-access',
        path: '/var/log/nginx/access.log',
        parser: 'nginx',
        encoding: 'utf-8'
      },
      {
        name: 'app-logs',
        path: '/var/log/app/*.log',
        parser: 'json',
        encoding: 'utf-8'
      }
    ],
    patterns: [
      {
        name: 'http-5xx',
        regex: '\\s5\\d{2}\\s',
        severity: 'error'
      },
      {
        name: 'http-4xx',
        regex: '\\s4\\d{2}\\s',
        severity: 'warn'
      },
      {
        name: 'slow-request',
        regex: 'request_time[=:][\\d.]+',
        severity: 'warn'
      }
    ],
    alerts: [
      {
        name: 'high-error-rate',
        metric: 'error_rate',
        threshold: 5,
        comparator: '>',
        window_minutes: 5,
        silence_minutes: 30
      },
      {
        name: 'slow-response',
        metric: 'response_time',
        threshold: 2000,
        comparator: '>',
        window_minutes: 1,
        silence_minutes: 15
      }
    ],
    archive: {
      path: './archive',
      retention_days: 30,
      compress: true
    },
    monitoring: {
      concurrency: 8,
      max_memory_mb: 500,
      watch_delay_ms: 500
    },
    correlation: {
      time_window_seconds: 60,
      keys: ['ip', 'request_id']
    }
  }, { lineWidth: 120 });
}

module.exports = {
  loadConfig,
  validateConfig,
  mergeDefaults,
  getDefaultConfigPath,
  generateDefaultConfigYaml,
  DEFAULT_CONFIG
};
