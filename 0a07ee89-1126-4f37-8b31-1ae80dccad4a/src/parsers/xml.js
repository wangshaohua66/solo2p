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

const TXN_TAGS = ['trade', 'record', 'transaction', 'item', 'detail', 'order', 'row', 'entry'];
const TXN_START_RE = /<\s*(trade|record|transaction|item|detail|order|row|entry)\b[^>]*>/i;
const TXN_END_RE = /<\/\s*(trade|record|transaction|item|detail|order|row|entry)\s*>/i;

function flatten(node) {
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub = flatten(v);
      for (const [sk, sv] of Object.entries(sub)) {
        out[sk] = sv;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function transformRow(row, index, channel, options, errors) {
  try {
    const flat = flatten(row);
    const rec = fromRaw(flat, channel, 'channel', options);
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
  const parser = new XMLParser(OPTIONS);
  const errors = [];
  const records = [];
  let obj;
  try {
    obj = parser.parse(content);
  } catch (e) {
    return { records: [], errors: [{ row: 0, message: `XML解析失败: ${e.message}`, raw: null }], meta: { count: 0, format: 'xml', channel } };
  }
  const list = collectTransactions(obj);
  list.forEach((row, i) => {
    const rec = transformRow(row, i, channel, options, errors);
    if (rec) records.push(rec);
  });
  return { records, errors, meta: { count: records.length, total: list.length, format: 'xml', channel } };
}

function collectTransactions(obj) {
  const results = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (TXN_TAGS.some((t) => t.toLowerCase() === key.toLowerCase())) {
        if (Array.isArray(value)) results.push(...value);
        else results.push(value);
      } else if (value && typeof value === 'object') {
        walk(value);
      }
    }
  }
  walk(obj);
  return results;
}

export function parseStream(filePath, options = {}) {
  const channel = options.channel || 'unionpay';
  const stats = fs.statSync(filePath);
  const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

  if (stats.size < LARGE_FILE_THRESHOLD && !options.forceStream) {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseString(content, options);
    if (typeof options.onRecord === 'function') result.records.forEach((r) => options.onRecord(r));
    return Promise.resolve({ ...result, meta: { ...result.meta, file: filePath, size: stats.size, streamed: false } });
  }

  return new Promise((resolve) => {
    const records = [];
    const errors = [];
    let index = 0;
    let buf = '';
    const tagStack = [];
    let capturing = false;
    let captureBuf = '';
    let captureDepth = 0;

    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024 });

    function emitRecord(xml) {
      try {
        const parser = new XMLParser(OPTIONS);
        const obj = parser.parse(xml);
        const list = collectTransactions(obj);
        for (const row of list) {
          const rec = transformRow(row, index, channel, options, errors);
          if (rec) {
            records.push(rec);
            if (typeof options.onRecord === 'function') options.onRecord(rec);
          }
          index++;
        }
      } catch (e) {
        errors.push({ row: index + 1, message: `XML节点解析失败: ${e.message}`, raw: null });
        index++;
      }
    }

    function processBuffer() {
      let pos = 0;
      while (pos < buf.length) {
        const ltIdx = buf.indexOf('<', pos);
        if (ltIdx === -1) {
          if (capturing) captureBuf += buf.slice(pos);
          buf = '';
          return;
        }

        const gtIdx = buf.indexOf('>', ltIdx);
        if (gtIdx === -1) {
          if (capturing) captureBuf += buf.slice(pos);
          buf = buf.slice(pos);
          return;
        }

        const beforeTag = buf.slice(pos, ltIdx);
        const tagStr = buf.slice(ltIdx, gtIdx + 1);
        pos = gtIdx + 1;

        if (capturing) captureBuf += beforeTag + tagStr;

        const isClosing = tagStr.startsWith('</');
        const isSelfClosing = tagStr.endsWith('/>') || tagStr.endsWith(' />');
        const tagMatch = tagStr.match(/^<\/?\s*([a-zA-Z_][\w:.-]*)/);
        if (!tagMatch) continue;
        const tagName = tagMatch[1].toLowerCase();

        if (isClosing) {
          if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
            tagStack.pop();
            if (capturing && tagStack.length < captureDepth) {
              const fullTag = captureBuf;
              capturing = false;
              captureDepth = 0;
              captureBuf = '';
              emitRecord(fullTag);
            }
          }
        } else if (!isSelfClosing) {
          tagStack.push(tagName);
          if (!capturing && TXN_TAGS.some((t) => t.toLowerCase() === tagName)) {
            capturing = true;
            captureDepth = tagStack.length;
            captureBuf = tagStr;
          }
        }
      }
      buf = buf.slice(pos);
    }

    stream.on('data', (chunk) => {
      buf += chunk;
      processBuffer();
    });

    stream.on('error', (err) => {
      errors.push({ row: null, message: `文件读取失败: ${err.message}`, raw: null });
      finish();
    });

    stream.on('end', finish);

    function finish() {
      if (capturing && captureBuf) {
        try {
          const parser = new XMLParser(OPTIONS);
          const obj = parser.parse(captureBuf);
          const list = collectTransactions(obj);
          for (const row of list) {
            const rec = transformRow(row, index, channel, options, errors);
            if (rec) {
              records.push(rec);
              if (typeof options.onRecord === 'function') options.onRecord(rec);
            }
            index++;
          }
        } catch (_) { /* 最后不完整节点忽略 */ }
      }
      resolve({
        records,
        errors,
        meta: { count: records.length, total: index, format: 'xml', channel, file: filePath, size: stats.size, streamed: true },
      });
    }
  });
}

export function parse(filePath, options = {}) {
  return parseStream(filePath, options);
}

export default { parse, parseStream, parseString, collectTransactions };
