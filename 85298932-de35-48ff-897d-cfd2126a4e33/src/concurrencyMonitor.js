const EventEmitter = require('events');
const logger = require('./logger');
const store = require('./db/sqliteStore');
const configLoader = require('./configLoader');

class ConcurrencyMonitor extends EventEmitter {
  constructor() {
    super();
    this.accounts = new Map();
    this.warnThreshold = 10;
    this._loadInitialState();
  }

  _loadInitialState() {
    const schedulerCfg = configLoader.getSchedulerConfig();
    this.warnThreshold = schedulerCfg.warnCapacityThreshold || 10;
    const accounts = configLoader.getAccounts();
    for (const acc of accounts) {
      this.accounts.set(acc.id, {
        id: acc.id,
        maxConcurrency: acc.maxConcurrency || 50,
        reservedSlots: acc.reservedSlots || 5,
        currentConcurrency: 0,
        enabled: acc.enabled !== false,
        lastWarnAt: 0
      });
    }
    const sessions = store.listAccountSessions();
    for (const s of sessions) {
      if (this.accounts.has(s.account_id)) {
        const acc = this.accounts.get(s.account_id);
        acc.currentConcurrency = s.current_concurrency || 0;
      }
    }
  }

  getAccountCapacity(accountId) {
    const acc = this.accounts.get(accountId);
    if (!acc || !acc.enabled) return 0;
    const effectiveMax = acc.maxConcurrency - acc.reservedSlots;
    return Math.max(0, effectiveMax - acc.currentConcurrency);
  }

  getTotalRemainingCapacity() {
    let total = 0;
    for (const acc of this.accounts.values()) {
      total += this.getAccountCapacity(acc.id);
    }
    return total;
  }

  isAllAccountsFull() {
    for (const acc of this.accounts.values()) {
      if (acc.enabled && this.getAccountCapacity(acc.id) > 0) {
        return false;
      }
    }
    return true;
  }

  acquireSlot(accountId) {
    const acc = this.accounts.get(accountId);
    if (!acc || !acc.enabled) {
      logger.warn(`[concurrency] 账号 ${accountId} 不可用`);
      return false;
    }
    if (this.getAccountCapacity(accountId) <= 0) {
      logger.warn(`[concurrency] 账号 ${accountId} 并发已满 (${acc.currentConcurrency}/${acc.maxConcurrency})`);
      return false;
    }
    acc.currentConcurrency += 1;
    store.upsertAccountSession(accountId, { current_concurrency: acc.currentConcurrency });
    this._checkWarning(accountId, acc);
    this.emit('capacityChanged', accountId, this.getAccountCapacity(accountId));
    logger.debug(`[concurrency] 账号 ${accountId} 获得并发槽位 ${acc.currentConcurrency}/${acc.maxConcurrency}`);
    return true;
  }

  releaseSlot(accountId) {
    const acc = this.accounts.get(accountId);
    if (!acc) return;
    if (acc.currentConcurrency > 0) {
      acc.currentConcurrency -= 1;
    }
    store.upsertAccountSession(accountId, { current_concurrency: acc.currentConcurrency });
    this.emit('capacityChanged', accountId, this.getAccountCapacity(accountId));
    logger.debug(`[concurrency] 账号 ${accountId} 释放并发槽位 ${acc.currentConcurrency}/${acc.maxConcurrency}`);
  }

  setAccountConcurrency(accountId, count) {
    const acc = this.accounts.get(accountId);
    if (!acc) return;
    acc.currentConcurrency = Math.max(0, Math.min(acc.maxConcurrency, count));
    store.upsertAccountSession(accountId, { current_concurrency: acc.currentConcurrency });
    this.emit('capacityChanged', accountId, this.getAccountCapacity(accountId));
  }

  _checkWarning(accountId, acc) {
    const now = Date.now();
    if (this.getAccountCapacity(accountId) <= this.warnThreshold && now - acc.lastWarnAt > 60000) {
      logger.warn(`[concurrency] 账号 ${accountId} 剩余并发槽位紧张: ${this.getAccountCapacity(accountId)} 个`);
      acc.lastWarnAt = now;
      this.emit('capacityWarning', {
        accountId,
        remaining: this.getAccountCapacity(accountId),
        max: acc.maxConcurrency,
        current: acc.currentConcurrency
      });
    }
  }

  getAccountsSnapshot() {
    const result = [];
    for (const acc of this.accounts.values()) {
      result.push({
        id: acc.id,
        maxConcurrency: acc.maxConcurrency,
        reservedSlots: acc.reservedSlots,
        currentConcurrency: acc.currentConcurrency,
        remaining: this.getAccountCapacity(acc.id),
        enabled: acc.enabled,
        usagePercent: Math.round((acc.currentConcurrency / acc.maxConcurrency) * 100)
      });
    }
    return result;
  }

  pickBestAccount(requiredSlots = 1) {
    let best = null;
    let bestScore = -Infinity;
    for (const acc of this.accounts.values()) {
      if (!acc.enabled) continue;
      const remaining = this.getAccountCapacity(acc.id);
      if (remaining < requiredSlots) continue;
      const score = remaining - (acc.currentConcurrency * 0.1);
      if (score > bestScore) {
        bestScore = score;
        best = acc.id;
      }
    }
    return best;
  }

  pickAccountsByWeight(totalSlots) {
    const selected = [];
    let remaining = totalSlots;
    const sorted = this.getAccountsSnapshot()
      .filter(a => a.enabled && a.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    for (const acc of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(acc.remaining, remaining);
      selected.push({ accountId: acc.id, slots: take });
      remaining -= take;
    }
    return selected;
  }

  setAccountEnabled(accountId, enabled) {
    const acc = this.accounts.get(accountId);
    if (acc) {
      acc.enabled = enabled;
      logger.info(`[concurrency] 账号 ${accountId} ${enabled ? '启用' : '禁用'}`);
    }
  }
}

module.exports = new ConcurrencyMonitor();
