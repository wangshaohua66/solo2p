import ReconciliationEngine from '../core/reconciliationEngine.js';
import { createOrder, fromRaw } from '../models/transaction.js';
import logger from '../utils/logger.js';
import Storage from '../utils/storage.js';
import config from '../core/config.js';
import matchCmd from './match.js';
import { validateOptions, ValidationError } from '../utils/validators.js';

const STAGE_LABELS = {
  payment: '通道支付',
  refund: '退款',
  reversal: '冲正',
  split: '分账',
};

async function run(options = {}) {
  const cfg = config.get();
  const errors = validateOptions(options, {
    target: { required: true },
    merchant: { type: 'merchant', config: cfg },
  });
  if (errors.length) {
    errors.forEach((e) => logger.error(`${e.field}: ${e.message}`));
    throw new ValidationError('target', '参数校验失败');
  }

  const storage = new Storage(options.dataDir);
  let result = options.result ? storage.loadResult(options.result) : null;
  if (!result && !options.orders && !options.transactions) {
    const latest = storage.latestResult();
    if (latest) {
      logger.info('未指定数据源，自动复用最近匹配结果');
      result = latest;
    }
  }
  if (!result) {
    logger.info('未指定匹配结果，将自动执行匹配以获取审计数据...');
    result = await matchCmd.run({ ...options, dryRun: true });
  }

  const engine = new ReconciliationEngine(cfg.rules);
  const orders = result.matches ? result.matches.map((m) => m.order).filter(Boolean) : [];
  const transactions = result.matches ? result.matches.map((m) => m.txn).filter(Boolean) : [];
  const allTxns = [...transactions, ...(result.refundMatches || []).map((m) => m.refund)];

  const trace = engine.traceTransaction(options.target, orders, allTxns);
  if (!trace.target) {
    logger.error(`未找到目标交易: ${options.target}`);
    return null;
  }

  logger.highlight(`审计追溯：${options.target}`);
  logger.table([
    { 项目: '订单号', 值: trace.target.orderId },
    { 项目: '通道流水号', 值: trace.target.transactionId || '-' },
    { 项目: '商户ID', 值: trace.target.merchantId },
    { 项目: '支付通道', 值: trace.target.channel },
    { 项目: '金额(分)', 值: trace.target.amount },
    { 项目: '业务类型', 值: trace.target.type },
    { 项目: '状态', 值: trace.target.status },
    { 项目: '时间', 值: trace.target.rawTimestamp || (trace.target.timestamp ? trace.target.timestamp.toISOString() : '-') },
  ]);

  logger.info('关联交易链路：');
  if (trace.chain.length === 0) {
    logger.warn('未找到关联交易链路');
  } else {
    logger.table(
      trace.chain.map((c, i) => ({
        序号: i + 1,
        阶段: c.stage,
        订单号: c.record.orderId,
        流水号: c.record.transactionId || '-',
        金额: c.record.amount,
        类型: c.record.type,
        状态: c.record.status,
        时间: c.record.rawTimestamp || (c.ts ? new Date(c.ts).toISOString() : '-'),
      }))
    );
  }

  const diff = result.allDifferences
    ? result.allDifferences.find((d) => d.orderId === options.target || d.transactionId === options.target)
    : (result.differences || []).find((d) => d.orderId === options.target || d.transactionId === options.target);

  logger.info('差异诊断：');
  if (!diff) {
    logger.success('该交易未发现差异');
  } else {
    logger.table([
      { 项目: '差异类型', 值: diff.primaryType },
      { 项目: '订单金额', 值: diff.orderAmount },
      { 项目: '通道金额', 值: diff.channelAmount },
      { 项目: '金额差', 值: diff.amountDiff },
      { 项目: '时间差', 值: diff.timeDiffHuman },
      { 项目: '订单状态', 值: diff.orderStatus },
      { 项目: '通道状态', 值: diff.channelStatus },
      { 项目: '是否跨月', 值: diff.crossMonth ? '是' : '否' },
    ]);
    logger.warn(`追溯建议: ${suggest(diff.primaryType)}`);
  }

  const auditTrail = { target: options.target, trace, diff, at: new Date().toISOString() };
  if (!options.dryRun) {
    storage.saveHistory({ id: `audit-${Date.now()}`, type: 'audit', ...auditTrail });
    logger.success('审计轨迹已记录');
  }
  return auditTrail;
}

function suggest(type) {
  const map = {
    amount: '核对金额单位与手续费',
    time: '确认通道入账时延',
    status: '比对状态机映射',
    missing_channel: '排查通道文件完整性',
    extra_channel: '排查订单系统数据',
    refund_unmatched: '核对原订单号变更',
  };
  return map[type] || '请人工核查';
}

export default { run };
