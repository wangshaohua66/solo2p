import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import config from '../core/config.js';
import { validateOptions, ValidationError } from '../utils/validators.js';
import { isValidDate } from '../utils/validators.js';

async function run(action, options = {}) {
  const cfg = config.get();
  if (action === 'export') return exportHistory(cfg, options);

  const errors = validateOptions(options, {
    merchant: { type: 'merchant', config: cfg },
    channel: { type: 'channel', config: cfg },
  });
  if (options.startDate && !isValidDate(options.startDate)) errors.push(new ValidationError('startDate', `日期格式无效: ${options.startDate}`));
  if (options.endDate && !isValidDate(options.endDate)) errors.push(new ValidationError('endDate', `日期格式无效: ${options.endDate}`));
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('history', '参数校验失败');
  }

  const storage = new Storage(options.dataDir);
  const records = storage.queryHistory({
    merchantId: options.merchant,
    channel: options.channel,
    startDate: options.startDate,
    endDate: options.endDate,
  });

  const typeFilter = options.type;
  const filtered = typeFilter ? records.filter((r) => r.type === typeFilter) : records;

  logger.highlight(`历史对账记录：共 ${filtered.length} 条`);
  if (filtered.length === 0) {
    logger.warn('无匹配的历史记录');
    return [];
  }

  const limit = Number(options.limit ?? 50);
  logger.table(
    filtered.slice(0, limit).map((r) => ({
      ID: r.id,
      类型: r.type,
      商户: r.merchantId || '-',
      通道: r.channel || '-',
      订单数: r.orderCount ?? '-',
      匹配率: r.matchRate != null ? `${(r.matchRate * 100).toFixed(1)}%` : '-',
      差异数: r.diffCount ?? r.errorCount ?? '-',
      时间: r.createdAt,
    }))
  );

  const byType = {};
  for (const r of filtered) byType[r.type] = (byType[r.type] || 0) + 1;
  logger.info('按类型统计:');
  logger.table(Object.entries(byType).map(([t, c]) => ({ 类型: t, 笔数: c })));

  return filtered;
}

async function exportHistory(cfg, options) {
  const storage = new Storage(options.dataDir);
  const records = storage.queryHistory({
    merchantId: options.merchant,
    channel: options.channel,
    startDate: options.startDate,
    endDate: options.endDate,
  });

  const outputDir = options.outputDir || cfg.storage.outputDir || path.join(process.cwd(), 'reports');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  if (options.format === 'json' || !options.format) {
    const file = path.join(outputDir, `history-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf8');
    logger.success(`历史记录已导出(JSON): ${file}`);
  }
  if (options.format === 'xlsx' || !options.format) {
    const ws = XLSX.utils.json_to_sheet(
      records.map((r) => ({
        ID: r.id,
        类型: r.type,
        商户ID: r.merchantId || '',
        通道: r.channel || '',
        订单数: r.orderCount ?? '',
        流水数: r.txnCount ?? '',
        匹配数: r.matched ?? '',
        匹配率: r.matchRate != null ? r.matchRate : '',
        差异数: r.diffCount ?? r.errorCount ?? '',
        创建时间: r.createdAt,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '历史记录');
    const file = path.join(outputDir, `history-${Date.now()}.xlsx`);
    XLSX.writeFile(wb, file);
    logger.success(`历史记录已导出(Excel): ${file}`);
  }
  return records.length;
}

export default { run };
