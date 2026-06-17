#!/usr/bin/env node

'use strict';

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const packageJson = require('../package.json');

function buildCli() {
  return yargs(hideBin(process.argv))
    .scriptName('db-migrate')
    .usage(chalk.cyan('\n  📦 DB Migrate CLI') + chalk.gray(' v' + packageJson.version) + '\n\n  Usage: $0 <command> [options]')
    .command(
      'init',
      chalk.white('Initialize project configuration and migration directory'),
      (yargs) => yargs
        .option('config', {
          alias: 'c',
          describe: 'Configuration file path',
          type: 'string',
          default: 'config/settings.yml',
        })
        .option('force', {
          alias: 'f',
          describe: 'Overwrite existing configuration',
          type: 'boolean',
          default: false,
        }),
      async (argv) => {
        const initCommand = require('../lib/commands/init');
        await initCommand(argv);
      }
    )
    .command(
      'create <name>',
      chalk.white('Create a new migration script with a timestamp'),
      (yargs) => yargs
        .positional('name', {
          describe: 'Migration name (lowercase, use underscores)',
          type: 'string',
        })
        .option('config', {
          alias: 'c',
          describe: 'Configuration file path',
          type: 'string',
        })
        .option('template', {
          alias: 't',
          describe: 'Custom template file path',
          type: 'string',
        })
        .option('dependencies', {
          alias: 'd',
          describe: 'List of dependency migration versions',
          type: 'array',
          default: [],
        }),
      async (argv) => {
        if (!argv.name) {
          console.log(chalk.red('\n  ❌ Migration name is required.\n'));
          console.log(chalk.gray('  Usage: db-migrate create <name>\n'));
          process.exit(1);
        }
        const createCommand = require('../lib/commands/create');
        await createCommand(argv);
      }
    )
    .command(
      'status',
      chalk.white('Show migration status (applied, pending, conflicts)'),
      (yargs) => yargs
        .option('env', {
          alias: 'e',
          describe: 'Target environment',
          type: 'string',
          default: 'development',
          choices: ['development', 'test', 'staging', 'production'],
        })
        .option('config', {
          alias: 'c',
          describe: 'Configuration file path',
          type: 'string',
        }),
      async (argv) => {
        const statusCommand = require('../lib/commands/status');
        await statusCommand(argv);
      }
    )
    .command(
      'up',
      chalk.white('Execute pending migrations in order'),
      (yargs) => yargs
        .option('env', {
          alias: 'e',
          describe: 'Target environment',
          type: 'string',
          default: 'development',
          choices: ['development', 'test', 'staging', 'production'],
        })
        .option('config', {
          alias: 'c',
          describe: 'Configuration file path',
          type: 'string',
        })
        .option('to', {
          describe: 'Migrate up to a specific version (inclusive)',
          type: 'string',
        })
        .option('step', {
          alias: 's',
          describe: 'Number of migrations to execute',
          type: 'number',
        })
        .option('yes', {
          alias: 'y',
          describe: 'Skip confirmation prompt',
          type: 'boolean',
          default: false,
        }),
      async (argv) => {
        const upCommand = require('../lib/commands/up');
        await upCommand(argv);
      }
    )
    .command(
      'down',
      chalk.white('Rollback applied migrations (LIFO order)'),
      (yargs) => yargs
        .option('env', {
          alias: 'e',
          describe: 'Target environment',
          type: 'string',
          default: 'development',
          choices: ['development', 'test', 'staging', 'production'],
        })
        .option('config', {
          alias: 'c',
          describe: 'Configuration file path',
          type: 'string',
        })
        .option('to', {
          describe: 'Rollback down to a specific version (inclusive)',
          type: 'string',
        })
        .option('count', {
          alias: 'n',
          describe: 'Number of migrations to rollback',
          type: 'number',
          default: 1,
        })
        .option('yes', {
          alias: 'y',
          describe: 'Skip confirmation prompt',
          type: 'boolean',
          default: false,
        }),
      async (argv) => {
        const downCommand = require('../lib/commands/down');
        await downCommand(argv);
      }
    )
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose output',
      type: 'boolean',
      default: false,
    })
    .option('quiet', {
      alias: 'q',
      describe: 'Suppress non-essential output',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .alias('version', 'V')
    .epilogue(chalk.gray('  Documentation: https://github.com/your-org/db-migrate-cli\n'))
    .demandCommand(1, chalk.red('\n  ❌ Please specify a command.\n'))
    .strict()
    .fail((msg, err, yargs) => {
      if (err) {
        console.log(chalk.red('\n  ❌ ' + (err.message || err)));
        console.log(chalk.gray('\n  Run "db-migrate --help" for usage information.\n'));
      } else {
        console.log(chalk.red('\n  ❌ ' + msg));
        console.log(chalk.gray('\n  Run "db-migrate --help" for usage information.\n'));
      }
      process.exit(1);
    });
}

buildCli().parse();
