import * as dotenv from 'dotenv';
import { InsuranceCompany, ProductType, RiskLevel } from '../utils/types';

dotenv.config();

export const COMPANY_IDS = {
  PICC: 'picc',
  PINGAN: 'pingan',
  CPIC: 'cpic',
  CHINALIFE: 'chinalife',
  TAIKANG: 'taikang',
  NEWCHINA: 'newchina',
  SINOYANG: 'sinoyang',
  CHINAACI: 'chinaaci',
} as const;

export const COMPANY_NAMES: Record<string, string> = {
  [COMPANY_IDS.PICC]: '中国人民保险',
  [COMPANY_IDS.PINGAN]: '中国平安保险',
  [COMPANY_IDS.CPIC]: '中国太平洋保险',
  [COMPANY_IDS.CHINALIFE]: '中国人寿保险',
  [COMPANY_IDS.TAIKANG]: '泰康保险',
  [COMPANY_IDS.NEWCHINA]: '新华保险',
  [COMPANY_IDS.SINOYANG]: '阳光保险',
  [COMPANY_IDS.CHINAACI]: '中华联合保险',
};

export const PRODUCT_TYPES: Record<ProductType, string> = {
  'employer-liability': '雇主责任险',
  'group-accident': '团体意外险',
  'group-medical': '团体医疗险',
  'group-critical-illness': '团体重疾险',
};

export const RISK_LEVELS: Record<RiskLevel, string> = {
  'low': '低风险',
  'medium': '中风险',
  'high': '高风险',
  'very-high': '极高风险',
};

export const INDUSTRY_CATEGORIES = [
  '制造业',
  '建筑业',
  '服务业',
  'IT互联网',
  '金融保险',
  '教育培训',
  '医疗健康',
  '物流运输',
  '餐饮酒店',
  '零售批发',
  '其他',
];

const piccProfile: InsuranceCompany = {
  id: COMPANY_IDS.PICC,
  name: COMPANY_NAMES[COMPANY_IDS.PICC],
  shortName: '人保',
  loginUrl: process.env.PICC_LOGIN_URL || 'https://ebiz.picc.com/',
  username: process.env.PICC_USERNAME || '',
  password: process.env.PICC_PASSWORD || '',
  selectors: {
    usernameInput: '#username',
    passwordInput: '#password',
    captchaInput: '#captcha',
    captchaImage: '#captchaImg',
    loginButton: '#loginBtn',
    logoutButton: '#logoutBtn',
    sessionExpiredPatterns: ['登录已超时', '请重新登录', 'session expired'],
    quoteForm: {
      industrySelect: '#industry',
      employeeCountInput: '#employeeCount',
      riskLevelSelect: '#riskLevel',
      coverageAmountInput: '#coverageAmount',
      deductibleInput: '#deductible',
      productTypeSelect: '#productType',
      submitButton: '#calculateBtn',
    },
    quoteResult: {
      premiumAmount: '.premium-amount',
      coverageDetails: '.coverage-details',
      deductibleInfo: '.deductible-info',
      specialClauses: '.special-clauses',
      loadingSpinner: '.loading-spinner',
      resultContainer: '.quote-result',
    },
    policyList: {
      listContainer: '.policy-list',
      policyItem: '.policy-item',
      policyNumber: '.policy-number',
      policyStatus: '.policy-status',
      expireDate: '.expire-date',
      nextPageButton: '.next-page',
    },
    policyDetail: {
      policyNumber: '.policy-number',
      insuredCompany: '.insured-company',
      coverageAmount: '.coverage-amount',
      premium: '.premium',
      startDate: '.start-date',
      endDate: '.end-date',
      coverageType: '.coverage-type',
    },
  },
  features: {
    supportsCaptcha: true,
    captchaType: 'image',
    supportsAjax: true,
    ajaxWaitTime: 3000,
    sessionTimeout: 1800,
  },
};

const pinganProfile: InsuranceCompany = {
  id: COMPANY_IDS.PINGAN,
  name: COMPANY_NAMES[COMPANY_IDS.PINGAN],
  shortName: '平安',
  loginUrl: process.env.PINGAN_LOGIN_URL || 'https://insurance.pingan.com/',
  username: process.env.PINGAN_USERNAME || '',
  password: process.env.PINGAN_PASSWORD || '',
  selectors: {
    usernameInput: 'input[name="username"]',
    passwordInput: 'input[name="password"]',
    captchaInput: 'input[name="captcha"]',
    captchaImage: '.captcha-img',
    loginButton: '.login-btn',
    logoutButton: '.logout-btn',
    sessionExpiredPatterns: ['登录失效', '会话已过期', '请重新登录'],
    quoteForm: {
      industrySelect: '.industry-select',
      employeeCountInput: '.employee-count',
      riskLevelSelect: '.risk-level',
      coverageAmountInput: '.coverage-amount',
      deductibleInput: '.deductible-input',
      productTypeSelect: '.product-type',
      submitButton: '.submit-quote',
    },
    quoteResult: {
      premiumAmount: '.premium-value',
      coverageDetails: '.coverage-list',
      deductibleInfo: '.deductible-value',
      specialClauses: '.clause-list',
      loadingSpinner: '.ant-spin',
      resultContainer: '.quote-container',
    },
    policyList: {
      listContainer: '.policy-table',
      policyItem: '.policy-row',
      policyNumber: '.policy-no',
      policyStatus: '.status-tag',
      expireDate: '.expire-time',
      nextPageButton: '.ant-pagination-next',
    },
    policyDetail: {
      policyNumber: '.policy-id',
      insuredCompany: '.company-name',
      coverageAmount: '.amount-value',
      premium: '.price-value',
      startDate: '.start-time',
      endDate: '.end-time',
      coverageType: '.product-name',
    },
  },
  features: {
    supportsCaptcha: true,
    captchaType: 'slider',
    supportsAjax: true,
    ajaxWaitTime: 2500,
    sessionTimeout: 2400,
  },
};

const cpicProfile: InsuranceCompany = {
  id: COMPANY_IDS.CPIC,
  name: COMPANY_NAMES[COMPANY_IDS.CPIC],
  shortName: '太保',
  loginUrl: process.env.CPIC_LOGIN_URL || 'https://www.cpic.com.cn/',
  username: process.env.CPIC_USERNAME || '',
  password: process.env.CPIC_PASSWORD || '',
  selectors: {
    usernameInput: '#userName',
    passwordInput: '#passWord',
    loginButton: '#loginButton',
    sessionExpiredPatterns: ['登录超时', '请重新登录', 'token 失效'],
    quoteForm: {
      industrySelect: '#industryType',
      employeeCountInput: '#staffNum',
      riskLevelSelect: '#riskGrade',
      coverageAmountInput: '#amount',
      deductibleInput: '#deductibleAmt',
      productTypeSelect: '#productCategory',
      submitButton: '#quoteSubmit',
    },
    quoteResult: {
      premiumAmount: '.totalPremium',
      coverageDetails: '.safeguardContent',
      deductibleInfo: '.deductibleAmount',
      specialClauses: '.specialTerms',
      loadingSpinner: '.cpic-loading',
      resultContainer: '.quoteResult',
    },
    policyList: {
      listContainer: '.policyList',
      policyItem: '.policyItem',
      policyNumber: '.policyCode',
      policyStatus: '.policyState',
      expireDate: '.endDate',
      nextPageButton: '.nextPageBtn',
    },
    policyDetail: {
      policyNumber: '.policyNo',
      insuredCompany: '.applicantName',
      coverageAmount: '.sumInsured',
      premium: '.totalFee',
      startDate: '.effectiveDate',
      endDate: '.expiryDate',
      coverageType: '.productName',
    },
  },
  features: {
    supportsCaptcha: false,
    captchaType: 'none',
    supportsAjax: true,
    ajaxWaitTime: 4000,
    sessionTimeout: 1500,
  },
};

const chinalifeProfile: InsuranceCompany = {
  id: COMPANY_IDS.CHINALIFE,
  name: COMPANY_NAMES[COMPANY_IDS.CHINALIFE],
  shortName: '国寿',
  loginUrl: process.env.CHINALIFE_LOGIN_URL || 'https://www.e-chinalife.com/',
  username: process.env.CHINALIFE_USERNAME || '',
  password: process.env.CHINALIFE_PASSWORD || '',
  selectors: {
    usernameInput: '.login-username',
    passwordInput: '.login-password',
    captchaInput: '.verify-code-input',
    captchaImage: '.verify-code-img',
    loginButton: '.login-submit',
    sessionExpiredPatterns: ['请重新登录', '登录已过期', 'session timeout'],
    quoteForm: {
      industrySelect: '.industry-dropdown',
      employeeCountInput: '.people-number',
      riskLevelSelect: '.risk-select',
      coverageAmountInput: '.amount-input',
      deductibleInput: '.deductible-select',
      productTypeSelect: '.product-select',
      submitButton: '.calculate-btn',
    },
    quoteResult: {
      premiumAmount: '.price-num',
      coverageDetails: '.protect-items',
      deductibleInfo: '.deductible-num',
      specialClauses: '.special-items',
      loadingSpinner: '.loading-icon',
      resultContainer: '.result-box',
    },
    policyList: {
      listContainer: '.policy-list-box',
      policyItem: '.policy-item-row',
      policyNumber: '.policy-id-text',
      policyStatus: '.status-text',
      expireDate: '.end-date-text',
      nextPageButton: '.page-next',
    },
    policyDetail: {
      policyNumber: '.policy-code',
      insuredCompany: '.customer-name',
      coverageAmount: '.insurance-amount',
      premium: '.premium-amount',
      startDate: '.begin-date',
      endDate: '.finish-date',
      coverageType: '.product-type',
    },
  },
  features: {
    supportsCaptcha: true,
    captchaType: 'image',
    supportsAjax: false,
    ajaxWaitTime: 0,
    sessionTimeout: 2000,
  },
};

const taikangProfile: InsuranceCompany = {
  id: COMPANY_IDS.TAIKANG,
  name: COMPANY_NAMES[COMPANY_IDS.TAIKANG],
  shortName: '泰康',
  loginUrl: process.env.TAIKANG_LOGIN_URL || 'https://www.taikang.com/',
  username: process.env.TAIKANG_USERNAME || '',
  password: process.env.TAIKANG_PASSWORD || '',
  selectors: {
    usernameInput: '#account',
    passwordInput: '#password',
    loginButton: '#submitLogin',
    sessionExpiredPatterns: ['登录超时', '请重新登录', 'session expired'],
    quoteForm: {
      industrySelect: '#tradeType',
      employeeCountInput: '#empCount',
      riskLevelSelect: '#riskLevel',
      coverageAmountInput: '#insureAmount',
      deductibleInput: '#deductibleAmt',
      productTypeSelect: '#prodType',
      submitButton: '#getQuote',
    },
    quoteResult: {
      premiumAmount: '.tk-premium',
      coverageDetails: '.tk-coverage-list',
      deductibleInfo: '.tk-deductible',
      specialClauses: '.tk-clauses',
      loadingSpinner: '.tk-loading',
      resultContainer: '.tk-quote-box',
    },
    policyList: {
      listContainer: '.tk-policy-list',
      policyItem: '.tk-policy-row',
      policyNumber: '.tk-policy-no',
      policyStatus: '.tk-status',
      expireDate: '.tk-expire',
      nextPageButton: '.tk-next-page',
    },
    policyDetail: {
      policyNumber: '.tk-policy-id',
      insuredCompany: '.tk-company',
      coverageAmount: '.tk-amount',
      premium: '.tk-price',
      startDate: '.tk-start',
      endDate: '.tk-end',
      coverageType: '.tk-product',
    },
  },
  features: {
    supportsCaptcha: false,
    captchaType: 'none',
    supportsAjax: true,
    ajaxWaitTime: 3500,
    sessionTimeout: 1800,
  },
};

const newchinaProfile: InsuranceCompany = {
  id: COMPANY_IDS.NEWCHINA,
  name: COMPANY_NAMES[COMPANY_IDS.NEWCHINA],
  shortName: '新华',
  loginUrl: process.env.NEWCHINA_LOGIN_URL || 'https://www.newchinalife.com/',
  username: process.env.NEWCHINA_USERNAME || '',
  password: process.env.NEWCHINA_PASSWORD || '',
  selectors: {
    usernameInput: '.user-name',
    passwordInput: '.pass-word',
    captchaInput: '.captcha-code',
    captchaImage: '.captcha-pic',
    loginButton: '.login-button',
    sessionExpiredPatterns: ['会话失效', '请重新登录', '登录超时'],
    quoteForm: {
      industrySelect: '.industry-type',
      employeeCountInput: '.staff-count',
      riskLevelSelect: '.risk-grade',
      coverageAmountInput: '.coverage-money',
      deductibleInput: '.deductible-money',
      productTypeSelect: '.product-kind',
      submitButton: '.quote-button',
    },
    quoteResult: {
      premiumAmount: '.premium-num',
      coverageDetails: '.coverage-content',
      deductibleInfo: '.deductible-amount',
      specialClauses: '.clause-content',
      loadingSpinner: '.xinhua-loading',
      resultContainer: '.quote-content',
    },
    policyList: {
      listContainer: '.policy-list-wrap',
      policyItem: '.policy-list-item',
      policyNumber: '.policy-num',
      policyStatus: '.policy-state',
      expireDate: '.expire-time',
      nextPageButton: '.page-turn-next',
    },
    policyDetail: {
      policyNumber: '.policy-id',
      insuredCompany: '.insured-name',
      coverageAmount: '.coverage-sum',
      premium: '.policy-premium',
      startDate: '.effect-date',
      endDate: '.maturity-date',
      coverageType: '.product-class',
    },
  },
  features: {
    supportsCaptcha: true,
    captchaType: 'image',
    supportsAjax: true,
    ajaxWaitTime: 2000,
    sessionTimeout: 2200,
  },
};

const sinoyangProfile: InsuranceCompany = {
  id: COMPANY_IDS.SINOYANG,
  name: COMPANY_NAMES[COMPANY_IDS.SINOYANG],
  shortName: '阳光',
  loginUrl: process.env.SINOYANG_LOGIN_URL || 'https://www.sinosig.com/',
  username: process.env.SINOYANG_USERNAME || '',
  password: process.env.SINOYANG_PASSWORD || '',
  selectors: {
    usernameInput: '#loginName',
    passwordInput: '#loginPwd',
    loginButton: '#loginBtn',
    sessionExpiredPatterns: ['登录已过期', '请重新登录', 'session timeout'],
    quoteForm: {
      industrySelect: '#industryCategory',
      employeeCountInput: '#personNumber',
      riskLevelSelect: '#riskLevel',
      coverageAmountInput: '#insuranceAmount',
      deductibleInput: '#deductibleAmount',
      productTypeSelect: '#productType',
      submitButton: '#calculatePremium',
    },
    quoteResult: {
      premiumAmount: '.yg-premium',
      coverageDetails: '.yg-coverage',
      deductibleInfo: '.yg-deductible',
      specialClauses: '.yg-clauses',
      loadingSpinner: '.yg-spinner',
      resultContainer: '.yg-result',
    },
    policyList: {
      listContainer: '.yg-policy-table',
      policyItem: '.yg-policy-tr',
      policyNumber: '.yg-policy-code',
      policyStatus: '.yg-policy-state',
      expireDate: '.yg-end-date',
      nextPageButton: '.yg-page-next',
    },
    policyDetail: {
      policyNumber: '.yg-policy-id',
      insuredCompany: '.yg-customer',
      coverageAmount: '.yg-insured-amount',
      premium: '.yg-total-premium',
      startDate: '.yg-start-date',
      endDate: '.yg-expiry-date',
      coverageType: '.yg-product-name',
    },
  },
  features: {
    supportsCaptcha: false,
    captchaType: 'none',
    supportsAjax: false,
    ajaxWaitTime: 0,
    sessionTimeout: 1600,
  },
};

const chinaaciProfile: InsuranceCompany = {
  id: COMPANY_IDS.CHINAACI,
  name: COMPANY_NAMES[COMPANY_IDS.CHINAACI],
  shortName: '中华',
  loginUrl: process.env.CHINAACI_LOGIN_URL || 'https://www.china-insurance.com/',
  username: process.env.CHINAACI_USERNAME || '',
  password: process.env.CHINAACI_PASSWORD || '',
  selectors: {
    usernameInput: '.username-input',
    passwordInput: '.password-input',
    captchaInput: '.verification-input',
    captchaImage: '.verification-img',
    loginButton: '.submit-btn',
    sessionExpiredPatterns: ['登录失效', '请重新登录', '会话已过期'],
    quoteForm: {
      industrySelect: '.industry-selector',
      employeeCountInput: '.employee-input',
      riskLevelSelect: '.risk-selector',
      coverageAmountInput: '.amount-input-box',
      deductibleInput: '.deductible-input-box',
      productTypeSelect: '.product-selector',
      submitButton: '.query-btn',
    },
    quoteResult: {
      premiumAmount: '.price-text',
      coverageDetails: '.protection-list',
      deductibleInfo: '.deductible-text',
      specialClauses: '.special-provisions',
      loadingSpinner: '.zh-loading',
      resultContainer: '.quote-info',
    },
    policyList: {
      listContainer: '.policy-table-wrap',
      policyItem: '.policy-row-item',
      policyNumber: '.policy-number-text',
      policyStatus: '.policy-status-tag',
      expireDate: '.expiry-date-text',
      nextPageButton: '.next-page-btn',
    },
    policyDetail: {
      policyNumber: '.policy-no-text',
      insuredCompany: '.company-name-text',
      coverageAmount: '.insurance-amount-text',
      premium: '.premium-amount-text',
      startDate: '.start-date-text',
      endDate: '.end-date-text',
      coverageType: '.insurance-type-text',
    },
  },
  features: {
    supportsCaptcha: true,
    captchaType: 'slider',
    supportsAjax: true,
    ajaxWaitTime: 3000,
    sessionTimeout: 1700,
  },
};

export const insuranceCompanies: InsuranceCompany[] = [
  piccProfile,
  pinganProfile,
  cpicProfile,
  chinalifeProfile,
  taikangProfile,
  newchinaProfile,
  sinoyangProfile,
  chinaaciProfile,
];

export function getCompanyById(id: string): InsuranceCompany | undefined {
  return insuranceCompanies.find(c => c.id === id);
}

export function getCompanyByName(name: string): InsuranceCompany | undefined {
  return insuranceCompanies.find(c => c.name === name || c.shortName === name);
}

export function getAllCompanyIds(): string[] {
  return insuranceCompanies.map(c => c.id);
}

export const SCORING_WEIGHTS = {
  premium: 0.4,
  coverage: 0.3,
  deductible: 0.2,
  clauses: 0.1,
};

export const RISK_PREMIUM_ADJUSTMENT = {
  'low': 1.0,
  'medium': 1.0,
  'high': 1.1,
  'very-high': 1.2,
};
