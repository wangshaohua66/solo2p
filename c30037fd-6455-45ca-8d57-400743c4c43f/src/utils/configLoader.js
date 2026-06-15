'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const EventEmitter = require('events');

const { logger } = require('./logger');

class ConfigLoader extends EventEmitter {
  constructor(configDir) {
    super();
    this.configDir = configDir || path.resolve(process.cwd(), 'config');
    this.config = {};
    this.watchers = [];
  }

  async init() {
    await this.loadAll();
    this.startWatch();
    return this.config;
  }

  loadAll() {
    this.config.platforms = this.loadYaml('platforms.yaml');
    this.config.alertRules = this.loadYaml('alert_rules.yaml');
    this.resolveEnvReferences(this.config);
    logger.info(`配置加载完成: 平台 ${Object.keys(this.config.platforms?.platforms || {}).length} 个, 告警规则 ${Object.keys(this.config.alertRules?.alert_rules || {}).length} 条`);
    return this.config;
  }

  loadYaml(filename) {
    const filePath = path.join(this.configDir, filename);
    if (!fs.existsSync(filePath)) {
      logger.warn(`配置文件不存在: ${filePath}`);
      return {};
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return yaml.load(content) || {};
    } catch (err) {
      logger.error(`配置文件解析失败: ${filename}`, { error: err.message });
      throw err;
    }
  }

  resolveEnvReferences(obj) {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        if (typeof item === 'string') obj[i] = this.substituteEnv(item);
        else if (item && typeof item === 'object') this.resolveEnvReferences(item);
      });
    } else if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (typeof val === 'string') obj[key] = this.substituteEnv(val);
        else if (val && typeof val === 'object') this.resolveEnvReferences(val);
      });
    }
  }

  substituteEnv(value) {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
      const env = process.env[name];
      if (!env) {
        logger.warn(`环境变量未设置: ${name}, 保留占位符`);
        return `\${${name}}`;
      }
      return env;
    });
  }

  startWatch() {
    const watcher = chokidar.watch(
      [path.join(this.configDir, 'platforms.yaml'), path.join(this.configDir, 'alert_rules.yaml')],
      { persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 1000 } }
    );
    watcher.on('change', (filePath) => {
      const filename = path.basename(filePath);
      logger.info(`检测到配置变更，正在热重载: ${filename}`);
      try {
        if (filename === 'platforms.yaml') {
          const oldPlatforms = this.config.platforms;
          this.config.platforms = this.loadYaml('platforms.yaml');
          this.resolveEnvReferences(this.config.platforms);
          this.emit('platforms:changed', { old: oldPlatforms, new: this.config.platforms });
        } else if (filename === 'alert_rules.yaml') {
          const oldRules = this.config.alertRules;
          this.config.alertRules = this.loadYaml('alert_rules.yaml');
          this.resolveEnvReferences(this.config.alertRules);
          this.emit('alertRules:changed', { old: oldRules, new: this.config.alertRules });
        }
        this.emit('config:changed', this.config);
        logger.info(`配置热重载完成: ${filename}`);
      } catch (err) {
        logger.error(`配置热重载失败: ${filename}`, { error: err.message });
      }
    });
    this.watchers.push(watcher);
    logger.info('配置热重载监听已启动');
  }

  get(key, defaultValue = null) {
    if (!key) return this.config;
    return key.split('.').reduce((acc, part) => {
      if (acc == null) return defaultValue;
      return acc[part] != null ? acc[part] : defaultValue;
    }, this.config);
  }

  getEnabledPlatforms() {
    const all = this.config.platforms?.platforms || {};
    return Object.entries(all)
      .filter(([, cfg]) => cfg.enabled !== false)
      .map(([key, cfg]) => ({ key, ...cfg }));
  }

  getPlatform(key) {
    return this.config.platforms?.platforms?.[key] || null;
  }

  getAlertRules() {
    return this.config.alertRules?.alert_rules || {};
  }

  getUrgencyLevels() {
    return this.config.alertRules?.urgency_levels || {};
  }

  stop() {
    this.watchers.forEach((w) => w.close());
    this.removeAllListeners();
    logger.info('配置监听已停止');
  }
}

module.exports = ConfigLoader;
