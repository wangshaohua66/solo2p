const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { MigrationError } = require('./errors');

const CONFIG_FILENAMES = ['settings.yml', 'settings.yaml', 'settings.json', '.db-migrate.yml', '.db-migrate.json'];

class ConfigLoader {
  constructor(projectDir) {
    this.projectDir = projectDir || process.cwd();
    this.config = null;
    this.configPath = null;
  }

  load(configPath) {
    if (configPath) {
      const resolved = path.resolve(configPath);
      if (!fs.existsSync(resolved)) {
        throw new MigrationError('CONFIG_NOT_FOUND', `Configuration file not found: ${resolved}`, { path: resolved });
      }
      this.configPath = resolved;
    } else {
      this.configPath = this._findConfigFile();
    }

    if (!this.configPath) {
      throw new MigrationError(
        'CONFIG_NOT_FOUND',
        `No configuration file found. Run "db-migrate init" to create one.`,
        { searchedPaths: CONFIG_FILENAMES }
      );
    }

    const content = fs.readFileSync(this.configPath, 'utf8');
    const ext = path.extname(this.configPath);

    try {
      if (ext === '.yml' || ext === '.yaml') {
        this.config = yaml.load(content);
      } else if (ext === '.json') {
        this.config = JSON.parse(content);
      } else {
        throw new MigrationError('CONFIG_PARSE_ERROR', `Unsupported config file format: ${ext}`, { path: this.configPath });
      }
    } catch (err) {
      if (err instanceof MigrationError) throw err;
      throw new MigrationError(
        'CONFIG_PARSE_ERROR',
        `Failed to parse configuration file "${this.configPath}": ${err.message}`,
        { path: this.configPath, originalError: err.message }
      );
    }

    this._applyDefaults();
    return this.config;
  }

  _findConfigFile() {
    const configDir = path.join(this.projectDir, 'config');

    for (const filename of CONFIG_FILENAMES) {
      const configPath = path.join(this.projectDir, filename);
      if (fs.existsSync(configPath)) return configPath;

      const inConfigDir = path.join(configDir, filename);
      if (fs.existsSync(inConfigDir)) return inConfigDir;
    }

    return null;
  }

  _applyDefaults() {
    if (!this.config.migration) this.config.migration = {};
    if (!this.config.migration.directory) this.config.migration.directory = 'migrations';
    if (!this.config.migration.versionTable) this.config.migration.versionTable = 'schema_migrations';
    if (!this.config.migration.timestampFormat) this.config.migration.timestampFormat = 'YYYYMMDDHHmmss';
    if (!this.config.migration.fileEncoding) this.config.migration.fileEncoding = 'utf-8';

    if (!this.config.logging) this.config.logging = {};
    if (!this.config.logging.level) this.config.logging.level = 'info';
    if (!this.config.logging.directory) this.config.logging.directory = 'logs';
    if (!this.config.logging.maxFileSize) this.config.logging.maxFileSize = 10485760;
    if (!this.config.logging.maxFiles) this.config.logging.maxFiles = 5;
    if (this.config.logging.compress === undefined) this.config.logging.compress = true;

    if (!this.config.environments) this.config.environments = {};
  }

  getEnvironmentConfig(envName) {
    if (!this.config) {
      throw new MigrationError('CONFIG_NOT_FOUND', 'Configuration not loaded. Call load() first.');
    }

    if (!this.config.environments[envName]) {
      const available = Object.keys(this.config.environments);
      throw new MigrationError(
        'CONFIG_NOT_FOUND',
        `Environment "${envName}" not found in configuration. Available: ${available.join(', ') || 'none'}`,
        { envName, available }
      );
    }

    return this.config.environments[envName];
  }

  getMigrationConfig() {
    if (!this.config) {
      throw new MigrationError('CONFIG_NOT_FOUND', 'Configuration not loaded. Call load() first.');
    }
    return this.config.migration;
  }

  getLoggingConfig() {
    if (!this.config) {
      throw new MigrationError('CONFIG_NOT_FOUND', 'Configuration not loaded. Call load() first.');
    }
    return this.config.logging;
  }

  save(config, configPath) {
    const targetPath = configPath || this.configPath || path.join(this.projectDir, 'config', 'settings.yml');
    const dir = path.dirname(targetPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ext = path.extname(targetPath);
    let content;

    if (ext === '.yml' || ext === '.yaml') {
      content = yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true });
    } else if (ext === '.json') {
      content = JSON.stringify(config, null, 2);
    } else {
      content = yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true });
    }

    fs.writeFileSync(targetPath, content, 'utf8');
    this.config = config;
    this.configPath = targetPath;
    return targetPath;
  }
}

module.exports = ConfigLoader;
