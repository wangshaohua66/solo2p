const fs = require('fs');
const path = require('path');
const { generateMd5, generateFileMd5, businessDate, formatDate } = require('./common');
const { logger } = require('./logger');
const { paths } = require('../../config/schedule');

class DuplicateChecker {
  constructor(storagePath) {
    this.storagePath = storagePath || path.join(paths.data.processed, 'processed_records.json');
    this.records = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(data || '{}');
      }
    } catch (e) {
      logger.warn(`加载去重记录失败: ${e.message}`);
    }
    return {};
  }

  _persist() {
    try {
      const { ensureDir } = require('./common');
      ensureDir(path.dirname(this.storagePath));
      fs.writeFileSync(this.storagePath, JSON.stringify(this.records, null, 2));
    } catch (e) {
      logger.error(`持久化去重记录失败: ${e.message}`);
    }
  }

  _makeKey(orgId, bizDate, fileMd5) {
    return `${orgId}:${bizDate || 'unknown'}:${fileMd5}`;
  }

  _extractBizDate(meta = {}) {
    if (meta.businessDate) return formatDate(meta.businessDate);
    if (meta.reportDate) return formatDate(meta.reportDate);
    if (meta.date) return formatDate(meta.date);
    const fromFilename = this._extractDateFromFilename(meta.filename || '');
    return fromFilename || businessDate();
  }

  _extractDateFromFilename(filename) {
    if (!filename) return '';
    const patterns = [
      /(\d{4})[-_](\d{2})[-_](\d{2})/,
      /(\d{4})(\d{2})(\d{2})/
    ];
    for (const pattern of patterns) {
      const m = filename.match(pattern);
      if (m) {
        return `${m[1]}-${m[2]}-${m[3]}`;
      }
    }
    return '';
  }

  async isDuplicate(filePath, orgId, meta = {}) {
    let fileMd5;
    try {
      fileMd5 = await generateFileMd5(filePath);
    } catch (e) {
      logger.warn(`计算文件MD5失败: ${e.message}`);
      fileMd5 = generateMd5(filePath + Date.now());
    }
    const bizDate = this._extractBizDate(meta);
    const key = this._makeKey(orgId, bizDate, fileMd5);
    const exists = !!this.records[key];
    const isReSubmit = this._isReSubmission(orgId, bizDate, fileMd5);
    const isSupplement = this._isSupplement(orgId, bizDate, meta);
    return {
      isDuplicate: exists,
      fileMd5,
      businessDate: bizDate,
      key,
      submissionType: exists ? (isReSubmit ? 'resubmit' : (isSupplement ? 'supplement' : 'duplicate')) : 'new',
      existingRecord: this.records[key] || null
    };
  }

  _isReSubmission(orgId, bizDate, newFileMd5) {
    const prefix = `${orgId}:${bizDate}:`;
    const sameDateKeys = Object.keys(this.records).filter((k) => k.startsWith(prefix));
    return sameDateKeys.length > 0 && !sameDateKeys.includes(prefix + newFileMd5);
  }

  _isSupplement(orgId, bizDate, meta = {}) {
    if (meta.isSupplement) return true;
    if (meta.supplement) return true;
    return false;
  }

  markProcessed(filePath, orgId, meta = {}, result = {}) {
    const bizDate = this._extractBizDate(meta);
    const key = this._makeKey(orgId, bizDate, result.fileMd5 || generateMd5(filePath));
    this.records[key] = {
      orgId,
      businessDate: bizDate,
      fileMd5: result.fileMd5 || null,
      filename: path.basename(filePath),
      filePath,
      submittedAt: new Date().toISOString(),
      submissionType: result.submissionType || 'new',
      recordCount: result.recordCount || 0,
      status: result.status || 'success'
    };
    this._persist();
    return this.records[key];
  }

  getOrgRecords(orgId) {
    return Object.values(this.records).filter((r) => r.orgId === orgId);
  }

  getDateRecords(date) {
    const bizDate = formatDate(date);
    return Object.values(this.records).filter((r) => r.businessDate === bizDate);
  }

  cleanup(daysToKeep = 90) {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const beforeCount = Object.keys(this.records).length;
    Object.keys(this.records).forEach((key) => {
      if (new Date(this.records[key].submittedAt).getTime() < cutoff) {
        delete this.records[key];
      }
    });
    const removed = beforeCount - Object.keys(this.records).length;
    if (removed > 0) {
      this._persist();
      logger.info(`清理去重记录完成，移除${removed}条过期记录(保留${daysToKeep}天)`);
    }
    return removed;
  }
}

module.exports = {
  DuplicateChecker
};
