import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { emailConfig } from '../config/index.js';

const logger = createLogger('Alert');

const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

const ALERT_TYPES = {
  LOGIN_FAILED: 'login_failed',
  SELECTOR_FAILED: 'selector_failed',
  SITE_PAUSED: 'site_paused',
  CRAWL_ERROR: 'crawl_error',
  SYSTEM_ERROR: 'system_error'
};

class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.emailEnabled = options.emailEnabled !== false;
    this.emailConfig = options.emailConfig || {};
    this.alertHistory = [];
    this.maxHistory = options.maxHistory || 100;
    this.cooldownMap = new Map();
    this.defaultCooldown = options.defaultCooldown || 5 * 60 * 1000;
  }

  async sendAlert(alertType, level, message, details = {}) {
    const alertKey = `${alertType}_${details.siteName || 'global'}`;

    if (this._isOnCooldown(alertKey)) {
      logger.debug(`告警冷却中，跳过: ${alertKey}`);
      return false;
    }

    const alert = {
      id: Date.now(),
      type: alertType,
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this._addHistory(alert);
    this._setCooldown(alertKey);

    logger.warn(`[${level.toUpperCase()}] ${alertType}: ${message}`);

    this.emit('alert', alert);

    if (this.emailEnabled && this.emailConfig?.to?.length > 0) {
      try {
        await this._sendEmailAlert(alert);
      } catch (emailError) {
        logger.error(`邮件告警发送失败: ${emailError.message}`);
      }
    }

    return true;
  }

  async loginFailed(siteName, reason, details = {}) {
    return this.sendAlert(
      ALERT_TYPES.LOGIN_FAILED,
      ALERT_LEVELS.ERROR,
      `站点 [${siteName}] 登录失败: ${reason}`,
      { siteName, reason, ...details }
    );
  }

  async selectorFailed(siteName, selector, screenshotPath, details = {}) {
    return this.sendAlert(
      ALERT_TYPES.SELECTOR_FAILED,
      ALERT_LEVELS.WARNING,
      `站点 [${siteName}] 选择器失效: ${selector}`,
      { siteName, selector, screenshotPath, ...details }
    );
  }

  async sitePaused(siteName, reason, consecutiveFailures, details = {}) {
    return this.sendAlert(
      ALERT_TYPES.SITE_PAUSED,
      ALERT_LEVELS.CRITICAL,
      `站点 [${siteName}] 已暂停: ${reason} (连续失败 ${consecutiveFailures} 次)`,
      { siteName, reason, consecutiveFailures, ...details }
    );
  }

  async crawlError(siteName, errorMessage, details = {}) {
    return this.sendAlert(
      ALERT_TYPES.CRAWL_ERROR,
      ALERT_LEVELS.ERROR,
      `站点 [${siteName}] 采集异常: ${errorMessage}`,
      { siteName, errorMessage, ...details }
    );
  }

  async systemError(message, details = {}) {
    return this.sendAlert(
      ALERT_TYPES.SYSTEM_ERROR,
      ALERT_LEVELS.CRITICAL,
      `系统错误: ${message}`,
      { ...details }
    );
  }

  getHistory(type = null, limit = 20) {
    let history = [...this.alertHistory];

    if (type) {
      history = history.filter(a => a.type === type);
    }

    return history.slice(-limit);
  }

  clearHistory() {
    this.alertHistory = [];
    this.cooldownMap.clear();
    logger.info('告警历史已清空');
  }

  _addHistory(alert) {
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.shift();
    }
  }

  _isOnCooldown(alertKey) {
    const lastSent = this.cooldownMap.get(alertKey);
    if (!lastSent) return false;
    return Date.now() - lastSent < this.defaultCooldown;
  }

  _setCooldown(alertKey) {
    this.cooldownMap.set(alertKey, Date.now());
  }

  async _sendEmailAlert(alert) {
    if (!this.emailConfig?.to?.length) {
      return false;
    }

    try {
      const nodemailer = await import('nodemailer');

      const transporter = nodemailer.createTransport({
        host: this.emailConfig.smtpHost,
        port: this.emailConfig.smtpPort,
        secure: this.emailConfig.smtpTls,
        auth: {
          user: this.emailConfig.from,
          pass: this.emailConfig.password
        }
      });

      const levelLabels = {
        info: '信息',
        warning: '警告',
        error: '错误',
        critical: '严重'
      };

      const subject = `${this.emailConfig.subjectPrefix || '[法拍房监控]'} [${levelLabels[alert.level] || alert.level}] ${alert.message}`;

      const detailLines = Object.entries(alert.details)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      const text = `
告警时间: ${alert.timestamp}
告警级别: ${levelLabels[alert.level] || alert.level}
告警类型: ${alert.type}
告警消息: ${alert.message}

详细信息:
${detailLines || '无'}

---
法拍房监控系统自动告警
`.trim();

      await transporter.sendMail({
        from: this.emailConfig.from,
        to: this.emailConfig.to.join(', '),
        subject,
        text
      });

      logger.info(`邮件告警已发送: ${alert.type}`);
      return true;
    } catch (error) {
      logger.error(`邮件告警发送失败: ${error.message}`);
      throw error;
    }
  }
}

let defaultInstance = null;

function getAlertManager(options = {}) {
  if (!defaultInstance) {
    defaultInstance = new AlertManager({
      emailEnabled: emailConfig.enabled,
      emailConfig,
      ...options
    });
  }
  return defaultInstance;
}

export {
  AlertManager,
  ALERT_LEVELS,
  ALERT_TYPES,
  getAlertManager
};

export default getAlertManager();
