'use strict';

/**
 * 流水导出路径智能导航
 * 职责：
 *  1) 按 banks.yml 配置的菜单层级逐层点击/悬停
 *  2) 支持动态菜单（悬停展开、AJAX 加载等待），每层 15 秒元素超时
 *  3) 导航失败时截图存档并跳过当前银行
 *  4) 页面变更自适应检测：连续3次定位失败则标记银行需更新配置并告警运维
 */

const { until, By } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');
const { getDefaults } = require('../utils/config');
const { takeScreenshot, toBy, waitFor } = require('../utils/browser');
const db = require('../utils/db');

const chalk = require('chalk');

class Navigator {
  constructor(bank, driver, session) {
    this.bank = bank;
    this.driver = driver;
    this.session = session;
    this.log = logger.forBank(bank.code);
    this.elementTimeout = Number(getDefaults().element_timeout || 15000);
  }

  /**
   * 执行全部菜单导航并触发导出，等待下载文件就绪
   * @returns {Promise<{success:boolean, file?:string, error?:string, completedSteps:number}>}
   */
  async navigateAndExport() {
    const steps = (this.bank.export && this.bank.export.path) || [];
    if (!steps.length) {
      return { success: false, error: '未配置导出路径', completedSteps: 0 };
    }
    const beforeFiles = this._snapshotDownloads();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.log.info(`导航 [${i + 1}/${steps.length}] ${step.desc || ''}`);
      try {
        await this._executeStep(step);
      } catch (e) {
        const shot = await takeScreenshot(this.driver, this.bank.code, `nav-fail-step${i + 1}`);
        await this._recordLocatorFailure(step, shot);
        const flagged = await this._maybeFlagBank(step);
        if (flagged) {
          logger.alert(`${this.bank.name}(${this.bank.code}) 页面结构变更，连续定位失败已达阈值，已标记需更新配置`);
        }
        return {
          success: false,
          error: `导航第 ${i + 1} 步[${step.desc}]失败: ${e.message}`,
          completedSteps: i,
        };
      }
    }

    // 部分银行点击导出按钮后弹出二次确认框
    try {
      await this._confirmExport();
    } catch (e) {
      this.log.debug(`导出确认框处理: ${e.message}`);
    }

    // 等待文件下载完成
    try {
      const file = await this._waitForDownload(beforeFiles);
      this.log.success(`流水文件已下载: ${path.basename(file)}`);
      return { success: true, file, completedSteps: steps.length };
    } catch (e) {
      const shot = await takeScreenshot(this.driver, this.bank.code, 'download-timeout');
      return { success: false, error: `下载等待失败: ${e.message}`, completedSteps: steps.length, screenshot: shot };
    }
  }

  async _executeStep(step) {
    const by = toBy(step.target);
    const el = await this.driver.wait(until.elementLocated(by), this.elementTimeout, `元素未出现: ${JSON.stringify(step.target)}`);
    await this.driver.wait(until.elementIsVisible(el), this.elementTimeout);

    const action = String(step.action || 'click').toLowerCase();
    if (action === 'hover') {
      // 悬停展开动态菜单
      const actions = this.driver.actions({ async: true });
      await actions.move({ origin: el }).perform();
      await this.driver.sleep(400); // 等待 JS 展开动画
      this.log.debug(`悬停: ${step.desc}`);
    } else {
      await el.click();
      this.log.debug(`点击: ${step.desc}`);
    }

    // 等待 AJAX/动态内容加载
    if (step.wait_for) {
      await this.driver.wait(
        until.elementLocated(toBy(step.wait_for)),
        this.elementTimeout,
        `等待元素未出现: ${JSON.stringify(step.wait_for)}`
      );
    }
  }

  async _confirmExport() {
    const confirm = this.bank.export && this.bank.export.export_confirm;
    if (!confirm) return;
    try {
      const el = await this.driver.wait(until.elementLocated(toBy(confirm)), 5000);
      await el.click();
      this.log.debug('已点击导出确认');
    } catch (e) {
      this.log.debug('未出现导出确认框或已自动确认');
    }
  }

  _snapshotDownloads() {
    const dir = this.session.downloadDir;
    try {
      return new Set(fs.readdirSync(dir));
    } catch (_) {
      return new Set();
    }
  }

  async _waitForDownload(beforeFiles) {
    const def = getDefaults();
    const interval = Number(def.download_poll_interval || 1000);
    const timeout = Number(def.download_ready_timeout || 60000);
    const fmt = (this.bank.export && this.bank.export.file_format || '').toLowerCase();
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const tick = async () => {
        if (Date.now() - start > timeout) {
          return reject(new Error(`下载超时(${timeout}ms)`));
        }
        const current = this._snapshotDownloads();
        let candidate = null;
        for (const f of current) {
          if (beforeFiles.has(f)) continue;
          if (f.endsWith('.crdownload') || f.endsWith('.tmp') || f.endsWith('.part')) {
            candidate = null;
            break; // 仍在下载中
          }
          if (fmt && !f.toLowerCase().endsWith(`.${fmt}`)) {
            // 格式不匹配但属于新文件，仍记录候选（部分银行压缩包等）
            candidate = candidate || f;
            continue;
          }
          candidate = f;
        }
        if (candidate) {
          return resolve(path.join(this.session.downloadDir, candidate));
        }
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  async _recordLocatorFailure(step, screenshotPath) {
    const locatorStr = JSON.stringify(step.target);
    try {
      await db.recordPageChange(this.bank.code, locatorStr, step.desc || '', screenshotPath);
    } catch (e) {
      this.log.debug(`记录变更日志失败: ${e.message}`);
    }
  }

  async _maybeFlagBank(step) {
    const locatorStr = JSON.stringify(step.target);
    const def = getDefaults();
    const threshold = Number(def.locator_fail_threshold || 3);
    try {
      const count = await db.locatorFailCount(this.bank.code, locatorStr);
      if (count >= threshold) {
        await db.flagBankForUpdate(this.bank.code, locatorStr);
        return true;
      }
    } catch (e) {
      this.log.debug(`变更检测查询失败: ${e.message}`);
    }
    return false;
  }

  /**
   * 健康检查：在登录前验证关键定位器是否仍有效（轻量探测）
   */
  async healthCheck() {
    const steps = (this.bank.export && this.bank.export.path) || [];
    let firstBad = null;
    for (const step of steps) {
      try {
        await this.driver.wait(until.elementLocated(toBy(step.target)), 2000);
      } catch (_) {
        firstBad = step;
        break;
      }
    }
    return { ok: !firstBad, badStep: firstBad };
  }
}

async function navigateAndExport(bank, driver, session) {
  const nav = new Navigator(bank, driver, session);
  return nav.navigateAndExport();
}

module.exports = { Navigator, navigateAndExport };
