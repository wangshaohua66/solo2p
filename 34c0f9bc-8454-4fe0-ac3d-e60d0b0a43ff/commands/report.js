'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Command } = require('commander');

const { loadConfig, getThreshold, getActiveThresholds } = require('../lib/config');
const {
  validateSampleId,
  validateTestValue,
  validateProject,
  validateStatus,
  judgeResult,
  calculateParallelStats,
  ValidationError
} = require('../lib/validator');
const {
  getSampleById,
  updateSample
} = require('../lib/store');

function inputTestResult(config, sampleId, projectName, values, operator, remark) {
  validateSampleId(sampleId, config);
  validateProject(projectName, config);
  const sample = getSampleById(config, sampleId);
  if (!sample) {
    throw new Error(`样品不存在: ${sampleId}`);
  }
  if (!sample.projects.includes(projectName)) {
    throw new ValidationError(
      `样品 [${sampleId}] 未配置检测项目 [${projectName}]，已配置项目: ${sample.projects.join('、')}`,
      'projectName',
      projectName
    );
  }
  const valueArray = Array.isArray(values) ? values : [values];
  for (const v of valueArray) {
    validateTestValue(v, projectName, config);
  }
  const stats = calculateParallelStats(valueArray);
  if (stats.count >= 2 && stats.rsd > config.parallelTest.maxRSD) {
    console.log(
      chalk.yellow(
        `⚠ 平行检测相对标准偏差(RSD=${stats.rsd}%)超过阈值(${config.parallelTest.maxRSD}%)，` +
        `离散度较大，请确认结果或重新检测`
      )
    );
  }
  const threshold = getThreshold(config, projectName);
  const judgement = judgeResult(stats.mean, threshold);
  const testResults = { ...(sample.testResults || {}) };
  if (!testResults[projectName]) {
    testResults[projectName] = [];
  }
  const record = {
    values: stats.values,
    mean: stats.mean,
    stdDev: stats.stdDev,
    rsd: stats.rsd,
    min: stats.min,
    max: stats.max,
    range: stats.range,
    count: stats.count,
    unit: threshold?.unit || '',
    judged: judgement.pass,
    compare: judgement.compare,
    standard: judgement.standard,
    operator: operator || 'tester',
    remark: remark || '',
    timestamp: new Date().toISOString()
  };
  testResults[projectName].push(record);
  const completed = Object.keys(testResults).length;
  const total = sample.projects.length;
  let newStatus = sample.status;
  if (sample.status === 'pending') {
    newStatus = 'testing';
  }
  const updated = updateSample(config, sampleId, {
    testResults,
    status: newStatus,
    statusHistory: newStatus !== sample.status
      ? [...(sample.statusHistory || []), {
          status: newStatus,
          time: new Date().toISOString(),
          operator: operator || 'system',
          reason: '录入检测结果自动流转'
        }]
      : sample.statusHistory
  });
  const judgeTag = judgement.pass === true
    ? chalk.green('合格')
    : judgement.pass === false
    ? chalk.red.bold('不合格')
    : chalk.yellow('待定');
  console.log(chalk.green(`✓ 检测结果录入成功`));
  console.log(`  样品: ${sampleId}`);
  console.log(`  项目: ${projectName}`);
  console.log(`  平行次数: ${stats.count}`);
  console.log(`  检测值: ${stats.values.join(', ')} ${threshold?.unit || ''}`);
  console.log(`  均值: ${stats.mean} ${threshold?.unit || ''}`);
  if (stats.count > 1) {
    console.log(`  RSD: ${stats.rsd}%`);
  }
  console.log(`  判定: ${judgeTag}`);
  if (judgement.standard) {
    console.log(`  依据: ${judgement.standard} (${judgement.compare})`);
  }
  console.log(`  项目完成: ${completed}/${total}`);
  return updated;
}

function judgeSampleOverall(sample, config) {
  if (!sample.testResults) {
    return { overall: 'pending', passed: 0, total: sample.projects.length, failed: 0, pending: sample.projects.length };
  }
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const project of sample.projects) {
    const results = sample.testResults[project];
    if (!results || results.length === 0) {
      pending++;
      continue;
    }
    const last = results[results.length - 1];
    if (last.judged === true) passed++;
    else if (last.judged === false) failed++;
    else pending++;
  }
  let overall;
  if (failed > 0) overall = 'failed';
  else if (pending > 0) overall = 'pending';
  else overall = 'passed';
  return { overall, passed, failed, pending, total: sample.projects.length };
}

function generateTextReport(sample, config) {
  const cat = config.categories[sample.category];
  const overall = judgeSampleOverall(sample, config);
  let overallTag;
  switch (overall.overall) {
    case 'passed': overallTag = chalk.green.bold('合格'); break;
    case 'failed': overallTag = chalk.red.bold('不合格'); break;
    default: overallTag = chalk.yellow('待检');
  }
  const lines = [];
  lines.push(chalk.cyan('╔' + '═'.repeat(60) + '╗'));
  lines.push(chalk.cyan('║') + chalk.white.bold(' '.repeat(20) + config.report.header + ' '.repeat(20)) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '═'.repeat(60) + '╣'));
  lines.push(chalk.cyan('║') + chalk.yellow(' 实验室: ') + config.lab.name + ' '.repeat(Math.max(0, 50 - 7 - config.lab.name.length)) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + chalk.yellow(' 报告编号: ') + sample.id + ' '.repeat(Math.max(0, 50 - 10 - sample.id.length)) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '─'.repeat(60) + '╣'));
  const pad = (label, value, width = 50) => {
    const len = label.length + String(value).length;
    return ' ' + chalk.yellow(label + ': ') + value + ' '.repeat(Math.max(0, width - len));
  };
  lines.push(chalk.cyan('║') + pad('样品名称', sample.name) + chalk.cyan('║'));
  if (sample.batch) lines.push(chalk.cyan('║') + pad('批次号', sample.batch) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('检测类别', cat.name) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('采样来源', sample.source) + chalk.cyan('║'));
  if (sample.producer) lines.push(chalk.cyan('║') + pad('生产单位', sample.producer) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('采样人员', sample.sampler) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('采样日期', sample.sampleDate) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('样品数量', `${sample.quantity} ${sample.unit}`) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('综合判定', overallTag.replace(/\x1b\[[0-9;]*m/g, '')) + chalk.cyan('║'));
  lines.push(chalk.cyan('║') + pad('检测进度', `${overall.passed + overall.failed}/${overall.total} 合格:${overall.passed} 不合格:${overall.failed} 待检:${overall.pending}`) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '═'.repeat(60) + '╣'));
  lines.push(chalk.cyan('║') + chalk.white.bold(' 检测项目                     结果       单位     判定   标准') + ' '.repeat(4) + chalk.cyan('║'));
  lines.push(chalk.cyan('╠' + '─'.repeat(60) + '╣'));
  for (const project of sample.projects) {
    const results = sample.testResults?.[project] || [];
    if (results.length === 0) {
      const row = ` ${project.padEnd(26).slice(0, 26)}${chalk.yellow('待检').padEnd(11)}${''.padEnd(9)}${''.padEnd(7)}`;
      lines.push(chalk.cyan('║') + row + chalk.cyan('║'));
      continue;
    }
    const last = results[results.length - 1];
    const threshold = getThreshold(config, project);
    const unit = last.unit || threshold?.unit || '';
    let tag = '';
    if (last.judged === true) tag = chalk.green('合格');
    else if (last.judged === false) tag = chalk.red('不合格');
    else tag = chalk.gray('-');
    const std = threshold?.standard || '-';
    const valStr = String(last.mean);
    const row = ` ${project.padEnd(26).slice(0, 26)}${valStr.padEnd(11)}${unit.padEnd(9)}${(tag + '').padEnd(7).slice(0, 7)}`;
    lines.push(chalk.cyan('║') + row + chalk.cyan('║'));
    if (results.length > 1) {
      const detail = chalk.gray(`   平行${last.count}次 均值:${last.mean} RSD:${last.rsd}% 范围:${last.min}~${last.max}`);
      lines.push(chalk.cyan('║') + detail + ' '.repeat(Math.max(0, 50 - detail.length)) + chalk.cyan('║'));
    }
  }
  lines.push(chalk.cyan('╠' + '═'.repeat(60) + '╣'));
  lines.push(chalk.cyan('║') + pad('报告日期', new Date().toISOString().slice(0, 10)) + chalk.cyan('║'));
  lines.push(chalk.cyan('╚' + '═'.repeat(60) + '╝'));
  return lines.join('\n');
}

function generateJSONReport(sample, config) {
  const overall = judgeSampleOverall(sample, config);
  const projectsResults = [];
  for (const project of sample.projects) {
    const results = sample.testResults?.[project] || [];
    const threshold = getThreshold(config, project);
    const projectResult = {
      name: project,
      unit: threshold?.unit || '',
      standard: threshold?.standard || '',
      limit: threshold ? { min: threshold.min, max: threshold.max, compare: threshold.pass } : null
    };
    if (results.length === 0) {
      projectResult.status = 'pending';
    } else {
      const last = results[results.length - 1];
      projectResult.status = last.judged === true ? 'passed' : last.judged === false ? 'failed' : 'unknown';
      projectResult.values = last.values;
      projectResult.mean = last.mean;
      projectResult.stdDev = last.stdDev;
      projectResult.rsd = last.rsd;
      projectResult.count = last.count;
      projectResult.judged = last.judged;
      projectResult.operator = last.operator;
      projectResult.timestamp = last.timestamp;
    }
    projectsResults.push(projectResult);
  }
  return {
    reportId: sample.id,
    lab: {
      name: config.lab.name,
      code: config.lab.code
    },
    sample: {
      id: sample.id,
      name: sample.name,
      batch: sample.batch,
      category: sample.category,
      categoryName: config.categories[sample.category].name,
      source: sample.source,
      producer: sample.producer,
      sampler: sample.sampler,
      sampleDate: sample.sampleDate,
      quantity: sample.quantity,
      unit: sample.unit
    },
    overall: {
      result: overall.overall,
      passed: overall.passed,
      failed: overall.failed,
      pending: overall.pending,
      total: overall.total
    },
    results: projectsResults,
    status: sample.status,
    statusName: config.statusFlow[sample.status].name,
    isException: sample.isException,
    exceptionReason: sample.exceptionReason,
    reportDate: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString()
  };
}

function outputReport(config, sample, format, outputPath) {
  let content;
  if (format === 'json') {
    content = JSON.stringify(generateJSONReport(sample, config), null, 2);
  } else {
    content = generateTextReport(sample, config);
  }
  if (outputPath) {
    const absPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, content, 'utf8');
    console.log(chalk.green(`✓ 报告已保存至: ${absPath}`));
  }
  console.log(content);
}

function register(program) {
  const cmd = new Command('report')
    .description('检测结果录入与报告生成')
    .alias('rp');

  cmd
    .command('input')
    .description('录入检测结果 (支持平行检测多值)')
    .argument('<sampleId>', '样品编号')
    .argument('<project>', '检测项目名称')
    .argument('<values...>', '检测值(多个值为平行检测)')
    .option('-o, --operator <name>', '检测员姓名', 'tester')
    .option('-r, --remark <text>', '备注信息')
    .action((sampleId, project, values, options) => {
      const config = loadConfig();
      try {
        inputTestResult(config, sampleId, project, values, options.operator, options.remark);
      } catch (e) {
        if (e instanceof ValidationError) {
          console.error(chalk.red(`✗ ${e.message}`));
        } else {
          console.error(chalk.red(e.message));
        }
        process.exit(1);
      }
    });

  cmd
    .command('generate')
    .description('生成检测报告')
    .argument('<sampleId>', '样品编号')
    .option('-f, --format <format>', '输出格式: text|json', 'text')
    .option('-o, --output <path>', '输出文件路径')
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
        console.error(chalk.red(`✗ 样品不存在: ${sampleId}`));
        process.exit(1);
      }
      if (!['text', 'json'].includes(options.format)) {
        console.error(chalk.red('✗ 格式必须是 text 或 json'));
        process.exit(1);
      }
      outputReport(config, sample, options.format, options.output);
    });

  cmd
    .command('judge')
    .description('显示样品综合判定结果')
    .argument('<sampleId>', '样品编号')
    .action((sampleId) => {
      const config = loadConfig();
      try {
        validateSampleId(sampleId, config);
      } catch (e) {
        console.error(chalk.red(e.message));
        process.exit(1);
      }
      const sample = getSampleById(config, sampleId);
      if (!sample) {
        console.error(chalk.red(`✗ 样品不存在: ${sampleId}`));
        process.exit(1);
      }
      const overall = judgeSampleOverall(sample, config);
      console.log(chalk.cyan.bold('\n样品综合判定结果'));
      console.log(`样品: ${sample.id} - ${sample.name}`);
      const tag = overall.overall === 'passed'
        ? chalk.green.bold('合格')
        : overall.overall === 'failed'
        ? chalk.red.bold('不合格')
        : chalk.yellow('待检');
      console.log(`综合判定: ${tag}`);
      console.log(`检测项目: ${overall.passed + overall.failed + overall.pending}`);
      console.log(`  ${chalk.green('合格:')} ${overall.passed}`);
      console.log(`  ${chalk.red('不合格:')} ${overall.failed}`);
      console.log(`  ${chalk.yellow('待检:')} ${overall.pending}`);
      if (overall.failed > 0) {
        console.log(chalk.red('\n不合格项目:'));
        for (const project of sample.projects) {
          const results = sample.testResults?.[project] || [];
          if (results.length > 0 && results[results.length - 1].judged === false) {
            const last = results[results.length - 1];
            const threshold = getThreshold(config, project);
            console.log(
              `  ${chalk.red.bold(project)}: ${last.mean} ${threshold?.unit || ''}` +
              ` (标准: ${last.compare}, 依据: ${last.standard})`
            );
          }
        }
      }
    });

  cmd
    .command('approve')
    .description('签发报告 (流转到出证状态)')
    .argument('<sampleId>', '样品编号')
    .option('-o, --operator <name>', '签发人', 'approver')
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
        console.error(chalk.red(`✗ 样品不存在: ${sampleId}`));
        process.exit(1);
      }
      if (sample.status !== 'review') {
        console.error(chalk.red(`✗ 当前状态为 [${config.statusFlow[sample.status].name}]，只有复核状态才能签发`));
        process.exit(1);
      }
      const overall = judgeSampleOverall(sample, config);
      if (overall.pending > 0) {
        console.error(
          chalk.red(`✗ 还有 ${overall.pending} 个项目未检测，不能签发`)
        );
        process.exit(1);
      }
      updateSample(config, sampleId, {
        status: 'certified',
        approvedBy: options.operator,
        approvedAt: new Date().toISOString(),
        statusHistory: [...(sample.statusHistory || []), {
          status: 'certified',
          time: new Date().toISOString(),
          operator: options.operator,
          reason: '报告签发'
        }]
      });
      console.log(chalk.green(`✓ 报告已签发: ${sampleId}`));
      console.log(`签发人: ${options.operator}`);
      console.log(`综合判定: ${overall.overall === 'passed' ? chalk.green('合格') : chalk.red('不合格')}`);
    });

  program.addCommand(cmd);
}

module.exports = { register, inputTestResult, generateTextReport, generateJSONReport, judgeSampleOverall };
