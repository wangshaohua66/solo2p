/**
 * 配置模块统一入口
 * 加载环境变量，整合站点配置和系统配置，对外提供统一的配置访问接口
 */

import 'dotenv/config';
import sites, {
  getSiteByName,
  getSitesByPriority,
  getSitesRequireLogin,
  getSitesByPaginationType
} from './sites.js';

/**
 * 数据库配置
 * 从环境变量中读取数据库相关配置
 */
export const dbConfig = {
  path: process.env.DB_PATH || './data/auction_house.db'
};

/**
 * 日志配置
 * 从环境变量中读取日志相关配置
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  dir: process.env.LOG_DIR || './logs',
  console: process.env.LOG_CONSOLE !== 'false',
  file: process.env.LOG_FILE !== 'false',
  maxSize: parseInt(process.env.LOG_MAX_SIZE, 10) || 5 * 1024 * 1024,
  maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 10
};

/**
 * 爬虫配置
 * 从环境变量中读取爬虫相关配置
 */
export const crawlConfig = {
  concurrency: parseInt(process.env.CONCURRENCY, 10) || 5,
  requestInterval: parseInt(process.env.REQUEST_INTERVAL, 10) || 2000,
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  maxRetries: parseInt(process.env.MAX_RETRIES, 10) || 3,
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
};

/**
 * 调度配置
 * 从环境变量中读取定时任务相关配置
 */
export const scheduleConfig = {
  crawlSchedule: process.env.CRAWL_SCHEDULE || '0 0 2 * * *',
  reportSchedule: process.env.REPORT_SCHEDULE || '0 0 8 * * *'
};

/**
 * 邮件配置
 * 从环境变量中读取邮件通知相关配置
 */
export const emailConfig = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  smtpHost: process.env.EMAIL_SMTP_HOST || 'smtp.example.com',
  smtpPort: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
  smtpTls: process.env.EMAIL_SMTP_TLS !== 'false',
  from: process.env.EMAIL_FROM || 'auction-monitor@example.com',
  password: process.env.EMAIL_PASSWORD || '',
  to: process.env.EMAIL_TO ? process.env.EMAIL_TO.split(',') : [],
  subjectPrefix: process.env.EMAIL_SUBJECT_PREFIX || '[法拍房监控]'
};

/**
 * 代理配置
 * 从环境变量中读取代理相关配置
 */
export const proxyConfig = {
  enabled: process.env.PROXY_ENABLED === 'true',
  host: process.env.PROXY_HOST || '127.0.0.1',
  port: parseInt(process.env.PROXY_PORT, 10) || 7890,
  type: process.env.PROXY_TYPE || 'http'
};

/**
 * 筛选配置
 * 从环境变量中读取数据筛选相关配置
 * 注意：价格单位统一转换为元，折扣率统一转换为百分比
 */
export const filterConfig = {
  minAssessPrice: (parseFloat(process.env.MIN_ASSESS_PRICE) || 0) * 10000,
  maxAssessPrice: process.env.MAX_ASSESS_PRICE ? parseFloat(process.env.MAX_ASSESS_PRICE) * 10000 : Infinity,
  minDiscountRate: (parseFloat(process.env.MIN_DISCOUNT_RATE) || 0) * 100,
  maxDiscountRate: process.env.MAX_DISCOUNT_RATE ? parseFloat(process.env.MAX_DISCOUNT_RATE) * 100 : 100,
  targetAreas: process.env.TARGET_CITIES ? process.env.TARGET_CITIES.split(',') : [],
  minArea: parseFloat(process.env.MIN_AREA) || 0,
  maxArea: process.env.MAX_AREA ? parseFloat(process.env.MAX_AREA) : Infinity,
  roundWeights: {
    '一拍': 1.0,
    '二拍': 1.2,
    '变卖': 1.3
  },
  highValueThreshold: parseInt(process.env.HIGH_VALUE_THRESHOLD, 10) || 3,
  sortBy: 'score',
  sortOrder: 'desc'
};

/**
 * 获取站点登录密码配置
 * 将环境变量中的登录信息注入到站点配置中
 * @param {string} siteName - 站点名称
 * @returns {object} 站点登录配置
 */
function getSiteLoginPassword(siteName) {
  const passwordMap = {
    '浙江省高级人民法院': process.env.ZHEJIANG_COURT_PASSWORD,
    '江苏省高级人民法院': process.env.JIANGSU_COURT_COOKIE
  };
  return passwordMap[siteName];
}

/**
 * 获取完整配置的站点列表
 * 将环境变量中的敏感信息注入到站点配置中
 * @returns {Array<SiteConfig>} 完整的站点配置数组
 */
export function getSitesWithSecrets() {
  return sites.map(site => {
    const siteCopy = { ...site, login: { ...site.login } };
    
    if (siteCopy.login.required) {
      if (siteCopy.login.loginType === 'password') {
        const password = getSiteLoginPassword(siteCopy.name);
        if (password) {
          siteCopy.login.password = password;
        }
      } else if (siteCopy.login.loginType === 'cookie') {
        const cookieValue = getSiteLoginPassword(siteCopy.name);
        if (cookieValue) {
          siteCopy.login.cookieValue = cookieValue;
        }
      }
    }
    
    return siteCopy;
  });
}

/**
 * 获取单个完整配置的站点
 * @param {string} name - 站点名称
 * @returns {SiteConfig|undefined} 完整的站点配置对象
 */
export function getSiteWithSecrets(name) {
  const allSites = getSitesWithSecrets();
  return allSites.find(site => site.name === name);
}

/**
 * 默认导出
 * 包含所有配置项的配置对象
 */
export default {
  sites: getSitesWithSecrets(),
  db: dbConfig,
  log: logConfig,
  crawl: crawlConfig,
  schedule: scheduleConfig,
  email: emailConfig,
  proxy: proxyConfig,
  filter: filterConfig,
  getSiteByName,
  getSitesByPriority,
  getSitesRequireLogin,
  getSitesByPaginationType,
  getSitesWithSecrets,
  getSiteWithSecrets
};
