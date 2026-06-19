const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { SYSTEM_CONFIG } = require('../../config/hospitals');

const logger = createLogger('CaptchaService');

class CaptchaService {
  constructor() {
    this.ocrWorker = null;
    this._ocrInitialized = false;
    this.sliderStats = {
      total: 0,
      success: 0,
      failed: 0
    };
    this.imageStats = {
      total: 0,
      success: 0,
      failed: 0,
      avgTime: 0
    };
  }

  async initOCR() {
    if (this._ocrInitialized) return;

    logger.info('初始化OCR引擎...');
    try {
      const worker = await Tesseract.createWorker('chi_sim+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        tessedit_pageseg_mode: 7,
        preserve_interword_spaces: 0
      });

      this.ocrWorker = worker;
      this._ocrInitialized = true;
      logger.info('OCR引擎初始化完成');
    } catch (err) {
      logger.error(`OCR初始化失败: ${err.message}`);
      throw err;
    }
  }

  async recognizeImage(imagePath) {
    const startTime = Date.now();
    this.imageStats.total++;

    try {
      if (!this._ocrInitialized) {
        await this.initOCR();
      }

      if (!fs.existsSync(imagePath)) {
        throw new Error(`验证码图片不存在: ${imagePath}`);
      }

      logger.debug(`开始识别验证码: ${imagePath}`);

      const { data } = await this.ocrWorker.recognize(imagePath);
      let text = data.text.trim();

      text = this._cleanCaptchaText(text);

      const duration = Date.now() - startTime;
      logger.info(`验证码识别结果: "${text}" (耗时: ${duration}ms)`);

      if (text && text.length >= 3) {
        this.imageStats.success++;
        this.imageStats.avgTime = 
          (this.imageStats.avgTime * (this.imageStats.success - 1) + duration) 
          / this.imageStats.success;
        return {
          success: true,
          text,
          confidence: data.confidence,
          duration
        };
      } else {
        this.imageStats.failed++;
        return {
          success: false,
          text: null,
          confidence: 0,
          duration,
          reason: '识别结果过短或为空'
        };
      }
    } catch (err) {
      this.imageStats.failed++;
      logger.error(`验证码识别失败: ${err.message}`);
      return {
        success: false,
        text: null,
        confidence: 0,
        duration: Date.now() - startTime,
        error: err.message
      };
    }
  }

  async recognizeImageFromBase64(base64Data) {
    const tempDir = path.join(SYSTEM_CONFIG.screenshotDir, 'captcha');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const ts = Date.now();
    const tempFile = path.join(tempDir, `captcha-${ts}.png`);
    const base64Image = base64Data.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    fs.writeFileSync(tempFile, base64Image, 'base64');

    try {
      const result = await this.recognizeImage(tempFile);
      return result;
    } finally {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        logger.debug(`清理临时文件失败: ${e.message}`);
      }
    }
  }

  _cleanCaptchaText(text) {
    let cleaned = text
      .replace(/\s+/g, '')
      .replace(/[oO]/g, '0')
      .replace(/[lI]/g, '1')
      .replace(/[Z]/g, '2')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .toUpperCase();

    cleaned = cleaned.match(/[A-Z0-9]{3,6}/g)?.[0] || cleaned;

    return cleaned;
  }

  async solveSlider(browser, sliderConfig = {}) {
    const {
      sliderSelector,
      trackSelector,
      targetSelector,
      buttonSelector,
      maxAttempts = 3,
      humanLike = true
    } = sliderConfig;

    this.sliderStats.total++;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.debug(`滑块验证第 ${attempt} 次尝试`);

      try {
        const result = await this._performSliderDrag(
          browser,
          sliderSelector,
          trackSelector,
          targetSelector,
          buttonSelector,
          humanLike
        );

        if (result.success) {
          this.sliderStats.success++;
          logger.info(`滑块验证成功 (第${attempt}次尝试)`);
          return {
            success: true,
            attempts: attempt,
            distance: result.distance,
            duration: result.duration
          };
        }

        if (attempt < maxAttempts) {
          await browser.sleep(1000 + Math.random() * 1000);
          await browser.refresh();
        }
      } catch (err) {
        logger.debug(`滑块验证第 ${attempt} 次尝试失败: ${err.message}`);
        if (attempt < maxAttempts) {
          await browser.sleep(1000);
        }
      }
    }

    this.sliderStats.failed++;
    logger.warn(`滑块验证失败，共尝试 ${maxAttempts} 次`);
    return {
      success: false,
      attempts: maxAttempts
    };
  }

  async _performSliderDrag(browser, sliderSelector, trackSelector, targetSelector, buttonSelector, humanLike) {
    const startTime = Date.now();

    const sliderBtn = await browser.$(buttonSelector || sliderSelector + ' .slider-btn');
    if (!sliderBtn || !await sliderBtn.isExisting()) {
      throw new Error('滑块按钮不存在');
    }

    const track = await browser.$(trackSelector || sliderSelector + ' .slider-track');
    if (!track || !await track.isDisplayed()) {
      throw new Error('滑块轨道不可见');
    }

    const trackSize = await track.getSize();
    const trackWidth = trackSize.width;

    let targetDistance = trackWidth * 0.85;

    if (targetSelector) {
      try {
        const target = await browser.$(targetSelector);
        if (await target.isExisting() && await target.isDisplayed()) {
          const targetLocation = await target.getLocation();
          const btnLocation = await sliderBtn.getLocation();
          targetDistance = targetLocation.x - btnLocation.x;
        }
      } catch (e) {
        logger.debug('无法获取目标位置，使用默认距离');
      }
    }

    const btnSize = await sliderBtn.getSize();
    const startX = Math.round(btnSize.width / 2);
    const startY = Math.round(btnSize.height / 2);

    if (humanLike) {
      await this._humanLikeDrag(browser, sliderBtn, targetDistance, startX, startY);
    } else {
      await sliderBtn.dragAndDrop({ x: targetDistance, y: 0 });
    }

    await browser.sleep(800);

    const currentUrl = await browser.getCurrentUrl();
    const success = !currentUrl.includes('captcha') && !currentUrl.includes('verify');

    return {
      success,
      distance: targetDistance,
      duration: Date.now() - startTime
    };
  }

  async _humanLikeDrag(browser, element, distance, startX, startY) {
    const totalSteps = 30 + Math.floor(Math.random() * 20);
    const durations = [];
    const offsets = [];

    let currentOffset = 0;
    for (let i = 0; i < totalSteps; i++) {
      const t = (i + 1) / totalSteps;
      const easeOut = 1 - Math.pow(1 - t, 3);
      const targetOffset = easeOut * distance;
      const stepOffset = targetOffset - currentOffset + (Math.random() - 0.5) * 2;

      offsets.push(Math.round(stepOffset));
      durations.push(15 + Math.random() * 25);

      currentOffset += stepOffset;
    }

    await element.moveTo({ xOffset: startX, yOffset: startY });
    await browser.sleep(100 + Math.random() * 200);

    await browser.buttonDown(0);
    await browser.sleep(50 + Math.random() * 100);

    for (let i = 0; i < offsets.length; i++) {
      await browser.moveToElement(null, offsets[i], Math.random() * 2 - 1);
      await browser.sleep(durations[i]);
    }

    const remaining = distance - currentOffset;
    if (Math.abs(remaining) > 1) {
      await browser.moveToElement(null, remaining, 0);
      await browser.sleep(50 + Math.random() * 50);
    }

    await browser.sleep(100 + Math.random() * 150);
    await browser.buttonUp(0);
  }

  getStats() {
    const imageSuccessRate = this.imageStats.total > 0
      ? (this.imageStats.success / this.imageStats.total * 100).toFixed(1) + '%'
      : 'N/A';

    const sliderSuccessRate = this.sliderStats.total > 0
      ? (this.sliderStats.success / this.sliderStats.total * 100).toFixed(1) + '%'
      : 'N/A';

    return {
      image: {
        ...this.imageStats,
        successRate: imageSuccessRate
      },
      slider: {
        ...this.sliderStats,
        successRate: sliderSuccessRate
      }
    };
  }

  async close() {
    if (this.ocrWorker && this._ocrInitialized) {
      try {
        await this.ocrWorker.terminate();
        this._ocrInitialized = false;
        this.ocrWorker = null;
        logger.info('OCR引擎已释放');
      } catch (err) {
        logger.error(`释放OCR引擎失败: ${err.message}`);
      }
    }
  }
}

let captchaInstance = null;

async function getCaptchaService() {
  if (!captchaInstance) {
    captchaInstance = new CaptchaService();
  }
  return captchaInstance;
}

module.exports = {
  CaptchaService,
  getCaptchaService,
  default: CaptchaService
};
