const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { getLogger } = require('../logger/appLogger');
const { getConfig } = require('../config');

const logger = getLogger();

function ensureExportDir() {
  const exportPath = getConfig('reporting.exportPath', './data/exports');
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
  }
  return exportPath;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsvHeader(columns) {
  return columns.map(col => escapeCsvValue(col.header || col.key || col)).join(',');
}

function writeCsvRow(columns, row) {
  return columns.map(col => {
    const key = col.key || col;
    let value = typeof row === 'object' ? row[key] : row;
    if (col.transform && typeof col.transform === 'function') {
      value = col.transform(value, row);
    }
    return escapeCsvValue(value);
  }).join(',');
}

async function exportToCsv(data, options = {}) {
  const startTime = Date.now();
  const {
    filename = `export_${moment().format('YYYYMMDD_HHmmss')}.csv`,
    columns,
    includeHeader = true,
    encoding = 'utf8'
  } = options;

  if (!columns || columns.length === 0) {
    throw new Error('CSV export requires columns definition');
  }

  const exportDir = ensureExportDir();
  const filePath = path.join(exportDir, filename);
  const bom = encoding === 'utf8' ? '\uFEFF' : '';

  const lines = [];

  if (includeHeader) {
    lines.push(writeCsvHeader(columns));
  }

  for (const row of data) {
    lines.push(writeCsvRow(columns, row));
  }

  const content = bom + lines.join('\n') + '\n';

  fs.writeFileSync(filePath, content, encoding);

  const size = Buffer.byteLength(content, encoding);
  const duration = Date.now() - startTime;

  logger.info('CSV export completed', {
    filename,
    rows: data.length,
    sizeKB: (size / 1024).toFixed(2),
    durationMs: duration
  });

  return {
    success: true,
    filePath,
    filename,
    rowCount: data.length,
    sizeBytes: size,
    durationMs: duration
  };
}

function getTrademarkExportColumns() {
  return [
    { key: 'id', header: '序号' },
    { key: 'trademark_name', header: '商标名称' },
    { key: 'applicant', header: '申请人' },
    { key: 'application_number', header: '申请号' },
    { key: 'registration_number', header: '注册号' },
    { key: 'class_number', header: '类别' },
    { key: 'announcement_type', header: '公告类型' },
    { key: 'announcement_date', header: '公告日期' },
    { key: 'announcement_number', header: '公告期号' },
    { key: 'pdf_page', header: 'PDF页码' }
  ];
}

function getMatchResultExportColumns() {
  return [
    { key: 'client_id', header: '客户ID' },
    { key: 'client_name', header: '客户名称' },
    { key: 'client_trademark_name', header: '客户商标' },
    { key: 'client_class', header: '客户类别' },
    { key: 'trademark_name', header: '公告商标' },
    { key: 'applicant', header: '对方申请人' },
    { key: 'application_number', header: '申请号' },
    { key: 'class_number', header: '类别' },
    { key: 'match_type', header: '匹配类型', transform: (v) => ({exact: '精确匹配', pinyin: '拼音匹配', acronym: '首字母匹配', similar: '近似匹配'}[v] || v) },
    { key: 'similarity_score', header: '相似度(%)', transform: (v) => v ? (v * 100).toFixed(1) : '' },
    { key: 'risk_level', header: '风险等级', transform: (v) => ({high: '高风险', medium: '中风险', low: '低风险'}[v] || v) },
    { key: 'announcement_type', header: '公告类型' },
    { key: 'announcement_date', header: '公告日期' },
    { key: 'opposition_deadline', header: '异议截止' },
    { key: 'matched_at', header: '匹配时间' }
  ];
}

function getClientExportColumns() {
  return [
    { key: 'client_id', header: '客户ID' },
    { key: 'client_name', header: '客户名称' },
    { key: 'trademark_name', header: '商标名称' },
    { key: 'class_number', header: '商标类别' },
    { key: 'application_number', header: '申请号' },
    { key: 'contact_name', header: '联系人' },
    { key: 'contact_email', header: '联系邮箱' },
    { key: 'risk_threshold', header: '风险阈值' },
    { key: 'instant_alert', header: '即时预警', transform: (v) => v ? '是' : '否' },
    { key: 'weekly_summary', header: '周报推送', transform: (v) => v ? '是' : '否' }
  ];
}

function getAnnouncementExportColumns() {
  return [
    { key: 'announcement_number', header: '公告期号' },
    { key: 'announcement_date', header: '公告日期' },
    { key: 'title', header: '公告标题' },
    { key: 'total_trademarks', header: '商标总数' },
    { key: 'status', header: '处理状态', transform: (v) => ({pending: '待处理', processing: '处理中', processed: '已完成', failed: '失败'}[v] || v) },
    { key: 'retry_count', header: '重试次数' },
    { key: 'processed_at', header: '处理时间' },
    { key: 'error_message', header: '错误信息' }
  ];
}

function getDeadlineExportColumns() {
  return [
    { key: 'client_name', header: '客户名称' },
    { key: 'trademark_name', header: '商标名称' },
    { key: 'opposition_deadline', header: '异议截止日期' },
    { key: 'days_remaining', header: '剩余天数', transform: (v) => Math.ceil(v || 0) },
    { key: 'urgency', header: '紧急程度' },
    { key: 'risk_level', header: '风险等级', transform: (v) => ({high: '高', medium: '中', low: '低'}[v] || v) },
    { key: 'announcement_number', header: '公告期号' },
    { key: 'match_type', header: '匹配类型' }
  ];
}

async function batchExportCsv(dataType, data, customFilename = null) {
  let columns;
  let filename = customFilename;

  switch (dataType) {
    case 'trademarks':
      columns = getTrademarkExportColumns();
      filename = filename || `trademarks_${moment().format('YYYYMMDD')}.csv`;
      break;
    case 'matches':
      columns = getMatchResultExportColumns();
      filename = filename || `match_results_${moment().format('YYYYMMDD')}.csv`;
      break;
    case 'clients':
      columns = getClientExportColumns();
      filename = filename || `clients_${moment().format('YYYYMMDD')}.csv`;
      break;
    case 'announcements':
      columns = getAnnouncementExportColumns();
      filename = filename || `announcements_${moment().format('YYYYMMDD')}.csv`;
      break;
    case 'deadlines':
      columns = getDeadlineExportColumns();
      filename = filename || `opposition_deadlines_${moment().format('YYYYMMDD')}.csv`;
      break;
    default:
      throw new Error(`Unknown export type: ${dataType}`);
  }

  return exportToCsv(data, { columns, filename });
}

async function streamExportWithProgress(data, columns, filename, onProgress = null) {
  const exportDir = ensureExportDir();
  const filePath = path.join(exportDir, filename);
  const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  const BATCH_SIZE = 1000;

  writeStream.write('\uFEFF');
  writeStream.write(writeCsvHeader(columns) + '\n');

  let processed = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const lines = batch.map(row => writeCsvRow(columns, row)).join('\n');
    writeStream.write(lines + '\n');
    processed += batch.length;
    if (onProgress) {
      onProgress(processed, data.length);
    }
  }

  return new Promise((resolve, reject) => {
    writeStream.end((err) => {
      if (err) reject(err);
      else resolve({
        success: true,
        filePath,
        filename,
        rowCount: data.length
      });
    });
  });
}

function getExportsList() {
  const exportDir = ensureExportDir();
  const files = fs.readdirSync(exportDir);
  return files
    .filter(f => f.endsWith('.csv') || f.endsWith('.xlsx'))
    .map(f => {
      const fullPath = path.join(exportDir, f);
      const stat = fs.statSync(fullPath);
      return {
        filename: f,
        sizeKB: (stat.size / 1024).toFixed(2),
        createdAt: moment(stat.birthtime).format('YYYY-MM-DD HH:mm:ss'),
        path: fullPath
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function cleanOldExports(maxAgeDays = 30) {
  const exportDir = ensureExportDir();
  const cutoff = moment().subtract(maxAgeDays, 'days');
  const files = fs.readdirSync(exportDir);
  let deleted = 0;

  for (const file of files) {
    const filePath = path.join(exportDir, file);
    const stat = fs.statSync(filePath);
    if (moment(stat.birthtime).isBefore(cutoff)) {
      fs.unlinkSync(filePath);
      deleted++;
      logger.info('Deleted old export file', { file, ageDays: maxAgeDays });
    }
  }

  return deleted;
}

module.exports = {
  exportToCsv,
  batchExportCsv,
  streamExportWithProgress,
  getTrademarkExportColumns,
  getMatchResultExportColumns,
  getClientExportColumns,
  getDeadlineExportColumns,
  getAnnouncementExportColumns,
  getExportsList,
  cleanOldExports,
  ensureExportDir,
  escapeCsvValue
};
