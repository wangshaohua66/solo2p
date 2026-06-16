import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { resolve } from 'path';
import { getEnv } from '../config.js';

const LOG_DIR = getEnv('LOG_DIR', './logs');

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

const errorTransport = new DailyRotateFile({
  filename: resolve(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

const combinedTransport = new DailyRotateFile({
  filename: resolve(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

const taskTransport = new DailyRotateFile({
  filename: resolve(LOG_DIR, 'task-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
});

const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: 'info',
});

export const logger = winston.createLogger({
  level: 'debug',
  defaultMeta: { service: 'vehicle-verifier' },
  transports: [
    errorTransport,
    combinedTransport,
    taskTransport,
    consoleTransport,
  ],
});

export function createTaskLogger(taskName) {
  return logger.child({ task: taskName });
}

export default logger;
