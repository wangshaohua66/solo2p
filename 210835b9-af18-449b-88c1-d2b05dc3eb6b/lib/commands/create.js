const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ConfigLoader = require('../core/config');
const MigrationManager = require('../core/migration');
const Validator = require('../core/validator');
const Logger = require('../core/logger');
const { MigrationError } = require('../core/errors');

const validator = new Validator();

const DEFAULT_TEMPLATE = `/**
 * Migration: {{name}}
 * Version: {{version}}
 * Description: Add your description here
 * Dependencies: {{dependencies}}
 */

'use strict';

/**
 * Apply the migration
 * @param {import('../core/database')} db - Database manager instance
 */
async function up(db) {
  // TODO: Implement your migration logic here
  // Example:
  // await db.query('CREATE TABLE example (id INT PRIMARY KEY, name VARCHAR(255))');
}

/**
 * Rollback the migration
 * @param {import('../core/database')} db - Database manager instance
 */
async function down(db) {
  // TODO: Implement your rollback logic here
  // Example:
  // await db.query('DROP TABLE IF EXISTS example');
}

module.exports = { up, down };
`;

async function createCommand(argv) {
  const name = argv.name;
  let config;
  let migrationConfig;
  let logger;

  try {
    const loader = new ConfigLoader(process.cwd());
    config = loader.load(argv.config);
    migrationConfig = loader.getMigrationConfig();
    const loggingConfig = loader.getLoggingConfig();
    logger = new Logger(loggingConfig);
  } catch (err) {
    if (err instanceof MigrationError) {
      console.log(chalk.red('\n  ❌ ' + err.message));
      if (err.suggestion) {
        console.log(chalk.yellow('\n  💡 Suggestion: ' + err.suggestion + '\n'));
      }
      process.exit(1);
    }
    throw err;
  }

  try {
    validator.validateMigrationName(name);

    const migrationDir = path.resolve(migrationConfig.directory);
    const manager = new MigrationManager({
      migrationDir,
      versionTable: migrationConfig.versionTable,
    });

    const { version, fileName, filePath } = manager.generateMigrationFilePath(name, migrationDir);

    let template = DEFAULT_TEMPLATE;
    if (argv.template) {
      const templatePath = path.resolve(argv.template);
      validator.validateFilePath(templatePath);
      if (!fs.existsSync(templatePath)) {
        throw new MigrationError('MIGRATION_NOT_FOUND', `Template file not found: ${templatePath}`, { templatePath });
      }
      template = fs.readFileSync(templatePath, 'utf8');
    }

    const content = template
      .replace(/\{\{name\}\}/g, name)
      .replace(/\{\{version\}\}/g, version)
      .replace(/\{\{dependencies\}\}/g, argv.dependencies ? argv.dependencies.join(', ') : 'none');

    fs.writeFileSync(filePath, content, 'utf8');

    logger.info(`Migration created: ${version}_${name}`, { version, name, filePath });

    console.log(chalk.green('\n  ✅ Migration created successfully!\n'));
    console.log(chalk.white('  File: ') + chalk.cyan(filePath));
    console.log(chalk.white('  Version: ') + chalk.cyan(version));
    console.log(chalk.white('  Name: ') + chalk.cyan(name));
    console.log();
  } catch (err) {
    logger && logger.error(`Create failed: ${err.message}`, { name, error: err.message });
    console.log(chalk.red('\n  ❌ ' + err.message));
    if (err.suggestion) {
      console.log(chalk.yellow('\n  💡 Suggestion: ' + err.suggestion + '\n'));
    }
    process.exit(1);
  }
}

module.exports = createCommand;
