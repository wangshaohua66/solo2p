import fs from 'fs';
import path from 'path';
import ReconciliationEngine from '../core/reconciliationEngine.js';
import { parseFile } from '../parsers/index.js';
import { createOrder, fromRaw, CHANNELS } from '../models/transaction.js';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import config from '../core/config.js';
import { validateOptions, ValidationError } from '../utils/validators.js';

async function loadRecords(spec, storage, opts = {}) {
  if (!spec) return [];
  const resolved = path.resolve(spec);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const result = await parseFile(resolved, { channel: opts.channel || 'wechat', preserveChannel: opts.preserveChannel });
    return result.records;
  }
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const { parseDirectory } = await import('../parsers/index.js');
    const r = await parseDirectory(resolved, { channel: opts.channel, preserveChannel: opts.preserveChannel });
    return r.records;
  }
  const name = path.basename(spec, path.extname(spec));
  return storage.loadRecords(name);
}

async function run(options = {}) {
  const cfg = config.get();
  const rules = { ...cfg.rules, ...options };
  const errors = validateOptions(options, {
    orders: { type: 'filepath' },
    transactions: { type: 'filepath' },
    merchant: { type: 'merchant', config: cfg },
    channel: { type: 'channel', config: cfg },
  });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('orders', '参数校验失败');
  }

  const storage = new Storage(options.dataDir);
  const ordersSpec = options.orders || 'orders';
  const txnSpec = options.transactions || 'transactions';

  let orders = await loadRecords(ordersSpec, storage, { channel: 'order', preserveChannel: true });
  let transactions = await loadRecords(txnSpec, storage, { channel: options.channel });

  if (orders.length === 0 && fs.existsSync(path.resolve('data', 'orders.json'))) {
    orders = await loadRecords(path.resolve('data', 'orders.json'), storage, { channel: 'order', preserveChannel: true });
  }
  if (transactions.length === 0 && fs.existsSync(path.resolve('data', 'transactions'))) {
    transactions = await loadRecords(path.resolve('data', 'transactions'), storage, { channel: options.channel });
  }

  orders = orders.map((o) => {
    const base = o.source === 'order' ? o : createOrder(o);
    const rawChannel = base.raw && base.raw.channel;
    const realChannel = rawChannel && CHANNELS.includes(rawChannel) ? rawChannel : base.channel;
    return { ...base, channel: CHANNELS.includes(realChannel) ? realChannel : 'unknown', source: 'order' };
  });
  transactions = transactions.map((t) => (t.channel ? t : fromRaw(t, options.channel || 'wechat', 'channel')));

  if (options.merchant) {
    orders = orders.filter((o) => o.merchantId === options.merchant);
    transactions = transactions.filter((t) => t.merchantId === options.merchant);
  }
  if (options.channel) {
    transactions = transactions.filter((t) => t.channel === options.channel);
  }

  logger.highlight(`匹配开始：订单 ${orders.length} 条，通道流水 ${transactions.length} 条`);
  logger.info(`规则：时间窗口 T+${rules.timeWindowDays ?? 1}，模糊匹配 ${rules.fuzzy ? '开' : '关'}，金额阈值 ${rules.amountThreshold ?? 1} 分`);

  if (orders.length === 0 || transactions.length === 0) {
    logger.warn('订单或通道流水为空，无法执行匹配');
    return { matched: 0, matchRate: 0, unmatchedOrders: [], unmatchedTransactions: [] };
  }

  const engine = new ReconciliationEngine({
    timeWindowDays: Number(rules.timeWindowDays ?? 1),
    fuzzy: rules.fuzzy !== false,
    fuzzyThreshold: rules.fuzzyThreshold ?? 0.85,
    amountTolerance: rules.amountTolerance ?? 0,
    amountThreshold: rules.amountThreshold ?? 1,
    timeThresholdMs: rules.timeThresholdMs ?? 86400000,
    refundWindowDays: rules.refundWindowDays ?? 90,
    allowPartialRefund: rules.allowPartialRefund !== false,
  });

  const paymentTotal = transactions.filter((t) => !t.type || t.type === 'payment').length;
  logger.startProgress(paymentTotal, '匹配');
  const result = engine.reconcile(orders, transactions, {
    onProgress: () => logger.tickProgress(1),
  });

  const { summary } = result;
  logger.success(`匹配完成：匹配率 ${(summary.matchRate * 100).toFixed(2)}% (${summary.matched}/${summary.channelCount})`);
  logger.table([
    { 指标: '订单数', 值: summary.orderCount },
    { 指标: '通道流水数', 值: summary.channelCount },
    { 指标: '成功匹配', 值: summary.matched },
    { 指标: '未匹配订单', 值: summary.unmatchedOrders },
    { 指标: '未匹配流水', 值: summary.unmatchedTransactions },
    { 指标: '退款匹配', 值: summary.refundMatched },
    { 指标: '跨月交易', 值: summary.crossMonth },
    { 指标: '差异笔数', 值: result.differences.length },
  ]);

  if (result.differences.length > 0 && options.verbose) {
    logger.warn(`差异明细（前 10 条，共 ${result.differences.length} 条）：`);
    logger.table(
      result.differences.slice(0, 10).map((d) => ({
        订单号: d.orderId,
        商户: d.merchantId,
        通道: d.channel,
        差异类型: d.primaryType,
        金额差: d.amountDiff,
        时间差: d.timeDiffHuman,
      }))
    );
  }

  if (result.differences.length > 0) {
    logger.logMatchException({
      stage: 'match',
      diffCount: result.differences.length,
      unmatched: { orders: summary.unmatchedOrders, transactions: summary.unmatchedTransactions },
      at: new Date().toISOString(),
    });
  }

  if (options.dryRun) {
    logger.warn('DRY-RUN：结果未持久化');
    return result;
  }

  const name = options.output || `match-${Date.now()}`;
  storage.saveResult(name, result);
  storage.saveHistory({
    id: name,
    type: 'match',
    merchantId: options.merchant,
    channel: options.channel,
    orderCount: summary.orderCount,
    txnCount: summary.channelCount,
    matched: summary.matched,
    matchRate: summary.matchRate,
    diffCount: result.differences.length,
    createdAt: new Date().toISOString(),
  });
  logger.success(`匹配结果已保存: ${name}`);
  return result;
}

export default { run };
