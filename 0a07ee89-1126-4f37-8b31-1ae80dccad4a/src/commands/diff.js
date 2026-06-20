import path from 'path';
import ReconciliationEngine from '../core/reconciliationEngine.js';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import config from '../core/config.js';
import matchCmd from './match.js';
import { validateOptions, ValidationError } from '../utils/validators.js';

const TYPE_LABELS = {
  amount: '金额差异',
  time: '时间差异',
  status: '状态差异',
  missing_channel: '通道缺失',
  extra_channel: '多余流水',
  missing_order: '订单缺失',
  refund_unmatched: '退款未匹配',
  none: '一致',
};

async function loadResult(options, storage) {
  if (options.result) {
    const r = storage.loadResult(options.result);
    if (r) return r;
  }
  if (!options.orders && !options.transactions) {
    const latest = storage.latestResult();
    if (latest) {
      logger.info(`未指定数据源，自动复用最近匹配结果`);
      return latest;
    }
  }
  return matchCmd.run({ ...options, dryRun: true });
}

async function run(options = {}) {
  const cfg = config.get();
  const errors = validateOptions(options, {
    merchant: { type: 'merchant', config: cfg },
    channel: { type: 'channel', config: cfg },
  });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('diff', '参数校验失败');
  }

  const storage = new Storage(options.dataDir);
  const result = await loadResult(options, storage);
  if (!result || !result.differences) {
    logger.error('未找到匹配结果，请先执行 match 命令或指定 --result');
    return null;
  }

  let diffs = result.allDifferences || result.differences;
  if (options.merchant) diffs = diffs.filter((d) => d.merchantId === options.merchant);
  if (options.channel) diffs = diffs.filter((d) => d.channel === options.channel);

  const amountThreshold = Number(options.amountThreshold ?? cfg.rules.amountThreshold ?? 0);
  const timeThresholdMs = Number(options.timeThresholdMs ?? cfg.rules.timeThresholdMs ?? 86400000);
  if (options.minAmountDiff != null) {
    diffs = diffs.filter((d) => Math.abs(d.amountDiff) >= Number(options.minAmountDiff));
  }
  if (options.type) {
    const types = String(options.type).split(',').map((t) => t.trim());
    diffs = diffs.filter((d) => d.diffTypes.some((t) => types.includes(t)));
  }

  logger.highlight(`差异分析：共 ${diffs.length} 条差异`);
  const byType = {};
  for (const d of diffs) {
    byType[d.primaryType] = (byType[d.primaryType] || 0) + 1;
  }
  logger.info('差异分类统计：');
  logger.table(
    Object.entries(byType).map(([type, count]) => ({
      差异类型: TYPE_LABELS[type] || type,
      代码: type,
      笔数: count,
      占比: `${((count / diffs.length) * 100).toFixed(1)}%`,
    }))
  );

  const amountDiffs = diffs.filter((d) => d.diffTypes.includes('amount'));
  const totalAmountDiff = amountDiffs.reduce((s, d) => s + d.amountDiff, 0);
  logger.table([
    { 指标: '金额差异笔数', 值: amountDiffs.length },
    { 指标: '金额差异合计(分)', 值: totalAmountDiff },
    { 指标: '时间差异笔数', 值: diffs.filter((d) => d.diffTypes.includes('time')).length },
    { 指标: '状态差异笔数', 值: diffs.filter((d) => d.diffTypes.includes('status')).length },
    { 指标: '金额阈值(分)', 值: amountThreshold },
    { 指标: '时间阈值(ms)', 值: timeThresholdMs },
  ]);

  const limit = Number(options.limit ?? 50);
  logger.warn(`差异明细表（前 ${Math.min(limit, diffs.length)} 条）：`);
  logger.table(
    diffs.slice(0, limit).map((d) => ({
      订单号: d.orderId,
      商户: d.merchantId,
      通道: d.channel,
      差异类型: TYPE_LABELS[d.primaryType] || d.primaryType,
      订单金额: d.orderAmount,
      通道金额: d.channelAmount,
      金额差: d.amountDiff,
      时间差: d.timeDiffHuman,
      订单状态: d.orderStatus,
      通道状态: d.channelStatus,
    }))
  );

  const grouped = {};
  for (const d of diffs) {
    if (!grouped[d.merchantId]) grouped[d.merchantId] = [];
    grouped[d.merchantId].push(d);
  }
  if (options.byMerchant) {
    logger.info('按商户分组差异：');
    logger.table(
      Object.entries(grouped).map(([mid, list]) => ({
        商户ID: mid,
        差异笔数: list.length,
        金额差合计: list.reduce((s, d) => s + d.amountDiff, 0),
      }))
    );
  }

  const outName = options.output || `diff-${Date.now()}`;
  storage.saveResult(outName, { differences: diffs, byType, totalAmountDiff, summary: result.summary });
  logger.success(`差异分析结果已保存: ${outName}`);
  return { differences: diffs, byType, totalAmountDiff, grouped };
}

export default { run };
