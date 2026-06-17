const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ConfigLoader = require('../core/config');
const Validator = require('../core/validator');

const validator = new Validator();

async function initCommand(argv) {
  console.log(chalk.cyan('\n  🚀 Database Migration CLI - Project Initialization\n'));

  const configDir = path.join(process.cwd(), 'config');
  const migrationDir = path.join(process.cwd(), 'migrations');
  const logsDir = path.join(process.cwd(), 'logs');

  const configPath = argv.config
    ? path.resolve(argv.config)
    : path.join(configDir, 'settings.yml');

  if (fs.existsSync(configPath) && !argv.force) {
    console.log(chalk.yellow('⚠  Configuration file already exists: ' + configPath));
    console.log(chalk.yellow('   Use --force to overwrite.\n'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'driver',
      message: 'Select the default database driver:',
      choices: ['mysql', 'postgresql', 'sqlite'],
      default: 'mysql',
    },
    {
      type: 'input',
      name: 'host',
      message: 'Database host:',
      default: 'localhost',
      when: (ans) => ans.driver !== 'sqlite',
    },
    {
      type: 'input',
      name: 'port',
      message: 'Database port:',
      default: (ans) => (ans.driver === 'mysql' ? '3306' : '5432'),
      when: (ans) => ans.driver !== 'sqlite',
      validate: (val) => {
        const num = Number(val);
        if (!Number.isInteger(num) || num < 1 || num > 65535) {
          return 'Port must be between 1 and 65535';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'user',
      message: 'Database user:',
      default: 'root',
      when: (ans) => ans.driver !== 'sqlite',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Database password:',
      mask: '*',
      when: (ans) => ans.driver !== 'sqlite',
    },
    {
      type: 'input',
      name: 'database',
      message: (ans) => ans.driver === 'sqlite' ? 'SQLite database file path:' : 'Database name:',
      default: (ans) => ans.driver === 'sqlite' ? './data/app.db' : 'app_dev',
    },
    {
      type: 'input',
      name: 'migrationDir',
      message: 'Migrations directory path:',
      default: 'migrations',
    },
    {
      type: 'input',
      name: 'versionTable',
      message: 'Schema version table name:',
      default: 'schema_migrations',
    },
    {
      type: 'number',
      name: 'connectionLimit',
      message: 'Connection pool size (max):',
      default: 10,
      when: (ans) => ans.driver !== 'sqlite',
    },
    {
      type: 'confirm',
      name: 'setupMultiEnv',
      message: 'Configure all four environments (development, test, staging, production)?',
      default: true,
    },
  ]);

  const environments = {
    development: _buildEnvConfig(answers, 'development'),
  };

  if (answers.setupMultiEnv) {
    const envAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'testDriver',
        message: 'Test environment database driver:',
        choices: ['mysql', 'postgresql', 'sqlite'],
        default: answers.driver,
      },
      {
        type: 'input',
        name: 'testHost',
        message: 'Test database host:',
        default: 'localhost',
        when: (ans) => ans.testDriver !== 'sqlite',
      },
      {
        type: 'input',
        name: 'testPort',
        message: 'Test database port:',
        default: (ans) => (ans.testDriver === 'mysql' ? '3306' : '5432'),
        when: (ans) => ans.testDriver !== 'sqlite',
      },
      {
        type: 'input',
        name: 'testUser',
        message: 'Test database user:',
        default: 'test_user',
        when: (ans) => ans.testDriver !== 'sqlite',
      },
      {
        type: 'password',
        name: 'testPassword',
        message: 'Test database password:',
        mask: '*',
        when: (ans) => ans.testDriver !== 'sqlite',
      },
      {
        type: 'input',
        name: 'testDatabase',
        message: (ans) => ans.testDriver === 'sqlite' ? 'Test SQLite file path:' : 'Test database name:',
        default: (ans) => ans.testDriver === 'sqlite' ? './data/app_test.db' : 'app_test',
      },
      {
        type: 'input',
        name: 'stagingHost',
        message: 'Staging database host:',
        default: 'staging-db.internal',
        when: true,
      },
      {
        type: 'input',
        name: 'stagingPort',
        message: 'Staging database port:',
        default: '3306',
      },
      {
        type: 'input',
        name: 'stagingUser',
        message: 'Staging database user:',
        default: 'staging_user',
      },
      {
        type: 'password',
        name: 'stagingPassword',
        message: 'Staging database password:',
        mask: '*',
      },
      {
        type: 'input',
        name: 'stagingDatabase',
        message: 'Staging database name:',
        default: 'app_staging',
      },
      {
        type: 'input',
        name: 'prodHost',
        message: 'Production database host:',
        default: 'prod-db.internal',
      },
      {
        type: 'input',
        name: 'prodPort',
        message: 'Production database port:',
        default: '3306',
      },
      {
        type: 'input',
        name: 'prodUser',
        message: 'Production database user:',
        default: 'prod_user',
      },
      {
        type: 'password',
        name: 'prodPassword',
        message: 'Production database password:',
        mask: '*',
      },
      {
        type: 'input',
        name: 'prodDatabase',
        message: 'Production database name:',
        default: 'app_production',
      },
    ]);

    environments.test = {
      driver: envAnswers.testDriver,
      host: envAnswers.testHost,
      port: Number(envAnswers.testPort),
      user: envAnswers.testUser,
      password: envAnswers.testPassword,
      database: envAnswers.testDatabase,
      charset: envAnswers.testDriver === 'mysql' ? 'utf8mb4' : 'utf8',
      connectionLimit: 10,
    };

    if (envAnswers.testDriver === 'sqlite') {
      delete environments.test.host;
      delete environments.test.port;
      delete environments.test.user;
      delete environments.test.password;
      delete environments.test.charset;
      delete environments.test.connectionLimit;
    }

    environments.staging = {
      driver: answers.driver,
      host: envAnswers.stagingHost,
      port: Number(envAnswers.stagingPort),
      user: envAnswers.stagingUser,
      password: envAnswers.stagingPassword,
      database: envAnswers.stagingDatabase,
      charset: answers.driver === 'mysql' ? 'utf8mb4' : 'utf8',
      connectionLimit: 20,
    };

    environments.production = {
      driver: answers.driver,
      host: envAnswers.prodHost,
      port: Number(envAnswers.prodPort),
      user: envAnswers.prodUser,
      password: envAnswers.prodPassword,
      database: envAnswers.prodDatabase,
      charset: answers.driver === 'mysql' ? 'utf8mb4' : 'utf8',
      connectionLimit: 50,
    };
  }

  const config = {
    environments,
    migration: {
      directory: answers.migrationDir,
      versionTable: answers.versionTable,
      timestampFormat: 'YYYYMMDDHHmmss',
      fileEncoding: 'utf-8',
    },
    logging: {
      level: 'info',
      directory: 'logs',
      maxFileSize: 10485760,
      maxFiles: 5,
      compress: true,
    },
  };

  const loader = new ConfigLoader(process.cwd());
  const savedPath = loader.save(config, configPath);

  const resolvedMigrationDir = path.resolve(answers.migrationDir);
  if (!fs.existsSync(resolvedMigrationDir)) {
    fs.mkdirSync(resolvedMigrationDir, { recursive: true });
  }

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  console.log(chalk.green('\n  ✅ Project initialized successfully!\n'));
  console.log(chalk.white('  Configuration file: ') + chalk.cyan(savedPath));
  console.log(chalk.white('  Migrations directory: ') + chalk.cyan(resolvedMigrationDir));
  console.log(chalk.white('  Log directory: ') + chalk.cyan(logsDir));
  console.log();
  console.log(chalk.white('  Next steps:'));
  console.log(chalk.white('    1. Review and update ') + chalk.cyan(savedPath) + chalk.white(' with your database credentials'));
  console.log(chalk.white('    2. Run ') + chalk.cyan('db-migrate create <name>') + chalk.white(' to create your first migration'));
  console.log(chalk.white('    3. Run ') + chalk.cyan('db-migrate up') + chalk.white(' to apply pending migrations'));
  console.log();
}

function _buildEnvConfig(answers, envName) {
  if (answers.driver === 'sqlite') {
    return {
      driver: 'sqlite',
      database: answers.database,
    };
  }

  return {
    driver: answers.driver,
    host: answers.host,
    port: Number(answers.port),
    user: answers.user,
    password: answers.password,
    database: answers.database,
    charset: answers.driver === 'mysql' ? 'utf8mb4' : 'utf8',
    connectionLimit: answers.connectionLimit || 10,
  };
}

module.exports = initCommand;
