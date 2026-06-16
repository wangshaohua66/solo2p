import { EventEmitter } from 'events';
import { verifyDmv } from '../tasks/dmvVerify.js';
import { queryInsurance } from '../tasks/insuranceQuery.js';
import { checkRecall } from '../tasks/recallCheck.js';
import { verifyEmission } from '../tasks/emissionVerify.js';
import { getBrowserPool } from '../engines/browserPool.js';
import {
  insertBatchVins,
  updateVinStatus,
  getPendingVins,
  getCompletedVins,
  upsertComplianceReport,
  saveCheckpoint,
  getCheckpoint,
  getBatchSummary,
  closeDb,
} from '../store/db.js';
import { getPipelineConfig } from '../config.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('pipeline');

const PLATFORMS = ['dmv', 'insurance', 'recall', 'emission'];

const TASK_MAP = {
  dmv: verifyDmv,
  insurance: queryInsurance,
  recall: checkRecall,
  emission: verifyEmission,
};

function determineOverallStatus(results) {
  const statuses = PLATFORMS.map((p) => results[p]?.status || 'pending');
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'error')) return 'partial_error';
  if (statuses.some((s) => s === 'captcha_wait')) return 'captcha_wait';
  if (statuses.some((s) => s === 'completed')) return 'in_progress';
  return 'pending';
}

function determineRiskLevel(results) {
  const allRiskFlags = [];
  let hasBlocking = false;

  if (results.dmv?.data?.riskFlags?.length > 0) {
    allRiskFlags.push(...results.dmv.data.riskFlags);
  }
  if (results.insurance?.data?.riskFlags?.length > 0) {
    allRiskFlags.push(...results.insurance.data.riskFlags);
    if (results.insurance.data.hasTotalLoss || results.insurance.data.hasWaterDamage || results.insurance.data.hasFireDamage) {
      hasBlocking = true;
    }
  }
  if (results.recall?.data?.riskFlags?.length > 0) {
    allRiskFlags.push(...results.recall.data.riskFlags);
    if (results.recall.data.unresolvedCount > 0) {
      hasBlocking = true;
    }
  }
  if (results.emission?.data?.riskFlags?.length > 0) {
    allRiskFlags.push(...results.emission.data.riskFlags);
    if (results.emission.data.isExpired) {
      hasBlocking = true;
    }
  }

  if (hasBlocking) return 'high';
  if (allRiskFlags.length > 0) return 'medium';
  return 'low';
}

function buildReportJson(results) {
  return {
    dmv: results.dmv?.data || null,
    insurance: results.insurance?.data || null,
    recall: results.recall?.data || null,
    emission: results.emission?.data || null,
    dmvStatus: results.dmv?.status || 'pending',
    insuranceStatus: results.insurance?.status || 'pending',
    recallStatus: results.recall?.status || 'pending',
    emissionStatus: results.emission?.status || 'pending',
  };
}

export class Pipeline extends EventEmitter {
  constructor() {
    super();
    this.config = getPipelineConfig();
    this.running = false;
    this.paused = false;
    this.batchId = null;
    this.vinList = [];
    this.results = new Map();
    this.startTime = null;
    this.captchaWaitVins = new Set();
  }

  async init(vins, batchId) {
    this.batchId = batchId || `BATCH-${Date.now()}`;
    this.vinList = vins;
    insertBatchVins(this.batchId, vins);
    log.info('Pipeline initialized', { batchId: this.batchId, vinCount: vins.length });
    return this.batchId;
  }

  async resume(batchId) {
    this.batchId = batchId;
    const pendingVins = getPendingVins(batchId);
    this.vinList = pendingVins.map((v) => v.vin);
    log.info('Pipeline resumed', { batchId, pendingCount: this.vinList.length });

    for (const platform of PLATFORMS) {
      const completed = getCompletedVins(batchId, platform);
      for (const vin of completed) {
        if (!this.results.has(vin)) {
          this.results.set(vin, {});
        }
        const existing = this.results.get(vin);
        existing[platform] = { status: 'completed', vin, data: null };
      }
    }

    return this.batchId;
  }

  async run() {
    this.running = true;
    this.startTime = Date.now();
    log.info('Pipeline started', { batchId: this.batchId, totalVins: this.vinList.length });
    this.emit('start', { batchId: this.batchId, total: this.vinList.length });

    const maxConcurrency = this.config.maxConcurrency || 4;

    try {
      const pendingVins = this._getPendingVins();
      log.info('Processing VINs', { pending: pendingVins.length });

      for (let i = 0; i < pendingVins.length; i += maxConcurrency) {
        if (!this.running) break;

        while (this.paused) {
          await new Promise((r) => setTimeout(r, 500));
        }

        const chunk = pendingVins.slice(i, i + maxConcurrency);
        const promises = chunk.map((vin, idx) => this._processVin(vin, i + idx));

        const chunkResults = await Promise.allSettled(promises);

        for (let j = 0; j < chunkResults.length; j++) {
          const vin = chunk[j];
          const settled = chunkResults[j];
          if (settled.status === 'rejected') {
            log.error('VIN processing rejected', { vin, error: settled.reason?.message });
            updateVinStatus(this.batchId, vin, 'error');
          }
        }

        for (const platform of PLATFORMS) {
          const lastVin = chunk[chunk.length - 1];
          saveCheckpoint(this.batchId, platform, lastVin, i + chunk.length, this.vinList.length);
        }

        const elapsed = Date.now() - this.startTime;
        const processed = i + chunk.length;
        const rate = processed / (elapsed / 1000);
        const remaining = (this.vinList.length - processed) / rate;

        this.emit('progress', {
          completed: processed,
          total: this.vinList.length,
          rate: rate.toFixed(2),
          etaSeconds: Math.round(remaining),
          batchId: this.batchId,
        });
      }

      await this._aggregateResults();

    } catch (err) {
      log.error('Pipeline error', { error: err.message, stack: err.stack });
      this.emit('error', { error: err.message, batchId: this.batchId });
    } finally {
      this.running = false;
      const summary = getBatchSummary(this.batchId);
      log.info('Pipeline finished', { batchId: this.batchId, summary });
      this.emit('complete', { batchId: this.batchId, summary });
    }
  }

  _getPendingVins() {
    const completedVins = new Set();
    for (const platform of PLATFORMS) {
      const completed = getCompletedVins(this.batchId, platform);
      for (const vin of completed) {
        completedVins.add(vin);
      }
    }

    const allCompleted = new Set();
    for (const [vin, results] of this.results.entries()) {
      const allDone = PLATFORMS.every((p) => results[p]?.status === 'completed');
      if (allDone) allCompleted.add(vin);
    }

    return this.vinList.filter((vin) => !allCompleted.has(vin) && !completedVins.has(vin));
  }

  async _processVin(vin, index) {
    log.info('Processing VIN', { vin, index });
    updateVinStatus(this.batchId, vin, 'processing');
    this.emit('vin:start', { vin, index });

    const results = this.results.get(vin) || {};

    const taskPromises = PLATFORMS.map(async (platform) => {
      if (results[platform]?.status === 'completed') {
        return results[platform];
      }
      try {
        const taskFn = TASK_MAP[platform];
        const result = await taskFn(this.batchId, vin);
        results[platform] = result;
        this.emit('task:complete', { vin, platform, status: result.status });
        return result;
      } catch (err) {
        results[platform] = { status: 'error', platform, vin, error: err.message };
        this.emit('task:error', { vin, platform, error: err.message });
        return results[platform];
      }
    });

    await Promise.allSettled(taskPromises);

    this.results.set(vin, results);

    const overallStatus = determineOverallStatus(results);
    const hasCaptchaWait = PLATFORMS.some((p) => results[p]?.status === 'captcha_wait');

    if (hasCaptchaWait) {
      this.captchaWaitVins.add(vin);
      this.emit('captcha:wait', { vin });
    }

    if (overallStatus === 'completed') {
      updateVinStatus(this.batchId, vin, 'completed');
    } else if (overallStatus === 'error' || overallStatus === 'partial_error') {
      updateVinStatus(this.batchId, vin, 'error');
    }

    this.emit('vin:complete', { vin, status: overallStatus });
    return results;
  }

  async _aggregateResults() {
    log.info('Aggregating results', { batchId: this.batchId });

    for (const [vin, results] of this.results.entries()) {
      const overallStatus = determineOverallStatus(results);
      const riskLevel = determineRiskLevel(results);
      const reportJson = buildReportJson(results);

      upsertComplianceReport(this.batchId, vin, {
        dmvStatus: results.dmv?.status || 'pending',
        insuranceStatus: results.insurance?.status || 'pending',
        recallStatus: results.recall?.status || 'pending',
        emissionStatus: results.emission?.status || 'pending',
        overallStatus,
        riskLevel,
        reportJson,
      });
    }
  }

  pause() {
    this.paused = true;
    log.info('Pipeline paused');
    this.emit('paused', { batchId: this.batchId });
  }

  resumeProcessing() {
    this.paused = false;
    log.info('Pipeline resumed');
    this.emit('resumed', { batchId: this.batchId });
  }

  async stop() {
    this.running = false;
    log.info('Pipeline stopped');
    this.emit('stopped', { batchId: this.batchId });
  }

  getStatus() {
    return {
      batchId: this.batchId,
      running: this.running,
      paused: this.paused,
      totalVins: this.vinList.length,
      processedVins: this.results.size,
      captchaWaitVins: [...this.captchaWaitVins],
      startTime: this.startTime,
      elapsedMs: this.startTime ? Date.now() - this.startTime : 0,
    };
  }
}

export async function runPipeline(vins, options = {}) {
  const pool = getBrowserPool();
  const instanceCount = await pool.initialize();

  if (instanceCount === 0) {
    throw new Error('Failed to initialize any browser instances');
  }

  const pipeline = new Pipeline();
  const batchId = await pipeline.init(vins, options.batchId);

  if (options.onResume) {
    pipeline.on('captcha:wait', options.onResume);
  }
  if (options.onProgress) {
    pipeline.on('progress', options.onProgress);
  }
  if (options.onVinStart) {
    pipeline.on('vin:start', options.onVinStart);
  }
  if (options.onVinComplete) {
    pipeline.on('vin:complete', options.onVinComplete);
  }
  if (options.onTaskComplete) {
    pipeline.on('task:complete', options.onTaskComplete);
  }

  try {
    await pipeline.run();
  } finally {
    await pool.destroyAll();
    closeDb();
  }

  return { batchId, pipeline };
}

export async function resumePipeline(batchId, options = {}) {
  const pool = getBrowserPool();
  await pool.initialize();

  const pipeline = new Pipeline();
  await pipeline.resume(batchId);

  if (options.onProgress) {
    pipeline.on('progress', options.onProgress);
  }
  if (options.onVinStart) {
    pipeline.on('vin:start', options.onVinStart);
  }
  if (options.onVinComplete) {
    pipeline.on('vin:complete', options.onVinComplete);
  }

  try {
    await pipeline.run();
  } finally {
    await pool.destroyAll();
    closeDb();
  }

  return { batchId, pipeline };
}
