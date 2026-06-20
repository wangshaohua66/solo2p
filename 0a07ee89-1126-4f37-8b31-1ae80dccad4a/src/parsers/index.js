import fs from 'fs';
import path from 'path';
import csvParser from './csv.js';
import jsonParser from './json.js';
import xmlParser from './xml.js';
import logger from '../utils/logger.js';

const EXT_MAP = {
  '.csv': 'csv',
  '.tsv': 'csv',
  '.json': 'json',
  '.ndjson': 'ndjson',
  '.jsonl': 'ndjson',
  '.xml': 'xml',
};

const PARSERS = { csv: csvParser, json: jsonParser, ndjson: jsonParser, xml: xmlParser };

function detectByContent(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(4096);
  const bytes = fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  const head = buf.slice(0, bytes).toString('utf8').trim();
  if (head.startsWith('<?xml') || head.startsWith('<')) return 'xml';
  if (head.startsWith('[')) return 'json';
  if (head.startsWith('{')) {
    const firstLine = head.split('\n')[0];
    if (firstLine.endsWith('}')) return 'ndjson';
    return 'json';
  }
  return 'csv';
}

export function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  return detectByContent(filePath);
}

export function getParser(format) {
  return PARSERS[format] || PARSERS.csv;
}

export async function parseFile(filePath, options = {}) {
  const format = options.format || detectFormat(filePath);
  const parser = getParser(format);
  logger.debug(`解析文件 ${filePath} (格式=${format})`);
  const result = await parser.parse(filePath, options);
  result.meta = { ...result.meta, format, file: filePath };
  return result;
}

export async function parseDirectory(dirPath, options = {}) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => path.join(dirPath, e.name))
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return EXT_MAP[ext] || options.includeAll;
    });
  logger.info(`发现 ${files.length} 个待导入文件`);
  const allRecords = [];
  const allErrors = [];
  const metas = [];
  for (const file of files) {
    const channel = inferChannel(file, options.channel);
    const result = await parseFile(file, { ...options, channel });
    allRecords.push(...result.records);
    allErrors.push(...result.errors.map((e) => ({ ...e, file })));
    metas.push(result.meta);
  }
  return { records: allRecords, errors: allErrors, metas, meta: { count: allRecords.length, files: files.length } };
}

function inferChannel(filePath, fallback) {
  const base = path.basename(filePath).toLowerCase();
  if (/wechat|weixin|wx|微信/.test(base)) return 'wechat';
  if (/alipay|ali|支付宝/.test(base)) return 'alipay';
  if (/unionpay|union|up|银联|cup/.test(base)) return 'unionpay';
  return fallback || 'wechat';
}

export { csvParser, jsonParser, xmlParser };
export default { parseFile, parseDirectory, detectFormat, getParser };
