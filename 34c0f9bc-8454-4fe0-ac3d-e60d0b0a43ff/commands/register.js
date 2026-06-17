'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const { parse } = require('csv-parse/sync');
const { Command } = require('commander');

const { loadConfig } = require('../lib/config');
const {
  validateCategory,
  validateRequiredFields,
  ValidationError
} = require('../lib/validator');
const {
  padEndVisual,
  centerVisual,
  truncateVisual,
  stringWidth,
  formatDateLocal,
  formatDateTimeLocal,
  displayDateTime
} = require('../lib/utils');
const {
  generateSampleId,
  addSample,
  addSamples,
  getSampleById
} = require('../lib/store');

function autoMatchCategory(projects, config) {
  const projectSet = new Set(projects);
  let bestMatch = null;
  let bestCount = 0;
  for (const [key, cat] of Object.entries(config.categories)) {
    const matchCount = cat.projects.filter(p => projectSet.has(p)).length;
    if (matchCount > bestCount) {
      bestCount = matchCount;
      bestMatch = key;
    }
  }
  return bestMatch || 'physicochemical';
}

function generateBarcode(id) {
  const bars = '█'.repeat(2);
  const spaces = ' '.repeat(2);
  let code = '';
  for (const ch of id) {
    const num = ch.charCodeAt(0);
    code += num % 2 === 0 ? bars : spaces;
  }
  return `${code}\n  ${id}`;
}

function createSample(config, data) {
  validateRequiredFields(data, ['name', 'source', 'sampler']);
  if (data.category) {
    validateCategory(data.category, config);
  }
  const category = data.category || autoMatchCategory(data.projects || [], config);
  const catProjects = config.categories[category].projects;
  const projects = data.projects && data.projects.length > 0
    ? data.projects.filter(p => catProjects.includes(p))
    : catProjects;
  const id = data.id || generateSampleId(config);
  const now = formatDateTimeLocal(new Date());
  return {
    id,
    name: data.name,
    batch: data.batch || '',
    category,
    source: data.source,
    producer: data.producer || '',
    sampler: data.sampler,
    sampleDate: data.sampleDate || formatDateLocal(new Date()),
    quantity: data.quantity || 1,
    unit: data.unit || '份',
    projects,
    status: 'pending',
    isException: false,
    exceptionReason: '',
    testResults: {},
    statusHistory: [
      { status: 'pending', time: now, operator: data.sampler || 'system' }
    ],
    registeredAt: now,
    registeredBy: data.sampler || 'system',
    updatedAt: now,
    barcode: id,
    remark: data.remark || ''
  };
}

function printSampleCard(sample, config) {
  const cat = config.categories[sample.category];
  const W = 50;
  const border = (l, r) => chalk.cyan.bold(l) + '─'.repeat(W) + chalk.cyan.bold(r);
  const line = (content) => chalk.cyan.bold('│') + padEndVisual(content, W) + chalk.cyan.bold('│');
  const kv = (label, value) => line(` ${chalk.yellow(label)}: ${value}`);
  console.log('\n' + border('┌', '┐'));
  console.log(line(centerVisual(chalk.white.bold('样品登记成功'), W)));
  console.log(border('├', '┤'));
  console.log(kv('样品编号', chalk.bold(sample.id)));
  console.log(kv('样品名称', sample.name));
  if (sample.batch) {
    console.log(kv('批次号', sample.batch));
  }
  console.log(kv('检测类别', cat.name));
  console.log(kv('采样来源', sample.source));
  console.log(kv('采样人员', sample.sampler));
  console.log(kv('采样日期', sample.sampleDate));
  console.log(kv('状态', chalk.yellow('待检')));
  console.log(kv('检测项目', `${sample.projects.length}项`));
  const indent = '   ';
  const maxW = W - stringWidth(indent);
  const parts = [];
  let cur = '';
  for (const p of sample.projects) {
    const candidate = cur ? cur + '、' + p : p;
    if (stringWidth(candidate) <= maxW) {
      cur = candidate;
    } else {
      if (cur) parts.push(cur);
      cur = p;
    }
  }
  if (cur) parts.push(cur);
  for (const part of parts) {
    console.log(line(`${indent}${part}`));
  }
  console.log(border('└', '┘'));
  console.log(chalk.gray(`\n条码:\n${generateBarcode(sample.id)}`));
}

async function interactiveMode(config) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const question = (q) => new Promise(resolve => rl.question(q, resolve));
  const data = {};
  console.log(chalk.cyan.bold('\n=== 交互式样品登记 ===\n'));
  data.name = await question(chalk.yellow('样品名称*: '));
  data.batch = await question(chalk.yellow('批次号 (可选): '));
  const cats = Object.entries(config.categories).map(([k, v]) => `${k}(${v.name})`).join(', ');
  const catInput = await question(chalk.yellow(`检测类别 (${cats}, 可选自动匹配): `));
  if (catInput) data.category = catInput.trim();
  data.source = await question(chalk.yellow('采样来源*: '));
  data.producer = await question(chalk.yellow('生产单位 (可选): '));
  data.sampler = await question(chalk.yellow('采样人员*: '));
  data.sampleDate = await question(chalk.yellow('采样日期 (YYYY-MM-DD, 可选今天): '));
  const quantityInput = await question(chalk.yellow('样品数量 (可选默认1): '));
  if (quantityInput) data.quantity = parseInt(quantityInput) || 1;
  const projectsInput = await question(chalk.yellow('检测项目 (逗号分隔, 可选默认全部): '));
  if (projectsInput) {
    data.projects = projectsInput.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  }
  data.remark = await question(chalk.yellow('备注 (可选): '));
  rl.close();
  console.log();
  try {
    const sample = createSample(config, data);
    addSample(config, sample);
    printSampleCard(sample, config);
  } catch (e) {
    if (e instanceof ValidationError) {
      console.error(chalk.red(`✗ 登记失败: ${e.message}`));
    } else {
      throw e;
    }
  }
}

async function batchImport(config, filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`✗ 文件不存在: ${absPath}`));
    process.exit(1);
  }
  const content = fs.readFileSync(absPath, 'utf8');
  let records;
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (e) {
    console.error(chalk.red(`✗ CSV解析失败: ${e.message}`));
    process.exit(1);
  }
  if (records.length === 0) {
    console.error(chalk.yellow('! CSV文件为空'));
    return;
  }
  console.log(chalk.cyan(`共读取 ${records.length} 条记录，开始处理...`));
  const bar = new cliProgress.SingleBar({
    format: '进度 |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | 成功: {success} 失败: {fail}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  });
  bar.start(records.length, 0, { success: 0, fail: 0 });
  const samples = [];
  const errors = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    try {
      const data = {
        name: r.name || r.样品名称,
        batch: r.batch || r.批次号 || '',
        category: r.category || r.类别 || '',
        source: r.source || r.采样来源,
        producer: r.producer || r.生产单位 || '',
        sampler: r.sampler || r.采样员,
        sampleDate: r.sampleDate || r.采样日期 || '',
        quantity: r.quantity ? parseInt(r.quantity) : (r.数量 ? parseInt(r.数量) : 1),
        remark: r.remark || r.备注 || ''
      };
      if (r.projects || r.项目) {
        data.projects = (r.projects || r.项目 || '').split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
      }
      const sample = createSample(config, data);
      samples.push(sample);
      bar.increment(1, { success: samples.length, fail: errors.length });
    } catch (e) {
      errors.push({ row: i + 2, record: r, message: e.message });
      bar.increment(1, { success: samples.length, fail: errors.length });
    }
  }
  bar.stop();
  let addedCount = 0;
  let dupCount = 0;
  if (samples.length > 0) {
    const { added, duplicates } = addSamples(config, samples);
    addedCount = added.length;
    dupCount = duplicates.length;
  }
  console.log();
  console.log(chalk.green(`✓ 成功登记: ${addedCount} 条`));
  if (dupCount > 0) {
    console.log(chalk.yellow(`! 编号重复跳过: ${dupCount} 条`));
  }
  if (errors.length > 0) {
    console.log(chalk.red(`✗ 登记失败: ${errors.length} 条`));
    for (const err of errors.slice(0, 5)) {
      console.log(chalk.gray(`  第${err.row}行: ${err.message}`));
    }
    if (errors.length > 5) {
      console.log(chalk.gray(`  ...还有 ${errors.length - 5} 条错误`));
    }
  }
  if (addedCount > 0) {
    console.log(chalk.cyan(`\n最近登记的编号: ${samples.slice(-5).map(s => s.id).join(', ')}`));
  }
}

function querySample(config, id) {
  const sample = getSampleById(config, id);
  if (!sample) {
    console.log(chalk.red(`✗ 未找到样品: ${id}`));
    return;
  }
  printSampleCard(sample, config);
}

function register(program) {
  const cmd = new Command('register')
    .description('样品登记与查询')
    .alias('reg');

  cmd
    .command('add')
    .description('登记单个样品 (非交互式)')
    .requiredOption('-n, --name <name>', '样品名称')
    .option('-b, --batch <batch>', '批次号')
    .option('-c, --category <category>', '检测类别')
    .requiredOption('-s, --source <source>', '采样来源')
    .option('-p, --producer <producer>', '生产单位')
    .requiredOption('-r, --sampler <sampler>', '采样人员')
    .option('-d, --date <date>', '采样日期 (YYYY-MM-DD)')
    .option('-q, --quantity <quantity>', '样品数量', parseInt)
    .option('-j, --projects <projects>', '检测项目(逗号分隔)')
    .option('-m, --remark <remark>', '备注')
    .action((options) => {
      const config = loadConfig();
      const data = { ...options };
      if (options.date) data.sampleDate = options.date;
      if (options.projects) {
        data.projects = options.projects.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      }
      try {
        const sample = createSample(config, data);
        addSample(config, sample);
        printSampleCard(sample, config);
      } catch (e) {
        if (e instanceof ValidationError) {
          console.error(chalk.red(`✗ 登记失败: ${e.message}`));
          process.exit(1);
        }
        throw e;
      }
    });

  cmd
    .command('interactive')
    .alias('i')
    .description('交互式逐条录入样品')
    .action(async () => {
      const config = loadConfig();
      await interactiveMode(config);
    });

  cmd
    .command('import')
    .description('批量导入CSV文件')
    .requiredOption('-f, --file <path>', 'CSV文件路径')
    .action((options) => {
      const config = loadConfig();
      batchImport(config, options.file);
    });

  cmd
    .command('show')
    .description('查询样品信息')
    .argument('<sampleId>', '样品编号')
    .action((sampleId) => {
      const config = loadConfig();
      querySample(config, sampleId);
    });

  program.addCommand(cmd);
}

module.exports = { register, createSample, generateBarcode };
