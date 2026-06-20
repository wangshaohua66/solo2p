import fs from 'fs';

export const ErrorCodes = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1,
  INVALID_ARGUMENT: 2,
  FILE_NOT_FOUND: 3,
  PARSE_ERROR: 4,
  VALIDATION_FAILED: 5,
  PERMISSION_DENIED: 6,
  CONFIG_NOT_INITIALIZED: 7,
  ENVIRONMENT_NOT_FOUND: 8,
  SYNC_CONFLICT: 9,
  HISTORY_NOT_FOUND: 10,
  SCHEMA_ERROR: 11,
  NETWORK_ERROR: 12,
  TIMEOUT_ERROR: 13,
  MEMORY_LIMIT: 14
};

export class ConfigDriftError extends Error {
  constructor(message, code = ErrorCodes.UNKNOWN_ERROR, details = {}) {
    super(message);
    this.name = 'ConfigDriftError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export function createError(message, code = ErrorCodes.UNKNOWN_ERROR, details = {}) {
  return new ConfigDriftError(message, code, details);
}

export function wrapError(originalError, message, code = ErrorCodes.UNKNOWN_ERROR) {
  const error = new ConfigDriftError(message, code, {
    originalMessage: originalError?.message,
    originalStack: originalError?.stack,
    originalName: originalError?.name
  });
  error.cause = originalError;
  return error;
}

export function handleError(error, options = {}) {
  const { debug = false, logger = null, exit = true } = options;

  let appError;
  if (error instanceof ConfigDriftError) {
    appError = error;
  } else {
    appError = wrapError(error, error?.message || '发生未知错误', ErrorCodes.UNKNOWN_ERROR);
  }

  if (logger) {
    logger.error(appError.message, {
      code: appError.code,
      details: appError.details,
      stack: debug ? appError.stack : undefined
    });
  }

  if (exit) {
    process.exitCode = appError.code || ErrorCodes.UNKNOWN_ERROR;
  }

  return appError;
}

export function setupGlobalErrorHandler(logger, debug = false) {
  process.on('uncaughtException', (error) => {
    const appError = handleError(error, { logger, debug, exit: false });
    console.error('\n');
    console.error(`错误代码: ${appError.code}`);
    console.error(`错误信息: ${appError.message}`);
    if (debug && appError.stack) {
      console.error(`\n堆栈信息:\n${appError.stack}`);
    }
    console.error('\n程序异常退出，请检查日志文件获取详细信息。');
    process.exit(appError.code || ErrorCodes.UNKNOWN_ERROR);
  });

  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const appError = handleError(error, { logger, debug, exit: false });
    console.error('\n');
    console.error(`未处理的Promise拒绝 [${promise}]`);
    console.error(`错误代码: ${appError.code}`);
    console.error(`错误信息: ${appError.message}`);
    if (debug && appError.stack) {
      console.error(`\n堆栈信息:\n${appError.stack}`);
    }
    process.exit(appError.code || ErrorCodes.UNKNOWN_ERROR);
  });

  process.on('SIGINT', () => {
    if (logger) {
      logger.info('收到SIGINT信号，程序正常退出');
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    if (logger) {
      logger.info('收到SIGTERM信号，程序正常退出');
    }
    process.exit(0);
  });
}

export function assert(condition, message, code = ErrorCodes.INVALID_ARGUMENT, details = {}) {
  if (!condition) {
    throw createError(message, code, details);
  }
}

export function assertNotNull(value, name, code = ErrorCodes.INVALID_ARGUMENT) {
  if (value === null || value === undefined) {
    throw createError(`${name} 不能为空`, code, { field: name });
  }
  return value;
}

export function assertFileExists(filePath, code = ErrorCodes.FILE_NOT_FOUND) {
  if (!fs.existsSync(filePath)) {
    throw createError(`文件不存在: ${filePath}`, code, { filePath });
  }
  return filePath;
}
