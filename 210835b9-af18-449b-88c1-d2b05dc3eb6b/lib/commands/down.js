const path = require('path');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const ConfigLoader = require('../core/config');
const DatabaseManager = require('../core/database');
const MigrationManager = require('../core/migration');
const Validator = require('../core/validator');
const Logger = require('../core/logger');
const { MigrationError } = require('../core/errors');

const validator = new Validator();

async function downCommand(argv) {
  const env = argv.env || 'development';
  let db, logger, report;

  try {
    const loader = new ConfigLoader(process.cwd());
    const config = loader.load(argv.config);

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

    await db.ensureVersionTable(migrationConfig.versionTable);

    const status = await manager.getFullStatus();

    if (status.applied.length === 0) {
      console.log(chalk.gray('\n  No applied migrations to rollback.\n'));
      await db.close();
      return;
    }

    const sortedApplied = [...status.applied].sort((a, b) => b.version.localeCompare(a.version));

    let toRollback = sortedApplied;

    if (argv.to) {
      validator.validateTargetVersion(argv.to, status.applied);
      const targetIndex = sortedApplied.findIndex(m => m.version === argv.to);
      toRollback = sortedApplied.slice(0, targetIndex + 1);
    } else {
      const count = argv.count || 1;
      validator.validateRollbackCount(count);
      toRollback = sortedApplied.slice(0, count);
    }

    if (toRollback.length === 0) {
      console.log(chalk.gray('\n  No migrations to rollback based on the given criteria.\n'));
      await db.close();
      return;
    }

    console.log(chalk.red('\n  ⚠  ROLLBACK PLAN\n'));
    console.log(chalk.white(`  Environment: ${chalk.yellow(env)}`));
    console.log(chalk.white(`  Rollback:    ${chalk.red(toRollback.length)} migration(s)\n`));

    const table = new Table({
      head: [chalk.cyan.bold('#'), chalk.cyan.bold('Version'), chalk.cyan.bold('Name'), chalk.cyan.bold('Executed At')],
      colWidths: [5, 22, 30, 28],
      style: { head: [], border: ['gray'] },
    });

    toRollback.forEach((m, i) => {
      table.push([
        chalk.gray(String(i + 1)),
        chalk.red(m.version),
        chalk.white(m.name),
        chalk.gray(m.executedAt ? new Date(m.executedAt).toLocaleString() : '-'),
      ]);
    });
    console.log(table.toString());
    console.log();

    if (!argv.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red.bold(`⚠  Confirm rollback of ${toRollback.length} migration(s)? This action cannot be undone.`),
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('\n  Rollback cancelled.\n'));
        await db.close();
        return;
      }
    }

    report = {
      env,
      startTime: new Date().toISOString(),
      total: toRollback.length,
      successful: [],
      failed: [],
    };

    const progressBar = new cliProgress.SingleBar({
      format: '  {bar} | {percentage}% | {value}/{total} | {version}',
      hideCursor: true,
      clearOnComplete: false,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_classic);

    progressBar.start(toRollback.length, 0, { version: '' });

    for (const migration of toRollback) {
      progressBar.update(undefined, { version: migration.version });

      const result = await _executeRollback(db, migration, migrationConfig, logger);

      if (result.success) {
        report.successful.push(result);
        progressBar.increment();
      } else {
        report.failed.push(result);
        progressBar.stop();
        console.log(chalk.red(`\n\n  ❌ Rollback failed: ${migration.version}_${migration.name}`));
        console.log(chalk.red(`     Error: ${result.error}`));
        console.log(chalk.yellow(`\n  💡 The failed rollback was rolled back. Check the down() function.\n`));
        break;
      }
    }

    progressBar.stop();

    _displayReport(report);
    await db.close();

    if (report.failed.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    logger && logger.error(`Down command failed: ${err.message}`, { env, error: err.message });
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

async function _executeRollback(db, migration, migrationConfig, logger) {
  const startTime = Date.now();
  logger.logRollbackStart(migration.version, migration.name);

  try {
    let migrationModule = null;
    let filePath = migration.filePath;

    if (!filePath) {
      const fs = require('fs');
      const migrationDir = path.resolve(migrationConfig.directory);
      if (fs.existsSync(migrationDir)) {
        const files = fs.readdirSync(migrationDir).filter(f => f.startsWith(migration.version + '_'));
        if (files.length > 0) {
          filePath = path.join(migrationDir, files[0]);
        }
      }
    }

    if (filePath) {
      delete require.cache[require.resolve(filePath)];
      migrationModule = require(filePath);
    }

    if (!migrationModule || typeof migrationModule.down !== 'function') {
      throw new MigrationError(
        'MIGRATION_SYNTAX_ERROR',
        `Migration "${migration.version}" does not have a valid down() function. File may be missing or invalid.`,
        { version: migration.version }
      );
    }

    await db.beginTransaction();
    await migrationModule.down({
      query: (...args) => db.executeInTransaction(...args),
      driver: db.driver,
      config: db.config,
    });
    await db.commitTransaction();

    await db.removeMigrationRecord(migrationConfig.versionTable, migration.version);

    const executionTimeMs = Date.now() - startTime;
    logger.logRollbackSuccess(migration.version, migration.name, executionTimeMs);

    return {
      version: migration.version,
      name: migration.name,
      success: true,
      executionTimeMs,
      rolledBackAt: new Date().toISOString(),
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    logger.logRollbackFailure(migration.version, migration.name, err);

    try {
      await db.rollbackTransaction();
      logger.info(`Rollback of migration reverted: ${migration.version}`, { version: migration.version, executionTimeMs });
    } catch (rollbackErr) {
      logger.error(`Rollback revert failed for ${migration.version}: ${rollbackErr.message}`, { version: migration.version, error: rollbackErr.message });
    }

    return {
      version: migration.version,
      name: migration.name,
      success: false,
      executionTimeMs,
      error: err.message,
      rolledBackAt: new Date().toISOString(),
    };
  }
}

function _displayReport(report) {
  console.log();
  console.log(chalk.red('  ┌───────────────────────────────────────────────────────────┐'));
  console.log(chalk.red('  │') + chalk.white.bold('             Rollback Execution Report              ') + chalk.red('│'));
  console.log(chalk.red('  └───────────────────────────────────────────────────────────┘'));
  console.log();
  console.log(chalk.white('  Environment:   ') + chalk.yellow(report.env));
  console.log(chalk.white('  Start time:    ') + chalk.gray(report.startTime));
  console.log(chalk.white('  End time:      ') + chalk.gray(new Date().toISOString()));
  console.log(chalk.white('  Total:         ') + chalk.cyan(report.total));
  console.log(chalk.white('  Successful:    ') + chalk.green(report.successful.length));
  console.log(chalk.white('  Failed:        ') + (report.failed.length > 0 ? chalk.red(report.failed.length) : chalk.gray(report.failed.length)));
  console.log();

  if (report.successful.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan.bold('Version'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('Duration (ms)'),
        chalk.cyan.bold('Status'),
      ],
      colWidths: [22, 30, 16, 12],
      style: { head: [], border: ['gray'] },
    });

    for (const m of report.successful) {
      table.push([
        chalk.green(m.version),
        chalk.white(m.name),
        chalk.gray(m.executionTimeMs),
        chalk.green('✓ DONE'),
      ]);
    }

    console.log(chalk.green('  Successful Rollbacks'));
    console.log(table.toString());
    console.log();
  }

  if (report.failed.length > 0) {
    const table = new Table({
      head: [
        chalk.cyan.bold('Version'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('Error'),
        chalk.cyan.bold('Status'),
      ],
      colWidths: [22, 25, 45, 12],
      style: { head: [], border: ['gray'] },
    });

    for (const m of report.failed) {
      table.push([
        chalk.red(m.version),
        chalk.white(m.name),
        chalk.red(m.error),
        chalk.red('✗ FAILED'),
      ]);
    }

    console.log(chalk.red('  Failed Rollbacks'));
    console.log(table.toString());
    console.log();
  }
}

module.exports = downCommand;
