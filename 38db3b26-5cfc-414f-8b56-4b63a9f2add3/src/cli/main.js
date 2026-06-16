import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse/sync';
import chalk from 'chalk';
import Table from 'cli-table3';
import cliProgress from 'cli-progress';
import { runPipeline, resumePipeline } from '../orchestrator/pipeline.js';
import { getBrowserPool } from '../engines/browserPool.js';
import { getDb, getVinStatuses, getBatchSummary, closeDb } from '../store/db.js';
import { generateReports } from '../reports/generator.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('cli');

const STATUS_ICONS = {
  completed: chalk.green('✓'),
  pending: chalk.gray('○'),
  processing: chalk.yellow('◉'),
  error: chalk.red('✗'),
  captcha_wait: chalk.magenta('⚡'),
};

const RISK_COLORS = {
  high: chalk.red.bold,
  medium: chalk.yellow,
  low: chalk.green,
  unknown: chalk.gray,
};

function parseArgs(argv) {
  const args = { command: 'run', input: null, batchId: null, resume: false };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--input':
      case '-i':
        args.input = argv[++i];
        break;
      case '--batch-id':
      case '-b':
        args.batchId = argv[++i];
        break;
      case '--resume':
      case '-r':
        args.resume = true;
        break;
      case '--help':
      case '-h':
        args.command = 'help';
        break;
      default:
        if (!argv[i].startsWith('-')) {
          args.command = argv[i];
        }
    }
  }
  return args;
}

function loadVinsFromCsv(filePath) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const vins = [];
  for (const record of records) {
    const vin = record.VIN || record.vin || record.Vin || record['车架号'] || Object.values(record)[0];
    if (vin && vin.trim().length === 17) {
      vins.push(vin.trim().toUpperCase());
    }
  }
  return vins;
}

function printHelp() {
  console.log(`
${chalk.cyan.bold('车辆合规核验系统 v1.0')}
${chalk.dim('━'.repeat(50))}

${chalk.bold('用法:')}
  node src/cli/main.js [选项]

${chalk.bold('选项:')}
  -i, --input <path>     VIN清单CSV文件路径
  -b, --batch-id <id>    指定批次ID
  -r, --resume           从断点恢复执行
  -h, --help             显示帮助信息

${chalk.bold('快捷键:')}
  Space                  暂停/恢复
  D                      查看当前VIN详情
  Q                      退出

${chalk.bold('CSV格式:')}
  首行为表头，包含VIN或车架号列
  每行一个17位VIN码
`);
}

async function showProgressBar(pool, total) {
  const bar = new cliProgress.SingleBar({
    format: `${chalk.cyan('浏览器池初始化')} |${chalk.cyan('{bar}')}| {value}/{total} 实例`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  bar.start(total, 0);

  for (let i = 0; i < total; i++) {
    await new Promise((r) => setTimeout(r, 500));
    bar.update(i + 1);
  }
  bar.stop();
}

async function runInteractive(vins, args) {
  let paused = false;
  let pipelineRef = null;

  const handleKeypress = async (str, key) => {
    if (key.name === 'space') {
      if (pipelineRef) {
        if (paused) {
          pipelineRef.resumeProcessing();
          paused = false;
          console.log(chalk.green('\n▶ 已恢复执行'));
        } else {
          pipelineRef.pause();
          paused = true;
          console.log(chalk.yellow('\n⏸ 已暂停执行'));
        }
      }
    } else if (key.name === 'q') {
      if (pipelineRef) {
        await pipelineRef.stop();
        console.log(chalk.red('\n⏹ 已停止执行'));
      }
      process.exit(0);
    } else if (key.name === 'd') {
      showCurrentDetails(args.batchId || pipelineRef?.batchId);
    }
  };

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', handleKeypress);
  }

  console.log(chalk.cyan.bold('\n🚗 车辆合规核验系统启动\n'));
  console.log(chalk.dim(`批次: ${args.batchId || '自动生成'}`));
  console.log(chalk.dim(`VIN数量: ${vins.length}`));
  console.log(chalk.dim('━'.repeat(50)));

  console.log(chalk.cyan('\n正在初始化浏览器池...'));
  const pool = getBrowserPool();
  await showProgressBar(pool, pool.maxSize);
  console.log(chalk.green('✓ 浏览器池就绪\n'));

  const statusTable = new Table({
    head: [
      chalk.bold('VIN'),
      chalk.bold('交管'),
      chalk.bold('出险'),
      chalk.bold('召回'),
      chalk.bold('排放'),
      chalk.bold('风险'),
      chalk.bold('状态'),
    ],
    colWidths: [20, 8, 8, 8, 8, 8, 12],
    style: { 'padding-left': 1, 'padding-right': 1 },
  });

  const vinStatusMap = new Map();

  const result = await runPipeline(vins, {
    batchId: args.batchId,
    onProgress: (info) => {
      const pct = ((info.completed / info.total) * 100).toFixed(1);
      const etaMin = Math.round(info.etaSeconds / 60);
      process.stdout.write(`\r${chalk.cyan('进度:')} ${info.completed}/${info.total} (${pct}%) ${chalk.dim(`预估剩余: ${etaMin}分钟`)}`);
    },
    onVinStart: (info) => {
      vinStatusMap.set(info.vin, {
        dmv: 'processing', insurance: 'processing',
        recall: 'processing', emission: 'processing',
        status: 'processing', risk: 'unknown',
      });
    },
    onVinComplete: (info) => {
      vinStatusMap.set(info.vin, {
        ...vinStatusMap.get(info.vin),
        status: info.status,
      });
    },
    onTaskComplete: (info) => {
      const current = vinStatusMap.get(info.vin) || {};
      current[info.platform] = info.status;
      vinStatusMap.set(info.vin, current);
    },
  });

  pipelineRef = result.pipeline;

  console.log('\n\n' + chalk.cyan.bold('核验结果:'));
  statusTable.length = 0;

  const finalStatuses = getVinStatuses(result.batchId);
  for (const vs of finalStatuses) {
    statusTable.push([
      vs.vin.substring(0, 17),
      STATUS_ICONS[vs.dmv_status] || chalk.gray('—'),
      STATUS_ICONS[vs.insurance_status] || chalk.gray('—'),
      STATUS_ICONS[vs.recall_status] || chalk.gray('—'),
      STATUS_ICONS[vs.emission_status] || chalk.gray('—'),
      RISK_COLORS[vs.risk_level || 'unknown'](vs.risk_level || '—'),
      STATUS_ICONS[vs.overall_status] || chalk.gray('—'),
    ]);
  }

  console.log(statusTable.toString());

  const summary = getBatchSummary(result.batchId);
  console.log(chalk.dim('━'.repeat(50)));
  console.log(`  ${chalk.green('✓ 完成:')} ${summary.completed}`);
  console.log(`  ${chalk.red('✗ 失败:')} ${summary.failed}`);
  console.log(`  ${chalk.gray('○ 待处理:')} ${summary.pending}`);
  console.log(`  ${chalk.yellow('◉ 处理中:')} ${summary.processing}`);

  const { jsonPath, textPath } = generateReports(result.batchId);
  console.log(chalk.dim('\n━'.repeat(50)));
  console.log(`${chalk.green('📄 报告已生成:')}`);
  console.log(chalk.dim(`  JSON: ${jsonPath}`));
  console.log(chalk.dim(`  文本: ${textPath}`));

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

function showCurrentDetails(batchId) {
  if (!batchId) return;
  try {
    const db = getDb();
    const statuses = getVinStatuses(batchId);
    const processing = statuses.filter((s) =>
      s.dmv_status === 'processing' || s.insurance_status === 'processing' ||
      s.recall_status === 'processing' || s.emission_status === 'processing'
    );

    if (processing.length === 0) {
      console.log(chalk.dim('\n当前无正在处理的VIN'));
      return;
    }

    console.log(chalk.cyan('\n当前处理详情:'));
    for (const vs of processing.slice(0, 5)) {
      console.log(`  ${vs.vin}: 交管${STATUS_ICONS[vs.dmv_status] || '—'} 出险${STATUS_ICONS[vs.insurance_status] || '—'} 召回${STATUS_ICONS[vs.recall_status] || '—'} 排放${STATUS_ICONS[vs.emission_status] || '—'}`);
    }
  } catch {}
}

async function runResume(batchId) {
  console.log(chalk.cyan.bold('\n🚗 车辆合规核验系统 - 断点恢复\n'));
  console.log(chalk.dim(`恢复批次: ${batchId}`));

  const pool = getBrowserPool();
  await pool.initialize();
  console.log(chalk.green('✓ 浏览器池就绪\n'));

  const result = await resumePipeline(batchId, {
    onProgress: (info) => {
      const pct = ((info.completed / info.total) * 100).toFixed(1);
      const etaMin = Math.round(info.etaSeconds / 60);
      process.stdout.write(`\r${chalk.cyan('进度:')} ${info.completed}/${info.total} (${pct}%) ${chalk.dim(`预估剩余: ${etaMin}分钟`)}`);
    },
  });

  generateReports(result.batchId);
  console.log(chalk.green('\n✓ 断点恢复执行完成'));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command === 'help') {
    printHelp();
    process.exit(0);
  }

  try {
    if (args.resume && args.batchId) {
      await runResume(args.batchId);
    } else if (args.input) {
      const vins = loadVinsFromCsv(args.input);
      if (vins.length === 0) {
        console.error(chalk.red('错误: CSV文件中未找到有效的VIN码'));
        process.exit(1);
      }
      console.log(chalk.green(`从CSV加载了 ${vins.length} 个VIN码`));
      await runInteractive(vins, args);
    } else {
      console.error(chalk.red('错误: 请使用 --input 指定CSV文件或使用 --resume 恢复批次'));
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red(`\n致命错误: ${err.message}`));
    log.error('Fatal error', { error: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
