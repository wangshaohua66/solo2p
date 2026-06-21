const { logger, verbose } = require('../utils/logger');
const { parseDate, formatDate, generateId } = require('../utils/common');

const STANDARD_FIELDS = {
  org_id: { label: '机构编码', type: 'string', required: true, pattern: '^[A-Za-z0-9]{2,20}$' },
  org_name: { label: '机构名称', type: 'string', required: true },
  org_type: { label: '机构类型', type: 'string', required: true, enum: ['micro_loan', 'financing_guarantee', 'pawnshop', 'equity_market', 'asset_management'] },
  unified_credit_code: { label: '统一社会信用代码', type: 'string', required: false, pattern: '^[0-9A-HJ-NPQRTUWXY]{18}$' },
  legal_representative: { label: '法定代表人', type: 'string', required: false },
  registered_address: { label: '注册地址', type: 'string', required: false },
  contact_person: { label: '联系人', type: 'string', required: false },
  contact_phone: { label: '联系电话', type: 'string', required: false, pattern: '^[0-9\\-+\\s]{7,20}$' },
  contact_email: { label: '联系邮箱', type: 'string', required: false, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  license_no: { label: '经营许可证编号', type: 'string', required: false },
  report_date: { label: '报告日期', type: 'date', required: true },
  business_date: { label: '业务日期', type: 'date', required: true },
  report_type: { label: '报表类型', type: 'string', required: false, enum: ['financial', 'business', 'risk', 'balance', 'income', 'cashflow'] },
  report_submitter: { label: '报送人', type: 'string', required: false },
  report_submitter_phone: { label: '报送人电话', type: 'string', required: false, pattern: '^[0-9\\-+\\s]{7,20}$' },
  submission_type: { label: '报送类型', type: 'string', required: false, enum: ['new', 'resubmit', 'supplement'] },

  total_assets: { label: '资产总额', type: 'number', required: true, min: 0 },
  current_assets: { label: '流动资产', type: 'number', required: false, min: 0 },
  non_current_assets: { label: '非流动资产', type: 'number', required: false, min: 0 },
  cash_and_equivalents: { label: '货币资金', type: 'number', required: false, min: 0 },
  accounts_receivable: { label: '应收账款', type: 'number', required: false, min: 0 },
  other_receivables: { label: '其他应收款', type: 'number', required: false, min: 0 },
  inventory: { label: '存货', type: 'number', required: false, min: 0 },
  fixed_assets: { label: '固定资产', type: 'number', required: false, min: 0 },
  intangible_assets: { label: '无形资产', type: 'number', required: false, min: 0 },
  total_liabilities: { label: '负债总额', type: 'number', required: true, min: 0 },
  current_liabilities: { label: '流动负债', type: 'number', required: false, min: 0 },
  non_current_liabilities: { label: '非流动负债', type: 'number', required: false, min: 0 },
  short_term_loans: { label: '短期借款', type: 'number', required: false, min: 0 },
  accounts_payable: { label: '应付账款', type: 'number', required: false, min: 0 },
  other_payables: { label: '其他应付款', type: 'number', required: false, min: 0 },
  long_term_loans: { label: '长期借款', type: 'number', required: false, min: 0 },
  net_assets: { label: '净资产', type: 'number', required: true },
  paid_in_capital: { label: '实收资本', type: 'number', required: false, min: 0 },
  capital_reserve: { label: '资本公积', type: 'number', required: false, min: 0 },
  surplus_reserve: { label: '盈余公积', type: 'number', required: false, min: 0 },
  undistributed_profit: { label: '未分配利润', type: 'number', required: false },
  registered_capital: { label: '注册资本', type: 'number', required: false, min: 0 },

  operating_income: { label: '营业收入', type: 'number', required: false },
  interest_income: { label: '利息收入', type: 'number', required: false },
  fee_income: { label: '手续费及佣金收入', type: 'number', required: false, min: 0 },
  investment_income: { label: '投资收益', type: 'number', required: false },
  operating_cost: { label: '营业成本', type: 'number', required: false },
  interest_expense: { label: '利息支出', type: 'number', required: false },
  fee_expense: { label: '手续费及佣金支出', type: 'number', required: false, min: 0 },
  operating_taxes: { label: '营业税金及附加', type: 'number', required: false, min: 0 },
  sales_expense: { label: '销售费用', type: 'number', required: false, min: 0 },
  management_expense: { label: '管理费用', type: 'number', required: false, min: 0 },
  financial_expense: { label: '财务费用', type: 'number', required: false },
  asset_impairment_loss: { label: '资产减值损失', type: 'number', required: false },
  operating_profit: { label: '营业利润', type: 'number', required: false },
  non_operating_income: { label: '营业外收入', type: 'number', required: false, min: 0 },
  non_operating_expense: { label: '营业外支出', type: 'number', required: false, min: 0 },
  profit_before_tax: { label: '利润总额', type: 'number', required: false },
  income_tax: { label: '所得税费用', type: 'number', required: false, min: 0 },
  net_profit: { label: '净利润', type: 'number', required: false },

  operating_cash_inflow: { label: '经营活动现金流入', type: 'number', required: false, min: 0 },
  operating_cash_outflow: { label: '经营活动现金流出', type: 'number', required: false, min: 0 },
  net_operating_cash_flow: { label: '经营活动现金净流量', type: 'number', required: false },
  investing_cash_inflow: { label: '投资活动现金流入', type: 'number', required: false, min: 0 },
  investing_cash_outflow: { label: '投资活动现金流出', type: 'number', required: false, min: 0 },
  financing_cash_inflow: { label: '筹资活动现金流入', type: 'number', required: false, min: 0 },
  financing_cash_outflow: { label: '筹资活动现金流出', type: 'number', required: false, min: 0 },
  net_financing_cash_flow: { label: '筹资活动现金净流量', type: 'number', required: false },
  ending_cash_balance: { label: '期末现金余额', type: 'number', required: false, min: 0 },

  loan_balance: { label: '贷款余额', type: 'number', required: false, min: 0 },
  loan_count: { label: '贷款笔数', type: 'integer', required: false, min: 0 },
  new_loan_amount: { label: '本期新发放贷款', type: 'number', required: false, min: 0 },
  recovered_loan_amount: { label: '本期收回贷款', type: 'number', required: false, min: 0 },
  average_loan_balance: { label: '平均贷款余额', type: 'number', required: false, min: 0 },
  non_performing_loan: { label: '不良贷款余额', type: 'number', required: false, min: 0 },
  non_performing_rate: { label: '不良率', type: 'number', required: false, min: 0, max: 100 },
  overdue_amount: { label: '逾期金额', type: 'number', required: false, min: 0 },
  overdue_rate: { label: '逾期率', type: 'number', required: false, min: 0, max: 100 },
  provision_balance: { label: '拨备余额', type: 'number', required: false, min: 0 },
  provision_coverage: { label: '拨备覆盖率', type: 'number', required: false, min: 0 },
  provision_rate: { label: '拨贷比', type: 'number', required: false, min: 0, max: 100 },
  capital_adequacy_ratio: { label: '资本充足率', type: 'number', required: false, min: 0, max: 100 },
  liquidity_ratio: { label: '流动性比例', type: 'number', required: false, min: 0, max: 100 },
  leverage_ratio: { label: '杠杆率', type: 'number', required: false, min: 0, max: 100 },
  debt_to_asset_ratio: { label: '资产负债率', type: 'number', required: false, min: 0, max: 100 },
  current_ratio: { label: '流动比率', type: 'number', required: false, min: 0 },
  return_on_assets: { label: '资产收益率', type: 'number', required: false, min: 0, max: 100 },
  return_on_equity: { label: '净资产收益率', type: 'number', required: false, min: 0, max: 100 },
  risk_level: { label: '风险等级', type: 'string', required: false, enum: ['A', 'B', 'C', 'D', '低', '中', '高', '极高'] },
  risk_warning: { label: '风险预警标志', type: 'boolean', required: false },

  guarantee_balance: { label: '担保余额', type: 'number', required: false, min: 0 },
  guarantee_count: { label: '担保笔数', type: 'integer', required: false, min: 0 },
  new_guarantee_amount: { label: '本期新增担保', type: 'number', required: false, min: 0 },
  released_guarantee_amount: { label: '本期解除担保', type: 'number', required: false, min: 0 },
  guarantee_compensation_amount: { label: '代偿金额', type: 'number', required: false, min: 0 },
  guarantee_compensation_count: { label: '代偿笔数', type: 'integer', required: false, min: 0 },
  guarantee_loss_amount: { label: '担保损失金额', type: 'number', required: false, min: 0 },
  guarantee_non_performing_rate: { label: '担保不良率', type: 'number', required: false, min: 0, max: 100 },

  pawn_total: { label: '典当总额', type: 'number', required: false, min: 0 },
  pawn_count: { label: '典当笔数', type: 'integer', required: false, min: 0 },
  pawn_balance: { label: '典当余额', type: 'number', required: false, min: 0 },
  new_pawn_amount: { label: '本期新增典当', type: 'number', required: false, min: 0 },
  redeemed_pawn_amount: { label: '本期赎当金额', type: 'number', required: false, min: 0 },
  forfeited_pawn_amount: { label: '绝当金额', type: 'number', required: false, min: 0 },
  pawn_interest_income: { label: '典当利息收入', type: 'number', required: false, min: 0 },
  pawn_commission_income: { label: '典当综合费收入', type: 'number', required: false, min: 0 },

  equity_transaction_amount: { label: '股权交易金额', type: 'number', required: false, min: 0 },
  equity_transaction_count: { label: '股权交易笔数', type: 'integer', required: false, min: 0 },
  equity_listing_count: { label: '挂牌企业数', type: 'integer', required: false, min: 0 },
  equity_financing_amount: { label: '股权融资额', type: 'number', required: false, min: 0 },

  managed_asset_scale: { label: '资产管理规模', type: 'number', required: false, min: 0 },
  managed_asset_count: { label: '管理资产项目数', type: 'integer', required: false, min: 0 },
  acquired_non_performing_amount: { label: '收购不良资产金额', type: 'number', required: false, min: 0 },
  disposed_non_performing_count: { label: '处置不良资产笔数', type: 'integer', required: false, min: 0 },
  disposed_non_performing_amount: { label: '处置不良资产金额', type: 'number', required: false, min: 0 },
  recovery_rate: { label: '回收率', type: 'number', required: false, min: 0, max: 100 },

  customer_count: { label: '客户数', type: 'integer', required: false, min: 0 },
  employee_count: { label: '员工数', type: 'integer', required: false, min: 0 },
  risk_management_staff_count: { label: '风控人员数', type: 'integer', required: false, min: 0 },
  complaint_count: { label: '投诉件数', type: 'integer', required: false, min: 0 },
  resolved_complaint_count: { label: '已处理投诉件数', type: 'integer', required: false, min: 0 },
  penalty_count: { label: '行政处罚次数', type: 'integer', required: false, min: 0 },
  major_risk_event_count: { label: '重大风险事件数', type: 'integer', required: false, min: 0 },
  remark: { label: '备注', type: 'string', required: false }
};

const ORG_FIELD_MAPPINGS = {
  ML001: {
    '机构编号': 'org_id',
    '机构名称': 'org_name',
    '报表日期': 'report_date',
    '业务日期': 'business_date',
    '资产合计': 'total_assets',
    '负债合计': 'total_liabilities',
    '所有者权益': 'net_assets',
    '营业收入': 'operating_income',
    '净利润': 'net_profit',
    '贷款余额': 'loan_balance',
    '贷款笔数': 'loan_count',
    '不良贷款': 'non_performing_loan',
    '不良率(%)': 'non_performing_rate',
    '客户数量': 'customer_count',
    '注册资本': 'registered_capital'
  },
  ML002: {
    orgCode: 'org_id',
    orgName: 'org_name',
    reportDate: 'report_date',
    businessDate: 'business_date',
    totalAssets: 'total_assets',
    totalLiab: 'total_liabilities',
    netAssets: 'net_assets',
    revenue: 'operating_income',
    profit: 'net_profit',
    loanBal: 'loan_balance',
    loanNum: 'loan_count',
    nplBal: 'non_performing_loan',
    nplRate: 'non_performing_rate',
    custCnt: 'customer_count'
  },
  FG001: {
    '公司编码': 'org_id',
    '公司名称': 'org_name',
    '报告期': 'report_date',
    '资产总计': 'total_assets',
    '负债总计': 'total_liabilities',
    '净资产': 'net_assets',
    '担保余额(万元)': 'guarantee_balance',
    '担保笔数': 'guarantee_count',
    '拨备余额': 'provision_balance',
    '拨备覆盖率(%)': 'provision_coverage'
  },
  PS001: {
    '典当行编号': 'org_id',
    '典当行名称': 'org_name',
    '报送日期': 'report_date',
    '典当总额(元)': 'pawn_total',
    '典当笔数': 'pawn_count',
    '资产总额': 'total_assets',
    '负债总额': 'total_liabilities',
    '注册资本(万元)': 'registered_capital'
  },
  EM001: {
    marketId: 'org_id',
    marketName: 'org_name',
    tradingDate: 'business_date',
    reportDate: 'report_date',
    tradeAmount: 'equity_transaction_amount',
    tradeCount: 'equity_transaction_count',
    totalAssets: 'total_assets'
  },
  AM001: {
    '公司代码': 'org_id',
    '公司全称': 'org_name',
    '统计日期': 'report_date',
    '管理规模(亿元)': 'managed_asset_scale',
    '资产总额': 'total_assets',
    '负债总额': 'total_liabilities',
    '实收资本': 'paid_in_capital',
    '员工总数': 'employee_count'
  }
};

const FUZZY_MAPPING_RULES = [
  { pattern: /机构(编码|编号|代码|ID)/i, target: 'org_id' },
  { pattern: /机构(名称|全称|名字)/i, target: 'org_name' },
  { pattern: /(报告|报表|统计|报送|交易)日?期/i, target: 'report_date' },
  { pattern: /业务日?期/i, target: 'business_date' },
  { pattern: /资产(总额|总计|合计)?/i, target: 'total_assets' },
  { pattern: /负债(总额|总计|合计)?/i, target: 'total_liabilities' },
  { pattern: /(净?资产|所有者权益)/i, target: 'net_assets' },
  { pattern: /营业?收入|营收/i, target: 'operating_income' },
  { pattern: /(净)?利润/i, target: 'net_profit' },
  { pattern: /贷款(余额|金额|规模)/i, target: 'loan_balance' },
  { pattern: /贷款笔?数/i, target: 'loan_count' },
  { pattern: /(不良|逾期)贷款(余额|金额)?/i, target: 'non_performing_loan' },
  { pattern: /(不良|逾期)率/i, target: 'non_performing_rate' },
  { pattern: /担保(余额|金额|规模)/i, target: 'guarantee_balance' },
  { pattern: /担保笔?数/i, target: 'guarantee_count' },
  { pattern: /(典当|质押)(总额|金额|余额|规模)/i, target: 'pawn_total' },
  { pattern: /典当笔?数/i, target: 'pawn_count' },
  { pattern: /股权(交易|转让)(金额|总额)/i, target: 'equity_transaction_amount' },
  { pattern: /股权(交易|转让)笔?数/i, target: 'equity_transaction_count' },
  { pattern: /(资产管理|管理)规模/i, target: 'managed_asset_scale' },
  { pattern: /客户(数|数量|总数)/i, target: 'customer_count' },
  { pattern: /员工(数|人数|数量|总数)/i, target: 'employee_count' },
  { pattern: /注册(资本|资金)/i, target: 'registered_capital' },
  { pattern: /实收(资本|资金)/i, target: 'paid_in_capital' },
  { pattern: /逾期(金额|余额|总额)/i, target: 'overdue_amount' },
  { pattern: /拨备覆盖?率/i, target: 'provision_coverage' },
  { pattern: /拨备(余额|金额)/i, target: 'provision_balance' },
  { pattern: /资本充足率/i, target: 'capital_adequacy_ratio' },
  { pattern: /流动性比例/i, target: 'liquidity_ratio' },
  { pattern: /风险(等级|级别)/i, target: 'risk_level' }
];

class FieldMapper {
  constructor(orgId) {
    this.orgId = orgId;
    this.mappings = ORG_FIELD_MAPPINGS[orgId] || {};
    this.fuzzyCache = {};
    this.unmappedFields = new Set();
  }

  _normalizeFieldName(name) {
    if (!name) return '';
    return String(name).trim().replace(/[\s_\-/()（）]+/g, '').toLowerCase();
  }

  _exactMap(fieldName) {
    if (this.mappings[fieldName]) return this.mappings[fieldName];
    if (STANDARD_FIELDS[fieldName]) return fieldName;
    const normalized = this._normalizeFieldName(fieldName);
    for (const key of Object.keys(this.mappings)) {
      if (this._normalizeFieldName(key) === normalized) {
        return this.mappings[key];
      }
    }
    for (const stdField of Object.keys(STANDARD_FIELDS)) {
      if (this._normalizeFieldName(stdField) === normalized) {
        return stdField;
      }
    }
    return null;
  }

  _fuzzyMap(fieldName) {
    if (this.fuzzyCache[fieldName]) return this.fuzzyCache[fieldName];
    for (const rule of FUZZY_MAPPING_RULES) {
      if (rule.pattern.test(fieldName)) {
        this.fuzzyCache[fieldName] = rule.target;
        return rule.target;
      }
    }
    this.unmappedFields.add(fieldName);
    this.fuzzyCache[fieldName] = null;
    return null;
  }

  _mapField(fieldName) {
    const exact = this._exactMap(fieldName);
    if (exact) return exact;
    return this._fuzzyMap(fieldName);
  }

  _convertType(value, targetField) {
    const schema = STANDARD_FIELDS[targetField];
    if (!schema || value === null || value === undefined || value === '') return value;
    try {
      switch (schema.type) {
        case 'string':
          return String(value).trim();
        case 'number': {
          if (typeof value === 'number') return value;
          const cleaned = String(value)
            .replace(/[,，]/g, '')
            .replace(/[万万元元亿亿]/g, (match) => {
              if (match === '万' || match === '万元') return '*10000';
              if (match === '亿' || match === '亿元') return '*100000000';
              return '';
            });
          if (cleaned.includes('*')) {
            const parts = cleaned.split('*');
            return parseFloat(parts[0]) * parseFloat(parts[1]);
          }
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }
        case 'integer': {
          if (typeof value === 'number') return Math.floor(value);
          const num = parseInt(String(value).replace(/[,，]/g, ''), 10);
          return isNaN(num) ? null : num;
        }
        case 'date':
          return formatDate(value, 'YYYY-MM-DD');
        case 'boolean':
          if (typeof value === 'boolean') return value;
          return ['是', 'true', '1', 'yes', 'Y'].includes(String(value).toLowerCase());
        case 'enum':
          if (schema.enum && !schema.enum.includes(value)) {
            return null;
          }
          return value;
        default:
          return value;
      }
    } catch (e) {
      logger.warn(`字段[${targetField}]类型转换失败: ${value}, ${e.message}`);
      return null;
    }
  }

  transform(records, context = {}) {
    const startTime = Date.now();
    const mappedRecords = [];
    let transformedCount = 0;

    for (const record of records) {
      const mapped = {
        _rowId: record._rowId || generateId(),
        _sourceRow: { ...record },
        org_id: this.orgId,
        org_name: context.orgName || '',
        report_date: context.reportDate || formatDate(new Date(), 'YYYY-MM-DD'),
        business_date: context.businessDate || formatDate(new Date(), 'YYYY-MM-DD')
      };
      for (const [sourceField, value] of Object.entries(record)) {
        if (sourceField.startsWith('_')) continue;
        const targetField = this._mapField(sourceField);
        if (targetField && STANDARD_FIELDS[targetField]) {
          mapped[targetField] = this._convertType(value, targetField);
          transformedCount++;
        } else if (targetField) {
          mapped[targetField] = value;
          transformedCount++;
        }
      }
      mappedRecords.push(mapped);
    }

    verbose(`[${this.orgId}] 字段映射完成: ${records.length}条记录, 转换${transformedCount}个字段值`);
    if (this.unmappedFields.size > 0) {
      logger.warn(`[${this.orgId}] 未映射字段(${this.unmappedFields.size}个): ${Array.from(this.unmappedFields).join(', ')}`);
    }
    return {
      success: true,
      orgId: this.orgId,
      recordCount: mappedRecords.length,
      records: mappedRecords,
      transformedFields: transformedCount,
      unmappedFields: Array.from(this.unmappedFields),
      transformDurationMs: Date.now() - startTime,
      standardFields: Object.keys(STANDARD_FIELDS)
    };
  }

  static getStandardFields() {
    return { ...STANDARD_FIELDS };
  }

  static getOrgMappings(orgId) {
    return ORG_FIELD_MAPPINGS[orgId] || {};
  }
}

module.exports = {
  FieldMapper,
  STANDARD_FIELDS,
  ORG_FIELD_MAPPINGS,
  FUZZY_MAPPING_RULES
};
