'use strict';

/**
 * Selenium WebDriver 浏览器会话工厂
 * 为每家银行创建独立 Chrome 会话，配置下载目录与无头模式。
 * 隔离下载目录以避免多银行并行下载文件串扰。
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
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
 * 创建银行专用 Chrome 会话
 * @param {string} bankCode 银行代码
 */
async function createSession(bankCode) {
  const def = getDefaults();
  const dlDir = downloadDir(bankCode);

  const options = new chrome.Options();
  options.setUserPreferences({
    'download.default_directory': dlDir,
    'download.prompt_for_download': false,
    'download.directory_upgrade': true,
    'safebrowsing.enabled': true,
    'plugins.always_open_pdf_externally': true,
  });
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-blink-features=AutomationControlled');
  options.addArguments(`--window-size=1440,900`);
  if (def.headless) options.addArguments('--headless=new');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  driver.manage().setTimeouts({
    implicit: Number(def.element_timeout || 15000),
    pageLoad: 60000,
    script: 30000,
  });

  logger.debug(`[${bankCode}] Chrome 会话已创建，下载目录: ${dlDir}`);
  return { driver, downloadDir: dlDir };
}

async function quit(driver) {
  if (driver) {
    try { await driver.quit(); } catch (_) { /* ignore */ }
  }
}

/**
 * 截图存档
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
 * 按定位器描述查找元素
 * @param locator {by:'css'|'xpath'|'id', value:'...'}
 */
function toBy(locator) {
  if (!locator) throw new Error('定位器为空');
  switch (String(locator.by).toLowerCase()) {
    case 'id': return By.id(locator.value);
    case 'css': return By.css(locator.value);
    case 'xpath': return By.xpath(locator.value);
    case 'name': return By.name(locator.value);
    default: throw new Error(`不支持的定位方式: ${locator.by}`);
  }
}

/**
 * 等待元素出现（可点击）
 */
async function waitFor(driver, locator, timeoutMs) {
  const def = getDefaults();
  const by = toBy(locator);
  return driver.wait(until.elementLocated(by), timeoutMs || def.element_timeout || 15000);
}

module.exports = {
  createSession,
  quit,
  takeScreenshot,
  toBy,
  waitFor,
  screenshotDir,
  downloadDir,
};
