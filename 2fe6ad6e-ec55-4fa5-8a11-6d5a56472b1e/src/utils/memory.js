'use strict';

/**
 * 内存峰值监控工具
 * 职责：
 *  1) 在数据处理关键节点检查 process.memoryUsage()
 *  2) 超过阈值（默认 512MB）时抛出异常中止并告警
 *  3) 记录内存峰值供事后分析
 */

const logger = require('./logger');

const log = logger.forBank('MEM');

const DEFAULT_LIMIT_MB = 512;
let _peak = 0;
let _limit = DEFAULT_LIMIT_MB;

/**
 * 设置内存上限（MB）
 */
function setLimit(mb) {
  _limit = Number(mb) || DEFAULT_LIMIT_MB;
  log.debug(`内存上限设置为 ${_limit}MB`);
}

/**
 * 当前堆内存使用量（MB）
 */
function currentUsage() {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

/**
 * 当前 RSS 内存使用量（MB，含 native 缓冲）
 */
function currentRss() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

/**
 * 峰值使用量（MB）
 */
function peakUsage() {
  return _peak;
}

/**
 * 检查内存使用，超限时抛出异常
 * @param {string} stage 当前阶段标记（如 "解析"、"核对"）
 * @throws {Error} 内存超限异常
 */
function check(stage) {
  const usage = process.memoryUsage();
  const heapMb = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMb = Math.round(usage.rss / 1024 / 1024);
  if (heapMb > _peak) _peak = heapMb;
  if (heapMb > _limit) {
    const msg = `内存超限 [${stage || 'unknown'}]: heapUsed=${heapMb}MB rss=${rssMb}MB 上限=${_limit}MB`;
    log.error(msg);
    throw new Error(msg);
  }
  if (rssMb > _limit * 1.2) {
    const msg = `RSS 内存超限 [${stage || 'unknown'}]: rss=${rssMb}MB 上限=${_limit}MB`;
    log.error(msg);
    throw new Error(msg);
  }
  log.debug(`[${stage || 'check'}] heapUsed=${heapMb}MB rss=${rssMb}MB peak=${_peak}MB`);
  return { heapMb, rssMb, peakMb: _peak };
}

/**
 * 尝试触发垃圾回收（需 --expose-gc 启动）
 */
function tryGc() {
  if (typeof global.gc === 'function') {
    global.gc();
    log.debug('已触发 GC');
  }
}

/**
 * 输出内存摘要
 */
function summary() {
  const u = process.memoryUsage();
  return {
    heapUsed: Math.round(u.heapUsed / 1024 / 1024),
    rss: Math.round(u.rss / 1024 / 1024),
    peak: _peak,
    limit: _limit,
  };
}

module.exports = {
  setLimit,
  currentUsage,
  currentRss,
  peakUsage,
  check,
  tryGc,
  summary,
};
