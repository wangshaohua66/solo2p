'use strict';

/**
 * 模拟数据生成器（用于无网银环境下的端到端验证）
 * 职责：
 *  1) 按各银行 mapping 配置生成样本还款流水文件（xlsx/csv/pdf），写入各自下载目录
 *  2) 向中心系统应还计划表写入样本计划，使核对引擎能命中并产出异常
 *
 * 注意：仅用于联调/冒烟测试，生产环境不启用。
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const logger = require('../utils/logger');
const db = require('../utils/db');
const { getDefaults } = require('../utils/config');

const log = logger.forBank('MOCK');

// 样本合同：覆盖各类异常场景
const SAMPLE_CONTRACTS = [
  { contract_no: 'AJ-2024-0001', borrower: '张三', period: 1, due_principal: 3000, due_interest: 1500, due_date: '2026-05-20', rate: 3.25, scenario: 'normal' },
  { contract_no: 'AJ-2024-0002', borrower: '李四', period: 1, due_principal: 4000, due_interest: 1800, due_date: '2026-05-20', rate: 3.25, scenario: 'overdue' },
  { contract_no: 'AJ-2024-0003', borrower: '王五', period: 1, due_principal: 2500, due_interest: 1200, due_date: '2026-05-15', rate: 3.25, scenario: 'partial' },
  { contract_no: 'AJ-2024-0004', borrower: '赵六', period: 1, due_principal: 5000, due_interest: 2000, due_date: '2026-05-10', rate: 3.25, scenario: 'early', early_settlement: 1 },
  { contract_no: 'AJ-2024-0005', borrower: '钱七', period: 2, due_principal: 3000, due_interest: 1400, due_date: '2026-05-20', rate: 3.5, scenario: 'rate_change', prev_rate: 3.25 },
  { contract_no: 'AJ-2024-0006', borrower: '孙八', period: 1, due_principal: 3500, due_interest: 1600, due_date: '2026-05-22', rate: 3.25, scenario: 'normal' },
  { contract_no: 'AJ-2024-0007', borrower: '周九', period: 1, due_principal: 4200, due_interest: 1900, due_date: '2026-05-18', rate: 3.25, scenario: 'overdue' },
  { contract_no: 'AJ-2024-0008', borrower: '吴十', period: 1, due_principal: 2800, due_interest: 1300, due_date: '2026-05-25', rate: 3.25, scenario: 'unmatched' },
];

function actualFor(scenario, dueTotal) {
  switch (scenario) {
    case 'partial': return Math.round((dueTotal - 200) * 100) / 100;
    case 'early': return Math.round(dueTotal * 1.8 * 100) / 100;
    case 'overdue': return dueTotal;
    case 'rate_change': return dueTotal;
    case 'unmatched': return dueTotal;
    default: return dueTotal;
  }
}

function repayDateFor(scenario, dueDate) {
  if (scenario === 'overdue') return addDays(dueDate, 4);
  if (scenario === 'early') return addDays(dueDate, -2);
  return dueDate;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 写入样本应还计划（含上一期，用于利率比对）
 */
async function seedPlans(month) {
  const existing = await db.getPlansByMonth(month);
  if (existing.length) { log.debug(`计划已存在 ${existing.length} 条，跳过播种`); return existing.length; }

  let count = 0;
  for (const c of SAMPLE_CONTRACTS) {
    if (c.scenario === 'unmatched') continue; // 不写入计划，制造未匹配
    // 当期计划
    await db.run(
      `INSERT INTO repayment_plans (bank_code,contract_no,borrower_name,period,due_date,due_principal,due_interest,due_total,rate,early_settlement,month) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['MOCK', c.contract_no, c.borrower, c.period, c.due_date, c.due_principal, c.due_interest,
       round2(c.due_principal + c.due_interest), c.rate, c.early_settlement ? 1 : 0, month]
    );
    count++;
    // 为利率调整场景写入上一期计划（利率不同）
    if (c.scenario === 'rate_change') {
      await db.run(
        `INSERT INTO repayment_plans (bank_code,contract_no,borrower_name,period,due_date,due_principal,due_interest,due_total,rate,early_settlement,month) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ['MOCK', c.contract_no, c.borrower, c.period - 1, addDays(c.due_date, -30), c.due_principal, c.due_interest - 50,
         round2(c.due_principal + c.due_interest - 50), c.prev_rate, 0, addMonth(month, -1)]
      );
      count++;
    }
  }
  log.success(`已播种 ${count} 条应还计划（月份 ${month}）`);
  return count;
}

function addMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 生成单家银行样本流水文件，根据 file_format 分支生成 xlsx/csv/pdf
 * @param {object} bank 银行配置
 * @param {string} month 月份
 * @returns {string} 文件路径
 */
function generateStatement(bank, month) {
  const mapping = bank.mapping || {};
  const fields = mapping.fields || {};
  const unit = (mapping.amount_unit || 'yuan').toLowerCase();
  const headerRow = Number(mapping.header_row || 0);
  const fmt = String((bank.export && bank.export.file_format) || 'xlsx').toLowerCase();

  // PDF 标准字体不支持中文，mock 的 PDF 表头改用字段 key（ASCII），
  // pdf.js 解析器会回退到按字段 key 识别表头列
  const useFieldKeyHeader = fmt === 'pdf';
  const headers = useFieldKeyHeader
    ? Object.keys(fields)
    : [
      fields.borrower_name.header,
      fields.contract_no.header,
      fields.period.header,
      fields.due_principal.header,
      fields.due_interest.header,
      fields.actual_amount.header,
      fields.repay_date.header,
      '利率',
    ];

  const rows = SAMPLE_CONTRACTS.map((c) => {
    const dueTotal = round2(c.due_principal + c.due_interest);
    const actual = actualFor(c.scenario, dueTotal);
    const repayDate = repayDateFor(c.scenario, c.due_date);
    const pUnit = (v) => (unit === 'fen' ? Math.round(v * 100) : v);
    return [
      c.borrower, c.contract_no, `${c.period}期`,
      pUnit(c.due_principal), pUnit(c.due_interest), pUnit(actual),
      formatDate(repayDate, mapping.date_format),
      c.rate,
    ];
  });

  const def = getDefaults();
  const dir = path.resolve(process.cwd(), def.download_dir || './downloads', bank.code);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fmt === 'csv') {
    return generateCsv(bank, month, headers, rows, headerRow, dir);
  }
  if (fmt === 'pdf') {
    return generatePdf(bank, month, headers, rows, headerRow, dir);
  }
  return generateXlsx(bank, month, headers, rows, headerRow, mapping, dir);
}

function generateXlsx(bank, month, headers, rows, headerRow, mapping, dir) {
  const aoa = [];
  for (let i = 0; i < headerRow; i++) aoa.push([]);
  aoa.push(headers);
  for (const r of rows) aoa.push(r);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mapping.sheet_name || '还款明细');
  const file = path.join(dir, `mock_${bank.code}_${month}.xlsx`);
  XLSX.writeFile(wb, file);
  log.debug(`生成样本文件(xlsx): ${file}`);
  return file;
}

function generateCsv(bank, month, headers, rows, headerRow, dir) {
  const encoding = (bank.export && bank.export.encoding) || 'utf-8';
  const lines = [];
  for (let i = 0; i < headerRow; i++) lines.push('');
  lines.push(headers.map(csvEscape).join(','));
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  const text = lines.join('\n');
  const file = path.join(dir, `mock_${bank.code}_${month}.csv`);
  const buf = encoding.toLowerCase() === 'gbk'
    ? iconv.encode('\ufeff' + text, 'gbk')
    : Buffer.from('\ufeff' + text, 'utf8');
  fs.writeFileSync(file, buf);
  log.debug(`生成样本文件(csv/${encoding}): ${file}`);
  return file;
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * 生成最小化 PDF 文件（含文本坐标，供 pdfjs-dist 解析）
 * 使用 PDF 1.4 文本操作符 BT/ET + Tm 定位，每列独立 Tj，
 * pdfjs-dist 会为每个 Tj 生成独立文本项并附带 x/y 坐标，
 * 从而 clusterIntoLines 能按 x 间距切列。
 */
function generatePdf(bank, month, headers, rows, headerRow, dir) {
  const dateFmt = (bank.mapping && bank.mapping.date_format) || 'YYYY-MM-DD';
  const fontName = 'Helvetica';
  const fontSize = 9;
  const pageWidth = 842; // A4 横向
  const pageHeight = 595;
  const leftMargin = 30;
  const topMargin = 50;
  const rowHeight = 16;
  // 各列起始 x 坐标（等距分布，模拟表格列线）
  const colCount = headers.length;
  const colWidth = Math.floor((pageWidth - leftMargin * 2) / colCount);
  const colX = [];
  for (let i = 0; i < colCount; i++) colX.push(leftMargin + i * colWidth);

  // 构建每行数据（含表头行）
  const allRows = [];
  for (let i = 0; i < headerRow; i++) allRows.push([]);
  allRows.push(headers);
  for (const r of rows) allRows.push(r);

  // 每列一个独立文本项，pdfjs-dist 按坐标聚类即可切列
  // 使用十六进制字符串 <...> 避免中文等多字节字符中含 ) (引发解析错误
  const textStreams = [];
  let y = pageHeight - topMargin;
  for (const row of allRows) {
    if (!row.length) { y -= rowHeight; continue; }
    for (let ci = 0; ci < row.length && ci < colCount; ci++) {
      const cellText = String(row[ci] == null ? '' : row[ci]);
      if (!cellText) continue;
      const hex = Buffer.from(cellText, 'utf8').toString('hex');
      textStreams.push(`BT /${fontName} ${fontSize} Tf 1 0 0 1 ${colX[ci]} ${y} Tm <${hex}> Tj ET`);
    }
    y -= rowHeight;
  }

  const contentStream = textStreams.join('\n');
  const contentLength = contentStream.length;

  // 组装最小化 PDF 结构
  const objects = [];
  // obj1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // obj2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  // obj3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /${fontName} 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`);
  // obj4: Content stream
  objects.push(`4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  // obj5: Font
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontName} >>\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  let pos = pdf.length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pos);
    pdf += objects[i];
    pos += objects[i].length;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const file = path.join(dir, `mock_${bank.code}_${month}.pdf`);
  fs.writeFileSync(file, Buffer.from(pdf, 'latin1'));
  log.debug(`生成样本文件(pdf): ${file}`);
  return file;
}

function formatDate(dateStr, fmt) {
  const norm = String(fmt || '').toUpperCase();
  const [y, m, d] = dateStr.split('-');
  if (norm === 'YYYYMMDD') return `${y}${m}${d}`;
  if (norm === 'YYYY/MM/DD') return `${y}/${m}/${d}`;
  if (norm === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
  return `${y}-${m}-${d}`;
}

function round2(n) { return Math.round(Number(n) * 100) / 100; }

module.exports = { seedPlans, generateStatement, SAMPLE_CONTRACTS };
