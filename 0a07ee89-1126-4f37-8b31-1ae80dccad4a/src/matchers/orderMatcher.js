import { differenceMs, isCrossMonth } from '../utils/dateNormalizer.js';

const DAY_MS = 86400000;

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function includesOrder(txn, order) {
  if (!txn.orderId || !order.orderId) return false;
  return txn.orderId.includes(order.orderId) || order.orderId.includes(txn.orderId);
}

class OrderMatcher {
  constructor(options = {}) {
    this.timeWindowDays = options.timeWindowDays ?? 1;
    this.fuzzy = options.fuzzy !== false;
    this.fuzzyThreshold = options.fuzzyThreshold ?? 0.85;
    this.fuzzyAmountRatio = options.fuzzyAmountRatio ?? 0.1;
    this.amountTolerance = options.amountTolerance ?? 0;
    this.channelFilter = options.channelFilter || null;
    this.strictTimeWindow = options.strictTimeWindow ?? false;
  }

  buildIndex(orders) {
    const index = new Map();
    for (const order of orders) {
      if (order.type !== 'payment' && order.type !== undefined) continue;
      if (this.channelFilter && order.channel !== this.channelFilter) continue;
      const key = order.merchantId || '_UNKNOWN_';
      if (!index.has(key)) index.set(key, { byOrder: new Map(), list: [] });
      const bucket = index.get(key);
      bucket.list.push(order);
      const ok = order.orderId;
      if (!bucket.byOrder.has(ok)) bucket.byOrder.set(ok, []);
      bucket.byOrder.get(ok).push(order);
    }
    return index;
  }

  withinTimeWindow(order, txn) {
    if (!order.timestamp || !txn.timestamp) return !this.strictTimeWindow;
    const diff = differenceMs(txn.timestamp, order.timestamp);
    if (diff === null) return !this.strictTimeWindow;
    const allowBefore = this.timeWindowDays === 0 ? 0 : DAY_MS;
    return diff >= -allowBefore && diff <= (this.timeWindowDays + 1) * DAY_MS;
  }

  findExact(bucket, txn, matchedOrderIds) {
    if (!bucket) return null;
    const candidates = bucket.byOrder.get(txn.orderId);
    if (!candidates) return null;
    for (const order of candidates) {
      if (matchedOrderIds && matchedOrderIds.has(order.id || order.orderId)) continue;
      if (this.withinTimeWindow(order, txn)) return order;
    }
    const fallback = candidates.find((o) => !matchedOrderIds || !matchedOrderIds.has(o.id || o.orderId));
    return fallback || null;
  }

  findFuzzy(bucket, txn, matchedOrderIds) {
    if (!bucket || !this.fuzzy) return null;
    let best = null;
    let bestScore = 0;
    for (const order of bucket.list) {
      if (matchedOrderIds && matchedOrderIds.has(order.id || order.orderId)) continue;
      const amountRatio = Math.abs(txn.amount - order.amount) / Math.max(1, Math.abs(order.amount));
      if (amountRatio > this.fuzzyAmountRatio) continue;
      let score = similarity(txn.orderId, order.orderId);
      if (score < 1 && includesOrder(txn, order)) score = Math.max(score, 0.9);
      if (this.withinTimeWindow(order, txn)) score += 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = order;
      }
    }
    return bestScore >= this.fuzzyThreshold ? { order: best, score: bestScore, fuzzy: true } : null;
  }

  match(orders, transactions, options = {}) {
    const onProgress = options.onProgress;
    const index = this.buildIndex(orders);
    const matches = [];
    const matchedOrderIds = new Set();
    const matchedTxnIds = new Set();
    const unmatchedTransactions = [];
    let processed = 0;

    const eligibleTxns = transactions.filter((t) => (!t.type || t.type === 'payment') && (!this.channelFilter || t.channel === this.channelFilter));

    for (const txn of eligibleTxns) {
      const bucket = index.get(txn.merchantId) || index.get('_UNKNOWN_');
      const exact = this.findExact(bucket, txn, matchedOrderIds);
      if (exact) {
        matches.push({ order: exact, txn, matchType: 'exact', score: 1, timeDiffMs: differenceMs(txn.timestamp, exact.timestamp) });
        matchedOrderIds.add(exact.id || exact.orderId);
        matchedTxnIds.add(txn.id || txn.transactionId || txn.orderId);
      }
      processed++;
      if (onProgress) onProgress(processed);
    }

    for (const txn of eligibleTxns) {
      if (matchedTxnIds.has(txn.id || txn.transactionId || txn.orderId)) continue;
      const bucket = index.get(txn.merchantId) || index.get('_UNKNOWN_');
      const fuzzy = this.findFuzzy(bucket, txn, matchedOrderIds);
      if (fuzzy) {
        matches.push({ order: fuzzy.order, txn, matchType: 'fuzzy', score: fuzzy.score, timeDiffMs: differenceMs(txn.timestamp, fuzzy.order.timestamp) });
        matchedOrderIds.add(fuzzy.order.id || fuzzy.order.orderId);
        matchedTxnIds.add(txn.id || txn.transactionId || txn.orderId);
      } else {
        unmatchedTransactions.push(txn);
      }
      processed++;
      if (onProgress) onProgress(processed);
    }

    const unmatchedOrders = orders.filter(
      (o) => (o.type === 'payment' || o.type === undefined) && !matchedOrderIds.has(o.id || o.orderId)
    );

    const total = eligibleTxns.length;
    const matchRate = total > 0 ? matches.length / total : 0;

    return {
      matches,
      unmatchedOrders,
      unmatchedTransactions,
      matchRate,
      stats: {
        matched: matches.length,
        exact: matches.filter((m) => m.matchType === 'exact').length,
        fuzzy: matches.filter((m) => m.matchType === 'fuzzy').length,
        unmatchedOrders: unmatchedOrders.length,
        unmatchedTransactions: unmatchedTransactions.length,
        total,
        matchRate,
        crossMonth: matches.filter((m) => m.order.timestamp && m.txn.timestamp && isCrossMonth(m.order.timestamp, m.txn.timestamp)).length,
      },
    };
  }
}

export { OrderMatcher, similarity, levenshtein };
export default OrderMatcher;
