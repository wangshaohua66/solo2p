const path = require('path');

const ORG_TYPES = {
  MICRO_LOAN: 'micro_loan',
  FINANCING_GUARANTEE: 'financing_guarantee',
  PAWNSHOP: 'pawnshop',
  EQUITY_MARKET: 'equity_market',
  ASSET_MANAGEMENT: 'asset_management'
};

const organizations = [
  {
    id: 'ML001',
    name: 'XX小额贷款有限公司',
    type: ORG_TYPES.MICRO_LOAN,
    collectionMethod: 'email',
    cron: '0 30 8 * * 1-5',
    timeWindow: { start: '08:00', end: '18:00' },
    priority: 1,
    emailConfig: {
      host: 'imap.exmail.qq.com',
      port: 993,
      secure: true,
      user: 'report@ml001.com',
      password: process.env.ML001_EMAIL_PWD || '',
      backupHost: 'imap2.exmail.qq.com',
      subjectKeywords: ['报送', '报表', 'report', '数据']
    }
  },
  {
    id: 'ML002',
    name: 'YY小额贷款股份有限公司',
    type: ORG_TYPES.MICRO_LOAN,
    collectionMethod: 'api',
    cron: '0 0 9 * * 1-5',
    timeWindow: { start: '09:00', end: '17:00' },
    priority: 1,
    apiConfig: {
      baseUrl: 'https://api.ml002.com/report',
      authType: 'token',
      token: process.env.ML002_API_TOKEN || '',
      endpoints: {
        financial: '/financial',
        business: '/business',
        risk: '/risk'
      },
      rateLimit: 100,
      pagination: { enabled: true, pageSize: 1000 }
    }
  },
  {
    id: 'FG001',
    name: 'ZZ融资担保有限公司',
    type: ORG_TYPES.FINANCING_GUARANTEE,
    collectionMethod: 'email',
    cron: '0 15 8 * * 1-5',
    timeWindow: { start: '08:00', end: '18:00' },
    priority: 2,
    emailConfig: {
      host: 'imap.qiye.aliyun.com',
      port: 993,
      secure: true,
      user: 'report@fg001.com',
      password: process.env.FG001_EMAIL_PWD || '',
      backupHost: 'imap2.qiye.aliyun.com',
      subjectKeywords: ['报送', '担保', 'guarantee']
    }
  },
  {
    id: 'FG002',
    name: 'AA融资担保股份公司',
    type: ORG_TYPES.FINANCING_GUARANTEE,
    collectionMethod: 'api',
    cron: '0 30 9 * * 1-5',
    timeWindow: { start: '09:00', end: '17:00' },
    priority: 2,
    apiConfig: {
      baseUrl: 'https://internal.fg002.cn/api',
      authType: 'signature',
      appKey: process.env.FG002_APP_KEY || '',
      appSecret: process.env.FG002_APP_SECRET || '',
      endpoints: {
        financial: '/v1/report/financial',
        business: '/v1/report/business',
        risk: '/v1/report/risk'
      },
      rateLimit: 50,
      pagination: { enabled: true, pageSize: 500 }
    }
  },
  {
    id: 'PS001',
    name: 'BB典当行有限公司',
    type: ORG_TYPES.PAWNSHOP,
    collectionMethod: 'email',
    cron: '0 0 10 * * 1-5',
    timeWindow: { start: '10:00', end: '16:00' },
    priority: 3,
    emailConfig: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      user: 'report@ps001.com',
      password: process.env.PS001_EMAIL_PWD || '',
      backupHost: null,
      subjectKeywords: ['典当', '报送', 'pawn']
    }
  },
  {
    id: 'EM001',
    name: 'CC区域性股权交易中心',
    type: ORG_TYPES.EQUITY_MARKET,
    collectionMethod: 'api',
    cron: '0 0 8 * * 1',
    timeWindow: { start: '08:00', end: '20:00' },
    priority: 1,
    apiConfig: {
      baseUrl: 'https://api.em001.com/v2',
      authType: 'token',
      token: process.env.EM001_API_TOKEN || '',
      endpoints: {
        financial: '/reports/financial',
        business: '/reports/business',
        risk: '/reports/risk'
      },
      rateLimit: 200,
      pagination: { enabled: true, pageSize: 2000 }
    }
  },
  {
    id: 'AM001',
    name: 'DD资产管理有限公司',
    type: ORG_TYPES.ASSET_MANAGEMENT,
    collectionMethod: 'email',
    cron: '0 45 8 * * 1-5',
    timeWindow: { start: '08:00', end: '18:00' },
    priority: 2,
    emailConfig: {
      host: 'imap.exmail.qq.com',
      port: 993,
      secure: true,
      user: 'report@am001.com',
      password: process.env.AM001_EMAIL_PWD || '',
      backupHost: 'imap2.exmail.qq.com',
      subjectKeywords: ['资产', '报送', 'AMC', 'report']
    }
  }
];

const holidayConfig = {
  autoPostpone: true,
  holidays: [
    '2026-01-01',
    '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
    '2026-04-04', '2026-04-05', '2026-04-06',
    '2026-05-01', '2026-05-02', '2026-05-03',
    '2026-06-19', '2026-06-20', '2026-06-21',
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'
  ]
};

const performanceConfig = {
  maxConcurrentApiRequests: 10,
  maxFilesPerCollection: 200,
  maxFileSizeMB: 50,
  maxExcelRowsPerSheet: 100000,
  maxMemoryUsageMB: 1024,
  maxRecordTransformMs: 50,
  taskTimeoutMinutes: 30,
  retryStrategy: {
    maxRetries: 5,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    delays: [1000, 2000, 4000, 8000, 16000]
  }
};

const proxyConfig = {
  enabled: process.env.PROXY_ENABLED === 'true' || false,
  proxyList: (process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [
    'http://proxy1.local.gov.cn:8080',
    'http://proxy2.local.gov.cn:8080',
    'socks5://proxy3.local.gov.cn:1080'
  ]).map((s) => s.trim()).filter(Boolean),
  maxProxySwitches: 3,
  connectTimeoutMs: 10000,
  readTimeoutMs: 30000
};

const paths = {
  root: path.resolve(__dirname, '..'),
  data: {
    raw: path.resolve(__dirname, '..', 'data', 'raw'),
    processed: path.resolve(__dirname, '..', 'data', 'processed'),
    failed: path.resolve(__dirname, '..', 'data', 'failed')
  },
  logs: path.resolve(__dirname, '..', 'logs'),
  temp: path.resolve(__dirname, '..', 'data', 'temp')
};

const regulatorConfig = {
  baseUrl: process.env.REGULATOR_API_URL || 'https://regulator.local.gov.cn/api',
  authType: 'token',
  token: process.env.REGULATOR_API_TOKEN || '',
  endpoints: {
    pushFinancial: '/v1/collect/financial',
    pushBusiness: '/v1/collect/business',
    pushRisk: '/v1/collect/risk',
    acknowledge: '/v1/collect/ack',
    status: '/v1/collect/status'
  },
  timeout: 30000
};

const notificationConfig = {
  enabled: true,
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.exmail.qq.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    recipients: process.env.ALERT_RECIPIENTS ? process.env.ALERT_RECIPIENTS.split(',') : ['admin@regulator.gov.cn'],
    from: process.env.SMTP_FROM || '监管采集系统 <noreply@regulator.gov.cn>'
  }
};

module.exports = {
  ORG_TYPES,
  organizations,
  holidayConfig,
  performanceConfig,
  proxyConfig,
  paths,
  regulatorConfig,
  notificationConfig
};
