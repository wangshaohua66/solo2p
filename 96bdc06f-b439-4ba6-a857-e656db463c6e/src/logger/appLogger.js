const winston = require('winston');
const path = require('path');
const chalk = require('chalk');
const { getConfig } = require('../config');

let loggerInstance = null;

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'magenta'
  }
};

winston.addColors(customLevels.colors);

function createLogger() {
  if (loggerInstance) {
    return loggerInstance;
  }

  const logConfig = getConfig('logging', {});
  const logLevel = logConfig.level || 'info';
  const transports = [];

  if (logConfig.console?.enabled) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const levelStr = level.toUpperCase().padEnd(7);
            let coloredLevel;
            switch (level) {
              case 'error':
                coloredLevel = chalk.red.bold(levelStr);
                break;
              case 'warn':
                coloredLevel = chalk.yellow.bold(levelStr);
                break;
              case 'info':
                coloredLevel = chalk.green.bold(levelStr);
                break;
              case 'debug':
                coloredLevel = chalk.blue.bold(levelStr);
                break;
              default:
                coloredLevel = chalk.white(levelStr);
            }
            
            const metaStr = Object.keys(meta).length > 0 
              ? ' ' + JSON.stringify(meta) 
              : '';
            
            return `${chalk.gray(timestamp)} ${coloredLevel} ${message}${metaStr}`;
          })
        )
      })
    );
  }

  if (logConfig.file?.enabled) {
    const filePath = path.join(
      logConfig.file.path || './logs',
      logConfig.file.filename || 'trademark-monitor-%DATE%.log'
    );
    transports.push(
      new winston.transports.File({
        filename: filePath,
        level: logLevel,
        maxsize: parseSize(logConfig.file.maxSize || '20m'),
        maxFiles: logConfig.file.maxFiles || '30d',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        )
      })
    );
  }

  if (logConfig.errorFile?.enabled) {
    const errorPath = path.join(
      logConfig.errorFile.path || './logs',
      logConfig.errorFile.filename || 'error-%DATE%.log'
    );
    transports.push(
      new winston.transports.File({
        filename: errorPath,
        level: 'error',
        maxsize: parseSize(logConfig.errorFile.maxSize || '20m'),
        maxFiles: logConfig.errorFile.maxFiles || '30d',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        )
      })
    );
  }

  loggerInstance = winston.createLogger({
    levels: customLevels.levels,
    level: logLevel,
    transports: transports,
    exitOnError: false
  });

  return loggerInstance;
}

function parseSize(sizeStr) {
  if (typeof sizeStr === 'number') return sizeStr;
  const match = sizeStr.match(/^(\d+)([kmgt]?)$/i);
  if (!match) return 20 * 1024 * 1024;
  
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    '': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
    't': 1024 * 1024 * 1024 * 1024
  };
  
  return num * (multipliers[unit] || 1);
}

function getLogger() {
  return createLogger();
}

module.exports = {
  getLogger,
  createLogger
};
