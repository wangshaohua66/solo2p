const dayjs = require('dayjs');
const chalk = require('chalk');

class AlertDetector {
  constructor(rules = []) {
    this.rules = rules.map(rule => ({
      ...rule,
      comparator: rule.comparator || '>',
      silenceMinutes: rule.silence_minutes || 0,
      windowMinutes: rule.window_minutes || 5,
      lastTriggered: null,
      triggered: false
    }));
    this.alertHistory = [];
    this.currentMetrics = {};
  }

  updateMetrics(metrics) {
    if (metrics.error_rate !== undefined) {
      this.currentMetrics.error_rate = parseFloat(metrics.error_rate);
    }
    if (metrics.response_time !== undefined) {
      this.currentMetrics.response_time = metrics.response_time;
    }
    if (metrics.match_count !== undefined) {
      this.currentMetrics.match_count = metrics.match_count;
    }
    if (metrics.request_count !== undefined) {
      this.currentMetrics.request_count = metrics.request_count;
    }
    if (metrics.error_count !== undefined) {
      this.currentMetrics.error_count = metrics.error_count;
    }
    if (metrics.p95 !== undefined) {
      this.currentMetrics.p95 = metrics.p95;
    }
    if (metrics.p99 !== undefined) {
      this.currentMetrics.p99 = metrics.p99;
    }
  }

  evaluate(stats, patternStats) {
    const now = dayjs();
    const firedAlerts = [];

    for (const rule of this.rules) {
      const metricValue = this.resolveMetric(rule, stats, patternStats);
      if (metricValue === null) continue;

      const threshold = rule.threshold;
      const triggered = this.compare(metricValue, rule.comparator, threshold);

      if (triggered) {
        if (rule.silenceMinutes > 0 && rule.lastTriggered) {
          const elapsed = now.diff(dayjs(rule.lastTriggered), 'minute');
          if (elapsed < rule.silenceMinutes) {
            continue;
          }
        }

        rule.lastTriggered = now.toISOString();
        rule.triggered = true;

        const alert = {
          name: rule.name,
          metric: rule.metric,
          value: metricValue,
          threshold,
          comparator: rule.comparator,
          severity: rule.severity || 'warning',
          timestamp: now.toISOString(),
          message: `Alert: ${rule.name} - ${rule.metric} (${metricValue}) ${rule.comparator} ${threshold}`
        };

        this.alertHistory.push(alert);
        firedAlerts.push(alert);
      } else {
        rule.triggered = false;
      }
    }

    return firedAlerts;
  }

  resolveMetric(rule, stats, patternStats) {
    switch (rule.metric) {
      case 'error_rate':
        return stats.totalLines > 0
          ? parseFloat(((stats.totalErrors / stats.totalLines) * 100).toFixed(2))
          : 0;

      case 'response_time':
        return stats.responseTime ? stats.responseTime.p95 || stats.responseTime.avg : null;

      case 'response_time_p95':
        return stats.responseTime ? stats.responseTime.p95 : null;

      case 'response_time_p99':
        return stats.responseTime ? stats.responseTime.p99 : null;

      case 'error_count':
        return stats.totalErrors;

      case 'request_count':
        return stats.totalRequests || stats.totalLines;

      case 'match_count':
        if (rule.pattern_name && patternStats) {
          const ps = patternStats.find(p => p.pattern === rule.pattern_name);
          return ps ? ps.count : 0;
        }
        return patternStats ? patternStats.reduce((sum, p) => sum + p.count, 0) : 0;

      default:
        if (rule.metric.startsWith('custom:')) {
          const key = rule.metric.slice(7);
          return this.currentMetrics[key] || null;
        }
        return this.currentMetrics[rule.metric] || null;
    }
  }

  compare(value, comparator, threshold) {
    switch (comparator) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return value > threshold;
    }
  }

  getAlertHistory() {
    return [...this.alertHistory];
  }

  formatAlert(alert) {
    const severityColors = {
      critical: chalk.red.bold,
      warning: chalk.yellow,
      info: chalk.blue
    };
    const color = severityColors[alert.severity] || chalk.yellow;
    const prefix = alert.severity === 'critical' ? '🚨' : '⚠️';

    return [
      color(`${prefix} [${alert.severity.toUpperCase()}] ${alert.name}`),
      `  Metric: ${alert.metric} = ${alert.value} ${alert.comparator} ${alert.threshold}`,
      `  Time: ${alert.timestamp}`
    ].join('\n');
  }

  reset() {
    this.alertHistory = [];
    this.currentMetrics = {};
    for (const rule of this.rules) {
      rule.lastTriggered = null;
      rule.triggered = false;
    }
  }
}

module.exports = { AlertDetector };
