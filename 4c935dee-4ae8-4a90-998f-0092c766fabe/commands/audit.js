'use strict';

const fs = require('fs');
const path = require('path');
const { buildContext } = require('../lib/runtime');
const { renderTable, makeSpinner } = require('../lib/ui');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateRange(argv) {
  const now = new Date();
  const to = argv.to ? new Date(argv.to) : now;
  const from = argv.from ? new Date(argv.from) : new Date(now.getTime() - 30 * DAY_MS);
  return { from, to };
}

async function queryLog(argv) {
  const ctx = buildContext(argv);
  const { logger } = ctx;
  const { from, to } = parseDateRange(argv);
  const records = ctx.store.queryAudit({
    from: from.toISOString(),
    to: to.toISOString(),
    action: argv.action,
    secret: argv.secret,
    status: argv.status,
    profile: argv.profile,
    limit: argv.limit
  });

  if (argv.json || argv.format === 'json') {
    process.stdout.write(JSON.stringify({ from: from.toISOString(), to: to.toISOString(), count: records.length, records }, null, 2) + '\n');
    return records;
  }

  logger.info(`审计日志: ${records.length} 条 (${from.toISOString().slice(0, 10)} ~ ${to.toISOString().slice(0, 10)})`);
  if (!records.length) {
    logger.warn('未找到匹配的审计记录');
    return records;
  }
  const headers = ['时间', '动作', '密钥', '来源', '状态', '说明'];
  const rows = records.map((r) => [
    r.timestamp.slice(0, 19).replace('T', ' '),
    r.action,
    r.secretName || r.secretPath,
    r.source,
    r.status,
    (r.message || '').slice(0, 50)
  ]);
  logger.raw(renderTable(headers, rows));
  return records;
}

function buildReport(ctx, from, to) {
  const records = ctx.store.queryAudit({ from: from.toISOString(), to: to.toISOString(), profile: ctx.profile.name });
  const byAction = {};
  const byStatus = { success: 0, failed: 0 };
  const rotations = [];
  const accesses = [];
  for (const r of records) {
    byAction[r.action] = (byAction[r.action] || 0) + 1;
    if (byStatus[r.status] !== undefined) byStatus[r.status] += 1;
    if (r.action === 'rotate') rotations.push(r);
    if (r.action === 'access' || r.action === 'scan' || r.action === 'sync-import') accesses.push(r);
  }

  const secrets = ctx.store.getSecrets(ctx.profile.name);
  const staleThreshold = new Date(Date.now() - (ctx.profile.rotation && ctx.profile.rotation.maxAgeDays || 90) * DAY_MS);
  const staleSecrets = secrets.filter((s) => {
    if (!s.lastRotatedAt) return true;
    return new Date(s.lastRotatedAt) < staleThreshold;
  }).map((s) => ({
    name: s.name,
    path: s.path,
    source: s.source,
    lastRotatedAt: s.lastRotatedAt || 'never',
    ageDays: s.lastRotatedAt ? Math.floor((Date.now() - new Date(s.lastRotatedAt).getTime()) / DAY_MS) : null
  })).sort((a, b) => (b.ageDays || 1e9) - (a.ageDays || 1e9));

  const uniqueRotated = new Set(rotations.filter((r) => r.status === 'success').map((r) => r.secretPath)).size;
  const rotationFrequency = secrets.length ? (rotations.length / secrets.length) : 0;
  const certAlerts = records.filter((r) => r.action === 'cert-alert');
  const timelyHandled = certAlerts.filter((r) => r.metadata && r.metadata.handled).length;
  const timelinessRate = certAlerts.length ? (timelyHandled / certAlerts.length) : null;

  return {
    profile: ctx.profile.name,
    generatedAt: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalEvents: records.length,
      accessCount: accesses.length,
      rotationEvents: rotations.length,
      uniqueSecretsRotated: uniqueRotated,
      rotationFrequency: Number(rotationFrequency.toFixed(2)),
      successCount: byStatus.success,
      failedCount: byStatus.failed,
      certAlertCount: certAlerts.length,
      timelinessRate: timelinessRate === null ? null : Number(timelinessRate.toFixed(2)),
      trackedSecrets: secrets.length,
      staleSecrets: staleSecrets.length
    },
    byAction,
    staleSecrets,
    recentRotations: rotations.slice(0, 50).map((r) => ({
      timestamp: r.timestamp, secret: r.secretName, beforeHash: r.beforeHash, afterHash: r.afterHash, status: r.status
    }))
  };
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderHtml(report) {
  const rows = (report.recentRotations || []).map((r) =>
    `<tr><td>${escapeHtml(r.timestamp.slice(0, 19))}</td><td>${escapeHtml(r.secret)}</td><td>${escapeHtml(r.status)}</td><td><code>${escapeHtml((r.beforeHash || '').slice(0, 12))}</code> → <code>${escapeHtml((r.afterHash || '').slice(0, 12))}</code></td></tr>`
  ).join('\n');
  const staleRows = (report.staleSecrets || []).map((s) =>
    `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.path)}</td><td>${escapeHtml(s.lastRotatedAt)}</td><td>${s.ageDays == null ? '从未轮换' : s.ageDays + ' 天'}</td></tr>`
  ).join('\n');
  const s = report.summary;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>密钥合规审计报告 - ${escapeHtml(report.profile)}</title>
<style>
  body { font-family: -apple-system, "PingFang SC", sans-serif; margin: 32px; color: #222; }
  h1 { color: #1a3b5c; border-bottom: 2px solid #1a3b5c; padding-bottom: 8px; }
  .meta { color: #666; margin-bottom: 24px; }
  .cards { display: flex; flex-wrap: wrap; gap: 16px; margin: 24px 0; }
  .card { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 16px 24px; min-width: 140px; }
  .card .num { font-size: 28px; font-weight: 700; color: #1a3b5c; }
  .card .lbl { color: #666; font-size: 13px; }
  .danger { color: #cf222e; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0 32px; }
  th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
  th { background: #1a3b5c; color: #fff; }
  tr:nth-child(even) { background: #f6f8fa; }
  code { background: #eee; padding: 2px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>密钥合规审计报告</h1>
<div class="meta">环境: <b>${escapeHtml(report.profile)}</b> &nbsp;|&nbsp; 范围: ${escapeHtml(report.range.from.slice(0, 10))} ~ ${escapeHtml(report.range.to.slice(0, 10))} &nbsp;|&nbsp; 生成时间: ${escapeHtml(report.generatedAt)}</div>
<div class="cards">
  <div class="card"><div class="num">${s.totalEvents}</div><div class="lbl">审计事件总数</div></div>
  <div class="card"><div class="num">${s.accessCount}</div><div class="lbl">密钥访问次数</div></div>
  <div class="card"><div class="num">${s.rotationEvents}</div><div class="lbl">轮换事件</div></div>
  <div class="card"><div class="num">${s.uniqueSecretsRotated}</div><div class="lbl">已轮换密钥数</div></div>
  <div class="card"><div class="num">${s.trackedSecrets}</div><div class="lbl">跟踪密钥总数</div></div>
  <div class="card ${s.staleSecrets ? 'danger' : ''}"><div class="num ${s.staleSecrets ? 'danger' : ''}">${s.staleSecrets}</div><div class="lbl">超 90 天未轮换</div></div>
</div>
<h2>超过 90 天未轮换的密钥</h2>
<table>
<tr><th>名称</th><th>路径</th><th>上次轮换</th><th>距今</th></tr>
${staleRows || '<tr><td colspan="4">无</td></tr>'}
</table>
<h2>近期轮换记录 (SHA256 哈希审计)</h2>
<table>
<tr><th>时间</th><th>密钥</th><th>状态</th><th>哈希变化</th></tr>
${rows || '<tr><td colspan="4">无</td></tr>'}
</table>
</body>
</html>`;
}

async function report(argv) {
  const ctx = buildContext(argv);
  const { logger } = ctx;
  const { from, to } = parseDateRange(argv);
  const spinner = makeSpinner({ ...argv, text: '生成合规审计报告' });
  spinner.start();
  const reportData = buildReport(ctx, from, to);
  spinner.succeed('合规审计报告生成完成');

  if (argv.format === 'html' || argv.out) {
    const html = renderHtml(reportData);
    const outFile = argv.out || `audit-report-${ctx.profile.name}-${Date.now()}.html`;
    const tmp = `${outFile}.tmp`;
    fs.writeFileSync(tmp, html);
    fs.renameSync(tmp, outFile);
    logger.success(`HTML 报告已写入: ${outFile}`);
  }

  if (argv.json || argv.format === 'json') {
    process.stdout.write(JSON.stringify(reportData, null, 2) + '\n');
    return reportData;
  }

  const s = reportData.summary;
  logger.info(`审计报告 [${ctx.profile.name}] ${reportData.range.from.slice(0, 10)} ~ ${reportData.range.to.slice(0, 10)}`);
  logger.raw(`事件总数: ${s.totalEvents} | 访问: ${s.accessCount} | 轮换: ${s.rotationEvents} (唯一 ${s.uniqueSecretsRotated}) | 失败: ${s.failedCount}`);
  logger.raw(`跟踪密钥: ${s.trackedSecrets} | 超90天未轮换: ${s.staleSecrets} | 轮换频率: ${s.rotationFrequency}`);
  if (s.timelinessRate !== null) logger.raw(`过期预警处理及时率: ${(s.timelinessRate * 100).toFixed(0)}%`);

  if (reportData.staleSecrets.length) {
    logger.warn(`超期未轮换密钥 (${reportData.staleSecrets.length}):`);
    const headers = ['名称', '路径', '上次轮换', '距今'];
    const rows = reportData.staleSecrets.map((x) => [x.name, x.path, x.lastRotatedAt, x.ageDays == null ? '从未' : `${x.ageDays}天`]);
    logger.raw(renderTable(headers, rows));
  } else {
    logger.success('没有超过 90 天未轮换的密钥');
  }
  return reportData;
}

async function run(argv) {
  const mode = argv.mode || 'log';
  if (mode === 'log') return queryLog(argv);
  if (mode === 'report') return report(argv);
  throw new Error(`未知 audit 模式: ${mode}`);
}

module.exports = {
  command: 'audit',
  describe: '合规审计：查询审计日志 / 生成 JSON 与 HTML 审计报告',
  builder: (yargs) => yargs
    .option('mode', { type: 'string', choices: ['log', 'report'], default: 'log', describe: '审计模式' })
    .option('from', { type: 'string', describe: '起始时间 (ISO 或 YYYY-MM-DD)' })
    .option('to', { type: 'string', describe: '结束时间' })
    .option('action', { type: 'string', describe: '按动作筛选 (rotate/sync-import/...)' })
    .option('secret', { type: 'string', describe: '按密钥路径筛选' })
    .option('status', { type: 'string', choices: ['success', 'failed'], describe: '按状态筛选' })
    .option('limit', { type: 'number', default: 200, describe: '日志模式返回上限' })
    .option('format', { type: 'string', choices: ['table', 'json', 'html'], describe: '输出格式' })
    .option('out', { type: 'string', describe: '报告输出文件 (HTML)' }),
  handler: async (argv) => {
    try {
      return await run(argv);
    } catch (err) {
      const logger = require('../lib/logger').createLogger({ quiet: argv.quiet, json: argv.json });
      logger.error(`${err.message}${err.hint ? '\n排查建议: ' + err.hint : ''}`);
      process.exit(1);
    }
  }
};
