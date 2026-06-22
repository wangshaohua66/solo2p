#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const dayjs = require('dayjs');
const path = require('path');
const { getLogger } = require('./lib/logger');
const { getDB, PLATFORMS } = require('./lib/db');
const { aggregate } = require('./commands/aggregate');
const { merge, query } = require('./commands/merge');
const { deduct } = require('./commands/deduct');
const { declare } = require('./commands/declare');
const { stats } = require('./commands/stats');

let _inquirer = null;
async function getInquirer() {
  if (!_inquirer) {
    _inquirer = await import('inquirer');
  }
  return _inquirer;
}

const program = new Command();
const logger = getLogger();

function printBanner() {
  const banner = `
${chalk.cyan.bold('╔══════════════════════════════════════════════════════════════════╗')}
${chalk.cyan.bold('║')}      ${chalk.green.bold('电子发票聚合服务 CLI 工具 v1.0')}                               ${chalk.cyan.bold('║')}
${chalk.cyan.bold('║')}      ${chalk.gray('Electronic Invoice Aggregation Service')}                         ${chalk.cyan.bold('║')}
${chalk.cyan.bold('║')}      ${chalk.white('多平台归集 · 智能合并 · 抵扣计算 · 申报辅助')}                    ${chalk.cyan.bold('║')}
${chalk.cyan.bold('╚══════════════════════════════════════════════════════════════════╝')}
  ${chalk.gray(`支持平台: 航信 | 百望 | 腾讯电子发票 | 支付宝 | 京东 | 天猫`)}
  ${chalk.gray(`支持格式: XML / JSON / CSV / Excel / 结构化文本`)}
`;
  console.log(banner);
}

async function promptIfMissing(options, questions) {
  const inquirer = await getInquirer();
  const answers = {};
  for (const q of questions) {
    if (options[q.name] === undefined || options[q.name] === null || options[q.name] === '') {
      const a = await inquirer.prompt([q]);
      Object.assign(answers, a);
    } else {
      answers[q.name] = options[q.name];
    }
  }
  return { ...options, ...answers };
}

program
  .name('invoice')
  .description('电子发票聚合服务命令行工具 - 发票归集/合并/抵扣/申报/统计一站式处理')
  .version('1.0.0', '-v, --version', '显示版本号')
  .option('-d, --debug', '启用调试模式，输出详细日志', false)
  .option('-q, --quiet', '静默模式，仅输出错误日志', false)
  .option('--db <path>', '指定SQLite数据库文件路径', null)
  .option('--log-dir <path>', '指定日志输出目录', null)
  .helpOption('-h, --help', '显示帮助信息')
  .addHelpText('after', `

${chalk.bold('示例用法:')}
  ${chalk.cyan('# 1. 归集发票文件')}
  invoice aggregate --dir ./invoices --platform auto

  ${chalk.cyan('# 2. 合并指定日期范围的发票')}
  invoice merge --start-date 2026-01-01 --end-date 2026-01-31 --format csv,excel

  ${chalk.cyan('# 3. 计算月度增值税抵扣')}
  invoice deduct -s 2026-01-01 -e 2026-01-31 --export

  ${chalk.cyan('# 4. 预生成增值税申报表')}
  invoice declare -s 2026-01-01 -e 2026-01-31

  ${chalk.cyan('# 5. 生成月度统计报表')}
  invoice stats --period month --month 2026-01

  ${chalk.cyan('# 6. 查询发票 (按号码/日期/金额)')}
  invoice query --number 12345678 --exact
  invoice query --start-date 2026-01-01 --min-amount 1000 --max-amount 10000
`)
  .hook('preAction', () => {
    const opts = program.opts();
    if (opts.quiet) logger.setLevel('ERROR');
    else if (opts.debug) logger.setLevel('DEBUG');
    if (opts.logDir) logger.logDir = opts.logDir;
  })
  .hook('postAction', () => {
    try {
      const db = getDB();
      db.close();
    } catch (e) {}
    logger.close();
  });

program
  .command('aggregate')
  .alias('agg')
  .description('📥 发票归集 - 批量导入多格式发票文件并入库')
  .option('--dir <目录>', '发票文件所在目录（递归扫描）')
  .option('-p, --platform <平台>', `指定平台 (auto/${Object.values(PLATFORMS).join('/')})`, 'auto')
  .option('-m, --merchant <商户名>', '关联商户名称', null)
  .option('-f, --force', '强制导入，跳过校验失败记录', false)
  .option('-i, --interactive', '交互式引导输入参数', false)
  .action(async (opts) => {
    printBanner();
    try {
      let options = { ...opts };
      if (opts.interactive || !opts.dir) {
        options = await promptIfMissing(opts, [
          {
            type: 'input',
            name: 'dir',
            message: '请输入发票文件目录路径:',
            default: path.resolve(process.cwd(), 'data', 'invoices'),
            validate: (v) => !!v || '目录路径不能为空'
          },
          {
            type: 'list',
            name: 'platform',
            message: '请选择发票平台来源:',
            choices: [
              { name: '自动识别（推荐）', value: 'auto' },
              { name: '航信开票系统 (XML)', value: PLATFORMS.HANGXIN },
              { name: '百望开票系统 (JSON)', value: PLATFORMS.BAIWANG },
              { name: '腾讯电子发票 (CSV)', value: PLATFORMS.TENCENT },
              { name: '支付宝发票管家 (Excel)', value: PLATFORMS.ALIPAY },
              { name: '京东商家后台 (JSON/CSV)', value: PLATFORMS.JD },
              { name: '天猫商家中心 (TXT/CSV)', value: PLATFORMS.TMALL }
            ]
          },
          {
            type: 'input',
            name: 'merchant',
            message: '关联商户名称（可留空）:',
            default: null
          }
        ]);
      }
      const result = await aggregate(options);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`归集失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('merge')
  .alias('m')
  .description('🔀 发票合并 - 按条件筛选跨平台合并并去重')
  .option('-s, --start-date <日期>', '起始日期 YYYY-MM-DD')
  .option('-e, --end-date <日期>', '结束日期 YYYY-MM-DD')
  .option('-t, --type <类型>', '发票类型 (input/output/all)', 'all')
  .option('-p, --platform <平台>', '按平台筛选', 'all')
  .option('-m, --merchant <商户名>', '按商户名称模糊筛选', null)
  .option('-f, --format <格式>', '输出格式 (csv/excel/all)', 'csv')
  .option('-o, --output-dir <目录>', '输出目录', null)
  .option('-i, --interactive', '交互式引导输入参数', false)
  .action(async (opts) => {
    printBanner();
    try {
      let options = { ...opts };
      if (opts.interactive || !opts.startDate || !opts.endDate) {
        const thisMonth = dayjs();
        options = await promptIfMissing(opts, [
          {
            type: 'input',
            name: 'startDate',
            message: '起始日期 (YYYY-MM-DD):',
            default: thisMonth.startOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'input',
            name: 'endDate',
            message: '结束日期 (YYYY-MM-DD):',
            default: thisMonth.endOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'list',
            name: 'type',
            message: '筛选发票类型:',
            choices: [
              { name: '全部', value: 'all' },
              { name: '进项发票', value: 'input' },
              { name: '销项发票', value: 'output' }
            ]
          },
          {
            type: 'input',
            name: 'merchant',
            message: '商户名称（模糊筛选，可留空）:',
            default: null
          },
          {
            type: 'list',
            name: 'format',
            message: '输出文件格式:',
            choices: [
              { name: 'CSV 格式', value: 'csv' },
              { name: 'Excel 格式', value: 'excel' },
              { name: 'CSV + Excel', value: 'all' }
            ]
          }
        ]);
      }
      const result = await merge(options);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`合并失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('deduct')
  .alias('d')
  .description('🧾 抵扣计算 - 进销项匹配计算增值税可抵扣税额')
  .option('-s, --start-date <日期>', '申报期起始日期 YYYY-MM-DD')
  .option('-e, --end-date <日期>', '申报期结束日期 YYYY-MM-DD')
  .option('-r, --period <期间>', '期间标识（用于保存抵扣记录）', null)
  .option('--no-details', '不显示抵扣明细列表', false)
  .option('--no-export', '不导出抵扣明细CSV', false)
  .option('-o, --output-dir <目录>', '输出目录', null)
  .option('-i, --interactive', '交互式引导输入参数', false)
  .action(async (opts) => {
    printBanner();
    try {
      let options = { showDetails: !opts.details, export: !opts.noExport, ...opts };
      if (opts.interactive || !opts.startDate || !opts.endDate) {
        const thisMonth = dayjs();
        options = await promptIfMissing(options, [
          {
            type: 'input',
            name: 'startDate',
            message: '申报期起始日期 (YYYY-MM-DD):',
            default: thisMonth.startOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'input',
            name: 'endDate',
            message: '申报期结束日期 (YYYY-MM-DD):',
            default: thisMonth.endOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'confirm',
            name: 'showDetails',
            message: '显示抵扣明细列表?',
            default: true
          },
          {
            type: 'confirm',
            name: 'export',
            message: '导出抵扣明细CSV文件?',
            default: true
          }
        ]);
      }
      const result = await deduct(options);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`抵扣计算失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('declare')
  .alias('dec')
  .description('📄 申报预生成 - 预生成增值税申报表草稿CSV')
  .option('-s, --start-date <日期>', '申报期起始日期 YYYY-MM-DD')
  .option('-e, --end-date <日期>', '申报期结束日期 YYYY-MM-DD')
  .option('--previous-remaining <金额>', '上期留抵税额', '0')
  .option('-o, --output-dir <目录>', '输出目录', null)
  .option('-i, --interactive', '交互式引导输入参数', false)
  .action(async (opts) => {
    printBanner();
    try {
      let options = { ...opts };
      if (opts.interactive || !opts.startDate || !opts.endDate) {
        const thisMonth = dayjs();
        options = await promptIfMissing(opts, [
          {
            type: 'input',
            name: 'startDate',
            message: '申报期起始日期 (YYYY-MM-DD):',
            default: thisMonth.startOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'input',
            name: 'endDate',
            message: '申报期结束日期 (YYYY-MM-DD):',
            default: thisMonth.endOf('month').format('YYYY-MM-DD'),
            validate: (v) => dayjs(v).isValid() || '请输入有效日期'
          },
          {
            type: 'input',
            name: 'previousRemaining',
            message: '上期留抵税额 (元):',
            default: '0',
            validate: (v) => !isNaN(parseFloat(v)) || '请输入有效数字'
          }
        ]);
      }
      const result = await declare(options);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`申报表生成失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('stats')
  .alias('s')
  .description('📊 统计报表 - 生成月度/季度/年度发票统计报告')
  .option('-p, --period <类型>', '报表周期 (month/quarter/year)', 'month')
  .option('-m, --month <日期>', '参考月份 YYYY-MM', null)
  .option('-s, --start-date <日期>', '自定义起始日期', null)
  .option('-e, --end-date <日期>', '自定义结束日期', null)
  .option('--top-n <数量>', 'TOP商户排行数量', '10')
  .option('--no-export', '不导出CSV报表', false)
  .option('-o, --output-dir <目录>', '输出目录', null)
  .option('-i, --interactive', '交互式引导输入参数', false)
  .action(async (opts) => {
    printBanner();
    try {
      let options = { export: !opts.noExport, ...opts, topN: parseInt(opts.topN || '10') };
      if (opts.interactive) {
        options = await promptIfMissing(options, [
          {
            type: 'list',
            name: 'period',
            message: '报表周期类型:',
            choices: [
              { name: '月度报表', value: 'month' },
              { name: '季度报表', value: 'quarter' },
              { name: '年度报表', value: 'year' }
            ]
          },
          {
            type: 'input',
            name: 'month',
            message: '参考月份 (YYYY-MM，可留空默认当月):',
            default: dayjs().format('YYYY-MM')
          },
          {
            type: 'confirm',
            name: 'export',
            message: '导出CSV报表文件?',
            default: true
          }
        ]);
      }
      const result = await stats(options);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`报表生成失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('query')
  .alias('q')
  .description('🔍 发票查询 - 按号码/日期/金额等条件跨平台检索')
  .option('-n, --number <号码>', '发票号码（精确或模糊）', null)
  .option('-x, --exact', '发票号码精确匹配', false)
  .option('-s, --start-date <日期>', '起始日期 YYYY-MM-DD', null)
  .option('-e, --end-date <日期>', '结束日期 YYYY-MM-DD', null)
  .option('-t, --type <类型>', '发票类型 (input/output/all)', 'all')
  .option('-p, --platform <平台>', '按平台筛选', 'all')
  .option('-m, --merchant <商户名>', '按商户名称模糊筛选', null)
  .option('--min-amount <金额>', '最小价税合计', null)
  .option('--max-amount <金额>', '最大价税合计', null)
  .option('-l, --limit <数量>', '最多返回记录数', '500')
  .action(async (opts) => {
    printBanner();
    try {
      const result = await query(opts);
      if (!result || result.success === false) process.exitCode = 1;
    } catch (e) {
      logger.error(`查询失败: ${e.message}`);
      if (program.opts().debug) console.error(e.stack);
      process.exitCode = 1;
    }
  });

program
  .command('status')
  .description('📋 系统状态 - 查看数据库统计、发票总数等信息')
  .action(() => {
    printBanner();
    try {
      const db = getDB();
      const total = db.countInvoices();
      const today = dayjs().format('YYYY-MM-DD');
      const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
      const monthSummary = db.getSummary(monthStart, today);
      const cap = db.checkCapacity();
      const mem = process.memoryUsage();
      const { Table } = require('console-table-printer');
      const t = new Table({
        title: chalk.bold('📋 系统状态'),
        columns: [{ name: '指标', alignment: 'left' }, { name: '值', alignment: 'left' }]
      });
      t.addRow({ '指标': '数据库文件', '值': db.dbPath });
      t.addRow({ '指标': '数据库大小', '值': `${cap.sizeMB.toFixed(2)} MB / ${cap.sizeLimitMB} MB ${cap.overSize ? chalk.red('⚠超限') : ''}` });
      t.addRow({ '指标': '发票记录总数', '值': `${total} 张 / ${cap.recordLimit} 张 ${cap.overCount ? chalk.red('⚠超限') : ''}` });
      t.addRow({ '指标': '本月进项', '值': chalk.blue(`${monthSummary.input.count} 张 / ${monthSummary.input.total.toFixed(2)} 元`) });
      t.addRow({ '指标': '本月销项', '值': chalk.red(`${monthSummary.output.count} 张 / ${monthSummary.output.total.toFixed(2)} 元`) });
      t.addRow({ '指标': 'Node.js版本', '值': process.version });
      t.addRow({ '指标': '内存占用(Heap)', '值': `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB` });
      t.addRow({ '指标': '内存占用(RSS)', '值': `${(mem.rss / 1024 / 1024).toFixed(2)} MB` });
      t.printTable();
      if (cap.warnings && cap.warnings.length > 0) {
        for (const w of cap.warnings) {
          logger.warn(`[容量预警] ${w}`);
        }
      }
    } catch (e) {
      logger.error(`状态查询失败: ${e.message}`);
    }
  });

process.on('unhandledRejection', (err) => {
  logger.error(`未处理的异常: ${err.message}`);
  if (program.opts && program.opts().debug) console.error(err.stack);
  process.exitCode = 1;
});

program.parseAsync(process.argv).catch((err) => {
  logger.error(err.message);
  process.exitCode = 1;
});
