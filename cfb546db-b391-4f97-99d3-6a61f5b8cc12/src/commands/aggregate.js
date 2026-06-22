const path = require('path');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const { Table } = require('console-table-printer');
const { parseFile, scanDirectory } = require('../lib/parser');
const { getDB, PLATFORMS } = require('../lib/db');
const { getLogger } = require('../lib/logger');
const { formatAmountCN, formatDateTime, truncate } = require('../utils/format');
const { PerformanceTimer, PERFORMANCE_LIMITS, logMemorySnapshot } = require('../lib/monitor');

const PLATFORM_NAMES = {
  [PLATFORMS.HANGXIN]: '航信开票系统',
  [PLATFORMS.BAIWANG]: '百望开票系统',
  [PLATFORMS.TENCENT]: '腾讯电子发票',
  [PLATFORMS.ALIPAY]: '支付宝发票管家',
  [PLATFORMS.JD]: '京东商家后台',
  [PLATFORMS.TMALL]: '天猫商家中心',
  [PLATFORMS.UNKNOWN]: '未知平台'
};

function getPlatformName(p) { return PLATFORM_NAMES[p] || p; }

async function aggregate(options = {}) {
  const logger = getLogger();
  const timer = new PerformanceTimer('发票归集(AGGREGATE)', PERFORMANCE_LIMITS.AGGREGATE, logger);
  timer.startMemoryWatch(200);
  logger.section('发票归集');

  let inputDir = options.dir;
  let platform = options.platform || 'auto';
  let merchantName = options.merchant || null;
  let forceImport = options.force || false;

  if (!inputDir) {
    logger.warn('请提供导入目录路径 (--dir <路径>)');
    timer.stop();
    return { success: false };
  }

  inputDir = path.resolve(inputDir);
  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    logger.error(`目录不存在: ${inputDir}`);
    timer.stop();
    return { success: false };
  }

  const platformValue = platform === 'auto' ? null : platform;
  const db = getDB();

  const capCheck = db.checkCapacity();
  if (capCheck.overSize || capCheck.overCount) {
    logger.warn(`导入前容量检查: 文件 ${capCheck.sizeMB.toFixed(2)}MB, 记录 ${capCheck.recordCount}条`, { operation: 'DB_CAPACITY' });
  }

  const files = scanDirectory(inputDir, { recursive: true });
  logger.info(`扫描目录: ${chalk.cyan(inputDir)}`, { count: files.length, operation: 'SCAN' });

  if (files.length === 0) {
    logger.warn('未找到可解析的发票文件 (支持 .xml/.json/.csv/.xlsx/.xls/.txt)');
    timer.stop();
    return { success: true, files: 0 };
  }

  const spinner = ora(`解析 0/${files.length} 个文件...`).start();
  const parseResults = [];
  const parseErrors = [];
  const totalRecords = [];
  const MAX_RECORDS = 5000;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await parseFile(file, platformValue);
      parseResults.push(result);
      totalRecords.push(...result.records);
      spinner.text = `解析 ${i + 1}/${files.length} 个文件... 已发现 ${totalRecords.length} 条记录`;
    } catch (e) {
      parseErrors.push({ file, error: e.message });
    }
    if (totalRecords.length >= MAX_RECORDS) break;
    if ((i + 1) % 10 === 0) timer.checkPerformance();
  }
  spinner.succeed(`解析完成: ${chalk.green(parseResults.length)} 个文件, ${chalk.cyan(totalRecords.length)} 条记录`);

  if (parseErrors.length > 0) {
    logger.warn(`${parseErrors.length} 个文件解析失败`, { details: parseErrors.slice(0, 5).map(e => e.file).join(', ') });
  }

  if (totalRecords.length === 0) {
    logger.warn('未解析到有效发票记录');
    timer.stop();
    return { success: true, files: files.length, records: 0 };
  }

  logMemorySnapshot('解析完成', logger);

  const enforceResult = db.enforceCapacity(totalRecords.length);
  if (enforceResult.overSize || enforceResult.overCount) {
    timer.stop();
    return { success: false, files: files.length, records: totalRecords.length, capacityError: enforceResult.warnings };
  }

  const totalBefore = totalRecords.length;
  let validRecords = totalRecords;
  if (!forceImport) {
    validRecords = totalRecords.filter(r => r.isValid);
  }
  const invalidCount = totalRecords.length - validRecords.length;

  const summary = {
    byPlatform: {},
    byType: { input: 0, output: 0, unknown: 0 },
    totalAmount: 0, totalTax: 0, totalValue: 0
  };
  for (const r of validRecords) {
    summary.byPlatform[r.platform] = (summary.byPlatform[r.platform] || 0) + 1;
    summary.byType[r.invoiceType] = (summary.byType[r.invoiceType] || 0) + 1;
    summary.totalAmount += Number(r.amount || 0);
    summary.totalTax += Number(r.tax || 0);
    summary.totalValue += Number(r.total || 0);
  }

  const insertSpinner = ora(`正在写入数据库... 0/${validRecords.length}`).start();
  const BATCH = 200;
  const dbResult = { success: 0, duplicate: 0, failed: 0, errors: [] };

  for (let i = 0; i < validRecords.length; i += BATCH) {
    const batch = validRecords.slice(i, i + BATCH);
    const r = db.batchInsertInvoices(batch, merchantName);
    dbResult.success += r.success;
    dbResult.duplicate += r.duplicate;
    dbResult.failed += r.failed;
    if (r.errors) dbResult.errors.push(...r.errors);
    insertSpinner.text = `正在写入数据库... ${Math.min(i + BATCH, validRecords.length)}/${validRecords.length}`;
    timer.checkPerformance();
  }
  insertSpinner.succeed(`入库完成`);

  const metrics = timer.stop(false);
  db.logImport(inputDir, platformValue,
    { total: totalRecords.length, success: dbResult.success, duplicate: dbResult.duplicate, failed: dbResult.failed + invalidCount },
    metrics.elapsedMs, dbResult.errors);

  logger.success('归集任务完成', { operation: 'AGGREGATE', count: dbResult.success, durationMs: metrics.elapsedMs });

  const pt = new Table({
    title: chalk.bold('📊 归集结果汇总'),
    columns: [
      { name: '指标', alignment: 'left', color: 'white' },
      { name: '数量', alignment: 'right', color: 'cyan' },
      { name: '说明', alignment: 'left', color: 'gray' }
    ]
  });
  pt.addRow({ '指标': '扫描文件数', '数量': files.length, '说明': '' });
  pt.addRow({ '指标': '成功解析文件', '数量': parseResults.length, '说明': '' });
  pt.addRow({ '指标': '解析记录总数', '数量': totalRecords.length, '说明': '' });
  pt.addRow({ '指标': '✓ 校验通过', '数量': validRecords.length, '说明': '' }, { color: 'green' });
  pt.addRow({ '指标': '✗ 校验失败', '数量': invalidCount, '说明': '字段缺失或格式错误' }, { color: 'red' });
  pt.addRow({ '指标': '✓ 成功入库', '数量': dbResult.success, '说明': '' }, { color: 'green' });
  pt.addRow({ '指标': '⊘ 重复跳过', '数量': dbResult.duplicate, '说明': '按发票代码+号码去重' }, { color: 'yellow' });
  pt.addRow({ '指标': '✗ 入库失败', '数量': dbResult.failed, '说明': '' }, { color: 'red' });
  pt.printTable();

  const plt = new Table({
    title: chalk.bold('🏢 平台分布'),
    columns: [
      { name: '平台', alignment: 'left' },
      { name: '数量', alignment: 'right' },
      { name: '占比', alignment: 'right' }
    ]
  });
  const total = validRecords.length || 1;
  for (const [p, c] of Object.entries(summary.byPlatform)) {
    plt.addRow({ '平台': getPlatformName(p), '数量': c, '占比': ((c / total) * 100).toFixed(1) + '%' });
  }
  plt.printTable();

  console.log('');
  logger.info(`金额合计: ${chalk.green(formatAmountCN(summary.totalValue))}  (不含税: ${formatAmountCN(summary.totalAmount)}, 税额: ${formatAmountCN(summary.totalTax)})`);
  logger.info(`进项: ${summary.byType.input} 张 | 销项: ${summary.byType.output} 张 | 未分类: ${summary.byType.unknown} 张`);
  console.log('');

  if (invalidCount > 0) {
    const failedSample = totalRecords.filter(r => !r.isValid).slice(0, 10);
    const ft = new Table({
      title: chalk.yellow.bold('⚠ 校验失败明细 (前10条)'),
      columns: [
        { name: '发票号', alignment: 'left' },
        { name: '开票日期', alignment: 'center' },
        { name: '错误原因', alignment: 'left' },
        { name: '修复建议', alignment: 'left' }
      ]
    });
    for (const r of failedSample) {
      ft.addRow({
        '发票号': r.invoiceNumber || '(空)',
        '开票日期': r.invoiceDate || '-',
        '错误原因': truncate((r.validationErrors || []).join('; '), 50),
        '修复建议': truncate((r.suggestions || []).join('; '), 40)
      });
    }
    ft.printTable();
  }

  return {
    success: true,
    files: files.length,
    parsed: parseResults.length,
    totalRecords: totalRecords.length,
    validRecords: validRecords.length,
    imported: dbResult.success,
    duplicates: dbResult.duplicate,
    failed: dbResult.failed + invalidCount,
    durationMs: metrics.elapsedMs,
    peakMemoryMB: (metrics.peakMemoryBytes / 1024 / 1024).toFixed(2)
  };
}

module.exports = { aggregate, getPlatformName };
