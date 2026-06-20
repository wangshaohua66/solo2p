import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import {
  calculateEntropy, maskString, deepClone, getOrDefault,
  matchAnyPattern, truncate
} from './utils.js';
import { getLogger } from './logger.js';
import { createError, ErrorCodes } from './errors.js';
import { getConfig } from './config-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SENSITIVE_RULES_PATH = path.resolve(__dirname, '..', 'config', 'sensitive-rules.json');
const SCHEMA_PATH = path.resolve(__dirname, '..', 'config', 'schema.json');

let cachedRules = null;
let cachedSchema = null;

const ValidationLevel = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

function loadSensitiveRules() {
  if (cachedRules) return cachedRules;
  try {
    const content = fs.readFileSync(SENSITIVE_RULES_PATH, 'utf-8');
    cachedRules = JSON.parse(content);
    return cachedRules;
  } catch (error) {
    throw createError(
      `加载敏感规则失败: ${error.message}`,
      ErrorCodes.SCHEMA_ERROR,
      { filePath: SENSITIVE_RULES_PATH }
    );
  }
}

function loadSchema() {
  if (cachedSchema) return cachedSchema;
  try {
    const content = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    cachedSchema = JSON.parse(content);
    return cachedSchema;
  } catch (error) {
    throw createError(
      `加载校验Schema失败: ${error.message}`,
      ErrorCodes.SCHEMA_ERROR,
      { filePath: SCHEMA_PATH }
    );
  }
}

function compileKeyPatterns(patterns) {
  if (!patterns || patterns.length === 0) return [];
  return patterns.map((p) => new RegExp(p.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i'));
}

function matchesKeyPatterns(key, patterns) {
  if (!patterns || patterns.length === 0) return false;
  const keyLower = key.toLowerCase();
  for (const rawPattern of patterns) {
    const pattern = rawPattern.toLowerCase().replace(/\./g, '\\.').replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$|\\.${pattern}$|^${pattern}\\.|\\.${pattern}\\.`);
    if (regex.test(keyLower) || keyLower === rawPattern.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function matchesValuePattern(value, pattern) {
  if (!pattern || value === null || value === undefined) return false;
  const strValue = String(value);
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(strValue);
  } catch {
    return false;
  }
}

function checkForbiddenValues(rule, value, envName) {
  if (rule.forbiddenValues) {
    const strValue = String(value ?? '').toLowerCase();
    if (rule.forbiddenValues.some((fv) => strValue === String(fv).toLowerCase())) {
      return true;
    }
  }
  if (rule.forbiddenValuesForEnv && envName && rule.forbiddenValuesForEnv[envName]) {
    const strValue = String(value ?? '').toLowerCase();
    if (rule.forbiddenValuesForEnv[envName].some(
      (fv) => strValue === String(fv).toLowerCase()
    )) {
      return true;
    }
  }
  return false;
}

function scanSingleFile(parsedFile, options = {}) {
  const logger = getLogger();
  const { envName = null, includeMaskedValues = false, ruleIds = null } = options;
  const startTime = Date.now();

  const rules = loadSensitiveRules();
  const activeRules = ruleIds && ruleIds.length > 0
    ? rules.rules.filter((r) => ruleIds.includes(r.id))
    : rules.rules;

  const findings = [];
  const flatData = parsedFile.flatData || {};

  for (const rule of activeRules) {
    const keyRegexes = compileKeyPatterns(rule.keyPatterns || []);

    if (rule.requiredForEnv && envName && rule.requiredForEnv.includes(envName)) {
      const hasMatch = Object.keys(flatData).some((key) =>
        matchesKeyPatterns(key, rule.keyPatterns || [])
      );
      if (!hasMatch) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          type: 'missing',
          key: null,
          value: null,
          maskedValue: null,
          description: `[必需配置缺失] ${rule.description}`,
          suggestion: rule.suggestion,
          file: parsedFile.filePath
        });
      }
    }

    for (const [key, value] of Object.entries(flatData)) {
      let matched = false;
      const strValue = String(value ?? '');
      const checkKey = rule.keyPatterns && rule.keyPatterns.length > 0;
      const checkValue = rule.valuePattern;

      if (checkKey && matchesKeyPatterns(key, rule.keyPatterns)) {
        if (rule.minLength && strValue.length < rule.minLength) continue;
        if (rule.entropyThreshold && calculateEntropy(strValue) < rule.entropyThreshold) continue;
        matched = true;
      }

      if (!matched && checkValue && matchesValuePattern(value, rule.valuePattern)) {
        if (rule.minLength && strValue.length < rule.minLength) continue;
        if (rule.entropyThreshold && calculateEntropy(strValue) < rule.entropyThreshold) continue;
        matched = true;
      }

      if (matched && checkForbiddenValues(rule, value, envName)) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          type: 'forbidden_value',
          key,
          value: includeMaskedValues ? value : undefined,
          maskedValue: includeMaskedValues ? value : undefined,
          description: `[禁用值检测] ${rule.description} - 当前值: ${truncate(strValue, 50)}`,
          suggestion: rule.suggestion,
          file: parsedFile.filePath
        });
        matched = false;
      }

      if (matched) {
        const maskingOptions = rules.maskingRules?.[rule.category] || rules.maskingRules?.default || {};
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          type: 'sensitive',
          key,
          value: includeMaskedValues ? value : undefined,
          maskedValue: maskString(strValue, maskingOptions),
          description: rule.description,
          suggestion: rule.suggestion,
          entropy: calculateEntropy(strValue),
          valueLength: strValue.length,
          file: parsedFile.filePath
        });
      }
    }
  }

  findings.sort((a, b) => {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return (weights[b.severity] || 0) - (weights[a.severity] || 0);
  });

  const duration = Date.now() - startTime;
  logger.debug(
    `敏感信息扫描完成 [${path.basename(parsedFile.filePath)}]: ${findings.length} 项发现, 耗时 ${duration}ms`
  );

  return {
    filePath: parsedFile.filePath,
    relativePath: parsedFile.relativePath,
    serviceName: parsedFile.serviceName,
    findings,
    scanDuration: duration,
    summary: summarizeFindings(findings)
  };
}

function summarizeFindings(findings) {
  const summary = {
    total: findings.length,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    byCategory: {},
    byType: { sensitive: 0, forbidden_value: 0, missing: 0 }
  };
  for (const f of findings) {
    if (summary.bySeverity[f.severity] !== undefined) summary.bySeverity[f.severity]++;
    summary.byCategory[f.category] = (summary.byCategory[f.category] || 0) + 1;
    if (summary.byType[f.type] !== undefined) summary.byType[f.type]++;
  }
  summary.riskScore =
    summary.bySeverity.critical * 100 +
    summary.bySeverity.high * 50 +
    summary.bySeverity.medium * 20 +
    summary.bySeverity.low * 5;
  return summary;
}

function scanEnvironment(environmentScan, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();
  const { envName = environmentScan.envName } = options;

  logger.info(`开始环境敏感信息扫描 [${envName}]`);

  const files = environmentScan.files || [];
  const fileResults = [];
  const errors = [];

  for (const file of files) {
    try {
      fileResults.push(scanSingleFile(file, { ...options, envName }));
    } catch (error) {
      logger.warn(`扫描文件失败: ${file.filePath} - ${error.message}`);
      errors.push({ filePath: file.filePath, error: error.message });
    }
  }

  const allFindings = fileResults.flatMap((fr) => fr.findings);
  const totalDuration = Date.now() - startTime;

  logger.info(
    `环境敏感扫描完成 [${envName}]: ${fileResults.length} 个文件, ${allFindings.length} 项发现, 耗时 ${totalDuration}ms`
  );

  return {
    envName,
    scannedAt: new Date().toISOString(),
    duration: totalDuration,
    fileResults,
    errors,
    allFindings,
    summary: {
      ...summarizeFindings(allFindings),
      filesScanned: fileResults.length,
      filesWithFindings: fileResults.filter((fr) => fr.findings.length > 0).length,
      avgScanTimePerFile: fileResults.length > 0
        ? Math.round(totalDuration / fileResults.length)
        : 0,
      affectedServices: [...new Set(fileResults.filter(
        (fr) => fr.findings.length > 0
      ).map((fr) => fr.serviceName).filter(Boolean))]
    }
  };
}

function validateFormat(parsedFile, options = {}) {
  const errors = [];
  const warnings = [];

  if (!parsedFile || !parsedFile.data) {
    errors.push({
      level: ValidationLevel.ERROR,
      code: 'EMPTY_FILE',
      message: '配置文件为空或解析结果为空'
    });
    return { errors, warnings, valid: false };
  }

  if (typeof parsedFile.data !== 'object' || Array.isArray(parsedFile.data)) {
    errors.push({
      level: ValidationLevel.ERROR,
      code: 'INVALID_ROOT_TYPE',
      message: '配置文件根节点必须是对象类型'
    });
    return { errors, warnings, valid: false };
  }

  return { errors, warnings, valid: true };
}

function validateRequiredFields(parsedFile, options = {}) {
  const schema = loadSchema();
  const { envName = null } = options;
  const errors = [];
  const warnings = [];

  const requiredFields = schema.requiredFields || [];
  const flatData = parsedFile.flatData || {};

  for (const field of requiredFields) {
    if (field.environments && envName && !field.environments.includes(envName)) {
      continue;
    }

    const hasField = Object.prototype.hasOwnProperty.call(flatData, field.path);
    if (!hasField) {
      errors.push({
        level: ValidationLevel.ERROR,
        code: 'MISSING_REQUIRED',
        key: field.path,
        message: `缺少必需配置项: ${field.path} (${field.description})`
      });
      continue;
    }

    const value = flatData[field.path];
    if (field.type) {
      const typeValid = checkType(value, field.type);
      if (!typeValid) {
        errors.push({
          level: ValidationLevel.ERROR,
          code: 'TYPE_MISMATCH',
          key: field.path,
          message: `配置项类型错误: ${field.path} 期望类型 ${field.type}, 实际类型 ${typeof value}`
        });
      }
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}

function checkType(value, expectedType) {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    default:
      return true;
  }
}

function validateValues(parsedFile, options = {}) {
  const schema = loadSchema();
  const { envName = null } = options;
  const errors = [];
  const warnings = [];
  const flatData = parsedFile.flatData || {};
  const rules = schema.validationRules || {};

  for (const [key, value] of Object.entries(flatData)) {
    if (value === null || value === undefined) continue;
    const strValue = String(value);
    const keyLower = key.toLowerCase();

    if (keyLower.includes('port') && rules.portRange) {
      const numVal = Number(value);
      if (!isNaN(numVal) && (numVal < rules.portRange.min || numVal > rules.portRange.max)) {
        warnings.push({
          level: ValidationLevel.WARNING,
          code: 'PORT_OUT_OF_RANGE',
          key,
          message: `端口号超出推荐范围 [${rules.portRange.min}, ${rules.portRange.max}]: ${value}`
        });
      }
    }

    if ((keyLower.includes('url') || keyLower.endsWith('uri')) && rules.urlPattern) {
      if (strValue.length > 5 && !new RegExp(rules.urlPattern, 'i').test(strValue)) {
        warnings.push({
          level: ValidationLevel.WARNING,
          code: 'URL_FORMAT_SUSPECT',
          key,
          message: `URL格式可能不符合预期: ${truncate(strValue, 60)}`
        });
      }
    }

    if (keyLower.includes('host') || keyLower.includes('address') || keyLower.endsWith('.ip')) {
      if (rules.ipPattern && new RegExp(rules.ipPattern).test(strValue)) {
        if (strValue.startsWith('10.') || strValue.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(strValue)) {
          warnings.push({
            level: ValidationLevel.INFO,
            code: 'INTERNAL_IP_DETECTED',
            key,
            message: `检测到内网IP地址: ${value}`
          });
        }
      }
    }
  }

  return { errors, warnings, valid: true };
}

function validateConfigFile(parsedFile, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();

  const formatResult = validateFormat(parsedFile, options);
  const requiredResult = validateRequiredFields(parsedFile, options);
  const valueResult = validateValues(parsedFile, options);

  const allErrors = [...formatResult.errors, ...requiredResult.errors, ...valueResult.errors];
  const allWarnings = [...formatResult.warnings, ...requiredResult.warnings, ...valueResult.warnings];

  const result = {
    filePath: parsedFile.filePath,
    relativePath: parsedFile.relativePath,
    serviceName: parsedFile.serviceName,
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    duration: Date.now() - startTime,
    summary: {
      errorCount: allErrors.length,
      warningCount: allWarnings.length,
      byLevel: {
        error: allErrors.length,
        warning: allWarnings.length
      }
    }
  };

  logger.debug(
    `配置校验完成 [${path.basename(parsedFile.filePath)}]: ` +
    `${result.valid ? '通过' : '失败'}, ${allErrors.length} 错误, ${allWarnings.length} 警告`
  );

  return result;
}

function validateEnvironment(environmentScan, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();
  const { envName = environmentScan.envName } = options;

  logger.info(`开始批量校验环境配置 [${envName}]`);

  const files = environmentScan.files || [];
  const fileResults = [];
  const errors = [];

  for (const file of files) {
    try {
      fileResults.push(validateConfigFile(file, { ...options, envName }));
    } catch (error) {
      logger.warn(`校验文件失败: ${file.filePath} - ${error.message}`);
      errors.push({ filePath: file.filePath, error: error.message });
      fileResults.push({
        filePath: file.filePath,
        valid: false,
        errors: [{
          level: ValidationLevel.ERROR,
          code: 'VALIDATION_ERROR',
          message: `校验异常: ${error.message}`
        }],
        warnings: [],
        summary: { errorCount: 1, warningCount: 0 }
      });
    }
  }

  const totalErrors = fileResults.reduce((sum, r) => sum + r.summary.errorCount, 0);
  const totalWarnings = fileResults.reduce((sum, r) => sum + r.summary.warningCount, 0);
  const invalidFiles = fileResults.filter((r) => !r.valid).length;

  const summary = {
    envName,
    scannedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    filesScanned: fileResults.length,
    validFiles: fileResults.length - invalidFiles,
    invalidFiles,
    totalErrors,
    totalWarnings,
    passRate: fileResults.length > 0
      ? Math.round(((fileResults.length - invalidFiles) / fileResults.length) * 100)
      : 0
  };

  logger.info(
    `批量校验完成 [${envName}]: 通过率 ${summary.passRate}%, ` +
    `${summary.validFiles}/${summary.filesScanned} 个文件通过, ${totalErrors} 错误, ${totalWarnings} 警告`
  );

  return {
    ...summary,
    fileResults,
    errors
  };
}

export {
  ValidationLevel,
  loadSensitiveRules,
  loadSchema,
  scanSingleFile,
  scanEnvironment,
  summarizeFindings,
  validateFormat,
  validateRequiredFields,
  validateValues,
  validateConfigFile,
  validateEnvironment,
  SENSITIVE_RULES_PATH,
  SCHEMA_PATH
};

export default {
  scanEnvironment,
  validateEnvironment
};
