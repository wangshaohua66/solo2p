const fs = require('fs');
const path = require('path');
const moment = require('moment');
const crypto = require('crypto');
const { getLogger } = require('../logger/appLogger');
const { getConfig } = require('../config');

const logger = getLogger();

class IncrementalCheckpointManager {
  constructor() {
    const config = getConfig('scraper.increment', {});
    this.checkpointFile = config.checkPointFile || './data/cache/increment_checkpoint.json';
    this.dedupField = config.deduplicationField || 'application_number';
    this.allowPartialResume = config.allowPartialResume !== false;
    this.maxResumeAttempts = config.maxResumeAttempts || 5;
    this.consistencyCheck = config.consistencyCheck !== false;
    this.saveInterval = config.saveCheckpointInterval || 10;
    
    this._checkpoint = null;
    this._dirty = false;
    this._processedAnnouncements = new Set();
    this._processedTrademarks = new Map();
    
    this._ensureCacheDir();
  }

  _ensureCacheDir() {
    const dir = path.dirname(this.checkpointFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _generateTrademarkHash(trademark) {
    const dedupValue = trademark[this.dedupField];
    if (dedupValue) {
      return `dedup:${this.dedupField}:${String(dedupValue).trim()}`;
    }
    
    const content = `${trademark.trademark_name || ''}|${trademark.applicant || ''}|${trademark.class_number || ''}|${trademark.announcement_date || ''}`;
    return `hash:${crypto.createHash('md5').update(content).digest('hex')}`;
  }

  load() {
    if (this._checkpoint) return this._checkpoint;
    
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const raw = fs.readFileSync(this.checkpointFile, 'utf8');
        this._checkpoint = JSON.parse(raw);
        
        this._processedAnnouncements = new Set(this._checkpoint.processedAnnouncements || []);
        
        this._processedTrademarks = new Map();
        for (const [hash, data] of Object.entries(this._checkpoint.processedTrademarks || {})) {
          this._processedTrademarks.set(hash, data);
        }
        
        logger.info('Incremental checkpoint loaded', {
          lastProcessedAnnouncement: this._checkpoint.lastProcessedAnnouncement,
          totalProcessedAnnouncements: this._processedAnnouncements.size,
          totalProcessedTrademarks: this._processedTrademarks.size,
          lastRunAt: this._checkpoint.lastRunAt
        });
        
        if (this.consistencyCheck) {
          this._runConsistencyCheck();
        }
        
        return this._checkpoint;
      }
    } catch (e) {
      logger.warn('Failed to load checkpoint, starting fresh', { error: e.message });
    }
    
    this._checkpoint = {
      version: '1.0',
      createdAt: moment().toISOString(),
      lastRunAt: null,
      lastSuccessfulRunAt: null,
      lastProcessedAnnouncement: null,
      lastProcessedPage: null,
      processedAnnouncements: [],
      processedTrademarks: {},
      failedAnnouncements: {},
      resumeAttempts: {},
      statistics: {
        totalRuns: 0,
        totalAnnouncements: 0,
        totalTrademarks: 0,
        totalMatches: 0,
        deduplicated: 0
      },
      runHistory: []
    };
    
    return this._checkpoint;
  }

  save(force = false) {
    if (!this._dirty && !force) return;
    
    try {
      this._ensureCacheDir();
      
      const exportData = {
        ...this._checkpoint,
        processedAnnouncements: Array.from(this._processedAnnouncements),
        processedTrademarks: Object.fromEntries(this._processedTrademarks),
        _lastSavedAt: moment().toISOString()
      };
      
      const tmpFile = this.checkpointFile + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(exportData, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.checkpointFile);
      
      this._dirty = false;
      
      logger.debug('Incremental checkpoint saved', {
        announcements: this._processedAnnouncements.size,
        trademarks: this._processedTrademarks.size
      });
      
    } catch (e) {
      logger.error('Failed to save checkpoint', { error: e.message });
      throw e;
    }
  }

  _runConsistencyCheck() {
    let inconsistencies = 0;
    const fiveDaysAgo = moment().subtract(5, 'days');
    
    for (const [annNumber, failData] of Object.entries(this._checkpoint.failedAnnouncements || {})) {
      if (moment(failData.lastFailedAt).isBefore(fiveDaysAgo) && failData.attempts >= 3) {
        logger.warn(`Removing stale failed announcement record: ${annNumber}`);
        delete this._checkpoint.failedAnnouncements[annNumber];
        inconsistencies++;
      }
    }
    
    if (inconsistencies > 0) {
      logger.info(`Consistency check completed: ${inconsistencies} inconsistencies fixed`);
      this._dirty = true;
    }
  }

  isAnnouncementProcessed(announcementNumber) {
    this.load();
    return this._processedAnnouncements.has(String(announcementNumber));
  }

  isTrademarkProcessed(trademark) {
    this.load();
    const hash = this._generateTrademarkHash(trademark);
    return this._processedTrademarks.has(hash);
  }

  getTrademarkProcessingInfo(trademark) {
    const hash = this._generateTrademarkHash(trademark);
    return this._processedTrademarks.get(hash);
  }

  markAnnouncementProcessed(announcementNumber, metadata = {}) {
    this.load();
    const key = String(announcementNumber);
    this._processedAnnouncements.add(key);
    
    this._checkpoint.lastProcessedAnnouncement = key;
    this._checkpoint.lastProcessedPage = metadata.page || this._checkpoint.lastProcessedPage;
    
    if (this._checkpoint.failedAnnouncements?.[key]) {
      delete this._checkpoint.failedAnnouncements[key];
    }
    if (this._checkpoint.resumeAttempts?.[key]) {
      delete this._checkpoint.resumeAttempts[key];
    }
    
    this._checkpoint.statistics.totalAnnouncements++;
    this._dirty = true;
    
    if (this._processedAnnouncements.size % this.saveInterval === 0) {
      this.save();
    }
  }

  markTrademarkProcessed(trademark, announcementId, matchCount = 0) {
    this.load();
    const hash = this._generateTrademarkHash(trademark);
    
    if (this._processedTrademarks.has(hash)) {
      this._checkpoint.statistics.deduplicated++;
      return { isDuplicate: true, existingInfo: this._processedTrademarks.get(hash) };
    }
    
    this._processedTrademarks.set(hash, {
      announcementId,
      firstSeen: moment().toISOString(),
      matchCount,
      name: trademark.trademark_name || trademark.trademarkName,
      appNo: trademark.application_number || trademark.appNo
    });
    
    this._checkpoint.statistics.totalTrademarks++;
    this._checkpoint.statistics.totalMatches += matchCount;
    this._dirty = true;
    
    return { isDuplicate: false };
  }

  markAnnouncementFailed(announcementNumber, error) {
    this.load();
    const key = String(announcementNumber);
    
    if (!this._checkpoint.failedAnnouncements) {
      this._checkpoint.failedAnnouncements = {};
    }
    
    const previous = this._checkpoint.failedAnnouncements[key] || { attempts: 0 };
    
    this._checkpoint.failedAnnouncements[key] = {
      attempts: previous.attempts + 1,
      lastError: error?.message || String(error),
      lastFailedAt: moment().toISOString(),
      errorStack: error?.stack?.substring(0, 500) || null
    };
    
    if (!this._checkpoint.resumeAttempts) {
      this._checkpoint.resumeAttempts = {};
    }
    this._checkpoint.resumeAttempts[key] = (this._checkpoint.resumeAttempts[key] || 0) + 1;
    
    this._dirty = true;
    this.save();
    
    const attempts = this._checkpoint.resumeAttempts[key];
    return attempts < this.maxResumeAttempts;
  }

  shouldRetryAnnouncement(announcementNumber) {
    this.load();
    const key = String(announcementNumber);
    const attempts = this._checkpoint.resumeAttempts?.[key] || 0;
    return this.allowPartialResume && attempts < this.maxResumeAttempts;
  }

  getRetryDelay(announcementNumber) {
    const attempts = this._checkpoint.resumeAttempts?.[String(announcementNumber)] || 0;
    const baseDelay = 30000;
    const maxDelay = 1800000;
    return Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
  }

  getPendingFailedAnnouncements() {
    this.load();
    const pending = [];
    
    for (const [annNumber, failData] of Object.entries(this._checkpoint.failedAnnouncements || {})) {
      if (this.shouldRetryAnnouncement(annNumber)) {
        const lastFailed = moment(failData.lastFailedAt);
        const retryDelay = this.getRetryDelay(annNumber);
        const shouldRetryAt = lastFailed.add(retryDelay, 'milliseconds');
        
        if (moment().isAfter(shouldRetryAt)) {
          pending.push({
            announcementNumber: annNumber,
            attempts: failData.attempts,
            lastError: failData.lastError,
            retryAfterMs: 0
          });
        } else {
          pending.push({
            announcementNumber: annNumber,
            attempts: failData.attempts,
            lastError: failData.lastError,
            retryAfterMs: shouldRetryAt.diff(moment())
          });
        }
      }
    }
    
    return pending;
  }

  recordRunStart() {
    this.load();
    this._checkpoint.statistics.totalRuns++;
    this._checkpoint.lastRunAt = moment().toISOString();
    this._dirty = true;
  }

  recordRunSuccess(runData = {}) {
    this.load();
    this._checkpoint.lastSuccessfulRunAt = moment().toISOString();
    
    this._checkpoint.runHistory.unshift({
      startAt: this._checkpoint.lastRunAt,
      endAt: moment().toISOString(),
      success: true,
      announcementsProcessed: runData.announcementsProcessed || 0,
      trademarksProcessed: runData.trademarksProcessed || 0,
      matchesFound: runData.matchesFound || 0,
      durationMs: runData.durationMs || 0
    });
    
    this._checkpoint.runHistory = this._checkpoint.runHistory.slice(0, 50);
    
    this._dirty = true;
    this.save(true);
  }

  recordRunFailure(error, runData = {}) {
    this.load();
    
    this._checkpoint.runHistory.unshift({
      startAt: this._checkpoint.lastRunAt,
      endAt: moment().toISOString(),
      success: false,
      error: error?.message || String(error),
      announcementsProcessed: runData.announcementsProcessed || 0,
      trademarksProcessed: runData.trademarksProcessed || 0,
      durationMs: runData.durationMs || 0
    });
    
    this._checkpoint.runHistory = this._checkpoint.runHistory.slice(0, 50);
    
    this._dirty = true;
    this.save(true);
  }

  deduplicateTrademarks(trademarks) {
    this.load();
    const seen = new Map();
    const duplicates = [];
    const unique = [];
    
    for (const tm of trademarks) {
      const hash = this._generateTrademarkHash(tm);
      
      if (seen.has(hash)) {
        duplicates.push({
          trademark: tm,
          reason: 'batch_duplicate',
          duplicateOf: seen.get(hash)
        });
        continue;
      }
      
      if (this._processedTrademarks.has(hash)) {
        duplicates.push({
          trademark: tm,
          reason: 'already_processed',
          existingInfo: this._processedTrademarks.get(hash)
        });
        continue;
      }
      
      seen.set(hash, tm.trademark_name || tm.trademarkName || 'unknown');
      unique.push(tm);
    }
    
    logger.info('Trademark deduplication completed', {
      input: trademarks.length,
      unique: unique.length,
      duplicates: duplicates.length,
      batchDuplicates: duplicates.filter(d => d.reason === 'batch_duplicate').length,
      alreadyProcessed: duplicates.filter(d => d.reason === 'already_processed').length
    });
    
    return { unique, duplicates };
  }

  getStatistics() {
    this.load();
    return {
      ...this._checkpoint.statistics,
      processedAnnouncements: this._processedAnnouncements.size,
      trackedTrademarks: this._processedTrademarks.size,
      failedAnnouncements: Object.keys(this._checkpoint.failedAnnouncements || {}).length,
      checkpointAgeDays: this._checkpoint.lastRunAt 
        ? moment().diff(moment(this._checkpoint.lastRunAt), 'days')
        : null
    };
  }

  reset() {
    this._checkpoint = null;
    this._processedAnnouncements.clear();
    this._processedTrademarks.clear();
    this._dirty = false;
    if (fs.existsSync(this.checkpointFile)) {
      fs.unlinkSync(this.checkpointFile);
    }
    logger.info('Incremental checkpoint reset complete');
  }
}

let instance = null;

function getCheckpointManager() {
  if (!instance) {
    instance = new IncrementalCheckpointManager();
  }
  return instance;
}

module.exports = {
  IncrementalCheckpointManager,
  getCheckpointManager
};
