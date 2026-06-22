const chalk = require('chalk');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'INFO';
    this.logDir = options.logDir || null;
    this.enableTimestamp = options.enableTimestamp !== false;
    this.enableColors = options.enableColors !== false;
    this._logFileStream = null;
    this._errorFileStream = null;

    if (this.logDir) {
      this._initFileStreams();
    }
  }

  _initFileStreams() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      const dateStr = dayjs().format('YYYYMMDD');
      const logPath = path.join(this.logDir, `invoice-${dateStr}.log`);
      const errPath = path.join(this.logDir, `invoice-${dateStr}.error.log`);
      this._logFileStream = fs.createWriteStream(logPath, { flags: 'a' });
      this._errorFileStream = fs.createWriteStream(errPath, { flags: 'a' });
    } catch (e) {
      this.logDir = null;
    }
  }

  _getLevelValue(level) {
    return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
  }

  _shouldLog(level) {
    return this._getLevelValue(level) >= this._getLevelValue(this.level);
  }

  _timestamp() {
    return this.enableTimestamp ? dayjs().format('YYYY-MM-DD HH:mm:ss.SSS') : '';
  }

  _formatMessage(level, message, meta = {}) {
    const parts = [];
    if (this.enableTimestamp) parts.push(`[${this._timestamp()}]`);
    parts.push(`[${level}]`);
    if (meta.operation) parts.push(`[${meta.operation}]`);
    if (meta.count !== undefined) parts.push(`[数量:${meta.count}]`);
    if (meta.durationMs !== undefined) parts.push(`[耗时:${meta.durationMs}ms]`);
    parts.push(String(message));
    if (meta.details) parts.push(`| ${meta.details}`);
    return parts.join(' ');
  }

  _writeToFile(level, formatted) {
    if (!this.logDir) return;
    const line = formatted + '\n';
    try {
      if (this._logFileStream) this._logFileStream.write(line);
      if ((level === 'ERROR' || level === 'WARN') && this._errorFileStream) {
        this._errorFileStream.write(line);
      }
    } catch (e) {
    }
  }

  debug(message, meta = {}) {
    if (!this._shouldLog('DEBUG')) return;
    const msg = this._formatMessage('DEBUG', message, meta);
    const colored = this.enableColors ? chalk.gray(msg) : msg;
    console.log(colored);
    this._writeToFile('DEBUG', msg);
  }

  info(message, meta = {}) {
    if (!this._shouldLog('INFO')) return;
    const msg = this._formatMessage('INFO', message, meta);
    const colored = this.enableColors ? chalk.blue(msg) : msg;
    console.log(colored);
    this._writeToFile('INFO', msg);
  }

  success(message, meta = {}) {
    if (!this._shouldLog('INFO')) return;
    const msg = this._formatMessage('SUCCESS', message, meta);
    const colored = this.enableColors ? chalk.green(msg) : msg;
    console.log(colored);
    this._writeToFile('INFO', msg);
  }

  warn(message, meta = {}) {
    if (!this._shouldLog('WARN')) return;
    const msg = this._formatMessage('WARN', message, meta);
    const colored = this.enableColors ? chalk.yellow(msg) : msg;
    console.warn(colored);
    this._writeToFile('WARN', msg);
  }

  error(message, meta = {}) {
    if (!this._shouldLog('ERROR')) return;
    const msg = this._formatMessage('ERROR', message, meta);
    const colored = this.enableColors ? chalk.red(msg) : msg;
    console.error(colored);
    this._writeToFile('ERROR', msg);
  }

  section(title) {
    if (!this._shouldLog('INFO')) return;
    const line = '═'.repeat(Math.min(title.length + 8, 60));
    const msg = `\n${line}\n  ${title}\n${line}`;
    const colored = this.enableColors ? chalk.cyan.bold(msg) : msg;
    console.log(colored);
  }

  progress(current, total, label = '') {
    if (!this._shouldLog('INFO')) return;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const barLen = 20;
    const filled = Math.round((percent / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    const msg = `${label} [${bar}] ${percent}% (${current}/${total})`;
    const colored = this.enableColors ? chalk.magenta(msg) : msg;
    if (process.stdout.isTTY) {
      process.stdout.write('\r' + colored);
      if (current >= total) process.stdout.write('\n');
    } else {
      console.log(colored);
    }
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  close() {
    try {
      if (this._logFileStream) this._logFileStream.end();
      if (this._errorFileStream) this._errorFileStream.end();
    } catch (e) {
    }
  }
}

let defaultLogger = null;
function getLogger(options = {}) {
  if (!defaultLogger) {
    defaultLogger = new Logger(options);
  }
  return defaultLogger;
}

module.exports = { Logger, getLogger, LOG_LEVELS };
