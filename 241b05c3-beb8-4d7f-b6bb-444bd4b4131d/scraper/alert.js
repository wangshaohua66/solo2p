const axios = require('axios');
const logger = require('./utils/logger');
const config = require('../config/config');
const { getStore } = require('../db/store');

class AlertService {
  constructor() {
    this.webhookUrl = config.alert.wechatWebhook;
    this.store = getStore();
    this.cooldownMap = new Map();
    this.cooldownMs = 60 * 60 * 1000;
  }

  async sendHighRiskAlert(riskEvent) {
    if (!this.webhookUrl) {
      logger.warn('未配置企业微信Webhook，跳过告警推送', 'Alert');
      return false;
    }

    const cacheKey = `risk_${riskEvent.id}`;
    if (this.cooldownMap.has(cacheKey)) {
      const lastSent = this.cooldownMap.get(cacheKey);
      if (Date.now() - lastSent < this.cooldownMs) {
        logger.debug(`告警冷却中，跳过: ${riskEvent.projectNo}`, 'Alert');
        return false;
      }
    }

    try {
      const message = this._formatRiskMessage(riskEvent);

      await axios.post(
        this.webhookUrl,
        {
          msgtype: 'markdown',
          markdown: {
            content: message,
          },
        },
        { timeout: 10000 }
      );

      this.cooldownMap.set(cacheKey, Date.now());
      logger.success(`高危告警已推送: ${riskEvent.project_name || riskEvent.projectNo}`, 'Alert');
      return true;
    } catch (error) {
      logger.error(`告警推送失败: ${error.message}`, 'Alert');
      return false;
    }
  }

  _formatRiskMessage(riskEvent) {
    const { db } = this.store;
    const project = riskEvent.project_id
      ? db.prepare('SELECT * FROM projects WHERE id = ?').get(riskEvent.project_id)
      : null;

    const riskTypeName = this._getRiskTypeName(riskEvent.risk_type);
    const scoreColor = riskEvent.risk_score >= 85 ? 'warning' : 'info';

    let details = '';
    try {
      if (riskEvent.risk_details) {
        const detailObj = typeof riskEvent.risk_details === 'string'
          ? JSON.parse(riskEvent.risk_details)
          : riskEvent.risk_details;
        details = detailObj.description || JSON.stringify(detailObj);
      }
    } catch (e) {
      details = riskEvent.risk_details || '';
    }

    return `
# <font color="warning">⚠️ 串标风险预警</font>

**项目名称**: <font color="info">${riskEvent.project_name || '未知'}</font>
**项目编号**: ${riskEvent.project_no || '未知'}
**风险类型**: ${riskTypeName}
**风险评分**: <font color="${scoreColor}">${riskEvent.risk_score.toFixed(1)}</font> 分

**风险详情**:
> ${details}

**采购人**: ${project?.purchaser || '未知'}
**发现时间**: ${riskEvent.created_at || new Date().toLocaleString('zh-CN')}

---
*请及时核实处理，此消息由公共资源交易监督系统自动发送*
`.trim();
  }

  _getRiskTypeName(type) {
    const typeMap = {
      high_win_rate: '高中标率风险',
      price_deviation: '价格偏离风险',
      related_bidders: '关联投标人风险',
      similar_scheme: '技术方案雷同风险',
      frequent_bidding: '高频投标风险',
    };
    return typeMap[type] || type;
  }

  async sendDailySummary() {
    if (!this.webhookUrl) {
      return false;
    }

    const { db } = this.store;

    const today = new Date().toISOString().split('T')[0];
    const newProjects = db.prepare(`
      SELECT COUNT(*) as cnt FROM projects
      WHERE date(created_at) = date('now')
    `).get().cnt;

    const newRisks = db.prepare(`
      SELECT COUNT(*) as cnt FROM risk_events
      WHERE date(created_at) = date('now')
    `).get().cnt;

    const highRisks = db.prepare(`
      SELECT COUNT(*) as cnt FROM risk_events
      WHERE date(created_at) = date('now') AND risk_score >= 85
    `).get().cnt;

    const message = `
# 📊 每日巡查报告

**日期**: ${today}

**新增项目**: ${newProjects} 个
**新增风险事件**: ${newRisks} 起
**高危风险**: <font color="warning">${highRisks}</font> 起

---
*公共资源交易监督系统*
`.trim();

    try {
      await axios.post(
        this.webhookUrl,
        {
          msgtype: 'markdown',
          markdown: { content: message },
        },
        { timeout: 10000 }
      );
      return true;
    } catch (error) {
      logger.error(`每日报告推送失败: ${error.message}`, 'Alert');
      return false;
    }
  }

  async batchSendHighRisks(threshold = 85) {
    const { db } = this.store;

    const highRisks = db.prepare(`
      SELECT * FROM risk_events
      WHERE risk_score >= ? AND status = 'pending'
      ORDER BY risk_score DESC
      LIMIT 10
    `).all(threshold);

    let sentCount = 0;
    for (const risk of highRisks) {
      const sent = await this.sendHighRiskAlert(risk);
      if (sent) sentCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`共推送 ${sentCount}/${highRisks.length} 条高危告警`, 'Alert');
    return sentCount;
  }

  setWebhookUrl(url) {
    this.webhookUrl = url;
  }
}

let alertInstance = null;

function getAlertService() {
  if (!alertInstance) {
    alertInstance = new AlertService();
  }
  return alertInstance;
}

module.exports = {
  AlertService,
  getAlertService,
};
