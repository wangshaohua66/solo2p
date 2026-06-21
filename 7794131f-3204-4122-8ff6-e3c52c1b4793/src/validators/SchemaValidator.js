const { logger, verbose } = require('../utils/logger');
const { parseDate, formatDate } = require('../utils/common');
const { STANDARD_FIELDS } = require('../transformers/FieldMapper');

const LOGIC_RULES = [
  {
    id: 'L001',
    name: '会计恒等式校验',
    description: '资产总额 = 负债总额 + 净资产',
    severity: 'error',
    check: (row) => {
      const assets = Number(row.total_assets) || 0;
      const liabilities = Number(row.total_liabilities) || 0;
      const equity = Number(row.net_assets) || 0;
      if (assets === 0 && liabilities === 0 && equity === 0) return { pass: true };
      const diff = Math.abs(assets - (liabilities + equity));
      const tolerance = Math.max(Math.abs(assets) * 0.001, 0.01);
      return {
        pass: diff <= tolerance,
        actual: `资产=${assets}, 负债=${liabilities}, 净资产=${equity}, 差额=${diff.toFixed(2)}`,
        expected: `资产总额 ≈ 负债总额 + 净资产 (容差${tolerance.toFixed(2)})`
      };
    }
  },
  {
    id: 'L002',
    name: '不良率范围校验',
    description: '不良率应在0-100之间',
    severity: 'error',
    check: (row) => {
      const rate = row.non_performing_rate;
      if (rate === null || rate === undefined || rate === '') return { pass: true };
      const num = Number(rate);
      if (isNaN(num)) return { pass: false, actual: `${rate}`, expected: '有效数字' };
      return {
        pass: num >= 0 && num <= 100,
        actual: `${num}%`,
        expected: '0% ~ 100%'
      };
    }
  },
  {
    id: 'L003',
    name: '拨备覆盖率范围',
    description: '拨备覆盖率应大于等于0',
    severity: 'warn',
    check: (row) => {
      const cov = row.provision_coverage;
      if (cov === null || cov === undefined || cov === '') return { pass: true };
      const num = Number(cov);
      if (isNaN(num)) return { pass: false, actual: `${cov}`, expected: '有效数字' };
      return { pass: num >= 0, actual: `${num}%`, expected: '≥ 0%' };
    }
  },
  {
    id: 'L004',
    name: '贷款笔数非负',
    description: '贷款笔数、担保笔数等计数字段应为非负整数',
    severity: 'error',
    check: (row) => {
      const countFields = ['loan_count', 'guarantee_count', 'pawn_count', 'equity_transaction_count', 'customer_count', 'employee_count'];
      const failures = [];
      for (const f of countFields) {
        if (row[f] === null || row[f] === undefined || row[f] === '') continue;
        const num = Number(row[f]);
        if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
          failures.push(`${f}=${row[f]}`);
        }
      }
      return failures.length === 0
        ? { pass: true }
        : { pass: false, actual: failures.join(', '), expected: '非负整数' };
    }
  },
  {
    id: 'L005',
    name: '报告日期与业务日期合理性',
    description: '报告日期不应早于业务日期',
    severity: 'warn',
    check: (row) => {
      const reportDate = parseDate(row.report_date);
      const bizDate = parseDate(row.business_date);
      if (!reportDate || !bizDate) return { pass: true };
      return {
        pass: reportDate >= bizDate,
        actual: `报告日期=${formatDate(reportDate)}, 业务日期=${formatDate(bizDate)}`,
        expected: '报告日期 ≥ 业务日期'
      };
    }
  },
  {
    id: 'L006',
    name: '金额字段非负校验',
    description: '金额类字段(除利润外)不应为负',
    severity: 'error',
    check: (row) => {
      const amountFields = [
        'total_assets', 'total_liabilities', 'net_assets', 'loan_balance',
        'non_performing_loan', 'guarantee_balance', 'pawn_total',
        'equity_transaction_amount', 'managed_asset_scale',
        'registered_capital', 'paid_in_capital', 'overdue_amount',
        'provision_balance', 'operating_income'
      ];
      const failures = [];
      for (const f of amountFields) {
        if (row[f] === null || row[f] === undefined || row[f] === '') continue;
        const num = Number(row[f]);
        if (isNaN(num)) {
          failures.push(`${f}=${row[f]}(非数字)`);
        } else if (num < 0) {
          failures.push(`${f}=${num}(负数)`);
        }
      }
      return failures.length === 0
        ? { pass: true }
        : { pass: false, actual: failures.join(', '), expected: '有效非负数字' };
    }
  }
];

class SchemaValidator {
  constructor(options = {}) {
    this.options = {
      failOnError: false,
      maxErrors: 1000,
      enableLogicCheck: true,
      ...options
    };
  }

  _validateType(value, fieldSchema, fieldName) {
    if (value === null || value === undefined || value === '') return null;
    switch (fieldSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { field: fieldName, code: 'TYPE_ERROR', expected: 'string', actual: typeof value };
        }
        break;
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          return { field: fieldName, code: 'TYPE_ERROR', expected: 'number', actual: value };
        }
        break;
      }
      case 'integer': {
        const num = Number(value);
        if (isNaN(num) || !Number.isInteger(num)) {
          return { field: fieldName, code: 'TYPE_ERROR', expected: 'integer', actual: value };
        }
        break;
      }
      case 'date': {
        const d = parseDate(value);
        if (!d) {
          return { field: fieldName, code: 'TYPE_ERROR', expected: 'date', actual: value };
        }
        break;
      }
      case 'enum':
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          return {
            field: fieldName,
            code: 'ENUM_ERROR',
            expected: fieldSchema.enum.join('/'),
            actual: value
          };
        }
        break;
    }
    return null;
  }

  _validateRequired(value, fieldSchema, fieldName) {
    if (!fieldSchema.required) return null;
    if (value === null || value === undefined || value === '') {
      return { field: fieldName, code: 'MISSING_REQUIRED', expected: '非空值', actual: '空' };
    }
    return null;
  }

  _validateRange(value, fieldSchema, fieldName) {
    if (value === null || value === undefined || value === '') return null;
    if (fieldSchema.min !== undefined && Number(value) < fieldSchema.min) {
      return { field: fieldName, code: 'RANGE_ERROR', expected: `≥${fieldSchema.min}`, actual: value };
    }
    if (fieldSchema.max !== undefined && Number(value) > fieldSchema.max) {
      return { field: fieldName, code: 'RANGE_ERROR', expected: `≤${fieldSchema.max}`, actual: value };
    }
    if (fieldSchema.pattern && typeof value === 'string') {
      if (!new RegExp(fieldSchema.pattern).test(value)) {
        return { field: fieldName, code: 'PATTERN_ERROR', expected: fieldSchema.pattern, actual: value };
      }
    }
    return null;
  }

  _validateRow(row, rowIndex) {
    const errors = [];
    const warnings = [];
    for (const [fieldName, schema] of Object.entries(STANDARD_FIELDS)) {
      const value = row[fieldName];
      const requiredErr = this._validateRequired(value, schema, fieldName);
      if (requiredErr) errors.push({ ...requiredErr, rowIndex, severity: 'error' });
      const typeErr = this._validateType(value, schema, fieldName);
      if (typeErr) errors.push({ ...typeErr, rowIndex, severity: 'error' });
      const rangeErr = this._validateRange(value, schema, fieldName);
      if (rangeErr) errors.push({ ...rangeErr, rowIndex, severity: 'error' });
    }
    if (this.options.enableLogicCheck) {
      for (const rule of LOGIC_RULES) {
        try {
          const result = rule.check(row);
          if (!result.pass) {
            const issue = {
              ruleId: rule.id,
              ruleName: rule.name,
              description: rule.description,
              rowIndex,
              actual: result.actual,
              expected: result.expected,
              severity: rule.severity
            };
            if (rule.severity === 'error') errors.push(issue);
            else warnings.push(issue);
          }
        } catch (e) {
          warnings.push({
            ruleId: rule.id,
            rowIndex,
            code: 'RULE_EXEC_ERROR',
            message: `规则执行异常: ${e.message}`,
            severity: 'warn'
          });
        }
      }
    }
    return { errors, warnings };
  }

  validate(records, context = {}) {
    const startTime = Date.now();
    const totalRows = records.length;
    const allErrors = [];
    const allWarnings = [];
    const validRows = [];
    const invalidRowIndexes = [];
    const fieldStats = {};

    for (let i = 0; i < totalRows; i++) {
      const row = records[i];
      const { errors, warnings } = this._validateRow(row, i);
      allErrors.push(...errors);
      allWarnings.push(...warnings);
      if (errors.length === 0) {
        validRows.push(row);
      } else {
        invalidRowIndexes.push(i);
      }
      for (const field of Object.keys(STANDARD_FIELDS)) {
        if (!fieldStats[field]) fieldStats[field] = { filled: 0, empty: 0 };
        if (row[field] !== null && row[field] !== undefined && row[field] !== '') {
          fieldStats[field].filled++;
        } else {
          fieldStats[field].empty++;
        }
      }
      if (allErrors.length >= this.options.maxErrors) {
        logger.warn(`错误数已达上限${this.options.maxErrors}，停止校验剩余行`);
        break;
      }
    }

    const fieldCoverage = {};
    for (const [field, stats] of Object.entries(fieldStats)) {
      const total = stats.filled + stats.empty;
      fieldCoverage[field] = {
        ...stats,
        coverage: total > 0 ? Number(((stats.filled / total) * 100).toFixed(2)) : 0,
        schema: STANDARD_FIELDS[field]
      };
    }

    const errorSummary = {};
    for (const err of allErrors) {
      const key = err.field || err.ruleId || err.code;
      if (!errorSummary[key]) errorSummary[key] = { count: 0, codes: {} };
      errorSummary[key].count++;
      const code = err.code || err.ruleName || 'UNKNOWN';
      errorSummary[key].codes[code] = (errorSummary[key].codes[code] || 0) + 1;
    }

    const result = {
      success: allErrors.length === 0 || !this.options.failOnError,
      orgId: context.orgId || '',
      totalRows,
      validRows: validRows.length,
      invalidRows: invalidRowIndexes.length,
      errorCount: allErrors.length,
      warningCount: allWarnings.length,
      errors: allErrors.slice(0, this.options.maxErrors),
      warnings: allWarnings.slice(0, this.options.maxErrors),
      invalidRowIndexes,
      validRecords: validRows,
      fieldCoverage,
      errorSummary,
      logicRules: LOGIC_RULES.map((r) => ({ id: r.id, name: r.name, description: r.description, severity: r.severity })),
      validateDurationMs: Date.now() - startTime,
      validatedAt: new Date().toISOString()
    };

    verbose(`[${context.orgId || '校验'}] 完成: 总行数${totalRows}, 有效${validRows.length}, 错误${allErrors.length}, 警告${allWarnings.length}`);
    return result;
  }

  generateReport(validationResult) {
    const lines = [];
    lines.push('='.repeat(60));
    lines.push('  数据合规校验报告');
    lines.push('='.repeat(60));
    lines.push(`校验时间: ${validationResult.validatedAt}`);
    lines.push(`机构: ${validationResult.orgId}`);
    lines.push(`总行数: ${validationResult.totalRows}`);
    lines.push(`有效行数: ${validationResult.validRows} (${((validationResult.validRows / Math.max(1, validationResult.totalRows)) * 100).toFixed(1)}%)`);
    lines.push(`无效行数: ${validationResult.invalidRows}`);
    lines.push(`错误数: ${validationResult.errorCount}`);
    lines.push(`警告数: ${validationResult.warningCount}`);
    lines.push('');
    lines.push('-- 错误汇总 --');
    for (const [field, info] of Object.entries(validationResult.errorSummary)) {
      const codesStr = Object.entries(info.codes).map(([c, n]) => `${c}:${n}`).join(', ');
      lines.push(`  ${field}: ${info.count}次 (${codesStr})`);
    }
    lines.push('');
    lines.push('-- 字段覆盖率 Top10 最低 --');
    const coverageEntries = Object.entries(validationResult.fieldCoverage)
      .sort((a, b) => a[1].coverage - b[1].coverage)
      .slice(0, 10);
    for (const [field, info] of coverageEntries) {
      lines.push(`  ${info.schema?.label || field} (${field}): ${info.coverage}% (${info.filled}/${info.filled + info.empty})`);
    }
    if (validationResult.errors.length > 0) {
      lines.push('');
      lines.push(`-- 前20条错误明细 --`);
      validationResult.errors.slice(0, 20).forEach((e, idx) => {
        const loc = e.rowIndex !== undefined ? `第${e.rowIndex + 1}行` : '';
        const field = e.field ? `字段[${e.field}]` : (e.ruleName ? `规则[${e.ruleName}]` : '');
        const msg = e.code || '';
        const actual = e.actual ? `实际=${e.actual}` : '';
        const expected = e.expected ? `期望=${e.expected}` : '';
        lines.push(`  ${idx + 1}. ${loc} ${field} ${msg} ${actual} ${expected}`.trim());
      });
    }
    lines.push('='.repeat(60));
    return lines.join('\n');
  }
}

module.exports = {
  SchemaValidator,
  LOGIC_RULES
};
