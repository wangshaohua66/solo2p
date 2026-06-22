const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const ExcelJS = require('exceljs');
const { parse: parseCsv } = require('fast-csv');
const {
  parseDate, normalizeTaxRate, calculateTax, calculateTotal,
  verifyTaxConsistency, isValidInvoiceNumber, isValidInvoiceCode
} = require('../utils/format');
const { PLATFORMS, INVOICE_TYPES } = require('./db');

const REQUIRED_FIELDS = ['invoiceNumber', 'invoiceDate', 'amount', 'invoiceType'];

function detectPlatformByContent(content, ext, filename) {
  const name = (filename || '').toLowerCase();
  const lowerContent = (content || '').substring(0, 5000).toLowerCase();

  if (name.includes('航信') || name.includes('hangxin') || lowerContent.includes('金税') || lowerContent.includes('航信')) {
    return PLATFORMS.HANGXIN;
  }
  if (name.includes('百望') || name.includes('baiwang') || lowerContent.includes('百望') || lowerContent.includes('bw_')) {
    return PLATFORMS.BAIWANG;
  }
  if (name.includes('腾讯') || name.includes('tencent') || lowerContent.includes('腾讯') || lowerContent.includes('微信')) {
    return PLATFORMS.TENCENT;
  }
  if (name.includes('支付宝') || name.includes('alipay') || lowerContent.includes('支付宝')) {
    return PLATFORMS.ALIPAY;
  }
  if (name.includes('京东') || name.includes('jd_') || lowerContent.includes('京东') || lowerContent.includes('jd.com')) {
    return PLATFORMS.JD;
  }
  if (name.includes('天猫') || name.includes('tmall') || name.includes('淘宝') || lowerContent.includes('天猫') || lowerContent.includes('淘宝')) {
    return PLATFORMS.TMALL;
  }

  if (ext === '.xml' && (lowerContent.includes('<fp') || lowerContent.includes('invoice') || lowerContent.includes('发票'))) {
    return PLATFORMS.HANGXIN;
  }
  if (ext === '.json') {
    try {
      const obj = JSON.parse(content.substring(0, 20000));
      if (obj.data || obj.list || obj.invoices || obj.records) {
        if (lowerContent.includes('京东') || (obj.channel && String(obj.channel).includes('jd'))) return PLATFORMS.JD;
        return PLATFORMS.BAIWANG;
      }
    } catch (e) {}
  }
  if (ext === '.csv') {
    if (lowerContent.includes('腾讯') || lowerContent.includes('微信')) return PLATFORMS.TENCENT;
    if (lowerContent.includes('支付宝')) return PLATFORMS.ALIPAY;
    return PLATFORMS.TENCENT;
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return PLATFORMS.ALIPAY;
  }
  if (ext === '.txt') {
    if (lowerContent.includes('天猫') || lowerContent.includes('淘宝')) return PLATFORMS.TMALL;
  }

  return PLATFORMS.UNKNOWN;
}

function flattenObject(obj, prefix = '', result = {}) {
  if (!obj || typeof obj !== 'object') {
    if (prefix) result[prefix] = obj;
    return result;
  }
  for (const [key, val] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenObject(val, newKey, result);
    } else if (val !== undefined) {
      result[newKey] = val;
    }
    if (prefix) result[key] = val;
  }
  return result;
}

function keyMatch(key, patterns) {
  const k = String(key || '').toLowerCase().replace(/[_\s.-]/g, '');
  for (const p of patterns) {
    const pp = String(p).toLowerCase().replace(/[_\s.-]/g, '');
    if (k === pp || k.includes(pp)) return true;
  }
  return false;
}

function findValueByPatterns(flatObj, patterns) {
  for (const [key, val] of Object.entries(flatObj)) {
    if (val === null || val === undefined || val === '') continue;
    if (keyMatch(key, patterns)) return val;
  }
  return null;
}

function normalizeRecord(raw, platform, sourceFile) {
  const flat = flattenObject(raw);
  const get = (keys, patterns = [], defaultValue = null) => {
    for (const k of keys) {
      if (flat[k] !== undefined && flat[k] !== null && flat[k] !== '') return flat[k];
      const pathKey = Object.keys(flat).find(fk => fk.endsWith('.' + k) || fk.endsWith('_' + k));
      if (pathKey && flat[pathKey] !== undefined && flat[pathKey] !== null && flat[pathKey] !== '') return flat[pathKey];
    }
    if (patterns.length) {
      const pv = findValueByPatterns(flat, patterns);
      if (pv !== null) return pv;
    }
    return defaultValue;
  };
  const getStr = (keys, patterns = []) => {
    const v = get(keys, patterns);
    return v == null ? null : String(v).trim();
  };
  const getNum = (keys, patterns = []) => {
    const v = get(keys, patterns);
    if (v == null || v === '') return 0;
    const n = parseFloat(String(v).replace(/[,，¥￥\s]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const invoiceCode = getStr(
    ['invoiceCode', '发票代码', 'fpdm', 'code', 'invCode', '发票代码编号'],
    ['发票代码', 'fpdm', 'invoicecode', 'invoicecode编号']
  );
  const invoiceNumber = getStr(
    ['invoiceNumber', '发票号码', 'fphm', 'number', 'invNo', 'no', '发票号', '发票编号'],
    ['发票号码', 'fphm', 'invoicenumber', 'invoice编号']
  );
  const rawDate = getStr(
    ['invoiceDate', '开票日期', 'kprq', 'date', 'invDate', 'billingDate', '开票时间', '填开日期'],
    ['开票日期', 'kprq', '开票', '日期', 'date', '时间']
  );
  const invoiceDate = parseDate(rawDate);

  let buyerName = getStr(
    ['buyerName', '购买方名称', 'gmfmc', 'buyer', 'purchaserName', '购方名称', '购买方', '买家名称', '购方', '购买方单位名称'],
    ['购买方', '买方', 'gmf', 'buyer', 'purchaser', '购方']
  );
  let buyerTaxId = getStr(
    ['buyerTaxId', '购买方税号', 'gmfnsrsbh', 'buyerTaxNo', 'purchaserTaxId', '购买方纳税人识别号', '购方税号'],
    ['购买方税号', '购方税号', 'gmfnsr', 'buyertax', 'purchasertax']
  );
  let sellerName = getStr(
    ['sellerName', '销售方名称', 'xsfmc', 'seller', 'vendorName', '销方名称', '销售方', '卖家名称', '销方', '销售方单位名称', '供应商名称', '商家名称', 'vendor', '店铺名称'],
    ['销售方', '卖方', '销方', 'xsf', 'seller', 'vendor', '商家', '供应商', '店铺']
  );
  let sellerTaxId = getStr(
    ['sellerTaxId', '销售方税号', 'xsfnsrsbh', 'sellerTaxNo', 'vendorTaxId', '销售方纳税人识别号', '销方税号'],
    ['销售方税号', '销方税号', 'xsfnsr', 'sellertax', 'vendortax']
  );

  const amount = getNum(
    ['amount', '金额', 'je', '不含税金额', '不含税价', 'wshjje', 'exclusiveAmount', 'wshj', '不含税合计', '金额合计(不含税)'],
    ['不含税金额', 'wshj', '不含税', 'exclusiveamount', '金额']
  );
  const tax = getNum(
    ['tax', '税额', 'se', 'taxAmount', '增值税额', '合计税额', 'hjse', '税额合计'],
    ['税额', '增值税', 'se', 'tax', '税额合计']
  );
  let total = getNum(
    ['total', '价税合计', 'jshj', 'totalAmount', 'amountWithTax', '含税金额', '合计金额', 'jshjje', '价税合计金额', '合计'],
    ['价税合计', '含税', 'jshj', 'total', '合计金额']
  );
  if (!total) total = calculateTotal(amount, tax);

  const rawRate = get(
    ['taxRate', '税率', 'sl', 'rate', 'taxRatio', '税率(%)', '适用税率'],
    ['税率', 'sl', 'rate', 'taxrate', 'taxratio']
  );
  let taxRate = normalizeTaxRate(rawRate);
  if (taxRate === null && amount > 0 && tax > 0) {
    taxRate = Number((tax / amount).toFixed(4));
  }

  let invoiceType = getStr(
    ['invoiceType', '发票类型', 'fplx', 'type', 'inputOutput', '类型', '进销项', '发票性质'],
    ['发票类型', 'fplx', '类型', '进销项', 'inputoutput', 'invoicetype']
  );
  if (invoiceType) {
    if (invoiceType.includes('销') || invoiceType === 'output' || invoiceType === '销项' || invoiceType === '2' || invoiceType === '销项发票') {
      invoiceType = INVOICE_TYPES.OUTPUT;
    } else if (invoiceType.includes('进') || invoiceType === 'input' || invoiceType === '进项' || invoiceType === '1' || invoiceType === '进项发票') {
      invoiceType = INVOICE_TYPES.INPUT;
    } else {
      invoiceType = INVOICE_TYPES.UNKNOWN;
    }
  } else {
    invoiceType = INVOICE_TYPES.UNKNOWN;
  }

  return {
    invoiceCode,
    invoiceNumber,
    invoiceDate,
    buyerName,
    buyerTaxId,
    sellerName,
    sellerTaxId,
    amount,
    tax,
    total,
    taxRate,
    invoiceType,
    platform,
    sourceFile,
    rawData: raw
  };
}

function validateRecord(rec) {
  const errors = [];
  const suggestions = [];
  let isValid = true;

  for (const field of REQUIRED_FIELDS) {
    if (rec[field] === undefined || rec[field] === null || rec[field] === '') {
      isValid = false;
      errors.push(`必填字段缺失: ${field}`);
    }
  }

  if (!isValidInvoiceNumber(rec.invoiceNumber)) {
    errors.push(`发票号码格式不合法: ${rec.invoiceNumber}, 需为8/10/12/20位数字`);
    suggestions.push('请检查发票号码是否为纯数字且长度正确');
  }

  if (rec.invoiceCode && !isValidInvoiceCode(rec.invoiceCode)) {
    errors.push(`发票代码格式不合法: ${rec.invoiceCode}, 需为10或12位数字`);
  }

  if (!rec.invoiceDate) {
    errors.push('开票日期缺失或格式无法识别');
    suggestions.push('请使用YYYY-MM-DD等标准日期格式');
  }

  if (rec.amount < 0 || rec.tax < 0 || rec.total < 0) {
    errors.push('金额/税额/价税合计不能为负数');
  }

  if (rec.taxRate !== null && rec.amount > 0 && rec.tax >= 0) {
    if (!verifyTaxConsistency(rec.amount, rec.tax, rec.taxRate, 0.5)) {
      const expected = calculateTax(rec.amount, rec.taxRate);
      errors.push(`税额计算不一致: 实际${rec.tax}, 预期${expected} (金额${rec.amount} × 税率${rec.taxRate})`);
      suggestions.push('建议人工复核金额与税率的匹配关系');
      isValid = false;
    }
  }

  if (rec.amount > 0 && Math.abs((rec.amount + (rec.tax || 0)) - rec.total) > 0.5) {
    errors.push(`价税合计不一致: ${rec.amount} + ${rec.tax} ≠ ${rec.total}`);
  }

  if (rec.invoiceType === INVOICE_TYPES.UNKNOWN) {
    suggestions.push('请手动指定发票类型(进项/销项)');
  }

  return { isValid, errors, suggestions };
}

async function parseHangxinXML(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.HANGXIN;
  const content = fs.readFileSync(filePath, 'utf8');
  const parser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs: false,
    mergeAttrs: true,
    explicitCharkey: false,
    charkey: '_text',
    trim: true,
    normalizeTags: false,
    normalize: false
  });
  const result = await parser.parseStringPromise(content);
  const records = [];

  const isInvoiceObject = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const keys = Object.keys(obj).join(',').toLowerCase();
    const markers = ['fphm', 'fpdm', '发票号码', '发票代码', 'invoicenumber', 'invoicecode', 'kprq', '开票日期'];
    return markers.some(m => keys.includes(m));
  };

  const collectArrays = (obj, list = []) => {
    if (!obj || typeof obj !== 'object') return list;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (isInvoiceObject(item)) {
          list.push(item);
        } else if (typeof item === 'object') {
          collectArrays(item, list);
        }
      }
      return list;
    }
    const entries = Object.entries(obj);
    for (const [key, val] of entries) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (isInvoiceObject(item)) list.push(item);
          else if (typeof item === 'object') collectArrays(item, list);
        }
      } else if (typeof val === 'object') {
        if (isInvoiceObject(val)) list.push(val);
        else collectArrays(val, list);
      }
    }
    return list;
  };

  collectArrays(result, records);

  if (records.length === 0) {
    const allLeaves = [];
    const walkObj = (obj, path = []) => {
      if (!obj) return;
      if (typeof obj !== 'object') return;
      const keys = Object.keys(obj);
      if (keys.length > 0 && isInvoiceObject(obj)) {
        allLeaves.push(obj);
        return;
      }
      for (const v of Object.values(obj)) walkObj(v);
    };
    walkObj(result);
    records.push(...allLeaves);
  }

  const finalRecords = records.map(r => {
    const processed = {};
    const process = (node, prefix = '') => {
      if (!node || typeof node !== 'object') {
        if (node !== undefined && node !== null && prefix) processed[prefix] = node;
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === '$' || k === '_attributes') {
          process(v, prefix);
          continue;
        }
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'object' && v && !Array.isArray(v)) {
          if (Object.keys(v).length === 1 && (v._text !== undefined || v.$text !== undefined || v._ !== undefined)) {
            processed[key] = v._text || v.$text || v._;
          } else {
            process(v, key);
          }
        } else if (v !== undefined) {
          processed[key] = v;
          if (prefix) processed[k] = v;
        }
      }
    };
    process(r);
    return processed;
  });

  return finalRecords.map(r => normalizeRecord(r, platform, filePath));
}

async function parseBaiwangJSON(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.BAIWANG;
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  const findArray = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (typeof obj !== 'object') return [];
    const candidates = ['data', 'list', 'records', 'invoices', 'items', 'rows', 'result', '发票列表', 'data.list', 'result.data'];
    for (const key of candidates) {
      if (obj[key] !== undefined) {
        const found = findArray(obj[key]);
        if (found.length) return found;
      }
    }
    for (const v of Object.values(obj)) {
      if (typeof v === 'object') {
        const found = findArray(v);
        if (found.length) return found;
      }
    }
    return [];
  };

  const records = findArray(data);
  return records.map(r => normalizeRecord(r, platform, filePath));
}

function parseTencentCSV(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.TENCENT;
  return new Promise((resolve, reject) => {
    const records = [];
    let header = null;
    let headerFound = false;
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (content.length === 0) return resolve([]);

    let headerIdx = -1;
    for (let i = 0; i < Math.min(5, content.length); i++) {
      if (/发票|invoice|号码|日期|金额|amount/i.test(content[i])) {
        headerIdx = i; break;
      }
    }
    if (headerIdx < 0) headerIdx = 0;

    const rawHeader = content[headerIdx];
    let delim = ',';
    for (const d of [',', '\t', ';', '|']) {
      if (rawHeader.split(d).filter(x => x.trim()).length >= 4) { delim = d; break; }
    }
    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (c === delim && !inQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };
    header = parseLine(rawHeader);
    for (let i = headerIdx + 1; i < content.length; i++) {
      if (!content[i].trim()) continue;
      const parts = parseLine(content[i]);
      if (parts.filter(p => p).length < 3) continue;
      const obj = {};
      header.forEach((h, idx) => {
        if (h) obj[String(h).trim()] = (parts[idx] || '').trim();
      });
      records.push(normalizeRecord(obj, platform, filePath));
    }
    resolve(records);
  });
}

async function parseAlipayExcel(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.ALIPAY;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const records = [];

  for (const ws of workbook.worksheets) {
    if (!ws || ws.rowCount < 2) continue;
    const rowCount = ws.rowCount;

    const getCellValue = (row, colIdx) => {
      const cell = row.getCell(colIdx);
      if (!cell) return '';
      let v = cell.value;
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        if (v.text !== undefined) return String(v.text);
        if (v.result !== undefined) return String(v.result);
        if (v.richText && Array.isArray(v.richText)) {
          return v.richText.map(rt => rt.text || '').join('');
        }
        if (v.hyperlink && v.hyperlink.text) return String(v.hyperlink.text);
        if (v.formula) return String(v.result !== undefined ? v.result : '');
      }
      return String(v).trim();
    };

    let headerIdx = 0;
    for (let i = 1; i <= Math.min(10, rowCount); i++) {
      const row = ws.getRow(i);
      if (!row) continue;
      const vals = [];
      for (let c = 1; c <= 20; c++) vals.push(getCellValue(row, c));
      const allText = vals.filter(v => v).join(' ');
      const matches = ['发票', 'invoices', '号码', '金额', '税额', '日期', '开票'].filter(k =>
        allText.includes(k));
      if (matches.length >= 3) { headerIdx = i; break; }
    }

    if (headerIdx === 0) headerIdx = 1;

    const headerRow = ws.getRow(headerIdx);
    const headers = [];
    const maxCol = Math.max(headerRow.cellCount, 15);
    for (let c = 1; c <= maxCol + 5; c++) {
      const h = getCellValue(headerRow, c);
      headers.push(h || `col_${c}`);
    }

    for (let r = headerIdx + 1; r <= rowCount; r++) {
      const row = ws.getRow(r);
      if (!row) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const val = getCellValue(row, c + 1);
        if (headers[c]) obj[headers[c]] = val;
      }
      const nonEmpty = Object.values(obj).filter(v => v && String(v).trim()).length;
      if (nonEmpty < 3) continue;
      records.push(normalizeRecord(obj, platform, filePath));
    }
  }
  return records;
}

async function parseJDJSON(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.JD;
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  const extractList = (obj) => {
    if (Array.isArray(obj)) return obj;
    if (!obj || typeof obj !== 'object') return [];
    for (const key of ['data', 'result', 'invoices', 'list', 'orderList', 'records', 'rows']) {
      if (obj[key]) {
        if (Array.isArray(obj[key])) return obj[key];
        const found = extractList(obj[key]);
        if (found.length) return found;
      }
    }
    for (const key of ['data', 'resp', 'response', 'body', 'payload']) {
      if (obj[key] && typeof obj[key] === 'object') {
        const found = extractList(obj[key]);
        if (found.length) return found;
      }
    }
    return [];
  };

  const records = extractList(data);
  return records.map(r => normalizeRecord(r, platform, filePath));
}

async function parseTmallTxt(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.TMALL;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const records = [];

  if (lines.length === 0) return records;

  const headerKeywords = ['发票', '号码', '代码', '日期', '金额', '税额', '合计', '类型', '买家', '卖家', '序号', '编号'];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const matches = headerKeywords.filter(kw => lines[i].includes(kw)).length;
    if (matches >= 3) { headerIdx = i; break; }
  }

  if (headerIdx >= 0) {
    const separators = ['\t', '|', '||', '    ', '  ', ','];
    let delim = '\t';
    for (const s of separators) {
      if (lines[headerIdx].split(s).filter(x => x.trim()).length >= 4) { delim = s; break; }
    }
    const header = lines[headerIdx].split(delim).map(h => h.trim());
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split(delim);
      if (parts.filter(x => x && x.trim()).length < 3) continue;
      const obj = {};
      header.forEach((h, idx) => {
        if (h && h.trim()) obj[h.trim()] = (parts[idx] || '').trim();
      });
      const hasAnyData = Object.keys(obj).some(k => obj[k] && obj[k].trim());
      if (hasAnyData) records.push(normalizeRecord(obj, platform, filePath));
    }
  }

  if (records.length === 0) {
    const keyValueGroups = [];
    let current = {};
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const sepIdx = trimmed.search(/[:：]/);
      if (sepIdx > 0 && sepIdx < trimmed.length - 1) {
        const k = trimmed.substring(0, sepIdx).trim().replace(/^[【\[].*?[】\]]\s*/, '');
        const v = trimmed.substring(sepIdx + 1).trim();
        if (k && v) current[k] = v;
      }
      const isEndOfRecord = trimmed.includes('合计') || trimmed.match(/[=—-]{5,}/);
      if (isEndOfRecord || i === lines.length - 1) {
        const hasInvoiceField = Object.keys(current).some(k =>
          /号码|代码|日期|金额|发票/.test(k)
        );
        if (hasInvoiceField && Object.keys(current).length >= 3) {
          keyValueGroups.push({ ...current });
        }
        current = {};
      }
    }
    for (const g of keyValueGroups) {
      records.push(normalizeRecord(g, platform, filePath));
    }
  }

  if (records.length === 0) {
    const hasDelimiter = (line) => {
      const counts = [
        (line.match(/\t/g) || []).length,
        (line.split('  ').length - 1),
        (line.match(/\|/g) || []).length,
      ];
      return Math.max(...counts) >= 3;
    };
    const firstDataLine = lines.findIndex(l => hasDelimiter(l));
    if (firstDataLine >= 0) {
      const line = lines[firstDataLine];
      const delims = ['\t', '  ', '|', ','];
      let d = '\t';
      for (const t of delims) {
        if ((line.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 3) {
          d = t; break;
        }
      }
      const sampleHeader = ['序号', '发票代码', '发票号码', '开票日期', '买家', '卖家', '金额', '税额', '合计', '税率', '类型'];
      for (let i = firstDataLine; i < lines.length; i++) {
        const parts = lines[i].split(d);
        if (parts.filter(p => p && p.trim()).length < 3) continue;
        if (parts.some(p => /序号|发票代码|号码|开票日期/.test(p))) continue;
        const obj = {};
        sampleHeader.forEach((h, idx) => {
          obj[h] = (parts[idx] || '').trim();
        });
        records.push(normalizeRecord(obj, platform, filePath));
      }
    }
  }

  return records;
}

async function parseJDCSV(filePath, platformHint) {
  const platform = platformHint || PLATFORMS.JD;
  return new Promise((resolve, reject) => {
    const records = [];
    let skipped = 2;
    fs.createReadStream(filePath, 'utf8')
      .pipe(parseCsv({ headers: true, skipLines: 2, delimiter: [',', '\t'], ignoreEmpty: true }))
      .on('data', (row) => {
        records.push(normalizeRecord(row, platform, filePath));
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

async function parseFile(filePath, platform = null) {
  if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  let content = '';
  try {
    content = ext === '.xlsx' || ext === '.xls' ? '' : fs.readFileSync(filePath, 'utf8');
  } catch (e) {}

  const detectedPlatform = platform || detectPlatformByContent(content, ext, fileName);
  const finalPlatform = platform && platform !== PLATFORMS.UNKNOWN ? platform : detectedPlatform;

  let records = [];
  const tryParser = async (parserFn, ...args) => {
    try { return await parserFn(...args); } catch (e) { return []; }
  };

  switch (finalPlatform) {
    case PLATFORMS.HANGXIN:
      records = await tryParser(parseHangxinXML, filePath, finalPlatform);
      if (!records.length && ext !== '.xml') records = await tryParser(parseBaiwangJSON, filePath, finalPlatform);
      break;
    case PLATFORMS.BAIWANG:
      records = await tryParser(parseBaiwangJSON, filePath, finalPlatform);
      if (!records.length) records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      break;
    case PLATFORMS.TENCENT:
      records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      if (!records.length) records = await tryParser(parseBaiwangJSON, filePath, finalPlatform);
      break;
    case PLATFORMS.ALIPAY:
      if (ext === '.csv') records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      else records = await tryParser(parseAlipayExcel, filePath, finalPlatform);
      break;
    case PLATFORMS.JD:
      if (ext === '.csv') records = await tryParser(parseJDCSV, filePath, finalPlatform);
      else records = await tryParser(parseJDJSON, filePath, finalPlatform);
      if (!records.length) records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      break;
    case PLATFORMS.TMALL:
      records = await tryParser(parseTmallTxt, filePath, finalPlatform);
      if (!records.length && ext === '.csv') records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      break;
    default:
      if (ext === '.xml') records = await tryParser(parseHangxinXML, filePath, finalPlatform);
      else if (ext === '.json') records = await tryParser(parseBaiwangJSON, filePath, finalPlatform)
                                              || await tryParser(parseJDJSON, filePath, finalPlatform);
      else if (ext === '.csv') records = await tryParser(parseTencentCSV, filePath, finalPlatform);
      else if (ext === '.xlsx' || ext === '.xls') records = await tryParser(parseAlipayExcel, filePath, finalPlatform);
      else if (ext === '.txt') records = await tryParser(parseTmallTxt, filePath, finalPlatform);
  }

  const validated = records.map(r => {
    const v = validateRecord(r);
    return { ...r, isValid: v.isValid, validationErrors: v.errors, suggestions: v.suggestions };
  });

  return {
    filePath,
    platform: finalPlatform,
    fileName,
    totalRecords: validated.length,
    validCount: validated.filter(r => r.isValid).length,
    invalidCount: validated.filter(r => !r.isValid).length,
    records: validated
  };
}

function scanDirectory(dir, options = {}) {
  const { recursive = true, extensions = ['.xml', '.json', '.csv', '.xlsx', '.xls', '.txt'] } = options;
  const results = [];
  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (recursive) walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (extensions.includes(ext)) results.push(full);
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return results;
}

module.exports = {
  parseFile,
  scanDirectory,
  parseHangxinXML,
  parseBaiwangJSON,
  parseTencentCSV,
  parseAlipayExcel,
  parseJDJSON,
  parseTmallTxt,
  normalizeRecord,
  validateRecord,
  detectPlatformByContent,
  REQUIRED_FIELDS
};
