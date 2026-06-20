'use strict';

/**
 * PDF 表格流水解析器
 * 职责：
 *  1) 使用 pdf-parse 提取文本
 *  2) 识别表头行（按配置的字段表头关键词定位列）
 *  3) 表格线识别：按 2+ 空白切列，处理跨页表头重复
 *  4) 合并跨行换行的记录，输出原始行对象数组
 *
 * 说明：pdf-parse 仅输出文本流（无坐标），故采用基于表头关键词的
 *      列定位与多空格切分启发式。生产可替换为带坐标的 pdfjs-dist 渲染。
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const log = logger.forBank('PDF');

function loadPdfParse() {
  try {
    return require('pdf-parse');
  } catch (e) {
    throw new Error('pdf-parse 模块未安装，无法解析 PDF');
  }
}

/**
 * @param {string} filePath PDF 文件路径
 * @param {object} bank 银行配置
 */
async function parse(filePath, bank) {
  const pdfParse = loadPdfParse();
  const mapping = bank.mapping || {};
  const fieldHeaders = Object.values(mapping.fields || {}).map((f) => f.header);

  log.debug(`PDF 解析: ${filePath}`);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const text = data.text || '';
  const lines = text.split(/\r?\n/);

  const headerIdx = findHeaderLine(lines, fieldHeaders);
  if (headerIdx < 0) {
    log.warn('未识别到表头行，回退为逐行键值解析');
    return fallbackKeyValue(lines, fieldHeaders, filePath);
  }

  // 从表头行确定列名顺序
  const headers = splitColumns(lines[headerIdx]);
  const colNames = mapHeaders(headers, fieldHeaders, mapping);

  const rows = [];
  let pending = null; // 跨行合并的待定记录

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    // 跨页重复表头：跳过
    if (isHeaderLike(line, fieldHeaders)) continue;
    // 页脚/分页符
    if (/^\s*第\s*\d+\s*页|^\s*page\s*\d+/i.test(line)) continue;

    const cells = splitColumns(line);
    if (cells.length < 4) {
      // 可能是上一行换行续接，合并到 pending
      if (pending) {
        pending.__tail = (pending.__tail || '') + ' ' + cells.join(' ');
      }
      continue;
    }

    if (pending) {
      rows.push(buildRow(pending, colNames, mapping));
      pending = null;
    }

    if (cells.length >= colNames.length) {
      rows.push(zipRow(colNames, cells.slice(0, colNames.length), mapping));
    } else {
      // 列数不足，暂存等待续接
      pending = { cells };
    }
  }
  if (pending) rows.push(buildRow(pending, colNames, mapping));

  return { format: 'pdf', source_file: filePath, rows, meta: { pages: data.numpages, headerLine: headerIdx } };
}

function findHeaderLine(lines, headers) {
  if (!headers.length) return -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    let hit = 0;
    for (const h of headers) {
      if (h && line.includes(h)) hit++;
    }
    if (hit >= 3) return i;
  }
  return -1;
}

function isHeaderLike(line, headers) {
  let hit = 0;
  for (const h of headers) if (h && line.includes(h)) hit++;
  return hit >= 3;
}

function splitColumns(line) {
  // 优先按 2+ 空白切；不足时按单空白切
  const multi = line.trim().split(/\s{2,}/).filter(Boolean);
  if (multi.length >= 3) return multi.map((s) => s.trim());
  return line.trim().split(/\s+/).filter(Boolean);
}

function mapHeaders(headerCells, fieldHeaders, mapping) {
  // 将每个表头单元匹配到标准字段名（如匹配不上则保留原文本）
  const fields = mapping.fields || {};
  return headerCells.map((cell) => {
    for (const [std, cfg] of Object.entries(fields)) {
      if (cfg.header && cell.includes(cfg.header)) return cfg.header;
    }
    return cell;
  });
}

function zipRow(colNames, cells, mapping) {
  const obj = {};
  colNames.forEach((name, idx) => { obj[name] = cells[idx]; });
  return obj;
}

function buildRow(pending, colNames, mapping) {
  const cells = pending.cells.concat((pending.__tail || '').split(/\s+/).filter(Boolean));
  return zipRow(colNames, cells.slice(0, colNames.length), mapping);
}

/**
 * 回退方案：表头未识别时，按"字段名: 值"形式逐行提取
 */
function fallbackKeyValue(lines, fieldHeaders, filePath) {
  const rows = [];
  let current = {};
  for (const line of lines) {
    const m = line.match(/[:：]\s*(.+)$/);
    if (m) {
      const key = line.split(/[:：]/)[0].trim();
      current[key] = m[1].trim();
      if (Object.keys(current).length >= 7) {
        rows.push(current);
        current = {};
      }
    }
  }
  if (Object.keys(current).length) rows.push(current);
  return { format: 'pdf', source_file: filePath, rows, meta: { fallback: true } };
}

module.exports = { parse };
