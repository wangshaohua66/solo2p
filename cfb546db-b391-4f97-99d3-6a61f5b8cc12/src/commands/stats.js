const path = require('path');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const { Table } = require('console-table-printer');
const dayjs = require('dayjs');
const { writeToPath: writeCsv } = require('fast-csv');
const { getDB } = require('../lib/db');
const { getLogger } = require('../lib/logger');
const { formatAmount, formatAmountCN, sanitizeFileName } = require('../utils/format');
const { getPlatformName } = require('./aggregate');
const { PerformanceTimer, PERFORMANCE_LIMITS, logMemorySnapshot } = require('../lib/monitor');

function resolvePeriod(options) {
  const today = dayjs();
  if (options.period === 'month') {
    return {
      start: options.month ? dayjs(options.month).startOf('month').format('YYYY-MM-DD')
                           : today.startOf('month').format('YYYY-MM-DD'),
      end: options.month ? dayjs(options.month).endOf('month').format('YYYY-MM-DD')
                         : today.endOf('month').format('YYYY-MM-DD'),
      label: options.month ? dayjs(options.month).format('YYYY年MM月')
                            : today.format('YYYY年MM月'),
      type: '月度'
    };
  }
  if (options.period === 'quarter') {
    const base = options.month ? dayjs(options.month) : today;
    const q = Math.floor((base.month()) / 3);
    return {
      start: base.startOf('year').add(q * 3, 'month').format('YYYY-MM-DD'),
      end: base.startOf('year').add(q * 3 + 3, 'month').subtract(1, 'day').format('YYYY-MM-DD'),
      label: `${base.year()}年第${q + 1}季度`,
      type: '季度'
    };
  }
  if (options.period === 'year') {
    const y = options.month ? dayjs(options.month).year() : today.year();
    return {
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      label: `${y}年度`,
      type: '年度'
    };
  }
  return null;
}

function renderAsciiBarChart(data, title, valueLabel = '金额') {
  if (!data || data.length === 0) return '';
  const max = Math.max(...data.map(d => Number(d.value || 0)), 1);
  const barWidth = 30;
  let output = chalk.cyan.bold(`\n📊 ${title}\n`);
  output += '─'.repeat(70) + '\n';
  for (const d of data) {
    const ratio = Number(d.value || 0) / max;
    const filled = Math.round(ratio * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const pct = (ratio * 100).toFixed(1);
    const label = (d.label || '').padEnd(14).substring(0, 14);
    output += `${label} │ ${chalk.green(bar)} ${formatAmount(d.value)}${d.unit || ''} (${pct}%)\n`;
  }
  output += '─'.repeat(70) + '\n';
  return output;
}

function renderDualBarChart(inputData, outputData, title) {
  if (!inputData || inputData.length === 0) return '';
  const max = Math.max(
    ...inputData.map(d => Number(d.value || 0)),
    ...outputData.map(d => Number(d.value || 0)),
    1
  );
  const barWidth = 20;
  let output = chalk.cyan.bold(`\n📊 ${title}  (红色=销项 | 蓝色=进项)\n`);
  output += '─'.repeat(70) + '\n';
  for (let i = 0; i < inputData.length; i++) {
    const inp = inputData[i] || { label: '', value: 0 };
    const outp = outputData[i] || { label: '', value: 0 };
    const inBar = '█'.repeat(Math.round(Number(inp.value || 0) / max * barWidth));
    const outBar = '█'.repeat(Math.round(Number(outp.value || 0) / max * barWidth));
    const label = (inp.label || outp.label || '').padEnd(12).substring(0, 12);
    output += `${label} 销项:${chalk.red(outBar.padEnd(barWidth))} ${formatAmount(outp.value)}\n`;
    output += `${' '.repeat(12)} 进项:${chalk.blue(inBar.padEnd(barWidth))} ${formatAmount(inp.value)}\n`;
  }
  output += '─'.repeat(70) + '\n';
  return output;
}

async function stats(options = {}) {
  const logger = getLogger();
  logger.section('发票统计报表');
  const db = getDB();
  const timer = new PerformanceTimer('统计报表(STATS)', PERFORMANCE_LIMITS.STATS, logger);
  timer.startMemoryWatch();

  const period = resolvePeriod(options) || {
    start: options.startDate || dayjs().startOf('month').format('YYYY-MM-DD'),
    end: options.endDate || dayjs().endOf('month').format('YYYY-MM-DD'),
    label: '自定义区间',
    type: '自定义'
  };

  const spinner = ora(`生成${period.type}报表: ${period.label}...`).start();
  const summary = db.getSummary(period.start, period.end);
  const rawStats = db.getInvoiceStats(period.start, period.end);
  const topMerchants = db.getTopMerchants(period.start, period.end, options.topN || 10);
  timer.checkPerformance();

  const totalCount = summary.input.count + summary.output.count;
  const totalAmount = summary.input.amount + summary.output.amount;
  const totalTax = summary.input.tax + summary.output.tax;
  const totalValue = summary.input.total + summary.output.total;

  const platformData = new Map();
  const rateData = new Map();
  for (const s of rawStats) {
    if (!platformData.has(s.platform)) platformData.set(s.platform, { count: 0, amount: 0, tax: 0 });
    const p = platformData.get(s.platform);
    p.count += s.count;
    p.amount += s.total_amount || 0;
    p.tax += s.total_tax || 0;
  }

  const metrics = timer.stop(false);
  spinner.succeed(`报表生成完成 (${metrics.elapsedMs}ms)`);
  logger.success('统计报表生成完成', { operation: 'STATS', count: totalCount, durationMs: metrics.elapsedMs });

  console.log(chalk.cyan.bold(`\n════════════════════════════════════════════════════════════════════`));
  console.log(chalk.cyan.bold(`  发票${period.type}汇总报告 · ${period.label}`));
  console.log(chalk.cyan(`  统计范围: ${period.start} 至 ${period.end}`));
  console.log(chalk.cyan(`  生成时间: ${new Date().toLocaleString()}`));
  console.log(chalk.cyan.bold(`════════════════════════════════════════════════════════════════════`));

  const ov = new Table({
    title: chalk.bold('📈 总体概览'),
    columns: [
      { name: '指标', alignment: 'left' },
      { name: '合计', alignment: 'right' },
      { name: '进项', alignment: 'right' },
      { name: '销项', alignment: 'right' }
    ]
  });
  ov.addRow({ '指标': '发票数量(张)', '合计': totalCount, '进项': summary.input.count, '销项': summary.output.count });
  ov.addRow({ '指标': '不含税金额(元)', '合计': formatAmount(totalAmount), '进项': formatAmount(summary.input.amount), '销项': formatAmount(summary.output.amount) });
  ov.addRow({ '指标': '税额(元)', '合计': formatAmount(totalTax), '进项': formatAmount(summary.input.tax), '销项': formatAmount(summary.output.tax) });
  ov.addRow({ '指标': '价税合计(元)', '合计': formatAmount(totalValue), '进项': formatAmount(summary.input.total), '销项': formatAmount(summary.output.total) });
  ov.printTable();

  const platformChartData = Array.from(platformData.entries()).map(([p, v]) => ({
    label: getPlatformName(p),
    value: v.amount,
    unit: '元'
  })).sort((a, b) => b.value - a.value);
  process.stdout.write(renderAsciiBarChart(platformChartData, '各平台发票金额分布'));

  const months = [];
  const inputMonthly = [];
  const outputMonthly = [];
  const curStart = dayjs(period.start);
  const curEnd = dayjs(period.end);
  let m = curStart.clone();
  while (m.isBefore(curEnd) || m.isSame(curEnd, 'month')) {
    const ms = m.startOf('month').format('YYYY-MM-DD');
    const me = m.endOf('month').format('YYYY-MM-DD');
    const s = db.getSummary(ms, me);
    const lbl = m.format('YYYY-MM');
    months.push(lbl);
    inputMonthly.push({ label: lbl, value: s.input.tax });
    outputMonthly.push({ label: lbl, value: s.output.tax });
    m = m.add(1, 'month');
  }
  if (months.length >= 2) {
    process.stdout.write(renderDualBarChart(inputMonthly, outputMonthly, '按月进销项税额对比(元)'));
  }

  const pfDetail = new Table({
    title: chalk.bold('🏢 各平台发票明细'),
    columns: [
      { name: '平台', alignment: 'left' },
      { name: '张数', alignment: 'right' },
      { name: '占比', alignment: 'right' },
      { name: '不含税金额', alignment: 'right' },
      { name: '税额', alignment: 'right' },
      { name: '价税合计', alignment: 'right' }
    ]
  });
  const sumCount = Math.max(totalCount, 1);
  const sorted = Array.from(platformData.entries()).sort((a, b) => b[1].count - a[1].count);
  for (const [p, v] of sorted) {
    pfDetail.addRow({
      '平台': getPlatformName(p),
      '张数': v.count,
      '占比': (v.count / sumCount * 100).toFixed(1) + '%',
      '不含税金额': formatAmount(v.amount),
      '税额': formatAmount(v.tax),
      '价税合计': formatAmount(v.amount + v.tax)
    });
  }
  pfDetail.printTable();

  if (topMerchants && topMerchants.length > 0) {
    const mt = new Table({
      title: chalk.bold(`🏆 TOP ${topMerchants.length} 商户发票排行榜 (按价税合计)`),
      columns: [
        { name: '排名', alignment: 'right', color: 'yellow' },
        { name: '商户名称', alignment: 'left' },
        { name: '张数', alignment: 'right' },
        { name: '不含税金额', alignment: 'right' },
        { name: '税额', alignment: 'right' },
        { name: '价税合计', alignment: 'right' }
      ]
    });
    topMerchants.forEach((m, i) => {
      mt.addRow({
        '排名': i + 1,
        '商户名称': (m.merchant_name || '(未知)').substring(0, 20),
        '张数': m.invoice_count,
        '不含税金额': formatAmount(m.total_amount),
        '税额': formatAmount(m.total_tax),
        '价税合计': formatAmount(m.total_sum)
      }, { color: i < 3 ? 'green' : 'white' });
    });
    mt.printTable();
  }

  if (options.export !== false) {
    const outputDir = options.outputDir || path.resolve(process.cwd(), 'data', 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const exportPath = path.join(outputDir, sanitizeFileName(`发票${period.type}报表_${period.label.replace(/[年月季度度]/g, '')}.csv`));
    const rows = [
      [`发票${period.type}汇总报告`, period.label],
      ['统计范围', `${period.start} 至 ${period.end}`],
      ['生成时间', new Date().toLocaleString()],
      [],
      ['一、总体指标'],
      ['指标', '合计', '进项', '销项'],
      ['发票数量(张)', totalCount, summary.input.count, summary.output.count],
      ['不含税金额(元)', totalAmount.toFixed(2), summary.input.amount.toFixed(2), summary.output.amount.toFixed(2)],
      ['税额(元)', totalTax.toFixed(2), summary.input.tax.toFixed(2), summary.output.tax.toFixed(2)],
      ['价税合计(元)', totalValue.toFixed(2), summary.input.total.toFixed(2), summary.output.total.toFixed(2)],
      [],
      ['二、平台分布'],
      ['平台', '张数', '占比', '不含税金额', '税额', '价税合计']
    ];
    for (const [p, v] of sorted) {
      rows.push([getPlatformName(p), v.count, (v.count / sumCount * 100).toFixed(2) + '%',
        v.amount.toFixed(2), v.tax.toFixed(2), (v.amount + v.tax).toFixed(2)]);
    }
    if (topMerchants && topMerchants.length > 0) {
      rows.push([], [`三、TOP ${topMerchants.length} 商户排行榜`]);
      rows.push(['排名', '商户名称', '张数', '不含税金额', '税额', '价税合计']);
      topMerchants.forEach((m, i) => {
        rows.push([i + 1, m.merchant_name || '(未知)', m.invoice_count,
          (m.total_amount || 0).toFixed(2), (m.total_tax || 0).toFixed(2), (m.total_sum || 0).toFixed(2)]);
      });
    }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(exportPath, 'utf8');
      ws.write('\uFEFF');
      for (const row of rows) {
        ws.write(row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\r\n');
      }
      ws.end();
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    logger.success(`📁 已导出报表CSV: ${chalk.green(exportPath)}`);
  }

  return {
    success: true,
    period,
    summary,
    totalCount,
    totalAmount,
    totalTax,
    totalValue,
    platformStats: Object.fromEntries(platformData),
    topMerchants,
    durationMs: metrics.elapsedMs,
    peakMemoryMB: (metrics.peakMemoryBytes / 1024 / 1024).toFixed(2)
  };
}

module.exports = { stats, resolvePeriod, renderAsciiBarChart };
