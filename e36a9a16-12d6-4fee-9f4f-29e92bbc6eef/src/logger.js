import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..', 'logs');

const { combine, timestamp, printf, errors, colorize } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `[${timestamp}] ${level}: ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.constructor === Object) {
      msg += ' ' + JSON.stringify(metadata);
    }
    return msg;
  })
);

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.constructor === Object) {
      msg += ' ' + JSON.stringify(metadata);
    }
    return msg;
  })
);

const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'gov-bid-monitor' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: 'info'
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: fileFormat,
      level: 'info'
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error'
    })
  ]
});

export const createSiteLogger = (siteId, siteName) => {
  return logger.child({
    siteId,
    siteName
  });
};

export default logger;
