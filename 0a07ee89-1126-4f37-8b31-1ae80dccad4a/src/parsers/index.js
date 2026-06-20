import fs from 'fs';
import path from 'path';
import csvParser from './csv.js';
import jsonParser from './json.js';
import xmlParser from './xml.js';
import logger from '../utils/logger.js';
import { checkIntegrity, checkFileFormat, renderReport } from './integrity.js';

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

  if (options.integrityCheck !== false) {
    const fmtCheck = checkFileFormat(filePath, format);
    const integrity = checkIntegrity(result.records, {
      declaredCount: result.meta.declaredCount ?? null,
    });
    result.integrity = integrity;
    result.formatCheck = fmtCheck;
    result.integrityReport = renderReport(integrity, fmtCheck);
  }

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

  const concurrency = options.concurrency || Math.min(files.length, 4);
  const tasks = files.map((file) => async () => {
    const channel = inferChannel(file, options.channel);
    return parseFile(file, { ...options, channel });
  });

  const allResults = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map((fn) => fn());
    const batchResults = await Promise.all(batch);
    allResults.push(...batchResults);
  }

  const allRecords = [];
  const allErrors = [];
  const metas = [];
  const integrityReports = [];
  let totalIntegrityScore = 0;
  let scoreCount = 0;

  for (const r of allResults) {
    allRecords.push(...r.records);
    allErrors.push(...r.errors.map((e) => ({ ...e, file: r.meta.file })));
    metas.push(r.meta);
    if (r.integrity) {
      totalIntegrityScore += r.integrity.overallScore;
      scoreCount++;
      integrityReports.push({ file: r.meta.file, integrity: r.integrity, formatCheck: r.formatCheck, report: r.integrityReport });
    }
  }

  const summary = {
    files: files.length,
    records: allRecords.length,
    errors: allErrors.length,
    avgIntegrityScore: scoreCount > 0 ? Math.round(totalIntegrityScore / scoreCount) : null,
  };

  return {
    records: allRecords,
    errors: allErrors,
    metas,
    integrityReports,
    integritySummary: summary,
    meta: { count: allRecords.length, files: files.length, avgIntegrityScore: summary.avgIntegrityScore },
  };
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
