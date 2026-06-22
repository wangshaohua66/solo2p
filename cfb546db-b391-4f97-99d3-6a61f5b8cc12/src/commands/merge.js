const path = require('path');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const { Table } = require('console-table-printer');
const ExcelJS = require('exceljs');
const { writeToPath: writeCsv } = require('fast-csv');
const { getDB } = require('../lib/db');
const { getLogger } = require('../lib/logger');
const { formatAmount, formatDate, sanitizeFileName, generateInvoiceKey } = require('../utils/format');
const { getPlatformName } = require('./aggregate');
const { PerformanceTimer, PERFORMANCE_LIMITS, logMemorySnapshot } = require('../lib/monitor');

const INVOICE_TYPE_NAMES = {
  input: '进项',
  output: '销项',
  unknown: '未分类'
};

function getTypeName(t) { return INVOICE_TYPE_NAMES[t] || t; }

function deduplicateInvoices(records) {
  const seen = new Map();
  const dupList = [];
  for (const r of records) {
    const key = r.invoice_key || generateInvoiceKey(r.invoice_code, r.invoice_number);
    if (seen.has(key)) {
      dupList.push({ ...r, _dupOf: seen.get(key).id });
    } else {
      seen.set(key, r);
    }
  }
  return { unique: Array.from(seen.values()), duplicates: dupList };
}

async function writeOutputCsv(records, filePath) {
  const rows = records.map(r => ({
    '序号': r.row_num,
    '发票代码': r.invoice_code || '',
    '发票号码': r.invoice_number || '',
    '开票日期': r.invoice_date || '',
    '购买方名称': r.buyer_name || '',
    '购买方税号': r.buyer_tax_id || '',
    '销售方名称': r.seller_name || '',
    '销售方税号': r.seller_tax_id || '',
    '不含税金额(元)': formatAmount(r.amount),
    '税额(元)': formatAmount(r.tax),
    '价税合计(元)': formatAmount(r.total),
    '税率': r.tax_rate != null ? (r.tax_rate * 100).toFixed(2) + '%' : '',
    '发票类型': getTypeName(r.invoice_type),
    '来源平台': getPlatformName(r.platform),
    '是否有效': r.is_valid ? '是' : '否'
  }));
  return new Promise((resolve, reject) => {
    writeCsv(rows, { headers: true, includeEndRowDelimiter: true, writeBOM: true })
      .pipe(fs.createWriteStream(filePath, 'utf8'))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function writeOutputExcel(records, filePath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('合并发票');
  ws.columns = [
    { header: '序号', key: 'idx', width: 8 },
    { header: '发票代码', key: 'code', width: 16 },
    { header: '发票号码', key: 'number', width: 16 },
    { header: '开票日期', key: 'date', width: 14 },
    { header: '购买方名称', key: 'buyer', width: 30 },
    { header: '销售方名称', key: 'seller', width: 30 },
    { header: '不含税金额', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
    { header: '税额', key: 'tax', width: 12, style: { numFmt: '#,##0.00' } },
    { header: '价税合计', key: 'total', width: 14, style: { numFmt: '#,##0.00' } },
    { header: '税率', key: 'rate', width: 10 },
    { header: '类型', key: 'type', width: 8 },
    { header: '来源平台', key: 'platform', width: 16 }
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  records.forEach((r, i) => {
    ws.addRow({
      idx: i + 1,
      code: r.invoice_code || '',
      number: r.invoice_number || '',
      date: r.invoice_date || '',
      buyer: r.buyer_name || '',
      seller: r.seller_name || '',
      amount: Number(r.amount || 0),
      tax: Number(r.tax || 0),
      total: Number(r.total || 0),
      rate: r.tax_rate != null ? (r.tax_rate * 100).toFixed(2) + '%' : '',
      type: getTypeName(r.invoice_type),
      platform: getPlatformName(r.platform)
    });
  });

  ws.eachRow((row, rowNum) => {
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell('amount').alignment = { horizontal: 'right' };
    row.getCell('tax').alignment = { horizontal: 'right' };
    row.getCell('total').alignment = { horizontal: 'right' };
    row.getCell('date').alignment = { horizontal: 'center' };
    row.getCell('idx').alignment = { horizontal: 'center' };
    if (rowNum > 1 && rowNum % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    }
  });

  const totals = ['合计', '', '', '', '', '',
    records.reduce((s, r) => s + Number(r.amount || 0), 0),
    records.reduce((s, r) => s + Number(r.tax || 0), 0),
    records.reduce((s, r) => s + Number(r.total || 0), 0),
    '', '', ''];
  const tr = ws.addRow(totals);
  tr.font = { bold: true };
  tr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };

  await wb.xlsx.writeFile(filePath);
}

async function query(options = {}) {
  const logger = getLogger();
  logger.section('发票查询');
  const db = getDB();
  const timer = new PerformanceTimer('发票查询(QUERY)', PERFORMANCE_LIMITS.QUERY, logger);
  timer.startMemoryWatch();

  const queryOptions = {
    startDate: options.startDate || null,
    endDate: options.endDate || null,
    invoiceType: options.type || 'all',
    platform: options.platform || 'all',
    merchantName: options.merchant || null,
    invoiceNumber: options.number || null,
    exactMatch: options.exact || false,
    minAmount: options.minAmount != null ? Number(options.minAmount) : null,
    maxAmount: options.maxAmount != null ? Number(options.maxAmount) : null,
    limit: options.limit != null ? Number(options.limit) : 500
  };

  const records = db.queryInvoices(queryOptions);
  const metrics = timer.stop(false);

  logger.info(`查询完成，共 ${records.length} 条记录`, { operation: 'QUERY', count: records.length, durationMs: metrics.elapsedMs });

  if (records.length === 0) {
    logger.warn('未查询到符合条件的发票记录');
    return { success: true, count: 0, records: [] };
  }

  const display = records.slice(0, 200);
  const t = new Table({
    title: chalk.bold(`🔍 查询结果 (共 ${records.length} 条${records.length > 200 ? ', 显示前200' : ''})`),
    columns: [
      { name: '#', alignment: 'right', color: 'gray' },
      { name: '发票号码', alignment: 'left' },
      { name: '开票日期', alignment: 'center' },
      { name: '类型', alignment: 'center' },
      { name: '购买方', alignment: 'left' },
      { name: '销售方', alignment: 'left' },
      { name: '金额(元)', alignment: 'right' },
      { name: '税额(元)', alignment: 'right' },
      { name: '价税合计(元)', alignment: 'right' },
      { name: '来源', alignment: 'left' }
    ]
  });
  display.forEach((r, i) => {
    t.addRow({
      '#': i + 1,
      '发票号码': r.invoice_number || '',
      '开票日期': r.invoice_date || '',
      '类型': getTypeName(r.invoice_type),
      '购买方': (r.buyer_name || '').substring(0, 10),
      '销售方': (r.seller_name || '').substring(0, 10),
      '金额(元)': formatAmount(r.amount),
      '税额(元)': formatAmount(r.tax),
      '价税合计(元)': formatAmount(r.total),
      '来源': getPlatformName(r.platform)
    });
  });
  t.printTable();

  return { success: true, count: records.length, records, durationMs: metrics.elapsedMs };
}

async function merge(options = {}) {
  const logger = getLogger();
  logger.section('发票合并');
  const db = getDB();
  const timer = new PerformanceTimer('发票合并(MERGE)', PERFORMANCE_LIMITS.MERGE, logger);
  timer.startMemoryWatch();

  const startDate = options.startDate;
  const endDate = options.endDate;

  if (!startDate || !endDate) {
    logger.warn('请指定日期范围 (--start-date YYYY-MM-DD --end-date YYYY-MM-DD)');
    timer.stop();
    return { success: false };
  }

  const queryOptions = {
    startDate,
    endDate,
    invoiceType: options.type || 'all',
    platform: options.platform || 'all',
    merchantName: options.merchant || null
  };

  const spinner = ora('查询数据库...').start();
  const rawRecords = db.queryInvoices(queryOptions);
  timer.checkPerformance();
  spinner.text = `查询到 ${rawRecords.length} 条记录，正在去重合并...`;

  const { unique, duplicates } = deduplicateInvoices(rawRecords);
  unique.forEach((r, i) => { r.row_num = i + 1; });
  const metrics = timer.stop(false);
  spinner.succeed(`合并完成`);

  logger.success('合并任务完成', { operation: 'MERGE', count: unique.length, durationMs: metrics.elapsedMs });

  const ct = new Table({
    title: chalk.bold('📋 合并统计'),
    columns: [
      { name: '指标', alignment: 'left' },
      { name: '数量', alignment: 'right' },
      { name: '金额合计(元)', alignment: 'right' },
      { name: '税额合计(元)', alignment: 'right' },
      { name: '价税合计(元)', alignment: 'right' }
    ]
  });
  const sum = (arr, k) => arr.reduce((s, r) => s + Number(r[k] || 0), 0);
  ct.addRow({ '指标': '合并前记录', '数量': rawRecords.length, '金额合计(元)': formatAmount(sum(rawRecords, 'amount')), '税额合计(元)': formatAmount(sum(rawRecords, 'tax')), '价税合计(元)': formatAmount(sum(rawRecords, 'total')) });
  ct.addRow({ '指标': '去除重复', '数量': duplicates.length, '金额合计(元)': formatAmount(sum(duplicates, 'amount')), '税额合计(元)': formatAmount(sum(duplicates, 'tax')), '价税合计(元)': formatAmount(sum(duplicates, 'total')) }, { color: 'yellow' });
  ct.addRow({ '指标': '合并后记录', '数量': unique.length, '金额合计(元)': formatAmount(sum(unique, 'amount')), '税额合计(元)': formatAmount(sum(unique, 'tax')), '价税合计(元)': formatAmount(sum(unique, 'total')) }, { color: 'green' });
  ct.printTable();

  const outputDir = options.outputDir || path.resolve(process.cwd(), 'data', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const baseName = sanitizeFileName(`发票合并_${startDate}_${endDate}`);
  const formats = options.format || 'csv';
  const outputs = [];

  const writeSpinner = ora('生成输出文件...').start();
  try {
    if (formats.includes('csv') || formats === 'all') {
      const csvPath = path.join(outputDir, `${baseName}.csv`);
      await writeOutputCsv(unique, csvPath);
      outputs.push({ format: 'CSV', path: csvPath });
    }
    if (formats.includes('excel') || formats.includes('xlsx') || formats === 'all') {
      const xlsxPath = path.join(outputDir, `${baseName}.xlsx`);
      await writeOutputExcel(unique, xlsxPath);
      outputs.push({ format: 'Excel', path: xlsxPath });
    }
  } catch (e) {
    writeSpinner.fail(`文件输出失败: ${e.message}`);
  }
  writeSpinner.succeed(`已生成 ${outputs.length} 个文件`);

  const ot = new Table({
    title: chalk.bold('💾 输出文件'),
    columns: [{ name: '格式', alignment: 'left' }, { name: '文件路径', alignment: 'left' }]
  });
  outputs.forEach(o => ot.addRow({ '格式': o.format, '文件路径': o.path }));
  ot.printTable();

  return {
    success: true,
    beforeCount: rawRecords.length,
    afterCount: unique.length,
    duplicateCount: duplicates.length,
    outputs,
    durationMs: metrics.elapsedMs,
    records: unique
  };
}

module.exports = { merge, query, deduplicateInvoices, writeOutputCsv, writeOutputExcel, getTypeName };
