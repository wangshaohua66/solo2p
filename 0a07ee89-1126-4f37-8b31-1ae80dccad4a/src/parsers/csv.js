import { parse as csvParse } from 'csv-parse';
import fs from 'fs';
import { fromRaw, validate } from '../models/transaction.js';

const DEFAULT_OPTIONS = {
  columns: true,
  trim: true,
  skip_empty_lines: true,
  relax_column_count: true,
  bom: true,
  cast: true,
};

function extractLine(err) {
  const m = /line\s+(\d+)/i.exec(err && err.message ? err.message : '');
  return m ? Number(m[1]) : (err && err.context && err.context.lines) || null;
}

function transformRow(row, index, channel, options, errors, records) {
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
  const channel = options.channel || 'wechat';
  const records = [];
  const errors = [];
  return new Promise((resolve) => {
    const parser = csvParse({ ...DEFAULT_OPTIONS, ...options.csvOptions });
    let settled = false;
    let index = 0;
    parser.on('data', (row) => {
      const rec = transformRow(row, index, channel, options, errors, records);
      if (rec) records.push(rec);
      index++;
    });
    parser.on('error', (err) => {
      if (settled) return;
      settled = true;
      errors.push({ row: extractLine(err), message: `CSV解析错误: ${err.message}`, raw: null });
      resolve({ records, errors, meta: { count: records.length, format: 'csv', channel } });
    });
    parser.on('end', () => {
      if (settled) return;
      settled = true;
      resolve({ records, errors, meta: { count: records.length, format: 'csv', channel } });
    });
    parser.write(content);
    parser.end();
  });
}

export function parseStream(filePath, options = {}) {
  const channel = options.channel || 'wechat';
  const records = [];
  const errors = [];
  let count = 0;
  return new Promise((resolve) => {
    const parser = csvParse({ ...DEFAULT_OPTIONS, ...options.csvOptions });
    const source = fs.createReadStream(filePath, { encoding: 'utf8' });
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve({
        records,
        errors,
        meta: { count: records.length, total: count, format: 'csv', channel, file: filePath },
      });
    };
    source.on('error', (err) => {
      errors.push({ row: null, message: `文件读取失败: ${err.message}`, raw: null });
      done();
    });
    parser.on('data', (row) => {
      count++;
      const rec = transformRow(row, count - 1, channel, options, errors, records);
      if (rec) {
        records.push(rec);
        if (typeof options.onRecord === 'function') options.onRecord(rec);
      }
    });
    parser.on('error', (err) => {
      errors.push({ row: extractLine(err), message: `CSV解析错误: ${err.message}`, raw: null });
      done();
    });
    parser.on('end', done);
    source.pipe(parser);
  });
}

export function parse(filePath, options = {}) {
  return parseStream(filePath, options);
}

export default { parse, parseStream, parseString };
