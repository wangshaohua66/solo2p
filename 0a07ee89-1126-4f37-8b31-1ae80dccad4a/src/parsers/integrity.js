import fs from 'fs';

const REQUIRED_FIELDS = ['orderId', 'merchantId', 'amount', 'channel', 'type', 'status', 'timestamp'];

function computeFieldStats(records) {
  const stats = {};
  for (const field of REQUIRED_FIELDS) {
    stats[field] = { total: records.length, filled: 0, empty: 0, fillRate: 0 };
  }
  for (const rec of records) {
    for (const field of REQUIRED_FIELDS) {
      const val = rec[field];
      if (val !== undefined && val !== null && val !== '') {
        stats[field].filled++;
      } else {
        stats[field].empty++;
      }
    }
  }
  for (const field of REQUIRED_FIELDS) {
    const s = stats[field];
    s.fillRate = s.total > 0 ? s.filled / s.total : 0;
  }
  return stats;
}

function detectEncoding(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'UTF-8-BOM';
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) return 'UTF-16-LE-BOM';
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) return 'UTF-16-BE-BOM';
  return 'UTF-8';
}

function detectLineEndings(content) {
  const crlf = (content.match(/\r\n/g) || []).length;
  const lf = (content.match(/(?<!\r)\n/g) || []).length;
  const cr = (content.match(/\r(?!\n)/g) || []).length;
  if (crlf > lf && crlf > cr) return 'CRLF';
  if (lf > crlf && lf > cr) return 'LF';
  if (cr > 0) return 'CR';
  return 'unknown';
}

function checkFileFormat(filePath, expectedFormat) {
  const issues = [];
  const stat = fs.statSync(filePath);
  const size = stat.size;

  if (size === 0) {
    issues.push({ level: 'error', code: 'EMPTY_FILE', message: '文件为空' });
    return { size, encoding: 'unknown', lineEndings: 'unknown', issues };
  }

  const head = fs.readFileSync(filePath, { length: Math.min(size, 8192) });
  const encoding = detectEncoding(head);
  const content = head.toString('utf8');
  const lineEndings = detectLineEndings(content);

  if (encoding !== 'UTF-8' && encoding !== 'UTF-8-BOM') {
    issues.push({ level: 'warn', code: 'UNEXPECTED_ENCODING', message: `文件编码疑似 ${encoding}，可能影响解析` });
  }

  if (expectedFormat === 'csv') {
    const firstLine = content.split('\n')[0];
    if (!firstLine.includes(',') && !firstLine.includes('\t')) {
      issues.push({ level: 'warn', code: 'CSV_NO_DELIMITER', message: '首行未检测到逗号分隔符' });
    }
  } else if (expectedFormat === 'json' || expectedFormat === 'ndjson') {
    const trimmed = content.trim();
    const startsWithBrace = trimmed.startsWith('{');
    const startsWithBracket = trimmed.startsWith('[');
    if (!startsWithBrace && !startsWithBracket && !trimmed.startsWith('[')) {
      issues.push({ level: 'warn', code: 'JSON_BAD_HEADER', message: '文件开头非标准 JSON 格式' });
    }
  } else if (expectedFormat === 'xml') {
    const hasXmlDecl = /<\?xml/i.test(content);
    const hasRoot = /<[a-zA-Z_][\w:.-]*/.test(content);
    if (!hasXmlDecl && !hasRoot) {
      issues.push({ level: 'warn', code: 'XML_BAD_HEADER', message: '文件未检测到 XML 声明或根节点' });
    }
  }

  return { size, encoding, lineEndings, issues };
}

function checkIntegrity(records, options = {}) {
  const total = records.length;
  const fieldStats = computeFieldStats(records);

  const warnings = [];
  const errors = [];

  for (const [field, stats] of Object.entries(fieldStats)) {
    if (stats.fillRate < 0.99) {
      warnings.push({
        field,
        code: 'LOW_FILL_RATE',
        message: `字段 ${field} 非空率 ${(stats.fillRate * 100).toFixed(2)}% (${stats.filled}/${stats.total})`,
        fillRate: stats.fillRate,
      });
    }
    if (field === 'orderId' && stats.fillRate < 0.5) {
      errors.push({ field, code: 'CRITICAL_ORDERID', message: `订单号字段非空率过低 (${(stats.fillRate * 100).toFixed(1)}%)，请核对字段映射` });
    }
    if (field === 'amount' && stats.fillRate < 0.8) {
      errors.push({ field, code: 'CRITICAL_AMOUNT', message: `金额字段非空率过低 (${(stats.fillRate * 100).toFixed(1)}%)` });
    }
  }

  const declaredCount = options.declaredCount ?? null;
  const countMatch = declaredCount == null ? null : total === declaredCount;
  if (declaredCount != null && total !== declaredCount) {
    warnings.push({
      field: '_count',
      code: 'COUNT_MISMATCH',
      message: `记录数不匹配：声明 ${declaredCount} 条，实际解析 ${total} 条 (差 ${declaredCount - total > 0 ? '-' : '+'}${Math.abs(declaredCount - total)})`,
    });
  }

  const duplicateIds = new Map();
  for (const r of records) {
    const id = r.orderId || r.transactionId;
    if (!id) continue;
    const key = `${r.merchantId || ''}:${id}`;
    duplicateIds.set(key, (duplicateIds.get(key) || 0) + 1);
  }
  const dupCount = [...duplicateIds.values()].filter((c) => c > 1).reduce((s, c) => s + c - 1, 0);
  if (dupCount > 0) {
    warnings.push({ field: '_id', code: 'DUPLICATE_ID', message: `检测到 ${dupCount} 条重复订单号记录` });
  }

  const amountNegative = records.filter((r) => r.type === 'payment' && r.amount < 0).length;
  if (amountNegative > 0) {
    warnings.push({ field: 'amount', code: 'NEGATIVE_AMOUNT', message: `${amountNegative} 条支付记录金额为负值` });
  }

  return {
    total,
    fieldStats,
    declaredCount,
    countMatch,
    errors,
    warnings,
    duplicateCount: dupCount,
    negativeAmountCount: amountNegative,
    overallScore: overallScore(errors.length, warnings.length, total),
  };
}

function overallScore(errCount, warnCount, total) {
  if (total === 0) return 0;
  let score = 100;
  score -= errCount * 20;
  score -= warnCount * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderReport(checkResult, formatCheck) {
  const lines = [];
  lines.push(`文件完整性报告 (得分: ${checkResult.overallScore}/100)`);
  lines.push(`记录总数: ${checkResult.total}`);
  if (checkResult.declaredCount != null) {
    lines.push(`声明记录数: ${checkResult.declaredCount} (${checkResult.countMatch ? '匹配' : '不匹配'})`);
  }
  if (formatCheck) {
    lines.push(`文件大小: ${formatCheck.size} 字节`);
    lines.push(`文件编码: ${formatCheck.encoding}`);
    lines.push(`换行格式: ${formatCheck.lineEndings}`);
  }
  lines.push('');
  lines.push('必填字段非空率:');
  for (const [field, stats] of Object.entries(checkResult.fieldStats)) {
    const pct = (stats.fillRate * 100).toFixed(2).padStart(6, ' ');
    const barLen = Math.round(stats.fillRate * 20);
    const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
    lines.push(`  ${field.padEnd(14)} ${pct}% ${bar} (${stats.filled}/${stats.total})`);
  }
  if (checkResult.warnings.length > 0) {
    lines.push('');
    lines.push(`警告 (${checkResult.warnings.length}):`);
    for (const w of checkResult.warnings) {
      lines.push(`  ⚠ [${w.code}] ${w.message}`);
    }
  }
  if (checkResult.errors.length > 0) {
    lines.push('');
    lines.push(`错误 (${checkResult.errors.length}):`);
    for (const e of checkResult.errors) {
      lines.push(`  ✗ [${e.code}] ${e.message}`);
    }
  }
  return lines.join('\n');
}

export {
  checkIntegrity,
  checkFileFormat,
  renderReport,
  computeFieldStats,
  REQUIRED_FIELDS,
};

export default { checkIntegrity, checkFileFormat, renderReport, computeFieldStats };
