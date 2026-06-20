import fs from 'fs';
import path from 'path';
import {
  flattenObject, unflattenObject, deepClone, deepEqual,
  ensureDir, fileExists, formatBytes
} from './utils.js';
import { getLogger, audit } from './logger.js';
import { createError, ErrorCodes } from './errors.js';
import { getConfig, getBackupsDir } from './config-loader.js';
import { parseFile, writeConfigFile, detectFormat, stringifyConfig } from './parser.js';
import { findMatchingFile } from './diff-engine.js';
import { OperationType, recordBatchChanges, flush as flushHistory } from './history.js';

const ConflictResolution = {
  SKIP: 'skip',
  OVERWRITE: 'overwrite',
  PRESERVE_TARGET: 'preserve_target',
  MERGE: 'merge',
  INTERACTIVE: 'interactive'
};

const SyncMode = {
  FULL: 'full',
  SELECTIVE: 'selective',
  KEYS_ONLY: 'keys_only',
  FILES_ONLY: 'files_only'
};

function generateSyncPlan(sourceEnv, targetEnv, diffResult, options = {}) {
  const logger = getLogger();
  const {
    mode = SyncMode.SELECTIVE,
    conflictResolution = ConflictResolution.INTERACTIVE,
    services = null,
    includeKeys = null,
    excludeKeys = null,
    includeSensitive = false,
    dryRun = true
  } = options;

  logger.info(`生成同步计划: 模式=${mode}, 冲突策略=${conflictResolution}, 预演=${dryRun}`);

  const plan = {
    generatedAt: new Date().toISOString(),
    sourceEnv: sourceEnv.envName,
    targetEnv: targetEnv.envName,
    mode,
    conflictResolution,
    dryRun,
    actions: [],
    summary: {
      totalActions: 0,
      filesToCreate: 0,
      filesToUpdate: 0,
      filesToDelete: 0,
      keysToAdd: 0,
      keysToUpdate: 0,
      keysToDelete: 0,
      conflicts: 0,
      skipped: 0,
      estimatedSizeChange: 0
    }
  };

  const sourceFiles = sourceEnv.files || [];
  const targetFiles = targetEnv.files || [];
  const byService = diffResult.byService || {};

  for (const [serviceName, serviceData] of Object.entries(byService)) {
    if (services && services.length > 0 && !services.includes(serviceName)) continue;

    for (const fileDiff of serviceData.files || []) {
      const sourceFile = fileDiff.sourceFile;
      const targetFile = fileDiff.targetFile;

      if (sourceFile && !targetFile) {
        const srcFileData = sourceFiles.find(f => f.relativePath === sourceFile.relativePath) ||
                           sourceFiles.find(f => f.filePath === sourceFile.filePath);
        if (srcFileData) {
          const changes = getFileKeyChanges(srcFileData.flatData, null, includeKeys, excludeKeys, includeSensitive);
          if (changes.total > 0 || mode === SyncMode.FILES_ONLY) {
            plan.actions.push({
              type: 'create_file',
              serviceName,
              sourcePath: sourceFile.relativePath,
              targetPath: sourceFile.relativePath,
              keysToAdd: changes.toAdd.length,
              keysToUpdate: 0,
              keysToDelete: 0,
              keyDetails: changes,
              status: 'pending',
              conflict: false,
              data: srcFileData.data
            });
            plan.summary.filesToCreate++;
            plan.summary.keysToAdd += changes.toAdd.length;
            plan.summary.estimatedSizeChange += (srcFileData.size || 0);
          }
        }
        continue;
      }

      if (!sourceFile && targetFile) {
        if (mode === SyncMode.FULL && options.allowDelete) {
          plan.actions.push({
            type: 'delete_file',
            serviceName,
            sourcePath: null,
            targetPath: targetFile.relativePath,
            keysToAdd: 0,
            keysToUpdate: 0,
            keysToDelete: fileDiff.summary.removed,
            status: 'pending',
            conflict: false
          });
          plan.summary.filesToDelete++;
          plan.summary.keysToDelete += fileDiff.summary.removed;
        }
        continue;
      }

      if (sourceFile && targetFile && fileDiff.changes && fileDiff.changes.length > 0) {
        const srcFileData = sourceFiles.find(f => f.relativePath === sourceFile.relativePath) ||
                           sourceFiles.find(f => f.filePath === sourceFile.filePath);
        const tgtFileData = targetFiles.find(f => f.relativePath === targetFile.relativePath) ||
                           targetFiles.find(f => f.filePath === targetFile.filePath);

        const filteredChanges = fileDiff.changes.filter(c => {
          if (includeKeys && includeKeys.length > 0 && !includeKeys.some(k => c.key.startsWith(k) || c.key === k)) return false;
          if (excludeKeys && excludeKeys.length > 0 && excludeKeys.some(k => c.key.startsWith(k) || c.key === k)) return false;
          return true;
        });

        if (filteredChanges.length === 0) {
          plan.summary.skipped += fileDiff.changes.length;
          continue;
        }

        const keysToAdd = filteredChanges.filter(c => c.type === 'added').length;
        const keysToUpdate = filteredChanges.filter(c => c.type === 'modified').length;
        const keysToDelete = filteredChanges.filter(c => c.type === 'removed').length;

        const hasConflict = filteredChanges.some(c => {
          if (!tgtFileData) return false;
          const targetCurrentVal = tgtFileData.flatData?.[c.key];
          const baselineVal = c.oldValue;
          if (c.type === 'modified' && !deepEqual(targetCurrentVal, baselineVal)) {
            return true;
          }
          return false;
        });

        plan.actions.push({
          type: 'update_file',
          serviceName,
          sourcePath: sourceFile.relativePath,
          targetPath: targetFile.relativePath,
          keysToAdd,
          keysToUpdate,
          keysToDelete,
          changes: filteredChanges,
          status: 'pending',
          conflict: hasConflict,
          conflictResolution: hasConflict ? conflictResolution : null,
          sourceData: srcFileData?.data,
          targetData: tgtFileData?.data,
          targetFormat: tgtFileData?.format || detectFormat(targetFile.filePath)
        });

        plan.summary.filesToUpdate++;
        plan.summary.keysToAdd += keysToAdd;
        plan.summary.keysToUpdate += keysToUpdate;
        plan.summary.keysToDelete += keysToDelete;
        if (hasConflict) plan.summary.conflicts++;
      }
    }
  }

  plan.summary.totalActions = plan.actions.length;

  logger.info(
    `同步计划生成完成: ${plan.summary.totalActions} 个操作, ` +
    `新增文件=${plan.summary.filesToCreate}, 更新文件=${plan.summary.filesToUpdate}, ` +
    `删除文件=${plan.summary.filesToDelete}, 冲突=${plan.summary.conflicts}`
  );

  return plan;
}

function getFileKeyChanges(sourceFlat, targetFlat, includeKeys, excludeKeys, includeSensitive) {
  const srcKeys = Object.keys(sourceFlat || {});
  const tgtKeys = Object.keys(targetFlat || {});
  const result = { toAdd: [], toUpdate: [], toDelete: [], total: 0 };

  for (const key of srcKeys) {
    if (includeKeys && includeKeys.length > 0 && !includeKeys.some(k => key.startsWith(k) || key === k)) continue;
    if (excludeKeys && excludeKeys.length > 0 && excludeKeys.some(k => key.startsWith(k) || key === k)) continue;
    if (!includeSensitive && isSensitiveKey(key)) continue;

    if (!Object.prototype.hasOwnProperty.call(targetFlat || {}, key)) {
      result.toAdd.push(key);
    } else if (!deepEqual(sourceFlat[key], targetFlat[key])) {
      result.toUpdate.push(key);
    }
  }

  if (targetFlat) {
    for (const key of tgtKeys) {
      if (includeKeys && includeKeys.length > 0 && !includeKeys.some(k => key.startsWith(k) || key === k)) continue;
      if (excludeKeys && excludeKeys.length > 0 && excludeKeys.some(k => key.startsWith(k) || key === k)) continue;
      if (!Object.prototype.hasOwnProperty.call(sourceFlat, key)) {
        result.toDelete.push(key);
      }
    }
  }

  result.total = result.toAdd.length + result.toUpdate.length + result.toDelete.length;
  return result;
}

function isSensitiveKey(key) {
  const sensitivePatterns = [
    /password/i, /secret/i, /token/i, /api.*key/i, /private.*key/i,
    /passwd/i, /pwd/i, /credential/i, /auth/i
  ];
  return sensitivePatterns.some(p => p.test(key));
}

function applyMergedData(action, sourceFlat, targetFlat) {
  const merged = { ...(targetFlat || {}) };

  for (const change of action.changes || []) {
    if (change.type === 'added' || change.type === 'modified') {
      merged[change.key] = change.newValue;
    } else if (change.type === 'removed') {
      delete merged[change.key];
    }
  }

  return unflattenObject(merged);
}

async function executeSyncPlan(plan, targetEnvPath, options = {}) {
  const logger = getLogger();
  const {
    confirmCallback = null,
    onProgress = null
  } = options;

  const results = [];
  const historyRecords = [];
  const backupsDir = getBackupsDir();
  const timestamp = new Date().toISOString();

  logger.info(`开始执行同步计划${plan.dryRun ? ' (预演模式)' : ''}: ${plan.summary.totalActions} 个操作`);
  audit('SYNC_START', { plan, targetEnv: plan.targetEnv, dryRun: plan.dryRun });

  let completed = 0;
  for (const action of plan.actions) {
    const result = { ...action, executedAt: new Date().toISOString() };

    try {
      if (action.conflict && plan.conflictResolution === ConflictResolution.INTERACTIVE && confirmCallback) {
        const decision = await confirmCallback(action);
        action.conflictResolution = decision;
      }

      if (action.type === 'create_file') {
        const targetFullPath = path.join(targetEnvPath, action.targetPath);
        if (!plan.dryRun) {
          const format = detectFormat(targetFullPath) || 'yaml';
          writeConfigFile(targetFullPath, action.data, format, { createBackup: false });
        }
        result.status = 'completed';
        result.message = plan.dryRun ? `[预演] 将创建文件: ${action.targetPath}` : `已创建文件: ${action.targetPath}`;
        if (!plan.dryRun) {
          historyRecords.push({
            operation: OperationType.CREATE,
            envName: plan.targetEnv,
            serviceName: action.serviceName,
            filePath: targetFullPath,
            description: `同步创建文件: ${action.targetPath}`,
            metadata: { keysAdded: action.keysToAdd }
          });
        }
      }

      else if (action.type === 'update_file') {
        const targetFullPath = path.join(targetEnvPath, action.targetPath);

        if (action.conflict) {
          switch (action.conflictResolution) {
            case ConflictResolution.SKIP:
              result.status = 'skipped';
              result.message = `跳过冲突文件: ${action.targetPath}`;
              plan.summary.skipped += action.changes?.length || 0;
              completed++;
              results.push(result);
              if (onProgress) onProgress(completed, plan.summary.totalActions, result);
              continue;

            case ConflictResolution.PRESERVE_TARGET:
              result.status = 'skipped';
              result.message = `保留目标现有值: ${action.targetPath}`;
              plan.summary.skipped += action.changes?.length || 0;
              completed++;
              results.push(result);
              if (onProgress) onProgress(completed, plan.summary.totalActions, result);
              continue;

            case ConflictResolution.MERGE:
            case ConflictResolution.OVERWRITE:
            default:
              break;
          }
        }

        let originalParsed = null;
        let sourceParsed = null;
        if (!plan.dryRun) {
          if (fileExists(targetFullPath)) {
            originalParsed = parseFile(targetFullPath);
          }
          const mergedData = applyMergedData(action, null, originalParsed?.flatData || {});
          const format = action.targetFormat || detectFormat(targetFullPath) || 'yaml';
          writeConfigFile(targetFullPath, mergedData, format, { createBackup: true });
          sourceParsed = parseFile(targetFullPath);
        }

        result.status = 'completed';
        result.message = plan.dryRun
          ? `[预演] 将更新 ${action.keysToAdd} 新增/${action.keysToUpdate} 修改/${action.keysToDelete} 删除 配置项: ${action.targetPath}`
          : `已更新 ${action.keysToAdd} 新增/${action.keysToUpdate} 修改/${action.keysToDelete} 删除: ${action.targetPath}`;

        if (!plan.dryRun && action.changes) {
          for (const change of action.changes) {
            historyRecords.push({
              operation: change.type === 'added' ? OperationType.CREATE :
                        change.type === 'removed' ? OperationType.REMOVE : OperationType.MODIFY,
              envName: plan.targetEnv,
              serviceName: action.serviceName,
              filePath: targetFullPath,
              configKey: change.key,
              oldValue: change.oldValue,
              newValue: change.newValue,
              description: `同步配置项变更 (${change.type}): ${change.key}`
            });
          }
        }
      }

      else if (action.type === 'delete_file') {
        const targetFullPath = path.join(targetEnvPath, action.targetPath);
        if (!plan.dryRun) {
          const backupPath = path.join(backupsDir, `deleted_${timestamp.replace(/[:.]/g, '_')}_${path.basename(action.targetPath)}`);
          ensureDir(path.dirname(backupPath));
          if (fileExists(targetFullPath)) {
            fs.copyFileSync(targetFullPath, backupPath);
            fs.unlinkSync(targetFullPath);
          }
        }
        result.status = 'completed';
        result.message = plan.dryRun ? `[预演] 将删除文件: ${action.targetPath}` : `已删除文件 (备份: ${action.targetPath})`;
        if (!plan.dryRun) {
          historyRecords.push({
            operation: OperationType.DELETE,
            envName: plan.targetEnv,
            serviceName: action.serviceName,
            filePath: targetFullPath,
            description: `同步删除文件: ${action.targetPath}`,
            metadata: { keysDeleted: action.keysToDelete }
          });
        }
      }

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      result.message = `操作失败: ${error.message}`;
      logger.error(`同步操作失败 [${action.type}]: ${action.targetPath} - ${error.message}`);
    }

    completed++;
    results.push(result);
    if (onProgress) onProgress(completed, plan.summary.totalActions, result);
  }

  if (historyRecords.length > 0) {
    recordBatchChanges(historyRecords);
    flushHistory();
  }

  const executedSummary = {
    total: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'failed').length,
    keysAdded: results.reduce((s, r) => s + (r.status === 'completed' ? r.keysToAdd : 0), 0),
    keysUpdated: results.reduce((s, r) => s + (r.status === 'completed' ? r.keysToUpdate : 0), 0),
    keysDeleted: results.reduce((s, r) => s + (r.status === 'completed' ? r.keysToDelete : 0), 0)
  };

  logger.info(
    `同步执行完成${plan.dryRun ? ' (预演模式)' : ''}: ` +
    `完成=${executedSummary.completed}, 跳过=${executedSummary.skipped}, 失败=${executedSummary.failed}`
  );
  audit('SYNC_COMPLETE', { executedSummary, dryRun: plan.dryRun });

  return {
    plan,
    results,
    summary: executedSummary,
    completedAt: new Date().toISOString()
  };
}

export {
  ConflictResolution,
  SyncMode,
  generateSyncPlan,
  executeSyncPlan,
  applyMergedData,
  getFileKeyChanges,
  isSensitiveKey
};

export default {
  generateSyncPlan,
  executeSyncPlan
};
