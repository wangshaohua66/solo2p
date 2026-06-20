import { differenceMs, isCrossMonth } from '../utils/dateNormalizer.js';
import { similarity } from './orderMatcher.js';

const DAY_MS = 86400000;
const REFUND_TYPES = new Set(['refund', 'reversal', 'split']);

class RefundMatcher {
  constructor(options = {}) {
    this.timeWindowDays = options.timeWindowDays ?? 90;
    this.fuzzy = options.fuzzy !== false;
    this.fuzzyThreshold = options.fuzzyThreshold ?? 0.85;
    this.allowPartialRefund = options.allowPartialRefund !== false;
    this.maxRefundRatio = options.maxRefundRatio ?? 1.0;
  }

  buildIndex(payments) {
    const index = new Map();
    for (const p of payments) {
      const key = p.merchantId || '_UNKNOWN_';
      if (!index.has(key)) index.set(key, { byOrder: new Map(), list: [] });
      const bucket = index.get(key);
      bucket.list.push(p);
      if (!bucket.byOrder.has(p.orderId)) bucket.byOrder.set(p.orderId, []);
      bucket.byOrder.get(p.orderId).push(p);
    }
    return index;
  }

  findOriginal(bucket, refund) {
    if (!bucket) return null;
    const candidates = bucket.byOrder.get(refund.orderId) || [];
    for (const p of candidates) {
      if (this.validateRelationship(p, refund)) return { payment: p, matchType: 'exact', score: 1 };
    }
    if (candidates.length > 0) {
      const best = candidates.find((p) => Math.abs(p.amount) >= Math.abs(refund.amount));
      if (best) return { payment: best, matchType: 'exact', score: 1 };
    }
    if (!this.fuzzy) return null;
    let best = null;
    let bestScore = 0;
    for (const p of bucket.list) {
      if (Math.abs(p.amount) < Math.abs(refund.amount) && !this.allowPartialRefund) continue;
      let score = similarity(refund.orderId, p.orderId);
      if (refund.orderId && p.orderId && (refund.orderId.includes(p.orderId) || p.orderId.includes(refund.orderId))) score = Math.max(score, 0.9);
      if (Math.abs(p.amount) >= Math.abs(refund.amount)) score += 0.05;
      if (this.withinWindow(p, refund)) score += 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return bestScore >= this.fuzzyThreshold ? { payment: best, matchType: 'fuzzy', score: bestScore } : null;
  }

  withinWindow(payment, refund) {
    if (!payment.timestamp || !refund.timestamp) return true;
    const diff = differenceMs(refund.timestamp, payment.timestamp);
    if (diff === null) return true;
    return diff >= 0 && diff <= this.timeWindowDays * DAY_MS;
  }

  validateRelationship(payment, refund) {
    if (!payment || !refund) return false;
    if (!this.withinWindow(payment, refund)) return false;
    const ratio = Math.abs(refund.amount) / Math.max(1, Math.abs(payment.amount));
    return ratio <= this.maxRefundRatio + 0.001;
  }

  match(payments, transactions, options = {}) {
    const onProgress = options.onProgress;
    const index = this.buildIndex(payments);
    const matches = [];
    const unmatched = [];
    let processed = 0;

    for (const txn of transactions) {
      if (!REFUND_TYPES.has(txn.type)) continue;
      const bucket = index.get(txn.merchantId) || index.get('_UNKNOWN_');
      const result = this.findOriginal(bucket, txn);
      if (result) {
        const ratio = Math.abs(txn.amount) / Math.max(1, Math.abs(result.payment.amount));
        matches.push({
          ...result,
          refund: txn,
          timeDiffMs: differenceMs(txn.timestamp, result.payment.timestamp),
          refundRatio: ratio,
          isPartial: ratio < 0.999,
          crossMonth:
            result.payment.timestamp && txn.timestamp ? isCrossMonth(result.payment.timestamp, txn.timestamp) : false,
        });
      } else {
        unmatched.push(txn);
      }
      processed++;
      if (onProgress && processed % 500 === 0) onProgress(processed);
    }

    return {
      matches,
      unmatched,
      stats: {
        matched: matches.length,
        refunds: matches.filter((m) => m.refund.type === 'refund').length,
        reversals: matches.filter((m) => m.refund.type === 'reversal').length,
        splits: matches.filter((m) => m.refund.type === 'split').length,
        partial: matches.filter((m) => m.isPartial).length,
        unmatched: unmatched.length,
        crossMonth: matches.filter((m) => m.crossMonth).length,
      },
    };
  }
}

export { RefundMatcher, REFUND_TYPES };
export default RefundMatcher;
