const dayjs = require('dayjs');

class StatsAggregator {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 'minute';
    this.windows = new Map();
    this.totalLines = 0;
    this.totalErrors = 0;
    this.totalRequests = 0;
    this.responseTimes = [];
    this.statusCodes = new Map();
    this.startTime = null;
    this.endTime = null;
  }

  getWindowKey(timestamp) {
    if (!timestamp) return 'unknown';
    const m = dayjs(timestamp);
    if (!m.isValid()) return 'unknown';

    switch (this.windowSize) {
      case 'minute':
        return m.format('YYYY-MM-DD HH:mm');
      case 'hour':
        return m.format('YYYY-MM-DD HH:00');
      case 'day':
        return m.format('YYYY-MM-DD');
      default:
        return m.format('YYYY-MM-DD HH:mm');
    }
  }

  addRecord(parsedLine) {
    this.totalLines++;
    const ts = parsedLine._timestamp;

    if (ts) {
      if (!this.startTime || ts < this.startTime) this.startTime = ts;
      if (!this.endTime || ts > this.endTime) this.endTime = ts;
    }

    const windowKey = this.getWindowKey(ts);
    if (!this.windows.has(windowKey)) {
      this.windows.set(windowKey, {
        requests: 0,
        errors: 0,
        responseTimes: [],
        statusCodes: new Map(),
        patterns: new Map(),
        start: ts,
        end: ts
      });
    }

    const window = this.windows.get(windowKey);
    window.requests++;
    if (ts && (!window.start || ts < window.start)) window.start = ts;
    if (ts && (!window.end || ts > window.end)) window.end = ts;

    if (parsedLine.status) {
      const code = typeof parsedLine.status === 'number' ? parsedLine.status : parseInt(parsedLine.status, 10);
      if (!isNaN(code)) {
        window.statusCodes.set(code, (window.statusCodes.get(code) || 0) + 1);
        this.statusCodes.set(code, (this.statusCodes.get(code) || 0) + 1);

        if (code >= 400) {
          window.errors++;
          this.totalErrors++;
        }
      }
    }

    if (parsedLine._level && ['ERROR', 'FATAL', 'CRITICAL'].includes(parsedLine._level.toUpperCase())) {
      window.errors++;
      this.totalErrors++;
    }

    if (parsedLine.response_time !== undefined) {
      const rt = parseFloat(parsedLine.response_time);
      if (!isNaN(rt)) {
        window.responseTimes.push(rt);
        this.responseTimes.push(rt);
      }
    }

    if (parsedLine.request_time !== undefined) {
      const rt = parseFloat(parsedLine.request_time);
      if (!isNaN(rt)) {
        window.responseTimes.push(rt * 1000);
        this.responseTimes.push(rt * 1000);
      }
    }

    this.totalRequests = window.requests ? this.totalRequests : this.totalLines;
  }

  addPatternMatch(matchResult) {
    const ts = matchResult.timestamp;
    const windowKey = this.getWindowKey(ts);
    const window = this.windows.get(windowKey);
    if (window) {
      window.patterns.set(matchResult.pattern, (window.patterns.get(matchResult.pattern) || 0) + 1);
    }
  }

  calculatePercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  getWindowStats(windowKey) {
    const window = this.windows.get(windowKey);
    if (!window) return null;

    const rt = window.responseTimes;
    return {
      window: windowKey,
      requests: window.requests,
      errors: window.errors,
      errorRate: window.requests > 0 ? ((window.errors / window.requests) * 100).toFixed(2) : '0.00',
      responseTime: {
        p50: this.calculatePercentile(rt, 50),
        p95: this.calculatePercentile(rt, 95),
        p99: this.calculatePercentile(rt, 99),
        avg: rt.length > 0 ? (rt.reduce((a, b) => a + b, 0) / rt.length) : 0,
        max: rt.length > 0 ? Math.max(...rt) : 0,
        min: rt.length > 0 ? Math.min(...rt) : 0
      },
      statusCodes: Object.fromEntries(window.statusCodes),
      patternCounts: Object.fromEntries(window.patterns),
      start: window.start,
      end: window.end
    };
  }

  getSummary() {
    const rt = this.responseTimes;
    return {
      totalLines: this.totalLines,
      totalRequests: this.totalRequests || this.totalLines,
      totalErrors: this.totalErrors,
      errorRate: this.totalLines > 0 ? ((this.totalErrors / this.totalLines) * 100).toFixed(2) : '0.00',
      responseTime: {
        p50: this.calculatePercentile(rt, 50),
        p95: this.calculatePercentile(rt, 95),
        p99: this.calculatePercentile(rt, 99),
        avg: rt.length > 0 ? (rt.reduce((a, b) => a + b, 0) / rt.length) : 0,
        max: rt.length > 0 ? Math.max(...rt) : 0,
        min: rt.length > 0 ? Math.min(...rt) : 0
      },
      statusCodes: Object.fromEntries(this.statusCodes),
      startTime: this.startTime,
      endTime: this.endTime,
      windowCount: this.windows.size
    };
  }

  getTimeSeries() {
    const keys = [...this.windows.keys()].sort();
    return keys.map(k => this.getWindowStats(k));
  }

  getWindowsInRange(start, end) {
    const keys = [...this.windows.keys()].sort();
    return keys
      .filter(k => {
        const window = this.windows.get(k);
        if (!window || !window.start) return false;
        if (start && window.start < start) return false;
        if (end && window.start > end) return false;
        return true;
      })
      .map(k => this.getWindowStats(k));
  }

  reset() {
    this.windows.clear();
    this.totalLines = 0;
    this.totalErrors = 0;
    this.totalRequests = 0;
    this.responseTimes = [];
    this.statusCodes.clear();
    this.startTime = null;
    this.endTime = null;
  }
}

module.exports = { StatsAggregator };
