import fs from 'fs';
import readline from 'readline';
import { fromRaw, validate } from '../models/transaction.js';

const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

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

function parseNdjsonStream(filePath, channel, options, stats) {
  return new Promise((resolve) => {
    const records = [];
    const errors = [];
    let index = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity });
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
    rl.on('error', (err) => {
      errors.push({ row: null, message: `文件读取失败: ${err.message}`, raw: null });
    });
    rl.on('close', () => {
      resolve({
        records,
        errors,
        meta: { count: records.length, total: index, format: 'ndjson', channel, file: filePath, size: stats.size, streamed: true },
      });
    });
  });
}

function parseJsonArrayStream(filePath, channel, options, stats) {
  return new Promise((resolve) => {
    const records = [];
    const errors = [];
    let index = 0;
    let buf = '';
    let inArray = false;
    let depth = 0;
    let objStart = -1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let inString = false;
    let stringChar = '';
    let escapeNext = false;

    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024 });

    function emitObject(objStr, lineIdx) {
      try {
        const obj = JSON.parse(objStr);
        const rec = transformRow(obj, lineIdx, channel, options, errors);
        if (rec) {
          records.push(rec);
          if (typeof options.onRecord === 'function') options.onRecord(rec);
        }
      } catch (e) {
        errors.push({ row: lineIdx + 1, message: `JSON对象解析失败: ${e.message}`, raw: objStr.slice(0, 200) });
      }
    }

    function processChunk() {
      let i = 0;
      while (i < buf.length) {
        const ch = buf[i];

        if (!inArray) {
          if (ch === '[') {
            inArray = true;
            depth = 1;
            i++;
            continue;
          }
          i++;
          continue;
        }

        if (inString) {
          if (escapeNext) {
            escapeNext = false;
          } else if (ch === '\\') {
            escapeNext = true;
          } else if (ch === stringChar) {
            inString = false;
          }
          i++;
          continue;
        }

        if (ch === '"' || ch === "'") {
          inString = true;
          stringChar = ch;
          i++;
          continue;
        }

        if (ch === '{') {
          if (bracketDepth === 0 && depth === 1) {
            objStart = i;
          }
          braceDepth++;
          i++;
          continue;
        }
        if (ch === '}') {
          braceDepth--;
          if (braceDepth === 0 && bracketDepth === 0 && depth === 1 && objStart >= 0) {
            const objStr = buf.slice(objStart, i + 1);
            emitObject(objStr, index);
            index++;
            objStart = -1;
          }
          i++;
          continue;
        }

        if (ch === '[') {
          bracketDepth++;
          i++;
          continue;
        }
        if (ch === ']') {
          if (bracketDepth === 0 && braceDepth === 0) {
            depth--;
            if (depth === 0) {
              buf = '';
              i = buf.length;
              continue;
            }
          } else {
            bracketDepth--;
          }
          i++;
          continue;
        }

        i++;
      }

      if (buf.length > 10 * 1024 * 1024) {
        buf = buf.slice(buf.length - 5 * 1024 * 1024);
      }
    }

    stream.on('data', (chunk) => {
      buf += chunk;
      processChunk();
    });

    stream.on('error', (err) => {
      errors.push({ row: null, message: `文件读取失败: ${err.message}`, raw: null });
      finish();
    });

    stream.on('end', finish);

    function finish() {
      resolve({
        records,
        errors,
        meta: { count: records.length, total: index, format: 'json', channel, file: filePath, size: stats.size, streamed: true },
      });
    }
  });
}

export function parseStream(filePath, options = {}) {
  const channel = options.channel || 'alipay';
  const stats = fs.statSync(filePath);
  const isNdjson = options.ndjson || /\.ndjson$|\.jsonl$/i.test(filePath);

  if (isNdjson) {
    return parseNdjsonStream(filePath, channel, options, stats);
  }

  if (stats.size < LARGE_FILE_THRESHOLD && !options.forceStream) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseString(content, options);
    if (typeof options.onRecord === 'function') result.records.forEach((r) => options.onRecord(r));
    return Promise.resolve({ ...result, meta: { ...result.meta, file: filePath, size: stats.size, streamed: false } });
  }

  return parseJsonArrayStream(filePath, channel, options, stats);
}

export function parse(filePath, options = {}) {
  return parseStream(filePath, options);
}

export default { parse, parseStream, parseString };
