import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { fromRaw, validate } from '../models/transaction.js';

const OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) => /^(records?|trades?|transactions?|items?|details?|rows?|list|entries)$/i.test(name),
};

function flatten(node) {
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = v['#text'] !== undefined ? v['#text'] : v;
      for (const [ak, av] of Object.entries(v)) {
        if (ak !== '#text') out[`${k}.${ak}`] = av;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function collectTransactions(obj, acc = []) {
  if (obj === null || typeof obj !== 'object') return acc;
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectTransactions(item, acc));
    return acc;
  }
  const looksLikeRecord = Object.keys(obj).some((k) => /order|trade|amount|txn|fee|transaction|mer/i.test(k));
  if (looksLikeRecord && !Object.values(obj).some((v) => Array.isArray(v))) {
    acc.push(flatten(obj));
    return acc;
  }
  for (const v of Object.values(obj)) {
    if (v !== null && typeof v === 'object') collectTransactions(v, acc);
  }
  return acc;
}

function transformRow(row, index, channel, options, errors) {
  try {
    const rec = fromRaw(row, channel, 'channel', options);
    const errs = validate(rec);
    if (errs.length && !rec.orderId && !rec.transactionId) {
      errors.push({ row: index + 1, message: errs.join('; '), raw: row });
      return null;
    }
    return rec;
  } catch (e) {
    errors.push({ row: index + 1, message: e.message, raw: row });
    return null;
  }
}

export function parseString(content, options = {}) {
  const channel = options.channel || 'unionpay';
  const errors = [];
  const parser = new XMLParser({ ...OPTIONS, ...(options.xmlOptions || {}) });
  let parsed;
  try {
    parsed = parser.parse(content);
  } catch (e) {
    return { records: [], errors: [{ row: 0, message: `XML解析失败: ${e.message}`, raw: null }], meta: { count: 0, format: 'xml', channel } };
  }
  const rows = collectTransactions(parsed);
  const records = [];
  rows.forEach((row, i) => {
    const rec = transformRow(row, i, channel, options, errors);
    if (rec) records.push(rec);
  });
  return { records, errors, meta: { count: records.length, total: rows.length, format: 'xml', channel } };
}

export function parseStream(filePath, options = {}) {
  const channel = options.channel || 'unionpay';
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const result = parseString(content, options);
  if (typeof options.onRecord === 'function') result.records.forEach((r) => options.onRecord(r));
  return Promise.resolve({ ...result, meta: { ...result.meta, file: filePath, size: stats.size } });
}

export function parse(filePath, options = {}) {
  return parseStream(filePath, options);
}

export default { parse, parseStream, parseString };
