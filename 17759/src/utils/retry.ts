import dotenv from 'dotenv';
import { createLogger } from './logger';
import type { OperationError, RetryConfig, CircuitBreakerConfig } from '../../types';

dotenv.config();

const logger = createLogger('retry');

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  initialDelay: parseInt(process.env.RETRY_INITIAL_DELAY || '2', 10),
  maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '60', 10),
  backoffMultiplier: 2
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: parseFloat(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '0.3'),
  recoveryTimeout: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || '300000', 10),
  successThreshold: 3
};

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastStateChange: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private stats: CircuitStats;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now()
    };
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    
    if (this.state === 'open') {
      const elapsed = Date.now() - this.stats.lastFailureTime;
      if (elapsed >= this.config.recoveryTimeout) {
        this.transitionTo('half_open');
        logger.info(`Circuit breaker [${this.name}] transitioning to half_open`, {
          elapsed,
          recoveryTimeout: this.config.recoveryTimeout
        });
        return true;
      }
      return false;
    }
    
    return this.state === 'half_open';
  }

  recordSuccess(): void {
    this.stats.totalRequests++;
    this.stats.successCount++;
    this.stats.consecutiveSuccesses++;
    
    if (this.state === 'half_open') {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
        this.resetStats();
        logger.info(`Circuit breaker [${this.name}] closed after ${this.config.successThreshold} consecutive successes`);
      }
    }
  }

  recordFailure(): void {
    this.stats.totalRequests++;
    this.stats.failureCount++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();
    
    if (this.state === 'closed') {
      const failureRate = this.stats.totalRequests > 0 
        ? this.stats.failureCount / this.stats.totalRequests 
        : 0;
      
      if (this.stats.totalRequests >= 10 && failureRate >= this.config.failureThreshold) {
        this.transitionTo('open');
        logger.warn(`Circuit breaker [${this.name}] opened`, {
          failureRate,
          threshold: this.config.failureThreshold,
          totalRequests: this.stats.totalRequests,
          failureCount: this.stats.failureCount
        });
      }
    } else if (this.state === 'half_open') {
      this.transitionTo('open');
      logger.warn(`Circuit breaker [${this.name}] reopened after failure in half_open state`);
    }
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.stats.lastStateChange = Date.now();
  }

  private resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: this.stats.lastFailureTime,
      lastStateChange: Date.now()
    };
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): Readonly<CircuitStats> {
    return { ...this.stats };
  }

  getFailureRate(): number {
    if (this.stats.totalRequests === 0) return 0;
    return this.stats.failureCount / this.stats.totalRequests;
  }
}

class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  getOverallFailureRate(): number {
    let totalRequests = 0;
    let totalFailures = 0;
    
    for (const breaker of this.breakers.values()) {
      const stats = breaker.getStats();
      totalRequests += stats.totalRequests;
      totalFailures += stats.failureCount;
    }
    
    return totalRequests > 0 ? totalFailures / totalRequests : 0;
  }

  shouldFuse(): boolean {
    const rate = this.getOverallFailureRate();
    const threshold = parseFloat(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '0.3');
    return rate >= threshold;
  }

  resetAll(): void {
    this.breakers.clear();
  }

  getAllStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();

function classifyNetworkError(error: Error): OperationError {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';
  const combined = message + stack;

  let errorType: OperationError['type'] = 'unknown';
  let retryable = true;

  if (combined.includes('dns') || combined.includes('ename') || combined.includes('getaddrinfo')) {
    errorType = 'network_dns';
    retryable = true;
  } else if (combined.includes('econnrefused') || combined.includes('etimedout') || combined.includes('econnreset')) {
    errorType = 'network_tcp';
    retryable = true;
  } else if (combined.includes('tls') || combined.includes('ssl') || combined.includes('cert') || combined.includes('handshake')) {
    errorType = 'network_tls';
    retryable = false;
  } else if (combined.includes('401') || combined.includes('unauthorized') || combined.includes('authentication failed')) {
    errorType = 'auth_error';
    retryable = false;
  } else if (combined.includes('400') || combined.includes('validation') || combined.includes('invalid')) {
    errorType = 'validation_error';
    retryable = false;
  } else if (combined.includes('403') || combined.includes('forbidden') || combined.includes('banned') || combined.includes('blocked')) {
    errorType = 'auth_error';
    retryable = false;
  } else if (combined.includes('500') || combined.includes('502') || combined.includes('503') || combined.includes('504')) {
    errorType = 'platform_error';
    retryable = true;
  }

  const opError = error as OperationError;
  opError.type = errorType;
  opError.retryable = retryable;
  opError.accountLevel = errorType === 'auth_error' || errorType === 'network_tls';

  return opError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateExponentialBackoff(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay * 1000, config.maxDelay * 1000);
}

export interface RetryOptions<T> {
  operation: () => Promise<T>;
  operationName: string;
  circuitBreakerName?: string;
  config?: Partial<RetryConfig>;
  onRetry?: (attempt: number, error: OperationError, delay: number) => void;
  onSuccess?: (result: T) => void;
  onFailure?: (error: OperationError) => void;
  fallbackAccount?: () => Promise<void>;
}

export async function withRetry<T>(options: RetryOptions<T>): Promise<T> {
  const {
    operation,
    operationName,
    circuitBreakerName,
    config: partialConfig,
    onRetry,
    onSuccess,
    onFailure,
    fallbackAccount
  } = options;

  const config = { ...DEFAULT_RETRY_CONFIG, ...partialConfig };
  const circuitBreaker = circuitBreakerName 
    ? circuitBreakerManager.get(circuitBreakerName)
    : null;

  let lastError: OperationError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (circuitBreaker && !circuitBreaker.canExecute()) {
      const error = new Error(`Circuit breaker [${circuitBreakerName}] is open`) as OperationError;
      error.type = 'platform_error';
      error.retryable = false;
      throw error;
    }

    try {
      logger.debug(`Executing operation [${operationName}], attempt ${attempt + 1}/${config.maxRetries + 1}`);
      
      const result = await operation();
      
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }
      
      onSuccess?.(result);
      logger.debug(`Operation [${operationName}] succeeded on attempt ${attempt + 1}`);
      
      return result;
    } catch (error) {
      lastError = classifyNetworkError(
        error instanceof Error ? error : new Error(String(error))
      );

      logger.warn(`Operation [${operationName}] failed on attempt ${attempt + 1}`, {
        errorType: lastError.type,
        errorMessage: lastError.message,
        retryable: lastError.retryable,
        accountLevel: lastError.accountLevel
      });

      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      if (attempt === config.maxRetries || !lastError.retryable) {
        onFailure?.(lastError);
        logger.error(`Operation [${operationName}] failed permanently`, lastError);
        throw lastError;
      }

      if (lastError.accountLevel && fallbackAccount) {
        logger.info(`Account-level error detected, switching to fallback account`);
        try {
          await fallbackAccount();
        } catch (fallbackError) {
          logger.error('Fallback account switch failed', fallbackError);
          onFailure?.(lastError);
          throw lastError;
        }
      }

      const delay = calculateExponentialBackoff(attempt, config);
      const jitter = delay * (0.5 + Math.random());
      const finalDelay = Math.min(delay + jitter, config.maxDelay * 1000);

      logger.debug(`Retrying operation [${operationName}] after ${Math.round(finalDelay / 1000)}s`);
      onRetry?.(attempt + 1, lastError, finalDelay);
      
      await sleep(finalDelay);
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

export function createRetryDecorator(
  defaultOptions: Omit<RetryOptions<unknown>, 'operation'>
) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;
    
    descriptor.value = function (this: unknown, ...args: unknown[]) {
      return withRetry({
        ...defaultOptions,
        operation: () => originalMethod.apply(this, args) as Promise<unknown>
      });
    } as T;
    
    return descriptor;
  };
}

export default {
  withRetry,
  CircuitBreaker,
  circuitBreakerManager,
  classifyNetworkError,
  calculateExponentialBackoff
};
