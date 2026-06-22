const fs = require('fs');
const { getLogger } = require('./logger');

const PERFORMANCE_LIMITS = {
  AGGREGATE: 30000,
  MERGE: 5000,
  QUERY: 5000,
  DEDUCT: 10000,
  DECLARE: 5000,
  STATS: 3000
};

const MEMORY_LIMIT_BYTES = 300 * 1024 * 1024;
const DB_SIZE_LIMIT_MB = 200;
const DB_RECORD_LIMIT = 100000;

class PerformanceTimer {
  constructor(operation, limitMs, logger = null) {
    this.operation = operation;
    this.limitMs = limitMs;
    this.logger = logger || getLogger();
    this.startTime = Date.now();
    this.peakMemory = 0;
    this._memoryInterval = null;
  }

  startMemoryWatch(intervalMs = 500) {
    if (this._memoryInterval) return;
    this._memoryInterval = setInterval(() => {
      const mem = process.memoryUsage().heapUsed;
      if (mem > this.peakMemory) this.peakMemory = mem;
    }, intervalMs);
  }

  stopMemoryWatch() {
    if (this._memoryInterval) {
      clearInterval(this._memoryInterval);
      this._memoryInterval = null;
    }
    const mem = process.memoryUsage().heapUsed;
    if (mem > this.peakMemory) this.peakMemory = mem;
  }

  elapsed() {
    return Date.now() - this.startTime;
  }

  checkPerformance() {
    const elapsed = this.elapsed();
    if (this.limitMs && elapsed > this.limitMs) {
      const overBy = ((elapsed - this.limitMs) / 1000).toFixed(2);
      this.logger.warn(
        `性能超限预警: ${this.operation} 耗时 ${(elapsed / 1000).toFixed(2)}秒 ` +
        `(阈值 ${(this.limitMs / 1000).toFixed(0)}秒, 超出 ${overBy}秒)`,
        { operation: this.operation, durationMs: elapsed }
      );
      return true;
    }
    return false;
  }

  checkMemory() {
    this.stopMemoryWatch();
    if (this.peakMemory > MEMORY_LIMIT_BYTES) {
      const overMB = ((this.peakMemory - MEMORY_LIMIT_BYTES) / 1024 / 1024).toFixed(2);
      this.logger.warn(
        `内存超限预警: 峰值内存 ${(this.peakMemory / 1024 / 1024).toFixed(2)}MB ` +
        `(阈值 300MB, 超出 ${overMB}MB)`,
        { operation: this.operation }
      );
      return true;
    }
    return false;
  }

  stop(logResult = true) {
    const elapsed = this.elapsed();
    this.stopMemoryWatch();
    const overPerf = this.checkPerformance();
    const overMem = this.checkMemory();
    if (logResult && !overPerf && !overMem) {
      this.logger.debug(
        `${this.operation} 完成: 耗时 ${elapsed}ms, 峰值内存 ${(this.peakMemory / 1024 / 1024).toFixed(2)}MB`,
        { operation: this.operation, durationMs: elapsed }
      );
    }
    return { elapsedMs: elapsed, peakMemoryBytes: this.peakMemory, overPerf, overMem };
  }
}

function checkDatabaseSize(dbPath, logger = null) {
  const log = logger || getLogger();
  if (!fs.existsSync(dbPath)) {
    return { sizeMB: 0, overLimit: false };
  }
  try {
    const stats = fs.statSync(dbPath);
    const sizeMB = stats.size / 1024 / 1024;
    if (sizeMB > DB_SIZE_LIMIT_MB) {
      log.warn(
        `数据库文件超限预警: 当前 ${sizeMB.toFixed(2)}MB, 阈值 ${DB_SIZE_LIMIT_MB}MB`,
        { operation: 'DB_SIZE_CHECK' }
      );
      return { sizeMB, overLimit: true };
    }
    log.debug(`数据库文件大小: ${sizeMB.toFixed(2)}MB (阈值 ${DB_SIZE_LIMIT_MB}MB)`, { operation: 'DB_SIZE_CHECK' });
    return { sizeMB, overLimit: false };
  } catch (e) {
    return { sizeMB: 0, overLimit: false, error: e.message };
  }
}

function checkRecordCount(db, logger = null) {
  const log = logger || getLogger();
  try {
    const count = db.countInvoices();
    if (count >= DB_RECORD_LIMIT) {
      log.warn(
        `数据库记录超限预警: 当前 ${count} 条, 阈值 ${DB_RECORD_LIMIT} 条`,
        { operation: 'DB_RECORD_CHECK' }
      );
      return { count, overLimit: true };
    }
    log.debug(`数据库记录数: ${count} 条 (阈值 ${DB_RECORD_LIMIT} 条)`, { operation: 'DB_RECORD_CHECK' });
    return { count, overLimit: false };
  } catch (e) {
    return { count: 0, overLimit: false, error: e.message };
  }
}

function checkBeforeImport(db, dbPath, logger = null) {
  const sizeCheck = checkDatabaseSize(dbPath, logger);
  const recordCheck = checkRecordCount(db, logger);
  return { sizeCheck, recordCheck, overLimit: sizeCheck.overLimit || recordCheck.overLimit };
}

function getMemoryUsageMB() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed / 1024 / 1024,
    heapTotal: mem.heapTotal / 1024 / 1024,
    rss: mem.rss / 1024 / 1024
  };
}

function logMemorySnapshot(label = '', logger = null) {
  const log = logger || getLogger();
  const mem = getMemoryUsageMB();
  const msg = `[内存快照${label ? ' - ' + label : ''}] ` +
    `Heap: ${mem.heapUsed.toFixed(2)}MB / ${mem.heapTotal.toFixed(2)}MB, ` +
    `RSS: ${mem.rss.toFixed(2)}MB`;
  log.debug(msg, { operation: 'MEMORY_SNAPSHOT' });
  if (mem.heapUsed > MEMORY_LIMIT_BYTES / 1024 / 1024) {
    log.warn(
      `内存超限预警: 当前 Heap ${mem.heapUsed.toFixed(2)}MB, 阈值 300MB`,
      { operation: 'MEMORY_CHECK' }
    );
  }
  return mem;
}

module.exports = {
  PerformanceTimer,
  PERFORMANCE_LIMITS,
  MEMORY_LIMIT_BYTES,
  DB_SIZE_LIMIT_MB,
  DB_RECORD_LIMIT,
  checkDatabaseSize,
  checkRecordCount,
  checkBeforeImport,
  getMemoryUsageMB,
  logMemorySnapshot
};
