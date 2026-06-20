'use strict';

/**
 * Excel / CSV 流水文件解析器
 * 职责：
 *  1) Excel：多 Sheet 识别、合并单元格拆分（!merges 填充）、表头行定位
 *  2) CSV：GBK / UTF-8 编码自动检测（iconv-lite）
 *  3) 输出原始行（按表头键名映射的对象数组），交由 normalizer 标准化
 */

const fs = require('fs');
const XLSX = require('xlsx');
const iconv = require('iconv-lite');
const logger = require('../utils/logger');

const log = logger.forBank('EXTRACTOR');

/**
 * 主入口：根据文件类型分发
 * @param {string} filePath 下载的流水文件路径
 * @param {object} bank 银行配置（含 mapping / export.file_format）
 * @returns {Promise<{format:string, source_file:string, rows:object[], meta:object}>}
 */
async function parse(filePath, bank) {
  const mapping = bank.mapping || {};
  const fmt = String(bank.export && bank.export.file_format || '').toLowerCase();
  const ext = filePath.toLowerCase().split('.').pop();

  // 优先按实际扩展名路由：xlsx -> Excel 解析；csv -> CSV 解析。
  // 扩展名缺失时回退到银行 export.file_format 配置。
  if (ext === 'csv' || (!ext && fmt === 'csv')) {
    return parseCsv(filePath, bank, mapping);
  }
  return parseExcel(filePath, bank, mapping);
}

// ---------------------------------------------------------------- CSV
function detectEncoding(buffer) {
  // UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }
  // 尝试 UTF-8 解码校验
  try {
    const s = buffer.toString('utf8');
    if (!/\ufffd/.test(s)) return 'utf-8';
  } catch (_) { /* fallthrough */ }
  // 含中文字节且非UTF-8，按 GBK 处理
  return 'gbk';
}

/**
 * 简易 CSV 解析（支持引号、逗号、换行转义）
 */
function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function parseCsv(filePath, bank, mapping) {
  const buf = fs.readFileSync(filePath);
  const encoding = (bank.export && bank.export.encoding) || detectEncoding(buf);
  log.debug(`CSV 解析: ${filePath} 编码=${encoding}`);
  const text = iconv.decode(buf, encoding).replace(/^\ufeff/, '');
  const matrix = parseCsvText(text);
  const headerRow = Number(mapping.header_row || 0);
  if (!matrix.length) return { format: 'csv', source_file: filePath, rows: [], meta: { encoding } };
  const headers = (matrix[headerRow] || []).map((h) => String(h).trim());
  const rows = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = matrix[i][idx]; });
    rows.push(obj);
  }
  return { format: 'csv', source_file: filePath, rows, meta: { encoding, headerRow } };
}

// ---------------------------------------------------------------- Excel
function resolveSheet(wb, mapping) {
  const names = wb.SheetNames;
  if (mapping.sheet_name && names.includes(mapping.sheet_name)) {
    return { sheet: wb.Sheets[mapping.sheet_name], name: mapping.sheet_name };
  }
  // 无指定则取首个非空 Sheet
  for (const n of names) {
    const s = wb.Sheets[n];
    if (s && s['!ref']) return { sheet: s, name: n };
  }
  return { sheet: wb.Sheets[names[0]], name: names[0] };
}

/**
 * 填充合并单元格：将 !merges 区域内非左上角单元格补齐为左上角值
 */
function fillMergedCells(sheet) {
  const merges = sheet['!merges'] || [];
  for (const m of merges) {
    const { s, e } = m;
    const startAddr = XLSX.utils.encode_cell({ r: s.r, c: s.c });
    const val = sheet[startAddr];
    if (val === undefined) continue;
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        if (r === s.r && c === s.c) continue;
        const addr = XLSX.utils.encode_cell({ r, c });
        if (sheet[addr] === undefined) sheet[addr] = { ...val };
      }
    }
  }
}

function parseExcel(filePath, bank, mapping) {
  log.debug(`Excel 解析: ${filePath}`);
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const { sheet, name } = resolveSheet(wb, mapping);
  if (!sheet) return { format: 'xlsx', source_file: filePath, rows: [], meta: {} };

  fillMergedCells(sheet);
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true });
  const headerRow = Number(mapping.header_row != null ? mapping.header_row : 0);

  // 健壮表头定位：sheet_to_json 可能丢弃前导空行导致索引错位，
  // 改为按配置字段表头文本匹配命中最多的行作为表头行。
  const fieldHeaders = Object.values(mapping.fields || {})
    .map((f) => f && f.header)
    .filter(Boolean);
  let realHeaderIdx = -1;
  let bestHits = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every((c) => !String(c).trim())) continue;
    let hits = 0;
    for (const fh of fieldHeaders) {
      if (row.some((c) => String(c).trim() === String(fh).trim() || String(c).includes(String(fh)))) hits++;
    }
    if (hits > bestHits) { bestHits = hits; realHeaderIdx = i; }
  }
  if (realHeaderIdx < 0) {
    // 回退：扫描第一个非空行
    for (let i = 0; i < matrix.length; i++) {
      if (matrix[i] && matrix[i].some((c) => String(c).trim())) { realHeaderIdx = i; break; }
    }
  }
  if (realHeaderIdx < 0) realHeaderIdx = headerRow;

  if (realHeaderIdx >= matrix.length) {
    return { format: 'xlsx', source_file: filePath, rows: [], meta: { sheet: name } };
  }
  const headers = (matrix[realHeaderIdx] || []).map((h) => String(h == null ? '' : h).trim());
  const rows = [];
  for (let i = realHeaderIdx + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!line || line.every((c) => !String(c).trim())) continue; // 跳过空行
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = line[idx]; });
    rows.push(obj);
  }
  return { format: 'xlsx', source_file: filePath, rows, meta: { sheet: name, headerRow: realHeaderIdx } };
}

module.exports = { parse, parseExcel, parseCsv };
