import nodemailer from 'nodemailer';
import axios from 'axios';
import logger from '../utils/logger';
import { ChangeRecord, NotificationConfig, SiteConfig } from '../types';
import repository from '../storage/repository';
import { formatDate } from '../utils/helpers';

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  email: {
    enabled: false,
    smtp: {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: '',
      pass: ''
    },
    recipients: []
  },
  wecom: {
    enabled: false,
    webhookUrl: '',
    mentionedList: []
  }
};

export class AlertService {
  private config: NotificationConfig;
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor(config?: Partial<NotificationConfig>) {
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
    this.initEmailTransporter();
  }

  private initEmailTransporter(): void {
    if (!this.config.email.enabled) return;

    try {
      this.emailTransporter = nodemailer.createTransport({
        host: this.config.email.smtp.host,
        port: this.config.email.smtp.port,
        secure: this.config.email.smtp.secure,
        auth: {
          user: this.config.email.smtp.user,
          pass: this.config.email.smtp.pass
        }
      });
      logger.info('Email transporter initialized');
    } catch (err) {
      logger.error(`Failed to initialize email transporter: ${(err as Error).message}`);
    }
  }

  async sendAlerts(changes: ChangeRecord[]): Promise<{
    email: { success: boolean; sent: number; error?: string };
    wecom: { success: boolean; sent: number; error?: string };
  }> {
    type AlertResult = { success: boolean; sent: number; error?: string };

    if (changes.length === 0) {
      return {
        email: { success: true, sent: 0 },
        wecom: { success: true, sent: 0 }
      };
    }

    const highPriority = changes.filter(c => c.changeLevel === 'high');
    const mediumPriority = changes.filter(c => c.changeLevel === 'medium');
    const lowPriority = changes.filter(c => c.changeLevel === 'low');

    let emailResult: AlertResult = { success: true, sent: 0 };
    let wecomResult: AlertResult = { success: true, sent: 0 };

    if (this.config.email.enabled && highPriority.length > 0) {
      try {
        const sent = await this.sendEmailAlert(changes);
        emailResult = { success: true, sent };
      } catch (err) {
        emailResult = { success: false, sent: 0, error: (err as Error).message };
        logger.error(`Email alert failed: ${(err as Error).message}`);
      }
    }

    if (this.config.wecom.enabled) {
      try {
        const sent = await this.sendWecomAlert(changes);
        wecomResult = { success: true, sent };
      } catch (err) {
        wecomResult = { success: false, sent: 0, error: (err as Error).message };
        logger.error(`WeCom alert failed: ${(err as Error).message}`);
      }
    }

    for (const change of changes) {
      if (change.id) {
        repository.markChangeNotified(change.id);
      }
    }

    logger.info(`Alert sending completed: email ${emailResult.sent}, wecom ${wecomResult.sent}`);
    return { email: emailResult, wecom: wecomResult };
  }

  private async sendEmailAlert(changes: ChangeRecord[]): Promise<number> {
    if (!this.emailTransporter || this.config.email.recipients.length === 0) {
      return 0;
    }

    const highCount = changes.filter(c => c.changeLevel === 'high').length;
    const subject = `【政策预警】检测到${changes.length}项政策变更（高风险${highCount}项）`;

    const htmlBody = this.generateEmailHtml(changes);
    const textBody = this.generateEmailText(changes);

    const info = await this.emailTransporter.sendMail({
      from: `"政策监控系统" <${this.config.email.smtp.user}>`,
      to: this.config.email.recipients.join(', '),
      subject,
      text: textBody,
      html: htmlBody
    });

    logger.info(`Email sent: ${info.messageId}`);
    return this.config.email.recipients.length;
  }

  private generateEmailHtml(changes: ChangeRecord[]): string {
    const highChanges = changes.filter(c => c.changeLevel === 'high');
    const mediumChanges = changes.filter(c => c.changeLevel === 'medium');
    const lowChanges = changes.filter(c => c.changeLevel === 'low');

    const renderChangeRow = (c: ChangeRecord) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">
          <span style="color:${c.changeLevel === 'high' ? '#d00' : c.changeLevel === 'medium' ? '#f90' : '#090'};font-weight:bold;">
            ${c.changeLevel === 'high' ? '高' : c.changeLevel === 'medium' ? '中' : '低'}
          </span>
        </td>
        <td style="padding:8px;border:1px solid #ddd;">
          ${c.changeType === 'add' ? '新增' : c.changeType === 'modify' ? '修改' : '废止'}
        </td>
        <td style="padding:8px;border:1px solid #ddd;">
          <a href="${c.policyUrl}" style="color:#06c;">${c.policyTitle}</a>
        </td>
      </tr>
    `;

    return `
      <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;">
        <h2 style="color:#333;border-bottom:2px solid #0066cc;padding-bottom:10px;">
          📋 政策变更预警通知
        </h2>
        <p>检测时间：${formatDate(new Date())}</p>
        <p>本次共检测到 <strong>${changes.length}</strong> 项政策变更，其中：</p>
        <ul>
          <li style="color:#d00;">🔴 高风险：${highChanges.length} 项</li>
          <li style="color:#f90;">🟡 中风险：${mediumChanges.length} 项</li>
          <li style="color:#090;">🟢 低风险：${lowChanges.length} 项</li>
        </ul>

        <h3 style="color:#333;margin-top:20px;">变更明细</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:10px;border:1px solid #ddd;width:60px;">等级</th>
              <th style="padding:10px;border:1px solid #ddd;width:60px;">类型</th>
              <th style="padding:10px;border:1px solid #ddd;">政策标题</th>
            </tr>
          </thead>
          <tbody>
            ${changes.map(renderChangeRow).join('')}
          </tbody>
        </table>

        <p style="margin-top:20px;color:#888;font-size:12px;">
          本邮件由政策监控系统自动发送，请勿直接回复。
        </p>
      </div>
    `;
  }

  private generateEmailText(changes: ChangeRecord[]): string {
    let text = '政策变更预警通知\n';
    text += `检测时间：${formatDate(new Date())}\n`;
    text += `共检测到 ${changes.length} 项政策变更\n\n`;

    for (const c of changes) {
      const level = c.changeLevel === 'high' ? '高' : c.changeLevel === 'medium' ? '中' : '低';
      const type = c.changeType === 'add' ? '新增' : c.changeType === 'modify' ? '修改' : '废止';
      text += `[${level}风险] [${type}] ${c.policyTitle}\n`;
      text += `链接：${c.policyUrl}\n\n`;
    }

    return text;
  }

  private async sendWecomAlert(changes: ChangeRecord[]): Promise<number> {
    if (!this.config.wecom.enabled || !this.config.wecom.webhookUrl) {
      return 0;
    }

    const highChanges = changes.filter(c => c.changeLevel === 'high');

    let content = `## 📋 政策变更预警\n\n`;
    content += `检测时间：${formatDate(new Date())}\n`;
    content += `共检测到 **${changes.length}** 项政策变更\n\n`;
    content += `🔴 高风险：${highChanges.length} 项\n`;
    content += `🟡 中风险：${changes.filter(c => c.changeLevel === 'medium').length} 项\n`;
    content += `🟢 低风险：${changes.filter(c => c.changeLevel === 'low').length} 项\n\n`;
    content += `### 高风险变更\n`;

    for (const c of highChanges.slice(0, 5)) {
      const type = c.changeType === 'add' ? '新增' : c.changeType === 'modify' ? '修改' : '废止';
      content += `- [${type}] ${c.policyTitle}\n`;
      content += `  链接：${c.policyUrl}\n`;
    }

    if (highChanges.length > 5) {
      content += `\n...还有 ${highChanges.length - 5} 项高风险变更`;
    }

    const payload = {
      msgtype: 'markdown',
      markdown: {
        content
      }
    };

    if (this.config.wecom.mentionedList && this.config.wecom.mentionedList.length > 0) {
      (payload as any).markdown.mentioned_mobile_list = this.config.wecom.mentionedList;
    }

    const response = await axios.post(this.config.wecom.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.data.errcode !== 0) {
      throw new Error(`WeCom webhook error: ${response.data.errmsg}`);
    }

    logger.info('WeCom alert sent successfully');
    return 1;
  }

  generateChangeReport(changes: ChangeRecord[], sites: SiteConfig[]): string {
    const byProvince = new Map<string, ChangeRecord[]>();
    const byLevel = {
      high: changes.filter(c => c.changeLevel === 'high'),
      medium: changes.filter(c => c.changeLevel === 'medium'),
      low: changes.filter(c => c.changeLevel === 'low')
    };
    const byType = {
      add: changes.filter(c => c.changeType === 'add'),
      modify: changes.filter(c => c.changeType === 'modify'),
      abolish: changes.filter(c => c.changeType === 'abolish')
    };

    for (const change of changes) {
      const site = sites.find(s => s.id === change.siteId);
      const province = site?.province || '未知';
      if (!byProvince.has(province)) {
        byProvince.set(province, []);
      }
      byProvince.get(province)!.push(change);
    }

    const levelColor = (level: string) => level === 'high' ? '#d00' : level === 'medium' ? '#f90' : '#090';
    const levelText = (level: string) => level === 'high' ? '高' : level === 'medium' ? '中' : '低';
    const typeText = (type: string) => type === 'add' ? '新增' : type === 'modify' ? '修改' : '废止';
    const typeColor = (type: string) => type === 'add' ? '#2e7d32' : type === 'modify' ? '#1565c0' : '#c62828';

    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>政策变更报告 - ${formatDate(new Date())}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1976d2, #0d47a1); color: #fff; padding: 30px 40px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .subtitle { opacity: 0.9; font-size: 14px; }
    .summary { display: flex; padding: 24px 40px; gap: 16px; border-bottom: 1px solid #eee; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 140px; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .number { font-size: 28px; font-weight: bold; margin-bottom: 4px; }
    .summary-card .label { font-size: 13px; color: #666; }
    .summary-card.high .number { color: #d00; }
    .summary-card.medium .number { color: #f90; }
    .summary-card.low .number { color: #090; }
    .section { padding: 24px 40px; border-bottom: 1px solid #eee; }
    .section h2 { font-size: 18px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #1976d2; display: inline-block; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f7fa; font-weight: 600; color: #555; }
    tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge-level-high { background: #ffebee; color: #c62828; }
    .badge-level-medium { background: #fff3e0; color: #e65100; }
    .badge-level-low { background: #e8f5e9; color: #2e7d32; }
    .badge-type-add { background: #e8f5e9; color: #2e7d32; }
    .badge-type-modify { background: #e3f2fd; color: #1565c0; }
    .badge-type-abolish { background: #ffebee; color: #c62828; }
    .province-group { margin-bottom: 24px; }
    .province-group h3 { font-size: 16px; color: #1976d2; margin-bottom: 12px; }
    .diff-summary { font-size: 12px; color: #666; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    a { color: #1976d2; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 政策变更监测报告</h1>
      <div class="subtitle">生成时间：${formatDate(new Date())} | 覆盖站点：${sites.length} 个</div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="number">${changes.length}</div>
        <div class="label">总变更数</div>
      </div>
      <div class="summary-card high">
        <div class="number">${byLevel.high.length}</div>
        <div class="label">高风险</div>
      </div>
      <div class="summary-card medium">
        <div class="number">${byLevel.medium.length}</div>
        <div class="label">中风险</div>
      </div>
      <div class="summary-card low">
        <div class="number">${byLevel.low.length}</div>
        <div class="label">低风险</div>
      </div>
      <div class="summary-card">
        <div class="number">${byType.add.length}</div>
        <div class="label">新增政策</div>
      </div>
      <div class="summary-card">
        <div class="number">${byType.modify.length}</div>
        <div class="label">修改政策</div>
      </div>
    </div>

    <div class="section">
      <h2>按省份分布</h2>
      <table>
        <thead>
          <tr><th>省份</th><th>变更数量</th><th>高风险</th><th>中风险</th><th>低风险</th></tr>
        </thead>
        <tbody>
          ${[...byProvince.entries()].sort((a, b) => b[1].length - a[1].length).map(([province, list]) => `
            <tr>
              <td><strong>${province}</strong></td>
              <td>${list.length}</td>
              <td style="color:#d00;">${list.filter(c => c.changeLevel === 'high').length}</td>
              <td style="color:#f90;">${list.filter(c => c.changeLevel === 'medium').length}</td>
              <td style="color:#090;">${list.filter(c => c.changeLevel === 'low').length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>变更明细</h2>
      ${[...byProvince.entries()].sort((a, b) => b[1].length - a[1].length).map(([province, list]) => `
        <div class="province-group">
          <h3>${province}（${list.length}项）</h3>
          <table>
            <thead>
              <tr>
                <th style="width:70px;">风险等级</th>
                <th style="width:70px;">变更类型</th>
                <th>政策标题</th>
                <th>相似度</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => `
                <tr>
                  <td><span class="badge badge-level-${c.changeLevel}">${levelText(c.changeLevel)}</span></td>
                  <td><span class="badge badge-type-${c.changeType}">${typeText(c.changeType)}</span></td>
                  <td><a href="${c.policyUrl}" target="_blank">${c.policyTitle}</a></td>
                  <td>${c.similarity !== undefined ? (c.similarity * 100).toFixed(1) + '%' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      本报告由政策监控系统自动生成 · ${formatDate(new Date())}
    </div>
  </div>
</body>
</html>
`;

    return html;
  }

  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.initEmailTransporter();
    logger.info('Alert service config updated');
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}

export default AlertService;
