import fs from 'fs';
import path from 'path';
import { parseFile, parseDirectory, detectFormat } from '../parsers/index.js';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import { validateOptions, ValidationError } from '../utils/validators.js';
import { isComplete } from '../models/transaction.js';
import { globalMonitor } from '../utils/memoryMonitor.js';

async function run(options = {}) {
  const errors = validateOptions(options, {
    source: { required: true, type: 'filepath', mustExist: true },
    channel: { type: 'channel' },
    format: { enum: ['csv', 'json', 'ndjson', 'xml', 'auto'] },
  });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('source', '参数校验失败');
  }

  const source = path.resolve(options.source);
  const isDir = fs.statSync(source).isDirectory();
  const dryRun = options.dryRun;
  const incremental = options.incremental !== false;
  const storage = new Storage(options.dataDir);

  logger.highlight(`开始导入 ${isDir ? '目录' : '文件'}: ${source}`);
  if (dryRun) logger.warn('DRY-RUN 模式：仅预检，不落盘');

  const monitor = options.memoryLimit ? globalMonitor : null;
  if (monitor) monitor.start();

  const parseOpts = {
    channel: options.channel,
    format: options.format === 'auto' ? undefined : options.format,
  };

  let result;
  if (isDir) {
    result = await parseDirectory(source, parseOpts);
  } else {
    const format = parseOpts.format || detectFormat(source);
    if (incremental && !options.force && storage.isImported(source)) {
      logger.info(`文件已导入过，跳过（增量模式）: ${source}`);
      const existing = await storage.loadRecords(path.basename(source, path.extname(source)));
      if (monitor) monitor.stop();
      return { skipped: true, records: existing, source, dryRun };
    }
    result = await parseFile(source, { ...parseOpts, format });
    result.meta = { ...result.meta, files: 1 };
  }

  if (monitor) {
    monitor.stop();
    const stats = monitor.getStats();
    logger.info(`内存峰值: RSS ${(stats.peakRSS / 1024 / 1024).toFixed(1)} MB, Heap ${(stats.peakHeap / 1024 / 1024).toFixed(1)} MB`);
  }

  if (result.integritySummary) {
    const s = result.integritySummary;
    logger.info(`文件完整性平均得分: ${s.avgIntegrityScore ?? 'N/A'}/100 (${s.files} 个文件, ${s.records} 条记录)`);
    if (result.integrityReports) {
      for (const r of result.integrityReports) {
        if (r.integrity.warnings.length > 0 || r.integrity.errors.length > 0) {
          logger.warn(`${path.basename(r.file)} 完整性得分 ${r.integrity.overallScore}/100`);
        }
      }
    }
  } else if (result.integrity) {
    logger.info(`文件完整性得分: ${result.integrity.overallScore}/100`);
  }

  const complete = result.records.filter(isComplete);
  const incomplete = result.records.filter((r) => !isComplete(r));

  logger.startProgress(result.records.length, '导入');
  for (let i = 0; i < result.records.length; i += 500) {
    logger.tickProgress(Math.min(500, result.records.length - i));
  }

  logger.success(`导入完成：成功 ${complete.length} 条，不完整 ${incomplete.length} 条，错误 ${result.errors.length} 条`);

  if (result.errors.length > 0) {
    logger.warn('解析错误明细（前 20 条）：');
    const errRows = result.errors.slice(0, 20).map((e, i) => ({
      '#': i + 1,
      文件: e.file ? path.basename(e.file) : '-',
      行号: e.row,
      错误: e.message,
    }));
    logger.table(errRows);
    logger.logMatchException({ stage: 'import', errors: result.errors, source, at: new Date().toISOString() });
  }

  if (options.verbose && complete.length > 0) {
    logger.info('前 5 条记录预览：');
    logger.table(
      complete.slice(0, 5).map((r) => ({
        订单号: r.orderId,
        商户: r.merchantId,
        通道: r.channel,
        金额: r.amount,
        类型: r.type,
        状态: r.status,
        时间: r.rawTimestamp,
      }))
    );
  }

  if (options.integrity && result.integrityReport) {
    logger.info('');
    logger.highlight('=== 文件完整性校验报告 ===');
    console.log(result.integrityReport);
  }

  if (dryRun) {
    logger.info('DRY-RUN 结束，未写入数据');
    return { records: result.records, errors: result.errors, meta: result.meta, dryRun: true };
  }

  if (isDir) {
    for (const meta of result.metas || []) {
      if (meta.file) storage.markImported(meta.file, meta);
    }
    await storage.saveRecords(`dir-${Date.now()}`, result.records);
  } else {
    const name = path.basename(source, path.extname(source));
    await storage.saveRecords(name, result.records);
    storage.markImported(source, result.meta);
  }

  storage.saveHistory({
    id: `import-${Date.now()}`,
    type: 'import',
    source,
    isDir,
    channel: options.channel,
    recordCount: result.records.length,
    errorCount: result.errors.length,
    integrityScore: result.meta?.avgIntegrityScore ?? (result.integrity?.overallScore ?? null),
    createdAt: new Date().toISOString(),
  });

  logger.success('数据已持久化');
  return { records: result.records, errors: result.errors, meta: result.meta };
}

export default { run };
