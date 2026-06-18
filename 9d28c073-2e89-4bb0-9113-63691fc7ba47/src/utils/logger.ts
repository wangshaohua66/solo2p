import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const siteId = meta.siteId ? `[${meta.siteId}]` : '';
    return `${timestamp} ${level} ${siteId} ${message}`;
  })
);

class LoggerManager {
  private loggers: Map<string, winston.Logger> = new Map();
  private rootLogger: winston.Logger;

  constructor() {
    this.rootLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.DailyRotateFile({
          filename: path.join(LOG_DIR, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'info'
        }),
        new winston.transports.Console({
          format: consoleFormat,
          level: 'info'
        })
      ]
    });
  }

  getLogger(siteId?: string): winston.Logger {
    if (!siteId) {
      return this.rootLogger;
    }

    if (this.loggers.has(siteId)) {
      return this.loggers.get(siteId)!;
    }

    const siteLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { siteId },
      transports: [
        new winston.transports.DailyRotateFile({
          filename: path.join(LOG_DIR, `site-${siteId}-%DATE%.log`),
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d',
          level: 'debug'
        }),
        new winston.transports.DailyRotateFile({
          filename: path.join(LOG_DIR, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error'
        })
      ]
    });

    this.loggers.set(siteId, siteLogger);
    return siteLogger;
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.rootLogger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.rootLogger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.rootLogger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.rootLogger.debug(message, meta);
  }
}

export const logger = new LoggerManager();
export default logger;
