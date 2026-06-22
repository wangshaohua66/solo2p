const path = require('path');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const { Table } = require('console-table-printer');
const { writeToPath: writeCsv } = require('fast-csv');
const { getDB } = require('../lib/db');
const { getLogger } = require('../lib/logger');
const { formatAmount, formatAmountCN, sanitizeFileName } = require('../utils/format');

const TAX_DECLARE_ROWS = [
  { code: '1', label: '一、按适用税率计税销售额', section: '销售额', formula: 'output_amount' },
  { code: '2', label: '其中：应税货物销售额', section: '销售额', formula: 'output_amount_goods' },
  { code: '3', label: '应税劳务销售额', section: '销售额', formula: 'output_amount_service' },
  { code: '11', label: '销项税额', section: '税款计算', formula: 'output_tax' },
  { code: '12', label: '进项税额', section: '税款计算', formula: 'input_tax' },
  { code: '13', label: '上期留抵税额', section: '税款计算', formula: 'previous_remaining', defaultValue: 0 },
  { code: '14', label: '进项税额转出', section: '税款计算', formula: 'input_transfer_out' },
  { code: '15', label: '免、抵、退应退税额', section: '税款计算', formula: 'refund', defaultValue: 0 },
  { code: '16', label: '按适用税率计算的纳税检查应补缴税额', section: '税款计算', formula: 'check_pay', defaultValue: 0 },
  { code: '17', label: '应抵扣税额合计', section: '税款计算', formula: 'computed:12+13-14-15+16', computed: true },
  { code: '18', label: '实际抵扣税额', section: '税款计算', formula: 'computed:min(11,17)', computed: true },
  { code: '19', label: '应纳税额', section: '税款计算', formula: 'computed:11-18', computed: true },
  { code: '20', label: '期末留抵税额', section: '税款计算', formula: 'computed:17-18', computed: true },
  { code: '24', label: '应纳税额合计', section: '税款计算', formula: 'computed:19+21+23', computed: true, needsOthers: true },
  { code: '27', label: '本期已缴税额', section: '税款缴纳', formula: 'paid', defaultValue: 0 },
  { code: '32', label: '期末未缴税额', section: '税款缴纳', formula: 'computed:24-27-28-29+30+31', computed: true, needsOthers: true }
];

const ADJUSTMENT_NOTES = [
  { code: '1', note: '若存在不同税率(13%/9%/6%)需分行填写，请按税率拆分', priority: 'medium' },
  { code: '11', note: '销项税额需与增值税开票系统数据核对一致', priority: 'high' },
  { code: '12', note: '进项税额需与增值税发票综合服务平台勾选数据一致', priority: 'high' },
  { code: '14', note: '进项转出项目需人工确认：免税项目用、集体福利、非正常损失等', priority: 'high' },
  { code: '27', note: '本期已缴税额需人工录入预缴、分次预缴等数据', priority: 'medium' },
  { code: '*', note: '本草稿为预生成版本，申报前请务必人工复核数据准确性', priority: 'high' }
];

async function declare(options = {}) {
  const logger = getLogger();
  logger.section('增值税申报预生成');
  const db = getDB();
  const start = Date.now();

  const startDate = options.startDate;
  const endDate = options.endDate;
  if (!startDate || !endDate) {
    logger.warn('请指定申报期范围 (--start-date YYYY-MM-DD --end-date YYYY-MM-DD)');
    return { success: false };
  }

  const spinner = ora('汇总进销项数据...').start();
  const summary = db.getSummary(startDate, endDate);
  const stats = db.getInvoiceStats(startDate, endDate);
  const deductions = db.getDeductions(`${startDate}_${endDate}`);

  const inputTransferOut = deductions.filter(d => d.deduction_status === 'non-deductible')
    .reduce((s, d) => s + Number(d.deductible_amount ? 0 : (d.input_total ? 0 : 0)), 0);
  const deductibleTax = deductions.filter(d => d.deduction_status === 'deductible')
    .reduce((s, d) => s + Number(d.deductible_tax || 0), 0);

  const outputByRate = new Map();
  const outputAll = db.queryInvoices({ startDate, endDate, invoiceType: 'output', limit: 10000 });
  for (const inv of outputAll) {
    const rate = inv.tax_rate != null ? inv.tax_rate : 0;
    if (!outputByRate.has(rate)) outputByRate.set(rate, { amount: 0, tax: 0, count: 0 });
    const b = outputByRate.get(rate);
    b.amount += Number(inv.amount || 0);
    b.tax += Number(inv.tax || 0);
    b.count++;
  }

  const previousRemaining = Number(options.previousRemaining || 0);
  const values = {
    output_amount: summary.output.amount,
    output_amount_goods: summary.output.amount * 0.6,
    output_amount_service: summary.output.amount * 0.4,
    output_tax: summary.output.tax,
    input_tax: summary.input.tax,
    input_transfer_out: summary.input.tax - (deductibleTax || summary.input.tax),
    previous_remaining: previousRemaining,
    refund: 0, check_pay: 0, paid: 0
  };

  const computedRows = [];
  const codeToValue = {};

  for (const row of TAX_DECLARE_ROWS) {
    let value = 0;
    let manual = false;
    let note = '';

    if (row.computed) {
      const expr = row.formula.replace('computed:', '');
      try {
        if (expr.startsWith('min(')) {
          const parts = expr.substring(4, expr.length - 1).split(',').map(s => {
            const c = s.trim();
            return codeToValue[c] || 0;
          });
          value = Math.min(...parts);
        } else {
          const tokens = expr.split(/([+\-])/).map(s => s.trim()).filter(Boolean);
          let result = 0;
          let op = '+';
          for (const token of tokens) {
            if (token === '+' || token === '-') { op = token; continue; }
            const v = codeToValue[token] || 0;
            result = op === '+' ? result + v : result - v;
          }
          value = Number(result.toFixed(2));
        }
      } catch (e) { value = 0; manual = true; note = '公式计算失败，需人工计算'; }
    } else if (row.formula && values[row.formula] !== undefined) {
      value = Number(values[row.formula] || 0);
      if (row.defaultValue !== undefined && value === 0) {
        value = Number(row.defaultValue);
        manual = true;
        note = '默认值为0，需人工确认';
      }
    } else if (row.defaultValue !== undefined) {
      value = Number(row.defaultValue);
      manual = true;
      note = '需人工录入';
    }

    codeToValue[row.code] = value;
    const adj = ADJUSTMENT_NOTES.find(n => n.code === row.code || n.code === '*');
    if (adj && !note) note = adj.note;
    computedRows.push({
      line: row.code,
      item: row.label,
      section: row.section,
      amount: value,
      manual,
      note,
      priority: adj ? adj.priority : 'low'
    });
  }

  const payableTax = codeToValue['19'] || 0;
  const dur = Date.now() - start;
  spinner.succeed(`申报表草稿生成完成 (${dur}ms)`);
  logger.success('申报预生成完成', { operation: 'DECLARE', durationMs: dur });

  const outputDir = options.outputDir || path.resolve(process.cwd(), 'data', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const baseName = sanitizeFileName(`增值税申报表_${startDate}_${endDate}`);

  const csvRows = [
    ['增值税纳税申报表（适用于一般纳税人）草稿'],
    ['申报期', `${startDate} 至 ${endDate}`],
    ['生成时间', new Date().toLocaleString()],
    [],
    ['栏次', '项目', '栏次', '一般项目（本月数）', '即征即退项目', '是否需人工复核', '备注说明']
  ];
  for (const r of computedRows) {
    csvRows.push([
      r.line, r.item, r.line, formatAmount(r.amount), '',
      r.manual ? '是' : '建议复核',
      r.note || ''
    ]);
  }
  csvRows.push([]);
  csvRows.push(['—按税率拆分销项明细（供参考）—']);
  csvRows.push(['税率', '发票张数', '不含税金额', '销项税额', '价税合计']);
  for (const [rate, b] of outputByRate.entries()) {
    csvRows.push([
      (rate * 100).toFixed(0) + '%',
      b.count,
      formatAmount(b.amount),
      formatAmount(b.tax),
      formatAmount(b.amount + b.tax)
    ]);
  }
  csvRows.push([]);
  csvRows.push(['— 人工复核提示 —']);
  for (const n of ADJUSTMENT_NOTES) {
    csvRows.push([n.priority === 'high' ? '【重要】' : (n.priority === 'medium' ? '【注意】' : '【提示】'),
      `栏次 ${n.code}: ${n.note}`, '', '', '']);
  }

  const csvPath = path.join(outputDir, `${baseName}.csv`);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(csvPath, 'utf8');
    ws.write('\uFEFF');
    for (const row of csvRows) {
      const line = row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\r\n';
      ws.write(line);
    }
    ws.end();
    ws.on('finish', resolve);
    ws.on('error', reject);
  });

  const dt = new Table({
    title: chalk.bold(`📄 增值税申报表（申报期: ${startDate} ~ ${endDate}）草稿预览`),
    columns: [
      { name: '栏次', alignment: 'center' },
      { name: '项目', alignment: 'left' },
      { name: '金额(元)', alignment: 'right' },
      { name: '状态', alignment: 'center' },
      { name: '复核提示', alignment: 'left' }
    ]
  });
  for (const r of computedRows) {
    const color = r.manual ? (r.priority === 'high' ? 'crimson' : 'yellow') : 'green';
    const status = r.manual ? '✋ 需人工' : '✓ 已预填';
    dt.addRow({
      '栏次': r.line,
      '项目': r.item,
      '金额(元)': formatAmount(r.amount),
      '状态': status,
      '复核提示': (r.note || '').toString().substring(0, 20)
    }, { color });
  }
  dt.printTable();

  const rt = new Table({
    title: chalk.bold('📊 按税率销项明细'),
    columns: [{ name: '税率', alignment: 'center' }, { name: '张数', alignment: 'right' }, { name: '金额', alignment: 'right' }, { name: '税额', alignment: 'right' }]
  });
  for (const [rate, b] of outputByRate.entries()) {
    rt.addRow({ '税率': (rate * 100).toFixed(0) + '%', '张数': b.count, '金额': formatAmount(b.amount), '税额': formatAmount(b.tax) });
  }
  rt.printTable();

  console.log('');
  logger.info(`📁 已输出申报表草稿CSV: ${chalk.green(csvPath)}`);
  logger.info(chalk.yellow.bold('⚠ 重要提示: 本文件为预生成草稿，请人工核对所有数据，确认无误后再导入税务申报系统'));
  console.log('');

  return {
    success: true,
    period: `${startDate}_${endDate}`,
    payableTax,
    outputTax: summary.output.tax,
    deductibleInputTax: deductibleTax || summary.input.tax,
    previousRemaining,
    transferOut: values.input_transfer_out,
    csvPath,
    records: computedRows,
    durationMs: dur
  };
}

module.exports = { declare, TAX_DECLARE_ROWS, ADJUSTMENT_NOTES };
