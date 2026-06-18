const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

function formatTable(headers, rows, options = {}) {
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce((max, row) => {
      const cell = String(row[i] ?? '');
      return cell.length > max ? cell.length : max;
    }, 0);
    return Math.max(h.length, maxDataWidth);
  });

  const padding = options.padding || 2;
  const separator = colWidths.map(w => '─'.repeat(w + padding)).join('┬');
  const bottomSep = colWidths.map(w => '─'.repeat(w + padding)).join('┴');

  const headerLine = headers.map((h, i) => {
    const width = colWidths[i];
    return String(h).padEnd(width);
  }).join('  ');

  const dataLines = rows.map(row =>
    headers.map((_, i) => {
      const width = colWidths[i];
      return String(row[i] ?? '').padEnd(width);
    }).join('  ')
  );

  return [headerLine, separator, ...dataLines, bottomSep].join('\n');
}

function formatPatternStats(stats) {
  if (stats.length === 0) {
    return chalk.gray('No pattern matches found.');
  }

  const headers = ['Pattern', 'Count', 'First Seen', 'Last Seen'];
  const rows = stats.map(s => [
    s.pattern,
    String(s.count),
    s.firstSeen ? formatTimestamp(s.firstSeen) : 'N/A',
    s.lastSeen ? formatTimestamp(s.lastSeen) : 'N/A'
  ]);

  return formatTable(headers, rows);
}

function formatStatsSummary(summary) {
  const lines = [
    chalk.bold.cyan('═══ Log Analysis Summary ═══'),
    '',
    `${chalk.bold('Total Lines:')}     ${summary.totalLines.toLocaleString()}`,
    `${chalk.bold('Total Requests:')}  ${summary.totalRequests.toLocaleString()}`,
    `${chalk.bold('Total Errors:')}    ${chalk.red(summary.totalErrors.toLocaleString())}`,
    `${chalk.bold('Error Rate:')}      ${parseFloat(summary.errorRate) > 5 ? chalk.red(summary.errorRate + '%') : chalk.green(summary.errorRate + '%')}`,
    ''
  ];

  if (summary.responseTime && summary.responseTime.avg > 0) {
    lines.push(chalk.bold.cyan('── Response Time ──'));
    lines.push(`${chalk.bold('  P50:')}  ${formatMs(summary.responseTime.p50)}`);
    lines.push(`${chalk.bold('  P95:')}  ${formatMs(summary.responseTime.p95)}`);
    lines.push(`${chalk.bold('  P99:')}  ${formatMs(summary.responseTime.p99)}`);
    lines.push(`${chalk.bold('  Avg:')}  ${formatMs(summary.responseTime.avg)}`);
    lines.push(`${chalk.bold('  Max:')}  ${formatMs(summary.responseTime.max)}`);
    lines.push('');
  }

  if (summary.statusCodes && Object.keys(summary.statusCodes).length > 0) {
    lines.push(chalk.bold.cyan('── Status Codes ──'));
    for (const [code, count] of Object.entries(summary.statusCodes).sort()) {
      const color = getCodeColor(code);
      lines.push(`  ${color(code)}: ${count.toLocaleString()}`);
    }
    lines.push('');
  }

  if (summary.startTime && summary.endTime) {
    lines.push(`${chalk.bold('Time Range:')} ${formatTimestamp(summary.startTime)} → ${formatTimestamp(summary.endTime)}`);
  }

  return lines.join('\n');
}

function formatTimeSeries(timeSeries) {
  if (timeSeries.length === 0) {
    return chalk.gray('No time series data.');
  }

  const headers = ['Window', 'Requests', 'Errors', 'Error Rate', 'P50', 'P95', 'P99'];
  const rows = timeSeries.map(w => [
    w.window,
    String(w.requests),
    String(w.errors),
    w.errorRate + '%',
    formatMsShort(w.responseTime.p50),
    formatMsShort(w.responseTime.p95),
    formatMsShort(w.responseTime.p99)
  ]);

  return formatTable(headers, rows);
}

function formatAlerts(alerts) {
  if (alerts.length === 0) {
    return chalk.green('✓ No alerts triggered.');
  }

  const lines = [chalk.bold.yellow(`═══ Alerts (${alerts.length}) ═══`), ''];
  for (const alert of alerts) {
    const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
    const color = alert.severity === 'critical' ? chalk.red.bold : chalk.yellow;
    lines.push(color(`${icon} [${alert.severity.toUpperCase()}] ${alert.name}`));
    lines.push(`  ${alert.metric} = ${alert.value} ${alert.comparator} ${alert.threshold}`);
    lines.push(`  Time: ${formatTimestamp(alert.timestamp)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatArchiveResults(results) {
  if (!Array.isArray(results)) results = [results];

  const headers = ['Original', 'Archive', 'Size', 'Compressed', 'Ratio', 'Speed'];
  const rows = results.filter(r => !r.error).map(r => [
    path.basename(r.original),
    path.basename(r.archive),
    formatBytes(r.originalSize),
    formatBytes(r.archivedSize),
    r.compressionRatio + '%',
    r.speedMBs + ' MB/s'
  ]);

  const errorRows = results.filter(r => r.error);
  let output = '';

  if (rows.length > 0) {
    output += formatTable(headers, rows);
  }

  if (errorRows.length > 0) {
    output += '\n' + chalk.red('Errors:');
    for (const e of errorRows) {
      output += `\n  ${e.original}: ${chalk.red(e.error)}`;
    }
  }

  return output;
}

function toJSON(data) {
  return JSON.stringify(data, null, 2);
}

function toCSV(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((_, i) => escape(row[i])).join(','));
  }
  return lines.join('\n');
}

function patternStatsToCSV(stats) {
  const headers = ['Pattern', 'Count', 'First Seen', 'Last Seen'];
  const rows = stats.map(s => [s.pattern, s.count, s.firstSeen || '', s.lastSeen || '']);
  return toCSV(headers, rows);
}

function timeSeriesToCSV(timeSeries) {
  const headers = ['Window', 'Requests', 'Errors', 'Error Rate', 'P50', 'P95', 'P99'];
  const rows = timeSeries.map(w => [
    w.window, w.requests, w.errors, w.errorRate,
    w.responseTime.p50, w.responseTime.p95, w.responseTime.p99
  ]);
  return toCSV(headers, rows);
}

function toMarkdownTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataLines = rows.map(row => `| ${row.map(c => c ?? '').join(' | ')} |`);
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

function patternStatsToMarkdown(stats) {
  const headers = ['Pattern', 'Count', 'First Seen', 'Last Seen'];
  const rows = stats.map(s => [s.pattern, s.count, s.firstSeen || 'N/A', s.lastSeen || 'N/A']);
  return toMarkdownTable(headers, rows);
}

function timeSeriesToMarkdown(timeSeries) {
  const headers = ['Window', 'Requests', 'Errors', 'Error Rate', 'P50', 'P95', 'P99'];
  const rows = timeSeries.map(w => [
    w.window, w.requests, w.errors, w.errorRate + '%',
    formatMsShort(w.responseTime.p50),
    formatMsShort(w.responseTime.p95),
    formatMsShort(w.responseTime.p99)
  ]);
  return toMarkdownTable(headers, rows);
}

async function writeOutput(content, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }

  const resolvedPath = path.resolve(outputPath);
  await fs.ensureDir(path.dirname(resolvedPath));
  await fs.writeFile(resolvedPath, content, 'utf-8');
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  } catch {
    return ts;
  }
}

function formatMs(ms) {
  if (ms === 0) return '0 ms';
  if (ms < 1) return `${(ms * 1000).toFixed(0)} μs`;
  if (ms > 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(2)} ms`;
}

function formatMsShort(ms) {
  if (ms === 0) return '0ms';
  if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getCodeColor(code) {
  const n = parseInt(code, 10);
  if (n >= 500) return chalk.red;
  if (n >= 400) return chalk.yellow;
  if (n >= 300) return chalk.cyan;
  return chalk.green;
}

module.exports = {
  formatTable,
  formatPatternStats,
  formatStatsSummary,
  formatTimeSeries,
  formatAlerts,
  formatArchiveResults,
  toJSON,
  toCSV,
  patternStatsToCSV,
  timeSeriesToCSV,
  toMarkdownTable,
  patternStatsToMarkdown,
  timeSeriesToMarkdown,
  writeOutput,
  formatTimestamp,
  formatMs,
  formatBytes
};
