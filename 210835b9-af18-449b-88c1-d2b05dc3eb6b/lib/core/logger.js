const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.directory = path.resolve(options.directory || 'logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024;
    this.maxFiles = options.maxFiles || 5;
    this.compress = options.compress !== false;
    this.currentLogFile = null;
    this.currentSize = 0;

    if (!fs.existsSync(this.directory)) {
      fs.mkdirSync(this.directory, { recursive: true });
    }

    this._ensureLogFile();
  }

  _ensureLogFile() {
    const date = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.directory, `migrate-${date}.log`);

    if (fs.existsSync(this.currentLogFile)) {
      const stat = fs.statSync(this.currentLogFile);
      this.currentSize = stat.size;
    } else {
      this.currentSize = 0;
    }
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  _write(level, message, meta = {}) {
    if (!this._shouldLog(level)) return;

    const formatted = this._formatMessage(level, message, meta);

    try {
      if (this.currentSize + formatted.length > this.maxFileSize) {
        this._rotate();
      }

      fs.appendFileSync(this.currentLogFile, formatted, 'utf8');
      this.currentSize += Buffer.byteLength(formatted, 'utf8');
    } catch (err) {
      console.error(`Logger write error: ${err.message}`);
    }
  }

  _rotate() {
    if (!fs.existsSync(this.currentLogFile)) return;

    const ext = path.extname(this.currentLogFile);
    const base = path.basename(this.currentLogFile, ext);
    const dir = path.dirname(this.currentLogFile);
    const timestamp = Date.now();

    if (this.compress) {
      const compressedPath = path.join(dir, `${base}.${timestamp}${ext}.gz`);
      const content = fs.readFileSync(this.currentLogFile);
      const compressed = zlib.gzipSync(content);
      fs.writeFileSync(compressedPath, compressed);
      fs.unlinkSync(this.currentLogFile);
    } else {
      const rotatedPath = path.join(dir, `${base}.${timestamp}${ext}`);
      fs.renameSync(this.currentLogFile, rotatedPath);
    }

    this._cleanupOldFiles();

    this._ensureLogFile();
    this.currentSize = 0;
  }

  _cleanupOldFiles() {
    try {
      const files = fs.readdirSync(this.directory)
        .filter(f => f.startsWith('migrate-') && (f.endsWith('.log') || f.endsWith('.log.gz')))
        .map(f => ({
          name: f,
          path: path.join(this.directory, f),
          time: fs.statSync(path.join(this.directory, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      while (files.length > this.maxFiles) {
        const oldest = files.pop();
        fs.unlinkSync(oldest.path);
      }
    } catch (err) {
      console.error(`Logger cleanup error: ${err.message}`);
    }
  }

  error(message, meta = {}) {
    this._write('error', message, meta);
  }

  warn(message, meta = {}) {
    this._write('warn', message, meta);
  }

  info(message, meta = {}) {
    this._write('info', message, meta);
  }

  debug(message, meta = {}) {
    this._write('debug', message, meta);
  }

  logMigrationStart(version, name) {
    this.info(`Migration started: ${version}_${name}`, { version, name, action: 'up_start' });
  }

  logMigrationSuccess(version, name, executionTimeMs) {
    this.info(`Migration completed: ${version}_${name}`, { version, name, action: 'up_success', executionTimeMs });
  }

  logMigrationFailure(version, name, error) {
    this.error(`Migration failed: ${version}_${name}`, { version, name, action: 'up_failure', error: error.message });
  }

  logRollbackStart(version, name) {
    this.info(`Rollback started: ${version}_${name}`, { version, name, action: 'down_start' });
  }

  logRollbackSuccess(version, name, executionTimeMs) {
    this.info(`Rollback completed: ${version}_${name}`, { version, name, action: 'down_success', executionTimeMs });
  }

  logRollbackFailure(version, name, error) {
    this.error(`Rollback failed: ${version}_${name}`, { version, name, action: 'down_failure', error: error.message });
  }
}

module.exports = Logger;
