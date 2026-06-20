import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import {
  parseEnvFile, parsePropertiesFile, flattenObject,
  hashContent, hashFile, fileExists, dirExists,
  formatBytes, globToRegExp, getOrDefault,
  objectToEnvString, objectToPropertiesString, resolvePath
} from './utils.js';
import { createError, wrapError, ErrorCodes } from './errors.js';
import { getLogger } from './logger.js';
import { getConfig, getDataDir } from './config-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORMAT_PARSERS = {
  yaml: {
    extensions: ['.yaml', '.yml'],
    parse: (content) => yaml.load(content) || {},
    stringify: (obj) => yaml.dump(obj, { indent: 2, lineWidth: -1 })
  },
  json: {
    extensions: ['.json'],
    parse: (content) => {
      const trimmed = content.trim();
      return trimmed ? JSON.parse(trimmed) : {};
    },
    stringify: (obj) => JSON.stringify(obj, null, 2)
  },
  env: {
    extensions: ['.env'],
    detect: (filePath) => {
      const basename = path.basename(filePath).toLowerCase();
      return basename === '.env' || basename.startsWith('.env.');
    },
    parse: parseEnvFile,
    stringify: objectToEnvString
  },
  properties: {
    extensions: ['.properties'],
    parse: parsePropertiesFile,
    stringify: objectToPropertiesString
  }
};

const SPRING_PROFILES_PATTERN = /application-([a-zA-Z0-9_-]+)\.(ya?ml|properties)$/;

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  for (const [format, config] of Object.entries(FORMAT_PARSERS)) {
    if (config.detect && config.detect(filePath)) {
      return format;
    }
    if (config.extensions && config.extensions.includes(ext)) {
      return format;
    }
  }

  if (basename.includes('.env') || basename.startsWith('env.')) {
    return 'env';
  }

  return null;
}

function parseFile(filePath, options = {}) {
  const logger = getLogger();
  const { maxFileSize = 10 * 1024 * 1024, encoding = 'utf-8' } = options;

  if (!fileExists(filePath)) {
    throw createError(`配置文件不存在: ${filePath}`, ErrorCodes.FILE_NOT_FOUND, { filePath });
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (error) {
    throw wrapError(error, `无法读取文件: ${filePath}`, ErrorCodes.PERMISSION_DENIED);
  }

  if (stats.size > maxFileSize) {
    throw createError(
      `文件大小超过限制 (${formatBytes(stats.size)} > ${formatBytes(maxFileSize)}): ${filePath}`,
      ErrorCodes.INVALID_ARGUMENT,
      { filePath, fileSize: stats.size, maxSize: maxFileSize }
    );
  }

  const format = detectFormat(filePath);
  if (!format) {
    throw createError(
      `无法识别的配置文件格式: ${filePath}`,
      ErrorCodes.PARSE_ERROR,
      { filePath }
    );
  }

  let content;
  try {
    content = fs.readFileSync(filePath, encoding);
  } catch (error) {
    throw wrapError(error, `读取文件失败: ${filePath}`, ErrorCodes.PERMISSION_DENIED);
  }

  let data;
  try {
    data = FORMAT_PARSERS[format].parse(content);
  } catch (error) {
    throw createError(
      `解析配置文件失败 (${format}): ${filePath} - ${error.message}`,
      ErrorCodes.PARSE_ERROR,
      { filePath, format, line: extractLineNumber(error), originalError: error.message }
    );
  }

  return {
    filePath,
    format,
    content,
    data,
    flatData: flattenObject(data),
    size: stats.size,
    mtime: stats.mtime.toISOString(),
    hash: hashContent(content)
  };
}

function extractLineNumber(error) {
  if (!error) return null;
  const match = error.message?.match(/line\s+(\d+)/i);
  if (match) return parseInt(match[1], 10);
  if (error.mark?.line !== undefined) return error.mark.line + 1;
  return null;
}

function stringifyConfig(data, format, options = {}) {
  if (!FORMAT_PARSERS[format]) {
    throw createError(`不支持的格式: ${format}`, ErrorCodes.INVALID_ARGUMENT);
  }
  return FORMAT_PARSERS[format].stringify(data, options);
}

function findConfigFiles(baseDir, options = {}) {
  const config = getConfig();
  const logger = getLogger();
  const {
    filePatterns = config.scan?.filePatterns || [],
    ignorePatterns = config.scan?.ignorePatterns || [],
    followSymlinks = config.scan?.followSymlinks || false,
    maxDepth = 20
  } = options;

  const baseDirPath = resolvePath(baseDir);
  const results = [];
  const ignoreRegexes = ignorePatterns.map(globToRegExp);

  function shouldIgnore(filePath) {
    const relativePath = path.relative(baseDirPath, filePath).replace(/\\/g, '/');
    return ignoreRegexes.some((regex) => regex.test(relativePath) || regex.test(path.basename(filePath)));
  }

  function shouldInclude(filePath) {
    if (filePatterns.length === 0) {
      return detectFormat(filePath) !== null;
    }
    const relativePath = path.relative(baseDirPath, filePath).replace(/\\/g, '/');
    const basename = path.basename(filePath);
    return filePatterns.some((pattern) => {
      const regex = globToRegExp(pattern);
      return regex.test(relativePath) || regex.test(basename);
    }) || detectFormat(filePath) !== null;
  }

  function walk(dir, depth = 0) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`无法读取目录: ${dir} - ${error.message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldIgnore(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.isSymbolicLink() && !followSymlinks) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() || (entry.isSymbolicLink() && followSymlinks)) {
        if (shouldInclude(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  }

  if (!dirExists(baseDirPath)) {
    throw createError(`目录不存在: ${baseDirPath}`, ErrorCodes.FILE_NOT_FOUND, { path: baseDirPath });
  }

  walk(baseDirPath);
  return results.sort();
}

function detectServiceName(filePath, envPath, options = {}) {
  const config = getConfig();
  const rules = config.serviceDetectionRules || [
    { pattern: '([a-z0-9-]+)/config', extractGroup: 1 },
    { pattern: '([a-z0-9-]+)/src/main/resources', extractGroup: 1 },
    { pattern: 'microservices/([a-z0-9-]+)', extractGroup: 1 },
    { pattern: 'services/([a-z0-9-]+)', extractGroup: 1 }
  ];

  const relativePath = path.relative(envPath, filePath).replace(/\\/g, '/');
  const dirParts = relativePath.split('/');
  const basename = path.basename(filePath);

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern, 'i');
    const match = relativePath.match(regex);
    if (match && match[rule.extractGroup]) {
      return match[rule.extractGroup];
    }
  }

  const springMatch = basename.match(SPRING_PROFILES_PATTERN);
  if (springMatch) {
    const idx = dirParts.findIndex((p) => p === 'resources' || p === 'config');
    if (idx > 0) return dirParts[idx - 1];
    if (dirParts.length >= 2) return dirParts[dirParts.length - 2];
  }

  if (dirParts.length >= 2) {
    return dirParts[0];
  }

  return basename.replace(/\.[^.]+$/, '');
}

function detectSpringProfile(filePath) {
  const basename = path.basename(filePath);
  const match = basename.match(SPRING_PROFILES_PATTERN);
  if (match) {
    return match[1];
  }
  if (basename === 'application.yml' || basename === 'application.yaml' || basename === 'application.properties') {
    return 'default';
  }
  return null;
}

function scanEnvironment(envName, envPath, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();

  if (!dirExists(envPath)) {
    throw createError(`环境目录不存在: ${envPath}`, ErrorCodes.ENVIRONMENT_NOT_FOUND, { envName, envPath });
  }

  logger.info(`开始扫描环境 [${envName}]: ${envPath}`);

  const configFiles = findConfigFiles(envPath, options);
  logger.debug(`发现 ${configFiles.length} 个配置文件`);

  const results = [];
  const errors = [];

  for (const filePath of configFiles) {
    try {
      const parsed = parseFile(filePath, options);
      const serviceName = detectServiceName(filePath, envPath);
      const springProfile = detectSpringProfile(filePath);
      results.push({
        ...parsed,
        serviceName,
        springProfile,
        envName,
        relativePath: path.relative(envPath, filePath),
        configCount: Object.keys(parsed.flatData).length
      });
    } catch (error) {
      logger.warn(`解析文件失败: ${filePath} - ${error.message}`);
      errors.push({
        filePath,
        error: error.message,
        code: error.code
      });
    }
  }

  const duration = Date.now() - startTime;
  const totalConfigs = results.reduce((sum, r) => sum + r.configCount, 0);

  logger.info(
    `环境扫描完成 [${envName}]: ${results.length} 个文件, ${totalConfigs} 个配置项, ${errors.length} 个错误, 耗时 ${duration}ms`
  );

  return {
    envName,
    envPath,
    scannedAt: new Date().toISOString(),
    duration,
    files: results,
    errors,
    summary: {
      totalFiles: configFiles.length,
      parsedFiles: results.length,
      errorFiles: errors.length,
      totalConfigs,
      services: [...new Set(results.map((r) => r.serviceName))].sort()
    }
  };
}

function buildEnvironmentIndex(envName, envPath, options = {}) {
  const scanResult = scanEnvironment(envName, envPath, options);
  const byService = {};
  const byConfigKey = {};

  for (const file of scanResult.files) {
    if (!byService[file.serviceName]) {
      byService[file.serviceName] = [];
    }
    byService[file.serviceName].push(file);

    for (const [key, value] of Object.entries(file.flatData)) {
      if (!byConfigKey[key]) {
        byConfigKey[key] = [];
      }
      byConfigKey[key].push({
        serviceName: file.serviceName,
        filePath: file.filePath,
        relativePath: file.relativePath,
        value
      });
    }
  }

  saveEnvironmentIndex(envName, { scanResult, byService, byConfigKey });

  return {
    ...scanResult,
    byService,
    byConfigKey
  };
}

function saveEnvironmentIndex(envName, data) {
  const dataDir = getDataDir();
  const indexPath = path.join(dataDir, `index-${envName}.json`);
  try {
    fs.writeFileSync(indexPath, JSON.stringify({
      savedAt: new Date().toISOString(),
      summary: data.scanResult?.summary,
      byService: Object.fromEntries(
        Object.entries(data.byService || {}).map(([svc, files]) => [
          svc,
          files.map((f) => ({
            serviceName: f.serviceName,
            relativePath: f.relativePath,
            filePath: f.filePath,
            configCount: f.configCount,
            hash: f.hash
          }))
        ])
      )
    }, null, 2));
  } catch (error) {
    const logger = getLogger();
    logger.warn(`保存环境索引失败 [${envName}]: ${error.message}`);
  }
}

function loadEnvironmentIndex(envName) {
  const dataDir = getDataDir();
  const indexPath = path.join(dataDir, `index-${envName}.json`);
  if (!fileExists(indexPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeConfigFile(filePath, data, format, options = {}) {
  const { createBackup = true, encoding = 'utf-8' } = options;
  const actualFormat = format || detectFormat(filePath);

  if (!actualFormat) {
    throw createError(
      `无法推断输出格式: ${filePath}`,
      ErrorCodes.INVALID_ARGUMENT,
      { filePath }
    );
  }

  const content = stringifyConfig(data, actualFormat);

  const dir = path.dirname(filePath);
  if (!dirExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (createBackup && fileExists(filePath)) {
    const backupPath = `${filePath}.bak.${Date.now()}`;
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch (error) {
      const logger = getLogger();
      logger.warn(`创建备份失败: ${backupPath} - ${error.message}`);
    }
  }

  try {
    fs.writeFileSync(filePath, content, encoding);
    return {
      filePath,
      format: actualFormat,
      size: Buffer.byteLength(content, encoding),
      hash: hashContent(content),
      backupCreated: createBackup && fileExists(`${filePath}.bak.${Date.now()}`)
    };
  } catch (error) {
    throw wrapError(error, `写入配置文件失败: ${filePath}`, ErrorCodes.PERMISSION_DENIED);
  }
}

function getConfigValue(parsedData, keyPath) {
  return getOrDefault(parsedData.flatData, keyPath);
}

export {
  detectFormat,
  parseFile,
  stringifyConfig,
  findConfigFiles,
  detectServiceName,
  detectSpringProfile,
  scanEnvironment,
  buildEnvironmentIndex,
  saveEnvironmentIndex,
  loadEnvironmentIndex,
  writeConfigFile,
  getConfigValue,
  FORMAT_PARSERS,
  SPRING_PROFILES_PATTERN
};

export default {
  parseFile,
  scanEnvironment,
  buildEnvironmentIndex
};
