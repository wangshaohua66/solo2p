const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const dayjs = require('dayjs');

class ArchiveManager {
  constructor(options = {}) {
    this.archivePath = path.resolve(options.path || './archive');
    this.retentionDays = options.retention_days || 30;
    this.compress = options.compress !== false;
  }

  async ensureArchiveDir() {
    await fs.ensureDir(this.archivePath);
  }

  async archiveFile(filePath, options = {}) {
    const resolvedPath = path.resolve(filePath);
    const exists = await fs.pathExists(resolvedPath);
    if (!exists) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${resolvedPath}`);
    }

    await this.ensureArchiveDir();

    const dateStr = dayjs(stat.mtime).format('YYYY-MM-DD');
    const baseName = path.basename(resolvedPath);
    const dateDir = path.join(this.archivePath, dateStr);
    await fs.ensureDir(dateDir);

    let archiveFilePath;
    let bytesWritten = 0;
    const startTime = Date.now();

    if (this.compress) {
      archiveFilePath = path.join(dateDir, `${baseName}.gz`);
      await this.gzipFile(resolvedPath, archiveFilePath);
      const archived = await fs.stat(archiveFilePath);
      bytesWritten = archived.size;
    } else {
      archiveFilePath = path.join(dateDir, baseName);
      await fs.copy(resolvedPath, archiveFilePath);
      bytesWritten = stat.size;
    }

    const elapsed = Date.now() - startTime;
    const speedMBs = elapsed > 0 ? (stat.size / 1024 / 1024) / (elapsed / 1000) : 0;

    if (options.cleanup !== false) {
      await fs.remove(resolvedPath);
    }

    return {
      original: resolvedPath,
      archive: archiveFilePath,
      originalSize: stat.size,
      archivedSize: bytesWritten,
      compressionRatio: ((1 - bytesWritten / stat.size) * 100).toFixed(1),
      speedMBs: speedMBs.toFixed(2),
      cleaned: options.cleanup !== false
    };
  }

  async gzipFile(sourcePath, destPath) {
    const { createGzip } = require('zlib');
    const sourceStream = fs.createReadStream(sourcePath);
    const destStream = fs.createWriteStream(destPath);
    const gzip = createGzip();

    return new Promise((resolve, reject) => {
      sourceStream
        .pipe(gzip)
        .pipe(destStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async archiveByDate(logPath, dateStr, options = {}) {
    const resolvedPath = path.resolve(logPath);
    const exists = await fs.pathExists(resolvedPath);
    if (!exists) {
      throw new Error(`Path not found: ${resolvedPath}`);
    }

    const stat = await fs.stat(resolvedPath);

    if (stat.isDirectory()) {
      return this.archiveDirectory(resolvedPath, dateStr, options);
    }

    const fileDate = dayjs(stat.mtime).format('YYYY-MM-DD');
    if (dateStr && fileDate !== dateStr) {
      return null;
    }

    return this.archiveFile(resolvedPath, options);
  }

  async archiveDirectory(dirPath, dateStr, options = {}) {
    const results = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stat = await fs.stat(full);
        const fileDate = dayjs(stat.mtime).format('YYYY-MM-DD');

        if (!dateStr || fileDate === dateStr) {
          try {
            const result = await this.archiveFile(full, options);
            results.push(result);
          } catch (e) {
            results.push({ original: full, error: e.message });
          }
        }
      }
    }

    return results;
  }

  async archiveOlderThan(days, sourcePath, options = {}) {
    const cutoff = dayjs().subtract(days, 'day').toISOString();
    const resolvedPath = sourcePath ? path.resolve(sourcePath) : this.archivePath;
    const results = [];

    const files = await this.listFiles(resolvedPath);
    for (const file of files) {
      if (file.mtime < cutoff) {
        try {
          const result = await this.archiveFile(file.path, options);
          results.push(result);
        } catch (e) {
          results.push({ original: file.path, error: e.message });
        }
      }
    }

    return results;
  }

  async listFiles(dirPath) {
    const results = [];
    const exists = await fs.pathExists(dirPath);
    if (!exists) return results;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stat = await fs.stat(full);
        results.push({ path: full, size: stat.size, mtime: stat.mtime.toISOString() });
      } else if (entry.isDirectory()) {
        const sub = await this.listFiles(full);
        results.push(...sub);
      }
    }

    return results;
  }

  async cleanup() {
    const cutoff = dayjs().subtract(this.retentionDays, 'day');
    const results = [];

    const exists = await fs.pathExists(this.archivePath);
    if (!exists) return results;

    const dateDirs = await fs.readdir(this.archivePath, { withFileTypes: true });
    for (const entry of dateDirs) {
      if (!entry.isDirectory()) continue;

      const dirDate = dayjs(entry.name, 'YYYY-MM-DD');
      if (dirDate.isValid() && dirDate.isBefore(cutoff)) {
        const dirPath = path.join(this.archivePath, entry.name);
        await fs.remove(dirPath);
        results.push({ removed: dirPath, date: entry.name });
      }
    }

    return results;
  }

  async getArchiveStats() {
    const exists = await fs.pathExists(this.archivePath);
    if (!exists) {
      return { totalFiles: 0, totalSize: 0, dateDirs: [] };
    }

    const files = await this.listFiles(this.archivePath);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const dateDirs = await fs.readdir(this.archivePath, { withFileTypes: true });

    return {
      totalFiles: files.length,
      totalSize,
      totalSizeHuman: this.formatBytes(totalSize),
      dateDirs: dateDirs.filter(d => d.isDirectory()).map(d => d.name).sort()
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

module.exports = { ArchiveManager };
