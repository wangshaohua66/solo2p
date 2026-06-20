const DEFAULT_LIMIT_MB = 500;
const DEFAULT_CHECK_INTERVAL_MS = 500;

class MemoryMonitor {
  constructor(options = {}) {
    this.limitBytes = (options.limitMB || DEFAULT_LIMIT_MB) * 1024 * 1024;
    this.checkInterval = options.checkIntervalMs || DEFAULT_CHECK_INTERVAL_MS;
    this.warnThreshold = options.warnThreshold || 0.8;
    this.checks = 0;
    this.peakRSS = 0;
    this.peakHeap = 0;
    this.warnings = [];
    this._timer = null;
    this._listeners = [];
  }

  static bytesToMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(2);
  }

  sample() {
    if (!process.memoryUsage) return null;
    const mu = process.memoryUsage();
    this.checks++;
    if (mu.rss > this.peakRSS) this.peakRSS = mu.rss;
    if (mu.heapTotal > this.peakHeap) this.peakHeap = mu.heapTotal;
    const ratio = mu.rss / this.limitBytes;
    if (ratio >= this.warnThreshold) {
      const msg = `内存使用率 ${(ratio * 100).toFixed(1)}% (RSS=${MemoryMonitor.bytesToMB(mu.rss)}MB, 限制=${MemoryMonitor.bytesToMB(this.limitBytes)}MB)`;
      this.warnings.push({ at: Date.now(), ratio, rss: mu.rss, msg });
      this._emit('warn', msg, mu);
    }
    if (ratio >= 1) {
      this._emit('exceed', mu);
    }
    return mu;
  }

  on(event, cb) {
    this._listeners.push({ event, cb });
  }

  _emit(event, ...args) {
    for (const l of this._listeners) {
      if (l.event === event) { try { l.cb(...args); } catch (_) {} }
    }
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.sample(), this.checkInterval);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  getStats() {
    return {
      checks: this.checks,
      peakRSS: this.peakRSS,
      peakHeap: this.peakHeap,
      peakRSSMB: MemoryMonitor.bytesToMB(this.peakRSS),
      peakHeapMB: MemoryMonitor.bytesToMB(this.peakHeap),
      limitMB: MemoryMonitor.bytesToMB(this.limitBytes),
      warnings: this.warnings.length,
      warningDetails: this.warnings.slice(-10),
    };
  }

  reset() {
    this.checks = 0;
    this.peakRSS = 0;
    this.peakHeap = 0;
    this.warnings = [];
  }
}

const globalMonitor = new MemoryMonitor();

export { MemoryMonitor, globalMonitor };
export default MemoryMonitor;
