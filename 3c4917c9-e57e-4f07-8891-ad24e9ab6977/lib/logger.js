import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.resolve(__dirname, '..', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
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
  debug: 'white',
  silly: 'grey'
};

winston.addColors(logColors);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    let log = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOGS_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat
});

const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOGS_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '30d',
  format: fileFormat
});

const auditFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOGS_DIR, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  maxSize: '50m',
  maxFiles: '90d',
  format: fileFormat
});

let loggerInstance = null;
let debugMode = false;
let quietMode = false;

function createLogger(options = {}) {
  debugMode = options.debug || false;
  quietMode = options.quiet || false;

  const consoleLevel = debugMode ? 'debug' : 'info';
  const transports = [errorFileTransport, combinedFileTransport, auditFileTransport];

  if (!quietMode) {
    transports.push(
      new winston.transports.Console({
        level: consoleLevel,
        format: consoleFormat
      })
    );
  }

  loggerInstance = winston.createLogger({
    levels: logLevels,
    level: debugMode ? 'debug' : 'info',
    transports,
    exitOnError: false,
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(LOGS_DIR, 'exceptions.log'),
        format: fileFormat
      })
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(LOGS_DIR, 'rejections.log'),
        format: fileFormat
      })
    ]
  });

  return loggerInstance;
}

function getLogger() {
  if (!loggerInstance) {
    return createLogger();
  }
  return loggerInstance;
}

function setDebugMode(enabled) {
  debugMode = enabled;
  if (loggerInstance) {
    loggerInstance.level = enabled ? 'debug' : 'info';
  }
}

function setQuietMode(enabled) {
  quietMode = enabled;
}

function isDebugMode() {
  return debugMode;
}

function isQuietMode() {
  return quietMode;
}

function audit(action, details = {}) {
  const logger = getLogger();
  logger.info(`[AUDIT] ${action}`, {
    audit: true,
    action,
    operator: process.env.USER || process.env.USERNAME || 'unknown',
    timestamp: new Date().toISOString(),
    ...details
  });
}

export {
  createLogger,
  getLogger,
  setDebugMode,
  setQuietMode,
  isDebugMode,
  isQuietMode,
  audit,
  LOGS_DIR
};

export default getLogger;
