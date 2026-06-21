import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs-extra';
import readline from 'readline';
import { getConfig } from './config.js';

const config = getConfig();

export function formatStatus(status, type = 'material') {
  const statusConfig = type === 'project' ? config.projectStatus : config.materialStatus;
  const conf = statusConfig[status];
  if (!conf) return status;
  const label = conf.label;
  switch (conf.color) {
    case 'gray':
      return chalk.gray(label);
    case 'yellow':
      return chalk.yellow(label);
    case 'green':
      return chalk.green(label);
    case 'red':
      return chalk.red(label);
    default:
      return label;
  }
}

export function formatProjectStatus(status) {
  return formatStatus(status, 'project');
}

export function formatMaterialType(type) {
  return config.materialTypes[type] || type;
}

export function formatRole(role) {
  return config.roles[role] || role;
}

export function formatFeedbackStatus(status) {
  const conf = config.feedbackStatus[status];
  if (!conf) return status;
  switch (conf.color) {
    case 'gray':
      return chalk.gray(conf.label);
    case 'green':
      return chalk.green(conf.label);
    default:
      return conf.label;
  }
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function formatPercentage(value, total) {
  if (!total || total === 0) return '0.00%';
  return `${((value / total) * 100).toFixed(2)}%`;
}

export function createTable(headers, options = {}) {
  const tableOpts = {
    head: headers.map(h => chalk.cyan.bold(h)),
    style: {
      head: [],
      border: [],
      compact: options.compact || false
    },
    wordWrap: options.wordWrap !== false,
    wrapOnWordBoundary: true
  };
  if (options.colWidths) {
    tableOpts.colWidths = options.colWidths;
  }
  const table = new Table(tableOpts);
  return table;
}

export function renderTable(headers, rows, options = {}) {
  if (!rows || rows.length === 0) {
    console.log(chalk.gray('  (暂无数据)'));
    return;
  }
  const table = createTable(headers, options);
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

export function renderPaginatedTable(headers, rows, options = {}) {
  const pageSize = options.pageSize || config.pagination.pageSize;
  const totalPages = Math.ceil(rows.length / pageSize);
  let currentPage = options.page || 1;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = rows.slice(start, end);
  renderTable(headers, pageRows, options);
  if (totalPages > 1) {
    console.log(chalk.gray(`\n  第 ${currentPage}/${totalPages}页，共 ${rows.length} 条记录`));
  }
  return { totalPages, currentPage, pageSize };
}

export async function renderPaginatedTableInteractive(headers, rows, options = {}) {
  const pageSize = options.pageSize || config.pagination.pageSize;
  const totalPages = Math.ceil(rows.length / pageSize);
  let currentPage = options.page || 1;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  if (!isTTY || totalPages <= 1 || options.noInteractive) {
    return renderPaginatedTable(headers, rows, options);
  }

  const clearPage = () => {
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
  };

  const renderPage = () => {
    clearPage();
    renderHeader(options._title || '查询结果');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageRows = rows.slice(start, end);
    renderTable(headers, pageRows, options);
    console.log();
    console.log(chalk.cyan.bold(`  第 ${chalk.yellow(currentPage)}/${chalk.yellow(totalPages)} 页  |  共 ${chalk.green(rows.length)} 条记录`));
    console.log(chalk.gray('  导航: [↑/↓/P/N] 翻页  [Home/End] 首页/末页  [G 数字回车] 跳转到页  [Q/ESC/Ctrl+C] 退出'));
  };

  renderPage();

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    let awaitingGoto = false;
    let gotoBuffer = '';

    const cleanup = () => {
      rl.close();
      process.stdin.removeAllListeners();
      process.stdin.setRawMode(false);
      resolve({ totalPages, currentPage, pageSize, exit: true });
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('data', (data) => {
      const str = data.toString();
      const codes = [...data];
      let goNext = false;
      let goPrev = false;

      if (codes.length === 3 && codes[0] === 27 && codes[1] === 91) {
        if (codes[2] === 65 /* UP */) { goPrev = true; }
        else if (codes[2] === 66 /* DOWN */) { goNext = true; }
        else if (codes[2] === 72 /* HOME */) { currentPage = 1; renderPage(); return; }
        else if (codes[2] === 70 /* END */) { currentPage = totalPages; renderPage(); return; }
        else { return; }
      } else if (str === '\x1B' /* ESC */ || str === '\x03' /* Ctrl+C */ || str.toLowerCase() === 'q') {
        cleanup();
        return;
      } else if (awaitingGoto) {
        if (str === '\r' || str === '\n') {
          const pageNum = parseInt(gotoBuffer, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            currentPage = pageNum;
          }
          awaitingGoto = false;
          gotoBuffer = '';
          renderPage();
          return;
        } else if (/^\d$/.test(str)) {
          gotoBuffer += str;
          return;
        } else {
          awaitingGoto = false;
          gotoBuffer = '';
          return;
        }
      } else if (str.toLowerCase() === 'n' || str === ' ') { goNext = true; }
      else if (str.toLowerCase() === 'p' || str === '\b') { goPrev = true; }
      else if (str.toLowerCase() === 'g') { awaitingGoto = true; gotoBuffer = ''; return; }
      else { return; }

      if (goNext && currentPage < totalPages) { currentPage++; renderPage(); }
      else if (goPrev && currentPage > 1) { currentPage--; renderPage(); }
    });

    rl.on('close', () => { /* ignore */ });
  });
}

export function renderTree(items, options = {}) {
  const {
    labelKey = 'name',
    childrenKey = 'children',
    prefix = ''
  } = options;
  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${connector}${item[labelKey]}`);
    if (item[childrenKey] && item[childrenKey].length > 0) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      renderTree(item[childrenKey], {
        labelKey,
        childrenKey,
        prefix: newPrefix
      });
    }
  });
}

export function renderJson(data, pretty = true) {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

export function renderError(error) {
  const code = error.code || 'E999';
  const message = error.message || error.error || '未知错误';
  const suggestion = error.suggestion || '';
  console.log(chalk.red.bold(`  [错误] ${code}: ${message}`));
  if (suggestion) {
    console.log(chalk.yellow(`  建议: ${suggestion}`));
  }
}

export function renderSuccess(message) {
  console.log(chalk.green.bold(`  ✓ ${message}`));
}

export function renderWarning(message) {
  console.log(chalk.yellow(`  ⚠ ${message}`));
}

export function renderInfo(message) {
  console.log(chalk.blue(`  ℹ ${message}`));
}

export function renderProgressBar(current, total, width = 30) {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(percentage * width);
  const unfilled = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(unfilled);
  const pct = (percentage * 100).toFixed(1);
  console.log(`  [${bar}] ${chalk.green(pct + '%')} (${current}/${total})`);
}

export function renderDivider(char = '-', width = 60) {
  console.log(chalk.gray(char.repeat(width)));
}

export function renderHeader(title) {
  const width = 60;
  const padding = Math.max(0, Math.floor((width - title.length - 4) / 2));
  const line = '═'.repeat(width);
  console.log(chalk.cyan.bold(line));
  console.log(chalk.cyan.bold(`${' '.repeat(padding)}  ${title}  ${' '.repeat(padding)}`));
  console.log(chalk.cyan.bold(line));
  console.log();
}

export function toCSV(headers, rows) {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map(escapeCSV).join(',');
  const bodyLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

export function saveCSV(filePath, headers, rows) {
  const csvContent = '\ufeff' + toCSV(headers, rows);
  fs.writeFileSync(filePath, csvContent, 'utf-8');
}
