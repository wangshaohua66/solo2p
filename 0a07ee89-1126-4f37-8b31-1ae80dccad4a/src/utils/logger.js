import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const LEVELS = { silent: -1, error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT_LOG_DIR = path.join(process.cwd(), 'logs');

function nowStamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level] ?? LEVELS.info;
    this.verbose = options.verbose ?? false;
    this.silent = options.silent ?? false;
    if (this.silent) this.level = LEVELS.error;
    if (this.verbose && this.level < LEVELS.debug) this.level = LEVELS.debug;
    this.logDir = options.logDir || DEFAULT_LOG_DIR;
    this.errorLogFile = options.errorLogFile || path.join(this.logDir, 'reconcile-errors.log');
    this.matchLogFile = options.matchLogFile || path.join(this.logDir, 'match-exceptions.log');
    this._bar = null;
    this._barTotal = 0;
    this._barCurrent = 0;
    this._useColor = options.color !== false && process.stdout.isTTY !== false;
  }

  _paint(color, msg) {
    return this._useColor ? color(msg) : msg;
  }

  _emit(level, color, tag, msg) {
    if (this.level < LEVELS[level]) return;
    const prefix = this._paint(color, `[${tag}]`);
    const ts = this._paint(chalk.gray, nowStamp());
    process.stdout.write(`${ts} ${prefix} ${msg}\n`);
  }

  debug(msg) {
    if (this.level >= LEVELS.debug) this._emit('debug', chalk.gray, 'DEBUG', msg);
  }

  info(msg) {
    this._emit('info', chalk.cyan, 'INFO', msg);
  }

  success(msg) {
    this._emit('info', chalk.green, ' OK ', msg);
  }

  warn(msg) {
    this._emit('warn', chalk.yellow, 'WARN', msg);
  }

  error(msg, err) {
    this._emit('error', chalk.red.bold, 'ERR ', msg);
    if (err && err.stack) this._emit('error', chalk.red, 'ERR ', err.stack);
    this._writeErrorFile(`${nowStamp()} ${msg}${err ? '\n' + (err.stack || err.message || err) : ''}\n`);
  }

  highlight(msg) {
    this._emit('info', chalk.magentaBright.bold, '>>>', msg);
  }

  _writeErrorFile(line) {
    try {
      ensureDir(this.logDir);
      fs.appendFileSync(this.errorLogFile, line);
    } catch (_) {
      // ignore file logging failures
    }
  }

  logMatchException(rec) {
    try {
      ensureDir(this.logDir);
      fs.appendFileSync(this.matchLogFile, JSON.stringify(rec) + '\n');
    } catch (_) {
      // ignore
    }
  }

  table(rows, options = {}) {
    if (!rows || rows.length === 0) {
      this.info(this._paint(chalk.gray, '(无数据)'));
      return;
    }
    const cols = options.columns || Object.keys(rows[0]);
    const widths = cols.map((c) => Math.max(String(c).length, ...rows.map((r) => String(r[c] ?? '').length)));
    const header = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
    this.info(this._paint(chalk.bold.underline, header));
    rows.forEach((r) => {
      const line = cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
      process.stdout.write(`${line}\n`);
    });
  }

  startProgress(total, label = '处理中') {
    if (this.silent) return;
    this._barTotal = total;
    this._barCurrent = 0;
    this._barLabel = label;
    this._renderProgress();
  }

  tickProgress(inc = 1, note = '') {
    if (this.silent || !this._barTotal) return;
    this._barCurrent = Math.min(this._barTotal, this._barCurrent + inc);
    this._renderProgress(note);
  }

  _renderProgress(note = '') {
    const pct = Math.floor((this._barCurrent / this._barTotal) * 100);
    const filled = Math.floor((this._barCurrent / this._barTotal) * 30);
    const bar = this._paint(chalk.green, '█'.repeat(filled)) + this._paint(chalk.gray, '░'.repeat(30 - filled));
    process.stdout.write(`\r${this._barLabel} [${bar}] ${pct}% (${this._barCurrent}/${this._barTotal}) ${note}`);
    if (this._barCurrent >= this._barTotal) process.stdout.write('\n');
  }

  streamProgress(stream, total, label = '解析中') {
    let count = 0;
    this.startProgress(total, label);
    const onProgress = () => this.tickProgress(1);
    stream.on('data', onProgress);
    stream.on('end', () => this.tickProgress(0));
    return stream;
  }
}

const globalLogger = new Logger();

function setLogger(options) {
  Object.assign(globalLogger, new Logger(options));
}

export { Logger, setLogger };
export default globalLogger;
