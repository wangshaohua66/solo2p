'use strict';

/**
 * WebdriverIO 8.x 浏览器会话工厂（standalone 模式）
 * 为每家银行创建独立 Chrome 会话，配置下载目录与无头模式。
 * 隔离下载目录以避免多银行并行下载文件串扰。
 *
 * 关键 API 映射（selenium-webdriver -> webdriverio 8.x）：
 *  - Builder().build()        -> remote({capabilities, logLevel})
 *  - driver.get(url)          -> browser.url(url)
 *  - driver.findElement(By)   -> browser.$(selector)
 *  - driver.wait(until.located)-> $(selector).waitForDisplayed({timeout})
 *  - driver.actions()         -> browser.action('pointer', {async})
 *  - driver.takeScreenshot()  -> browser.takeScreenshot() (返回 base64)
 *  - driver.quit()            -> browser.deleteSession()
 */

const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');
const { getDefaults } = require('./config');
const logger = require('./logger');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function screenshotDir(bankCode) {
  const def = getDefaults();
  const dir = path.resolve(process.cwd(), def.screenshot_dir || './logs/screenshots', bankCode || '');
  ensureDir(dir);
  return dir;
}

function downloadDir(bankCode) {
  const def = getDefaults();
  const dir = path.resolve(process.cwd(), def.download_dir || './downloads', bankCode || '');
  ensureDir(dir);
  return dir;
}

/**
 * 将定位器配置转为 WebdriverIO 选择器字符串
 * @param {object} locator {by:'css'|'xpath'|'id'|'name', value:'...'}
 * @returns {string} WebdriverIO 选择器
 */
function toSelector(locator) {
  if (!locator) throw new Error('定位器为空');
  const by = String(locator.by).toLowerCase();
  const val = locator.value;
  switch (by) {
    case 'id': return `#${val}`;
    case 'css': return val;
    case 'xpath': return val.startsWith('//') ? val : `//${val}`;
    case 'name': return `[name="${val}"]`;
    default: throw new Error(`不支持的定位方式: ${locator.by}`);
  }
}

/**
 * 创建银行专用 Chrome 会话（WebdriverIO 8.x standalone）
 * @param {string} bankCode 银行代码
 * @returns {Promise<{browser:object, driver:object, downloadDir:string}>}
 */
async function createSession(bankCode) {
  const def = getDefaults();
  const dlDir = downloadDir(bankCode);
  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1440,900',
    `--default-download-directory=${dlDir}`,
  ];
  if (def.headless) args.push('--headless=new');

  const prefs = {
    'download.default_directory': dlDir,
    'download.prompt_for_download': false,
    'download.directory_upgrade': true,
    'safebrowsing.enabled': true,
    'plugins.always_open_pdf_externally': true,
  };

  const browser = await remote({
    logLevel: 'error',
    capabilities: {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args,
        prefs,
      },
      'goog:chromeOptions:androidPackage': undefined,
      // 设置脚本与页面加载超时（毫秒）
      pageLoadStrategy: 'normal',
    },
    timeouts: {
      implicit: Number(def.element_timeout || 15000),
      pageLoad: 60000,
      script: 30000,
    },
  });

  logger.debug(`[${bankCode}] WebdriverIO Chrome 会话已创建，下载目录: ${dlDir}`);
  // 兼容字段：driver 保留指向 browser，以兼容调用方
  return { browser, driver: browser, downloadDir: dlDir };
}

async function quit(driver) {
  if (!driver) return;
  try { await driver.deleteSession(); } catch (_) { /* ignore */ }
}

/**
 * 截图存档（WebdriverIO takeScreenshot 返回 base64）
 */
async function takeScreenshot(driver, bankCode, tag) {
  if (!driver) return null;
  try {
    const dir = screenshotDir(bankCode);
    const file = path.join(dir, `${tag || 'snap'}-${Date.now()}.png`);
    const img = await driver.takeScreenshot();
    fs.writeFileSync(file, Buffer.from(img, 'base64'));
    return file;
  } catch (e) {
    logger.warn(`截图失败: ${e.message}`);
    return null;
  }
}

/**
 * 等待元素出现并可交互
 * @param {object} driver WebdriverIO browser 实例
 * @param {object} locator {by,value}
 * @param {number} timeoutMs 超时毫秒
 * @returns {Promise<object>} WebdriverIO Element
 */
async function waitFor(driver, locator, timeoutMs) {
  const def = getDefaults();
  const selector = toSelector(locator);
  const el = await driver.$(selector);
  await el.waitForExist({ timeout: timeoutMs || def.element_timeout || 15000 });
  await el.waitForDisplayed({ timeout: timeoutMs || def.element_timeout || 15000 });
  return el;
}

module.exports = {
  createSession,
  quit,
  takeScreenshot,
  toSelector,
  waitFor,
  screenshotDir,
  downloadDir,
};
