const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const dayjs = require('dayjs');
const { logger, audit } = require('./logger');
const config = require('./config');

const ERROR_TYPES = {
  NETWORK_INTERRUPTION: 'NETWORK_INTERRUPTION',
  PLATFORM_MAINTENANCE: 'PLATFORM_MAINTENANCE',
  CAPTCHA_FAILED: 'CAPTCHA_FAILED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

const ERROR_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const RETRY_STRATEGIES = {
  [ERROR_TYPES.NETWORK_INTERRUPTION]: {
    maxRetries: 5,
    delayMs: 5000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
    name: '指数退避重试'
  },
  [ERROR_TYPES.PLATFORM_MAINTENANCE]: {
    maxRetries: 3,
    delayMs: 300000,
    backoffMultiplier: 1.5,
    maxDelayMs: 600000,
    name: '长间隔重试'
  },
  [ERROR_TYPES.CAPTCHA_FAILED]: {
    maxRetries: 3,
    delayMs: 2000,
    backoffMultiplier: 1,
    maxDelayMs: 5000,
    name: '刷新验证码重试'
  },
  [ERROR_TYPES.SESSION_EXPIRED]: {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 1,
    maxDelayMs: 3000,
    name: '重新登录重试'
  },
  [ERROR_TYPES.VALIDATION_FAILED]: {
    maxRetries: 2,
    delayMs: 3000,
    backoffMultiplier: 1,
    maxDelayMs: 5000,
    name: '数据修正重试'
  },
  [ERROR_TYPES.TIMEOUT_ERROR]: {
    maxRetries: 3,
    delayMs: 5000,
    backoffMultiplier: 1.5,
    maxDelayMs: 15000,
    name: '超时重试'
  },
  [ERROR_TYPES.UNKNOWN_ERROR]: {
    maxRetries: 2,
    delayMs: 10000,
    backoffMultiplier: 2,
    maxDelayMs: 30000,
    name: '通用重试'
  }
};

const FALLBACK_STRATEGIES = {
  [ERROR_TYPES.NETWORK_INTERRUPTION]: {
    action: '降级到本地缓存模式',
    description: '使用本地车辆信息缓存继续处理，待网络恢复后同步数据',
    steps: ['检查网络连接', '使用本地缓存数据', '标记待同步', '记录错误日志']
  },
  [ERROR_TYPES.PLATFORM_MAINTENANCE]: {
    action: '暂停服务并转入队列',
    description: '平台维护期间暂停操作，待维护结束后自动恢复',
    steps: ['保存当前进度', '加入处理队列', '发送维护通知', '定时检查平台状态']
  },
  [ERROR_TYPES.CAPTCHA_FAILED]: {
    action: '转人工处理',
    description: '验证码识别连续失败，转由检测员手动输入',
    steps: ['保存当前页面截图', '发送人工处理通知', '等待人工输入', '继续后续流程']
  },
  [ERROR_TYPES.SESSION_EXPIRED]: {
    action: '自动重新登录',
    description: '会话过期时使用备用账号重新登录',
    steps: ['清除当前会话', '轮换账号', '重新登录', '恢复操作']
  },
  [ERROR_TYPES.VALIDATION_FAILED]: {
    action: '数据校验与修正',
    description: '表单校验不通过时自动修正数据或提示检测员',
    steps: ['分析校验错误', '自动修正可修复字段', '标记不可修复字段', '提示人工确认']
  }
};

class InspectionError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'InspectionError';
    this.type = type;
    this.details = details;
    this.timestamp = Date.now();
    this.errorId = this.generateErrorId();
  }

  generateErrorId() {
    return `ERR-${dayjs().format('YYYYMMDDHHmmss')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
}

class ErrorHandler {
  constructor() {
    this.activeOperations = new Map();
    this.failedQueue = [];
    this.screenshotDir = path.join(__dirname, '..', 'screenshots');
  }

  classifyError(error) {
    const message = error.message || '';
    const stack = error.stack || '';
    const errorStr = `${message} ${stack}`.toLowerCase();

    if (errorStr.includes('network') || 
        errorStr.includes('econnrefused') || 
        errorStr.includes('etimedout') ||
        errorStr.includes('enotfound') ||
        errorStr.includes('socket hang up')) {
      return ERROR_TYPES.NETWORK_INTERRUPTION;
    }

    if (errorStr.includes('maintenance') || 
        errorStr.includes('系统维护') || 
        errorStr.includes('服务升级') ||
        errorStr.includes('503') ||
        errorStr.includes('502')) {
      return ERROR_TYPES.PLATFORM_MAINTENANCE;
    }

    if (errorStr.includes('captcha') || 
        errorStr.includes('验证码') || 
        errorStr.includes('verification code') ||
        errorStr.includes('识别失败')) {
      return ERROR_TYPES.CAPTCHA_FAILED;
    }

    if (errorStr.includes('session') || 
        errorStr.includes('登录过期') || 
        errorStr.includes('会话过期') ||
        errorStr.includes('timeout') ||
        errorStr.includes('重新登录') ||
        errorStr.includes('401') ||
        errorStr.includes('403')) {
      return ERROR_TYPES.SESSION_EXPIRED;
    }

    if (errorStr.includes('validation') || 
        errorStr.includes('校验') || 
        errorStr.includes('validate') ||
        errorStr.includes('必填') ||
        errorStr.includes('格式错误')) {
      return ERROR_TYPES.VALIDATION_FAILED;
    }

    if (errorStr.includes('timeout') || errorStr.includes('超时')) {
      return ERROR_TYPES.TIMEOUT_ERROR;
    }

    return ERROR_TYPES.UNKNOWN_ERROR;
  }

  getSeverity(errorType) {
    const severityMap = {
      [ERROR_TYPES.NETWORK_INTERRUPTION]: ERROR_SEVERITY.HIGH,
      [ERROR_TYPES.PLATFORM_MAINTENANCE]: ERROR_SEVERITY.CRITICAL,
      [ERROR_TYPES.CAPTCHA_FAILED]: ERROR_SEVERITY.MEDIUM,
      [ERROR_TYPES.SESSION_EXPIRED]: ERROR_SEVERITY.HIGH,
      [ERROR_TYPES.VALIDATION_FAILED]: ERROR_SEVERITY.LOW,
      [ERROR_TYPES.TIMEOUT_ERROR]: ERROR_SEVERITY.MEDIUM,
      [ERROR_TYPES.UNKNOWN_ERROR]: ERROR_SEVERITY.HIGH
    };
    return severityMap[errorType] || ERROR_SEVERITY.MEDIUM;
  }

  async handle(error, context = {}) {
    const errorType = this.classifyError(error);
    const severity = this.getSeverity(errorType);
    const retryStrategy = RETRY_STRATEGIES[errorType];
    const fallbackStrategy = FALLBACK_STRATEGIES[errorType];

    const errorInfo = {
      errorId: error.errorId || this.generateErrorId(),
      type: errorType,
      severity,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      retryStrategy: retryStrategy?.name,
      fallbackAction: fallbackStrategy?.action
    };

    logger.error(`[${errorInfo.errorId}] ${errorType}: ${error.message}`, errorInfo);

    audit.error(
      context.vehiclePlate,
      context.inspectionLine,
      errorType,
      error.message,
      error.stack
    );

    if (context.driver || context.browser) {
      await this.captureScreenshot(context.driver || context.browser, errorInfo.errorId);
    }

    await this.sendAlert(errorInfo);

    return errorInfo;
  }

  async retryWithStrategy(operation, context = {}) {
    const opId = context.operationId || `OP-${Date.now()}`;
    let lastError;
    let currentDelay = 0;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const result = await operation(attempt);
        if (attempt > 1) {
          logger.info(`操作 ${opId} 第 ${attempt} 次重试成功`);
        }
        return { success: true, result, attempt };
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        const strategy = RETRY_STRATEGIES[errorType] || RETRY_STRATEGIES[ERROR_TYPES.UNKNOWN_ERROR];

        if (attempt > strategy.maxRetries) {
          logger.warn(`操作 ${opId} 达到最大重试次数 ${strategy.maxRetries}，触发降级策略`);
          break;
        }

        currentDelay = Math.min(
          strategy.delayMs * Math.pow(strategy.backoffMultiplier, attempt - 1),
          strategy.maxDelayMs
        );

        logger.warn(`操作 ${opId} 第 ${attempt} 次尝试失败 (${errorType})，${currentDelay / 1000}秒后重试...`, {
          attempt,
          errorType,
          nextDelay: currentDelay
        });

        await this.sleep(currentDelay);
      }
    }

    const fallbackResult = await this.executeFallback(lastError, context);
    return { success: false, error: lastError, fallback: fallbackResult };
  }

  async executeFallback(error, context) {
    const errorType = this.classifyError(error);
    const fallback = FALLBACK_STRATEGIES[errorType];

    if (!fallback) {
      logger.warn(`无可用降级策略，错误类型: ${errorType}`);
      return { action: '无可用降级策略', success: false };
    }

    logger.info(`执行降级策略: ${fallback.action}`, { errorType, context });

    const fallbackResult = {
      action: fallback.action,
      description: fallback.description,
      executedSteps: [],
      success: false
    };

    for (const step of fallback.steps) {
      try {
        fallbackResult.executedSteps.push(step);
        logger.debug(`降级步骤: ${step}`);
      } catch (stepError) {
        logger.error(`降级步骤 "${step}" 执行失败`, stepError);
        fallbackResult.failedStep = step;
        break;
      }
    }

    fallbackResult.success = !fallbackResult.failedStep;
    this.addToFailedQueue(context, error, fallbackResult);

    return fallbackResult;
  }

  async captureScreenshot(driver, errorId) {
    try {
      if (!driver || typeof driver.takeScreenshot !== 'function') {
        return null;
      }

      const screenshot = await driver.takeScreenshot();
      const timestamp = dayjs().format('YYYYMMDDHHmmss');
      const filename = `${errorId}-${timestamp}.png`;
      const filePath = path.join(this.screenshotDir, filename);

      const fs = require('fs');
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }
      fs.writeFileSync(filePath, screenshot, 'base64');

      logger.info(`错误截图已保存: ${filePath}`);
      return filePath;
    } catch (screenshotError) {
      logger.error('截图保存失败', screenshotError);
      return null;
    }
  }

  async sendAlert(errorInfo) {
    const alertConfig = config.getAlertConfig();
    
    if (alertConfig.dingtalk?.enabled && alertConfig.dingtalk?.webhook) {
      await this.sendDingtalkAlert(errorInfo, alertConfig.dingtalk);
    }

    if (alertConfig.email?.enabled && alertConfig.email?.recipients?.length > 0) {
      await this.sendEmailAlert(errorInfo, alertConfig.email);
    }
  }

  async sendDingtalkAlert(errorInfo, dingtalkConfig) {
    try {
      const timestamp = Date.now();
      const sign = this.generateDingtalkSign(timestamp, dingtalkConfig.secret);
      
      const message = {
        msgtype: 'markdown',
        markdown: {
          title: `【${this.getSeverityEmoji(errorInfo.severity)}】${errorInfo.type}`,
          text: this.formatDingtalkMessage(errorInfo)
        },
        at: {
          atMobiles: dingtalkConfig.atMobiles || [],
          isAtAll: errorInfo.severity === ERROR_SEVERITY.CRITICAL
        }
      };

      const url = `${dingtalkConfig.webhook}&timestamp=${timestamp}&sign=${sign}`;
      await axios.post(url, message, { timeout: 5000 });

      audit.alert(
        'DINGTALK_ALERT',
        errorInfo.severity,
        errorInfo.message,
        { errorId: errorInfo.errorId, type: errorInfo.type }
      );

      logger.info('钉钉告警已发送');
    } catch (alertError) {
      logger.error('钉钉告警发送失败', alertError);
    }
  }

  generateDingtalkSign(timestamp, secret) {
    if (!secret) return '';
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(stringToSign, 'utf8'))
      .digest()
      .toString('base64');
    return encodeURIComponent(sign);
  }

  formatDingtalkMessage(errorInfo) {
    const contextStr = errorInfo.context ? 
      Object.entries(errorInfo.context)
        .filter(([k]) => !['driver', 'browser'].includes(k))
        .map(([k, v]) => `**${k}**: ${v}`)
        .join('\n') : '无';

    return `### ${this.getSeverityEmoji(errorInfo.severity)} ${errorInfo.type}\n\n` +
           `**错误ID**: ${errorInfo.errorId}\n` +
           `**时间**: ${errorInfo.timestamp}\n` +
           `**严重程度**: ${this.getSeverityText(errorInfo.severity)}\n` +
           `**错误信息**: ${errorInfo.message}\n\n` +
           `**重试策略**: ${errorInfo.retryStrategy || '无'}\n` +
           `**降级方案**: ${errorInfo.fallbackAction || '无'}\n\n` +
           `**上下文信息**:\n${contextStr}\n\n` +
           `> 请及时处理此异常！`;
  }

  async sendEmailAlert(errorInfo, emailConfig) {
    logger.info('邮件告警功能待配置', { recipients: emailConfig.recipients });
  }

  getSeverityEmoji(severity) {
    const emojis = {
      [ERROR_SEVERITY.CRITICAL]: '🔴',
      [ERROR_SEVERITY.HIGH]: '🟠',
      [ERROR_SEVERITY.MEDIUM]: '🟡',
      [ERROR_SEVERITY.LOW]: '🟢'
    };
    return emojis[severity] || '⚪';
  }

  getSeverityText(severity) {
    const texts = {
      [ERROR_SEVERITY.CRITICAL]: '严重',
      [ERROR_SEVERITY.HIGH]: '高',
      [ERROR_SEVERITY.MEDIUM]: '中',
      [ERROR_SEVERITY.LOW]: '低'
    };
    return texts[severity] || '未知';
  }

  addToFailedQueue(context, error, fallbackResult) {
    this.failedQueue.push({
      context,
      error: {
        message: error.message,
        type: this.classifyError(error),
        stack: error.stack
      },
      fallbackResult,
      timestamp: Date.now(),
      status: 'pending'
    });
    logger.info(`已加入失败队列，当前队列长度: ${this.failedQueue.length}`);
  }

  getFailedQueue() {
    return [...this.failedQueue];
  }

  clearFailedQueue() {
    const count = this.failedQueue.length;
    this.failedQueue = [];
    logger.info(`已清空失败队列，共 ${count} 条记录`);
    return count;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateErrorId() {
    return `ERR-${dayjs().format('YYYYMMDDHHmmss')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  wrapWithErrorHandling(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorInfo = await this.handle(error, context);
        throw new InspectionError(errorInfo.type, error.message, { 
          ...context, 
          errorId: errorInfo.errorId 
        });
      }
    };
  }

  validateFormData(formData, validationRules) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(validationRules)) {
      const value = formData[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `字段 "${field}" 为必填项`,
          type: ERROR_TYPES.VALIDATION_FAILED
        });
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({
            field,
            message: `字段 "${field}" 格式不正确`,
            type: ERROR_TYPES.VALIDATION_FAILED,
            expected: rules.pattern.toString()
          });
        }

        if (rules.minLength && value.length < rules.minLength) {
          errors.push({
            field,
            message: `字段 "${field}" 长度不能小于 ${rules.minLength}`,
            type: ERROR_TYPES.VALIDATION_FAILED
          });
        }

        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({
            field,
            message: `字段 "${field}" 长度不能大于 ${rules.maxLength}`,
            type: ERROR_TYPES.VALIDATION_FAILED
          });
        }

        if (rules.enum && !rules.enum.includes(value)) {
          errors.push({
            field,
            message: `字段 "${field}" 必须是 ${rules.enum.join(', ')} 之一`,
            type: ERROR_TYPES.VALIDATION_FAILED
          });
        }

        if (rules.custom && typeof rules.custom === 'function') {
          const customError = rules.custom(value, formData);
          if (customError) {
            errors.push({
              field,
              message: customError,
              type: ERROR_TYPES.VALIDATION_FAILED
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

const errorHandler = new ErrorHandler();

module.exports = {
  errorHandler,
  InspectionError,
  ERROR_TYPES,
  ERROR_SEVERITY,
  RETRY_STRATEGIES,
  FALLBACK_STRATEGIES
};
