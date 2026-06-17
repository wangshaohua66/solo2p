'use strict';

const chalk = require('chalk');
const Table = require('cli-table3');
const { Command } = require('commander');

const { loadConfig } = require('../lib/config');
const {
  validateDateRange,
  validateCategory,
  ValidationError
} = require('../lib/validator');
const { padEndVisual, centerVisual, formatDateLocal, parseDateLocal, truncateVisual } = require('../lib/utils');
const { querySamples } = require('../lib/store');

function getDateBuckets(startDate, endDate, granularity) {
  const buckets = [];
  let cur = parseDateLocal(startDate);
  const end = parseDateLocal(endDate);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    let key, label;
    if (granularity === 'month') {
      key = `${y}-${String(m + 1).padStart(2, '0')}`;
      label = `${y}年${m + 1}月`;
    } else if (granularity === 'week') {
      const tmp = new Date(cur);
      const day = tmp.getDay() || 7;
      tmp.setDate(tmp.getDate() - day + 1);
      const ws = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`;
      key = ws;
      label = `周(${ws})`;
    } else {
      key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      label = key;
    }
    if (!buckets.find(b => b.key === key)) {
      buckets.push({ key, label, start: new Date(cur), samples: [] });
    }
    if (granularity === 'month') {
      cur.setMonth(cur.getMonth() + 1);
    } else if (granularity === 'week') {
      cur.setDate(cur.getDate() + 7);
    } else {
      cur.setDate(cur.getDate() + 1);
    }
    if (cur > end && buckets.length === 0) break;
  }
  return buckets;
}

function computeStats(samples, config) {
  const total = samples.length;
  let certified = 0;
  let passed = 0;
  let failed = 0;
  let partial = 0;
  let exception = 0;
  const byCategory = {};
  const bySource = {};
  const byStatus = {};
  const failedProjects = {};
  for (const catKey of Object.keys(config.categories)) {
    byCategory[catKey] = { total: 0, passed: 0, failed: 0, pending: 0 };
  }
  for (const s of samples) {
    if (s.isException) exception++;
    if (!byStatus[s.status]) byStatus[s.status] = 0;
    byStatus[s.status]++;
    if (s.category && byCategory[s.category]) {
      byCategory[s.category].total++;
    }
    if (s.source) {
      if (!bySource[s.source]) bySource[s.source] = { total: 0, passed: 0, failed: 0 };
      bySource[s.source].total++;
    }
    let hasFailed = false;
    let hasPending = false;
    if (s.testResults) {
      for (const project of Object.keys(s.testResults)) {
        const results = s.testResults[project];
        if (results.length > 0) {
          const last = results[results.length - 1];
          if (last.judged === false) {
            hasFailed = true;
            if (!failedProjects[project]) failedProjects[project] = 0;
            failedProjects[project]++;
          }
        }
      }
    }
    for (const project of s.projects) {
      const r = s.testResults?.[project];
      if (!r || r.length === 0) hasPending = true;
    }
    if (s.status === 'certified') {
      certified++;
      if (hasFailed) {
        failed++;
        if (s.category && byCategory[s.category]) byCategory[s.category].failed++;
        if (s.source && bySource[s.source]) bySource[s.source].failed++;
      } else {
        passed++;
        if (s.category && byCategory[s.category]) byCategory[s.category].passed++;
        if (s.source && bySource[s.source]) bySource[s.source].passed++;
      }
    } else {
      if (hasFailed && !hasPending) {
        partial++;
      } else if (!hasPending && !hasFailed) {
        partial++;
      }
    }
    if (s.category && byCategory[s.category] && hasPending) {
      byCategory[s.category].pending++;
    }
  }
  const judged = passed + failed;
  const passRate = judged > 0 ? ((passed / judged) * 100).toFixed(2) : '-';
  return {
    total,
    certified,
    passed,
    failed,
    partial,
    exception,
    judged,
    passRate,
    byCategory,
    bySource,
    byStatus,
    failedProjects
  };
}

function printSummary(stats, config, title) {
  const W = 66;
  const border = (l, r) => chalk.cyan.bold(l) + '═'.repeat(W) + chalk.cyan.bold(r);
  const line = (content) => chalk.cyan.bold('│') + padEndVisual(content, W) + chalk.cyan.bold('│');
  const sep = (l, r) => chalk.cyan.bold(l) + '─'.repeat(W) + chalk.cyan.bold(r);
  const row = (label, value, color) => {
    const v = color ? color(String(value)) : String(value);
    return line(`  ${chalk.yellow(label)}: ${v}`);
  };
  console.log('\n' + border('┌', '┐'));
  console.log(line(centerVisual(chalk.white.bold(title || '统计汇总报告'), W)));
  console.log(border('├', '┤'));
  console.log(row('样品总数', stats.total));
  console.log(row('已出证', stats.certified, chalk.green));
  console.log(row('进行中', stats.total - stats.certified, chalk.cyan));
  console.log(row('异常样品', stats.exception, chalk.red.bold));
  console.log(sep('├', '┤'));
  console.log(row('已判定样品', stats.judged));
  console.log(row('合格', stats.passed, chalk.green));
  console.log(row('不合格', stats.failed, chalk.red));
  console.log(row('合格率', `${stats.passRate}%`, stats.passRate !== '-' && Number(stats.passRate) >= 95 ? chalk.green : Number(stats.passRate) >= 80 ? chalk.yellow : chalk.red));
  console.log(border('└', '┘'));
}

function printByCategory(byCategory, config) {
  const table = new Table({
    head: [chalk.cyan('检测类别'), chalk.cyan('总数'), chalk.cyan('合格'), chalk.cyan('不合格'), chalk.cyan('待检'), chalk.cyan('合格率')],
    colWidths: [18, 10, 10, 12, 10, 12]
  });
  for (const [key, data] of Object.entries(byCategory)) {
    const name = config.categories[key]?.name || key;
    const judged = data.passed + data.failed;
    const rate = judged > 0 ? `${((data.passed / judged) * 100).toFixed(1)}%` : '-';
    const rateColor = judged > 0 && (data.passed / judged) >= 0.95 ? chalk.green : judged > 0 && (data.passed / judged) >= 0.8 ? chalk.yellow : judged > 0 ? chalk.red : chalk.gray;
    table.push([
      name,
      data.total,
      chalk.green(data.passed),
      chalk.red(data.failed),
      chalk.yellow(data.pending),
      rateColor(rate)
    ]);
  }
  console.log(chalk.cyan.bold('\n按检测类别统计:'));
  console.log(table.toString());
}

function printByStatus(byStatus, config) {
  const table = new Table({
    head: [chalk.cyan('状态'), chalk.cyan('数量'), chalk.cyan('占比')],
    colWidths: [20, 12, 40]
  });
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const entries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of entries) {
    const name = config.statusFlow[status]?.name || status;
    const pct = total > 0 ? (count / total) * 100 : 0;
    const filled = Math.round(30 * pct / 100);
    const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
    table.push([name, count, `${bar} ${pct.toFixed(1)}%`]);
  }
  console.log(chalk.cyan.bold('\n按状态分布:'));
  console.log(table.toString());
}

function printFailedProjects(failedProjects, limit) {
  const entries = Object.entries(failedProjects).sort((a, b) => b[1] - a[1]).slice(0, limit || 10);
  if (entries.length === 0) {
    console.log(chalk.green('\n暂无不合格项目记录'));
    return;
  }
  const maxCount = entries[0][1];
  const table = new Table({
    head: [chalk.cyan('排名'), chalk.cyan('检测项目'), chalk.cyan('不合格次数'), chalk.cyan('分布')],
    colWidths: [8, 24, 14, 30]
  });
  entries.forEach(([project, count], idx) => {
    const filled = Math.round(20 * count / maxCount);
    const bar = chalk.red('█'.repeat(filled)) + chalk.gray('░'.repeat(20 - filled));
    table.push([idx + 1, project, chalk.red(count), bar]);
  });
  console.log(chalk.cyan.bold('\n不合格项目TOP榜:'));
  console.log(table.toString());
}

function printBySource(bySource, limit) {
  const entries = Object.entries(bySource)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit || 10);
  if (entries.length === 0) {
    console.log(chalk.yellow('\n暂无采样来源数据'));
    return;
  }
  const table = new Table({
    head: [chalk.cyan('排名'), chalk.cyan('采样来源'), chalk.cyan('样品数'), chalk.cyan('合格'), chalk.cyan('不合格'), chalk.cyan('合格率')],
    colWidths: [8, 24, 10, 10, 12, 12]
  });
  entries.forEach(([source, data], idx) => {
    const judged = data.passed + data.failed;
    const rate = judged > 0 ? `${((data.passed / judged) * 100).toFixed(1)}%` : '-';
    table.push([
      idx + 1,
      truncateVisual(source, 22),
      data.total,
      chalk.green(data.passed),
      chalk.red(data.failed),
      rate
    ]);
  });
  console.log(chalk.cyan.bold('\n按采样来源统计 (TOP10):'));
  console.log(table.toString());
}

function printTrend(samples, config, startDate, endDate, granularity) {
  const buckets = getDateBuckets(startDate, endDate, granularity);
  const sampleDateStr = s => (s.registeredAt || '').slice(0, 10);
  const bucketMap = {};
  for (const b of buckets) bucketMap[b.key] = b;
  for (const s of samples) {
    const ds = sampleDateStr(s);
    let matchedKey = null;
    if (granularity === 'day') matchedKey = ds;
    else if (granularity === 'month') matchedKey = ds.slice(0, 7);
    else if (granularity === 'week') {
      const d = parseDateLocal(ds);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      matchedKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (bucketMap[matchedKey]) {
      bucketMap[matchedKey].samples.push(s);
    }
  }
  if (buckets.length === 0) {
    console.log(chalk.yellow('时间范围内无数据'));
    return;
  }
  const table = new Table({
    head: [
      chalk.cyan(granularity === 'day' ? '日期' : granularity === 'month' ? '月份' : '周'),
      chalk.cyan('样品数'),
      chalk.cyan('已出证'),
      chalk.cyan('合格'),
      chalk.cyan('不合格'),
      chalk.cyan('合格率'),
      chalk.cyan('趋势')
    ],
    colWidths: [14, 10, 10, 10, 12, 12, 18]
  });
  let maxCount = 1;
  for (const b of buckets) {
    if (b.samples.length > maxCount) maxCount = b.samples.length;
  }
  for (const b of buckets) {
    const bs = computeStats(b.samples, config);
    const filled = Math.round(10 * b.samples.length / maxCount);
    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(10 - filled));
    table.push([
      b.label,
      b.samples.length,
      bs.certified,
      chalk.green(bs.passed),
      chalk.red(bs.failed),
      bs.passRate + '%',
      bar
    ]);
  }
  console.log(chalk.cyan.bold(`\n时间趋势分析 (按${granularity === 'day' ? '日' : granularity === 'month' ? '月' : '周'}):`));
  console.log(table.toString());
}

function register(program) {
  const cmd = new Command('stats')
    .description('统计汇总与趋势分析')
    .alias('st');

  cmd
    .command('summary')
    .alias('sum')
    .description('综合统计汇总')
    .option('--start <date>', '起始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .option('-c, --category <category>', '按检测类别筛选')
    .option('-S, --source <source>', '按采样来源筛选')
    .option('--top <n>', 'TOP榜数量', parseInt, 10)
    .action((options) => {
      const config = loadConfig();
      const filters = {};
      try {
        if (options.start || options.end) {
          validateDateRange(options.start, options.end);
          if (options.start) filters.startDate = options.start;
          if (options.end) filters.endDate = options.end;
        }
        if (options.category) {
          validateCategory(options.category, config);
          filters.category = options.category;
        }
        if (options.source) filters.source = options.source;
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
      const samples = querySamples(config, filters);
      const stats = computeStats(samples, config);
      let title = '统计汇总报告';
      if (options.start || options.end) {
        title += ` (${options.start || '...'} ~ ${options.end || '...'})`;
      }
      printSummary(stats, config, title);
      printByCategory(stats.byCategory, config);
      printByStatus(stats.byStatus, config);
      printFailedProjects(stats.failedProjects, options.top);
      printBySource(stats.bySource, options.top);
    });

  cmd
    .command('trend')
    .description('时间趋势分析')
    .option('--start <date>', '起始日期 (YYYY-MM-DD，默认近30天)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD，默认今天)')
    .option('-g, --granularity <g>', '粒度: day|week|month', 'day')
    .option('-c, --category <category>', '按检测类别筛选')
    .action((options) => {
      const config = loadConfig();
      if (!options.start) {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        options.start = formatDateLocal(d);
      }
      if (!options.end) {
        options.end = formatDateLocal(new Date());
      }
      try {
        validateDateRange(options.start, options.end);
        if (!['day', 'week', 'month'].includes(options.granularity)) {
          throw new ValidationError('粒度必须是 day, week 或 month', 'granularity', options.granularity);
        }
        if (options.category) validateCategory(options.category, config);
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
      const filters = { startDate: options.start, endDate: options.end };
      if (options.category) filters.category = options.category;
      const samples = querySamples(config, filters);
      printTrend(samples, config, options.start, options.end, options.granularity);
    });

  cmd
    .command('category')
    .description('按检测类别统计')
    .option('--start <date>', '起始日期')
    .option('--end <date>', '结束日期')
    .action((options) => {
      const config = loadConfig();
      const filters = {};
      if (options.start || options.end) {
        try {
          validateDateRange(options.start, options.end);
          if (options.start) filters.startDate = options.start;
          if (options.end) filters.endDate = options.end;
        } catch (e) {
          console.error(chalk.red(e.message));
          process.exit(1);
        }
      }
      const samples = querySamples(config, filters);
      const stats = computeStats(samples, config);
      printByCategory(stats.byCategory, config);
    });

  cmd
    .command('failed')
    .description('不合格项分布分析')
    .option('--start <date>', '起始日期')
    .option('--end <date>', '结束日期')
    .option('-t, --top <n>', '显示前N项', parseInt, 15)
    .action((options) => {
      const config = loadConfig();
      const filters = {};
      if (options.start || options.end) {
        try {
          validateDateRange(options.start, options.end);
          if (options.start) filters.startDate = options.start;
          if (options.end) filters.endDate = options.end;
        } catch (e) {
          console.error(chalk.red(e.message));
          process.exit(1);
        }
      }
      const samples = querySamples(config, filters);
      const stats = computeStats(samples, config);
      printFailedProjects(stats.failedProjects, options.top);
    });

  program.addCommand(cmd);
}

module.exports = { register, computeStats, printSummary, printByCategory, printFailedProjects, printTrend };
