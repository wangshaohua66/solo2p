import fastDiff from 'fast-diff';
import path from 'path';
import {
  flattenObject, deepEqual, matchAnyPattern, escapeRegExp, truncate
} from './utils.js';
import { getLogger } from './logger.js';
import { getConfig } from './config-loader.js';
import { createError, ErrorCodes } from './errors.js';

const DiffType = {
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified',
  UNCHANGED: 'unchanged'
};

const Severity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

const SEVERITY_WEIGHTS = {
  [Severity.CRITICAL]: 4,
  [Severity.HIGH]: 3,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 1,
  [Severity.INFO]: 0
};

function isCriticalKey(key) {
  const config = getConfig();
  const criticalKeys = config.drift?.criticalKeys || [];
  const keyLower = key.toLowerCase();
  return criticalKeys.some((ck) =>
    keyLower === ck.toLowerCase() ||
    keyLower.includes(ck.toLowerCase()) ||
    keyLower.startsWith(ck.toLowerCase() + '.')
  );
}

function determineSeverity(diffItem, options = {}) {
  const { key, type, oldValue, newValue, valueDiff = null } = diffItem;
  const keyLower = key.toLowerCase();

  if (isCriticalKey(key)) {
    if (type === DiffType.REMOVED) return Severity.CRITICAL;
    if (type === DiffType.ADDED) return Severity.HIGH;
    if (type === DiffType.MODIFIED) {
      if (typeof oldValue === 'number' || typeof newValue === 'number') {
        const diff = Math.abs((oldValue || 0) - (newValue || 0));
        return diff > 0 ? Severity.CRITICAL : Severity.HIGH;
      }
      return Severity.HIGH;
    }
  }

  if (type === DiffType.MODIFIED) {
    const oldStr = String(oldValue ?? '');
    const newStr = String(newValue ?? '');
    const maxLen = Math.max(oldStr.length, newStr.length, 1);
    const editDistance = valueDiff?.editDistance || calculateEditDistance(oldStr, newStr);
    const ratio = editDistance / maxLen;

    if (ratio > 0.8) return Severity.HIGH;
    if (ratio > 0.4) return Severity.MEDIUM;
    if (ratio > 0.1) return Severity.LOW;
  }

  if (type === DiffType.ADDED) {
    return /password|secret|key|token/i.test(keyLower) ? Severity.MEDIUM : Severity.LOW;
  }

  if (type === DiffType.REMOVED) {
    return /password|secret|key|token/i.test(keyLower) ? Severity.MEDIUM : Severity.LOW;
  }

  return Severity.INFO;
}

function calculateEditDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 20) return Math.abs(m - n);

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function computeValueDiff(oldValue, newValue) {
  const oldStr = oldValue === null || oldValue === undefined ? '' : String(oldValue);
  const newStr = newValue === null || newValue === undefined ? '' : String(newValue);

  const diff = fastDiff(oldStr, newStr);

  let editDistance = 0;
  for (const [op] of diff) {
    if (op !== fastDiff.EQUAL) editDistance++;
  }

  return {
    diff,
    editDistance,
    addedChars: diff.reduce((sum, [op, text]) => op === fastDiff.INSERT ? sum + text.length : sum, 0),
    removedChars: diff.reduce((sum, [op, text]) => op === fastDiff.DELETE ? sum + text.length : sum, 0),
    oldLength: oldStr.length,
    newLength: newStr.length
  };
}

function diffFlatObjects(sourceFlat, targetFlat, options = {}) {
  const { computeDetails = true } = options;
  const allKeys = new Set([...Object.keys(sourceFlat || {}), ...Object.keys(targetFlat || {})]);
  const changes = [];

  for (const key of allKeys) {
    const inSource = Object.prototype.hasOwnProperty.call(sourceFlat || {}, key);
    const inTarget = Object.prototype.hasOwnProperty.call(targetFlat || {}, key);
    const sourceVal = sourceFlat?.[key];
    const targetVal = targetFlat?.[key];

    if (inSource && !inTarget) {
      changes.push({
        key,
        type: DiffType.REMOVED,
        oldValue: sourceVal,
        newValue: undefined,
        valueDiff: computeDetails ? computeValueDiff(sourceVal, undefined) : null
      });
    } else if (!inSource && inTarget) {
      changes.push({
        key,
        type: DiffType.ADDED,
        oldValue: undefined,
        newValue: targetVal,
        valueDiff: computeDetails ? computeValueDiff(undefined, targetVal) : null
      });
    } else if (!deepEqual(sourceVal, targetVal)) {
      changes.push({
        key,
        type: DiffType.MODIFIED,
        oldValue: sourceVal,
        newValue: targetVal,
        valueDiff: computeDetails ? computeValueDiff(sourceVal, targetVal) : null
      });
    }
  }

  for (const change of changes) {
    change.severity = determineSeverity(change, options);
  }

  changes.sort((a, b) => {
    const weightDiff = SEVERITY_WEIGHTS[b.severity] - SEVERITY_WEIGHTS[a.severity];
    if (weightDiff !== 0) return weightDiff;
    return a.key.localeCompare(b.key);
  });

  return changes;
}

function diffConfigFiles(sourceFile, targetFile, options = {}) {
  const sourceFlat = sourceFile?.flatData || {};
  const targetFlat = targetFile?.flatData || {};

  const changes = diffFlatObjects(sourceFlat, targetFlat, options);

  const summary = {
    total: changes.length,
    added: changes.filter((c) => c.type === DiffType.ADDED).length,
    removed: changes.filter((c) => c.type === DiffType.REMOVED).length,
    modified: changes.filter((c) => c.type === DiffType.MODIFIED).length,
    unchanged: Object.keys(sourceFlat).filter(
      (k) => Object.prototype.hasOwnProperty.call(targetFlat, k) &&
        deepEqual(sourceFlat[k], targetFlat[k])
    ).length,
    bySeverity: countBySeverity(changes)
  };

  return {
    sourceFile: sourceFile ? {
      filePath: sourceFile.filePath,
      relativePath: sourceFile.relativePath,
      serviceName: sourceFile.serviceName,
      hash: sourceFile.hash
    } : null,
    targetFile: targetFile ? {
      filePath: targetFile.filePath,
      relativePath: targetFile.relativePath,
      serviceName: targetFile.serviceName,
      hash: targetFile.hash
    } : null,
    changes,
    summary,
    fileLevel: changes.length > 0 ? getHighestSeverity(changes) : Severity.INFO
  };
}

function countBySeverity(changes) {
  const result = {
    [Severity.CRITICAL]: 0,
    [Severity.HIGH]: 0,
    [Severity.MEDIUM]: 0,
    [Severity.LOW]: 0,
    [Severity.INFO]: 0
  };
  for (const c of changes) {
    if (result[c.severity] !== undefined) {
      result[c.severity]++;
    }
  }
  return result;
}

function getHighestSeverity(changes) {
  if (!changes || changes.length === 0) return Severity.INFO;
  let highest = Severity.INFO;
  for (const c of changes) {
    if (SEVERITY_WEIGHTS[c.severity] > SEVERITY_WEIGHTS[highest]) {
      highest = c.severity;
      if (highest === Severity.CRITICAL) break;
    }
  }
  return highest;
}

function findMatchingFile(targetEnvFiles, sourceFile) {
  const byRelPath = targetEnvFiles.find(
    (f) => f.relativePath === sourceFile.relativePath
  );
  if (byRelPath) return byRelPath;

  return targetEnvFiles.find(
    (f) => f.serviceName === sourceFile.serviceName &&
      path.basename(f.filePath) === path.basename(sourceFile.filePath)
  );
}

function diffEnvironments(sourceEnv, targetEnv, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();
  const { sourceEnvName = 'source', targetEnvName = 'target', groupByService = true } = options;

  logger.info(`开始环境对比 [${sourceEnvName}] vs [${targetEnvName}]`);

  const sourceFiles = sourceEnv.files || [];
  const targetFiles = targetEnv.files || [];

  const fileDiffs = [];
  const filesOnlyInSource = [];
  const filesOnlyInTarget = [];

  for (const srcFile of sourceFiles) {
    const matchFile = findMatchingFile(targetFiles, srcFile);
    if (matchFile) {
      fileDiffs.push(diffConfigFiles(srcFile, matchFile, options));
    } else {
      filesOnlyInSource.push(srcFile);
    }
  }

  const matchedPaths = new Set(
    fileDiffs.map((d) => d.targetFile?.relativePath).filter(Boolean)
  );
  for (const tgtFile of targetFiles) {
    if (!matchedPaths.has(tgtFile.relativePath)) {
      const hasMatch = sourceFiles.some(
        (s) => s.serviceName === tgtFile.serviceName &&
          path.basename(s.filePath) === path.basename(tgtFile.filePath)
      );
      if (!hasMatch) {
        filesOnlyInTarget.push(tgtFile);
      }
    }
  }

  let byService = null;
  if (groupByService) {
    byService = {};
    for (const fd of fileDiffs) {
      const svc = fd.sourceFile?.serviceName || fd.targetFile?.serviceName || 'unknown';
      if (!byService[svc]) {
        byService[svc] = { files: [], totalChanges: 0 };
      }
      byService[svc].files.push(fd);
      byService[svc].totalChanges += fd.summary.total;
    }
    for (const f of filesOnlyInSource) {
      const svc = f.serviceName || 'unknown';
      if (!byService[svc]) byService[svc] = { files: [], totalChanges: 0 };
      byService[svc].files.push({
        sourceFile: { relativePath: f.relativePath, serviceName: f.serviceName },
        targetFile: null,
        changes: [],
        summary: { added: 0, removed: Object.keys(f.flatData).length, modified: 0, total: Object.keys(f.flatData).length },
        fileLevel: Severity.MEDIUM
      });
      byService[svc].totalChanges += Object.keys(f.flatData).length;
    }
    for (const f of filesOnlyInTarget) {
      const svc = f.serviceName || 'unknown';
      if (!byService[svc]) byService[svc] = { files: [], totalChanges: 0 };
      byService[svc].files.push({
        sourceFile: null,
        targetFile: { relativePath: f.relativePath, serviceName: f.serviceName },
        changes: [],
        summary: { added: Object.keys(f.flatData).length, removed: 0, modified: 0, total: Object.keys(f.flatData).length },
        fileLevel: Severity.MEDIUM
      });
      byService[svc].totalChanges += Object.keys(f.flatData).length;
    }
  }

  const totalFileChanges = fileDiffs.reduce((sum, fd) => sum + fd.summary.total, 0);
  const totalSourceConfigs = sourceFiles.reduce((sum, f) => sum + f.configCount, 0);
  const totalTargetConfigs = targetFiles.reduce((sum, f) => sum + f.configCount, 0);
  const allChanges = fileDiffs.flatMap((fd) => fd.changes);

  const summary = {
    duration: Date.now() - startTime,
    sourceEnv: { name: sourceEnvName, fileCount: sourceFiles.length, configCount: totalSourceConfigs },
    targetEnv: { name: targetEnvName, fileCount: targetFiles.length, configCount: totalTargetConfigs },
    comparedFiles: fileDiffs.length,
    filesOnlyInSource: filesOnlyInSource.length,
    filesOnlyInTarget: filesOnlyInTarget.length,
    totalChanges: totalFileChanges,
    added: allChanges.filter((c) => c.type === DiffType.ADDED).length,
    removed: allChanges.filter((c) => c.type === DiffType.REMOVED).length,
    modified: allChanges.filter((c) => c.type === DiffType.MODIFIED).length,
    bySeverity: countBySeverity(allChanges),
    criticalKeysAffected: allChanges.filter((c) => isCriticalKey(c.key)).length,
    hasDrift: allChanges.some((c) =>
      c.severity === Severity.CRITICAL || c.severity === Severity.HIGH
    )
  };

  logger.info(
    `环境对比完成 [${sourceEnvName}] vs [${targetEnvName}]: ${summary.comparedFiles} 个文件, ${summary.totalChanges} 处差异, 耗时 ${summary.duration}ms`
  );

  return {
    sourceEnvName,
    targetEnvName,
    generatedAt: new Date().toISOString(),
    fileDiffs,
    filesOnlyInSource,
    filesOnlyInTarget,
    byService,
    allChanges,
    summary
  };
}

function scanDrift(currentEnv, baselineEnv, options = {}) {
  const logger = getLogger();
  const loggerOpts = options;

  const diffResult = diffEnvironments(baselineEnv, currentEnv, {
    ...options,
    sourceEnvName: options.baselineName || 'baseline',
    targetEnvName: options.currentName || 'current'
  });

  const driftItems = [];

  for (const fileDiff of diffResult.fileDiffs) {
    for (const change of fileDiff.changes) {
      const severity = change.severity;
      if (severity === Severity.CRITICAL || severity === Severity.HIGH || severity === Severity.MEDIUM) {
        driftItems.push({
          ...change,
          file: fileDiff.targetFile || fileDiff.sourceFile,
          serviceName: (fileDiff.targetFile || fileDiff.sourceFile)?.serviceName,
          isUnauthorized: severity === Severity.CRITICAL || severity === Severity.HIGH,
          baselineValue: change.oldValue,
          currentValue: change.newValue
        });
      }
    }
  }

  for (const f of diffResult.filesOnlyInTarget) {
    for (const [key, value] of Object.entries(f.flatData || {})) {
      driftItems.push({
        key,
        type: DiffType.ADDED,
        oldValue: undefined,
        newValue: value,
        valueDiff: null,
        severity: isCriticalKey(key) ? Severity.CRITICAL : Severity.MEDIUM,
        file: { relativePath: f.relativePath, filePath: f.filePath },
        serviceName: f.serviceName,
        isUnauthorized: isCriticalKey(key),
        baselineValue: undefined,
        currentValue: value,
        description: '基线环境中不存在的配置项'
      });
    }
  }

  driftItems.sort((a, b) => SEVERITY_WEIGHTS[b.severity] - SEVERITY_WEIGHTS[a.severity]);

  const summary = {
    ...diffResult.summary,
    driftCount: driftItems.length,
    unauthorizedChanges: driftItems.filter((d) => d.isUnauthorized).length,
    criticalDrift: driftItems.filter((d) => d.severity === Severity.CRITICAL).length,
    highDrift: driftItems.filter((d) => d.severity === Severity.HIGH).length,
    mediumDrift: driftItems.filter((d) => d.severity === Severity.MEDIUM).length,
    affectedServices: [...new Set(driftItems.map((d) => d.serviceName).filter(Boolean))],
    driftScore: driftItems.reduce((sum, d) => sum + SEVERITY_WEIGHTS[d.severity], 0)
  };

  logger.info(
    `漂移扫描完成: ${summary.driftCount} 项漂移, ${summary.unauthorizedChanges} 项未授权变更, 漂移评分 ${summary.driftScore}`
  );

  return {
    ...diffResult,
    driftItems,
    driftSummary: summary
  };
}

export {
  DiffType,
  Severity,
  SEVERITY_WEIGHTS,
  isCriticalKey,
  determineSeverity,
  calculateEditDistance,
  computeValueDiff,
  diffFlatObjects,
  diffConfigFiles,
  diffEnvironments,
  scanDrift,
  countBySeverity,
  getHighestSeverity,
  findMatchingFile
};

export default {
  diffEnvironments,
  scanDrift
};
