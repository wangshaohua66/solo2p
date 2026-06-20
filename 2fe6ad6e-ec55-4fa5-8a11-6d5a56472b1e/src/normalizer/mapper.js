'use strict';

/**
 * 还款数据标准化映射器
 * 职责：
 *  1) 字段名映射：按 banks.yml mapping.fields 把银行原始表头映射到 7 个核心字段
 *  2) 日期格式统一：支持 YYYYMMDD / YYYY-MM-DD / YYYY/MM/DD / DD-MM-YYYY 等，输出 YYYY-MM-DD
 *  3) 金额单位归一化：分转元（除以100）、去除千分位与货币符号
 *  4) 贷款合同号格式校验与补全
 *  5) 输出标准还款记录（含原始 raw_json）
 */

const logger = require('../utils/logger');
const log = logger.forBank('MAPPER');

const STANDARD_FIELDS = [
  'borrower_name', 'contract_no', 'period',
  'due_principal', 'due_interest', 'actual_amount', 'repay_date',
];

/**
 * 标准化单家银行的所有原始行
 * @param {Array<object>} rawRows 提取器输出的原始行（键为银行表头）
 * @param {object} bank 银行配置
 * @param {string} runId 本次运行ID
 * @returns {Array<object>} 标准还款记录数组
 */
function normalize(rawRows, bank, runId) {
  const mapping = bank.mapping || {};
  const fields = mapping.fields || {};
  const dateFmt = mapping.date_format || 'YYYYMMDD';
  const unit = (mapping.amount_unit || 'yuan').toLowerCase();

  const std = [];
  let skipped = 0;

  for (const row of rawRows) {
    try {
      const rec = mapRow(row, fields, dateFmt, unit);
      if (!rec.contract_no && !rec.borrower_name) { skipped++; continue; }
      rec.run_id = runId;
      rec.bank_code = bank.code;
      rec.raw_json = JSON.stringify(row);
      std.push(rec);
    } catch (e) {
      skipped++;
      log.debug(`行映射失败已跳过: ${e.message}`);
    }
  }
  log.info(`${bank.code} 标准化完成: ${std.length} 条，跳过 ${skipped} 条`);
  return std;
}

function mapRow(row, fields, dateFmt, unit) {
  const rec = {};
  for (const stdName of STANDARD_FIELDS) {
    const cfg = fields[stdName];
    let val = undefined;
    if (cfg) {
      if (cfg.header) val = row[cfg.header];
      if (val === undefined && cfg.index != null) {
        val = Object.values(row)[cfg.index];
      }
    }
    rec[stdName] = val;
  }

  rec.borrower_name = cleanText(rec.borrower_name);
  rec.contract_no = normalizeContract(rec.contract_no, fields.contract_no);
  rec.period = parsePeriod(rec.period);
  rec.due_principal = normalizeAmount(rec.due_principal, unit);
  rec.due_interest = normalizeAmount(rec.due_interest, unit);
  rec.actual_amount = normalizeAmount(rec.actual_amount, unit);
  rec.repay_date = normalizeDate(rec.repay_date, dateFmt);
  rec.rate = parseNumber(extractRate(row, fields));
  return rec;
}

function cleanText(v) {
  if (v === null || v === undefined) return null;
  return String(v).replace(/\s+/g, '').trim() || null;
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).replace(/[￥¥,，\s%]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * 提取利率（非7个核心字段，但用于利率调整检测）
 * 优先按 mapping.fields.rate 配置；未配置时兜底常见表头。
 */
function extractRate(row, fields) {
  const cfg = fields && fields.rate;
  if (cfg && cfg.header && row[cfg.header] !== undefined) return row[cfg.header];
  for (const h of ['利率', '当期利率', '利率%', '当期利率%']) {
    if (row[h] !== undefined) return row[h];
  }
  return undefined;
}

function normalizeAmount(v, unit) {
  const n = parseNumber(v);
  if (n === null) return 0;
  const value = unit === 'fen' ? n / 100 : n;
  return Math.round(value * 100) / 100; // 保留两位
}

/**
 * 日期统一为 YYYY-MM-DD
 */
function normalizeDate(v, fmt) {
  if (!v) return null;
  const s = String(v).trim();
  let y, m, d;
  const norm = (fmt || '').toUpperCase();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    [y, m, d] = s.split('-');
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    [y, m, d] = s.split('/');
  } else if (/^\d{8}$/.test(s)) {
    y = s.slice(0, 4); m = s.slice(4, 6); d = s.slice(6, 8);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) && norm === 'DD/MM/YYYY') {
    [d, m, y] = s.split('/');
  } else {
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return null;
    y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
  }
  y = String(y); m = String(m).padStart(2, '0'); d = String(d).padStart(2, '0');
  if (!/^(\d{4})$/.test(y)) return null;
  return `${y}-${m}-${d}`;
}

function parsePeriod(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

const CONTRACT_PATTERN = /^[A-Z0-9\-]{6,30}$/;

function normalizeContract(v, cfg) {
  if (!v) return null;
  let s = cleanText(v);
  if (!s) return null;
  // 去除常见前缀文字
  s = s.replace(/^(合同号|合同编号|贷款合同号|No)[:：]?\s*/i, '');
  s = s.toUpperCase().replace(/，/g, ',');
  // 补全：如配置 prefix 且长度不足则补前缀
  if (cfg && cfg.prefix && !s.startsWith(cfg.prefix)) {
    s = cfg.prefix + s;
  }
  if (!CONTRACT_PATTERN.test(s)) {
    log.debug(`合同号格式异常但仍保留: ${s}`);
  }
  return s;
}

module.exports = { normalize, STANDARD_FIELDS, normalizeDate, normalizeAmount, normalizeContract };
