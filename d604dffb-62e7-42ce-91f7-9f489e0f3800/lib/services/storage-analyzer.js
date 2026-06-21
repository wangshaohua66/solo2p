import fs from 'fs-extra';
import path from 'path';
import { getConfig } from '../utils/config.js';

const config = getConfig();

const AUDIO_EXTENSIONS = config.supportedFormats;
const TEMP_EXTENSIONS = ['.tmp', '.temp', '.bak', '.backup', '.log', '.crdownload', '.part'];

function walkDirectory(dirPath, options = {}) {
  const {
    includeFiles = true,
    includeDirs = false,
    recursive = true,
    filter = null
  } = options;
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.name.startsWith('.') && !options.includeHidden) continue;
    const matches = !filter || filter(entry, fullPath);
    if (entry.isDirectory()) {
      if (includeDirs && matches) results.push({ path: fullPath, name: entry.name, isDirectory: true });
      if (recursive) results.push(...walkDirectory(fullPath, options));
    } else if (entry.isFile() && includeFiles && matches) {
      const stat = fs.statSync(fullPath);
      results.push({
        path: fullPath,
        name: entry.name,
        isDirectory: false,
        size: stat.size,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
        extension: path.extname(entry.name).toLowerCase()
      });
    }
  }
  return results;
}

export function analyzeDirectory(dirPath, options = {}) {
  const resolvedPath = path.resolve(dirPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`目录不存在: ${resolvedPath}`);
  }
  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`路径不是目录: ${resolvedPath}`);
  }
  const startTime = Date.now();
  const files = [];
  const dirs = [];
  let totalSize = 0;
  let audioFiles = [];
  let nonAudioFiles = [];
  let tempFiles = [];
  const extMap = {};
  const subDirs = {};
  function analyze(currentPath, relativePath = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    entries.forEach(entry => {
      if (entry.name.startsWith('.') && !options.includeHidden) return;
      const entryPath = path.join(currentPath, entry.name);
      const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        dirs.push({
          path: entryPath,
          name: entry.name,
          relativePath: entryRelative
        });
        if (!subDirs[relativePath]) subDirs[relativePath] = [];
        subDirs[relativePath].push(entry.name);
        analyze(entryPath, entryRelative);
      } else if (entry.isFile()) {
        const fileStat = fs.statSync(entryPath);
        const ext = path.extname(entry.name).toLowerCase();
        const fileInfo = {
          path: entryPath,
          name: entry.name,
          relativePath: entryRelative,
          size: fileStat.size,
          extension: ext,
          createdAt: fileStat.birthtime.toISOString(),
          modifiedAt: fileStat.mtime.toISOString()
        };
        files.push(fileInfo);
        totalSize += fileStat.size;
        extMap[ext] = (extMap[ext] || 0) + fileStat.size;
        if (AUDIO_EXTENSIONS.includes(ext)) {
          audioFiles.push(fileInfo);
        } else {
          nonAudioFiles.push(fileInfo);
        }
        if (TEMP_EXTENSIONS.includes(ext) || entry.name.includes('.tmp.')) {
          tempFiles.push(fileInfo);
        }
      }
    });
  }
  analyze(resolvedPath);
  const dirStats = {};
  dirs.forEach(dir => {
    let dirSize = 0;
    files.forEach(file => {
      if (file.path.startsWith(dir.path + path.sep) || file.path === dir.path) {
        dirSize += file.size;
      }
    });
    dirStats[dir.relativePath] = dirSize;
  });
  const sortedDirs = Object.entries(dirStats)
    .sort(([, a], [, b]) => b - a)
    .map(([name, size]) => ({ name, size }));
  const sortedExtensions = Object.entries(extMap)
    .sort(([, a], [, b]) => b - a)
    .map(([ext, size]) => ({ extension: ext || '(无扩展名)', size, count: files.filter(f => f.extension === ext).length }));
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const expiredTemp = tempFiles.filter(f => (now - new Date(f.modifiedAt).getTime()) > 7 * oneDayMs);
  return {
    path: resolvedPath,
    analyzedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startTime,
    summary: {
      totalFiles: files.length,
      totalDirectories: dirs.length,
      totalSize,
      audioFileCount: audioFiles.length,
      audioFileSize: audioFiles.reduce((s, f) => s + f.size, 0),
      nonAudioFileCount: nonAudioFiles.length,
      nonAudioFileSize: nonAudioFiles.reduce((s, f) => s + f.size, 0),
      tempFileCount: tempFiles.length,
      tempFileSize: tempFiles.reduce((s, f) => s + f.size, 0),
      expiredTempCount: expiredTemp.length,
      expiredTempSize: expiredTemp.reduce((s, f) => s + f.size, 0)
    },
    topDirectories: sortedDirs.slice(0, 10),
    extensionsBreakdown: sortedExtensions,
    tempFiles,
    expiredTempFiles: expiredTemp,
    audioFiles,
    files
  };
}

export function analyzeProjectStorage(projectPath) {
  const dirs = config.directoryStructure;
  const layerAnalysis = {};
  for (const [key, label] of Object.entries(dirs)) {
    const layerPath = path.join(projectPath, key);
    if (fs.existsSync(layerPath)) {
      try {
        layerAnalysis[key] = {
          label,
          ...analyzeDirectory(layerPath).summary
        };
      } catch (e) {
        layerAnalysis[key] = { label, error: e.message };
      }
    } else {
      layerAnalysis[key] = { label, totalFiles: 0, totalSize: 0, exists: false };
    }
  }
  const versionsPath = path.join(projectPath, '.versions');
  if (fs.existsSync(versionsPath)) {
    const allVersionFiles = walkDirectory(versionsPath, {
      filter: (e) => !e.name.endsWith('.json')
    });
    layerAnalysis.versions = {
      label: '版本快照',
      totalFiles: allVersionFiles.length,
      totalSize: allVersionFiles.reduce((s, f) => s + f.size, 0)
    };
  }
  const typeStats = { dialogue: 0, ambience: 0, foley: 0, music: 0, other: 0 };
  const typeSizes = { dialogue: 0, ambience: 0, foley: 0, music: 0, other: 0 };
  const allFiles = [];
  for (const key of Object.keys(dirs)) {
    const lp = path.join(projectPath, key);
    if (fs.existsSync(lp)) {
      const files = walkDirectory(lp, {
        filter: (e, p) => AUDIO_EXTENSIONS.includes(path.extname(e.name).toLowerCase())
      });
      files.forEach(f => {
        allFiles.push(f);
        const lower = f.name.toLowerCase();
        let categorized = false;
        for (const [t, label] of Object.entries(config.materialTypes)) {
          if (lower.includes(t) || lower.includes(label)) {
            typeStats[t]++;
            typeSizes[t] += f.size;
            categorized = true;
            break;
          }
        }
        if (!categorized) {
          typeStats.other++;
          typeSizes.other += f.size;
        }
      });
    }
  }
  const total = Object.values(typeStats).reduce((a, b) => a + b, 0);
  const totalSize = Object.values(typeSizes).reduce((a, b) => a + b, 0);
  const warningGB = config.storageThreshold.warningGB;
  const criticalGB = config.storageThreshold.criticalGB;
  const totalGB = (Object.values(layerAnalysis).reduce((s, l) => s + (l.totalSize || 0), 0)) / (1024 ** 3);
  let alert = 'normal';
  if (totalGB >= criticalGB) alert = 'critical';
  else if (totalGB >= warningGB) alert = 'warning';
  return {
    projectPath,
    analyzedAt: new Date().toISOString(),
    layers: layerAnalysis,
    totalSizeGB: totalGB.toFixed(2),
    alert,
    thresholds: { warningGB, criticalGB },
    materialBreakdown: {
      byCount: typeStats,
      bySize: typeSizes,
      totalCount: total,
      totalSize
    }
  };
}

export function analyzeMultiProject(projects, basePath) {
  const results = {};
  let totalSize = 0;
  let totalFiles = 0;
  for (const project of projects) {
    const projectPath =
      project.storagePath && path.isAbsolute(project.storagePath)
        ? project.storagePath
        : path.resolve(basePath, project.storagePath || project.path || project.id);
    if (fs.existsSync(projectPath)) {
      const analysis = analyzeProjectStorage(projectPath);
      results[project.id] = analysis;
      for (const layer of Object.values(analysis.layers)) {
        totalSize += layer.totalSize || 0;
        totalFiles += layer.totalFiles || 0;
      }
    }
  }
  const warningGB = config.storageThreshold.warningGB * projects.length;
  const criticalGB = config.storageThreshold.criticalGB * projects.length;
  const totalGB = totalSize / (1024 ** 3);
  let alert = 'normal';
  if (totalGB >= criticalGB) alert = 'critical';
  else if (totalGB >= warningGB) alert = 'warning';
  const ranked = Object.entries(results)
    .map(([id, r]) => ({
      projectId: id,
      projectName: projects.find(p => p.id === id)?.name || id,
      sizeGB: parseFloat(r.totalSizeGB),
      alert: r.alert
    }))
    .sort((a, b) => b.sizeGB - a.sizeGB);
  return {
    projectCount: projects.length,
    analyzedProjectCount: Object.keys(results).length,
    totalSize,
    totalSizeGB: totalGB.toFixed(2),
    totalFiles,
    alert,
    thresholds: { warningGB, criticalGB },
    projectRankings: ranked,
    results
  };
}

export function cleanupTempFiles(dirPath, options = {}) {
  const { daysOld = 7, dryRun = false } = options;
  const analysis = analyzeDirectory(dirPath);
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const toDelete = analysis.expiredTempFiles.filter(f =>
    new Date(f.modifiedAt).getTime() < cutoff
  );
  let freedBytes = 0;
  const deleted = [];
  const failed = [];
  if (!dryRun) {
    toDelete.forEach(f => {
      try {
        fs.removeSync(f.path);
        freedBytes += f.size;
        deleted.push(f);
      } catch (e) {
        failed.push({ ...f, error: e.message });
      }
    });
  }
  return {
    targetCount: toDelete.length,
    deletedCount: dryRun ? 0 : deleted.length,
    failedCount: dryRun ? 0 : failed.length,
    freedBytes,
    wouldFreeBytes: toDelete.reduce((s, f) => s + f.size, 0),
    dryRun,
    files: toDelete,
    failed
  };
}

export function getStorageAlert(dirPath) {
  const analysis = analyzeDirectory(dirPath);
  const totalGB = analysis.summary.totalSize / (1024 ** 3);
  const warningGB = config.storageThreshold.warningGB;
  const criticalGB = config.storageThreshold.criticalGB;
  let level = 'normal';
  let message = '';
  if (totalGB >= criticalGB) {
    level = 'critical';
    message = `存储占用 ${totalGB.toFixed(2)}GB 已超过临界值 ${criticalGB}GB，请立即清理`;
  } else if (totalGB >= warningGB) {
    level = 'warning';
    message = `存储占用 ${totalGB.toFixed(2)}GB 已超过警告值 ${warningGB}GB，建议清理`;
  } else {
    message = `存储占用 ${totalGB.toFixed(2)}GB，处于正常范围`;
  }
  return {
    level,
    message,
    totalGB: totalGB.toFixed(2),
    thresholds: { warningGB, criticalGB },
    summary: analysis.summary
  };
}
