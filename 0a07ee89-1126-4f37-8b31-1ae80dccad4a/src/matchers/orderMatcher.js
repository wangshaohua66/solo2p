import { differenceMs, isCrossMonth } from '../utils/dateNormalizer.js';

const DAY_MS = 86400000;
const PREFIX_LEN = 4;
const BK_MAX_TOLERANCE = 4;

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > BK_MAX_TOLERANCE) return BK_MAX_TOLERANCE + 1;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const minJ = Math.max(1, i - BK_MAX_TOLERANCE);
    const maxJ = Math.min(n, i + BK_MAX_TOLERANCE);
    let rowMin = Infinity;
    for (let j = minJ; j <= maxJ; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > BK_MAX_TOLERANCE) return BK_MAX_TOLERANCE + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
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

class BKTree {
  constructor(distanceFn, maxTolerance = BK_MAX_TOLERANCE) {
    this.distanceFn = distanceFn;
    this.maxTolerance = maxTolerance;
    this.root = null;
  }

  add(item, key) {
    const node = { item, key, children: {} };
    if (!this.root) { this.root = node; return; }
    let cur = this.root;
    while (true) {
      const d = this.distanceFn(cur.key, key);
      if (d === 0) return;
      if (cur.children[d]) {
        cur = cur.children[d];
      } else {
        cur.children[d] = node;
        return;
      }
    }
  }

  query(key, tolerance) {
    if (!this.root) return [];
    const results = [];
    const stack = [this.root];
    const tol = Math.min(tolerance, this.maxTolerance);
    while (stack.length) {
      const node = stack.pop();
      const d = this.distanceFn(node.key, key);
      if (d <= tol) results.push({ item: node.item, distance: d });
      const minD = Math.max(0, d - tol);
      const maxD = d + tol;
      for (let k = minD; k <= maxD; k++) {
        if (node.children[k]) stack.push(node.children[k]);
      }
    }
    return results;
  }
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
      if (!index.has(key)) index.set(key, {
        byOrder: new Map(),
        byPrefix: new Map(),
        list: [],
        sortedByAmount: null,
        bkTree: null,
      });
      const bucket = index.get(key);
      bucket.list.push(order);
      const ok = order.orderId || '';
      if (!bucket.byOrder.has(ok)) bucket.byOrder.set(ok, []);
      bucket.byOrder.get(ok).push(order);
      const prefix = (ok || '').slice(0, PREFIX_LEN) || '_';
      if (!bucket.byPrefix.has(prefix)) bucket.byPrefix.set(prefix, []);
      bucket.byPrefix.get(prefix).push(order);
    }
    for (const bucket of index.values()) {
      bucket.sortedByAmount = bucket.list.slice().sort((a, b) => a.amount - b.amount);
      if (this.fuzzy && bucket.list.length > 0) {
        const bk = new BKTree(levenshtein, BK_MAX_TOLERANCE);
        for (const o of bucket.list) bk.add(o, o.orderId || '');
        bucket.bkTree = bk;
      }
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

  getAmountRangeCandidates(bucket, txn) {
    if (!bucket || !bucket.sortedByAmount) return [];
    const arr = bucket.sortedByAmount;
    const minAmt = txn.amount * (1 - this.fuzzyAmountRatio) - 1;
    const maxAmt = txn.amount * (1 + this.fuzzyAmountRatio) + 1;
    let lo = 0, hi = arr.length - 1, left = arr.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].amount >= minAmt) { left = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    const result = [];
    for (let i = left; i < arr.length && arr[i].amount <= maxAmt; i++) {
      result.push(arr[i]);
    }
    return result;
  }

  findFuzzy(bucket, txn, matchedOrderIds) {
    if (!bucket || !this.fuzzy) return null;
    const txnOrderId = txn.orderId || '';
    const tolerance = Math.ceil(txnOrderId.length * (1 - this.fuzzyThreshold));
    const bkTolerance = Math.max(1, Math.min(tolerance, BK_MAX_TOLERANCE));

    let candidates = [];
    if (bucket.bkTree && txnOrderId.length > PREFIX_LEN) {
      const bkResults = bucket.bkTree.query(txnOrderId, bkTolerance);
      candidates = bkResults.map((r) => r.item);
    }

    if (candidates.length === 0) {
      const prefix = txnOrderId.slice(0, PREFIX_LEN) || '_';
      const prefixList = bucket.byPrefix.get(prefix);
      candidates = prefixList && prefixList.length > 0 ? prefixList : bucket.list;
    }

    const amountCandidates = this.getAmountRangeCandidates(bucket, txn);
    const amountSet = new Set(amountCandidates.map((o) => o.id || o.orderId));
    candidates = candidates.filter((o) => amountSet.has(o.id || o.orderId));

    let best = null;
    let bestScore = 0;
    for (const order of candidates) {
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
