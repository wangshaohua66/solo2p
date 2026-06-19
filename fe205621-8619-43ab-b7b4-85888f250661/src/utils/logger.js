const winston = require('winston');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { SYSTEM_CONFIG } = require('../../config/hospitals');

const logDir = SYSTEM_CONFIG.logDir;

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey'
};

winston.addColors(logColors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const ts = chalk.gray(`[${timestamp}]`);
    const lvl = winston.format.colorize().colorize(level, level.toUpperCase().padEnd(7));
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const extra = Object.keys(args).length ? JSON.stringify(args, null, 2) : '';
    return `${ts} ${lvl} ${msg} ${extra ? extra : ''}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10
    })
  ],
  exitOnError: false
});

class Logger {
  constructor(prefix) {
    this.prefix = prefix || '';
  }

  _prefixMessage(message, prefix) {
    const p = prefix || this.prefix;
    return p ? `[${p}] ${message}` : message;
  }

  error(message, ...args) {
    logger.error(this._prefixMessage(message), ...args);
  }

  warn(message, ...args) {
    logger.warn(this._prefixMessage(message), ...args);
  }

  info(message, ...args) {
    logger.info(this._prefixMessage(message), ...args);
  }

  http(message, ...args) {
    logger.http(this._prefixMessage(message), ...args);
  }

  verbose(message, ...args) {
    logger.verbose(this._prefixMessage(message), ...args);
  }

  debug(message, ...args) {
    logger.debug(this._prefixMessage(message), ...args);
  }

  silly(message, ...args) {
    logger.silly(this._prefixMessage(message), ...args);
  }

  child(prefix) {
    return new Logger(prefix);
  }

  static getInstance(prefix) {
    return new Logger(prefix);
  }
}

const createLogger = (prefix) => new Logger(prefix);

module.exports = {
  logger,
  Logger,
  createLogger,
  default: logger
};
