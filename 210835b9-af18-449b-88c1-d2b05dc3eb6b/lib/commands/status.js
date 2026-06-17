const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const ConfigLoader = require('../core/config');
const DatabaseManager = require('../core/database');
const MigrationManager = require('../core/migration');
const Validator = require('../core/validator');
const Logger = require('../core/logger');
const { MigrationError } = require('../core/errors');

const validator = new Validator();

async function statusCommand(argv) {
  const env = argv.env || 'development';
  let config, db, logger;

  try {
    const loader = new ConfigLoader(process.cwd());
    config = loader.load(argv.config);

    validator.validateEnvironment(env, config);

    const envConfig = loader.getEnvironmentConfig(env);
    validator.validateDatabaseConfig(envConfig, env);

    const migrationConfig = loader.getMigrationConfig();
    const loggingConfig = loader.getLoggingConfig();
    logger = new Logger(loggingConfig);

    db = new DatabaseManager(envConfig);
    await db.connect();

    const manager = new MigrationManager({
      migrationDir: path.resolve(migrationConfig.directory),
      versionTable: migrationConfig.versionTable,
      db,
    });

    const startTime = Date.now();
    const status = await manager.getFullStatus();
    const elapsedMs = Date.now() - startTime;

    logger.info(`Status query completed in ${elapsedMs}ms`, { env, elapsedMs, totalMigrations: status.local.length });

    _displayStatus(status, env, elapsedMs);

    await db.close();
  } catch (err) {
    logger && logger.error(`Status query failed: ${err.message}`, { env, error: err.message });
    console.log(chalk.red('\n  ❌ ' + err.message));
    if (err.suggestion) {
      console.log(chalk.yellow('\n  💡 Suggestion: ' + err.suggestion + '\n'));
    }
    if (db) {
      try { await db.close(); } catch (e) {}
    }
    process.exit(1);
  }
}

function _displayStatus(status, env, elapsedMs) {
  console.log();
  console.log(chalk.cyan('  ┌───────────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │') + chalk.white.bold('           Database Migration Status Report           ') + chalk.cyan('│'));
  console.log(chalk.cyan('  └───────────────────────────────────────────────────────────┘'));
  console.log();
  console.log(chalk.white('  Environment:        ') + chalk.yellow(env));
  console.log(chalk.white('  Total migrations:   ') + chalk.cyan(status.local.length));
  console.log(chalk.white('  Applied:            ') + chalk.green(status.applied.length));
  console.log(chalk.white('  Pending:            ') + chalk.yellow(status.pending.length));
  console.log(chalk.white('  Conflicts:          ') + (status.conflicts.length > 0 ? chalk.red(status.conflicts.length) : chalk.gray(status.conflicts.length)));
  console.log(chalk.white('  Query time:         ') + chalk.gray(elapsedMs + 'ms'));
  console.log();

  if (status.applied.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan.bold('Version'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('Executed At'),
        chalk.cyan.bold('Duration (ms)'),
      ],
      colWidths: [22, 30, 28, 14],
      style: { head: [], border: ['gray'] },
    });

    for (const m of status.applied) {
      table.push([
        chalk.green(m.version),
        chalk.white(m.name),
        chalk.gray(m.executedAt ? new Date(m.executedAt).toLocaleString() : '-'),
        chalk.gray(m.executionTimeMs || '-'),
      ]);
    }

    console.log(chalk.green('  ✅ Applied Migrations'));
    console.log(table.toString());
    console.log();
  }

  if (status.pending.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan.bold('Version'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('File'),
        chalk.cyan.bold('Dependencies'),
      ],
      colWidths: [22, 30, 35, 25],
      style: { head: [], border: ['gray'] },
    });

    for (const m of status.pending) {
      table.push([
        chalk.yellow(m.version),
        chalk.white(m.name),
        chalk.gray(m.fileName),
        chalk.gray(m.dependencies && m.dependencies.length > 0 ? m.dependencies.join(', ') : '-'),
      ]);
    }

    console.log(chalk.yellow('  ⏳ Pending Migrations'));
    console.log(table.toString());
    console.log();
  }

  if (status.conflicts.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan.bold('Version'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('Reason'),
      ],
      colWidths: [22, 30, 50],
      style: { head: [], border: ['gray'] },
    });

    for (const m of status.conflicts) {
      table.push([
        chalk.red(m.version),
        chalk.white(m.name || '-'),
        chalk.red(m.reason || m.syntaxError || 'Unknown conflict'),
      ]);
    }

    console.log(chalk.red('  ⚠  Conflicts Detected'));
    console.log(table.toString());
    console.log();
  }

  if (status.applied.length === 0 && status.pending.length === 0 && status.conflicts.length === 0) {
    console.log(chalk.gray('  No migrations found in the migrations directory.'));
    console.log(chalk.gray('  Run "db-migrate create <name>" to create your first migration.'));
    console.log();
  }
}

module.exports = statusCommand;
