import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { compareMetadata, extractAudioMetadata } from './audio-meta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../config/default.json');
const config = await fs.readJson(configPath);

function generateFileHash(filePath, algorithm = 'sha256') {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

function generateVersionId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `v_${timestamp}_${random}`;
}

function getVersionsDir(projectPath, materialId) {
  return path.join(projectPath, '.versions', materialId);
}

function getVersionIndexPath(projectPath, materialId) {
  return path.join(getVersionsDir(projectPath, materialId), 'index.json');
}

function ensureVersionStorage(projectPath, materialId) {
  const versionsDir = getVersionsDir(projectPath, materialId);
  fs.ensureDirSync(versionsDir);
  const indexPath = getVersionIndexPath(projectPath, materialId);
  if (!fs.existsSync(indexPath)) {
    const initialIndex = {
      materialId,
      versions: [],
      currentVersion: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    writeAtomic(indexPath, initialIndex);
  }
  return { versionsDir, indexPath };
}

function writeAtomic(filePath, data) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      fs.removeSync(tempPath);
    }
    throw err;
  }
}

function readIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return null;
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

export async function createVersion(projectPath, material, options = {}) {
  const startTime = Date.now();
  const {
    modifiedBy = 'system',
    changeNote = '',
    sourceFilePath
  } = options;
  if (!material.id || !material.filePath) {
    throw new Error('素材ID和文件路径不能为空');
  }
  const { versionsDir, indexPath } = ensureVersionStorage(projectPath, material.id);
  const sourcePath = sourceFilePath || material.filePath;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`源文件不存在: ${sourcePath}`);
  }
  const fileHash = generateFileHash(sourcePath);
  const fileSize = fs.statSync(sourcePath).size;
  const meta = material.metadata || await extractAudioMetadata(sourcePath);
  const index = readIndex(indexPath);
  const lastVersion = index.versions[index.versions.length - 1];
  if (lastVersion && lastVersion.fileHash === fileHash) {
    return {
      skipped: true,
      reason: '文件内容未变更',
      version: lastVersion,
      elapsed: Date.now() - startTime
    };
  }
  const versionId = generateVersionId();
  const versionNumber = index.versions.length + 1;
  const extension = path.extname(sourcePath);
  const storedFileName = `${versionId}${extension}`;
  const storedPath = path.join(versionsDir, storedFileName);
  fs.copySync(sourcePath, storedPath, { overwrite: true });
  const version = {
    id: versionId,
    number: versionNumber,
    fileName: storedFileName,
    originalFileName: path.basename(sourcePath),
    filePath: storedPath,
    sourcePath,
    fileHash,
    fileSize,
    metadata: {
      sampleRate: meta.sampleRate,
      bitsPerSample: meta.bitsPerSample,
      numChannels: meta.numChannels,
      duration: meta.duration,
      format: meta.format
    },
    createdBy: modifiedBy,
    createdAt: new Date().toISOString(),
    changeNote,
    tags: options.tags || [],
    previousVersion: lastVersion ? lastVersion.id : null
  };
  index.versions.push(version);
  index.currentVersion = version.id;
  index.updatedAt = new Date().toISOString();
  if (index.versions.length > config.versioning.maxVersionsPerMaterial) {
    const expired = index.versions.splice(0, index.versions.length - config.versioning.maxVersionsPerMaterial);
    if (!config.versioning.keepExpiredVersions) {
      expired.forEach(v => {
        const vPath = path.join(versionsDir, v.fileName);
        if (fs.existsSync(vPath)) fs.removeSync(vPath);
      });
    }
  }
  writeAtomic(indexPath, index);
  return {
    skipped: false,
    version,
    elapsed: Date.now() - startTime,
    versionsCount: index.versions.length
  };
}

export function getVersionList(projectPath, materialId) {
  const indexPath = getVersionIndexPath(projectPath, materialId);
  const index = readIndex(indexPath);
  if (!index) return [];
  return index.versions.slice().reverse();
}

export function getVersion(projectPath, materialId, versionId) {
  const indexPath = getVersionIndexPath(projectPath, materialId);
  const index = readIndex(indexPath);
  if (!index) return null;
  if (versionId === 'current' || !versionId) {
    return index.versions.find(v => v.id === index.currentVersion) || null;
  }
  return index.versions.find(v => v.id === versionId) || null;
}

export function getVersionByNumber(projectPath, materialId, versionNumber) {
  const indexPath = getVersionIndexPath(projectPath, materialId);
  const index = readIndex(indexPath);
  if (!index) return null;
  return index.versions.find(v => v.number === versionNumber) || null;
}

export function compareVersions(projectPath, materialId, versionId1, versionId2) {
  const v1 = getVersion(projectPath, materialId, versionId1);
  const v2 = getVersion(projectPath, materialId, versionId2);
  if (!v1 || !v2) {
    return { error: '找不到指定的版本' };
  }
  const metaDiff = compareMetadata(v1.metadata, v2.metadata);
  return {
    version1: {
      id: v1.id,
      number: v1.number,
      createdAt: v1.createdAt,
      createdBy: v1.createdBy
    },
    version2: {
      id: v2.id,
      number: v2.number,
      createdAt: v2.createdAt,
      createdBy: v2.createdBy
    },
    identical: metaDiff.identical && v1.fileHash === v2.fileHash,
    hashMatch: v1.fileHash === v2.fileHash,
    fileSizeChange: metaDiff.sizeChange,
    durationChange: metaDiff.durationChange,
    metadataDifferences: metaDiff.differences,
    rawSizeDiff: v2.fileSize - v1.fileSize
  };
}

export async function rollbackVersion(projectPath, materialId, targetVersionId, options = {}) {
  const {
    restoredBy = 'system',
    rollbackNote = '',
    deleteLaterVersions = false
  } = options;
  const indexPath = getVersionIndexPath(projectPath, materialId);
  const index = readIndex(indexPath);
  if (!index) throw new Error('版本索引不存在');
  const targetVersion = index.versions.find(v => v.id === targetVersionId);
  if (!targetVersion) throw new Error(`找不到版本: ${targetVersionId}`);
  const currentVersion = index.versions.find(v => v.id === index.currentVersion);
  const rollbackId = generateVersionId();
  const rollbackNumber = index.versions.length + 1;
  const versionsDir = getVersionsDir(projectPath, materialId);
  const extension = path.extname(targetVersion.fileName);
  const rollbackFileName = `${rollbackId}${extension}`;
  const rollbackStoredPath = path.join(versionsDir, rollbackFileName);
  fs.copySync(targetVersion.filePath, rollbackStoredPath);
  const rollbackVersion = {
    id: rollbackId,
    number: rollbackNumber,
    fileName: rollbackFileName,
    originalFileName: targetVersion.originalFileName,
    filePath: rollbackStoredPath,
    sourcePath: targetVersion.sourcePath,
    fileHash: targetVersion.fileHash,
    fileSize: targetVersion.fileSize,
    metadata: { ...targetVersion.metadata },
    createdBy: restoredBy,
    createdAt: new Date().toISOString(),
    changeNote: `回滚到版本 ${targetVersion.number}${rollbackNote ? ` - ${rollbackNote}` : ''}`,
    tags: ['rollback'],
    previousVersion: currentVersion ? currentVersion.id : null,
    rollbackFrom: targetVersion.id,
    rollbackFromNumber: targetVersion.number
  };
  if (deleteLaterVersions) {
    const targetIdx = index.versions.findIndex(v => v.id === targetVersionId);
    const toDelete = index.versions.splice(targetIdx + 1);
    toDelete.forEach(v => {
      const vPath = path.join(versionsDir, v.fileName);
      if (fs.existsSync(vPath)) fs.removeSync(vPath);
    });
    rollbackVersion.number = targetIdx + 2;
  }
  index.versions.push(rollbackVersion);
  index.currentVersion = rollbackVersion.id;
  index.updatedAt = new Date().toISOString();
  writeAtomic(indexPath, index);
  if (fs.existsSync(targetVersion.sourcePath)) {
    fs.copySync(targetVersion.filePath, targetVersion.sourcePath, { overwrite: true });
  }
  return {
    rollbackVersion,
    targetVersion,
    sourceRestored: fs.existsSync(targetVersion.sourcePath),
    laterVersionsDeleted: deleteLaterVersions
  };
}

export function cleanupExpiredVersions(projectPath, materialId) {
  const { versionsDir, indexPath } = ensureVersionStorage(projectPath, materialId);
  const index = readIndex(indexPath);
  if (!index) return { cleaned: 0, freedBytes: 0 };
  const expireDays = config.versioning.expireDays;
  const cutoff = new Date(Date.now() - expireDays * 24 * 60 * 60 * 1000);
  const toCleanup = [];
  const toKeep = [];
  index.versions.forEach(v => {
    const isCurrent = v.id === index.currentVersion;
    const isExpired = new Date(v.createdAt) < cutoff;
    if (!isCurrent && isExpired) {
      toCleanup.push(v);
    } else {
      toKeep.push(v);
    }
  });
  let freedBytes = 0;
  toCleanup.forEach(v => {
    const vPath = path.join(versionsDir, v.fileName);
    if (fs.existsSync(vPath)) {
      freedBytes += fs.statSync(vPath).size;
      fs.removeSync(vPath);
    }
  });
  index.versions = toKeep;
  index.updatedAt = new Date().toISOString();
  writeAtomic(indexPath, index);
  return {
    cleaned: toCleanup.length,
    freedBytes,
    kept: toKeep.length
  };
}

export function deleteAllVersions(projectPath, materialId) {
  const versionsDir = getVersionsDir(projectPath, materialId);
  if (fs.existsSync(versionsDir)) {
    let totalBytes = 0;
    const files = fs.readdirSync(versionsDir);
    files.forEach(f => {
      const fp = path.join(versionsDir, f);
      if (fs.statSync(fp).isFile()) {
        totalBytes += fs.statSync(fp).size;
      }
    });
    fs.removeSync(versionsDir);
    return { deleted: files.length, freedBytes: totalBytes };
  }
  return { deleted: 0, freedBytes: 0 };
}
