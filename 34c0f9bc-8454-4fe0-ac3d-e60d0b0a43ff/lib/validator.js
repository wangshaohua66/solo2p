'use strict';

const { getThreshold, getActiveThresholds } = require('./config');

class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

function validateSampleId(id, config) {
  if (!id || typeof id !== 'string') {
    throw new ValidationError('样品编号不能为空', 'sampleId', id);
  }
  const prefix = config.sample.idPrefix;
  const seqLen = config.sample.idSequenceLength;
  const pattern = new RegExp(`^${prefix}\\d{8}\\d{${seqLen}}$`);
  if (!pattern.test(id)) {
    throw new ValidationError(
      `样品编号格式错误，应为: ${prefix}YYYYMMDD${'0'.repeat(seqLen)} (如: ${prefix}202606180001)`,
      'sampleId',
      id
    );
  }
  return true;
}

function validateDate(dateStr, fieldName = 'date') {
  if (!dateStr) {
    throw new ValidationError(`${fieldName}不能为空`, fieldName, dateStr);
  }
  const patterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}\d{2}\d{2}$/
  ];
  const matched = patterns.some(p => p.test(dateStr));
  if (!matched) {
    throw new ValidationError(
      `${fieldName}格式错误，应为 YYYY-MM-DD 或 YYYYMMDD`,
      fieldName,
      dateStr
    );
  }
  let date;
  if (dateStr.includes('-')) {
    date = new Date(dateStr);
  } else {
    date = new Date(
      `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    );
  }
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName}不是有效日期`, fieldName, dateStr);
  }
  return true;
}

function validateDateRange(startDate, endDate) {
  if (startDate) validateDate(startDate, 'startDate');
  if (endDate) validateDate(endDate, 'endDate');
  if (startDate && endDate) {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    if (s > e) {
      throw new ValidationError(
        '起始日期不能大于结束日期',
        'dateRange',
        { startDate, endDate }
      );
    }
  }
  return true;
}

function parseDate(dateStr) {
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }
  return new Date(
    `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  );
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validateStatus(status, config) {
  if (!status || typeof status !== 'string') {
    throw new ValidationError('状态不能为空', 'status', status);
  }
  const validStatuses = Object.keys(config.statusFlow);
  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `状态无效，有效值为: ${validStatuses.join(', ')}`,
      'status',
      status
    );
  }
  return true;
}

function validateStatusTransition(currentStatus, nextStatus, config) {
  validateStatus(currentStatus, config);
  validateStatus(nextStatus, config);
  const flow = config.statusFlow[currentStatus];
  if (!flow.next.includes(nextStatus)) {
    const validNext = flow.next.length ? flow.next.join(', ') : '(无)';
    throw new ValidationError(
      `不允许从 [${flow.name}] 流转到 [${config.statusFlow[nextStatus].name}]，` +
      `允许的下一个状态: ${validNext}`,
      'statusTransition',
      { from: currentStatus, to: nextStatus }
    );
  }
  return true;
}

function validateTestValue(value, projectName, config) {
  const threshold = getThreshold(config, projectName);
  if (value === null || value === undefined || value === '') {
    throw new ValidationError('检测值不能为空', 'testValue', value);
  }
  const numValue = Number(value);
  if (isNaN(numValue)) {
    throw new ValidationError('检测值必须是数字', 'testValue', value);
  }
  if (threshold) {
    if (threshold.min !== null && threshold.min !== undefined && numValue < threshold.min) {
      throw new ValidationError(
        `检测值 ${numValue} 低于最小值 ${threshold.min} ${threshold.unit}`,
        'testValue',
        value
      );
    }
    if (threshold.max !== null && threshold.max !== undefined && threshold.pass === '<=' && numValue > threshold.max * 100) {
      throw new ValidationError(
        `检测值 ${numValue} 异常偏高，请确认输入`,
        'testValue',
        value
      );
    }
  }
  return true;
}

function validateCategory(category, config) {
  if (!category || typeof category !== 'string') {
    throw new ValidationError('检测类别不能为空', 'category', category);
  }
  const validCategories = Object.keys(config.categories);
  if (!validCategories.includes(category)) {
    throw new ValidationError(
      `检测类别无效，有效值为: ${validCategories.join(', ')}`,
      'category',
      category
    );
  }
  return true;
}

function validateProject(projectName, config) {
  if (!projectName || typeof projectName !== 'string') {
    throw new ValidationError('检测项目不能为空', 'project', projectName);
  }
  const thresholds = getActiveThresholds(config);
  if (!thresholds[projectName]) {
    const available = Object.keys(thresholds).join('、');
    throw new ValidationError(
      `检测项目 [${projectName}] 未定义阈值，可用项目: ${available}`,
      'project',
      projectName
    );
  }
  return true;
}

function validateRole(role, config) {
  if (!role || typeof role !== 'string') {
    throw new ValidationError('角色不能为空', 'role', role);
  }
  const validRoles = Object.keys(config.roles);
  if (!validRoles.includes(role)) {
    throw new ValidationError(
      `角色无效，有效值为: ${validRoles.join(', ')}`,
      'role',
      role
    );
  }
  return true;
}

function validateRequiredFields(data, fields) {
  const missing = [];
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new ValidationError(
      `缺少必填字段: ${missing.join(', ')}`,
      'requiredFields',
      missing
    );
  }
  return true;
}

function judgeResult(value, threshold) {
  if (!threshold) {
    return { pass: null, reason: '无判定标准' };
  }
  const numValue = Number(value);
  let pass = false;
  let compareStr = '';
  switch (threshold.pass) {
    case '<=':
      pass = numValue <= threshold.max;
      compareStr = `<= ${threshold.max}`;
      break;
    case '>=':
      pass = numValue >= threshold.min;
      compareStr = `>= ${threshold.min}`;
      break;
    case '==':
      pass = numValue === threshold.max;
      compareStr = `== ${threshold.max}`;
      break;
    case '<':
      pass = numValue < threshold.max;
      compareStr = `< ${threshold.max}`;
      break;
    case '>':
      pass = numValue > threshold.min;
      compareStr = `> ${threshold.min}`;
      break;
    default:
      pass = null;
      compareStr = '未知比较方式';
  }
  return {
    pass,
    compare: compareStr,
    standard: threshold.standard,
    unit: threshold.unit,
    limit: threshold.max !== undefined ? threshold.max : threshold.min
  };
}

function calculateParallelStats(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ValidationError('平行检测值不能为空数组', 'parallelValues', values);
  }
  const nums = values.map(v => Number(v));
  if (nums.some(n => isNaN(n))) {
    throw new ValidationError('平行检测值必须都是数字', 'parallelValues', values);
  }
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  let variance = 0;
  if (nums.length > 1) {
    variance = nums.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (nums.length - 1);
  }
  const stdDev = Math.sqrt(variance);
  const rsd = mean !== 0 ? (stdDev / mean) * 100 : 0;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return {
    values: nums,
    count: nums.length,
    mean: Number(mean.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    rsd: Number(rsd.toFixed(2)),
    min,
    max,
    range: Number((max - min).toFixed(4))
  };
}

module.exports = {
  ValidationError,
  validateSampleId,
  validateDate,
  validateDateRange,
  parseDate,
  formatDate,
  validateStatus,
  validateStatusTransition,
  validateTestValue,
  validateCategory,
  validateProject,
  validateRole,
  validateRequiredFields,
  judgeResult,
  calculateParallelStats
};
