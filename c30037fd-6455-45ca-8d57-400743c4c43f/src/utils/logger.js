'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const chalk = require('chalk');

const LOG_DIR = path.resolve(process.cwd(), 'logs');

const customLevels = {
  levels: {
    error: 0,
    alert: 1,
    warn: 2,
    info: 3,
    debug: 4,
    silly: 5,
  },
  colors: {
    error: 'red',
    alert: 'red bold',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    silly: 'gray',
  },
};

winston.addColors(customLevels.colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, platform, taskId, ...meta } = info;
    const levelStr = info.level.toUpperCase();
    let colorFn;
    switch (level) {
      case 'alert':
      case 'error': colorFn = chalk.red; break;
      case 'warn': colorFn = chalk.yellow; break;
      case 'info': colorFn = chalk.green; break;
      case 'debug': colorFn = chalk.blue; break;
      default: colorFn = chalk.gray;
    }
    const parts = [
      chalk.gray(`[${timestamp}]`),
      colorFn(`[${levelStr.padEnd(5)}]`),
      platform ? chalk.cyan(`[${platform}]`) : '',
      taskId ? chalk.magenta(`[${taskId.substring(0, 8)}]`) : '',
      colorFn(message),
      Object.keys(meta).length ? chalk.gray(' ' + JSON.stringify(meta)) : '',
    ].filter(Boolean);
    return parts.join(' ');
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const alertConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, urgency, message } = info;
    let colorFn = chalk.white;
    if (urgency === 'CRITICAL' || urgency === 4) colorFn = chalk.red.bold;
    else if (urgency === 'HIGH' || urgency === 3) colorFn = chalk.orange || chalk.yellow.bold;
    else if (urgency === 'MEDIUM' || urgency === 2) colorFn = chalk.yellow;
    else if (urgency === 'LOW' || urgency === 1) colorFn = chalk.blue;
    return `${chalk.bgRed.white(' 告警 ')} [${timestamp}] ${colorFn(message)}`;
  })
);

function createLogger() {
  return winston.createLogger({
    levels: customLevels.levels,
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'drug-compliance-monitor' },
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
        handleExceptions: true,
      }),
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '90d',
        format: fileFormat,
      }),
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '90d',
        level: 'error',
        format: fileFormat,
      }),
    ],
    exitOnError: false,
  });
}

function createAlertLogger() {
  return winston.createLogger({
    level: 'info',
    transports: [
      new winston.transports.Console({
        format: alertConsoleFormat,
      }),
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'alerts-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '365d',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
          winston.format.json()
        ),
      }),
    ],
  });
}

function createTaskLogger(taskId, platform) {
  return winston.createLogger({
    levels: customLevels.levels,
    level: 'debug',
    defaultMeta: { taskId, platform },
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
      new DailyRotateFile({
        filename: path.join(LOG_DIR, 'tasks', `task-${taskId}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxFiles: '30d',
        format: fileFormat,
      }),
    ],
  });
}

module.exports = {
  logger: createLogger(),
  alertLogger: createAlertLogger(),
  createTaskLogger,
};
