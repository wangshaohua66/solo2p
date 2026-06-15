'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const repository = require('../storage/repository');

const CAPTCHA_DIR = path.resolve(process.cwd(), 'logs', 'captcha');

class CaptchaHandler extends EventEmitter {
  constructor(config) {
    super();
    this.config = config || {};
    this.pending = new Map();
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(CAPTCHA_DIR)) fs.mkdirSync(CAPTCHA_DIR, { recursive: true });
  }

  async detect(page, selectors) {
    if (!selectors) return null;
    const { slider, image, popup } = selectors || {};
    const candidates = [
      { type: 'slider', selector: slider },
      { type: 'image', selector: image },
      { type: 'popup', selector: popup },
    ].filter((c) => c.selector);
    for (const c of candidates) {
      try {
        const el = await page.$(c.selector);
        if (el && await el.isDisplayed()) {
          logger.debug(`检测到验证码: ${c.type}`);
          return c;
        }
      } catch (_) {}
    }
    try {
      const title = await page.title();
      const url = await page.url();
      const content = (await page.content()).substring(0, 2000);
      if (/验证码|captcha|验证|人机验证|slider|verify/i.test(title + url + content)) {
        return { type: 'unknown', selector: null };
      }
    } catch (_) {}
    return null;
  }

  async interrupt(taskContext, page, captchaType, selectors) {
    const captchaId = uuidv4();
    const screenshotPath = path.join(CAPTCHA_DIR, `${captchaId}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch (e) {
      logger.warn('验证码截图失败', { error: e.message });
    }
    const captchaDoc = {
      captchaId,
      taskId: taskContext.taskId,
      platform: taskContext.platform?.code || taskContext.platform,
      platformName: taskContext.platform?.name || '',
      type: captchaType?.type || captchaType || 'unknown',
      screenshot: screenshotPath,
      pageUrl: await page.url().catch(() => ''),
      selectors,
      context: {
        dataType: taskContext.dataType,
        currentStep: taskContext.currentStep,
        currentAccount: taskContext.currentAccount,
      },
    };
    const saved = await repository.saveCaptchaTask(captchaDoc);
    this.pending.set(captchaId, { saved, resolve: null });
    logger.warn(`【验证码拦截】${saved.platform} 任务=${saved.taskId?.toString().substring(0, 8)} 类型=${saved.type}`, { screenshotPath });
    this.emit('captcha:pending', saved);
    this.emit('status:captcha', { platform: saved.platform, captchaId: saved.captchaId, taskId: saved.taskId });
    return captchaId;
  }

  async waitForResolution(captchaId, timeoutMs = 600000) {
    try {
      const result = await repository.waitForCaptchaResult(captchaId, timeoutMs);
      this.pending.delete(captchaId);
      logger.info(`验证码已解决: ${captchaId.substring(0, 8)}`);
      return result;
    } catch (err) {
      this.pending.delete(captchaId);
      logger.error(`验证码超时: ${captchaId.substring(0, 8)}`, { error: err.message });
      throw err;
    }
  }

  async resolveSlider(page, result, selectors) {
    const sliderSel = selectors?.slider || '.slider-captcha';
    try {
      const slider = await page.$(sliderSel);
      if (!slider) return false;
      const box = await slider.boundingBox();
      if (!box) return false;
      if (typeof result === 'number') {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        const steps = 20;
        const dx = result / steps;
        for (let i = 0; i < steps; i++) {
          await page.mouse.move(box.x + box.width / 2 + dx * (i + 1), box.y + box.height / 2);
          await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
        }
        await page.mouse.up();
      }
      await new Promise((r) => setTimeout(r, 2000));
      return true;
    } catch (e) {
      logger.warn('滑块验证操作失败', { error: e.message });
      return false;
    }
  }

  async resolveImage(page, answer, selectors) {
    try {
      const inputSel = selectors?.image_input || 'input.captcha-input, input[name="captcha"], input#captcha';
      const submitSel = selectors?.image_submit || 'button.captcha-submit, .verify-btn';
      const input = await page.$(inputSel);
      if (input) {
        await input.click({ clickCount: 3 });
        await input.fill(String(answer));
      }
      const btn = await page.$(submitSel);
      if (btn) await btn.click();
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    } catch (e) {
      logger.warn('图片验证码填入失败', { error: e.message });
      return false;
    }
  }

  async applyResolution(page, captchaType, result, selectors) {
    if (!result) return false;
    switch (captchaType) {
      case 'slider': return this.resolveSlider(page, result, selectors);
      case 'image': return this.resolveImage(page, result, selectors);
      default: return true;
    }
  }

  async listPending(limit = 20) {
    return repository.peekPendingCaptchas(limit);
  }

  async submitSolution(captchaId, result, operator = 'agent') {
    const ok = await repository.submitCaptchaResult(captchaId, result, operator);
    if (ok) this.emit('captcha:resolved', { captchaId, operator });
    return ok;
  }
}

module.exports = CaptchaHandler;
