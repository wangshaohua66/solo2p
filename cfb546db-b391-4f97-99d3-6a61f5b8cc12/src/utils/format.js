const dayjs = require('dayjs');

const TAX_RATES = [0, 0.01, 0.03, 0.06, 0.09, 0.13];

function formatAmount(amount, decimals = 2) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  const num = Number(amount);
  return num.toFixed(decimals);
}

function formatAmountCN(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '¥0.00';
  const num = Number(amount);
  return '¥' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(date, pattern = 'YYYY-MM-DD') {
  if (!date) return '';
  const d = dayjs(date);
  return d.isValid() ? d.format(pattern) : String(date);
}

function formatDateTime(date, pattern = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  const d = dayjs(date);
  return d.isValid() ? d.format(pattern) : String(date);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY年MM月DD日',
    'YYYYMMDD',
    'MM/DD/YYYY',
    'DD-MM-YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm:ss'
  ];
  for (const fmt of formats) {
    const d = dayjs(dateStr, fmt, true);
    if (d.isValid()) return d.format('YYYY-MM-DD');
  }
  const d = dayjs(dateStr);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

function normalizeTaxRate(rate) {
  if (rate === null || rate === undefined || rate === '') return null;
  let r = rate;
  if (typeof r === 'string') {
    r = r.trim().replace('%', '').replace(/％/g, '');
    if (r === '免税' || r === '0' || r === '零') return 0;
    r = parseFloat(r);
  }
  if (typeof r !== 'number' || isNaN(r)) return null;
  if (r > 1) r = r / 100;
  for (const valid of TAX_RATES) {
    if (Math.abs(r - valid) < 0.0001) return Number(valid.toFixed(4));
  }
  return Number(r.toFixed(4));
}

function calculateTax(amount, taxRate) {
  if (!amount || !taxRate) return 0;
  return Number((Number(amount) * Number(taxRate)).toFixed(2));
}

function calculateTotal(amount, tax) {
  return Number((Number(amount) + Number(tax || 0)).toFixed(2));
}

function verifyTaxConsistency(amount, tax, taxRate, tolerance = 0.05) {
  if (!amount || tax === undefined || tax === null) return true;
  const expected = calculateTax(amount, taxRate);
  return Math.abs(Number(tax) - expected) <= tolerance;
}

function isValidInvoiceNumber(num) {
  if (!num) return false;
  const s = String(num).trim();
  return /^\d{8}$|^\d{10}$|^\d{12}$|^\d{20}$/.test(s);
}

function isValidInvoiceCode(code) {
  if (!code) return true;
  const s = String(code).trim();
  return /^\d{10}$|^\d{12}$/.test(s);
}

function padLeft(str, len, char = '0') {
  const s = String(str || '');
  return s.length >= len ? s : char.repeat(len - s.length) + s;
}

function generateInvoiceKey(invoiceCode, invoiceNumber) {
  return `${String(invoiceCode || '').trim()}_${String(invoiceNumber || '').trim()}`;
}

function truncate(str, maxLen = 100, suffix = '...') {
  if (!str) return '';
  const s = String(str);
  return s.length > maxLen ? s.substring(0, maxLen - suffix.length) + suffix : s;
}

function sanitizeFileName(name) {
  return String(name || 'output').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
}

module.exports = {
  TAX_RATES,
  formatAmount,
  formatAmountCN,
  formatDate,
  formatDateTime,
  parseDate,
  normalizeTaxRate,
  calculateTax,
  calculateTotal,
  verifyTaxConsistency,
  isValidInvoiceNumber,
  isValidInvoiceCode,
  padLeft,
  generateInvoiceKey,
  truncate,
  sanitizeFileName
};
