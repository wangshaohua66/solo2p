const path = require('path');
const fs = require('fs');
const { ValidationError } = require('./errors');

const VALID_DRIVERS = ['mysql', 'postgresql', 'sqlite'];
const VERSION_PATTERN = /^\d{14}$/;
const MIGRATION_FILE_PATTERN = /^\d{14}_[\w-]+\.js$/;
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9_./-]+$/;
const ENVIRONMENTS = ['development', 'test', 'staging', 'production'];

class Validator {
  validateDatabaseConfig(config, envName) {
    const errors = [];

    if (!config) {
      throw new ValidationError('CONFIG_NOT_FOUND', `Configuration for environment "${envName}" not found.`);
    }

    if (!config.driver) {
      errors.push('Missing required field: driver');
    } else if (!VALID_DRIVERS.includes(config.driver)) {
      errors.push(`Invalid driver "${config.driver}". Supported: ${VALID_DRIVERS.join(', ')}`);
    }

    if (config.driver !== 'sqlite') {
      if (!config.host) errors.push('Missing required field: host');
      if (!config.port) {
        errors.push('Missing required field: port');
      } else if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
        errors.push(`Invalid port: ${config.port}. Must be an integer between 1 and 65535`);
      }
      if (!config.user) errors.push('Missing required field: user');
    }

    if (!config.database) errors.push('Missing required field: database');

    if (config.connectionLimit !== undefined) {
      if (!Number.isInteger(config.connectionLimit) || config.connectionLimit < 1 || config.connectionLimit > 50) {
        errors.push(`Invalid connectionLimit: ${config.connectionLimit}. Must be between 1 and 50`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('VALIDATION_ERROR', `Database configuration validation failed for "${envName}":\n  ${errors.join('\n  ')}`, { environment: envName, errors });
    }

    return true;
  }

  validateVersion(version) {
    if (!version) {
      throw new ValidationError('VALIDATION_ERROR', 'Version number is required.');
    }
    if (!VERSION_PATTERN.test(version)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid version format "${version}". Expected 14-digit timestamp (e.g., 20240101120000).`,
        { version }
      );
    }
    return true;
  }

  validateMigrationFileName(fileName) {
    if (!fileName) {
      throw new ValidationError('VALIDATION_ERROR', 'Migration file name is required.');
    }
    if (!MIGRATION_FILE_PATTERN.test(fileName)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid migration file name "${fileName}". Expected format: YYYYMMDDHHmmss_name.js (e.g., 20240101120000_create_users.js).`,
        { fileName }
      );
    }
    return true;
  }

  validateMigrationScript(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new ValidationError('MIGRATION_NOT_FOUND', `Migration script not found: ${filePath}`);
    }

    try {
      const migration = require(filePath);
      const errors = [];

      if (typeof migration.up !== 'function') {
        errors.push('Migration must export an "up" function');
      }
      if (typeof migration.down !== 'function') {
        errors.push('Migration must export a "down" function');
      }

      if (errors.length > 0) {
        throw new ValidationError(
          'MIGRATION_SYNTAX_ERROR',
          `Migration script validation failed for "${path.basename(filePath)}":\n  ${errors.join('\n  ')}`,
          { filePath, errors }
        );
      }

      return true;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(
        'MIGRATION_SYNTAX_ERROR',
        `Failed to load migration script "${path.basename(filePath)}": ${err.message}`,
        { filePath, originalError: err.message }
      );
    }
  }

  validateFilePath(filePath) {
    if (!filePath) {
      throw new ValidationError('VALIDATION_ERROR', 'File path is required.');
    }
    const resolved = path.resolve(filePath);
    if (!SAFE_PATH_PATTERN.test(resolved.replace(/\\/g, '/'))) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid file path "${filePath}". Path contains unsafe characters.`,
        { filePath }
      );
    }
    return true;
  }

  validateDirectory(dirPath, options = {}) {
    const { createIfMissing = false } = options;

    if (!dirPath) {
      throw new ValidationError('VALIDATION_ERROR', 'Directory path is required.');
    }

    const resolved = path.resolve(dirPath);

    if (!fs.existsSync(resolved)) {
      if (createIfMissing) {
        fs.mkdirSync(resolved, { recursive: true });
        return true;
      }
      throw new ValidationError(
        'DIRECTORY_NOT_FOUND',
        `Directory not found: ${resolved}. Run "db-migrate init" to create the project structure.`,
        { dirPath: resolved }
      );
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Path exists but is not a directory: ${resolved}`,
        { dirPath: resolved }
      );
    }

    return true;
  }

  validateEnvironment(envName, config) {
    if (!envName) {
      throw new ValidationError('VALIDATION_ERROR', 'Environment name is required.');
    }
    if (!ENVIRONMENTS.includes(envName)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid environment "${envName}". Supported: ${ENVIRONMENTS.join(', ')}`,
        { envName }
      );
    }
    if (!config.environments || !config.environments[envName]) {
      throw new ValidationError(
        'CONFIG_NOT_FOUND',
        `Configuration for environment "${envName}" not found. Available: ${Object.keys(config.environments || {}).join(', ') || 'none'}`,
        { envName }
      );
    }
    return true;
  }

  validateMigrationName(name) {
    if (!name) {
      throw new ValidationError('VALIDATION_ERROR', 'Migration name is required.');
    }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid migration name "${name}". Use lowercase letters, numbers, and underscores. Must start with a letter.`,
        { name }
      );
    }
    if (name.length > 100) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Migration name too long (${name.length} chars). Maximum: 100 characters.`,
        { name }
      );
    }
    return true;
  }

  validateRollbackCount(count) {
    const num = Number(count);
    if (!Number.isInteger(num) || num < 1) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Invalid rollback count "${count}". Must be a positive integer.`,
        { count }
      );
    }
    return true;
  }

  validateTargetVersion(targetVersion, appliedMigrations) {
    this.validateVersion(targetVersion);

    const appliedVersions = appliedMigrations.map(m => m.version);
    if (!appliedVersions.includes(targetVersion)) {
      throw new ValidationError(
        'VALIDATION_ERROR',
        `Target version "${targetVersion}" is not in the applied migrations. Cannot rollback to a version that was never applied.`,
        { targetVersion, appliedVersions }
      );
    }
    return true;
  }

  checkFileNameConflict(version, migrationDir) {
    if (!fs.existsSync(migrationDir)) return false;

    const files = fs.readdirSync(migrationDir);
    const conflicting = files.find(f => f.startsWith(version + '_'));

    if (conflicting) {
      throw new ValidationError(
        'FILE_NAME_CONFLICT',
        `A migration file with timestamp "${version}" already exists: ${conflicting}. Use a different name or wait a moment for a new timestamp.`,
        { version, existingFile: conflicting }
      );
    }
    return false;
  }
}

module.exports = Validator;
