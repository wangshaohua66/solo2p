import logger from './logger.js';

export const ErrorTypes = {
  NETWORK_TIMEOUT: 'network_timeout',
  SERVER_ERROR: 'server_error',
  CAPTCHA_BLOCK: 'captcha_block',
  LOGIN_EXPIRED: 'login_expired'
};

const defaultRetryConfig = {
  [ErrorTypes.NETWORK_TIMEOUT]: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  },
  [ErrorTypes.SERVER_ERROR]: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000
  },
  [ErrorTypes.CAPTCHA_BLOCK]: {
    maxRetries: 2,
    baseDelay: 5000,
    maxDelay: 20000
  },
  [ErrorTypes.LOGIN_EXPIRED]: {
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomJitter = (baseDelay) => {
  const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
  return Math.floor(jitter);
};

const calculateBackoff = (baseDelay, attempt, maxDelay) => {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = getRandomJitter(exponentialDelay);
  const delay = Math.min(exponentialDelay + jitter, maxDelay);
  return Math.max(delay, baseDelay);
};

export const classifyError = (error) => {
  const message = error.message || '';
  const status = error.status || error.response?.status;

  if (message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('ECONNABORTED')) {
    return ErrorTypes.NETWORK_TIMEOUT;
  }

  if (status && status >= 500) {
    return ErrorTypes.SERVER_ERROR;
  }

  if (message.includes('captcha') || message.includes('验证码') || error.type === 'captcha') {
    return ErrorTypes.CAPTCHA_BLOCK;
  }

  if (message.includes('login') || message.includes('登录') || message.includes('expired') || error.type === 'login') {
    return ErrorTypes.LOGIN_EXPIRED;
  }

  return ErrorTypes.NETWORK_TIMEOUT;
};

export const retryWithBackoff = async (
  fn,
  {
    context = 'default',
    retryConfig = defaultRetryConfig,
    onError = null,
    onRetry = null,
    logger: customLogger = logger
  } = {}
) => {
  let lastError;
  let lastErrorType;

  const attemptError = (error) => {
    const errorType = classifyError(error);
    return { error, errorType };
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await fn(attempt);
      return result;
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);
      lastErrorType = errorType;

      const config = retryConfig[errorType] || retryConfig[ErrorTypes.NETWORK_TIMEOUT];
      const maxRetries = config.maxRetries;

      if (attempt >= maxRetries - 1) {
        customLogger.error(`重试失败: ${context}, 错误类型: ${errorType}, 已达到最大重试次数 ${maxRetries}`, {
          error: error.message,
          context
        });
        break;
      }

      const delay = calculateBackoff(config.baseDelay, attempt, config.maxDelay);

      customLogger.warn(`重试中: ${context}, 错误类型: ${errorType}, 第 ${attempt + 1}/${maxRetries} 次, ${delay}ms 后重试`, {
        error: error.message,
        context
      });

      if (onRetry) {
        try {
          await onRetry(error, errorType, attempt, delay);
        } catch (onRetryError) {
          customLogger.warn(`onRetry 回调执行失败`, { error: onRetryError.message });
        }
      }

      await sleep(delay);
    }
  }

  if (onError) {
    try {
      await onError(lastError, lastErrorType);
    } catch (onErrorError) {
      customLogger.warn(`onError 回调执行失败`, { error: onErrorError.message });
    }
  }

  throw lastError;
};

export default {
  ErrorTypes,
  classifyError,
  retryWithBackoff
};
