import fs from 'fs';
import path from 'path';
import {
  hashContent, generateId, formatDate, deepClone,
  fileExists, dirExists, ensureDir, safeJsonParse
} from './utils.js';
import { getLogger } from './logger.js';
import { createError, ErrorCodes } from './errors.js';
import { getDataDir, getConfig } from './config-loader.js';

const OperationType = {
  INIT: 'init',
  UPDATE: 'update',
  SYNC: 'sync',
  DELETE: 'delete',
  CREATE: 'create',
  MODIFY: 'modify',
  REMOVE: 'remove',
  ROLLBACK: 'rollback',
  MANUAL: 'manual'
};

const HISTORY_FILE_NAME = 'history.json';
const SNAPSHOTS_DIR_NAME = 'snapshots';
const DEFAULT_MAX_RECORDS = 10000;
const FLUSH_THRESHOLD = 50;

let inMemoryRecords = [];
let dirtyCount = 0;
let lastLoadTime = 0;

function getHistoryFilePath() {
  const dataDir = getDataDir();
  return path.join(dataDir, HISTORY_FILE_NAME);
}

function getSnapshotsDir() {
  const dataDir = getDataDir();
  const dir = path.join(dataDir, SNAPSHOTS_DIR_NAME);
  ensureDir(dir);
  return dir;
}

function loadHistory(force = false) {
  const filePath = getHistoryFilePath();
  const config = getConfig();
  const maxRecords = config.history?.maxRecords || DEFAULT_MAX_RECORDS;

  if (!force && inMemoryRecords.length > 0 && Date.now() - lastLoadTime < 5000) {
    return inMemoryRecords;
  }

  if (!fileExists(filePath)) {
    inMemoryRecords = [];
    lastLoadTime = Date.now();
    return inMemoryRecords;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = safeJsonParse(content, { records: [] });
    inMemoryRecords = Array.isArray(data) ? data : (data.records || []);

    if (inMemoryRecords.length > maxRecords) {
      inMemoryRecords = inMemoryRecords.slice(inMemoryRecords.length - maxRecords);
    }

    inMemoryRecords.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    lastLoadTime = Date.now();
    dirtyCount = 0;
    return inMemoryRecords;
  } catch (error) {
    const logger = getLogger();
    logger.warn(`加载历史记录失败: ${error.message}，将使用空记录`);
    inMemoryRecords = [];
    return inMemoryRecords;
  }
}

function saveHistory(force = false) {
  if (!force && dirtyCount < FLUSH_THRESHOLD) return;

  const filePath = getHistoryFilePath();
  const config = getConfig();
  const maxRecords = config.history?.maxRecords || DEFAULT_MAX_RECORDS;
  const logger = getLogger();

  if (inMemoryRecords.length > maxRecords) {
    inMemoryRecords = inMemoryRecords.slice(inMemoryRecords.length - maxRecords);
  }

  try {
    const tempPath = `${filePath}.tmp.${process.pid}`;
    fs.writeFileSync(tempPath, JSON.stringify({
      version: '1.0',
      savedAt: new Date().toISOString(),
      recordCount: inMemoryRecords.length,
      records: inMemoryRecords
    }, null, 2), 'utf-8');

    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
    fs.renameSync(tempPath, filePath);
    dirtyCount = 0;
    logger.debug(`历史记录已保存: ${inMemoryRecords.length} 条`);
  } catch (error) {
    throw createError(
      `保存历史记录失败: ${error.message}`,
      ErrorCodes.PERMISSION_DENIED,
      { filePath }
    );
  }
}

function recordChange(changeData) {
  const logger = getLogger();
  const records = loadHistory();

  const record = {
    id: generateId('chg'),
    timestamp: new Date().toISOString(),
    operator: process.env.USER || process.env.USERNAME || 'unknown',
    operation: changeData.operation || OperationType.MODIFY,
    envName: changeData.envName || null,
    serviceName: changeData.serviceName || null,
    filePath: changeData.filePath || null,
    configKey: changeData.configKey || null,
    oldValue: changeData.oldValue !== undefined ? maskLargeValue(changeData.oldValue) : null,
    newValue: changeData.newValue !== undefined ? maskLargeValue(changeData.newValue) : null,
    diff: changeData.diff || null,
    description: changeData.description || null,
    source: changeData.source || 'cli',
    metadata: changeData.metadata || {},
    hash: changeData.hash || null,
    previousHash: changeData.previousHash || null
  };

  records.push(record);
  dirtyCount++;
  logger.debug(`[HISTORY] ${record.operation}: ${record.configKey || record.filePath || record.serviceName}`);

  if (dirtyCount >= FLUSH_THRESHOLD) {
    saveHistory(true);
  }

  return record;
}

function maskLargeValue(value, maxLen = 500) {
  if (value === null || value === undefined) return value;
  const strValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (strValue.length > maxLen) {
    return strValue.substring(0, maxLen) + `... [truncated, original length: ${strValue.length}]`;
  }
  return value;
}

function recordBatchChanges(changes) {
  const results = [];
  for (const change of changes) {
    results.push(recordChange(change));
  }
  saveHistory(true);
  return results;
}

function queryHistory(filters = {}, options = {}) {
  const records = loadHistory();
  const {
    limit = 100,
    offset = 0,
    sort = 'desc'
  } = options;

  let filtered = records.filter((r) => {
    if (filters.envName && r.envName !== filters.envName) return false;
    if (filters.serviceName && r.serviceName !== filters.serviceName) return false;
    if (filters.operation && r.operation !== filters.operation) return false;
    if (filters.operator && r.operator !== filters.operator) return false;
    if (filters.filePath && r.filePath && !r.filePath.includes(filters.filePath)) return false;
    if (filters.configKey && r.configKey && !r.configKey.includes(filters.configKey)) return false;
    if (filters.startTime && new Date(r.timestamp) < new Date(filters.startTime)) return false;
    if (filters.endTime && new Date(r.timestamp) > new Date(filters.endTime)) return false;
    return true;
  });

  if (sort === 'desc') {
    filtered = filtered.reverse();
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return {
    total,
    returned: paged.length,
    offset,
    limit,
    records: paged
  };
}

function getChangeHistoryForKey(configKey, options = {}) {
  const results = [];
  const records = loadHistory();

  for (const r of records) {
    if (r.configKey === configKey ||
        (r.configKey && r.configKey.includes(configKey))) {
      results.push(r);
    }
    if (r.diff && Array.isArray(r.diff)) {
      for (const change of r.diff) {
        if (change.key === configKey ||
            (change.key && change.key.includes(configKey))) {
          results.push({
            ...r,
            matchedChange: change
          });
        }
      }
    }
  }

  results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const { limit = 50, offset = 0 } = options;
  return {
    total: results.length,
    returned: Math.min(results.length, limit),
    configKey,
    records: results.slice(offset, offset + limit)
  };
}

function getChangeHistoryForService(serviceName, options = {}) {
  return queryHistory(
    { serviceName },
    { ...options, sort: 'desc' }
  );
}

function createSnapshot(envName, envScan, description = '') {
  const logger = getLogger();
  const snapshotsDir = getSnapshotsDir();
  const timestamp = new Date();
  const timestampStr = formatDate(timestamp, 'YYYYMMDD_HHmmss');
  const snapshotId = `snap_${envName}_${timestampStr}`;
  const snapshotPath = path.join(snapshotsDir, `${snapshotId}.json`);

  const snapshot = {
    id: snapshotId,
    createdAt: timestamp.toISOString(),
    envName,
    description,
    summary: envScan.summary || {},
    fileCount: envScan.files?.length || 0,
    files: (envScan.files || []).map((f) => ({
      serviceName: f.serviceName,
      relativePath: f.relativePath,
      filePath: f.filePath,
      format: f.format,
      hash: f.hash,
      size: f.size,
      configCount: f.configCount,
      mtime: f.mtime
    })),
    fileHashes: Object.fromEntries(
      (envScan.files || []).map((f) => [f.relativePath, f.hash])
    ),
    configValues: Object.fromEntries(
      (envScan.files || []).map((f) => [f.relativePath, f.flatData])
    )
  };

  try {
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    logger.info(`快照已创建: ${snapshotId} -> ${snapshotPath}`);

    recordChange({
      operation: OperationType.INIT,
      envName,
      description: `创建环境快照: ${snapshotId}${description ? ' - ' + description : ''}`,
      metadata: { snapshotId, snapshotPath, fileCount: snapshot.fileCount }
    });

    saveHistory(true);
    return { id: snapshotId, path: snapshotPath, createdAt: snapshot.createdAt };
  } catch (error) {
    throw createError(
      `创建快照失败: ${error.message}`,
      ErrorCodes.PERMISSION_DENIED,
      { envName, snapshotPath }
    );
  }
}

function listSnapshots(envName = null, options = {}) {
  const snapshotsDir = getSnapshotsDir();
  const { limit = 50 } = options;
  const logger = getLogger();

  if (!dirExists(snapshotsDir)) return [];

  try {
    const files = fs.readdirSync(snapshotsDir)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => !envName || f.includes(`_${envName}_`))
      .sort()
      .reverse()
      .slice(0, limit);

    const results = [];
    for (const file of files) {
      const filePath = path.join(snapshotsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const snapshot = safeJsonParse(content, null);
        if (snapshot) {
          results.push({
            id: snapshot.id,
            envName: snapshot.envName,
            createdAt: snapshot.createdAt,
            description: snapshot.description,
            fileCount: snapshot.fileCount,
            filePath
          });
        }
      } catch (e) {
        logger.debug(`读取快照文件失败: ${file} - ${e.message}`);
      }
    }
    return results;
  } catch (error) {
    throw createError(
      `列出快照失败: ${error.message}`,
      ErrorCodes.PERMISSION_DENIED
    );
  }
}

function loadSnapshot(snapshotId) {
  const snapshotsDir = getSnapshotsDir();
  const snapshotPath = path.join(snapshotsDir, `${snapshotId}.json`);

  if (!fileExists(snapshotPath)) {
    throw createError(
      `快照不存在: ${snapshotId}`,
      ErrorCodes.HISTORY_NOT_FOUND,
      { snapshotId, snapshotPath }
    );
  }

  try {
    const content = fs.readFileSync(snapshotPath, 'utf-8');
    return safeJsonParse(content, null);
  } catch (error) {
    throw createError(
      `加载快照失败: ${error.message}`,
      ErrorCodes.PARSE_ERROR,
      { snapshotId, snapshotPath }
    );
  }
}

function compareWithSnapshot(currentEnv, snapshotId, options = {}) {
  const logger = getLogger();
  const snapshot = loadSnapshot(snapshotId);
  const changes = [];

  const currentFiles = currentEnv.files || [];
  const snapshotFiles = snapshot.files || [];
  const snapshotHashes = snapshot.fileHashes || {};

  for (const currentFile of currentFiles) {
    const snapshotHash = snapshotHashes[currentFile.relativePath];

    if (!snapshotHash) {
      changes.push({
        type: 'file_added',
        relativePath: currentFile.relativePath,
        serviceName: currentFile.serviceName,
        description: '快照后新增的配置文件'
      });
      continue;
    }

    if (snapshotHash !== currentFile.hash) {
      const snapshotConfig = snapshot.configValues?.[currentFile.relativePath] || {};
      const currentConfig = currentFile.flatData || {};

      const allKeys = new Set([...Object.keys(snapshotConfig), ...Object.keys(currentConfig)]);
      for (const key of allKeys) {
        const inSnapshot = Object.prototype.hasOwnProperty.call(snapshotConfig, key);
        const inCurrent = Object.prototype.hasOwnProperty.call(currentConfig, key);

        if (inSnapshot && !inCurrent) {
          changes.push({
            type: 'config_removed',
            key,
            oldValue: snapshotConfig[key],
            newValue: undefined,
            relativePath: currentFile.relativePath,
            serviceName: currentFile.serviceName
          });
        } else if (!inSnapshot && inCurrent) {
          changes.push({
            type: 'config_added',
            key,
            oldValue: undefined,
            newValue: currentConfig[key],
            relativePath: currentFile.relativePath,
            serviceName: currentFile.serviceName
          });
        } else if (JSON.stringify(snapshotConfig[key]) !== JSON.stringify(currentConfig[key])) {
          changes.push({
            type: 'config_modified',
            key,
            oldValue: snapshotConfig[key],
            newValue: currentConfig[key],
            relativePath: currentFile.relativePath,
            serviceName: currentFile.serviceName
          });
        }
      }
    }
  }

  const currentRelativePaths = new Set(currentFiles.map((f) => f.relativePath));
  for (const snapFile of snapshotFiles) {
    if (!currentRelativePaths.has(snapFile.relativePath)) {
      changes.push({
        type: 'file_removed',
        relativePath: snapFile.relativePath,
        serviceName: snapFile.serviceName,
        description: '快照后被删除的配置文件'
      });
    }
  }

  logger.info(
    `快照对比完成 [${snapshotId}]: ${changes.length} 处变更 ` +
    `(新增: ${changes.filter(c => c.type.endsWith('_added')).length}, ` +
    `删除: ${changes.filter(c => c.type.endsWith('_removed')).length}, ` +
    `修改: ${changes.filter(c => c.type.endsWith('_modified')).length})`
  );

  return {
    snapshotId,
    snapshotCreatedAt: snapshot.createdAt,
    envName: currentEnv.envName,
    generatedAt: new Date().toISOString(),
    changes,
    summary: {
      total: changes.length,
      fileAdded: changes.filter(c => c.type === 'file_added').length,
      fileRemoved: changes.filter(c => c.type === 'file_removed').length,
      configAdded: changes.filter(c => c.type === 'config_added').length,
      configRemoved: changes.filter(c => c.type === 'config_removed').length,
      configModified: changes.filter(c => c.type === 'config_modified').length
    }
  };
}

function flush() {
  saveHistory(true);
}

process.on('beforeExit', () => {
  if (dirtyCount > 0) {
    try { saveHistory(true); } catch (e) {}
  }
});

export {
  OperationType,
  loadHistory,
  saveHistory,
  recordChange,
  recordBatchChanges,
  queryHistory,
  getChangeHistoryForKey,
  getChangeHistoryForService,
  createSnapshot,
  listSnapshots,
  loadSnapshot,
  compareWithSnapshot,
  flush,
  HISTORY_FILE_NAME,
  SNAPSHOTS_DIR_NAME
};

export default {
  recordChange,
  queryHistory,
  createSnapshot
};
