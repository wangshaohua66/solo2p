const path = require('path');
const fs = require('fs');
const ora = require('ora');
const chalk = require('chalk');
const { Table } = require('console-table-printer');
const { writeToPath: writeCsv } = require('fast-csv');
const { getDB } = require('../lib/db');
const { getLogger } = require('../lib/logger');
const { formatAmount, formatAmountCN, sanitizeFileName } = require('../utils/format');
const { getTypeName } = require('./merge');
const { getPlatformName } = require('./aggregate');

const MAX_TAX_RATE = 0.13;

const NON_DEDUCTIBLE_KEYWORDS = [
  '福利', '集体福利', '个人消费', '招待', '餐饮', '娱乐', '贷款',
  '居民日常', '旅客运输', '免税项目', '简易计税', '免征', '非正常损失',
  '礼品', '招待费', '福利费', '职工福利', '捐赠'
];

function isNonDeductibleByContent(invoice) {
  const reasons = [];
  const text = `${invoice.buyer_name || ''} ${invoice.seller_name || ''} ${invoice.raw_data || ''}`;
  for (const kw of NON_DEDUCTIBLE_KEYWORDS) {
    if (text.includes(kw)) {
      reasons.push(`涉及"${kw}"属于不可抵扣范围`);
    }
  }
  if (invoice.tax_rate === 0) {
    reasons.push('税率为0，属于免税或零税率项目');
  }
  if (invoice.tax_rate && invoice.tax_rate > MAX_TAX_RATE) {
    reasons.push(`税率${(invoice.tax_rate * 100).toFixed(1)}%超过法定上限13%`);
  }
  return reasons;
}

function buildNameIndex(records, getKey) {
  const index = new Map();
  for (const r of records) {
    const key = (getKey(r) || '').trim();
    if (!key) continue;
    const normalized = key.replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '').toLowerCase();
    if (!index.has(normalized)) index.set(normalized, []);
    index.get(normalized).push(r);
  }
  return index;
}

function fuzzyMatch(name, index) {
  if (!name) return [];
  const normalized = name.replace(/[（(].*?[)）]/g, '').replace(/\s+/g, '').toLowerCase();
  const results = index.get(normalized) || [];
  if (results.length) return results;
  for (const [key, vals] of index.entries()) {
    if (key && (key.includes(normalized) || normalized.includes(key))) {
      if (Math.abs(key.length - normalized.length) < Math.max(key.length, normalized.length) * 0.3) {
        return vals;
      }
    }
  }
  return [];
}

async function deduct(options = {}) {
  const logger = getLogger();
  logger.section('抵扣计算');
  const db = getDB();
  const start = Date.now();

  const startDate = options.startDate;
  const endDate = options.endDate;
  if (!startDate || !endDate) {
    logger.warn('请指定申报期范围 (--start-date YYYY-MM-DD --end-date YYYY-MM-DD)');
    return { success: false };
  }
  const period = options.period || `${startDate}_${endDate}`;

  const spinner = ora('加载进销项发票数据...').start();
  const outputs = db.queryInvoices({ startDate, endDate, invoiceType: 'output', limit: 5000 });
  const inputs = db.queryInvoices({ startDate, endDate, invoiceType: 'input', limit: 5000 });
  spinner.text = `销项 ${outputs.length} 张, 进项 ${inputs.length} 张，正在匹配...`;

  const outputBuyerIndex = buildNameIndex(outputs, r => r.buyer_name);
  const deductionRecords = [];
  const unmatchedInputs = [];
  const matchedMap = new Set();

  for (const input of inputs) {
    const matches = fuzzyMatch(input.seller_name, outputBuyerIndex);
    const nonDeductReasons = isNonDeductibleByContent(input);

    if (matches.length > 0) {
      let deductRate = 1;
      let status = 'deductible';
      let reason = null;

      if (nonDeductReasons.length > 0) {
        status = 'non-deductible';
        deductRate = 0;
        reason = nonDeductReasons.join('; ');
      }

      for (const output of matches) {
        if (!matchedMap.has(output.id)) {
          matchedMap.add(output.id);
        }
        deductionRecords.push({
          period,
          outputInvoiceId: output.id,
          inputInvoiceId: input.id,
          matchKey: `${input.seller_name}==${output.buyer_name}`,
          deductibleAmount: Number(input.amount) * deductRate,
          deductibleTax: Number(input.tax) * deductRate,
          status,
          reason,
          rate: deductRate,
          _input: input,
          _output: output,
          _statusText: status === 'deductible' ? '可抵扣' : (status === 'partial' ? '部分抵扣' : '不可抵扣')
        });
      }
    } else {
      let status = 'unmatched';
      let deductRate = 0;
      let reason = '未匹配到对应销项发票（购买方名称与销售方不匹配）';

      if (nonDeductReasons.length > 0) {
        status = 'non-deductible';
        reason = nonDeductReasons.join('; ') + '; ' + reason;
      }

      unmatchedInputs.push(input);
      deductionRecords.push({
        period,
        outputInvoiceId: null,
        inputInvoiceId: input.id,
        matchKey: 'UNMATCHED',
        deductibleAmount: Number(input.amount) * deductRate,
        deductibleTax: Number(input.tax) * deductRate,
        status,
        reason,
        rate: deductRate,
        _input: input,
        _output: null,
        _statusText: status === 'deductible' ? '可抵扣' : (status === 'non-deductible' ? '不可抵扣' : '未匹配')
      });
    }
  }

  spinner.text = `匹配完成，正在保存计算结果...`;
  db.saveDeductions(period, deductionRecords.map(d => ({
    period: d.period,
    outputInvoiceId: d.outputInvoiceId,
    inputInvoiceId: d.inputInvoiceId,
    matchKey: d.matchKey,
    deductibleAmount: d.deductibleAmount,
    deductibleTax: d.deductibleTax,
    status: d.status,
    reason: d.reason,
    rate: d.rate
  })));

  const outputTaxTotal = outputs.reduce((s, r) => s + Number(r.tax || 0), 0);
  const outputAmountTotal = outputs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const inputTaxTotal = inputs.reduce((s, r) => s + Number(r.tax || 0), 0);
  const inputAmountTotal = inputs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const deductibleTax = deductionRecords.reduce((s, r) => s + Number(r.deductibleTax || 0), 0);
  const deductibleAmount = deductionRecords.reduce((s, r) => s + Number(r.deductibleAmount || 0), 0);
  const nonDeductibleTax = inputTaxTotal - deductibleTax;
  const taxPayable = Math.max(0, outputTaxTotal - deductibleTax);
  const deductionRate = inputTaxTotal > 0 ? (deductibleTax / inputTaxTotal * 100) : 0;
  const actualRate = outputAmountTotal > 0 ? (taxPayable / outputAmountTotal * 100) : 0;
  const dur = Date.now() - start;
  spinner.succeed(`抵扣计算完成 (${dur}ms)`);
  logger.success('抵扣计算完成', { operation: 'DEDUCT', count: deductionRecords.length, durationMs: dur });

  const summary = new Table({
    title: chalk.bold('🧾 增值税抵扣计算汇总'),
    columns: [
      { name: '项目', alignment: 'left' },
      { name: '数量(张)', alignment: 'right' },
      { name: '金额(元)', alignment: 'right' },
      { name: '税额(元)', alignment: 'right' }
    ]
  });
  summary.addRow({ '项目': '销项发票合计', '数量(张)': outputs.length, '金额(元)': formatAmount(outputAmountTotal), '税额(元)': formatAmount(outputTaxTotal) }, { color: 'red' });
  summary.addRow({ '项目': '进项发票合计', '数量(张)': inputs.length, '金额(元)': formatAmount(inputAmountTotal), '税额(元)': formatAmount(inputTaxTotal) }, { color: 'blue' });
  summary.addRow({ '项目': '✓ 可抵扣进项', '数量(张)': deductionRecords.filter(r => r.status === 'deductible').length, '金额(元)': formatAmount(deductibleAmount), '税额(元)': formatAmount(deductibleTax) }, { color: 'green' });
  summary.addRow({ '项目': '✗ 不可抵扣进项', '数量(张)': deductionRecords.filter(r => r.status === 'non-deductible').length, '金额(元)': formatAmount(inputAmountTotal - deductibleAmount), '税额(元)': formatAmount(nonDeductibleTax) }, { color: 'crimson' });
  summary.addRow({ '项目': '? 未匹配进项', '数量(张)': unmatchedInputs.length, '金额(元)': '-', '税额(元)': '-' }, { color: 'yellow' });
  summary.addRow({ '项目': chalk.bold('应纳税额(销项-可抵扣)'), '数量(张)': '', '金额(元)': '', '税额(元)': chalk.bold.green(formatAmount(taxPayable)) }, { color: 'white' });
  summary.printTable();

  console.log('');
  logger.info(chalk.cyan(`【抵扣率】 ${deductionRate.toFixed(2)}% (可抵扣税额/进项税额合计)`));
  logger.info(chalk.cyan(`【实际税负率】 ${actualRate.toFixed(2)}% (应纳税额/销项不含税金额)`));
  logger.info(chalk.cyan(`【应纳税额】 ${formatAmountCN(taxPayable)}`));
  console.log('');

  const statusCount = new Map();
  for (const r of deductionRecords) {
    statusCount.set(r._statusText, (statusCount.get(r._statusText) || 0) + 1);
  }
  const dt = new Table({
    title: chalk.bold('📊 抵扣状态分布'),
    columns: [{ name: '状态', alignment: 'left' }, { name: '数量', alignment: 'right' }, { name: '占比', alignment: 'right' }]
  });
  for (const [s, c] of statusCount.entries()) {
    dt.addRow({ '状态': s, '数量': c, '占比': (c / deductionRecords.length * 100).toFixed(1) + '%' });
  }
  dt.printTable();

  if (options.showDetails !== false) {
    const detailRecords = deductionRecords.slice(0, 100);
    const ddt = new Table({
      title: chalk.bold(`📝 抵扣明细 (前${detailRecords.length}条)`),
      columns: [
        { name: '进项发票号', alignment: 'left' },
        { name: '销售方', alignment: 'left' },
        { name: '金额', alignment: 'right' },
        { name: '税额', alignment: 'right' },
        { name: '匹配状态', alignment: 'center' },
        { name: '可抵扣税额', alignment: 'right' },
        { name: '原因说明', alignment: 'left' }
      ]
    });
    for (const r of detailRecords) {
      const colorMap = { '可抵扣': 'green', '部分抵扣': 'yellow', '不可抵扣': 'red', '未匹配': 'yellow' };
      ddt.addRow({
        '进项发票号': r._input ? r._input.invoice_number : '-',
        '销售方': (r._input ? r._input.seller_name : '-').toString().substring(0, 12),
        '金额': formatAmount(r._input ? r._input.amount : 0),
        '税额': formatAmount(r._input ? r._input.tax : 0),
        '匹配状态': r._statusText,
        '可抵扣税额': formatAmount(r.deductibleTax),
        '原因说明': (r.reason || '-').toString().substring(0, 20)
      }, { color: colorMap[r._statusText] || 'white' });
    }
    ddt.printTable();
  }

  if (options.export !== false) {
    const outputDir = options.outputDir || path.resolve(process.cwd(), 'data', 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const csvPath = path.join(outputDir, sanitizeFileName(`抵扣明细_${period}.csv`));
    const rows = deductionRecords.map((r, i) => ({
      '序号': i + 1,
      '进项发票代码': r._input ? (r._input.invoice_code || '') : '',
      '进项发票号码': r._input ? (r._input.invoice_number || '') : '',
      '进项开票日期': r._input ? (r._input.invoice_date || '') : '',
      '销售方名称': r._input ? (r._input.seller_name || '') : '',
      '购买方名称': r._input ? (r._input.buyer_name || '') : '',
      '不含税金额': formatAmount(r._input ? r._input.amount : 0),
      '进项税额': formatAmount(r._input ? r._input.tax : 0),
      '税率': r._input && r._input.tax_rate != null ? (r._input.tax_rate * 100).toFixed(2) + '%' : '',
      '匹配销项发票号': r._output ? (r._output.invoice_number || '') : '',
      '匹配销项方': r._output ? (r._output.buyer_name || '') : '',
      '抵扣状态': r._statusText,
      '可抵扣金额': formatAmount(r.deductibleAmount),
      '可抵扣税额': formatAmount(r.deductibleTax),
      '抵扣比例': (r.rate * 100).toFixed(0) + '%',
      '说明': r.reason || ''
    }));
    await new Promise((resolve, reject) => {
      writeCsv(rows, { headers: true, includeEndRowDelimiter: true, writeBOM: true })
        .pipe(fs.createWriteStream(csvPath, 'utf8'))
        .on('finish', resolve)
        .on('error', reject);
    });
    logger.success(`已导出抵扣明细CSV: ${chalk.green(csvPath)}`);
  }

  return {
    success: true,
    period,
    outputCount: outputs.length,
    inputCount: inputs.length,
    outputTaxTotal,
    inputTaxTotal,
    deductibleTax,
    nonDeductibleTax,
    taxPayable,
    deductionRate,
    actualRate,
    records: deductionRecords,
    durationMs: dur
  };
}

module.exports = { deduct, isNonDeductibleByContent, buildNameIndex, fuzzyMatch };
