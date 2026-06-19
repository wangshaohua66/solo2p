const path = require('path');
const dayjs = require('dayjs');

const PLATFORMS = ['amazon', 'ebay', 'wish', 'shopee', 'lazada', 'aliexpress'];

const PLATFORM_NAMES = {
  amazon: '亚马逊',
  ebay: 'eBay',
  wish: 'Wish',
  shopee: 'Shopee',
  lazada: 'Lazada',
  aliexpress: 'AliExpress'
};

const ORDER_STATUS = {
  PENDING_SHIPMENT: 'pending_shipment',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
};

const LOGISTICS_STATUS = {
  PENDING: 'pending',
  TRANSIT: 'transit',
  DELIVERED: 'delivered',
  EXCEPTION: 'exception',
  RETURNED: 'returned'
};

const platformUrls = {
  amazon: {
    login: 'https://sellercentral.amazon.com/gp/homepage.html',
    orders: 'https://sellercentral.amazon.com/orders-v3/fba/all',
    logistics: 'https://sellercentral.amazon.com/shipping/manage'
  },
  ebay: {
    login: 'https://signin.ebay.com/signin',
    orders: 'https://www.ebay.com/sh/ord',
    logistics: 'https://www.ebay.com/sh/lst/active'
  },
  wish: {
    login: 'https://merchant.wish.com/login',
    orders: 'https://merchant.wish.com/orders',
    logistics: 'https://merchant.wish.com/shipping'
  },
  shopee: {
    login: 'https://seller.shopee.cn/account/signin',
    orders: 'https://seller.shopee.cn/portal/order/list',
    logistics: 'https://seller.shopee.cn/portal/logistics'
  },
  lazada: {
    login: 'https://sellercenter.lazada.com/apps/seller/login',
    orders: 'https://sellercenter.lazada.com/apps/order/list',
    logistics: 'https://sellercenter.lazada.com/apps/logistics'
  },
  aliexpress: {
    login: 'https://login.aliexpress.com/seller.htm',
    orders: 'https://trade.aliexpress.com/orderList.htm',
    logistics: 'https://trade.aliexpress.com/logisticsList.htm'
  }
};

const platformCredentials = {
  amazon: {
    username: process.env.AMAZON_USERNAME || 'your_amazon_email@example.com',
    password: process.env.AMAZON_PASSWORD || 'your_amazon_password',
    otpSecret: process.env.AMAZON_OTP_SECRET || ''
  },
  ebay: {
    username: process.env.EBAY_USERNAME || 'your_ebay_username',
    password: process.env.EBAY_PASSWORD || 'your_ebay_password'
  },
  wish: {
    username: process.env.WISH_USERNAME || 'your_wish_email@example.com',
    password: process.env.WISH_PASSWORD || 'your_wish_password'
  },
  shopee: {
    username: process.env.SHOPEE_USERNAME || 'your_shopee_username',
    password: process.env.SHOPEE_PASSWORD || 'your_shopee_password'
  },
  lazada: {
    username: process.env.LAZADA_USERNAME || 'your_lazada_email@example.com',
    password: process.env.LAZADA_PASSWORD || 'your_lazada_password'
  },
  aliexpress: {
    username: process.env.ALIEXPRESS_USERNAME || 'your_aliexpress_email@example.com',
    password: process.env.ALIEXPRESS_PASSWORD || 'your_aliexpress_password'
  }
};

const scheduleConfig = {
  pollIntervalMinutes: 60,
  maxConcurrency: 3,
  singlePlatformTimeoutMinutes: 5,
  totalCycleTimeoutMinutes: 60
};

const fetchConfig = {
  defaultDaysRange: 7,
  maxHistoryMonths: 12,
  pageSize: 50,
  navigationTimeout: 30000,
  elementWaitTimeout: 15000,
  pageLoadTimeout: 45000
};

const retryConfig = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'Navigation timeout',
    'Page load timeout',
    'Network error',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'Element not found',
    'Session expired'
  ]
};

const alertConfig = {
  enabled: true,
  webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  email: {
    enabled: false,
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    sender: process.env.EMAIL_SENDER || '',
    recipients: (process.env.ALERT_RECIPIENTS || '').split(',').filter(Boolean)
  },
  alertOnLoginFail: true,
  alertOnOrderException: true,
  alertOnLogisticsDelay: true,
  logisticsDelayThresholdHours: 72
};

const databaseConfig = {
  path: path.join(__dirname, 'data', 'orders.db'),
  journalMode: 'WAL',
  busyTimeout: 30000,
  cacheSize: 20000
};

const cookieConfig = {
  storagePath: path.join(__dirname, 'data', 'cookies.json'),
  sessionExpiryHours: 23,
  refreshThresholdMinutes: 30
};

const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  filePath: path.join(__dirname, 'logs', 'app.log'),
  errorFilePath: path.join(__dirname, 'logs', 'error.log'),
  maxFileSize: '10MB',
  maxFiles: 5
};

const chromeConfig = {
  headless: process.env.CHROME_HEADLESS !== 'false',
  noSandbox: true,
  disableDevShmUsage: true,
  windowSize: '1920,1080',
  userDataDir: path.join(__dirname, 'data', 'chrome_profile'),
  disableImages: true,
  disableJavascript: false,
  additionalArgs: [
    '--disable-gpu',
    '--disable-extensions',
    '--disable-popup-blocking',
    '--ignore-certificate-errors'
  ]
};

function getPlatformUrl(platform, type) {
  if (!platformUrls[platform]) {
    throw new Error(`未知平台: ${platform}`);
  }
  if (!platformUrls[platform][type]) {
    throw new Error(`平台 ${platform} 未配置 ${type} URL`);
  }
  return platformUrls[platform][type];
}

function getCredentials(platform) {
  if (!platformCredentials[platform]) {
    throw new Error(`未知平台: ${platform}`);
  }
  return { ...platformCredentials[platform] };
}

function getDateRange(days = fetchConfig.defaultDaysRange) {
  const endDate = dayjs().endOf('day');
  const startDate = dayjs().subtract(days, 'day').startOf('day');
  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate(),
    startDateStr: startDate.format('YYYY-MM-DD'),
    endDateStr: endDate.format('YYYY-MM-DD')
  };
}

function isRetryableError(error) {
  const errorMessage = error.message || String(error);
  return retryConfig.retryableErrors.some(keyword =>
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
}

module.exports = {
  PLATFORMS,
  PLATFORM_NAMES,
  ORDER_STATUS,
  LOGISTICS_STATUS,
  platformUrls,
  platformCredentials,
  scheduleConfig,
  fetchConfig,
  retryConfig,
  alertConfig,
  databaseConfig,
  cookieConfig,
  logConfig,
  chromeConfig,
  getPlatformUrl,
  getCredentials,
  getDateRange,
  isRetryableError
};
