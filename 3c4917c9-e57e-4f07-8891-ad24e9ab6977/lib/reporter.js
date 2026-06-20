import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { fileURLToPath } from 'url';
import { formatDate, formatBytes, formatDuration, truncate, ensureDir, dirExists } from './utils.js';
import { getLogger } from './logger.js';
import { createError, ErrorCodes } from './errors.js';
import { getReportsDir, getConfig } from './config-loader.js';
import { DiffType, Severity, SEVERITY_WEIGHTS } from './diff-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ReportFormat = {
  CONSOLE: 'console',
  JSON: 'json',
  HTML: 'html',
  CSV: 'csv',
  MARKDOWN: 'markdown'
};

const SeverityStyles = {
  [Severity.CRITICAL]: { chalk: chalk.bgRed.bold.white, label: '严重', symbol: '✖' },
  [Severity.HIGH]: { chalk: chalk.red.bold, label: '高危', symbol: '⚠' },
  [Severity.MEDIUM]: { chalk: chalk.yellow.bold, label: '中等', symbol: '!' },
  [Severity.LOW]: { chalk: chalk.blue, label: '低危', symbol: 'i' },
  [Severity.INFO]: { chalk: chalk.gray, label: '信息', symbol: '·' }
};

const DiffTypeStyles = {
  [DiffType.ADDED]: { chalk: chalk.green, label: '新增', prefix: '+' },
  [DiffType.REMOVED]: { chalk: chalk.red, label: '删除', prefix: '-' },
  [DiffType.MODIFIED]: { chalk: chalk.yellow, label: '修改', prefix: '~' },
  [DiffType.UNCHANGED]: { chalk: chalk.gray, label: '未变', prefix: ' ' }
};

function formatSeverity(severity) {
  const style = SeverityStyles[severity] || SeverityStyles[Severity.INFO];
  return style.chalk(`${style.symbol} ${style.label}`);
}

function formatDiffType(type) {
  const style = DiffTypeStyles[type] || DiffTypeStyles[DiffType.UNCHANGED];
  return style.chalk(`${style.prefix} ${style.label}`);
}

function formatValueForConsole(value, maxLen = 80) {
  if (value === null || value === undefined) return chalk.gray('(空)');
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return truncate(str, maxLen);
}

function generateDiffReportConsole(diffResult, options = {}) {
  const { showAll = false, maxChangesPerFile = 50 } = options;
  const lines = [];

  lines.push('');
  lines.push(chalk.bold.cyan('='.repeat(80)));
  lines.push(chalk.bold.cyan(`配置差异检测报告 - ${formatDate(new Date())}`));
  lines.push(chalk.bold.cyan(`源环境: ${diffResult.sourceEnvName}  →  目标环境: ${diffResult.targetEnvName}`));
  lines.push(chalk.bold.cyan('='.repeat(80)));
  lines.push('');

  const s = diffResult.summary;
  lines.push(chalk.bold('📊 总体统计'));
  const summaryTable = new Table({
    head: [chalk.white('指标'), chalk.white('数量')],
    colWidths: [40, 30],
    wordWrap: true
  });
  summaryTable.push(
    [chalk.gray('对比配置文件数'), s.comparedFiles],
    [chalk.gray('仅源环境存在文件'), chalk.yellow(s.filesOnlyInSource)],
    [chalk.gray('仅目标环境存在文件'), chalk.yellow(s.filesOnlyInTarget)],
    [chalk.gray('总差异数'), chalk.bold.white(s.totalChanges)],
    [chalk.gray('  ├ 新增项'), chalk.green('+' + s.added)],
    [chalk.gray('  ├ 删除项'), chalk.red('-' + s.removed)],
    [chalk.gray('  └ 修改项'), chalk.yellow('~' + s.modified)],
    [chalk.gray('关键配置受影响'), chalk.red(s.criticalKeysAffected)],
    [chalk.gray('严重级别'), formatSeverityBreakdown(s.bySeverity)],
    [chalk.gray('存在重大漂移'), s.hasDrift ? chalk.bgRed.white(' 是 ') : chalk.bgGreen.white(' 否 ')],
    [chalk.gray('耗时'), formatDuration(s.duration)]
  );
  lines.push(summaryTable.toString());
  lines.push('');

  if (s.hasDrift) {
    lines.push(chalk.bgRed.white.bold(' ⚠ 警告: 检测到严重级别漂移，建议立即处理！ '));
    lines.push('');
  }

  if (diffResult.byService) {
    lines.push(chalk.bold('🔧 按微服务分组'));
    lines.push('');

    for (const [serviceName, serviceData] of Object.entries(diffResult.byService).sort((a, b) => b[1].totalChanges - a[1].totalChanges)) {
      if (serviceData.totalChanges === 0 && !showAll) continue;

      lines.push(chalk.bold.blue(`\n━━━ 服务: ${serviceName} (${serviceData.totalChanges} 处差异) ━━━`));

      for (const fileDiff of serviceData.files) {
        if (fileDiff.summary.total === 0 && !showAll) continue;

        const filePath = (fileDiff.sourceFile || fileDiff.targetFile)?.relativePath || '(未知文件)';
        lines.push(`\n  📄 ${filePath}`);

        if (fileDiff.summary.total === 0 && showAll) {
          lines.push(`     ${chalk.green('✓')} ${chalk.gray('无差异')}`);
          continue;
        }

        const changes = fileDiff.changes.slice(0, maxChangesPerFile);
        for (const change of changes) {
          const sevStyle = SeverityStyles[change.severity] || SeverityStyles[Severity.INFO];
          const diffStyle = DiffTypeStyles[change.type] || DiffTypeStyles[DiffType.UNCHANGED];
          lines.push(
            `     ${sevStyle.symbol} ${diffStyle.chalk(diffStyle.prefix)} ` +
            `${chalk.bold(change.key)} ` +
            `${sevStyle.chalk(`[${sevStyle.label}]`)}`
          );
          if (change.type === DiffType.MODIFIED) {
            lines.push(`       ${chalk.red('旧:')} ${formatValueForConsole(change.oldValue)}`);
            lines.push(`       ${chalk.green('新:')} ${formatValueForConsole(change.newValue)}`);
          } else if (change.type === DiffType.ADDED) {
            lines.push(`       ${chalk.green('值:')} ${formatValueForConsole(change.newValue)}`);
          } else if (change.type === DiffType.REMOVED) {
            lines.push(`       ${chalk.red('旧值:')} ${formatValueForConsole(change.oldValue)}`);
          }
        }

        if (fileDiff.changes.length > maxChangesPerFile) {
          lines.push(`     ${chalk.gray(`... 还有 ${fileDiff.changes.length - maxChangesPerFile} 处差异未显示`)}`);
        }
      }
    }
  }

  lines.push('');
  lines.push(chalk.gray('─'.repeat(80)));
  lines.push(chalk.gray(`报告生成于: ${formatDate(new Date())} | ConfigDrift Checker v1.0.0`));
  lines.push('');
  return lines.join('\n');
}

function formatSeverityBreakdown(bySeverity) {
  const parts = [];
  for (const [sev, count] of Object.entries(bySeverity || {})) {
    if (count > 0) {
      parts.push(`${SeverityStyles[sev]?.label || sev}: ${count}`);
    }
  }
  return parts.join(', ') || '(无)';
}

function generateDriftReportConsole(driftResult, options = {}) {
  const { showAll = false } = options;
  const lines = [];

  lines.push('');
  lines.push(chalk.bold.magenta('═'.repeat(80)));
  lines.push(chalk.bold.magenta(`配置漂移扫描报告 - ${formatDate(new Date())}`));
  lines.push(chalk.bold.magenta('═'.repeat(80)));
  lines.push('');

  const s = driftResult.driftSummary || driftResult.summary;
  lines.push(chalk.bold('🚨 漂移状态总览'));
  const driftTable = new Table({
    head: [chalk.white('指标'), chalk.white('结果')],
    colWidths: [35, 40]
  });

  driftTable.push(
    [chalk.gray('漂移项总数'), chalk.bold.white(s.driftCount || s.totalChanges)],
    [chalk.gray('未授权变更'), s.unauthorizedChanges ? chalk.bgRed.white(` ${s.unauthorizedChanges} `) : chalk.green('0')],
    [chalk.gray('严重漂移'), chalk.red(s.criticalDrift || s.bySeverity?.critical || 0)],
    [chalk.gray('高危漂移'), chalk.yellow(s.highDrift || s.bySeverity?.high || 0)],
    [chalk.gray('中等漂移'), chalk.blue(s.mediumDrift || s.bySeverity?.medium || 0)],
    [chalk.gray('漂移综合评分'), chalk.bold(`⭐ ${s.driftScore || 0}`)],
    [chalk.gray('受影响服务数'), (s.affectedServices?.length || 0) + ' 个']
  );
  lines.push(driftTable.toString());
  lines.push('');

  const driftItems = driftResult.driftItems || [];
  if (driftItems.length > 0) {
    lines.push(chalk.bold('📋 漂移项详情'));
    lines.push('');

    const detailTable = new Table({
      head: [
        chalk.white('#'),
        chalk.white('级别'),
        chalk.white('服务'),
        chalk.white('配置项'),
        chalk.white('类型'),
        chalk.white('值变更')
      ],
      colWidths: [4, 8, 18, 28, 8, 26],
      wordWrap: true
    });

    const displayItems = showAll ? driftItems : driftItems.slice(0, 50);
    let idx = 1;
    for (const item of displayItems) {
      const sevStyle = SeverityStyles[item.severity];
      const diffStyle = DiffTypeStyles[item.type];
      let valueChange = '';
      if (item.type === DiffType.MODIFIED) {
        valueChange = `${formatValueForConsole(item.oldValue, 10)} → ${formatValueForConsole(item.newValue, 10)}`;
      } else if (item.type === DiffType.ADDED) {
        valueChange = `+ ${formatValueForConsole(item.newValue, 20)}`;
      } else {
        valueChange = `- ${formatValueForConsole(item.oldValue, 20)}`;
      }
      detailTable.push([
        String(idx++),
        sevStyle ? sevStyle.chalk(sevStyle.label) : item.severity,
        item.serviceName || '-',
        truncate(item.key || '(unknown)', 26),
        diffStyle ? diffStyle.chalk(diffStyle.label) : item.type,
        valueChange
      ]);
    }
    lines.push(detailTable.toString());

    if (!showAll && driftItems.length > 50) {
      lines.push(chalk.gray(`\n... 仅显示前50项，共 ${driftItems.length} 项。使用 --show-all 查看全部。`));
    }
  }

  lines.push('');
  return lines.join('\n');
}

function generateSecretsReportConsole(scanResult, options = {}) {
  const lines = [];

  lines.push('');
  lines.push(chalk.bold.red('🔐'.repeat(40)));
  lines.push(chalk.bold.red(`敏感信息扫描报告 - ${formatDate(new Date())}`));
  lines.push(chalk.bold.red('🔐'.repeat(40)));
  lines.push('');

  const s = scanResult.summary;
  lines.push(chalk.bold('📈 扫描统计'));
  const summaryTable = new Table({
    head: [chalk.white('指标'), chalk.white('结果')],
    colWidths: [30, 40]
  });
  summaryTable.push(
    [chalk.gray('扫描文件数'), s.filesScanned],
    [chalk.gray('存在问题文件'), s.filesWithFindings ? chalk.red(s.filesWithFindings) : chalk.green('0')],
    [chalk.gray('发现总数'), s.total ? chalk.bold.red(s.total) : chalk.green('0')],
    [chalk.gray('严重级别'), chalk.red(s.bySeverity?.critical || 0)],
    [chalk.gray('高危级别'), chalk.yellow(s.bySeverity?.high || 0)],
    [chalk.gray('中等级别'), chalk.blue(s.bySeverity?.medium || 0)],
    [chalk.gray('低危级别'), chalk.gray(s.bySeverity?.low || 0)],
    [chalk.gray('风险评分'), chalk.bold(`🔥 ${s.riskScore || 0}`)],
    [chalk.gray('受影响服务'), s.affectedServices?.length || 0],
    [chalk.gray('平均扫描耗时'), `${s.avgScanTimePerFile || 0}ms/文件`]
  );
  lines.push(summaryTable.toString());
  lines.push('');

  const allFindings = scanResult.allFindings || [];
  if (allFindings.length > 0) {
    lines.push(chalk.bold('⚠  敏感信息发现列表'));
    lines.push('');

    const findingsTable = new Table({
      head: [
        chalk.white('级别'),
        chalk.white('类别'),
        chalk.white('服务'),
        chalk.white('配置键'),
        chalk.white('脱敏值'),
        chalk.white('建议')
      ],
      colWidths: [8, 12, 14, 24, 22, 30],
      wordWrap: true
    });

    for (const finding of allFindings.slice(0, 80)) {
      const sevStyle = SeverityStyles[finding.severity];
      findingsTable.push([
        sevStyle ? sevStyle.chalk(sevStyle.label) : finding.severity,
        finding.category || '-',
        finding.serviceName || '-',
        truncate(finding.key || finding.type === 'missing' ? '(缺失配置)' : '-', 24),
        finding.maskedValue || truncate(finding.description || '-', 20),
        truncate(finding.suggestion || '-', 28)
      ]);
    }
    lines.push(findingsTable.toString());

    if (allFindings.length > 80) {
      lines.push(chalk.gray(`\n... 仅显示前80项，共 ${allFindings.length} 项。建议导出报告查看完整详情。`));
    }
  } else {
    lines.push(chalk.green.bold('✓ 未检测到敏感信息问题！'));
  }

  lines.push('');
  return lines.join('\n');
}

function generateValidationReportConsole(validationResult, options = {}) {
  const lines = [];

  lines.push('');
  lines.push(chalk.bold.green('✓'.repeat(80)));
  lines.push(chalk.bold.green(`批量校验报告 - ${formatDate(new Date())}`));
  lines.push(chalk.bold.green('✓'.repeat(80)));
  lines.push('');

  const s = validationResult;
  const passColor = s.passRate >= 95 ? chalk.green : s.passRate >= 80 ? chalk.yellow : chalk.red;

  const summaryTable = new Table({
    head: [chalk.white('指标'), chalk.white('结果')],
    colWidths: [30, 40]
  });
  summaryTable.push(
    [chalk.gray('校验文件总数'), s.filesScanned],
    [chalk.gray('通过文件数'), chalk.green(s.validFiles)],
    [chalk.gray('未通过文件数'), s.invalidFiles > 0 ? chalk.red(s.invalidFiles) : chalk.green('0')],
    [chalk.gray('通过率'), passColor.bold(s.passRate + '%')],
    [chalk.gray('总错误数'), s.totalErrors > 0 ? chalk.red(s.totalErrors) : chalk.green('0')],
    [chalk.gray('总警告数'), s.totalWarnings > 0 ? chalk.yellow(s.totalWarnings) : chalk.green('0')]
  );
  lines.push(summaryTable.toString());
  lines.push('');

  if (s.invalidFiles > 0) {
    lines.push(chalk.bold('❌ 校验失败文件明细'));
    lines.push('');

    const failedFiles = validationResult.fileResults.filter((f) => !f.valid).slice(0, 30);
    for (const file of failedFiles) {
      lines.push(chalk.red.bold(`  📄 ${file.relativePath || file.filePath}`));
      for (const err of file.errors.slice(0, 10)) {
        lines.push(`     ${chalk.red('✖')} [${err.code}] ${truncate(err.message || '', 80)}`);
      }
      if (file.errors.length > 10) {
        lines.push(chalk.gray(`     ... 还有 ${file.errors.length - 10} 个错误未显示`));
      }
      for (const warn of file.warnings.slice(0, 5)) {
        lines.push(`     ${chalk.yellow('⚠')} [${warn.code}] ${truncate(warn.message || '', 80)}`);
      }
      lines.push('');
    }
  }

  lines.push('');
  return lines.join('\n');
}

function generateHistoryReportConsole(queryResult, options = {}) {
  const lines = [];

  lines.push('');
  lines.push(chalk.bold.yellow('📜'.repeat(40)));
  lines.push(chalk.bold.yellow(`变更历史记录报告 - ${formatDate(new Date())}`));
  lines.push(chalk.bold.yellow('📜'.repeat(40)));
  lines.push('');

  lines.push(`共 ${queryResult.total} 条记录，显示 ${queryResult.returned} 条`);
  lines.push('');

  if (queryResult.records && queryResult.records.length > 0) {
    const historyTable = new Table({
      head: [
        chalk.white('时间'),
        chalk.white('操作'),
        chalk.white('操作人'),
        chalk.white('环境'),
        chalk.white('服务'),
        chalk.white('配置项'),
        chalk.white('说明')
      ],
      colWidths: [20, 10, 10, 8, 14, 22, 30],
      wordWrap: true
    });

    for (const r of queryResult.records) {
      historyTable.push([
        formatDate(r.timestamp, 'MM-DD HH:mm:ss'),
        r.operation || '-',
        r.operator || '-',
        r.envName || '-',
        truncate(r.serviceName || '-', 12),
        truncate(r.configKey || '-', 20),
        truncate(r.description || (r.configKey ? r.operation : (r.filePath ? path.basename(r.filePath) : '-')), 28)
      ]);
    }
    lines.push(historyTable.toString());
  } else {
    lines.push(chalk.gray('暂无变更记录。'));
  }

  lines.push('');
  return lines.join('\n');
}

function generateJsonReport(data, reportType = 'generic') {
  return JSON.stringify({
    reportType,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    data
  }, null, 2);
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateHtmlReport(data, reportType = 'generic', title = '报告') {
  const severityColors = {
    critical: '#dc3545',
    high: '#fd7e14',
    medium: '#ffc107',
    low: '#0d6efd',
    info: '#6c757d'
  };

  const summary = data.summary || data.driftSummary || {};
  const generatedAt = formatDate(new Date());

  let contentRows = '';
  const items = data.fileDiffs?.map(f => f.changes).flat()
    || data.driftItems
    || data.allFindings
    || data.records
    || data.fileResults?.map(f => f.errors.map(e => ({...e, filePath: f.filePath}))).flat()
    || [];

  for (let i = 0; i < Math.min(items.length, 200); i++) {
    const item = items[i];
    const sev = item.severity || (item.level === 'error' ? 'critical' : 'medium');
    const color = severityColors[sev] || '#6c757d';
    const key = item.key || item.configKey || item.filePath || '';
    const desc = item.description || item.message || (item.type ? DiffTypeStyles[item.type]?.label : '') || '';
    contentRows += `
      <tr>
        <td>${i + 1}</td>
        <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${sev.toUpperCase()}</span></td>
        <td><code>${escapeHtml(key)}</code></td>
        <td>${escapeHtml(String(desc).substring(0, 150))}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; background:#f5f7fa; color:#333; padding:20px; }
  .container { max-width:1200px; margin:0 auto; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; padding:30px; border-radius:12px; margin-bottom:24px; }
  .header h1 { font-size:24px; margin-bottom:8px; }
  .header .meta { opacity:0.9; font-size:14px; }
  .stats-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:16px; margin-bottom:24px; }
  .stat-card { background:#fff; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  .stat-label { font-size:13px; color:#888; margin-bottom:8px; }
  .stat-value { font-size:28px; font-weight:700; }
  .stat-value.danger { color:#dc3545; }
  .stat-value.warning { color:#fd7e14; }
  .stat-value.success { color:#28a745; }
  .card { background:#fff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:24px; margin-bottom:24px; }
  .card h2 { font-size:18px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #eee; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; }
  th { background:#f8f9fa; font-weight:600; }
  tr:hover { background:#f8f9fa; }
  code { background:#f4f4f5; padding:2px 6px; border-radius:4px; font-size:12px; }
  .footer { text-align:center; color:#999; font-size:12px; padding:20px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">报告类型: ${reportType} | 生成时间: ${generatedAt}</div>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">总数</div><div class="stat-value">${summary.total || items.length || 0}</div></div>
    <div class="stat-card"><div class="stat-label">严重</div><div class="stat-value danger">${summary.criticalDrift || summary.bySeverity?.critical || 0}</div></div>
    <div class="stat-card"><div class="stat-label">高危</div><div class="stat-value warning">${summary.highDrift || summary.bySeverity?.high || 0}</div></div>
    <div class="stat-card"><div class="stat-label">通过/通过率</div><div class="stat-value success">${summary.validFiles || summary.passRate ? (summary.passRate + '%') : '-'}</div></div>
  </div>
  <div class="card">
    <h2>详细列表 (Top ${Math.min(items.length, 200)})</h2>
    <table>
      <thead><tr><th>#</th><th>级别</th><th>配置项/文件</th><th>说明</th></tr></thead>
      <tbody>${contentRows || '<tr><td colspan="4" style="text-align:center;color:#999;">暂无数据</td></tr>'}</tbody>
    </table>
  </div>
  <div class="footer">ConfigDrift Checker v1.0.0 - 配置漂移检测工具</div>
</div>
</body>
</html>`;
}

function saveReportToFile(content, format, reportType, envName = 'report') {
  const reportsDir = getReportsDir();
  const timestamp = formatDate(new Date(), 'YYYYMMDD_HHmmss');
  const ext = format === ReportFormat.HTML ? 'html' : format === ReportFormat.JSON ? 'json' : 'txt';
  const fileName = `${reportType}_${envName}_${timestamp}.${ext}`;
  const filePath = path.join(reportsDir, fileName);

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { filePath, fileName, format };
  } catch (error) {
    throw createError(
      `保存报告失败: ${error.message}`,
      ErrorCodes.PERMISSION_DENIED,
      { filePath }
    );
  }
}

function exportToCsv(items, columns, filePath) {
  const headers = columns.map(c => `"${c.label}"`).join(',');
  const rows = items.map(item =>
    columns.map(col => {
      let val = item[col.key] ?? '';
      if (typeof val === 'object') val = JSON.stringify(val);
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  const content = [headers, ...rows].join('\n');
  fs.writeFileSync(filePath, '\uFEFF' + content, 'utf-8');
  return filePath;
}

function exportToMarkdown(data, title = '导出报告') {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> 生成时间: ${formatDate(new Date())}`);
  lines.push('');

  if (data.summary) {
    lines.push('## 概要');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    for (const [k, v] of Object.entries(data.summary)) {
      if (typeof v === 'object') continue;
      lines.push(`| ${k} | ${v} |`);
    }
    lines.push('');
  }

  const items = data.items || data.records || [];
  if (items.length > 0) {
    lines.push('## 详情');
    lines.push('');
    const cols = Object.keys(items[0]).slice(0, 6);
    lines.push('| ' + cols.join(' | ') + ' |');
    lines.push('| ' + cols.map(() => '---').join(' | ') + ' |');
    for (const item of items.slice(0, 200)) {
      const row = cols.map(c => {
        let val = item[c] ?? '';
        if (typeof val === 'object') val = JSON.stringify(val);
        return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 100);
      });
      lines.push('| ' + row.join(' | ') + ' |');
    }
  }

  return lines.join('\n');
}

export {
  ReportFormat,
  SeverityStyles,
  DiffTypeStyles,
  formatSeverity,
  formatDiffType,
  generateDiffReportConsole,
  generateDriftReportConsole,
  generateSecretsReportConsole,
  generateValidationReportConsole,
  generateHistoryReportConsole,
  generateJsonReport,
  generateHtmlReport,
  saveReportToFile,
  exportToCsv,
  exportToMarkdown
};

export default {
  generateDiffReportConsole,
  generateJsonReport,
  saveReportToFile
};
