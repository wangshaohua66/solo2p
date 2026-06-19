const nodemailer = require('nodemailer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const { NOTIFICATION_CHANNELS } = require('../../config/hospitals');
const { getStorage } = require('../utils/storage');

const logger = createLogger('Notifier');

class NotifierService {
  constructor() {
    this.channels = {
      email: { enabled: true, transporter: null },
      sms: { enabled: true, provider: null },
      wechat: { enabled: true, webhook: null }
    };
    this.storage = null;
    this._initialized = false;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byChannel: {
        email: { total: 0, success: 0, failed: 0 },
        sms: { total: 0, success: 0, failed: 0 },
        wechat: { total: 0, success: 0, failed: 0 }
      }
    };
  }

  async init() {
    if (this._initialized) return;

    this.storage = await getStorage();

    try {
      this.channels.email.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.qq.com',
        port: parseInt(process.env.EMAIL_PORT || '465'),
        secure: true,
        auth: {
          user: process.env.EMAIL_USER || 'noreply@example.com',
          pass: process.env.EMAIL_PASS || 'password'
        }
      });
      logger.info('邮件通知服务已初始化');
    } catch (err) {
      logger.warn(`邮件服务初始化失败: ${err.message}`);
    }

    if (process.env.WECHAT_WEBHOOK_URL) {
      this.channels.wechat.webhook = process.env.WECHAT_WEBHOOK_URL;
      logger.info('企业微信通知服务已初始化');
    } else {
      logger.warn('未配置企业微信Webhook，微信通知将使用模拟模式');
    }

    this._initialized = true;
    logger.info('通知服务初始化完成');
  }

  async notify(patient, appointment, options = {}) {
    await this.init();

    const channels = options.channels || ['email', 'sms', 'wechat'];
    const results = [];
    const notifyId = uuidv4();

    logger.info(`发送号源通知给患者: ${patient.name}`);

    for (const channel of channels) {
      const result = await this._sendNotification(channel, patient, appointment, notifyId);
      results.push(result);

      await this._logNotification({
        id: uuidv4(),
        patientId: patient.id,
        patientName: patient.name,
        channel: channel,
        appointmentId: appointment.id,
        hospitalName: appointment.hospitalName,
        department: appointment.departmentName,
        doctorName: appointment.doctorName,
        appointmentDate: appointment.appointmentDate,
        status: result.success ? 'success' : 'failed',
        errorMessage: result.error || null
      });
    }

    const successCount = results.filter(r => r.success).length;
    this.stats.total++;
    if (successCount > 0) {
      this.stats.success++;
    } else {
      this.stats.failed++;
    }

    return {
      notifyId,
      success: successCount > 0,
      channels: results,
      successCount,
      totalChannels: channels.length
    };
  }

  async _sendNotification(channel, patient, appointment, notifyId) {
    this.stats.byChannel[channel].total++;

    try {
      switch (channel) {
        case 'email':
          return await this._sendEmail(patient, appointment, notifyId);
        case 'sms':
          return await this._sendSms(patient, appointment, notifyId);
        case 'wechat':
          return await this._sendWechat(patient, appointment, notifyId);
        default:
          return { channel, success: false, error: '不支持的通知渠道' };
      }
    } catch (err) {
      this.stats.byChannel[channel].failed++;
      logger.error(`${channel}通知失败: ${err.message}`);
      return { channel, success: false, error: err.message };
    }
  }

  async _sendEmail(patient, appointment, notifyId) {
    if (!patient.email) {
      return { channel: 'email', success: false, error: '患者无邮箱' };
    }

    const subject = `【号源提醒】${appointment.hospitalName}-${appointment.departmentName}有号了！`;
    const html = this._buildEmailTemplate(patient, appointment);
    const text = this._buildEmailText(patient, appointment);

    if (!this.channels.email.transporter) {
      logger.warn(`[模拟邮件] ${patient.name}: ${subject}`);
      this.stats.byChannel.email.success++;
      return { channel: 'email', success: true, simulated: true };
    }

    try {
      const info = await this.channels.email.transporter.sendMail({
        from: `"医疗号源监控" <${process.env.EMAIL_USER || 'noreply@example.com'}>`,
        to: patient.email,
        subject: subject,
        text: text,
        html: html
      });

      this.stats.byChannel.email.success++;
      logger.info(`邮件通知已发送给 ${patient.name}: ${info.messageId}`);
      return { channel: 'email', success: true, messageId: info.messageId };
    } catch (err) {
      this.stats.byChannel.email.failed++;
      throw err;
    }
  }

  _buildEmailTemplate(patient, appointment) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">号源提醒通知</h2>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>尊敬的 <strong>${patient.name}</strong> 患者：</p>
          <p>您关注的专家号有新号源啦！以下是号源详情：</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 号源信息</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666; width: 100px;">医院</td>
                <td style="padding: 8px; font-weight: bold;">${appointment.hospitalName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">科室</td>
                <td style="padding: 8px; font-weight: bold;">${appointment.departmentName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">医生</td>
                <td style="padding: 8px; font-weight: bold;">${appointment.doctorName || '待分配'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">日期</td>
                <td style="padding: 8px; font-weight: bold; color: #e74c3c;">${appointment.appointmentDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #666;">时段</td>
                <td style="padding: 8px; font-weight: bold;">${appointment.timeSlot || '全天'}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${appointment.sourceUrl || '#'}" 
               style="display: inline-block; padding: 12px 30px; background: #3498db; color: white; 
                      text-decoration: none; border-radius: 25px; font-weight: bold;">
              立即预约 →
            </a>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            ⚠️ 号源紧张，请尽快预约。本邮件由系统自动发送，请勿直接回复。
          </p>
        </div>
      </div>
    `;
  }

  _buildEmailText(patient, appointment) {
    return `
号源提醒通知

尊敬的${patient.name}患者：

您关注的专家号有新号源啦！

【号源详情】
医院：${appointment.hospitalName}
科室：${appointment.departmentName}
医生：${appointment.doctorName || '待分配'}
日期：${appointment.appointmentDate}
时段：${appointment.timeSlot || '全天'}
费用：${appointment.fee ? appointment.fee + '元' : '未知'}

请尽快登录医院挂号平台进行预约。
号源紧张，先到先得！

—— 医疗号源监控系统
    `.trim();
  }

  async _sendSms(patient, appointment, notifyId) {
    if (!patient.phone) {
      return { channel: 'sms', success: false, error: '患者无手机号' };
    }

    const message = `【号源提醒】${appointment.hospitalName}${appointment.departmentName}${appointment.doctorName || ''}${appointment.appointmentDate}有号，速抢！`;

    if (!this.channels.sms.provider || !process.env.SMS_API_URL) {
      logger.warn(`[模拟短信] ${patient.phone}: ${message}`);
      this.stats.byChannel.sms.success++;
      return { channel: 'sms', success: true, simulated: true };
    }

    try {
      const response = await axios.post(process.env.SMS_API_URL, {
        phone: patient.phone,
        message: message,
        templateId: process.env.SMS_TEMPLATE_ID || 'SMS_123456'
      }, {
        timeout: 5000
      });

      if (response.data?.success) {
        this.stats.byChannel.sms.success++;
        return { channel: 'sms', success: true };
      } else {
        throw new Error(response.data?.message || '短信发送失败');
      }
    } catch (err) {
      this.stats.byChannel.sms.failed++;
      throw err;
    }
  }

  async _sendWechat(patient, appointment, notifyId) {
    const webhook = this.channels.wechat.webhook;

    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `
### 🏥 号源提醒

**患者**: ${patient.name}
**医院**: ${appointment.hospitalName}
**科室**: ${appointment.departmentName}
**医生**: ${appointment.doctorName || '待分配'}
**日期**: ${appointment.appointmentDate}
**时段**: ${appointment.timeSlot || '全天'}

> 号源紧张，请尽快预约！
        `.trim()
      }
    };

    if (!webhook) {
      logger.warn(`[模拟企业微信] ${patient.name} - ${appointment.hospitalName}号源提醒`);
      this.stats.byChannel.wechat.success++;
      return { channel: 'wechat', success: true, simulated: true };
    }

    try {
      const response = await axios.post(webhook, message, { timeout: 5000 });

      if (response.data?.errcode === 0) {
        this.stats.byChannel.wechat.success++;
        return { channel: 'wechat', success: true };
      } else {
        throw new Error(response.data?.errmsg || '微信通知发送失败');
      }
    } catch (err) {
      this.stats.byChannel.wechat.failed++;
      throw err;
    }
  }

  async _logNotification(logData) {
    if (!this.storage) return;
    try {
      await this.storage.insertNotificationLog(logData);
    } catch (err) {
      logger.debug(`记录通知日志失败: ${err.message}`);
    }
  }

  async batchNotify(matches) {
    await this.init();

    const results = [];
    for (const { patient, matches: apptMatches } of matches) {
      if (apptMatches.length > 0) {
        const topAppt = apptMatches[0].appointment;
        const result = await this.notify(patient, topAppt);
        results.push(result);
      }
    }

    return results;
  }

  getStats() {
    const successRate = this.stats.total > 0
      ? ((this.stats.success / this.stats.total) * 100).toFixed(1) + '%'
      : 'N/A';

    return {
      ...this.stats,
      successRate
    };
  }

  async alertAdmin(alertData, options = {}) {
    await this.init();

    const channels = options.channels || ['email', 'wechat'];
    const results = [];
    const alertId = uuidv4();

    const adminContact = {
      name: process.env.ADMIN_NAME || '系统管理员',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      phone: process.env.ADMIN_PHONE || '13800000000',
      id: 'admin-001'
    };

    logger.warn(`发送管理员告警: ${alertData.title || alertData.message}`);

    for (const channel of channels) {
      try {
        let result;
        switch (channel) {
          case 'email':
            result = await this._sendAdminAlertEmail(adminContact, alertData, alertId);
            break;
          case 'wechat':
            result = await this._sendAdminAlertWechat(adminContact, alertData, alertId);
            break;
          case 'sms':
            result = await this._sendAdminAlertSms(adminContact, alertData, alertId);
            break;
          default:
            result = { channel, success: false, error: '不支持的告警渠道' };
        }
        results.push(result);
      } catch (err) {
        logger.error(`${channel}告警通知失败: ${err.message}`);
        results.push({ channel, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      alertId,
      success: successCount > 0,
      channels: results,
      successCount,
      totalChannels: channels.length
    };
  }

  async _sendAdminAlertEmail(admin, alertData, alertId) {
    const subject = `【系统告警】${alertData.title || '医疗号源监控系统异常'}`;
    const html = this._buildAlertEmailTemplate(admin, alertData);
    const text = this._buildAlertEmailText(admin, alertData);

    if (!this.channels.email.transporter) {
      logger.warn(`[模拟告警邮件] ${admin.name}: ${subject}`);
      return { channel: 'email', success: true, simulated: true };
    }

    try {
      const info = await this.channels.email.transporter.sendMail({
        from: `"医疗号源监控[告警]" <${process.env.EMAIL_USER || 'noreply@example.com'}>`,
        to: admin.email,
        subject: subject,
        text: text,
        html: html
      });
      logger.warn(`告警邮件已发送给管理员: ${info.messageId}`);
      return { channel: 'email', success: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`告警邮件发送失败: ${err.message}`);
      return { channel: 'email', success: false, error: err.message };
    }
  }

  _buildAlertEmailTemplate(admin, alertData) {
    const timestamp = alertData.timestamp || new Date().toLocaleString('zh-CN');
    const level = alertData.level || 'warning';
    const levelColors = {
      critical: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db'
    };
    const levelNames = {
      critical: '🔴 严重',
      warning: '🟡 警告',
      info: '🔵 信息'
    };
    const bgColor = levelColors[level] || levelColors.warning;
    const levelName = levelNames[level] || levelNames.warning;

    let detailsHtml = '';
    if (alertData.details) {
      detailsHtml = Object.entries(alertData.details).map(([k, v]) => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; color: #666; width: 140px; vertical-align: top;">${k}</td>
          <td style="padding: 8px; font-weight: bold; word-break: break-all;">${v}</td>
        </tr>
      `).join('');
    }

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${bgColor} 0%, #c0392b 100%); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ 系统告警通知</h2>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>尊敬的 <strong>${admin.name}</strong>：</p>
          <p>医疗号源监控系统检测到异常，请及时关注：</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid ${bgColor};">
            <h3 style="color: #333; margin-top: 0;">📌 告警信息</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666; width: 140px;">告警级别</td>
                <td style="padding: 8px; font-weight: bold; color: ${bgColor};">${levelName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">告警标题</td>
                <td style="padding: 8px; font-weight: bold;">${alertData.title || '未命名告警'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">告警内容</td>
                <td style="padding: 8px;">${alertData.message || '无详细描述'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px; color: #666;">发生时间</td>
                <td style="padding: 8px;">${timestamp}</td>
              </tr>
              ${detailsHtml}
            </table>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            ⚠️ 请管理员及时处理此告警。本邮件由系统自动发送，请勿直接回复。
          </p>
        </div>
      </div>
    `;
  }

  _buildAlertEmailText(admin, alertData) {
    const timestamp = alertData.timestamp || new Date().toLocaleString('zh-CN');
    let detailsText = '';
    if (alertData.details) {
      detailsText = '\n【告警详情】\n' + Object.entries(alertData.details)
        .map(([k, v]) => `${k}: ${v}`).join('\n');
    }

    return `
系统告警通知

尊敬的${admin.name}：

医疗号源监控系统检测到异常！

【告警信息】
级别: ${alertData.level || 'warning'}
标题: ${alertData.title || '未命名告警'}
内容: ${alertData.message || '无详细描述'}
时间: ${timestamp}
${detailsText}

请管理员及时处理此告警。

—— 医疗号源监控系统
    `.trim();
  }

  async _sendAdminAlertWechat(admin, alertData, alertId) {
    const webhook = process.env.ADMIN_WECHAT_WEBHOOK || this.channels.wechat.webhook;
    const timestamp = alertData.timestamp || new Date().toLocaleString('zh-CN');
    const levelEmoji = {
      critical: '🔴',
      warning: '🟡',
      info: '🔵'
    };

    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `
### ${levelEmoji[alertData.level] || '⚠️'} 系统告警通知

**告警级别**: \`${alertData.level || 'warning'}\`
**告警标题**: ${alertData.title || '未命名告警'}
**告警内容**: ${alertData.message || '无详细描述'}
**发生时间**: ${timestamp}

${alertData.details ? '---\n' + Object.entries(alertData.details)
  .map(([k, v]) => `**${k}**: ${v}`).join('\n') : ''}

> 请管理员及时处理此告警！
        `.trim()
      }
    };

    if (!webhook) {
      logger.warn(`[模拟企业微信告警] ${alertData.title}`);
      return { channel: 'wechat', success: true, simulated: true };
    }

    try {
      const response = await axios.post(webhook, message, { timeout: 5000 });
      if (response.data?.errcode === 0) {
        return { channel: 'wechat', success: true };
      }
      return { channel: 'wechat', success: false, error: response.data?.errmsg || '发送失败' };
    } catch (err) {
      return { channel: 'wechat', success: false, error: err.message };
    }
  }

  async _sendAdminAlertSms(admin, alertData, alertId) {
    const message = `【系统告警】${alertData.title || '医疗号源监控异常'}: ${alertData.message || '请及时查看'}`;

    if (!this.channels.sms.provider || !process.env.SMS_API_URL) {
      logger.warn(`[模拟短信告警] ${admin.phone}: ${message}`);
      return { channel: 'sms', success: true, simulated: true };
    }

    try {
      const response = await axios.post(process.env.SMS_API_URL, {
        phone: admin.phone,
        message: message,
        templateId: process.env.SMS_ALERT_TEMPLATE_ID || 'SMS_ALERT_001'
      }, { timeout: 5000 });

      if (response.data?.success) {
        return { channel: 'sms', success: true };
      }
      return { channel: 'sms', success: false, error: response.data?.message || '发送失败' };
    } catch (err) {
      return { channel: 'sms', success: false, error: err.message };
    }
  }
}

let notifierInstance = null;

async function getNotifierService() {
  if (!notifierInstance) {
    notifierInstance = new NotifierService();
    await notifierInstance.init();
  }
  return notifierInstance;
}

module.exports = {
  NotifierService,
  getNotifierService,
  default: NotifierService
};
