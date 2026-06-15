'use strict';

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, differenceInHours, parseISO } = require('date-fns');
const { zhCN } = require('date-fns/locale');
const { logger } = require('../utils/logger');
const repository = require('../storage/repository');

const REPORTS_DIR = path.resolve(process.cwd(), 'reports');
const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

const TEMPLATE_WEEKLY = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title><%= title %></title>
<style>
  body{font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width:1200px; margin:20px auto; padding: 0 24px; color:#1f2937}
  h1{color:#1e40af; border-bottom:2px solid #1e40af; padding-bottom:8px}
  h2{color:#334155; margin-top:32px}
  .meta{color:#64748b; font-size:13px; margin-bottom:24px}
  table{width:100%; border-collapse:collapse; margin:16px 0; font-size:13px}
  th,td{border:1px solid #e2e8f0; padding:8px 12px; text-align:left}
  th{background:#f1f5f9; color:#334155}
  tr:nth-child(even){background:#f8fafc}
  .badge{display:inline-block; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:600}
  .CRITICAL{background:#fee2e2; color:#991b1b}
  .HIGH{background:#ffedd5; color:#9a3412}
  .MEDIUM{background:#fef9c3; color:#854d0e}
  .LOW{background:#dbeafe; color:#1e40af}
  .stat-grid{display:grid; grid-template-columns: repeat(6, 1fr); gap:16px; margin:20px 0}
  .stat-card{border:1px solid #e2e8f0; border-radius:8px; padding:16px; text-align:center}
  .stat-card .num{font-size:28px; font-weight:700; color:#1e40af}
  .stat-card .label{font-size:12px; color:#64748b; margin-top:4px}
  .timeline-item{padding:8px 12px; border-left:3px solid #e2e8f0; margin-bottom:8px}
  .timeline-item.CRITICAL{border-left-color:#dc2626}
  .timeline-item.HIGH{border-left-color:#ea580c}
  .footer{margin-top:40px; padding-top:16px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px; text-align:center}
</style></head><body>
<h1><%= title %></h1>
<div class="meta">报告周期: <%= rangeLabel %> | 生成时间: <%= generatedAt %> | 生成系统: 药品合规监控平台</div>
<div class="stat-grid">
  <% for (const s of stats) { %><div class="stat-card"><div class="num"><%= s.value %></div><div class="label"><%= s.label %></div></div><% } %>
</div>

<h2>1. 平台新增事件分布</h2>
<table><thead><tr><th>来源平台</th><th>事件类型</th><th>总数</th><th>新增</th><th>修订</th><th>去重</th></tr></thead><tbody>
<% for (const p of platformBreakdown) { %>
  <tr><td><%= p.platform %></td><td><%= p.eventType %></td><td><%= p.total %></td><td><%= p.inserted %></td><td><%= p.updated %></td><td><%= p.duplicate %></td></tr>
<% } %>
</tbody></table>

<h2>2. 紧急/重要事件明细</h2>
<table><thead><tr><th>级别</th><th>药品名称</th><th>批准文号</th><th>事件类型</th><th>发布日期</th><th>来源</th><th>标题/内容</th></tr></thead><tbody>
<% for (const r of criticalEvents) { %>
  <tr>
    <td><span class="badge <%= r.urgency %>"><%= r.urgencyLabel %></span></td>
    <td><%= r.drug_name %></td><td><%= r.approval_no %></td>
    <td><%= r.eventTypeLabel %></td><td><%= r.publish_date %></td><td><%= r.source %></td>
    <td style="max-width:360px"><%= r.title %></td>
  </tr>
<% } %>
<% if (criticalEvents.length === 0) { %><tr><td colspan="7" style="color:#94a3b8;text-align:center">本周期无紧急/重要事件</td></tr><% } %>
</tbody></table>

<% if (typeof recallResponse !== 'undefined' && recallResponse) { %>
<h2>3. 召回响应时效分析</h2>
<div class="stat-grid" style="grid-template-columns: repeat(3,1fr)">
  <div class="stat-card"><div class="num"><%= recallResponse.avgHrs %></div><div class="label">平均响应(小时)</div></div>
  <div class="stat-card"><div class="num"><%= recallResponse.pctUnder6h %>%</div><div class="label">6小时内响应占比</div></div>
  <div class="stat-card"><div class="num"><%= recallResponse.total %></div><div class="label">本周期召回总数</div></div>
</div>
<% } %>

<h2>4. 采集任务执行情况</h2>
<table><thead><tr><th>平台</th><th>任务数</th><th>成功</th><th>失败</th><th>重试次数</th><th>验证码拦截</th><th>平均耗时</th></tr></thead><tbody>
<% for (const t of taskStats) { %>
  <tr><td><%= t.platform %></td><td><%= t.total %></td><td><%= t.success %></td><td><%= t.failed %></td><td><%= t.retries %></td><td><%= t.captcha %></td><td><%= t.avgDuration %>s</td></tr>
<% } %>
</tbody></table>

<div class="footer">本报告由药品合规数据采集与监控系统自动生成 · 数据仅供内部参考 · <%= disclaimer || '' %></div>
</body></html>`;

const EVENT_TYPE_LABELS = {
  recall: '药品召回', license_expiry: '许可证到期预警', gsp_inspection: 'GSP检查',
  bid_result: '集采中标结果', adr_report: '不良反应通报', sampling_result: '药监抽检结果',
  license_change: '许可变更', approval_change: '审批变更', gsp_cert: 'GSP证书',
  generic: '其他合规事件',
};

const URGENCY_LABELS = { CRITICAL: '紧急', HIGH: '重要', MEDIUM: '一般', LOW: '关注' };

class ReportGenerator {
  constructor() {
    this._ensureDirs();
  }

  _ensureDirs() {
    for (const d of [REPORTS_DIR, TEMPLATES_DIR]) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }
  }

  _dateRange(reportType, customFrom, customTo) {
    const now = new Date();
    if (customFrom && customTo) return { from: new Date(customFrom), to: new Date(customTo) };
    if (reportType === 'weekly') {
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    if (reportType === 'monthly') {
      return { from: startOfMonth(now), to: endOfMonth(now) };
    }
    return { from: subDays(now, 7), to: now };
  }

  async _fetchEventStats(from, to) {
    const col = repository.collection(repository.COLLECTIONS.EVENTS);
    const match = { createdAt: { $gte: from, $lte: to } };
    const platformBreakdown = await col.aggregate([
      { $match: match },
      { $group: {
        _id: { platform: '$source_platform_name', eventType: '$event_type' },
        total: { $sum: 1 },
        inserted: { $sum: { $cond: [{ $eq: ['$revisionCount', 0] }, 1, 0] } },
        updated: { $sum: { $cond: [{ $gte: ['$revisionCount', 1] }, 1, 0] } },
      }},
      { $sort: { total: -1 } },
    ]).toArray();

    const typeCount = await col.aggregate([
      { $match: match },
      { $group: { _id: '$event_type', count: { $sum: 1 } } },
    ]).toArray();

    const urgencyCount = await col.aggregate([
      { $match: match },
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
    ]).toArray();

    const total = platformBreakdown.reduce((s, p) => s + p.total, 0);
    const updated = platformBreakdown.reduce((s, p) => s + p.updated, 0);
    const inserted = platformBreakdown.reduce((s, p) => s + p.inserted, 0);
    const criticalCount = (urgencyCount.find((u) => u._id === 'CRITICAL')?.count || 0)
                        + (urgencyCount.find((u) => u._id === 'HIGH')?.count || 0);

    const criticalEvents = await col.find(
      { ...match, urgency: { $in: ['CRITICAL', 'HIGH'] } },
      { sort: { urgency: -1, createdAt: -1 }, limit: 50 }
    ).toArray();

    return {
      platformBreakdown: platformBreakdown.map((p) => ({
        platform: p._id.platform,
        eventType: EVENT_TYPE_LABELS[p._id.eventType] || p._id.eventType,
        total: p.total, inserted: p.inserted, updated: p.updated,
        duplicate: Math.max(0, p.total - p.inserted - p.updated),
      })),
      typeCount, urgencyCount,
      stats: [
        { label: '合规事件总数', value: total },
        { label: '新增入库', value: inserted },
        { label: '字段修订', value: updated },
        { label: '去重跳过', value: Math.max(0, total - inserted - updated) },
        { label: '紧急/重要事件', value: criticalCount },
        { label: '涉及平台数', value: new Set(platformBreakdown.map((p) => p._id.platform)).size },
      ],
      criticalEvents: criticalEvents.map((e) => ({
        urgency: e.urgency, urgencyLabel: URGENCY_LABELS[e.urgency] || e.urgency,
        drug_name: e.drug_name || '-', approval_no: e.approval_no || '-',
        eventTypeLabel: EVENT_TYPE_LABELS[e.event_type] || e.event_type,
        publish_date: e.publish_date || '-', source: e.source_platform_name || e.source_platform,
        title: (e.title || '').substring(0, 80) || (e.drug_name || '-'),
      })),
    };
  }

  async _fetchTaskStats(from, to) {
    const col = repository.collection(repository.COLLECTIONS.TASKS);
    const tasks = await col.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: {
        _id: '$platformName',
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        retries: { $sum: '$attempts' },
        captcha: { $sum: { $ifNull: ['$captchaIntercepts', 0] } },
        avgDur: { $avg: { $subtract: [{ $ifNull: ['$finishedAt', new Date()] }, { $ifNull: ['$startedAt', '$createdAt'] }] } },
      }},
    ]).toArray();
    return tasks.map((t) => ({
      platform: t._id, total: t.total, success: t.success, failed: t.failed,
      retries: t.retries, captcha: t.captcha,
      avgDuration: t.avgDur ? Math.round(t.avgDur / 1000) : 0,
    }));
  }

  async _analyzeRecallResponse(from, to) {
    const col = repository.collection(repository.COLLECTIONS.EVENTS);
    const recalls = await col.find({
      createdAt: { $gte: from, $lte: to }, event_type: 'recall',
      publish_date: { $exists: true, $ne: null },
    }).toArray();
    if (!recalls.length) return null;
    let totalHours = 0, valid = 0, under6h = 0;
    for (const r of recalls) {
      try {
        const pub = parseISO(r.publish_date + 'T00:00:00');
        const colAt = new Date(r.createdAt);
        const hrs = Math.max(0, differenceInHours(colAt, pub));
        totalHours += hrs; valid++;
        if (hrs <= 6) under6h++;
      } catch (_) {}
    }
    return {
      total: recalls.length,
      avgHrs: valid ? Math.round((totalHours / valid) * 10) / 10 : 0,
      pctUnder6h: valid ? Math.round((under6h / valid) * 100) : 0,
    };
  }

  async generate(type = 'weekly', options = {}) {
    const { from, to } = this._dateRange(type, options.from, options.to);
    const rangeLabel = `${format(from, 'yyyy年MM月dd日', { locale: zhCN })} - ${format(to, 'yyyy年MM月dd日', { locale: zhCN })}`;
    const title = type === 'weekly'
      ? `药品合规数据周报 (${format(from, 'yyyy年第ww周', { locale: zhCN })})`
      : type === 'monthly'
        ? `药品合规数据月报 (${format(from, 'yyyy年MM月', { locale: zhCN })})`
        : `药品合规数据报告 (${rangeLabel})`;

    const eventStats = await this._fetchEventStats(from, to);
    const taskStats = await this._fetchTaskStats(from, to);
    const recallResponse = type === 'monthly' ? await this._analyzeRecallResponse(from, to) : null;

    const html = await ejs.render(TEMPLATE_WEEKLY, {
      title, rangeLabel, generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      ...eventStats, taskStats, recallResponse,
      disclaimer: '本报告所有数据均采集自公开政务平台，如与官方原文有出入请以官方为准。',
    });

    const filename = `${type}_${format(from, 'yyyyMMdd')}_${format(to, 'yyyyMMdd')}_${Date.now()}.html`;
    const filePath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(filePath, html, 'utf-8');
    logger.info(`${title} 已生成: ${filePath}`);

    const reportDoc = await repository.saveReport({
      type, title, from, to,
      filePath, filename,
      platformBreakdown: eventStats.platformBreakdown,
      summary: eventStats.stats,
      criticalEvents: eventStats.criticalEvents.length,
      recallResponse,
    });

    return { ...reportDoc, filePath, html: options.includeHtml ? html : undefined };
  }

  async generateWeekly(options) { return this.generate('weekly', options); }
  async generateMonthly(options) { return this.generate('monthly', options); }

  listReports(limit = 20) {
    return repository.collection(repository.COLLECTIONS.REPORTS)
      .find({}, { sort: { createdAt: -1 }, limit }).toArray();
  }
}

module.exports = ReportGenerator;
