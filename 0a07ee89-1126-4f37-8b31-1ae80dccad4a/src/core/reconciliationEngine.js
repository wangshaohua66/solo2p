import OrderMatcher from '../matchers/orderMatcher.js';
import RefundMatcher, { REFUND_TYPES } from '../matchers/refundMatcher.js';
import { differenceMs, isCrossMonth } from '../utils/dateNormalizer.js';

const DAY_MS = 86400000;

const DIFF_TYPES = {
  AMOUNT: 'amount',
  TIME: 'time',
  STATUS: 'status',
  MISSING_CHANNEL: 'missing_channel',
  EXTRA_CHANNEL: 'extra_channel',
  MISSING_ORDER: 'missing_order',
  REFUND_UNMATCHED: 'refund_unmatched',
  NONE: 'none',
};

function isPayment(rec) {
  return !rec.type || rec.type === 'payment';
}

function isRefundLike(rec) {
  return REFUND_TYPES.has(rec.type);
}

class ReconciliationEngine {
  constructor(options = {}) {
    this.options = options;
    this.amountThreshold = options.amountThreshold ?? 1;
    this.timeThresholdMs = options.timeThresholdMs ?? DAY_MS;
    this.orderMatcher = new OrderMatcher({
      timeWindowDays: options.timeWindowDays ?? 1,
      fuzzy: options.fuzzy !== false,
      fuzzyThreshold: options.fuzzyThreshold ?? 0.85,
      fuzzyAmountRatio: options.fuzzyAmountRatio ?? 0.1,
      amountTolerance: options.amountTolerance ?? 0,
    });
    this.refundMatcher = new RefundMatcher({
      timeWindowDays: options.refundWindowDays ?? 90,
      fuzzy: options.fuzzy !== false,
      allowPartialRefund: options.allowPartialRefund !== false,
    });
  }

  splitByType(records) {
    const payments = [];
    const refunds = [];
    for (const r of records) {
      if (isRefundLike(r)) refunds.push(r);
      else if (isPayment(r)) payments.push(r);
    }
    return { payments, refunds };
  }

  classifyMatch(match) {
    const { order, txn, timeDiffMs } = match;
    const amountDiff = (txn.amount || 0) - (order.amount || 0);
    const types = [];
    if (Math.abs(amountDiff) > this.amountThreshold) types.push(DIFF_TYPES.AMOUNT);
    if (timeDiffMs !== null && Math.abs(timeDiffMs) > this.timeThresholdMs) types.push(DIFF_TYPES.TIME);
    if (order.status && txn.status && order.status !== txn.status) types.push(DIFF_TYPES.STATUS);
    if (types.length === 0) types.push(DIFF_TYPES.NONE);
    return { types, amountDiff, timeDiffMs, statusMismatch: order.status !== txn.status };
  }

  buildDiffRecord(match) {
    const cls = this.classifyMatch(match);
    const order = match.order;
    const txn = match.txn;
    return {
      orderId: order.orderId,
      transactionId: txn.transactionId,
      merchantId: order.merchantId,
      channel: txn.channel,
      matchType: match.matchType,
      matchScore: match.score,
      orderAmount: order.amount,
      channelAmount: txn.amount,
      amountDiff: cls.amountDiff,
      timeDiffMs: cls.timeDiffMs,
      timeDiffHuman: this.humanizeMs(cls.timeDiffMs),
      orderStatus: order.status,
      channelStatus: txn.status,
      statusMismatch: cls.statusMismatch,
      orderTime: order.timestamp,
      channelTime: txn.timestamp,
      diffTypes: cls.types,
      primaryType: cls.types.find((t) => t !== DIFF_TYPES.NONE) || DIFF_TYPES.NONE,
      crossMonth: order.timestamp && txn.timestamp ? isCrossMonth(order.timestamp, txn.timestamp) : false,
      order: match.order,
      txn: match.txn,
    };
  }

  humanizeMs(ms) {
    if (ms === null || ms === undefined) return '-';
    const abs = Math.abs(ms);
    const days = Math.floor(abs / DAY_MS);
    const hours = Math.floor((abs % DAY_MS) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    const sign = ms < 0 ? '-' : '+';
    if (days > 0) return `${sign}${days}天${hours}时`;
    if (hours > 0) return `${sign}${hours}时${mins}分`;
    return `${sign}${mins}分`;
  }

  filterByThreshold(diffs) {
    return diffs.filter((d) => d.primaryType !== DIFF_TYPES.NONE);
  }

  reconcile(orders, transactions, options = {}) {
    const onProgress = options.onProgress;
    const orderSplit = this.splitByType(orders);
    const txnSplit = this.splitByType(transactions);

    const orderMatch = this.orderMatcher.match(orderSplit.payments, txnSplit.payments, { onProgress });
    const refundMatch = this.refundMatcher.match(orderSplit.payments, txnSplit.refunds, { onProgress });

    const matchedDiffs = orderMatch.matches.map((m) => this.buildDiffRecord(m));
    const unmatchedOrders = orderMatch.unmatchedOrders.map((o) => ({
      orderId: o.orderId,
      merchantId: o.merchantId,
      channel: o.channel,
      orderAmount: o.amount,
      channelAmount: 0,
      amountDiff: -o.amount,
      timeDiffMs: null,
      orderStatus: o.status,
      channelStatus: '-',
      statusMismatch: true,
      diffTypes: [DIFF_TYPES.MISSING_CHANNEL],
      primaryType: DIFF_TYPES.MISSING_CHANNEL,
      order: o,
      txn: null,
    }));

    const unmatchedTxns = orderMatch.unmatchedTransactions.map((t) => ({
      orderId: t.orderId,
      transactionId: t.transactionId,
      merchantId: t.merchantId,
      channel: t.channel,
      orderAmount: 0,
      channelAmount: t.amount,
      amountDiff: t.amount,
      timeDiffMs: null,
      orderStatus: '-',
      channelStatus: t.status,
      statusMismatch: true,
      diffTypes: [DIFF_TYPES.EXTRA_CHANNEL],
      primaryType: DIFF_TYPES.EXTRA_CHANNEL,
      order: null,
      txn: t,
    }));

    const unmatchedRefunds = refundMatch.unmatched.map((r) => ({
      orderId: r.orderId,
      transactionId: r.transactionId,
      merchantId: r.merchantId,
      channel: r.channel,
      orderAmount: 0,
      channelAmount: r.amount,
      amountDiff: r.amount,
      timeDiffMs: null,
      orderStatus: '-',
      channelStatus: r.status,
      statusMismatch: true,
      diffTypes: [DIFF_TYPES.REFUND_UNMATCHED],
      primaryType: DIFF_TYPES.REFUND_UNMATCHED,
      order: null,
      txn: r,
    }));

    const allDiffs = [...matchedDiffs, ...unmatchedOrders, ...unmatchedTxns, ...unmatchedRefunds];
    const filteredDiffs = options.thresholdFilter === false ? allDiffs : this.filterByThreshold(allDiffs);

    const summary = this.summarize({
      orderMatch,
      refundMatch,
      matchedDiffs,
      unmatchedOrders,
      unmatchedTxns,
      unmatchedRefunds,
      orderCount: orderSplit.payments.length,
      txnCount: txnSplit.payments.length,
      refundCount: txnSplit.refunds.length,
    });

    return {
      matches: orderMatch.matches,
      refundMatches: refundMatch.matches,
      differences: filteredDiffs,
      allDifferences: allDiffs,
      summary,
      stats: { ...orderMatch.stats, refunds: refundMatch.stats },
    };
  }

  summarize(ctx) {
    const byType = {};
    for (const d of [...ctx.matchedDiffs, ...ctx.unmatchedOrders, ...ctx.unmatchedTxns, ...ctx.unmatchedRefunds]) {
      byType[d.primaryType] = (byType[d.primaryType] || 0) + 1;
    }
    let totalAmountDiff = 0;
    for (const d of ctx.matchedDiffs) totalAmountDiff += d.amountDiff;
    return {
      orderCount: ctx.orderCount,
      channelCount: ctx.txnCount,
      refundCount: ctx.refundCount,
      matched: ctx.orderMatch.stats.matched,
      matchRate: ctx.orderMatch.stats.matchRate,
      unmatchedOrders: ctx.unmatchedOrders.length,
      unmatchedTransactions: ctx.unmatchedTxns.length,
      unmatchedRefunds: ctx.unmatchedRefunds.length,
      refundMatched: ctx.refundMatch.stats.matched,
      differences: Object.entries(byType)
        .filter(([t]) => t !== DIFF_TYPES.NONE)
        .map(([type, count]) => ({ type, count })),
      totalAmountDiff,
      crossMonth: ctx.orderMatch.stats.crossMonth + ctx.refundMatch.stats.crossMonth,
    };
  }

  reconcileByMerchant(orders, transactions, options = {}) {
    const merchants = new Set([...orders.map((o) => o.merchantId), ...transactions.map((t) => t.merchantId)]);
    const results = {};
    for (const merchantId of merchants) {
      const mOrders = orders.filter((o) => o.merchantId === merchantId);
      const mTxns = transactions.filter((t) => t.merchantId === merchantId);
      if (mOrders.length === 0 && mTxns.length === 0) continue;
      results[merchantId] = this.reconcile(mOrders, mTxns, options);
    }
    return results;
  }

  traceTransaction(transactionId, orders, transactions) {
    const txn = transactions.find((t) => t.transactionId === transactionId || t.orderId === transactionId);
    const related = transactions.filter((t) => txn && t.orderId === txn.orderId);
    const order = orders.find((o) => txn && o.orderId === txn.orderId);
    const chain = [];
    if (order) chain.push({ stage: '商户订单', record: order, ts: order.timestamp });
    related
      .filter((t) => t.type !== 'payment')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((t) => chain.push({ stage: t.type === 'refund' ? '退款' : t.type === 'reversal' ? '冲正' : t.type === 'split' ? '分账' : '交易', record: t, ts: t.timestamp }));
    const payment = related.find((t) => !t.type || t.type === 'payment') || txn;
    if (payment && payment !== order) chain.unshift({ stage: '通道支付', record: payment, ts: payment.timestamp });
    return { target: txn || order, order, related, chain };
  }
}

export { ReconciliationEngine, DIFF_TYPES };
export default ReconciliationEngine;
