const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const dayjs = require('dayjs');
const config = require('./config');

const { format } = winston;
const { combine, timestamp, printf, errors, colorize } = format;

const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_SIZE = config.getPerformanceConfig().maxLogSizePerDayMB;

const logLevels = {
  error: 0,
  warn: 1,
  audit: 2,
  info: 3,
  debug: 4
};

winston.addColors({
  error: 'red',
  warn: 'yellow',
  audit: 'magenta',
  info: 'green',
  debug: 'blue'
});

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 
    ? ` ${JSON.stringify(meta)}` 
    : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
});

const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  customFormat
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  customFormat
);

const createTransport = (level, filename) => {
  return new DailyRotateFile({
    filename: path.join(LOG_DIR, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: `${MAX_LOG_SIZE}m`,
    maxFiles: '30d',
    level,
    format: fileFormat
  });
};

const errorTransport = createTransport('error', 'error');
const auditTransport = createTransport('audit', 'audit');
const infoTransport = createTransport('info', 'info');
const combinedTransport = createTransport('debug', 'combined');

const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    errorTransport,
    auditTransport,
    infoTransport,
    combinedTransport
  ],
  exceptionHandlers: [
    createTransport('error', 'exceptions')
  ],
  rejectionHandlers: [
    createTransport('error', 'rejections')
  ],
  exitOnError: false
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'debug'
  }));
}

class AuditLogger {
  constructor() {
    this.operationId = 0;
  }

  generateOperationId() {
    this.operationId++;
    return `OP-${dayjs().format('YYYYMMDDHHmmss')}-${String(this.operationId).padStart(4, '0')}`;
  }

  log(action, resource, details = {}, options = {}) {
    const operationId = options.operationId || this.generateOperationId();
    const entry = {
      operationId,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      action,
      resource,
      operator: options.operator || 'system',
      inspectionLine: options.inspectionLine || null,
      vehiclePlate: options.vehiclePlate || null,
      ipAddress: options.ipAddress || process.env.SERVER_IP || '127.0.0.1',
      userAgent: options.userAgent || 'automation-system',
      details,
      result: options.result || 'success',
      duration: options.duration || null
    };

    logger.audit(`[${operationId}] ${action} ${resource}`, entry);
    return operationId;
  }

  login(platform, username, inspectionLine, success, errorMessage = null) {
    return this.log(
      'LOGIN',
      platform,
      { 
        username,
        errorMessage 
      },
      {
        inspectionLine,
        result: success ? 'success' : 'failed'
      }
    );
  }

  logout(platform, username, inspectionLine) {
    return this.log(
      'LOGOUT',
      platform,
      { username },
      { inspectionLine }
    );
  }

  vehicleQuery(plateNumber, inspectionLine, result, source) {
    return this.log(
      'VEHICLE_QUERY',
      'traffic_platform',
      { 
        plateNumber,
        source,
        result 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber
      }
    );
  }

  inspectionStart(plateNumber, inspectionLine, method) {
    return this.log(
      'INSPECTION_START',
      'inspection',
      { 
        plateNumber,
        method 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber
      }
    );
  }

  inspectionComplete(plateNumber, inspectionLine, result, duration) {
    return this.log(
      'INSPECTION_COMPLETE',
      'inspection',
      { 
        plateNumber,
        result,
        duration 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber,
        duration
      }
    );
  }

  dataEntry(plateNumber, inspectionLine, field, value) {
    return this.log(
      'DATA_ENTRY',
      'env_platform',
      { 
        plateNumber,
        field,
        value: typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber
      }
    );
  }

  reportGenerate(plateNumber, inspectionLine, reportPath, success, errorMessage = null) {
    return this.log(
      'REPORT_GENERATE',
      'report',
      { 
        plateNumber,
        reportPath,
        errorMessage 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber,
        result: success ? 'success' : 'failed'
      }
    );
  }

  reportUpload(plateNumber, inspectionLine, uploadUrl, success, errorMessage = null) {
    return this.log(
      'REPORT_UPLOAD',
      'env_platform',
      { 
        plateNumber,
        uploadUrl,
        errorMessage 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber,
        result: success ? 'success' : 'failed'
      }
    );
  }

  exportReport(period, reportType, filePath, success, errorMessage = null) {
    return this.log(
      'EXPORT_REPORT',
      'env_platform',
      { 
        period,
        reportType,
        filePath,
        errorMessage 
      },
      { 
        result: success ? 'success' : 'failed'
      }
    );
  }

  error(plateNumber, inspectionLine, errorType, errorMessage, stackTrace = null) {
    return this.log(
      'ERROR',
      'system',
      { 
        plateNumber,
        errorType,
        errorMessage,
        stackTrace 
      },
      { 
        inspectionLine,
        vehiclePlate: plateNumber,
        result: 'error'
      }
    );
  }

  alert(alertType, severity, message, context = {}) {
    return this.log(
      'ALERT',
      'monitoring',
      { 
        alertType,
        severity,
        message,
        context 
      },
      { 
        result: 'warning'
      }
    );
  }

  configChange(changedBy, configKey, oldValue, newValue) {
    return this.log(
      'CONFIG_CHANGE',
      'system_config',
      { 
        configKey,
        oldValue: typeof oldValue === 'string' && oldValue.includes('password') ? '***' : oldValue,
        newValue: typeof newValue === 'string' && newValue.includes('password') ? '***' : newValue
      },
      { 
        operator: changedBy,
        result: 'success'
      }
    );
  }

  batchProcessStart(batchId, totalCount, inspectionLine) {
    return this.log(
      'BATCH_START',
      'batch_process',
      { 
        batchId,
        totalCount 
      },
      { inspectionLine }
    );
  }

  batchProcessComplete(batchId, successCount, failedCount, totalCount, duration, inspectionLine) {
    return this.log(
      'BATCH_COMPLETE',
      'batch_process',
      { 
        batchId,
        successCount,
        failedCount,
        totalCount,
        duration 
      },
      { 
        inspectionLine,
        duration
      }
    );
  }
}

const auditLogger = new AuditLogger();

class OperationTracer {
  constructor(operation, options = {}) {
    this.operation = operation;
    this.options = options;
    this.startTime = Date.now();
    this.operationId = auditLogger.generateOperationId();
  }

  logStep(step, details = {}) {
    const elapsed = Date.now() - this.startTime;
    logger.info(`[${this.operationId}] ${this.operation} - Step: ${step}`, {
      operationId: this.operationId,
      step,
      elapsed,
      ...details
    });
  }

  complete(result = 'success', details = {}) {
    const duration = Date.now() - this.startTime;
    auditLogger.log(
      'OPERATION_COMPLETE',
      this.operation,
      { ...details, duration },
      {
        operationId: this.operationId,
        result,
        duration,
        ...this.options
      }
    );
    return { operationId: this.operationId, duration };
  }

  fail(errorMessage, details = {}) {
    const duration = Date.now() - this.startTime;
    auditLogger.error(
      this.options.vehiclePlate,
      this.options.inspectionLine,
      this.operation,
      errorMessage,
      details.stack
    );
    return { operationId: this.operationId, duration, error: errorMessage };
  }
}

module.exports = {
  logger,
  audit: auditLogger,
  OperationTracer,
  levels: logLevels
};
