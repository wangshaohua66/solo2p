const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { logger, chalk } = require('../utils/logger');
const { RetryQueue, RetryError } = require('../utils/retry');
const { generateId, ensureDir, formatFileSize, formatDuration, safeStringify } = require('../utils/common');
const { paths, notificationConfig, performanceConfig } = require('../../config/schedule');

const ERROR_CODES = {
  EMAIL_CONNECT_FAILED: {
    code: 'EMAIL_CONNECT_FAILED',
    level: 'error',
    message: '邮箱服务器连接失败',
    suggestion: '请检查邮箱配置(账号、密码、服务器地址、端口)，或稍后切换备用服务器重试'
  },
  EMAIL_FETCH_FAILED: {
    code: 'EMAIL_FETCH_FAILED',
    level: 'error',
    message: '邮件拉取失败',
    suggestion: '请检查IMAP权限、网络连接，确认邮箱文件夹存在'
  },
  EMAIL_ATTACHMENT_SAVE_FAILED: {
    code: 'EMAIL_ATTACHMENT_SAVE_FAILED',
    level: 'error',
    message: '附件保存失败',
    suggestion: '请检查磁盘空间、文件写入权限'
  },
  API_AUTH_FAILED: {
    code: 'API_AUTH_FAILED',
    level: 'error',
    message: 'API认证失败',
    suggestion: '请检查Token/密钥有效性、签名算法、时间戳同步'
  },
  API_RATE_LIMITED: {
    code: 'API_RATE_LIMITED',
    level: 'warn',
    message: 'API请求限流',
    suggestion: '已按Retry-After头自动等待，若频繁出现请联系对方调整限流策略'
  },
  API_REQUEST_FAILED: {
    code: 'API_REQUEST_FAILED',
    level: 'error',
    message: 'API请求失败',
    suggestion: '请检查接口地址、参数格式、网络连接'
  },
  PARSE_FORMAT_ERROR: {
    code: 'PARSE_FORMAT_ERROR',
    level: 'error',
    message: '文件格式解析错误',
    suggestion: '请确认文件格式正确，原始文件已保留供人工核查'
  },
  PARSE_ENCODING_ERROR: {
    code: 'PARSE_ENCODING_ERROR',
    level: 'error',
    message: '文件编码识别错误',
    suggestion: '请确认文件编码为UTF-8或GBK，或联系机构重新导出'
  },
  FIELD_MAPPING_INCOMPLETE: {
    code: 'FIELD_MAPPING_INCOMPLETE',
    level: 'warn',
    message: '存在未映射字段',
    suggestion: '请在字段映射规则库中补充对应机构的字段映射关系'
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    level: 'error',
    message: '数据合规校验未通过',
    suggestion: '请查看校验报告，联系机构修正异常数据后补报'
  },
  PUSH_FAILED: {
    code: 'PUSH_FAILED',
    level: 'error',
    message: '数据推送监管系统失败',
    suggestion: '请检查监管系统接口可用性、Token权限，数据已保留可重试'
  },
  DUPLICATE_SUBMISSION: {
    code: 'DUPLICATE_SUBMISSION',
    level: 'info',
    message: '重复报送已跳过',
    suggestion: '如为重报或补报，请在文件名中注明或手动标记submissionType'
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    level: 'warn',
    message: '文件超过大小限制',
    suggestion: `单文件最大${performanceConfig.maxFileSizeMB}MB，请拆分为多个文件报送`
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    level: 'error',
    message: '任务执行超时',
    suggestion: `整体任务超时时间${performanceConfig.taskTimeoutMinutes}分钟，请排查瓶颈或分批处理`
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    level: 'error',
    message: '未知错误',
    suggestion: '请查看详细日志，联系技术支持排查'
  }
};

const classifyError = (error) => {
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  if (msg.includes('imap') || msg.includes('邮箱') || msg.includes('mail') || code.startsWith('EMAIL')) {
    if (msg.includes('connect') || msg.includes('连接')) return ERROR_CODES.EMAIL_CONNECT_FAILED;
    if (msg.includes('fetch') || msg.includes('拉取')) return ERROR_CODES.EMAIL_FETCH_FAILED;
    if (msg.includes('附件') || msg.includes('attachment')) return ERROR_CODES.EMAIL_ATTACHMENT_SAVE_FAILED;
    return ERROR_CODES.EMAIL_CONNECT_FAILED;
  }
  if (msg.includes('token') || msg.includes('auth') || msg.includes('认证') || msg.includes('401') || msg.includes('403')) {
    return ERROR_CODES.API_AUTH_FAILED;
  }
  if (msg.includes('限流') || msg.includes('rate') || msg.includes('429')) {
    return ERROR_CODES.API_RATE_LIMITED;
  }
  if (msg.includes('api') || code.startsWith('API') || msg.includes('http') || msg.includes('请求')) {
    return ERROR_CODES.API_REQUEST_FAILED;
  }
  if (msg.includes('解析') || msg.includes('parse') || msg.includes('xlsx') || msg.includes('csv') || msg.includes('xml') || msg.includes('json')) {
    if (msg.includes('编码') || msg.includes('encoding') || msg.includes('gbk') || msg.includes('utf')) {
      return ERROR_CODES.PARSE_ENCODING_ERROR;
    }
    return ERROR_CODES.PARSE_FORMAT_ERROR;
  }
  if (msg.includes('字段') || msg.includes('映射')) {
    return ERROR_CODES.FIELD_MAPPING_INCOMPLETE;
  }
  if (msg.includes('校验') || msg.includes('validation') || msg.includes('valid')) {
    return ERROR_CODES.VALIDATION_FAILED;
  }
  if (msg.includes('推送') || msg.includes('push') || msg.includes('regulator')) {
    return ERROR_CODES.PUSH_FAILED;
  }
  if (msg.includes('重复') || msg.includes('duplicate')) {
    return ERROR_CODES.DUPLICATE_SUBMISSION;
  }
  if (msg.includes('太大') || msg.includes('超限') || msg.includes('large') || msg.includes('exceed')) {
    return ERROR_CODES.FILE_TOO_LARGE;
  }
  if (msg.includes('超时') || msg.includes('timeout')) {
    return ERROR_CODES.TIMEOUT;
  }
  return ERROR_CODES.UNKNOWN_ERROR;
};

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      notifyEnabled: notificationConfig.enabled,
      failedQueuePath: path.join(paths.data.failed, 'failed_queue.json'),
      originalFileDir: path.join(paths.data.failed, 'original'),
      ...options
    };
    this.retryQueue = new RetryQueue({
      maxRetries: performanceConfig.retryStrategy.maxRetries,
      storagePath: this.options.failedQueuePath
    });
    this.retryQueue.load();
    ensureDir(this.options.originalFileDir);
    this._mailTransporter = null;
    this.failedTaskStats = { total: 0, byCode: {}, byOrg: {} };
  }

  formatError(error, context = {}) {
    const classified = classifyError(error);
    return {
      id: error.errorId || generateId(),
      code: classified.code,
      level: classified.level,
      message: classified.message,
      rawMessage: error.message || String(error),
      suggestion: classified.suggestion,
      cause: error.cause?.message || error.stack || '',
      orgId: context.orgId || '',
      orgName: context.orgName || '',
      stage: context.stage || 'unknown',
      source: context.source || '',
      filePath: context.filePath || '',
      fileName: context.fileName || '',
      attempt: error.attempt || 0,
      maxRetries: error.maxRetries || performanceConfig.retryStrategy.maxRetries,
      occurredAt: new Date().toISOString(),
      context: this._sanitizeContext(context)
    };
  }

  _sanitizeContext(context) {
    const safe = {};
    const sensitive = ['password', 'token', 'secret', 'key', 'authorization'];
    for (const [k, v] of Object.entries(context || {})) {
      if (sensitive.includes(k.toLowerCase())) {
        safe[k] = '***masked***';
      } else {
        try {
          JSON.stringify(v);
          safe[k] = v;
        } catch (e) {
          safe[k] = String(v);
        }
      }
    }
    return safe;
  }

  handle(error, context = {}) {
    const formatted = this.formatError(error, context);
    this._logFormatted(formatted);
    this.failedTaskStats.total++;
    this.failedTaskStats.byCode[formatted.code] = (this.failedTaskStats.byCode[formatted.code] || 0) + 1;
    if (formatted.orgId) {
      this.failedTaskStats.byOrg[formatted.orgId] = (this.failedTaskStats.byOrg[formatted.orgId] || 0) + 1;
    }
    if (formatted.filePath && fs.existsSync(formatted.filePath) && formatted.level === 'error') {
      this._preserveOriginalFile(formatted.filePath, formatted);
    }
    if (formatted.level === 'error') {
      this._addToFailedQueue(formatted);
    }
    if (this.options.notifyEnabled && formatted.level === 'error' && formatted.attempt >= formatted.maxRetries) {
      this._sendAlert(formatted).catch((e) => logger.warn(`发送告警邮件失败: ${e.message}`));
    }
    return formatted;
  }

  _logFormatted(err) {
    const level = err.level;
    const codeTag = chalk.bgWhite.black.bold(` ${err.code} `);
    const orgTag = err.orgId ? chalk.cyan(`[${err.orgId}]`) : '';
    const stageTag = chalk.magenta(`<${err.stage}>`);
    const prefix = `${orgTag}${stageTag} ${codeTag}`;
    switch (level) {
      case 'error':
        logger.error(`${prefix} ${chalk.red.bold(err.message)}`);
        break;
      case 'warn':
        logger.warn(`${prefix} ${chalk.yellow(err.message)}`);
        break;
      case 'info':
      default:
        logger.info(`${prefix} ${chalk.blue(err.message)}`);
    }
    if (err.rawMessage && err.rawMessage !== err.message) {
      logger[level === 'error' ? 'error' : level](`  ↳ 原始错误: ${chalk.gray(err.rawMessage)}`);
    }
    if (err.suggestion) {
      logger.info(`  ↳ ${chalk.green('建议:')} ${chalk.white(err.suggestion)}`);
    }
    if (err.filePath) {
      logger.info(`  ↳ ${chalk.gray(`文件: ${err.filePath}`)}`);
    }
  }

  _preserveOriginalFile(filePath, err) {
    try {
      const targetDir = path.join(this.options.originalFileDir, err.orgId || 'unknown');
      ensureDir(targetDir);
      const targetPath = path.join(targetDir, `${err.id}_${path.basename(filePath)}`);
      fs.copyFileSync(filePath, targetPath);
      logger.info(`原始文件已保留: ${targetPath}`);
      err.preservedFilePath = targetPath;
    } catch (e) {
      logger.warn(`保留原始文件失败: ${e.message}`);
    }
  }

  _addToFailedQueue(formatted) {
    const existing = this.retryQueue.getItems().find((item) => item.id === formatted.id);
    if (existing) {
      this.retryQueue.incrementRetry(formatted.id);
    } else {
      this.retryQueue.add({
        id: formatted.id,
        orgId: formatted.orgId,
        orgName: formatted.orgName,
        stage: formatted.stage,
        code: formatted.code,
        message: formatted.message,
        suggestion: formatted.suggestion,
        filePath: formatted.preservedFilePath || formatted.filePath,
        fileName: formatted.fileName,
        source: formatted.source,
        context: formatted.context
      });
    }
  }

  async _getMailTransporter() {
    if (this._mailTransporter) return this._mailTransporter;
    const smtp = notificationConfig.email.smtp;
    if (!smtp.user || !smtp.pass) {
      logger.warn('SMTP配置不完整，跳过告警邮件发送');
      return null;
    }
    this._mailTransporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass
      }
    });
    return this._mailTransporter;
  }

  async _sendAlert(formatted) {
    const transporter = await this._getMailTransporter();
    if (!transporter) return;
    const emailCfg = notificationConfig.email;
    const subject = `[监管采集告警][${formatted.code}] ${formatted.orgName || formatted.orgId || '机构'} ${formatted.message}`;
    const bodyLines = [
      '监管数据采集系统告警通知',
      '='.repeat(50),
      `错误代码: ${formatted.code}`,
      `错误级别: ${formatted.level.toUpperCase()}`,
      `机构: ${formatted.orgName} (${formatted.orgId})`,
      `阶段: ${formatted.stage}`,
      `错误信息: ${formatted.message}`,
      `原始信息: ${formatted.rawMessage}`,
      `建议处理: ${formatted.suggestion}`,
      `发生时间: ${formatted.occurredAt}`,
      `重试次数: ${formatted.attempt}/${formatted.maxRetries}`,
      formatted.fileName ? `相关文件: ${formatted.fileName}` : '',
      formatted.preservedFilePath ? `原始文件路径: ${formatted.preservedFilePath}` : '',
      '',
      '请尽快处理，避免影响监管报送。',
      '',
      '-- 监管数据采集系统自动发送 --'
    ];
    const mailOptions = {
      from: emailCfg.from,
      to: emailCfg.recipients.join(','),
      subject,
      text: bodyLines.filter(Boolean).join('\n')
    };
    try {
      await transporter.sendMail(mailOptions);
      logger.info(`告警邮件已发送给: ${emailCfg.recipients.join(', ')}`);
    } catch (e) {
      logger.error(`发送告警邮件失败: ${e.message}`);
    }
  }

  getFailedQueue() {
    return this.retryQueue.getItems();
  }

  getRetryableItems() {
    return this.retryQueue.getRetryableItems();
  }

  removeFromQueue(id) {
    this.retryQueue.remove(id);
  }

  clearQueue() {
    this.retryQueue.clear();
  }

  getStats() {
    return {
      ...this.failedTaskStats,
      queueLength: this.retryQueue.getItems().length,
      retryableCount: this.retryQueue.getRetryableItems().length
    };
  }

  printSummary() {
    const stats = this.getStats();
    if (stats.total === 0) {
      logger.info(chalk.green('✔ 本次采集无错误'));
      return;
    }
    logger.warn(chalk.yellow(`⚠ 本次采集共发生 ${stats.total} 个错误`));
    if (Object.keys(stats.byCode).length > 0) {
      logger.warn(chalk.yellow('  按错误代码分布:'));
      for (const [code, count] of Object.entries(stats.byCode)) {
        logger.warn(chalk.yellow(`    - ${code}: ${count}次`));
      }
    }
    if (Object.keys(stats.byOrg).length > 0) {
      logger.warn(chalk.yellow('  按机构分布:'));
      for (const [orgId, count] of Object.entries(stats.byOrg)) {
        logger.warn(chalk.yellow(`    - ${orgId}: ${count}次`));
      }
    }
    if (stats.queueLength > 0) {
      logger.warn(chalk.yellow(`  失败队列剩余: ${stats.queueLength}项 (可重试${stats.retryableCount}项)`));
    }
  }
}

module.exports = {
  ErrorHandler,
  ERROR_CODES,
  classifyError
};
