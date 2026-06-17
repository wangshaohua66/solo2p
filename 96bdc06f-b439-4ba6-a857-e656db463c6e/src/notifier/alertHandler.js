const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const { getLogger } = require('../logger/appLogger');
const { getConfig, getClients, getClientById } = require('../config');
const { 
  getUnsentNotifications, 
  saveNotification, 
  updateNotificationStatus,
  getMatchesByClient,
  getStatistics
} = require('../store/database');

const logger = getLogger();

const MATCH_TYPE_LABELS = {
  exact: '精确匹配',
  pinyin: '拼音匹配',
  acronym: '首字母匹配',
  similar: '近似匹配'
};

const RISK_LEVEL_LABELS = {
  high: '高风险',
  medium: '中风险',
  low: '低风险'
};

const RISK_LEVEL_COLORS = {
  high: '#dc3545',
  medium: '#ffc107',
  low: '#28a745'
};

class AlertHandler {
  constructor(options = {}) {
    const config = getConfig('notifier', {});
    this.emailConfig = config.email || {};
    this.channels = config.channels || ['email'];
    this.instantAlertEnabled = this.emailConfig.scheduling?.instantAlert !== false;
    this.weeklySummaryEnabled = this.emailConfig.scheduling?.weeklySummary !== false;
    
    this.transporter = null;
    this.retryConfig = getConfig('system.retry', { maxAttempts: 3, baseDelay: 1000 });
  }

  initEmailTransport() {
    if (this.transporter) {
      return this.transporter;
    }
    
    const smtpConfig = this.emailConfig.smtp || {};
    
    if (!smtpConfig.host || !smtpConfig.auth?.user) {
      logger.warn('Email SMTP not configured, using mock transport');
      this.transporter = {
        sendMail: (mailOptions) => {
          logger.info('Mock email sent:', { 
            to: mailOptions.to, 
            subject: mailOptions.subject 
          });
          return Promise.resolve({ messageId: 'mock-' + Date.now() });
        }
      };
      return this.transporter;
    }
    
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port || 465,
      secure: smtpConfig.secure !== false,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    });
    
    return this.transporter;
  }

  async sendInstantAlert(matchResult, clientTrademark, announcementTrademark) {
    if (!this.instantAlertEnabled) {
      logger.info('Instant alerts disabled, skipping');
      return { success: false, reason: 'disabled' };
    }
    
    const client = getClientById(clientTrademark.client_id);
    if (!client) {
      logger.warn('Client not found for instant alert', { clientId: clientTrademark.client_id });
      return { success: false, reason: 'client_not_found' };
    }
    
    if (!client.notificationPreferences?.instantAlert) {
      logger.info('Client has disabled instant alerts', { clientId: client.id });
      return { success: false, reason: 'client_disabled' };
    }
    
    const notifId = await this.saveNotificationRecord({
      matchId: matchResult.id,
      clientId: client.id,
      notificationType: 'instant_alert',
      channel: 'email',
      subject: '',
      recipient: client.contact?.email
    });
    
    try {
      const subject = this.emailConfig.templates?.alert?.subject
        ?.replace('{clientName}', client.name)
        ?.replace('{alertCount}', '1') || `[商标预警] ${client.name} - 新商标公告预警`;
      
      const htmlContent = this.generateAlertEmailHTML([{
        match: matchResult,
        clientTrademark,
        announcementTrademark
      }], client);
      
      const attachments = await this.generateAttachments([{
        match: matchResult,
        clientTrademark,
        announcementTrademark
      }]);
      
      const mailOptions = {
        from: this.emailConfig.smtp?.auth?.user || 'noreply@example.com',
        to: client.contact?.email,
        cc: client.contact?.ccEmail,
        subject,
        html: htmlContent,
        attachments
      };
      
      await this.initEmailTransport();
      const result = await this.sendWithRetry(mailOptions);
      
      await updateNotificationStatus(notifId, 'sent');
      
      logger.info('Instant alert sent successfully', {
        clientId: client.id,
        trademark: clientTrademark.trademark_name,
        matchType: matchResult.match_type,
        riskLevel: matchResult.risk_level
      });
      
      return { success: true, messageId: result.messageId, notificationId: notifId };
      
    } catch (error) {
      logger.error('Failed to send instant alert', { error: error.message });
      await updateNotificationStatus(notifId, 'failed', error.message);
      return { success: false, error: error.message, notificationId: notifId };
    }
  }

  async sendWeeklySummary(clientId, startDate, endDate) {
    if (!this.weeklySummaryEnabled) {
      logger.info('Weekly summaries disabled, skipping');
      return { success: false, reason: 'disabled' };
    }
    
    const client = getClientById(clientId);
    if (!client) {
      logger.warn('Client not found for weekly summary', { clientId });
      return { success: false, reason: 'client_not_found' };
    }
    
    if (!client.notificationPreferences?.weeklySummary) {
      logger.info('Client has disabled weekly summaries', { clientId });
      return { success: false, reason: 'client_disabled' };
    }
    
    const matches = await getMatchesByClient(clientId, startDate, endDate);
    
    if (matches.length === 0) {
      logger.info('No matches for client in period, skipping summary', { clientId });
      return { success: true, reason: 'no_matches' };
    }
    
    const notifId = await this.saveNotificationRecord({
      matchId: null,
      clientId: client.id,
      notificationType: 'weekly_summary',
      channel: 'email',
      subject: '',
      recipient: client.contact?.email
    });
    
    try {
      const weekRange = `${moment(startDate).format('YYYY-MM-DD')} ~ ${moment(endDate).format('YYYY-MM-DD')}`;
      const subject = this.emailConfig.templates?.summary?.subject
        ?.replace('{clientName}', client.name)
        ?.replace('{weekRange}', weekRange) || `[商标周报] ${client.name} - ${weekRange}商标公告汇总`;
      
      const matchDetails = matches.map(m => ({
        match: m,
        clientTrademark: { trademark_name: m.client_trademark_name },
        announcementTrademark: {
          trademark_name: m.trademark_name,
          applicant: m.applicant,
          class_number: m.class_number,
          announcement_type: m.announcement_type,
          announcement_date: m.announcement_date
        }
      }));
      
      const htmlContent = this.generateSummaryEmailHTML(matchDetails, client, startDate, endDate);
      const attachments = await this.generateAttachments(matchDetails);
      
      const mailOptions = {
        from: this.emailConfig.smtp?.auth?.user || 'noreply@example.com',
        to: client.contact?.email,
        cc: client.contact?.ccEmail,
        subject,
        html: htmlContent,
        attachments
      };
      
      await this.initEmailTransport();
      const result = await this.sendWithRetry(mailOptions);
      
      await updateNotificationStatus(notifId, 'sent');
      
      logger.info('Weekly summary sent successfully', {
        clientId: client.id,
        matchCount: matches.length,
        messageId: result.messageId
      });
      
      return { success: true, messageId: result.messageId, matchCount: matches.length };
      
    } catch (error) {
      logger.error('Failed to send weekly summary', { error: error.message });
      await updateNotificationStatus(notifId, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendWithRetry(mailOptions) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.transporter.sendMail(mailOptions);
      } catch (error) {
        lastError = error;
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay || 30000
        );
        
        logger.warn(`Email send attempt ${attempt} failed`, {
          error: error.message,
          nextRetryIn: delay
        });
        
        if (attempt < this.retryConfig.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async saveNotificationRecord(notification) {
    return await saveNotification(notification);
  }

  generateAlertEmailHTML(matches, client) {
    const highRiskCount = matches.filter(m => m.match.risk_level === 'high').length;
    const mediumRiskCount = matches.filter(m => m.match.risk_level === 'medium').length;
    const lowRiskCount = matches.filter(m => m.match.risk_level === 'low').length;
    
    const matchesHTML = matches.map(m => this.generateMatchCardHTML(m)).join('');
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>商标公告预警通知</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .summary-item { display: inline-block; margin-right: 20px; padding: 8px 15px; border-radius: 4px; font-weight: bold; }
    .high { background: #f8d7da; color: #721c24; }
    .medium { background: #fff3cd; color: #856404; }
    .low { background: #d4edda; color: #155724; }
    .match-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .match-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .risk-badge { padding: 4px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: bold; }
    .match-type { color: #666; font-size: 14px; }
    .detail-row { display: flex; margin: 5px 0; }
    .detail-label { width: 100px; color: #666; flex-shrink: 0; }
    .detail-value { flex: 1; }
    .deadline { background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔔 商标公告预警通知</h1>
    <p>尊敬的 ${client.name}，监测到与您商标相关的最新公告</p>
  </div>
  
  <div class="summary">
    <strong>本次预警统计：</strong>
    ${highRiskCount > 0 ? `<span class="summary-item high">高风险 ${highRiskCount}</span>` : ''}
    ${mediumRiskCount > 0 ? `<span class="summary-item medium">中风险 ${mediumRiskCount}</span>` : ''}
    ${lowRiskCount > 0 ? `<span class="summary-item low">低风险 ${lowRiskCount}</span>` : ''}
  </div>
  
  <h2>📋 匹配详情</h2>
  ${matchesHTML}
  
  <div class="footer">
    <p>此邮件由商标公告智能监控系统自动发送，请勿直接回复</p>
    <p>如有疑问，请联系您的专属顾问</p>
  </div>
</body>
</html>`;
  }

  generateSummaryEmailHTML(matches, client, startDate, endDate) {
    const highRiskCount = matches.filter(m => m.match.risk_level === 'high').length;
    const mediumRiskCount = matches.filter(m => m.match.risk_level === 'medium').length;
    const lowRiskCount = matches.filter(m => m.match.risk_level === 'low').length;
    
    const exactCount = matches.filter(m => m.match.match_type === 'exact').length;
    const pinyinCount = matches.filter(m => m.match.match_type === 'pinyin').length;
    const similarCount = matches.filter(m => m.match.match_type === 'similar').length;
    
    const matchesHTML = matches.map(m => this.generateMatchRowHTML(m)).join('');
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>商标公告周报</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { color: #666; font-size: 13px; }
    .high { color: #dc3545; }
    .medium { color: #ffc107; }
    .low { color: #28a745; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #e0e0e0; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #fafafa; }
    .risk-badge { padding: 3px 10px; border-radius: 12px; color: white; font-size: 11px; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 商标公告周报</h1>
    <p>${client.name} | ${moment(startDate).format('YYYY年MM月DD日')} - ${moment(endDate).format('YYYY年MM月DD日')}</p>
  </div>
  
  <h2>📈 本周统计</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">${matches.length}</div>
      <div class="stat-label">总匹配数</div>
    </div>
    ${highRiskCount > 0 ? `<div class="stat-card"><div class="stat-number high">${highRiskCount}</div><div class="stat-label">高风险</div></div>` : ''}
    ${mediumRiskCount > 0 ? `<div class="stat-card"><div class="stat-number medium">${mediumRiskCount}</div><div class="stat-label">中风险</div></div>` : ''}
    ${lowRiskCount > 0 ? `<div class="stat-card"><div class="stat-number low">${lowRiskCount}</div><div class="stat-label">低风险</div></div>` : ''}
    <div class="stat-card">
      <div class="stat-number">${exactCount}</div>
      <div class="stat-label">精确匹配</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${pinyinCount}</div>
      <div class="stat-label">拼音匹配</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${similarCount}</div>
      <div class="stat-label">近似匹配</div>
    </div>
  </div>
  
  <h2>📋 匹配明细</h2>
  <table>
    <thead>
      <tr>
        <th>风险等级</th>
        <th>匹配类型</th>
        <th>相似度</th>
        <th>客户商标</th>
        <th>公告商标</th>
        <th>申请人</th>
        <th>类别</th>
        <th>公告类型</th>
        <th>公告日期</th>
      </tr>
    </thead>
    <tbody>
      ${matchesHTML}
    </tbody>
  </table>
  
  <div class="footer">
    <p>此邮件由商标公告智能监控系统自动发送，请勿直接回复</p>
    <p>报告生成时间：${moment().format('YYYY-MM-DD HH:mm:ss')}</p>
  </div>
</body>
</html>`;
  }

  generateMatchCardHTML(matchData) {
    const { match, clientTrademark, announcementTrademark } = matchData;
    const riskColor = RISK_LEVEL_COLORS[match.risk_level] || '#666';
    const riskLabel = RISK_LEVEL_LABELS[match.risk_level] || match.risk_level;
    const matchTypeLabel = MATCH_TYPE_LABELS[match.match_type] || match.match_type;
    
    let deadlineHTML = '';
    if (match.is_opposable && match.opposition_deadline) {
      const daysRemaining = moment(match.opposition_deadline).diff(moment(), 'days');
      deadlineHTML = `
        <div class="deadline">
          ⚠️ <strong>异议截止日期：</strong>${match.opposition_deadline}（剩余 ${daysRemaining} 天）
          ${daysRemaining <= 7 ? '<span style="color: #dc3545; margin-left: 10px;">即将到期，请尽快处理！</span>' : ''}
        </div>
      `;
    }
    
    return `
      <div class="match-card">
        <div class="match-header">
          <span class="match-type">${matchTypeLabel} · 相似度 ${(match.similarity_score * 100).toFixed(1)}%</span>
          <span class="risk-badge" style="background: ${riskColor}">${riskLabel}</span>
        </div>
        <table>
          <tr>
            <th style="width: 100px;">客户商标</th>
            <td>${clientTrademark.trademark_name}</td>
          </tr>
          <tr>
            <th>公告商标</th>
            <td><strong>${announcementTrademark.trademark_name || announcementTrademark.trademarkName}</strong></td>
          </tr>
          <tr>
            <th>申请人</th>
            <td>${announcementTrademark.applicant || '-'}</td>
          </tr>
          <tr>
            <th>商标类别</th>
            <td>第 ${announcementTrademark.class_number || announcementTrademark.classNumber} 类</td>
          </tr>
          <tr>
            <th>公告类型</th>
            <td>${announcementTrademark.announcement_type || announcementTrademark.announcementType}</td>
          </tr>
          <tr>
            <th>公告日期</th>
            <td>${announcementTrademark.announcement_date || announcementTrademark.announcementDate || '-'}</td>
          </tr>
          <tr>
            <th>申请号</th>
            <td>${announcementTrademark.application_number || announcementTrademark.applicationNumber || '-'}</td>
          </tr>
        </table>
        ${deadlineHTML}
      </div>
    `;
  }

  generateMatchRowHTML(matchData) {
    const { match, clientTrademark, announcementTrademark } = matchData;
    const riskColor = RISK_LEVEL_COLORS[match.risk_level] || '#666';
    const riskLabel = RISK_LEVEL_LABELS[match.risk_level] || match.risk_level;
    const matchTypeLabel = MATCH_TYPE_LABELS[match.match_type] || match.match_type;
    
    return `
      <tr>
        <td><span class="risk-badge" style="background: ${riskColor}">${riskLabel}</span></td>
        <td>${matchTypeLabel}</td>
        <td>${(match.similarity_score * 100).toFixed(1)}%</td>
        <td>${clientTrademark.trademark_name}</td>
        <td><strong>${announcementTrademark.trademark_name || announcementTrademark.trademarkName}</strong></td>
        <td>${announcementTrademark.applicant || '-'}</td>
        <td>${announcementTrademark.class_number || announcementTrademark.classNumber || '-'}</td>
        <td>${announcementTrademark.announcement_type || announcementTrademark.announcementType || '-'}</td>
        <td>${announcementTrademark.announcement_date || announcementTrademark.announcementDate || '-'}</td>
      </tr>
    `;
  }

  async generateAttachments(matches) {
    const attachments = [];
    
    const excelBuffer = await this.generateExcelReport(matches);
    attachments.push({
      filename: `商标匹配详情_${moment().format('YYYYMMDD_HHmmss')}.xlsx`,
      content: excelBuffer
    });
    
    const pdfPaths = _.uniq(matches.map(m => m.announcementTrademark.pdf_path || m.match.pdf_path).filter(Boolean));
    for (const pdfPath of pdfPaths) {
      if (fs.existsSync(pdfPath)) {
        attachments.push({
          filename: path.basename(pdfPath),
          path: pdfPath
        });
      }
    }
    
    return attachments;
  }

  async generateExcelReport(matches) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('商标匹配详情');
    
    worksheet.columns = [
      { header: '风险等级', key: 'riskLevel', width: 12 },
      { header: '匹配类型', key: 'matchType', width: 12 },
      { header: '相似度', key: 'similarity', width: 10 },
      { header: '客户商标', key: 'clientTrademark', width: 20 },
      { header: '公告商标', key: 'announcementTrademark', width: 20 },
      { header: '申请人', key: 'applicant', width: 25 },
      { header: '类别', key: 'classNumber', width: 8 },
      { header: '公告类型', key: 'announcementType', width: 12 },
      { header: '公告日期', key: 'announcementDate', width: 12 },
      { header: '申请号', key: 'applicationNumber', width: 15 },
      { header: '异议截止', key: 'oppositionDeadline', width: 12 },
      { header: '匹配说明', key: 'details', width: 30 }
    ];
    
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    
    matches.forEach((m, index) => {
      const row = worksheet.addRow({
        riskLevel: RISK_LEVEL_LABELS[m.match.risk_level] || m.match.risk_level,
        matchType: MATCH_TYPE_LABELS[m.match.match_type] || m.match.match_type,
        similarity: (m.match.similarity_score * 100).toFixed(1) + '%',
        clientTrademark: m.clientTrademark.trademark_name,
        announcementTrademark: m.announcementTrademark.trademark_name || m.announcementTrademark.trademarkName,
        applicant: m.announcementTrademark.applicant || '-',
        classNumber: m.announcementTrademark.class_number || m.announcementTrademark.classNumber || '-',
        announcementType: m.announcementTrademark.announcement_type || m.announcementTrademark.announcementType || '-',
        announcementDate: m.announcementTrademark.announcement_date || m.announcementTrademark.announcementDate || '-',
        applicationNumber: m.announcementTrademark.application_number || m.announcementTrademark.applicationNumber || '-',
        oppositionDeadline: m.match.opposition_deadline || '-',
        details: m.match.details || '-'
      });
      
      if (m.match.risk_level === 'high') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
      } else if (m.match.risk_level === 'medium') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBE6' } };
      }
    });
    
    worksheet.autoFilter = { from: 'A1', to: 'L1' };
    worksheet.columns.forEach(col => {
      col.alignment = { vertical: 'middle' };
    });
    
    return await workbook.xlsx.writeBuffer();
  }

  async generateCSVReport(matches, outputPath) {
    const headers = ['风险等级', '匹配类型', '相似度', '客户商标', '公告商标', '申请人', '类别', '公告类型', '公告日期', '申请号', '异议截止', '匹配说明'];
    
    const rows = matches.map(m => [
      RISK_LEVEL_LABELS[m.match.risk_level] || m.match.risk_level,
      MATCH_TYPE_LABELS[m.match.match_type] || m.match.match_type,
      (m.match.similarity_score * 100).toFixed(1) + '%',
      m.clientTrademark.trademark_name,
      m.announcementTrademark.trademark_name || m.announcementTrademark.trademarkName,
      m.announcementTrademark.applicant || '-',
      m.announcementTrademark.class_number || m.announcementTrademark.classNumber || '-',
      m.announcementTrademark.announcement_type || m.announcementTrademark.announcementType || '-',
      m.announcementTrademark.announcement_date || m.announcementTrademark.announcementDate || '-',
      m.announcementTrademark.application_number || m.announcementTrademark.applicationNumber || '-',
      m.match.opposition_deadline || '-',
      m.match.details || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    if (outputPath) {
      fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');
    }
    
    return csvContent;
  }

  async generateMonthlyReport(month) {
    const startDate = moment(month).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(month).endOf('month').format('YYYY-MM-DD');
    
    const stats = await getStatistics(startDate, endDate);
    const clients = getClients();
    
    const reportPath = path.join(
      getConfig('reporting.exportPath', './data/exports'),
      `月度报告_${moment(month).format('YYYYMM')}.xlsx`
    );
    
    const workbook = new ExcelJS.Workbook();
    
    const summarySheet = workbook.addWorksheet('总览');
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 25 },
      { header: '数值', key: 'value', width: 15 }
    ];
    summarySheet.addRow({ item: '报告月份', value: moment(month).format('YYYY年MM月') });
    summarySheet.addRow({ item: '处理公告数', value: stats.totalAnnouncements?.processed_count || 0 });
    summarySheet.addRow({ item: '提取商标数', value: stats.totalTrademarks?.count || 0 });
    summarySheet.addRow({ item: '总匹配数', value: stats.byClient.reduce((sum, c) => sum + c.match_count, 0) });
    
    const clientSheet = workbook.addWorksheet('按客户统计');
    clientSheet.columns = [
      { header: '客户ID', key: 'clientId', width: 12 },
      { header: '客户名称', key: 'clientName', width: 25 },
      { header: '匹配数', key: 'matchCount', width: 10 },
      { header: '高风险', key: 'highRisk', width: 10 },
      { header: '中风险', key: 'mediumRisk', width: 10 }
    ];
    stats.byClient.forEach(c => {
      clientSheet.addRow({
        clientId: c.client_id,
        clientName: c.client_name,
        matchCount: c.match_count,
        highRisk: c.high_risk_count,
        mediumRisk: c.medium_risk_count
      });
    });
    
    const classSheet = workbook.addWorksheet('按类别统计');
    classSheet.columns = [
      { header: '商标类别', key: 'classNumber', width: 12 },
      { header: '匹配数', key: 'count', width: 15 }
    ];
    stats.byClass.forEach(c => {
      classSheet.addRow({ classNumber: c.class_number, count: c.count });
    });
    
    await workbook.xlsx.writeFile(reportPath);
    logger.info('Monthly report generated', { path: reportPath });
    
    return reportPath;
  }

  async processPendingNotifications() {
    logger.info('Processing pending notifications');
    
    const pending = await getUnsentNotifications();
    const results = [];
    
    for (const notification of pending) {
      try {
        const mailOptions = {
          from: this.emailConfig.smtp?.auth?.user || 'noreply@example.com',
          to: notification.recipient,
          subject: notification.subject,
          html: `<p>补发通知：${notification.subject}</p>`
        };
        
        await this.initEmailTransport();
        await this.sendWithRetry(mailOptions);
        
        await updateNotificationStatus(notification.id, 'sent');
        results.push({ id: notification.id, success: true });
        logger.info('Pending notification sent', { id: notification.id });
        
      } catch (error) {
        logger.error('Failed to send pending notification', { 
          id: notification.id, 
          error: error.message 
        });
        await updateNotificationStatus(notification.id, 'failed', error.message);
        results.push({ id: notification.id, success: false, error: error.message });
      }
    }
    
    return results;
  }

  async processNewMatches(matches) {
    if (!this.instantAlertEnabled) {
      return { processed: 0, skipped: matches.length };
    }
    
    const groupedByClient = _.groupBy(matches, m => m.clientTrademarkData?.client_id || m.client_id);
    const results = [];
    
    for (const [clientId, clientMatches] of Object.entries(groupedByClient)) {
      const client = getClientById(clientId);
      if (!client || !client.notificationPreferences?.instantAlert) {
        results.push({ clientId, skipped: clientMatches.length });
        continue;
      }
      
      const highPriorityMatches = clientMatches.filter(m => 
        m.riskLevel === 'high' || m.riskLevel === 'medium'
      );
      
      if (highPriorityMatches.length > 0) {
        const matchDetails = highPriorityMatches.map(m => ({
          match: m,
          clientTrademark: m.clientTrademarkData,
          announcementTrademark: m.trademarkData
        }));
        
        const subject = `[商标预警] ${client.name} - ${highPriorityMatches.length}条高优先级公告`;
        const htmlContent = this.generateAlertEmailHTML(matchDetails, client);
        const attachments = await this.generateAttachments(matchDetails);
        
        const notifId = await this.saveNotificationRecord({
          matchId: null,
          clientId: client.id,
          notificationType: 'instant_alert',
          channel: 'email',
          subject,
          recipient: client.contact?.email
        });
        
        try {
          await this.initEmailTransport();
          await this.sendWithRetry({
            from: this.emailConfig.smtp?.auth?.user || 'noreply@example.com',
            to: client.contact?.email,
            subject,
            html: htmlContent,
            attachments
          });
          
          await updateNotificationStatus(notifId, 'sent');
          results.push({ clientId, sent: highPriorityMatches.length });
          
        } catch (error) {
          await updateNotificationStatus(notifId, 'failed', error.message);
          results.push({ clientId, error: error.message });
        }
      }
    }
    
    return results;
  }
}

let alertHandlerInstance = null;

function createAlertHandler(options = {}) {
  if (!alertHandlerInstance) {
    alertHandlerInstance = new AlertHandler(options);
  }
  return alertHandlerInstance;
}

function getAlertHandler() {
  return alertHandlerInstance;
}

module.exports = {
  AlertHandler,
  createAlertHandler,
  getAlertHandler,
  MATCH_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS
};
