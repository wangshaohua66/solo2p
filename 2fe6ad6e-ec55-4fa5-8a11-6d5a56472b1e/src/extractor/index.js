'use strict';

/**
 * 流水文件解析分发器
 * 优先按文件实际扩展名路由（xlsx/csv -> excel，pdf -> pdf），
 * 缺失时回退到银行 export.file_format 配置。
 */

const path = require('path');
const excel = require('./excel');
const pdf = require('./pdf');
const logger = require('../utils/logger');

const log = logger.forBank('EXTRACTOR');

async function extract(filePath, bank) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const cfgFmt = String(bank.export && bank.export.file_format || '').toLowerCase();
  const fmt = ext || cfgFmt;
  log.debug(`分发解析: ${bank.code} -> ${fmt || 'auto'} (${filePath})`);
  try {
    if (fmt === 'pdf') {
      return await pdf.parse(filePath, bank);
    }
    return await excel.parse(filePath, bank);
  } catch (e) {
    log.error(`解析失败: ${e.message}`);
    throw e;
  }
}

module.exports = { extract, excel, pdf };
