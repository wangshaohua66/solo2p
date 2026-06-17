'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Command } = require('commander');

const { loadConfig, getThreshold } = require('../lib/config');
const {
  validateSampleId,
  validateTestValue,
  validateProject,
  judgeResult,
  calculateParallelStats,
  ValidationError
} = require('../lib/validator');
const {
  padEndVisual,
  centerVisual,
  formatDateLocal,
  formatDateTimeLocal
} = require('../lib/utils');
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
    timestamp: formatDateTimeLocal(new Date())
  };
  testResults[projectName].push(record);
  const completed = Object.keys(testResults).length;
  const total = sample.projects.length;
  let newStatus = sample.status;
  if (sample.status === 'pending') {
    newStatus = 'testing';
  }
  const isFailed = judgement.pass === false;
  const updates = {
    testResults,
    status: newStatus
  };
  const newHistory = [...(sample.statusHistory || [])];
  if (newStatus !== sample.status) {
    newHistory.push({
      status: newStatus,
      time: formatDateTimeLocal(new Date()),
      operator: operator || 'system',
      reason: '录入检测结果自动流转'
    });
  }
  if (isFailed) {
    updates.isException = true;
    const reasonText = `检测项目[${projectName}]不合格: 均值${stats.mean}${threshold?.unit || ''} ${judgement.compare} (依据${judgement.standard || 'N/A'})`;
    updates.exceptionReason = reasonText;
    newHistory.push({
      status: newStatus,
      time: formatDateTimeLocal(new Date()),
      operator: operator || 'system',
      reason: `自动标记异常: ${reasonText}`
    });
  }
  updates.statusHistory = newHistory;
  const updated = updateSample(config, sampleId, updates);
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
  if (isFailed) {
    console.log(chalk.red.bold(`\n⚠ 检测结果不合格！样品已自动标记为异常！`));
    console.log(chalk.red(`  异常原因: ${updates.exceptionReason}`));
    console.log(chalk.red(`  请及时处理或重新检测。`));
  }
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

function loadReportTemplate(config) {
  const templatePath = config.report.templatePath;
  if (!templatePath) {
    throw new Error('配置中未指定 report.templatePath，无法加载报告模板');
  }
  const templateDir = path.isAbsolute(templatePath)
    ? templatePath
    : path.join(process.cwd(), templatePath);
  const templateFile = path.join(templateDir, 'report_template.json');
  if (!fs.existsSync(templateFile)) {
    throw new Error(`报告模板文件不存在: ${templateFile}，请检查配置 report.templatePath`);
  }
  let template;
  try {
    template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
  } catch (e) {
    throw new Error(`报告模板文件解析失败: ${templateFile} - ${e.message}`);
  }
  return template;
}

function generateTextReport(sample, config) {
  const template = loadReportTemplate(config);
  const cat = config.categories[sample.category];
  const overall = judgeSampleOverall(sample, config);
  const fields = template.fields || {};
  const colProject = fields.project?.width || 22;
  const colResult = fields.result?.width || 12;
  const colUnit = fields.unit?.width || 12;
  const colJudge = fields.judged?.width || 8;
  const colStd = fields.standard?.width || 17;
  const W = 1 + colProject + colResult + colUnit + colJudge + colStd;
  const header = template.header || config.report.header || '检测报告';
  const border = (l, r) => chalk.cyan(l) + '═'.repeat(W) + chalk.cyan(r);
  const line = (content) => chalk.cyan('║') + padEndVisual(content, W) + chalk.cyan('║');
  const sep = (l, r) => chalk.cyan(l) + '─'.repeat(W) + chalk.cyan(r);
  const pad = (label, value, valueColor) => {
    const v = valueColor ? valueColor(String(value)) : String(value);
    return line(` ${chalk.yellow(label)}: ${v}`);
  };
  const sectionKeys = (template.sections || []).map(s => s.key);
  const lines = [];
  lines.push(border('╔', '╗'));
  lines.push(line(centerVisual(chalk.white.bold(header), W)));
  if (sectionKeys.includes('lab')) {
    lines.push(border('╠', '╣'));
    lines.push(pad('实验室', config.lab.name));
    lines.push(pad('报告编号', sample.id));
  }
  if (sectionKeys.includes('sample')) {
    lines.push(sep('╠', '╣'));
    lines.push(pad('样品名称', sample.name));
    if (sample.batch) lines.push(pad('批次号', sample.batch));
    lines.push(pad('检测类别', cat.name));
    lines.push(pad('采样来源', sample.source));
    if (sample.producer) lines.push(pad('生产单位', sample.producer));
    lines.push(pad('采样人员', sample.sampler));
    lines.push(pad('采样日期', sample.sampleDate));
    lines.push(pad('样品数量', `${sample.quantity} ${sample.unit}`));
  }
  if (sectionKeys.includes('overall')) {
    lines.push(pad('综合判定', overall.overall === 'passed' ? '合格' : overall.overall === 'failed' ? '不合格' : '待检'));
    lines.push(pad('检测进度', `${overall.passed + overall.failed}/${overall.total} 合格:${overall.passed} 不合格:${overall.failed} 待检:${overall.pending}`));
  }
  if (sectionKeys.includes('results')) {
    lines.push(border('╠', '╣'));
    const colHeader = ` ${chalk.white.bold(padEndVisual(fields.project?.label || '检测项目', colProject))}${padEndVisual(fields.result?.label || '结果', colResult)}${padEndVisual(fields.unit?.label || '单位', colUnit)}${padEndVisual(fields.judged?.label || '判定', colJudge)}${padEndVisual(fields.standard?.label || '标准', colStd)}`;
    lines.push(line(colHeader));
    lines.push(sep('╠', '╣'));
    for (const project of sample.projects) {
      const results = sample.testResults?.[project] || [];
      if (results.length === 0) {
        lines.push(line(` ${padEndVisual(project, colProject)}${chalk.yellow('待检')}`));
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
      lines.push(line(` ${padEndVisual(project, colProject)}${padEndVisual(valStr, colResult)}${padEndVisual(unit, colUnit)}${padEndVisual(tag, colJudge)}${padEndVisual(std, colStd)}`));
      if (last.count > 1) {
        const detail = chalk.gray(`   平行${last.count}次 均值:${last.mean} RSD:${last.rsd}% 范围:${last.min}~${last.max}`);
        lines.push(line(detail));
      }
    }
  }
  lines.push(border('╠', '╣'));
  lines.push(pad('报告日期', formatDateLocal(new Date())));
  lines.push(border('╚', '╝'));
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
    reportDate: formatDateLocal(new Date()),
    generatedAt: formatDateTimeLocal(new Date())
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
      try {
        outputReport(config, sample, options.format, options.output);
      } catch (e) {
        console.error(chalk.red(`✗ ${e.message}`));
        process.exit(1);
      }
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
        approvedAt: formatDateTimeLocal(new Date()),
        statusHistory: [...(sample.statusHistory || []), {
          status: 'certified',
          time: formatDateTimeLocal(new Date()),
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
