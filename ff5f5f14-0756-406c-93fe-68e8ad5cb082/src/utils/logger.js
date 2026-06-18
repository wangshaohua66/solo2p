const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

const transportOptions = {
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  maxSize: '20m',
  dirname: logDir
};

const infoTransport = new DailyRotateFile({
  ...transportOptions,
  filename: 'info-%DATE%.log',
  level: 'info'
});

const warnTransport = new DailyRotateFile({
  ...transportOptions,
  filename: 'warn-%DATE%.log',
  level: 'warn'
});

const errorTransport = new DailyRotateFile({
  ...transportOptions,
  filename: 'error-%DATE%.log',
  level: 'error'
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [infoTransport, warnTransport, errorTransport, consoleTransport],
  exitOnError: false
});

logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

module.exports = logger;
