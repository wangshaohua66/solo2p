const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { logger, verbose } = require('../utils/logger');
const { withRetry, RetryError } = require('../utils/retry');
const { generateId, ensureDir, businessDate } = require('../utils/common');
const { paths, regulatorConfig, performanceConfig } = require('../../config/schedule');

class RegulatorPusher {
  constructor(options = {}) {
    this.config = { ...regulatorConfig, ...options };
    this.batchSize = options.batchSize || 100;
    this.token = this.config.token || '';
  }

  _buildHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'X-Request-Id': generateId(),
      'X-Timestamp': Date.now().toString(),
      ...extra
    };
  }

  _chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  _detectDataType(records) {
    if (records.length === 0) return 'unknown';
    const sample = records[0];
    const hasLoan = sample.loan_balance !== undefined || sample.loan_count !== undefined;
    const hasGuarantee = sample.guarantee_balance !== undefined || sample.guarantee_count !== undefined;
    const hasPawn = sample.pawn_total !== undefined || sample.pawn_count !== undefined;
    const hasEquity = sample.equity_transaction_amount !== undefined || sample.equity_transaction_count !== undefined;
    const hasAMC = sample.managed_asset_scale !== undefined;
    const hasRisk = sample.non_performing_loan !== undefined || sample.risk_level !== undefined;
    if (hasLoan) return 'financial';
    if (hasGuarantee) return 'financial';
    if (hasPawn) return 'business';
    if (hasEquity) return 'business';
    if (hasAMC) return 'financial';
    if (hasRisk) return 'risk';
    return 'financial';
  }

  async _pushSingleBatch(records, dataType, context = {}) {
    const endpoint = this.config.endpoints[`push${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`] || this.config.endpoints.pushFinancial;
    const url = `${this.config.baseUrl}${endpoint}`;
    const payload = {
      requestId: generateId(),
      orgId: context.orgId,
      orgName: context.orgName,
      businessDate: context.businessDate || businessDate(),
      dataType,
      recordCount: records.length,
      records: records.map((r) => {
        const clean = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k.startsWith('_')) clean[k] = v;
        }
        return clean;
      })
    };
    return withRetry(
      async () => {
        verbose(`推送批次到监管系统: ${dataType}, ${records.length}条, endpoint=${endpoint}`);
        const resp = await axios.post(url, payload, {
          headers: this._buildHeaders(),
          timeout: this.config.timeout
        });
        if (resp.status >= 400) {
          throw new Error(`监管系统返回错误 ${resp.status}: ${JSON.stringify(resp.data)}`);
        }
        return resp.data;
      },
      {
        context: `推送${dataType}数据到监管系统(org=${context.orgId})`,
        maxRetries: performanceConfig.retryStrategy.maxRetries
      }
    );
  }

  async push(records, context = {}) {
    const startTime = Date.now();
    if (!records || records.length === 0) {
      return {
        success: true,
        skipped: true,
        reason: 'no_records',
        pushedCount: 0
      };
    }
    const dataType = context.dataType || this._detectDataType(records);
    const batches = this._chunkArray(records, this.batchSize);
    const results = [];
    let pushedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        const result = await this._pushSingleBatch(batch, dataType, context);
        results.push({ batchIndex: i, success: true, count: batch.length, response: result });
        pushedCount += batch.length;
        verbose(`批次${i + 1}/${batches.length}推送成功: ${batch.length}条`);
      } catch (err) {
        const msg = err instanceof RetryError ? err.message : err.message;
        logger.error(`批次${i + 1}/${batches.length}推送失败: ${msg}`);
        results.push({ batchIndex: i, success: false, count: batch.length, error: msg });
        failedCount += batch.length;
        errors.push({ batchIndex: i, error: msg, records: batch });
      }
    }

    return {
      success: failedCount === 0,
      orgId: context.orgId,
      dataType,
      totalRecords: records.length,
      batchCount: batches.length,
      pushedCount,
      failedCount,
      errors,
      batchResults: results,
      pushDurationMs: Date.now() - startTime,
      pushedAt: new Date().toISOString()
    };
  }

  async acknowledge(requestId, status = 'received') {
    const url = `${this.config.baseUrl}${this.config.endpoints.acknowledge}`;
    try {
      const resp = await axios.post(url, { requestId, status, ackTime: new Date().toISOString() }, {
        headers: this._buildHeaders(),
        timeout: this.config.timeout
      });
      return resp.data;
    } catch (err) {
      logger.warn(`确认回执失败: ${err.message}`);
      return null;
    }
  }

  async checkStatus(requestId) {
    const url = `${this.config.baseUrl}${this.config.endpoints.status}`;
    try {
      const resp = await axios.get(url, {
        headers: this._buildHeaders(),
        params: { requestId },
        timeout: this.config.timeout
      });
      return resp.data;
    } catch (err) {
      logger.warn(`查询状态失败: ${err.message}`);
      return null;
    }
  }

  savePushResult(result, context = {}) {
    const saveDir = path.join(paths.data.processed, context.orgId || 'global');
    ensureDir(saveDir);
    const bizDate = context.businessDate || businessDate();
    const filename = `${bizDate}_push_${result.dataType}_${generateId().substring(0, 6)}.json`;
    const filePath = path.join(saveDir, filename);
    fs.writeFileSync(filePath, JSON.stringify({ result, context }, null, 2));
    verbose(`推送结果已保存: ${filePath}`);
    return filePath;
  }
}

module.exports = {
  RegulatorPusher
};
