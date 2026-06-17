'use strict';

const chalk = require('chalk');
const Table = require('cli-table3');
const { Command } = require('commander');

const { loadConfig } = require('../lib/config');
const {
  validateSampleId,
  validateDate,
  validateDateRange,
  validateStatus,
  validateStatusTransition,
  parseDate,
  formatDate,
  ValidationError
} = require('../lib/validator');
const {
  padEndVisual,
  centerVisual,
  truncateVisual,
  formatDateTimeLocal,
  displayDateTime
} = require('../lib/utils');
const {
  getSampleById,
  updateSample,
  querySamples,
  countSamples
} = require('../lib/store');

function colorizeStatus(status, config) {
  const flow = config.statusFlow[status];
  if (!flow) return status;
  const name = flow.name;
  switch (flow.color) {
    case 'yellow': return chalk.yellow(name);
    case 'cyan': return chalk.cyan(name);
    case 'blue': return chalk.blue(name);
    case 'green': return chalk.green(name);
    case 'red': return chalk.red.bold(name);
    default: return name;
  }
}

function printSampleProgress(sample, config, detailed = false) {
  const cat = config.categories[sample.category];
  const flow = config.statusFlow[sample.status];
  const statusName = colorizeStatus(sample.status, config);
  const completedProjects = Object.keys(sample.testResults || {}).length;
  const totalProjects = sample.projects.length;
  const progress = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;
  const progressBarWidth = 20;
  const filled = Math.round(progressBarWidth * progress / 100);
  const bar = '█'.repeat(filled) + '░'.repeat(progressBarWidth - filled);
  const barColor = progress === 100 ? chalk.green : chalk.cyan;
  const exceptionTag = sample.isException ? ' ' + chalk.red.bold('[异常]') : '';
  const W = 50;
  const border = (l, r) => chalk.cyan.bold(l) + '─'.repeat(W) + chalk.cyan.bold(r);
  const line = (content) => chalk.cyan.bold('│') + padEndVisual(content, W) + chalk.cyan.bold('│');
  const kv = (label, value) => line(` ${chalk.yellow(label)}: ${value}`);
  console.log('\n' + border('┌', '┐'));
  console.log(line(centerVisual(chalk.white.bold('样品检测进度'), W)));
  console.log(border('├', '┤'));
  console.log(kv('编号', chalk.bold(sample.id) + exceptionTag));
  console.log(kv('名称', sample.name));
  console.log(kv('类别', cat.name));
  console.log(kv('状态', statusName));
  console.log(kv('进度', `${barColor(bar)} ${progress}%`));
  console.log(kv('项目', `${completedProjects}/${totalProjects} 已完成`));
  console.log(kv('采样员', sample.sampler));
  console.log(kv('登记时间', displayDateTime(sample.registeredAt)));
  if (sample.isException && sample.exceptionReason) {
    console.log(kv(chalk.red('异常原因'), sample.exceptionReason));
  }
  console.log(border('└', '┘'));
  if (detailed && sample.statusHistory && sample.statusHistory.length > 0) {
    console.log(chalk.cyan('\n状态流转历史:'));
    for (const h of sample.statusHistory) {
      const t = displayDateTime(h.time);
      const s = colorizeStatus(h.status, config);
      console.log(`  ${chalk.gray(t)}  ${s}  (${h.operator})`);
    }
  }
  if (detailed && sample.testResults) {
    console.log(chalk.cyan('\n已检测项目:'));
    for (const [project, results] of Object.entries(sample.testResults)) {
      const last = results[results.length - 1];
      const val = last.mean !== undefined ? last.mean : last.value;
      const judge = last.judged;
      let judgeTag = '';
      if (judge === true) judgeTag = ' ' + chalk.green('[合格]');
      else if (judge === false) judgeTag = ' ' + chalk.red('[不合格]');
      console.log(`  ${chalk.yellow(project)}: ${val}${last.unit || ''} (${last.count}次平行)${judgeTag}`);
    }
  }
}

function printSampleList(samples, config) {
  if (samples.length === 0) {
    console.log(chalk.yellow('未找到符合条件的样品'));
    return;
  }
  const table = new Table({
    head: [
      chalk.cyan('编号'),
      chalk.cyan('名称'),
      chalk.cyan('类别'),
      chalk.cyan('状态'),
      chalk.cyan('进度'),
      chalk.cyan('采样来源'),
      chalk.cyan('采样员'),
      chalk.cyan('异常')
    ],
    colWidths: [18, 20, 12, 10, 10, 16, 10, 8]
  });
  for (const s of samples) {
    const cat = config.categories[s.category]?.name || s.category;
    const completed = Object.keys(s.testResults || {}).length;
    const total = s.projects.length;
    const pct = total > 0 ? `${Math.round(completed / total * 100)}%` : '-';
    table.push([
      s.id,
      truncateVisual(s.name, 18),
      cat,
      colorizeStatus(s.status, config),
      pct,
      truncateVisual(s.source, 14),
      s.sampler,
      s.isException ? chalk.red('是') : chalk.green('否')
    ]);
  }
  console.log(table.toString());
  console.log(chalk.gray(`\n共 ${samples.length} 条记录`));
}

function transitionStatus(config, sampleId, newStatus, operator, reason) {
  validateSampleId(sampleId, config);
  validateStatus(newStatus, config);
  const sample = getSampleById(config, sampleId);
  if (!sample) {
    throw new Error(`样品不存在: ${sampleId}`);
  }
  validateStatusTransition(sample.status, newStatus, config);
  const historyEntry = {
    status: newStatus,
    time: formatDateTimeLocal(new Date()),
    operator: operator || 'system'
  };
  if (reason) {
    historyEntry.reason = reason;
  }
  const updates = {
    status: newStatus,
    statusHistory: [...(sample.statusHistory || []), historyEntry]
  };
  if (newStatus === 'exception') {
    updates.isException = true;
    if (reason) updates.exceptionReason = reason;
  } else if (sample.isException && newStatus !== 'exception') {
    updates.isException = false;
  }
  const updated = updateSample(config, sampleId, updates);
  const oldName = config.statusFlow[sample.status].name;
  const newName = config.statusFlow[newStatus].name;
  console.log(chalk.green(`✓ 状态流转成功: ${oldName} → ${newName}`));
  if (newStatus === 'exception') {
    console.log(chalk.red.bold('⚠ 样品已标记为异常，请及时处理！'));
  }
  return updated;
}

function markException(config, sampleId, reason, operator) {
  if (!reason || reason.trim() === '') {
    throw new ValidationError('异常原因不能为空', 'exceptionReason', reason);
  }
  return transitionStatus(config, sampleId, 'exception', operator, reason.trim());
}

function showDashboard(config) {
  const all = countSamples(config);
  const pending = countSamples(config, { status: 'pending' });
  const testing = countSamples(config, { status: 'testing' });
  const review = countSamples(config, { status: 'review' });
  const certified = countSamples(config, { status: 'certified' });
  const exceptions = countSamples(config, { hasException: true });
  const W = 50;
  const border = (l, r) => chalk.cyan.bold(l) + '═'.repeat(W) + chalk.cyan.bold(r);
  const line = (content) => chalk.cyan.bold('║') + padEndVisual(content, W) + chalk.cyan.bold('║');
  const row = (label, value, color) => {
    const v = color ? color(String(value)) : String(value);
    return line(`  ${chalk.yellow(label)}: ${v}`);
  };
  console.log('\n' + border('╔', '╗'));
  console.log(line(centerVisual(chalk.white.bold('检测进度总览 Dashboard'), W)));
  console.log(border('╠', '╣'));
  console.log(row('样品总数', all));
  console.log(row('待检', pending, chalk.yellow));
  console.log(row('检测中', testing, chalk.cyan));
  console.log(row('复核中', review, chalk.blue));
  console.log(row('已出证', certified, chalk.green));
  console.log(row('异常样品', exceptions, chalk.red.bold));
  if (all > 0) {
    const rate = ((certified / all) * 100).toFixed(1);
    console.log(row('完成率', `${rate}%`, chalk.green));
  }
  console.log(border('╚', '╝'));
  if (exceptions > 0) {
    console.log(chalk.red.bold(`\n⚠ 存在 ${exceptions} 个异常样品，请及时处理！`));
    const exSamples = querySamples(config, { hasException: true }).slice(0, 5);
    for (const s of exSamples) {
      console.log(chalk.red(`  - ${s.id} ${s.name} (${s.exceptionReason || '未填写原因'})`));
    }
  }
}

function register(program) {
  const cmd = new Command('progress')
    .description('检测进度跟踪与状态流转')
    .alias('pg');

  cmd
    .command('show')
    .description('查看样品检测进度')
    .argument('<sampleId>', '样品编号')
    .option('-d, --detail', '显示详细信息')
    .action((sampleId, options) => {
      const config = loadConfig();
      try {
        validateSampleId(sampleId, config);
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
      const sample = getSampleById(config, sampleId);
      if (!sample) {
        console.log(chalk.red(`✗ 未找到样品: ${sampleId}`));
        process.exit(1);
      }
      printSampleProgress(sample, config, options.detail);
    });

  cmd
    .command('list')
    .description('按条件查询样品列表')
    .option('-s, --status <status>', '按状态筛选')
    .option('-c, --category <category>', '按检测类别筛选')
    .option('-S, --source <source>', '按采样来源模糊查询')
    .option('--start <date>', '起始日期 (YYYY-MM-DD)')
    .option('--end <date>', '结束日期 (YYYY-MM-DD)')
    .option('-e, --exception', '只显示异常样品')
    .option('-l, --limit <n>', '限制显示条数', parseInt)
    .action((options) => {
      const config = loadConfig();
      const filters = {};
      try {
        if (options.status) {
          validateStatus(options.status, config);
          filters.status = options.status;
        }
        if (options.category) {
          filters.category = options.category;
        }
        if (options.source) filters.source = options.source;
        if (options.start || options.end) {
          validateDateRange(options.start, options.end);
          if (options.start) filters.startDate = options.start;
          if (options.end) filters.endDate = options.end;
        }
        if (options.exception) filters.hasException = true;
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
      let samples = querySamples(config, filters);
      if (options.limit && samples.length > options.limit) {
        samples = samples.slice(0, options.limit);
      }
      printSampleList(samples, config);
    });

  cmd
    .command('update')
    .description('更新样品状态 (状态流转)')
    .argument('<sampleId>', '样品编号')
    .argument('<status>', '新状态')
    .option('-o, --operator <name>', '操作人姓名')
    .option('-r, --reason <text>', '状态变更原因')
    .action((sampleId, status, options) => {
      const config = loadConfig();
      try {
        transitionStatus(config, sampleId, status, options.operator, options.reason);
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
    });

  cmd
    .command('exception')
    .description('标记样品为异常')
    .argument('<sampleId>', '样品编号')
    .requiredOption('-r, --reason <text>', '异常原因')
    .option('-o, --operator <name>', '操作人姓名')
    .action((sampleId, options) => {
      const config = loadConfig();
      try {
        markException(config, sampleId, options.reason, options.operator);
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
    });

  cmd
    .command('dashboard')
    .alias('dash')
    .description('显示检测进度总览')
    .action(() => {
      const config = loadConfig();
      showDashboard(config);
    });

  program.addCommand(cmd);
}

module.exports = { register, colorizeStatus, printSampleProgress, printSampleList, showDashboard };
