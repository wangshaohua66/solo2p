const winston = require('winston');
const chalk = require('chalk');
const path = require('path');
const moment = require('moment');
const { paths } = require('../../config/schedule');

const colorizeLevel = (level) => {
  const upper = level.toUpperCase();
  switch (level) {
    case 'error':
      return chalk.bgRed.white.bold(` ${upper} `);
    case 'warn':
      return chalk.bgYellow.black.bold(` ${upper} `);
    case 'info':
      return chalk.bgBlue.white.bold(` ${upper} `);
    case 'debug':
      return chalk.bgGray.white.bold(` ${upper} `);
    default:
      return chalk.white(upper);
  }
};

const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const ts = chalk.gray(timestamp);
  const lvl = colorizeLevel(level);
  const msg = level === 'error' ? chalk.red(message) : level === 'warn' ? chalk.yellow(message) : chalk.white(message);
  const metaStr = Object.keys(meta).length ? chalk.gray(' ' + JSON.stringify(meta)) : '';
  return `${ts} ${lvl} ${msg}${metaStr}`;
});

const fileFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'reg-collector' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    }),
    new winston.transports.File({
      filename: path.join(paths.logs, `error-${moment().format('YYYYMMDD')}.log`),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
      )
    }),
    new winston.transports.File({
      filename: path.join(paths.logs, `collector-${moment().format('YYYYMMDD')}.log`),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
      )
    })
  ]
});

let isVerbose = false;

const setVerbose = (v) => {
  isVerbose = v;
  if (v) {
    logger.level = 'debug';
  }
};

const getVerbose = () => isVerbose;

const verbose = (message, meta) => {
  if (isVerbose) {
    logger.debug(message, meta);
  }
};

module.exports = {
  logger,
  setVerbose,
  getVerbose,
  verbose,
  chalk
};
