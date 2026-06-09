import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SENSITIVE_FIELDS = [
  'password',
  'encryptedPassword',
  'totpSeed',
  'encryptedTotpSeed',
  'apiKey',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'cookie',
  'cookies',
  'authorization',
  'encryptionKey'
];

const SENSITIVE_PATTERNS = [
  /(?:sk|pk)_[\w-]{20,}/gi,
  /\b[A-Za-z0-9+/]{40,}\b/g,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
];

function maskSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    let masked = obj;
    SENSITIVE_PATTERNS.forEach(pattern => {
      masked = masked.replace(pattern, '*** MASKED ***');
    });
    return masked;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        result[key] = '*** MASKED ***';
      } else {
        result[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return result;
  }
  
  return obj;
}

const logDir = process.env.LOG_DIR || './logs';
const logLevel = process.env.LOG_LEVEL || 'info';

const networkErrorFilter = winston.format((info) => {
  if (info.errorType === 'network_dns' || info.errorType === 'network_tcp' || info.errorType === 'network_tls') {
    return { ...info, level: 'warn' };
  }
  return info;
});

const sensitiveDataMask = winston.format((info) => {
  const maskedInfo = { ...info };
  if (maskedInfo.message) {
    SENSITIVE_PATTERNS.forEach(pattern => {
      maskedInfo.message = (maskedInfo.message as string).replace(pattern, '*** MASKED ***');
    });
  }
  if (maskedInfo.data) {
    maskedInfo.data = maskSensitiveData(maskedInfo.data);
  }
  if (maskedInfo.error) {
    maskedInfo.error = maskSensitiveData(maskedInfo.error);
  }
  return maskedInfo;
});

const fileFormat = winston.format.combine(
  networkErrorFilter(),
  sensitiveDataMask(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  networkErrorFilter(),
  sensitiveDataMask(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...rest }) => {
    const restStr = Object.keys(rest).length > 0 
      ? ` ${JSON.stringify(maskSensitiveData(rest))}`
      : '';
    return `[${timestamp}] ${level}: ${message}${restStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: logLevel,
    format: consoleFormat
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: fileFormat,
    maxFiles: '30d',
    maxSize: '50m'
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: logLevel,
    format: fileFormat,
    maxFiles: '30d',
    maxSize: '100m'
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'network-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    format: winston.format.combine(
      winston.format((info) => {
        const errType = info.errorType as string | undefined;
        if (errType?.startsWith('network_')) return info;
        return false;
      })(),
      fileFormat
    ),
    maxFiles: '30d',
    maxSize: '50m'
  })
];

const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false
});

export interface Logger {
  info: (message: string, data?: Record<string, unknown> | unknown) => void;
  warn: (message: string, data?: Record<string, unknown> | unknown) => void;
  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown> | unknown) => void;
  silly: (message: string, data?: Record<string, unknown> | unknown) => void;
  http: (message: string, data?: Record<string, unknown> | unknown) => void;
  verbose: (message: string, data?: Record<string, unknown> | unknown) => void;
}

export const createLogger = (module: string): Logger => {
  const formatData = (data?: unknown): Record<string, unknown> => {
    if (data === undefined || data === null) return {};
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { data };
  };

  return {
    info: (message: string, data?: unknown) => 
      logger.info(message, { module, ...formatData(data) }),
    warn: (message: string, data?: unknown) => 
      logger.warn(message, { module, ...formatData(data) }),
    error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => {
      const errorData = error instanceof Error 
        ? { error: { message: error.message, stack: error.stack }, ...data }
        : { error, ...data };
      logger.error(message, { module, ...errorData });
    },
    debug: (message: string, data?: unknown) => 
      logger.debug(message, { module, ...formatData(data) }),
    silly: (message: string, data?: unknown) => 
      logger.silly(message, { module, ...formatData(data) }),
    http: (message: string, data?: unknown) => 
      logger.http(message, { module, ...formatData(data) }),
    verbose: (message: string, data?: unknown) => 
      logger.verbose(message, { module, ...formatData(data) })
  };
};

export default logger;
