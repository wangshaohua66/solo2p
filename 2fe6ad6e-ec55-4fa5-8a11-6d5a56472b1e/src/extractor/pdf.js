'use strict';

/**
 * PDF 表格流水解析器（基于 pdfjs-dist 坐标提取）
 * 职责：
 *  1) 使用 pdfjs-dist 渲染 PDF，提取文本项及其坐标（x/y/width）
 *  2) 基于表格线 / 列坐标聚类识别列边界，实现精确列切分
 *  3) 识别表头行（按配置的字段表头关键词定位列）
 *  4) 处理跨页表头重复与跨行换行续接
 *  5) 输出原始行对象数组，交由 normalizer 标准化
 *
 * 相比 pdf-parse（仅输出文本流无坐标），pdfjs-dist 提供每个文本项的
 * 坐标信息，可基于 x 坐标聚类实现真正的表格线列切分。
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const log = logger.forBank('PDF');

let _pdfjsLib = null;
/**
 * 加载 pdfjs-dist（v4+ 仅提供 ESM .mjs 产物，需动态 import()）
 * @returns {Promise<object>} 含 getDocument 的模块对象
 */
async function loadPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  const paths = [
    'pdfjs-dist/legacy/build/pdf.mjs',
    'pdfjs-dist/legacy/build/pdf.js',
    'pdfjs-dist/build/pdf.mjs',
    'pdfjs-dist',
  ];
  let lastErr = null;
  for (const p of paths) {
    try {
      const resolved = require.resolve(p);
      _pdfjsLib = await import(resolved);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!_pdfjsLib) {
    throw new Error(`pdfjs-dist 模块未安装，无法解析 PDF: ${lastErr && lastErr.message}`);
  }
  // Node 环境下禁用 worker（在主线程同步解析）
  if (_pdfjsLib.GlobalWorkerOptions) {
    // 指向同目录的 worker 模块，避免 "No workerSrc" 错误；
    // 传 useWorkerFetch:false + disableWorker 可进一步确保主线程解析
    try {
      const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      _pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    } catch (_) {
      _pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
  }
  return _pdfjsLib;
}

/**
 * @param {string} filePath PDF 文件路径
 * @param {object} bank 银行配置
 */
async function parse(filePath, bank) {
  const mapping = bank.mapping || {};
  const fields = mapping.fields || {};
  const fieldHeaders = Object.values(fields).map((f) => f && f.header).filter(Boolean);
  const fieldKeys = Object.keys(fields);

  log.debug(`PDF 解析: ${filePath}`);
  const pdfjsLib = await loadPdfjs();
  const dataBuffer = fs.readFileSync(filePath);
  const data = new Uint8Array(dataBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  // 收集所有页的文本项（含坐标），每行保留 tokens 供列网格分配
  const allLines = [];
  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = clusterIntoLines(content.items, p);
    allLines.push(...lines);
  }
  await doc.destroy();

  // 根据字段表头定位表头行：先匹配配置 header（中文），再回退匹配字段 key（ASCII）
  let headerIdx = findHeaderLine(allLines, fieldHeaders);
  let useKeyMap = false;
  if (headerIdx < 0) {
    headerIdx = findHeaderLine(allLines, fieldKeys);
    useKeyMap = headerIdx >= 0;
  }
  log.debug(`表头行索引=${headerIdx} useKeyMap=${useKeyMap} allLines=${allLines.length}`);
  if (headerIdx < 0) {
    log.warn('未识别到表头行，回退为逐行键值解析');
    return fallbackKeyValue(allLines, fieldHeaders, filePath);
  }

  // 从表头行确定列网格 x 坐标与列名
  const headerTokens = allLines[headerIdx].tokens || [];
  const colXs = headerTokens.filter((t) => t.str && t.str.trim()).map((t) => t.x);
  const headerCells = headerTokens.filter((t) => t.str && t.str.trim()).map((t) => t.str.trim());
  const colNames = useKeyMap
    ? mapHeadersByKey(headerCells, fields)
    : mapHeaders(headerCells, fieldHeaders, mapping);
  const colCount = colNames.length;

  const rows = [];
  let pending = null;

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line || !line.text || !line.text.trim()) continue;

    if (isHeaderLike(line, fieldHeaders) || isHeaderLike(line, fieldKeys)) continue; // 跨页重复表头
    if (/^\s*第\s*\d+\s*页|^\s*page\s*\d+/i.test(line.text)) continue;

    // 基于列网格 x 坐标分配单元格：返回与 colXs 对齐的完整数组（空列为空串）
    const buckets = assignByGridBuckets(line.tokens || [], colXs);
    const nonEmpty = buckets.filter((c) => c);
    if (nonEmpty.length < 4) {
      if (pending) {
        pending.__tail = (pending.__tail || '') + ' ' + nonEmpty.join(' ');
      }
      continue;
    }

    if (pending) {
      rows.push(buildRow(pending, colNames, mapping));
      pending = null;
    }

    // 按列位置与 colNames 对齐构建行对象
    const obj = {};
    for (let c = 0; c < colCount; c++) obj[colNames[c]] = buckets[c] || '';
    rows.push(obj);
  }
  if (pending) rows.push(buildRow(pending, colNames, mapping));

  return { format: 'pdf', source_file: filePath, rows, meta: { pages: numPages, headerLine: headerIdx } };
}

/**
 * 基于列网格 x 坐标分配单元格（返回与 colXs 对齐的完整数组）
 * 每个 token 归入 x 距离最近的列，同列内多个 token 用空格拼接
 */
function assignByGridBuckets(tokens, colXs) {
  const buckets = colXs.map(() => '');
  if (!colXs.length || !tokens.length) return buckets;
  const real = tokens.filter((t) => t.str && t.str.trim());
  for (const t of real) {
    let bestIdx = 0;
    let bestDist = Math.abs(t.x - colXs[0]);
    for (let c = 1; c < colXs.length; c++) {
      const d = Math.abs(t.x - colXs[c]);
      if (d < bestDist) { bestDist = d; bestIdx = c; }
    }
    buckets[bestIdx] = buckets[bestIdx] ? buckets[bestIdx] + ' ' + t.str.trim() : t.str.trim();
  }
  return buckets;
}

/**
 * 将 pdfjs 文本项按 y 坐标聚类成行，每行内按 x 坐标排序并切分列
 * 基于坐标的列切分：检测 x 坐标间距大于阈值处作为列分隔
 */
function clusterIntoLines(items, pageNum) {
  if (!items || !items.length) return [];
  // 提取有效文本项（含 transform 坐标）
  const tokens = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const tr = it.transform || [0, 0, 0, 0, 0, 0];
    const x = tr[4];
    const y = tr[5];
    tokens.push({
      str: it.str,
      x,
      y,
      width: it.width || 0,
      height: it.height || 0,
    });
  }
  if (!tokens.length) return [];

  // 按 y 降序（页面顶部 y 大）聚类，y 差 <= 阈值视为同一行
  tokens.sort((a, b) => b.y - a.y || a.x - b.x);
  const Y_TOL = 3;
  const lines = [];
  let curLine = { y: tokens[0].y, tokens: [tokens[0]] };
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (Math.abs(t.y - curLine.y) <= Y_TOL) {
      curLine.tokens.push(t);
    } else {
      lines.push(curLine);
      curLine = { y: t.y, tokens: [t] };
    }
  }
  lines.push(curLine);

  // 每行内按 x 排序，检测列间隙切分 cells
  const result = [];
  for (const ln of lines) {
    ln.tokens.sort((a, b) => a.x - b.x);
    const cells = splitByGaps(ln.tokens);
    const text = cells.join('  ');
    result.push({ text, cells, tokens: ln.tokens, y: ln.y, page: pageNum });
  }
  return result;
}

/**
 * 基于 x 坐标间距切分列：
 * 1) 过滤纯空白 token（pdfjs 对标准字体会在字符间插入大宽度空格填充）
 * 2) 计算所有相邻 token 间隙，取间隙中位数作为列内间距参考
 * 3) 间隙 > max(中位间隙 * 3, 字符中位宽 * 4) 时视为列分隔
 *    自适应：表头行 token 宽且列内间隙小，数据行 token 窄且列内间隙大
 */
function splitByGaps(tokens) {
  const real = tokens.filter((t) => t.str && t.str.trim());
  if (real.length <= 1) return tokens.map((t) => t.str.trim()).filter(Boolean);

  // 计算有效 token 宽度的中位数
  const widths = real.map((t) => t.width || 8).slice().sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)] || 8;

  // 计算所有相邻间隙，取中位数作为"列内间距"参考
  const gaps = [];
  for (let i = 1; i < real.length; i++) {
    gaps.push(real[i].x - (real[i - 1].x + (real[i - 1].width || 0)));
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  // 列分隔阈值：取"列内间距的3倍"与"字符宽度的4倍"中较大者，
  // 并设最小下限 25（避免阈值过小把列内 token 误切）
  const gapThreshold = Math.max(medianGap * 3, medianWidth * 4, 25);

  const cells = [];
  let cur = real[0].str.trim();
  let lastEnd = real[0].x + (real[0].width || 0);

  for (let i = 1; i < real.length; i++) {
    const t = real[i];
    const gap = t.x - lastEnd;
    if (gap > gapThreshold && cur) {
      cells.push(cur);
      cur = t.str.trim();
    } else {
      cur = cur ? cur + ' ' + t.str.trim() : t.str.trim();
    }
    lastEnd = t.x + (t.width || 0);
  }
  if (cur) cells.push(cur);
  return cells;
}

function findHeaderLine(lines, headers) {
  if (!headers.length) return -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.text) continue;
    let hit = 0;
    for (const h of headers) {
      if (h && line.text.includes(h)) hit++;
    }
    if (hit >= 3) return i;
  }
  return -1;
}

function isHeaderLike(line, headers) {
  let hit = 0;
  for (const h of headers) if (h && line.text.includes(h)) hit++;
  return hit >= 3;
}

function mapHeaders(headerCells, fieldHeaders, mapping) {
  const fields = mapping.fields || {};
  return headerCells.map((cell) => {
    for (const [, cfg] of Object.entries(fields)) {
      if (cfg.header && cell.includes(cfg.header)) return cfg.header;
    }
    return cell;
  });
}

/**
 * 按字段 key 匹配表头单元格（mock PDF 使用字段 key 作表头）
 * 将匹配到的 key 转换为对应的配置 header，使后续标准化能识别
 */
function mapHeadersByKey(headerCells, fields) {
  return headerCells.map((cell) => {
    for (const [key, cfg] of Object.entries(fields)) {
      if (cell.includes(key)) return cfg.header;
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
    const m = line.text.match(/[:：]\s*(.+)$/);
    if (m) {
      const key = line.text.split(/[:：]/)[0].trim();
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
