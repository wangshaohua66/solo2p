const config = require('../../config/config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, options = {}) {
  const {
    maxRetries = config.retry.maxRetries,
    baseDelay = config.retry.baseDelay,
    maxDelay = config.retry.maxDelay,
    factor = config.retry.factor,
    onRetry = null,
    retryableErrors = null,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      if (retryableErrors && !retryableErrors.some(e => error instanceof e || error.name === e)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

function withExponentialBackoff(fn, options) {
  return (...args) => retry(() => fn(...args), options);
}

module.exports = {
  retry,
  withExponentialBackoff,
  sleep,
};
