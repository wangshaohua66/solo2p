import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'crawler-%DATE%.log',
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '30d',
  level: 'info'
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'error-%DATE%.log',
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  maxSize: '100m',
  maxFiles: '30d',
  level: 'error'
});

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    fileRotateTransport,
    errorFileRotateTransport
  ],
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: 'exceptions-%DATE%.log',
      dirname: logDir,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    })
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: 'rejections-%DATE%.log',
      dirname: logDir,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    )
  }));
}

export interface CrawlLogParams {
  timestamp: string;
  platform: string;
  url: string;
  statusCode: number;
  durationMs: number;
  error?: string;
}

export function logCrawl(params: CrawlLogParams): void {
  const logData: Record<string, unknown> = {
    timestamp: params.timestamp,
    platform: params.platform,
    url: params.url,
    statusCode: params.statusCode,
    durationMs: params.durationMs
  };

  if (params.error) {
    logData.error = params.error;
    logger.error('CRAWL_FAILED', logData);
  } else {
    logger.info('CRAWL_SUCCESS', logData);
  }
}
