const path = require('path');

module.exports = {
  database: {
    path: path.join(__dirname, '..', 'db', 'supervision.db'),
  },
  browser: {
    poolSize: 3,
    maxPoolSize: 5,
    headless: true,
    timeout: 30000,
    userAgents: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ],
  },
  platforms: {
    ggzy: {
      name: '中国政府采购网',
      baseUrl: 'http://www.ccgp.gov.cn',
      loginUrl: 'http://www.ccgp.gov.cn/login',
      listUrl: 'http://www.ccgp.gov.cn/cggg/dfgg/index.htm',
      maxPages: 200,
    },
    provincial: {
      name: '省公共资源交易平台',
      baseUrl: 'http://ggzy.example.gov.cn',
      loginUrl: 'http://ggzy.example.gov.cn/login',
      listUrl: 'http://ggzy.example.gov.cn/queryList',
      maxPages: 200,
    },
  },
  analysis: {
    riskThreshold: 70,
    highRiskThreshold: 85,
    winRateThreshold: 0.6,
    priceDeviationThreshold: 0.95,
    relatedBidderThreshold: 3,
  },
  evidence: {
    dir: path.join(__dirname, '..', 'evidence'),
    screenshotQuality: 80,
    maxScreenshotSizeMB: 2,
  },
  cron: {
    dailyPattern: '0 9 * * 1-5',
    weeklyReportPattern: '0 18 * * 5',
    timezone: 'Asia/Shanghai',
  },
  alert: {
    wechatWebhook: process.env.WECHAT_WEBHOOK_URL || '',
  },
  retry: {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 30000,
    factor: 2,
  },
  captcha: {
    apiKey: process.env.CAPTCHA_API_KEY || '',
    apiUrl: process.env.CAPTCHA_API_URL || '',
  },
  logging: {
    level: 'info',
    colors: true,
  },
};
