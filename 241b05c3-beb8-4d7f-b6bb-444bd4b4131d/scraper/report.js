const fs = require('fs');
const path = require('path');
const { getStore } = require('../db/store');
const logger = require('./utils/logger');
const config = require('../config/config');

class ReportGenerator {
  constructor() {
    this.store = getStore();
    this.reportsDir = path.join(__dirname, '..', 'reports');
    this._ensureDir(this.reportsDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  generateWeeklyReport() {
    const { db } = this.store;

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = now.toISOString().split('T')[0];

    logger.info(`生成周报告: ${weekStartStr} ~ ${weekEndStr}`, 'Report');

    const stats = {
      period: { start: weekStartStr, end: weekEndStr },
      generatedAt: now.toISOString(),
      platforms: {},
    };

    const platforms = ['ggzy', 'provincial'];
    for (const platform of platforms) {
      const platformProjects = db.prepare(`
        SELECT COUNT(*) as cnt FROM projects
        WHERE platform = ? AND date(created_at) >= date(?)
      `).get(platform, weekStartStr).cnt;

      const platformStats = db.prepare(`
        SELECT * FROM crawl_tasks WHERE platform = ? ORDER BY updated_at DESC LIMIT 1
      `).get(platform);

      stats.platforms[platform] = {
        name: config.platforms[platform]?.name || platform,
        newProjects: platformProjects,
        lastCrawl: platformStats?.last_crawl_date || '-',
        status: platformStats?.status || 'unknown',
      };
    }

    stats.totalNewProjects = db.prepare(`
      SELECT COUNT(*) as cnt FROM projects
      WHERE date(created_at) >= date(?)
    `).get(weekStartStr).cnt;

    stats.totalProjects = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
    stats.totalBidders = db.prepare('SELECT COUNT(*) as cnt FROM bidders').get().cnt;

    stats.riskEvents = {
      total: db.prepare(`
        SELECT COUNT(*) as cnt FROM risk_events
        WHERE date(created_at) >= date(?)
      `).get(weekStartStr).cnt,
      high: db.prepare(`
        SELECT COUNT(*) as cnt FROM risk_events
        WHERE date(created_at) >= date(?) AND risk_score >= 85
      `).get(weekStartStr).cnt,
      medium: db.prepare(`
        SELECT COUNT(*) as cnt FROM risk_events
        WHERE date(created_at) >= date(?) AND risk_score >= 70 AND risk_score < 85
      `).get(weekStartStr).cnt,
    };

    stats.highRiskList = db.prepare(`
      SELECT * FROM risk_events
      WHERE risk_score >= 70 AND date(created_at) >= date(?)
      ORDER BY risk_score DESC
      LIMIT 20
    `).all(weekStartStr);

    const html = this._renderHTML(stats);

    const reportPath = path.join(this.reportsDir, `weekly_${weekEndStr}.html`);
    fs.writeFileSync(reportPath, html, 'utf-8');

    logger.success(`周报告已生成: ${reportPath}`, 'Report');
    return { path: reportPath, stats };
  }

  generateDailyReport() {
    const { db } = this.store;
    const today = new Date().toISOString().split('T')[0];

    logger.info(`生成每日报告: ${today}`, 'Report');

    const stats = {
      date: today,
      generatedAt: new Date().toISOString(),
    };

    stats.newProjects = db.prepare(`
      SELECT COUNT(*) as cnt FROM projects WHERE date(created_at) = date(?)
    `).get(today).cnt;

    stats.newRisks = db.prepare(`
      SELECT COUNT(*) as cnt FROM risk_events WHERE date(created_at) = date(?)
    `).get(today).cnt;

    stats.totalProjects = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
    stats.totalBidders = db.prepare('SELECT COUNT(*) as cnt FROM bidders').get().cnt;

    stats.riskBreakdown = {
      high: db.prepare('SELECT COUNT(*) as cnt FROM risk_events WHERE risk_score >= 85').get().cnt,
      medium: db.prepare('SELECT COUNT(*) as cnt FROM risk_events WHERE risk_score >= 70 AND risk_score < 85').get().cnt,
      low: db.prepare('SELECT COUNT(*) as cnt FROM risk_events WHERE risk_score < 70').get().cnt,
    };

    stats.highRisks = db.prepare(`
      SELECT * FROM risk_events
      WHERE risk_score >= 85
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    stats.platformStats = {};
    for (const platform of ['ggzy', 'provincial']) {
      const task = db.prepare('SELECT * FROM crawl_tasks WHERE platform = ? ORDER BY updated_at DESC LIMIT 1').get(platform);
      stats.platformStats[platform] = {
        name: config.platforms[platform]?.name || platform,
        status: task?.status || 'pending',
        lastUpdate: task?.updated_at || '-',
      };
    }

    const html = this._renderDailyHTML(stats);
    const reportPath = path.join(this.reportsDir, `daily_${today}.html`);
    fs.writeFileSync(reportPath, html, 'utf-8');

    logger.success(`每日报告已生成: ${reportPath}`, 'Report');
    return { path: reportPath, stats };
  }

  _renderHTML(stats) {
    const riskTypeMap = {
      high_win_rate: '高中标率',
      price_deviation: '价格偏离',
      related_bidders: '关联投标',
      similar_scheme: '方案雷同',
      frequent_bidding: '高频投标',
    };

    const riskListHTML = stats.highRiskList.map(risk => `
      <tr>
        <td>${risk.project_no || '-'}</td>
        <td>${risk.project_name || '-'}</td>
        <td>${riskTypeMap[risk.risk_type] || risk.risk_type}</td>
        <td style="color: ${risk.risk_score >= 85 ? '#dc2626' : '#ea580c'}; font-weight: bold;">
          ${risk.risk_score.toFixed(1)}
        </td>
        <td>${risk.created_at}</td>
        <td>${risk.status === 'evidence_collected' ? '✅ 已取证' : '⏳ 待处理'}</td>
      </tr>
    `).join('');

    const platformsHTML = Object.entries(stats.platforms).map(([key, p]) => `
      <div class="platform-card">
        <h3>${p.name}</h3>
        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-label">新增项目</span>
            <span class="stat-value">${p.newProjects}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">状态</span>
            <span class="stat-value ${p.status === 'success' ? 'success' : 'warning'}">${p.status || '-'}
            </span>
          </div>
        </div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公共资源交易监督周报</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #1f2937; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .period { opacity: 0.9; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-card .label { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #1f2937; }
    .summary-card .value.danger { color: #dc2626; }
    .summary-card .value.warning { color: #ea580c; }
    .summary-card .value.success { color: #059669; }
    .section { background: white; padding: 24px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .section h2 { font-size: 20px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    .platforms-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .platform-card { padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .platform-card h3 { font-size: 16px; margin-bottom: 12px; color: #1e40af; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat-item { display: flex; flex-direction: column; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .stat-value { font-size: 18px; font-weight: 600; }
    .stat-value.success { color: #059669; }
    .stat-value.warning { color: #ea580c; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; font-size: 13px; color: #374151; }
    tr:hover { background: #f9fafb; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; padding: 20px; }
    .risk-pill { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .risk-high { background: #fee2e2; color: #dc2626; }
    .risk-medium { background: #fed7aa; color: #ea580c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 公共资源交易监督周报</h1>
      <div class="period">统计周期: ${stats.period.start} 至 ${stats.period.end}</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">本周新增项目</div>
        <div class="value">${stats.totalNewProjects}</div>
      </div>
      <div class="summary-card">
        <div class="label">累计项目总数</div>
        <div class="value">${stats.totalProjects}</div>
      </div>
      <div class="summary-card">
        <div class="label">本周风险事件</div>
        <div class="value warning">${stats.riskEvents.total}</div>
      </div>
      <div class="summary-card">
        <div class="label">高危风险</div>
        <div class="value danger">${stats.riskEvents.high}</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 各平台抓取情况</h2>
      <div class="platforms-grid">
        ${platformsHTML}
      </div>
    </div>

    <div class="section">
      <h2>⚠️ 高危风险事件清单</h2>
      <table>
        <thead>
          <tr>
            <th>项目编号</th>
            <th>项目名称</th>
            <th>风险类型</th>
            <th>风险评分</th>
            <th>发现时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          ${riskListHTML || '<tr><td colspan="6" style="text-align: center; color: #9ca3af;">暂无风险事件</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="footer">
      报告生成时间: ${stats.generatedAt} | 公共资源交易监督系统
    </div>
  </div>
</body>
</html>
`.trim();
  }

  _renderDailyHTML(stats) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>每日巡查报告 - ${stats.date}</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .stat-label { color: #666; }
    .stat-value { font-weight: bold; color: #333; }
    .danger { color: #dc3545 !important; }
    .warning { color: #fd7e14 !important; }
    .success { color: #28a745 !important; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 每日巡查报告</h1>
    <p>日期: ${stats.date}</p>

    <h3>今日数据</h3>
    <div class="stat-row">
      <span class="stat-label">新增项目</span>
      <span class="stat-value">${stats.newProjects}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">新增风险</span>
      <span class="stat-value danger">${stats.newRisks}</span>
    </div>

    <h3>累计数据</h3>
    <div class="stat-row">
      <span class="stat-label">项目总数</span>
      <span class="stat-value">${stats.totalProjects}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">投标人总数</span>
      <span class="stat-value">${stats.totalBidders}</span>
    </div>

    <h3>风险分布</h3>
    <div class="stat-row">
      <span class="stat-label">高危 (≥85分)</span>
      <span class="stat-value danger">${stats.riskBreakdown.high}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">中危 (70-84分)</span>
      <span class="stat-value warning">${stats.riskBreakdown.medium}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">低危 (<70分)</span>
      <span class="stat-value success">${stats.riskBreakdown.low}</span>
    </div>

    <p style="color: #999; margin-top: 30px; font-size: 12px;">
      报告生成时间: ${stats.generatedAt}
    </p>
  </div>
</body>
</html>
`.trim();
  }

  getLatestReport(type = 'weekly') {
    const files = fs.readdirSync(this.reportsDir)
      .filter(f => f.startsWith(type) && f.endsWith('.html'))
      .sort()
      .reverse();

    if (files.length === 0) return null;
    return path.join(this.reportsDir, files[0]);
  }

  listReports(type = null) {
    let files = fs.readdirSync(this.reportsDir)
      .filter(f => f.endsWith('.html'));

    if (type) {
      files = files.filter(f => f.startsWith(type));
    }

    return files.sort().reverse().map(f => ({
      name: f,
      path: path.join(this.reportsDir, f),
      type: f.startsWith('weekly') ? 'weekly' : 'daily',
    }));
  }
}

let reportInstance = null;

function getReportGenerator() {
  if (!reportInstance) {
    reportInstance = new ReportGenerator();
  }
  return reportInstance;
}

module.exports = {
  ReportGenerator,
  getReportGenerator,
};
