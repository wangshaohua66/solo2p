const axios = require('axios');
const dayjs = require('dayjs');
const { retryConfig, alertConfig, PLATFORM_NAMES } = require('./config');

const ALERT_TYPES = {
  LOGIN_FAILURE: 'login_failure',
  FETCH_FAILURE: 'fetch_failure',
  ORDER_EXCEPTION: 'order_exception',
  LOGISTICS_DELAY: 'logistics_delay',
  SYSTEM_ERROR: 'system_error'
};

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? retryConfig.maxRetries;
    this.initialDelayMs = options.initialDelayMs ?? retryConfig.initialDelayMs;
    this.maxDelayMs = options.maxDelayMs ?? retryConfig.maxDelayMs;
    this.backoffMultiplier = options.backoffMultiplier ?? retryConfig.backoffMultiplier;
    this.onRetry = options.onRetry || null;
    this.onMaxRetriesExceeded = options.onMaxRetriesExceeded || null;
  }

  _calculateDelay(attempt) {
    const delay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.maxDelayMs);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async execute(fn, context = {}) {
    const {
      description = 'operation',
      isRetryable = null,
      platform = null
    } = context;

    let lastError;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        const retryable = isRetryable
          ? isRetryable(error)
          : this._isDefaultRetryable(error);

        if (!retryable) {
          throw error;
        }

        if (attempt >= this.maxRetries) {
          break;
        }

        const delay = this._calculateDelay(attempt);
        if (this.onRetry) {
          this.onRetry({
            attempt,
            maxRetries: this.maxRetries,
            delay,
            error,
            description,
            platform
          });
        }

        await this._sleep(delay);
      }
    }

    if (this.onMaxRetriesExceeded) {
      this.onMaxRetriesExceeded({
        maxRetries: this.maxRetries,
        error: lastError,
        description,
        platform
      });
    }

    const err = new Error(`Maximum retries (${this.maxRetries}) exceeded for ${description}: ${lastError.message}`);
    err.originalError = lastError;
    err.retries = this.maxRetries;
    throw err;
  }

  _isDefaultRetryable(error) {
    const message = (error.message || String(error)).toLowerCase();
    return retryConfig.retryableErrors.some(keyword =>
      message.includes(keyword.toLowerCase())
    );
  }
}

class AlertManager {
  constructor(config = {}) {
    this.enabled = config.enabled ?? alertConfig.enabled;
    this.webhookUrl = config.webhookUrl || alertConfig.webhookUrl;
    this.emailConfig = config.email || alertConfig.email;
    this.alertOnLoginFail = config.alertOnLoginFail ?? alertConfig.alertOnLoginFail;
    this.alertOnOrderException = config.alertOnOrderException ?? alertConfig.alertOnOrderException;
    this.alertOnLogisticsDelay = config.alertOnLogisticsDelay ?? alertConfig.alertOnLogisticsDelay;
    this._alertHistory = new Map();
    this._cooldownMs = 10 * 60 * 1000;
  }

  _shouldAlert(key) {
    if (!this.enabled) return false;
    const now = Date.now();
    const lastTime = this._alertHistory.get(key);
    if (lastTime && (now - lastTime) < this._cooldownMs) {
      return false;
    }
    this._alertHistory.set(key, now);
    return true;
  }

  _buildAlertPayload(type, data) {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const platformName = data.platform ? PLATFORM_NAMES[data.platform] || data.platform : '';

    const typeLabels = {
      [ALERT_TYPES.LOGIN_FAILURE]: '登录失败告警',
      [ALERT_TYPES.FETCH_FAILURE]: '数据采集失败告警',
      [ALERT_TYPES.ORDER_EXCEPTION]: '异常订单告警',
      [ALERT_TYPES.LOGISTICS_DELAY]: '物流延误告警',
      [ALERT_TYPES.SYSTEM_ERROR]: '系统错误告警'
    };

    const title = `【${typeLabels[type] || '系统告警'}】${platformName ? ' ' + platformName : ''}`;

    let content = `**时间**: ${timestamp}\n`;
    if (data.platform) content += `**平台**: ${platformName}\n`;
    if (data.message) content += `**消息**: ${data.message}\n`;
    if (data.error) content += `**错误**: ${String(data.error).substring(0, 500)}\n`;
    if (data.details) content += `**详情**: ${JSON.stringify(data.details).substring(0, 1000)}\n`;

    return {
      timestamp,
      type,
      title,
      content,
      ...data
    };
  }

  async _sendWebhook(payload) {
    if (!this.webhookUrl) return false;
    try {
      await axios.post(this.webhookUrl, {
        msgtype: 'markdown',
        markdown: {
          title: payload.title,
          text: `# ${payload.title}\n\n${payload.content}`
        }
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      return true;
    } catch (err) {
      console.error(`Webhook告警发送失败: ${err.message}`);
      return false;
    }
  }

  async _sendEmail(payload) {
    if (!this.emailConfig?.enabled || !this.emailConfig?.recipients?.length) {
      return false;
    }
    try {
      await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: 'default',
        template_id: 'alert_template',
        user_id: this.emailConfig.sender,
        template_params: {
          subject: payload.title,
          message: payload.content,
          to_email: this.emailConfig.recipients.join(',')
        }
      }, { timeout: 10000 });
      return true;
    } catch (err) {
      console.error(`邮件告警发送失败: ${err.message}`);
      return false;
    }
  }

  async alert(type, data = {}) {
    if (!this.enabled) return { sent: false, reason: 'disabled' };

    const skipChecks = {
      [ALERT_TYPES.LOGIN_FAILURE]: !this.alertOnLoginFail,
      [ALERT_TYPES.ORDER_EXCEPTION]: !this.alertOnOrderException,
      [ALERT_TYPES.LOGISTICS_DELAY]: !this.alertOnLogisticsDelay
    };
    if (skipChecks[type]) {
      return { sent: false, reason: 'type_disabled' };
    }

    const dedupKey = `${type}:${data.platform || 'global'}:${data.error || data.message || 'general'}`;
    if (!this._shouldAlert(dedupKey)) {
      return { sent: false, reason: 'cooldown' };
    }

    const payload = this._buildAlertPayload(type, data);
    const results = await Promise.allSettled([
      this._sendWebhook(payload),
      this._sendEmail(payload)
    ]);

    const webhookSent = results[0]?.status === 'fulfilled' && results[0].value;
    const emailSent = results[1]?.status === 'fulfilled' && results[1].value;

    return {
      sent: webhookSent || emailSent,
      webhook: webhookSent,
      email: emailSent,
      payload
    };
  }

  async alertLoginFailure(platform, error, details = {}) {
    return this.alert(ALERT_TYPES.LOGIN_FAILURE, {
      platform,
      error,
      message: `${PLATFORM_NAMES[platform]} 平台登录失败，请检查账号凭证或网络连接`,
      details
    });
  }

  async alertFetchFailure(platform, error, details = {}) {
    return this.alert(ALERT_TYPES.FETCH_FAILURE, {
      platform,
      error,
      message: `${PLATFORM_NAMES[platform]} 平台订单数据采集失败`,
      details
    });
  }

  async alertOrderException(platform, orders, details = {}) {
    const count = Array.isArray(orders) ? orders.length : 1;
    return this.alert(ALERT_TYPES.ORDER_EXCEPTION, {
      platform,
      message: `发现 ${count} 笔异常订单，请及时处理`,
      details: { count, orders: Array.isArray(orders) ? orders.slice(0, 10) : [orders], ...details }
    });
  }

  async alertLogisticsDelay(platform, delayedOrders, details = {}) {
    const count = Array.isArray(delayedOrders) ? delayedOrders.length : 1;
    return this.alert(ALERT_TYPES.LOGISTICS_DELAY, {
      platform,
      message: `发现 ${count} 笔物流延误订单，超过阈值未更新`,
      details: { count, orders: Array.isArray(delayedOrders) ? delayedOrders.slice(0, 10) : [delayedOrders], ...details }
    });
  }

  async alertSystemError(error, details = {}) {
    return this.alert(ALERT_TYPES.SYSTEM_ERROR, {
      error,
      message: '系统发生未捕获错误',
      details
    });
  }
}

const globalAlertManager = new AlertManager();

function createRetryHandler(options = {}) {
  return new RetryHandler(options);
}

function withRetry(fn, options = {}) {
  const handler = new RetryHandler(options);
  return handler.execute(fn, options);
}

module.exports = {
  RetryHandler,
  AlertManager,
  ALERT_TYPES,
  globalAlertManager,
  createRetryHandler,
  withRetry
};
