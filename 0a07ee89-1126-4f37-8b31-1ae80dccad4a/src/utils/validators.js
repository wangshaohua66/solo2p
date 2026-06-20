import fs from 'fs';
import path from 'path';
import { normalize } from './dateNormalizer.js';

function isValidDate(value) {
  if (!value) return false;
  return normalize(value) !== null;
}

function isFutureDate(value) {
  const m = normalize(value);
  if (!m) return false;
  return m.isAfter(new Date());
}

function isValidFilePath(value, { mustExist = false } = {}) {
  if (!value || typeof value !== 'string') return false;
  try {
    if (path.isAbsolute(value) || value.startsWith('~')) {
      return mustExist ? fs.existsSync(value.replace(/^~/, process.env.HOME || '')) : true;
    }
    return mustExist ? fs.existsSync(value) : true;
  } catch (_) {
    return false;
  }
}

function isValidDirPath(value, { mustExist = false, createIfMissing = false } = {}) {
  if (!value || typeof value !== 'string') return false;
  try {
    if (mustExist && !fs.existsSync(value)) {
      if (createIfMissing) {
        fs.mkdirSync(value, { recursive: true });
        return true;
      }
      return false;
    }
    if (fs.existsSync(value)) {
      const stat = fs.statSync(value);
      return stat.isDirectory();
    }
    return true;
  } catch (_) {
    return false;
  }
}

function isValidAmount(value) {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(String(value).replace(/[,，¥$元\s]/g, ''));
  return !Number.isNaN(num) && num >= 0 && Number.isFinite(num);
}

function merchantIdExists(merchantId, config) {
  if (!merchantId || !config) return false;
  return config.merchants.some((m) => m.id === merchantId);
}

function isValidChannel(channel, config) {
  if (!channel) return false;
  if (config) return config.channels.some((c) => c.id === channel);
  return ['wechat', 'alipay', 'unionpay'].includes(channel);
}

class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

function validateOptions(options, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const value = options[field];
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(new ValidationError(field, `参数 --${field} 为必填`));
      continue;
    }
    if (value === undefined || value === null || value === '') continue;
    if (rule.type === 'date' && !isValidDate(value)) {
      errors.push(new ValidationError(field, `日期格式无效: ${value}`));
    }
    if (rule.type === 'filepath' && !isValidFilePath(value, { mustExist: rule.mustExist })) {
      errors.push(new ValidationError(field, `文件路径无效或不存在: ${value}`));
    }
    if (rule.type === 'dirpath' && !isValidDirPath(value, { mustExist: rule.mustExist })) {
      errors.push(new ValidationError(field, `目录路径无效: ${value}`));
    }
    if (rule.type === 'amount' && !isValidAmount(value)) {
      errors.push(new ValidationError(field, `金额格式无效: ${value}`));
    }
    if (rule.type === 'channel' && !isValidChannel(value, rule.config)) {
      errors.push(new ValidationError(field, `支付通道无效: ${value}`));
    }
    if (rule.type === 'merchant' && rule.config && !merchantIdExists(value, rule.config)) {
      errors.push(new ValidationError(field, `商户ID不存在: ${value}`));
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(new ValidationError(field, `参数值无效: ${value}, 可选: ${rule.enum.join(', ')}`));
    }
  }
  return errors;
}

export {
  ValidationError,
  validateOptions,
  isValidDate,
  isFutureDate,
  isValidFilePath,
  isValidDirPath,
  isValidAmount,
  merchantIdExists,
  isValidChannel,
};
export default { validateOptions, ValidationError };
