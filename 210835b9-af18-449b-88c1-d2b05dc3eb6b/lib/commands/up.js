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

async function upCommand(argv) {
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

    if (status.conflicts.length > 0) {
      console.log(chalk.red('\n  ❌ Cannot proceed with migrations due to conflicts:\n'));
      for (const c of status.conflicts) {
        console.log(chalk.red(`    ${c.version}: ${c.reason || c.syntaxError}`));
      }
      console.log(chalk.yellow('\n  Resolve conflicts before running migrations.\n'));
      await db.close();
      process.exit(1);
    }

    let toApply = manager.sortMigrations(status.pending);

    if (argv.to) {
      validator.validateVersion(argv.to);
      const targetIndex = toApply.findIndex(m => m.version === argv.to);
      if (targetIndex === -1) {
        console.log(chalk.yellow(`\n  Target version "${argv.to}" is already applied or not found.\n`));
        await db.close();
        return;
      }
      toApply = toApply.slice(0, targetIndex + 1);
    }

    if (argv.step) {
      validator.validateRollbackCount(argv.step);
      toApply = toApply.slice(0, argv.step);
    }

    if (toApply.length === 0) {
      console.log(chalk.gray('\n  No pending migrations to apply. Database is up to date.\n'));
      await db.close();
      return;
    }

    console.log(chalk.cyan('\n  📋 Migration Plan\n'));
    console.log(chalk.white(`  Environment: ${chalk.yellow(env)}`));
    console.log(chalk.white(`  Pending:     ${chalk.cyan(toApply.length)} migration(s)\n`));

    if (!argv.yes) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Apply ${toApply.length} migration(s) to "${env}" environment?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('\n  Migration cancelled.\n'));
        await db.close();
        return;
      }
    }

    report = {
      env,
      startTime: new Date().toISOString(),
      total: toApply.length,
      successful: [],
      failed: [],
      skipped: [],
    };

    const progressBar = new cliProgress.SingleBar({
      format: '  {bar} | {percentage}% | {value}/{total} | {version}',
      hideCursor: true,
      clearOnComplete: false,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_classic);

    progressBar.start(toApply.length, 0, { version: '' });

    for (const migration of toApply) {
      progressBar.update(undefined, { version: migration.version });

      const result = await _executeMigration(db, migration, migrationConfig.versionTable, logger);

      if (result.success) {
        report.successful.push(result);
        progressBar.increment();
      } else {
        report.failed.push(result);
        progressBar.stop();
        console.log(chalk.red(`\n\n  ❌ Migration failed: ${migration.version}_${migration.name}`));
        console.log(chalk.red(`     Error: ${result.error}`));
        console.log(chalk.yellow(`\n  💡 The failed migration was rolled back. Fix the script and rerun.\n`));
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
    logger && logger.error(`Up command failed: ${err.message}`, { env, error: err.message });
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

async function _executeMigration(db, migration, versionTable, logger) {
  const startTime = Date.now();
  logger.logMigrationStart(migration.version, migration.name);

  try {
    const migrationModule = require(migration.filePath);
    if (typeof migrationModule.up !== 'function') {
      throw new MigrationError('MIGRATION_SYNTAX_ERROR', `Migration "${migration.fileName}" does not export an up() function.`);
    }

    await db.beginTransaction();
    await migrationModule.up({
      query: (...args) => db.executeInTransaction(...args),
      driver: db.driver,
      config: db.config,
    });
    await db.commitTransaction();

    const executionTimeMs = Date.now() - startTime;
    await db.recordMigration(versionTable, migration.version, migration.name, executionTimeMs);

    logger.logMigrationSuccess(migration.version, migration.name, executionTimeMs);

    return {
      version: migration.version,
      name: migration.name,
      success: true,
      executionTimeMs,
      executedAt: new Date().toISOString(),
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    logger.logMigrationFailure(migration.version, migration.name, err);

    try {
      await db.rollbackTransaction();
      logger.info(`Migration rolled back: ${migration.version}_${migration.name}`, { version: migration.version, executionTimeMs });
    } catch (rollbackErr) {
      logger.error(`Rollback failed for ${migration.version}: ${rollbackErr.message}`, { version: migration.version, error: rollbackErr.message });
    }

    return {
      version: migration.version,
      name: migration.name,
      success: false,
      executionTimeMs,
      error: err.message,
      executedAt: new Date().toISOString(),
    };
  }
}

function _displayReport(report) {
  console.log();
  console.log(chalk.cyan('  ┌───────────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │') + chalk.white.bold('             Migration Execution Report              ') + chalk.cyan('│'));
  console.log(chalk.cyan('  └───────────────────────────────────────────────────────────┘'));
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
        chalk.green('✓ SUCCESS'),
      ]);
    }

    console.log(chalk.green('  Successful Migrations'));
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

    console.log(chalk.red('  Failed Migrations'));
    console.log(table.toString());
    console.log();
  }
}

module.exports = upCommand;
