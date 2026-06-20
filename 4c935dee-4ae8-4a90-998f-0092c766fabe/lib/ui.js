'use strict';

const Table = require('cli-table3');
const chalk = require('chalk');
const ora = require('ora');

function renderTable(headers, rows, options) {
  const opts = options || {};
  const table = new Table({
    head: headers,
    style: { head: [], border: [] },
    wordWrap: opts.wordWrap !== false,
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    }
  });
  for (const row of rows) table.push(row);
  return table.toString();
}

function makeSpinner(options) {
  const opts = options || {};
  if (opts.json || opts.quiet) {
    return {
      start() { return this; },
      stop() { return this; },
      succeed() { return this; },
      fail() { return this; },
      warn() { return this; },
      text: '',
      set text(v) { this._t = v; },
      get text() { return this._t; }
    };
  }
  return ora({ text: opts.text || '', color: opts.color || 'cyan', spinner: 'dots' });
}

function progressBar(current, total, width) {
  if (!total) return '';
  const w = width || 24;
  const filled = Math.round((current / total) * w);
  const bar = '█'.repeat(filled) + '░'.repeat(w - filled);
  const pct = Math.round((current / total) * 100);
  return `${bar} ${pct}% (${current}/${total})`;
}

function printResult(logger, result, options) {
  const opts = options || {};
  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (typeof result === 'string') {
    logger.raw(result);
  } else {
    logger.raw(JSON.stringify(result, null, 2));
  }
}

function tierColor(tier, text) {
  switch (tier) {
    case 'expired': return chalk.red(text);
    case 'critical': return chalk.red.bold(text);
    case 'high': return chalk.yellow.bold(text);
    case 'medium': return chalk.yellow(text);
    case 'low': return chalk.cyan(text);
    default: return chalk.green(text);
  }
}

function statusBadge(ok) {
  return ok ? chalk.green('✓') : chalk.red('✗');
}

module.exports = { renderTable, makeSpinner, progressBar, printResult, tierColor, statusBadge };
