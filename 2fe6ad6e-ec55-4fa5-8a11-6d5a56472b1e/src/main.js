#!/usr/bin/env node
'use strict';

/**
 * 任务调度入口（main.js）
 * 职责：
 *  1) 按银行并行编排：登录 -> 导出 -> 解析 -> 核对 四阶段
 *  2) 进度条（cli-progress 多条）+ 阶段日志
 *  3) 单银行超时（5分钟）、全局超时（20分钟）、解析核对（3分钟）约束
 *  4) 汇总核对结果表格输出 + 月度报告推送
 *
 * 用法：
 *   node src/main.js                  # 全量运行所有银行（真实网银）
 *   node src/main.js --mock           # 模拟模式（无需网银，生成样本数据联调）
 *   node src/main.js --bank ICBC       # 仅运行指定银行
 *   node src/main.js --month 2026-05   # 指定核对月份
 *   node src/main.js --mock --concurrency 4
 */

const chalk = require('chalk');
const cliProgress = require('cli-progress');

const config = require('./utils/config');
const logger = require('./utils/logger');
const db = require('./utils/db');
const browser = require('./utils/browser');
const auth = require('./auth/handler');
const navigator = require('./navigator/flow');
const extractor = require('./extractor');
const mapper = require('./normalizer/mapper');
const engine = require('./reconciler/engine');
const notifier = require('./notifier/alert');
const generator = require('./mock/generator');

// ---------------------------------------------------------------- 参数解析
function parseArgs(argv) {
  const args = { bank: null, month: null, mock: false, concurrency: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bank') args.bank = argv[++i];
    else if (a === '--month') args.month = argv[++i];
    else if (a === '--mock') args.mock = true;
    else if (a === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') {
      printHelp(); process.exit(0);
    }
  }
  if (process.env.MOCK === '1') args.mock = true;
  if (!args.month) args.month = defaultMonth();
  return args;
}

function defaultMonth() {
  // 默认上月
  const d = new Date();
  d.setDate(0); // 上月最后一天
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function printHelp() {
  console.log(chalk.cyan(`
公积金多银行还款流水自动化核对系统
用法: node src/main.js [options]
  --bank <CODE>      仅运行指定银行（如 ICBC）
  --month <YYYY-MM>  指定核对月份（默认上月）
  --mock             模拟模式：生成样本数据，跳过真实网银
  --concurrency <N>  并行银行数（默认全部）
  -h, --help         显示帮助
`));
}

// ---------------------------------------------------------------- 工具
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function withTimeout(promise, ms, msg) {
  let timer;
  const to = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg || `超时 ${ms}ms`)), ms);
  });
  return Promise.race([promise, to]).finally(() => clearTimeout(timer));
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur], cur);
    }
  });
  await Promise.all(runners);
  return results;
}

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------- 单银行流水线
async function runBank(bank, ctx) {
  const { runId, month, mock, bars } = ctx;
  const def = config.getDefaults();
  const bankTimeout = Number(def.bank_timeout || 300000);
  const bar = bars[bank.code];

  try {
    return await withTimeout(runBankInner(bank, ctx), bankTimeout, `银行 ${bank.code} 超时(${bankTimeout}ms)`);
  } catch (e) {
    logger.error(`银行 ${bank.code} 流程失败: ${e.message}`, `[${bank.code}]`);
    if (bar) bar.update(4, { bank: pad(bank.code, 8), stage: '失败' });
    return { bank: bank.code, success: false, error: e.message, count: 0, summary: null };
  }
}

async function runBankInner(bank, ctx) {
  const { runId, month, mock, bars } = ctx;
  const bar = bars[bank.code];
  let session = null;

  // 阶段1：登录
  logger.stage(bank.code, '登录中');
  if (bar) bar.update(1, { bank: pad(bank.code, 8), stage: '登录中' });

  let file;
  if (mock) {
    file = generator.generateStatement(bank, month);
    await sleep(120);
  } else {
    session = await browser.createSession(bank.code);
    const loginRes = await auth.login(bank, session.driver, session);
    if (!loginRes.success) {
      await browser.quit(session.driver);
      return { bank: bank.code, success: false, error: '登录失败: ' + loginRes.error, count: 0, summary: null };
    }

    // 阶段2：导出
    logger.stage(bank.code, '导出中');
    if (bar) bar.update(2, { bank: pad(bank.code, 8), stage: '导出中' });
    const navRes = await navigator.navigateAndExport(bank, session.driver, session);
    await browser.quit(session.driver);
    session = null;
    if (!navRes.success) {
      if (navRes.flagged) await notifier.alertOpsBankChange(bank.code, navRes.error || '页面结构变更');
      return { bank: bank.code, success: false, error: '导出失败: ' + navRes.error, count: 0, summary: null };
    }
    file = navRes.file;
  }

  // 阶段3：解析
  logger.stage(bank.code, '解析中');
  if (bar) bar.update(3, { bank: pad(bank.code, 8), stage: '解析中' });
  const tParse = Date.now();
  const extracted = await extractor.extract(file, bank);
  const records = mapper.normalize(extracted.rows, bank, runId);
  if (records.length) await db.insertRecords(records);
  logger.debug(`[${bank.code}] 解析 ${records.length} 条，耗时 ${Date.now() - tParse}ms`, `[${bank.code}]`);

  // 阶段4：核对（实时告警）
  logger.stage(bank.code, '核对中');
  if (bar) bar.update(4, { bank: pad(bank.code, 8), stage: '核对中' });
  const tRecon = Date.now();
  const { summary } = await engine.reconcile(records, {
    runId, month, onException: notifier.alertException,
  });
  logger.debug(`[${bank.code}] 核对耗时 ${Date.now() - tRecon}ms`, `[${bank.code}]`);

  if (bar) bar.update(4, { bank: pad(bank.code, 8), stage: '完成' });
  return { bank: bank.code, success: true, error: null, count: records.length, summary };
}

// ---------------------------------------------------------------- 汇总
function aggregate(results) {
  const summary = {
    total: 0, matched: 0, overdue: 0, partial: 0, early: 0, rate_change: 0, unmatched: 0,
    overdueAmount: 0, partialAmount: 0, byBank: {},
    bankResults: [],
  };
  for (const r of results) {
    summary.bankResults.push(r);
    if (!r.success || !r.summary) continue;
    const s = r.summary;
    summary.total += s.total;
    summary.matched += s.matched;
    summary.overdue += s.overdue;
    summary.partial += s.partial;
    summary.early += s.early;
    summary.rate_change += s.rate_change;
    summary.unmatched += s.unmatched;
    summary.overdueAmount += s.overdueAmount || 0;
    summary.partialAmount += s.partialAmount || 0;
    for (const [code, bs] of Object.entries(s.byBank || {})) {
      summary.byBank[code] = summary.byBank[code] || { total: 0, matched: 0, exceptions: 0, dueTotal: 0, actualTotal: 0 };
      summary.byBank[code].total += bs.total;
      summary.byBank[code].matched += bs.matched;
      summary.byBank[code].exceptions += bs.exceptions;
      summary.byBank[code].dueTotal += bs.dueTotal || 0;
      summary.byBank[code].actualTotal += bs.actualTotal || 0;
    }
  }
  summary.overdueAmount = Math.round(summary.overdueAmount * 100) / 100;
  summary.partialAmount = Math.round(summary.partialAmount * 100) / 100;
  return summary;
}

function printSummaryTable(results, summary) {
  console.log('\n' + chalk.bgBlue.white.bold('  公积金还款核对结果汇总  '));
  console.log(chalk.gray('─'.repeat(78)));

  const header = [
    pad('银行', 8), pad('状态', 6), pad('笔数', 8),
    pad('逾期', 6), pad('部分', 6), pad('提前', 6), pad('利率调整', 8), pad('未匹配', 8),
  ].join(' ');
  console.log(chalk.bold(header));
  console.log(chalk.gray('─'.repeat(78)));

  for (const r of results) {
    const s = r.summary || {};
    const status = r.success ? chalk.green('成功') : chalk.red('失败');
    const row = [
      pad(r.bank, 8),
      pad(status, 6),
      pad(r.count || 0, 8),
      pad(s.overdue || 0, 6),
      pad(s.partial || 0, 6),
      pad(s.early || 0, 6),
      pad(s.rate_change || 0, 8),
      pad(s.unmatched || 0, 8),
    ].join(' ');
    console.log(row);
    if (r.error) console.log(chalk.red(`     └ ${r.error}`));
  }
  console.log(chalk.gray('─'.repeat(78)));
  console.log(chalk.bold(
    pad('合计', 8) + ' ' + pad('', 6) + ' ' + pad(summary.total, 8) + ' ' +
    pad(summary.overdue, 6) + ' ' + pad(summary.partial, 6) + ' ' +
    pad(summary.early, 6) + ' ' + pad(summary.rate_change, 8) + ' ' + pad(summary.unmatched, 8)
  ));
  console.log(chalk.gray('─'.repeat(78)));
  console.log(chalk.red.bold(`逾期未还金额合计: ${fmtMoney(summary.overdueAmount)} 元`));
  console.log(chalk.yellow.bold(`部分还款差额合计: ${fmtMoney(summary.partialAmount)} 元`));
  console.log();
}

function pad(v, w) {
  const s = String(v);
  // 中文宽度近似：每个中文算2列
  let width = 0;
  for (const ch of s) width += /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1;
  const fill = Math.max(0, w - width);
  return s + ' '.repeat(fill);
}

// ---------------------------------------------------------------- 主流程
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = `RUN-${Date.now()}`;
  const banks = args.bank ? [config.getBank(args.bank)] : config.getBanks();
  const def = config.getDefaults();
  const globalTimeout = Number(def.global_timeout || 1200000);

  logger.success(`启动核对任务 运行ID=${runId} 月份=${args.month} 银行数=${banks.length} 模拟=${args.mock}`);
  db.open();
  await db.clearRun(runId);

  if (args.mock) {
    await generator.seedPlans(args.month);
    logger.info('模拟模式：已生成样本应还计划');
  }

  // 进度条
  const multibar = new cliProgress.MultiBar({
    format: ' {bank} |{bar}| {stage} ({value}/4)',
    hideCursor: true, clearOnComplete: false,
    barCompleteChar: '█', barIncompleteChar: '░',
  }, cliProgress.Presets.shades_grey);
  const bars = {};
  banks.forEach((b) => {
    bars[b.code] = multibar.create(4, 0, { bank: pad(b.code, 8), stage: '初始化' });
  });

  const ctx = { runId, month: args.month, mock: args.mock, bars };
  const concurrency = args.concurrency || Number(process.env.BANK_CONCURRENCY) || banks.length;

  const tStart = Date.now();
  let results;
  try {
    results = await withTimeout(
      runWithConcurrency(banks, concurrency, (bank) => runBank(bank, ctx)),
      globalTimeout,
      `全局超时(${globalTimeout}ms)`
    );
  } catch (e) {
    logger.error(`全局流程异常: ${e.message}`);
    results = banks.map((b) => bars[b.code] && ({ bank: b.code, success: false, error: e.message, count: 0, summary: null }));
    results = (results || []).filter(Boolean);
  }

  multibar.stop();

  const summary = aggregate(results);
  // 月度报告
  try {
    const reportFile = await notifier.sendMonthlyReport(runId, summary, args.month);
    if (reportFile) logger.success(`月度报告已生成/发送: ${reportFile}`);
  } catch (e) {
    logger.error(`月度报告生成失败: ${e.message}`);
  }

  printSummaryTable(results, summary);

  logger.success(`全部完成，总耗时 ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
  await db.close();
}

main().catch((e) => {
  logger.error(`致命错误: ${e.stack || e.message}`);
  process.exit(1);
});
