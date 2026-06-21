const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { holidayConfig, paths } = require('../../config/schedule');

const generateId = () => uuidv4().replace(/-/g, '').substring(0, 16);

const generateMd5 = (data) => {
  if (Buffer.isBuffer(data)) {
    return crypto.createHash('md5').update(data).digest('hex');
  }
  if (typeof data === 'string') {
    return crypto.createHash('md5').update(data, 'utf8').digest('hex');
  }
  if (data && typeof data === 'object') {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
  return crypto.createHash('md5').update(String(data)).digest('hex');
};

const generateFileMd5 = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isHoliday = (date = new Date()) => {
  const dateStr = moment(date).format('YYYY-MM-DD');
  return holidayConfig.holidays.includes(dateStr);
};

const isWeekend = (date = new Date()) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const shouldSkipToday = (date = new Date()) => {
  return holidayConfig.autoPostpone && (isHoliday(date) || isWeekend(date));
};

const getNextWorkDay = (date = new Date()) => {
  let next = moment(date).add(1, 'day').toDate();
  while (shouldSkipToday(next)) {
    next = moment(next).add(1, 'day').toDate();
  }
  return next;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const ensureDataDirs = () => {
  Object.values(paths.data).forEach((dir) => ensureDir(dir));
  ensureDir(paths.logs);
  ensureDir(paths.temp);
};

const getFileExtension = (filename) => {
  const ext = path.extname(filename || '').toLowerCase();
  return ext.startsWith('.') ? ext.substring(1) : ext;
};

const detectFormatByExtension = (filename) => {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    case 'zip':
      return 'zip';
    default:
      return null;
  }
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
};

const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (obj instanceof Object) {
    const copy = {};
    Object.keys(obj).forEach((key) => {
      copy[key] = deepClone(obj[key]);
    });
    return copy;
  }
  return obj;
};

const flattenObject = (obj, prefix = '', result = {}) => {
  Object.keys(obj).forEach((key) => {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      flattenObject(obj[key], newKey, result);
    } else if (Array.isArray(obj[key])) {
      result[newKey] = JSON.stringify(obj[key]);
    } else {
      result[newKey] = obj[key];
    }
  });
  return result;
};

const safeStringify = (obj, space = 0) => {
  try {
    return JSON.stringify(obj, null, space);
  } catch (e) {
    return String(obj);
  }
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const m = moment(value, [
    'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD',
    'YYYY-MM-DD HH:mm:ss', 'YYYY/MM/DD HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss', moment.ISO_8601
  ], true);
  return m.isValid() ? m.toDate() : null;
};

const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = parseDate(date);
  return d ? moment(d).format(format) : '';
};

const businessDate = (date = new Date()) => {
  const d = parseDate(date);
  if (!d) return '';
  if (shouldSkipToday(d)) {
    const prev = moment(d).subtract(1, 'day').toDate();
    return businessDate(prev);
  }
  return formatDate(d, 'YYYY-MM-DD');
};

module.exports = {
  generateId,
  generateMd5,
  generateFileMd5,
  delay,
  isHoliday,
  isWeekend,
  shouldSkipToday,
  getNextWorkDay,
  ensureDir,
  ensureDataDirs,
  getFileExtension,
  detectFormatByExtension,
  formatFileSize,
  formatDuration,
  deepClone,
  flattenObject,
  safeStringify,
  parseDate,
  formatDate,
  businessDate
};
