const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.logLevel = options.logLevel || 'info';
    this.quiet = options.quiet || false;
    this.currentLogFile = null;
    this.ensureLogDir();
    this.rotateLogFile();
  }

  ensureLogDir() {
    fs.ensureDirSync(this.logDir);
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  rotateLogFile() {
    const date = this.getCurrentDate();
    const logFile = path.join(this.logDir, `ksctl-${date}.log`);
    
    if (this.currentLogFile !== logFile) {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > 50 * 1024 * 1024) {
          const rotatedFile = path.join(
            this.logDir,
            `ksctl-${date}-${Date.now()}.log`
          );
          fs.renameSync(logFile, rotatedFile);
        }
      }
      this.currentLogFile = logFile;
    }
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  }

  writeToFile(level, message) {
    this.rotateLogFile();
    const formatted = this.formatMessage(level, message);
    fs.appendFileSync(this.currentLogFile, formatted, 'utf8');
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel];
  }

  error(message, ...args) {
    const fullMessage = `${message} ${args.join(' ')}`.trim();
    this.writeToFile('error', fullMessage);
    if (!this.quiet) {
      console.error(chalk.red(`[ERROR] ${fullMessage}`));
    }
  }

  warn(message, ...args) {
    if (!this.shouldLog('warn')) return;
    const fullMessage = `${message} ${args.join(' ')}`.trim();
    this.writeToFile('warn', fullMessage);
    if (!this.quiet) {
      console.warn(chalk.yellow(`[WARN] ${fullMessage}`));
    }
  }

  info(message, ...args) {
    if (!this.shouldLog('info')) return;
    const fullMessage = `${message} ${args.join(' ')}`.trim();
    this.writeToFile('info', fullMessage);
    if (!this.quiet) {
      console.log(chalk.blue(`[INFO] ${fullMessage}`));
    }
  }

  success(message, ...args) {
    if (!this.shouldLog('info')) return;
    const fullMessage = `${message} ${args.join(' ')}`.trim();
    this.writeToFile('info', fullMessage);
    if (!this.quiet) {
      console.log(chalk.green(`[SUCCESS] ${fullMessage}`));
    }
  }

  debug(message, ...args) {
    if (!this.shouldLog('debug')) return;
    const fullMessage = `${message} ${args.join(' ')}`.trim();
    this.writeToFile('debug', fullMessage);
    if (!this.quiet) {
      console.log(chalk.gray(`[DEBUG] ${fullMessage}`));
    }
  }

  log(message, ...args) {
    this.info(message, ...args);
  }
}

module.exports = Logger;
