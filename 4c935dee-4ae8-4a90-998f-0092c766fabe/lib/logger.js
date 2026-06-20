'use strict';

const chalk = require('chalk');

function createLogger(options) {
  const opts = options || {};
  const quiet = !!opts.quiet;
  const json = !!opts.json;
  const noColor = !!opts.noColor || !process.stdout.isTTY;

  function paint(color, msg) {
    if (noColor) return msg;
    return color(msg);
  }

  function write(stream, text) {
    if (json) return;
    stream.write(text);
  }

  return {
    error(msg) {
      if (quiet) {
        write(process.stderr, `${msg}\n`);
        return;
      }
      write(process.stderr, `${paint(chalk.red, '[ERROR]')} ${msg}\n`);
    },
    warn(msg) {
      if (quiet) return;
      write(process.stderr, `${paint(chalk.yellow, '[WARN]')} ${msg}\n`);
    },
    success(msg) {
      if (quiet) return;
      write(process.stdout, `${paint(chalk.green, '[OK]')} ${msg}\n`);
    },
    info(msg) {
      if (quiet) return;
      write(process.stdout, `${paint(chalk.blue, '[INFO]')} ${msg}\n`);
    },
    debug(msg) {
      if (quiet || !process.env.SC_DEBUG) return;
      write(process.stderr, `${paint(chalk.gray, '[DEBUG]')} ${msg}\n`);
    },
    raw(msg) {
      if (quiet) return;
      write(process.stdout, `${msg}\n`);
    },
    isQuiet() { return quiet; },
    isJson() { return json; }
  };
}

module.exports = { createLogger };
