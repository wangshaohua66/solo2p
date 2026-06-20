import fs from 'fs';
import readline from 'readline';
import { fromRaw, validate } from '../models/transaction.js';

function findArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    for (const key of ['records', 'data', 'items', 'list', 'result', 'details', 'transactions', 'tradeList']) {
      if (Array.isArray(obj[key])) return obj[key];
    }
    const arrays = Object.values(obj).filter((v) => Array.isArray(v));
    if (arrays.length === 1) return arrays[0];
  }
  return [];
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
  const channel = options.channel || 'alipay';
  const errors = [];
  const trimmed = content.trim();
  if (trimmed === '') return { records: [], errors, meta: { count: 0, format: 'json', channel } };

  const ndjsonGuess = !trimmed.startsWith('[') && !trimmed.startsWith('{"');
  if (ndjsonGuess && trimmed.split('\n').every((l, i) => l.trim() === '' || l.trim().startsWith('{') || l.trim().startsWith('}'))) {
    const lines = trimmed.split('\n').filter((l) => l.trim() !== '' && l.trim().startsWith('{'));
    const records = [];
    lines.forEach((line, i) => {
      try {
        const obj = JSON.parse(line);
        const rec = transformRow(obj, i, channel, options, errors);
        if (rec) records.push(rec);
      } catch (e) {
        errors.push({ row: i + 1, message: `JSON行解析失败: ${e.message}`, raw: line });
      }
    });
    return { records, errors, meta: { count: records.length, format: 'ndjson', channel } };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { records: [], errors: [{ row: 0, message: `JSON解析失败: ${e.message}`, raw: null }], meta: { count: 0, format: 'json', channel } };
  }
  const arr = findArray(parsed);
  const records = [];
  arr.forEach((row, i) => {
    const rec = transformRow(row, i, channel, options, errors);
    if (rec) records.push(rec);
  });
  return { records, errors, meta: { count: records.length, total: arr.length, format: 'json', channel } };
}

export function parseStream(filePath, options = {}) {
  const channel = options.channel || 'alipay';
  const stats = fs.statSync(filePath);
  const errors = [];
  const records = [];
  const isNdjson = options.ndjson || /\.ndjson$|\.jsonl$/i.test(filePath);

  if (!isNdjson) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseString(content, options);
    if (typeof options.onRecord === 'function') result.records.forEach((r) => options.onRecord(r));
    return Promise.resolve({ ...result, meta: { ...result.meta, file: filePath, size: stats.size } });
  }

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
    let index = 0;
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed === '') return;
      index++;
      try {
        const obj = JSON.parse(trimmed);
        const rec = transformRow(obj, index - 1, channel, options, errors);
        if (rec) {
          records.push(rec);
          if (typeof options.onRecord === 'function') options.onRecord(rec);
        }
      } catch (e) {
        errors.push({ row: index, message: `JSON行解析失败: ${e.message}`, raw: trimmed });
      }
    });
    rl.on('error', (err) => reject(new Error(`文件读取失败: ${err.message}`)));
    rl.on('close', () => {
      resolve({
        records,
        errors,
        meta: { count: records.length, total: index, format: 'ndjson', channel, file: filePath, size: stats.size },
      });
    });
  });
}

export function parse(filePath, options = {}) {
  return parseStream(filePath, options);
}

export default { parse, parseStream, parseString };
