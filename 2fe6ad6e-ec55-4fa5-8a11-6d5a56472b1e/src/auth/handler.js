'use strict';

/**
 * 多银行网银自动化登录处理器（WebdriverIO 8.x）
 * 职责：
 *  1) U盾插入检测与PIN码自动填充
 *  2) 短信验证码倒计时等待与人工输入提示
 *  3) 滑块验证码截图暂停供人工干预
 *  4) 登录超时与异常自动重试（最多3次）
 *  5) 每银行独立登录会话生命周期
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const logger = require('../utils/logger');
const { getDefaults, envValue } = require('../utils/config');
const { takeScreenshot, toSelector, waitFor } = require('../utils/browser');
const { askWithCountdown } = require('../utils/prompt');
const { recordPageChange } = require('../utils/db');

class AuthHandler {
  /**
   * @param {object} bank 银行配置（来自 banks.yml）
   * @param {object} driver WebdriverIO browser 实例
   * @param {object} session 浏览器会话 { browser, driver, downloadDir }
   */
  constructor(bank, driver, session) {
    this.bank = bank;
    this.driver = driver;
    this.session = session;
    this.log = logger.forBank(bank.code);
    this.maxRetry = (getDefaults().login_max_retry || 3);
  }

  /**
   * 执行完整登录流程（含重试）
   * @returns {Promise<{success:boolean, attempts:number, error?:string}>}
   */
  async login() {
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetry; attempt++) {
      this.log.info(`登录尝试 ${attempt}/${this.maxRetry}`);
      try {
        await this._navigate();
        await this._fillCredentials();
        await this._handleUKey();
        await this._clickSubmit();
        await this._handleSms();
        await this._handleSlider();
        const ok = await this._verifySuccess();
        if (ok) {
          this.log.success('登录成功');
          return { success: true, attempts: attempt };
        }
        lastError = new Error('登录成功标识未出现');
      } catch (e) {
        lastError = e;
        this.log.warn(`第 ${attempt} 次登录失败: ${e.message}`);
        const shot = await takeScreenshot(this.driver, this.bank.code, `login-fail-${attempt}`);
        if (shot) this.log.debug(`失败截图: ${shot}`);
        if (attempt < this.maxRetry) {
          await this._resetPage();
        }
      }
    }
    this.log.error(`登录重试 ${this.maxRetry} 次后仍失败: ${lastError && lastError.message}`);
    return { success: false, attempts: this.maxRetry, error: lastError && lastError.message };
  }

  async _navigate() {
    const url = this.bank.base_url;
    this.log.debug(`打开登录页: ${url}`);
    await this.driver.url(url);
    await waitFor(this.driver, this.bank.login.username_locator, 15000);
  }

  async _resetPage() {
    try {
      await this.driver.refresh();
      await this.driver.pause(800);
    } catch (_) { /* ignore */ }
  }

  async _fillCredentials() {
    const user = envValue(`${this.bank.code}_USERNAME`);
    const pass = envValue(`${this.bank.code}_PASSWORD`);
    if (!user || !pass) {
      throw new Error(`缺少凭据环境变量 ${this.bank.code}_USERNAME / ${this.bank.code}_PASSWORD`);
    }
    const uEl = await waitFor(this.driver, this.bank.login.username_locator, 10000);
    await uEl.clearValue();
    await uEl.setValue(user);

    const pEl = await waitFor(this.driver, this.bank.login.password_locator, 10000);
    await pEl.clearValue();
    await pEl.setValue(pass);
    this.log.debug('账号密码已填充');
  }

  async _handleUKey() {
    if (this.bank.auth_type !== 'ukey') return;
    const ukey = this.bank.login.ukey;
    if (!ukey) return;
    const inserted = await this._detectUKey(ukey.detect_command);
    if (!inserted) {
      throw new Error('U盾未检测到插入，请插入U盾后重试');
    }
    this.log.success('U盾已检测到');
    const pin = envValue(ukey.pin_env);
    if (!pin) {
      const input = await askWithCountdown(`\n请输入 ${this.bank.name} U盾PIN码: `, 60000);
      if (!input) throw new Error('U盾PIN码输入超时');
      await this._enterPin(input, ukey);
      return;
    }
    await this._enterPin(pin, ukey);
    this.log.debug('PIN码已自动填充');
  }

  async _detectUKey(command) {
    if (!command) return true;
    try {
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (e) {
      this.log.debug(`U盾检测命令返回: ${e.message}`);
      const answer = await askWithCountdown(
        `\n请确认 ${this.bank.name} U盾是否已插入 (y/n): `, 30000);
      return answer === 'y';
    }
  }

  async _enterPin(pin, ukey) {
    const pinEl = await waitFor(this.driver, ukey.pin_locator, 10000);
    await pinEl.clearValue();
    await pinEl.setValue(pin);
    if (ukey.confirm_locator) {
      const ok = await waitFor(this.driver, ukey.confirm_locator, 10000);
      await ok.click();
    }
  }

  async _clickSubmit() {
    const btn = await waitFor(this.driver, this.bank.login.submit_locator, 10000);
    await btn.click();
    this.log.debug('已点击登录按钮');
  }

  async _handleSms() {
    if (this.bank.auth_type !== 'sms') return;
    const sms = this.bank.login.sms;
    if (!sms) return;
    try {
      const trigger = await waitFor(this.driver, sms.trigger_locator, 8000);
      await trigger.click();
      this.log.info('短信验证码已触发发送，请查收手机');
    } catch (e) {
      this.log.debug('短信触发按钮未找到，可能已自动发送');
    }
    const code = await askWithCountdown(
      `\n[${this.bank.name}] ${sms.prompt || '请输入短信验证码'} (倒计时120秒): `,
      sms.wait_timeout || 120000
    );
    if (!code) throw new Error('短信验证码输入超时');
    const codeEl = await waitFor(this.driver, sms.code_locator, 10000);
    await codeEl.clearValue();
    await codeEl.setValue(code);
    this.log.debug('短信验证码已填入');
  }

  /**
   * 滑块验证码：截图暂停，等待人工在浏览器中完成滑动
   */
  async _handleSlider() {
    const slider = this.bank.login.slider;
    if (!slider) return;
    let present = false;
    try {
      const sel = toSelector(slider.detect_locator);
      const el = await this.driver.$(sel);
      present = await el.isExisting();
    } catch (_) { present = false; }
    if (!present) return;

    this.log.warn('检测到滑块验证码，已截图，请在浏览器窗口手动完成滑动');
    const shot = await takeScreenshot(this.driver, this.bank.code, 'slider-captcha');
    if (shot) this.log.info(`滑块截图: ${shot}`);

    const autoOk = await this._tryAutoSlide(slider);
    if (autoOk) return;

    const answer = await askWithCountdown(
      `\n[${this.bank.name}] 请在浏览器完成滑块验证后输入回车继续 (倒计时120秒): `,
      120000
    );
    if (answer === null) throw new Error('滑块验证等待超时');
  }

  async _tryAutoSlide(slider) {
    try {
      const track = await waitFor(this.driver, slider.track_locator, 3000);
      const rect = await track.getSize();
      const action = this.driver.action('pointer', { parameters: { pointerType: 'mouse' } });
      await action.move({ origin: track, x: 0, y: 0 });
      await action.down();
      // 分段移动模拟人工拖动
      for (let i = 0; i < 5; i++) {
        await action.move({ origin: track, x: Math.round(rect.width * (0.2 + i * 0.15)), y: 2 });
      }
      await action.up();
      await action.perform();
      await this.driver.pause(1500);
      const sel = toSelector(slider.detect_locator);
      const el = await this.driver.$(sel);
      const stillVisible = await el.isExisting();
      return !stillVisible;
    } catch (e) {
      this.log.debug(`自动滑动失败: ${e.message}`);
      return false;
    }
  }

  async _verifySuccess() {
    const ind = this.bank.login.success_indicator;
    if (!ind) return true;
    const timeout = this.bank.login.success_timeout || 30000;
    try {
      const sel = toSelector(ind);
      const el = await this.driver.$(sel);
      await el.waitForExist({ timeout });
      await el.waitForDisplayed({ timeout });
      return true;
    } catch (e) {
      await recordPageChange(
        this.bank.code,
        JSON.stringify(ind),
        '登录成功标识定位失败',
        await takeScreenshot(this.driver, this.bank.code, 'success-indicator-miss')
      );
      return false;
    }
  }
}

/**
 * 对外入口：完成单银行登录
 * @param {object} bank 银行配置
 * @param {object} driver WebdriverIO browser 实例
 * @param {object} session 浏览器会话
 */
async function login(bank, driver, session) {
  const handler = new AuthHandler(bank, driver, session);
  return handler.login();
}

module.exports = { AuthHandler, login };
