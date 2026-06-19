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
      imageSelector,
      gapImageSelector,
      maxAttempts = 5,
      humanLike = true,
      successCheck = {}
    } = sliderConfig;

    this.sliderStats.total++;

    let lastResult = null;
    let offsetCorrection = 0;
    let trajectoryStyle = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.debug(`滑块验证第 ${attempt} 次尝试，偏移校正: ${offsetCorrection.toFixed(1)}px`);

      try {
        const result = await this._performSliderDrag({
          browser,
          sliderSelector,
          trackSelector,
          targetSelector,
          buttonSelector,
          imageSelector,
          gapImageSelector,
          humanLike,
          attempt,
          offsetCorrection,
          trajectoryStyle: trajectoryStyle % 4,
          successCheck
        });

        lastResult = result;

        if (result.success) {
          this.sliderStats.success++;
          logger.info(`滑块验证成功 (第${attempt}次尝试，距离: ${result.distance.toFixed(0)}px)`);
          return {
            success: true,
            attempts: attempt,
            distance: result.distance,
            duration: result.duration,
            trajectory: result.trajectory,
            verificationMethod: result.verificationMethod
          };
        }

        if (attempt < maxAttempts) {
          if (result.partialMatch) {
            offsetCorrection += (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 10);
            trajectoryStyle++;
          } else {
            offsetCorrection = (Math.random() - 0.5) * 40;
            trajectoryStyle = Math.floor(Math.random() * 4);
          }

          const waitTime = 800 + Math.random() * 1200;
          await browser.sleep(waitTime);

          try {
            const refreshBtn = await browser.$('.refresh-btn, .reload-btn, .refresh-captcha, .slider-refresh');
            if (refreshBtn && await refreshBtn.isDisplayed() && await refreshBtn.isEnabled()) {
              await refreshBtn.click();
              await browser.sleep(500 + Math.random() * 500);
            } else {
              await browser.refresh();
              await browser.sleep(1000);
            }
          } catch (e) {
            await browser.refresh();
            await browser.sleep(1000);
          }
        }
      } catch (err) {
        logger.debug(`滑块验证第 ${attempt} 次尝试异常: ${err.message}`);
        lastResult = { success: false, error: err.message };
        if (attempt < maxAttempts) {
          await browser.sleep(1000);
          try { await browser.refresh(); } catch(e) {}
          await browser.sleep(500);
        }
      }
    }

    this.sliderStats.failed++;
    logger.warn(`滑块验证失败，共尝试 ${maxAttempts} 次`);
    return {
      success: false,
      attempts: maxAttempts,
      lastResult
    };
  }

  async _performSliderDrag(options) {
    const {
      browser,
      sliderSelector,
      trackSelector,
      targetSelector,
      buttonSelector,
      imageSelector,
      gapImageSelector,
      humanLike,
      attempt = 1,
      offsetCorrection = 0,
      trajectoryStyle = 0,
      successCheck = {}
    } = options;

    const startTime = Date.now();

    const btnSel = buttonSelector || '.slider-btn, .slide-btn, .slider-button';
    const trackSel = trackSelector || '.slider-track, .slide-track, .slider-container';

    const sliderBtn = await browser.$(btnSel);
    if (!sliderBtn || !await sliderBtn.isExisting()) {
      throw new Error('滑块按钮不存在');
    }

    const track = await browser.$(trackSel);
    if (!track || !await track.isDisplayed()) {
      throw new Error('滑块轨道不可见');
    }

    const trackSize = await track.getSize();
    const trackWidth = trackSize.width;
    const btnSize = await sliderBtn.getSize();
    const btnLocation = await sliderBtn.getLocation();
    const trackLocation = await track.getLocation();

    let targetDistance = 0;
    let distanceCalculationMethod = 'default';

    if (gapImageSelector || imageSelector) {
      const calcResult = await this._calculateGapPosition(browser, {
        imageSelector,
        gapImageSelector,
        trackWidth,
        btnSize,
        trackLocation
      });
      if (calcResult.success) {
        targetDistance = calcResult.distance;
        distanceCalculationMethod = 'image_analysis';
        logger.debug(`图像分析计算滑块距离: ${targetDistance.toFixed(1)}px`);
      }
    }

    if (!targetDistance && targetSelector) {
      try {
        const target = await browser.$(targetSelector);
        if (target && await target.isExisting() && await target.isDisplayed()) {
          const targetLoc = await target.getLocation();
          targetDistance = targetLoc.x - btnLocation.x;
          distanceCalculationMethod = 'target_selector';
          logger.debug(`目标选择器计算滑块距离: ${targetDistance.toFixed(1)}px`);
        }
      } catch (e) {
        logger.debug('目标选择器获取失败，尝试其他方法');
      }
    }

    if (!targetDistance) {
      targetDistance = trackWidth * 0.78 + Math.random() * trackWidth * 0.05;
      distanceCalculationMethod = 'estimated';
      logger.debug(`估算滑块距离: ${targetDistance.toFixed(1)}px`);
    }

    targetDistance += offsetCorrection;

    targetDistance = Math.max(btnSize.width, Math.min(trackWidth - btnSize.width, targetDistance));

    const startX = Math.round(btnSize.width / 2);
    const startY = Math.round(btnSize.height / 2);

    let trajectory = null;
    if (humanLike) {
      trajectory = this._generateHumanTrajectory(targetDistance, {
        style: trajectoryStyle,
        attempt,
        totalDuration: 1200 + Math.random() * 800
      });
      await this._executeTrajectory(browser, sliderBtn, startX, startY, trajectory);
    } else {
      await sliderBtn.dragAndDrop({ x: Math.round(targetDistance), y: 0 });
    }

    await browser.sleep(600 + Math.random() * 400);

    const checkResult = await this._checkSliderSuccess(browser, {
      sliderSelector,
      buttonSelector,
      trackSelector,
      successCheck,
      previousUrl: options._previousUrl
    });

    return {
      success: checkResult.success,
      partialMatch: checkResult.partialMatch,
      distance: targetDistance,
      duration: Date.now() - startTime,
      calculationMethod: distanceCalculationMethod,
      verificationMethod: checkResult.method,
      verificationDetails: checkResult.details,
      trajectory: trajectory?.summary
    };
  }

  _generateHumanTrajectory(totalDistance, options = {}) {
    const {
      style = 0,
      attempt = 1,
      totalDuration = 1500
    } = options;

    const styles = ['ease_in_out', 'ease_out', 'bounce', 'two_phase'];
    const selectedStyle = styles[style % styles.length];

    const baseSteps = 40 + Math.floor(Math.random() * 25);
    const steps = baseSteps + attempt * 3;

    const waypoints = [];
    let currentX = 0;
    let currentY = 0;
    let currentTime = 0;

    const addWaypoint = (x, y, timeOffset) => {
      currentX += x;
      currentY += y;
      currentTime += timeOffset;
      waypoints.push({
        dx: x,
        dy: y,
        delay: timeOffset,
        totalX: currentX,
        totalY: currentY,
        totalTime: currentTime
      });
    };

    const jitterScale = 0.8 + attempt * 0.3;

    const getEaseValue = (t, type) => {
      switch (type) {
        case 'ease_in_out':
          return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        case 'ease_out':
          return 1 - Math.pow(1 - t, 3);
        case 'ease_in':
          return t * t * t;
        case 'bounce': {
          const n1 = 7.5625;
          const d1 = 2.75;
          if (t < 1 / d1) {
            return n1 * t * t;
          } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
          } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
          } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
          }
        }
        default:
          return t;
      }
    };

    let prevOffset = 0;

    if (selectedStyle === 'two_phase') {
      const phase1End = 0.75 + Math.random() * 0.15;
      const phase1Distance = totalDistance * phase1End;
      const phase1Steps = Math.floor(steps * 0.7);

      for (let i = 1; i <= phase1Steps; i++) {
        const t = i / phase1Steps;
        const easeVal = getEaseValue(t, 'ease_out');
        const targetOffset = easeVal * phase1Distance;
        const stepDelta = targetOffset - prevOffset;

        const yJitter = (Math.random() - 0.5) * 3 * jitterScale;
        const delay = 20 + Math.random() * 25;

        addWaypoint(stepDelta, yJitter, delay);
        prevOffset = targetOffset;
      }

      const pauseDelay = 80 + Math.random() * 120;
      addWaypoint(0, 0, pauseDelay);

      const phase2Distance = totalDistance - phase1Distance + (Math.random() - 0.5) * 6;
      const phase2Steps = steps - phase1Steps - 1;

      for (let i = 1; i <= phase2Steps; i++) {
        const t = i / phase2Steps;
        const easeVal = getEaseValue(t, 'ease_in_out');
        const targetOffset = easeVal * phase2Distance;
        const stepDelta = targetOffset - prevOffset + phase1Distance - prevOffset;

        const yJitter = (Math.random() - 0.5) * 2 * jitterScale;
        const delay = 15 + Math.random() * 20;

        addWaypoint(stepDelta > 0 ? stepDelta : 0.1, yJitter, delay);
        prevOffset = targetOffset;
      }
    } else {
      const easeType = selectedStyle === 'bounce' ? 'bounce' :
                       selectedStyle === 'ease_in_out' ? 'ease_in_out' : 'ease_out';

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const easeVal = getEaseValue(t, easeType);
        const targetOffset = easeVal * totalDistance;
        const stepDelta = targetOffset - prevOffset;

        let yJitter = (Math.random() - 0.5) * 2.5 * jitterScale;

        if (Math.random() < 0.05) {
          yJitter += (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
        }

        let delay = 15 + Math.random() * 25;

        if (t > 0.85) {
          delay = 10 + Math.random() * 15;
        }

        if (Math.random() < 0.03) {
          delay += 20 + Math.random() * 30;
        }

        addWaypoint(stepDelta, yJitter, delay);
        prevOffset = targetOffset;
      }

      if (Math.random() < 0.4) {
        const overshoot = (Math.random() * 4 - 1);
        if (overshoot !== 0) {
          addWaypoint(overshoot, (Math.random() - 0.5) * 2, 30 + Math.random() * 20);
          addWaypoint(-overshoot * 0.7, (Math.random() - 0.5) * 1.5, 40 + Math.random() * 30);
        }
      }
    }

    const finalCorrection = totalDistance - currentX;
    if (Math.abs(finalCorrection) > 0.5) {
      const corrSteps = Math.min(3, Math.ceil(Math.abs(finalCorrection) / 2));
      for (let i = 0; i < corrSteps; i++) {
        const ratio = (i + 1) / corrSteps;
        addWaypoint(
          finalCorrection * ratio - (i > 0 ? finalCorrection * ((i) / corrSteps) : 0),
          (Math.random() - 0.5) * 1.5,
          20 + Math.random() * 15
        );
      }
    }

    const actualDuration = waypoints.reduce((sum, wp) => sum + wp.delay, 0);
    const distanceError = Math.abs(currentX - totalDistance);

    return {
      waypoints,
      totalSteps: waypoints.length,
      totalDuration: actualDuration,
      totalDistanceX: currentX,
      totalDistanceY: currentY,
      distanceError,
      summary: {
        style: selectedStyle,
        steps: waypoints.length,
        duration: actualDuration,
        distance: currentX,
        error: distanceError,
        jitterScale
      }
    };
  }

  async _executeTrajectory(browser, element, startX, startY, trajectory) {
    const { waypoints } = trajectory;

    await element.moveTo({ xOffset: startX, yOffset: startY });
    await browser.sleep(100 + Math.random() * 250);

    if (Math.random() < 0.3) {
      await browser.moveTo({ xOffset: startX + (Math.random() - 0.5) * 3,
                             yOffset: startY + (Math.random() - 0.5) * 2 });
      await browser.sleep(50 + Math.random() * 100);
    }

    await browser.buttonDown(0);
    await browser.sleep(60 + Math.random() * 120);

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      await browser.moveToElement(null, Math.round(wp.dx), Math.round(wp.dy));
      await browser.sleep(wp.delay);

      if (i > 0 && i % 10 === 0 && Math.random() < 0.15) {
        await browser.sleep(30 + Math.random() * 50);
      }
    }

    await browser.sleep(120 + Math.random() * 200);
    await browser.buttonUp(0);
    await browser.sleep(80 + Math.random() * 120);
  }

  async _calculateGapPosition(browser, options) {
    const { imageSelector, gapImageSelector, trackWidth, btnSize, trackLocation } = options;

    try {
      const imgSel = imageSelector || '.captcha-img, #captcha-img, .slider-img, .captcha-image';
      const gapSel = gapImageSelector || '.gap-img, .slice-img, .puzzle-piece, .slider-block';

      const img = await browser.$(imgSel);
      if (!img || !await img.isDisplayed()) {
        return { success: false, reason: 'image_not_found' };
      }

      const imgSize = await img.getSize();
      const imgLocation = await img.getLocation();
      const imgWidth = imgSize.width;

      let gapX = null;
      let method = 'none';

      try {
        const gapEl = await browser.$(gapSel);
        if (gapEl && await gapEl.isExisting() && await gapEl.isDisplayed()) {
          const gapLoc = await gapEl.getLocation();
          const gapSize = await gapEl.getSize();
          gapX = gapLoc.x - imgLocation.x + gapSize.width / 2;
          method = 'gap_element';
        }
      } catch (e) {
        logger.debug('缺口元素获取失败');
      }

      if (gapX === null) {
        try {
          const canvasData = await browser.execute(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return {
              data: Array.from(imageData.data),
              width: canvas.width,
              height: canvas.height
            };
          });

          if (canvasData) {
            gapX = this._findGapInImageData(canvasData);
            if (gapX !== null) {
              method = 'canvas_analysis';
            }
          }
        } catch (e) {
          logger.debug(`Canvas分析失败: ${e.message}`);
        }
      }

      if (gapX !== null && imgWidth > 0) {
        const ratio = trackWidth / imgWidth;
        let distance = gapX * ratio;

        distance -= btnSize.width / 2;
        distance += (Math.random() - 0.5) * 2;

        distance = Math.max(0, Math.min(trackWidth - btnSize.width, distance));

        return {
          success: true,
          distance,
          gapX,
          method,
          imgWidth,
          trackWidth,
          ratio
        };
      }

      return { success: false, reason: 'gap_not_detected', method };
    } catch (err) {
      logger.debug(`缺口位置计算失败: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  _findGapInImageData(canvasData) {
    try {
      const { data, width, height } = canvasData;
      const centerY = Math.floor(height / 2);
      const rowStart = centerY - Math.floor(height * 0.1);
      const rowEnd = centerY + Math.floor(height * 0.1);

      let maxEdgeX = null;
      let maxEdgeScore = 0;

      for (let y = rowStart; y < rowEnd; y += 3) {
        let prevBrightness = null;

        for (let x = 1; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (prevBrightness !== null) {
            const diff = Math.abs(brightness - prevBrightness);
            if (diff > 30 && x > width * 0.15 && x < width * 0.85) {
              if (diff > maxEdgeScore) {
                maxEdgeScore = diff;
                maxEdgeX = x;
              }
            }
          }
          prevBrightness = brightness;
        }
      }

      if (maxEdgeX !== null && maxEdgeScore > 25) {
        return maxEdgeX;
      }

      return null;
    } catch (err) {
      logger.debug(`图像数据分析失败: ${err.message}`);
      return null;
    }
  }

  async _checkSliderSuccess(browser, options) {
    const {
      sliderSelector,
      buttonSelector,
      trackSelector,
      successCheck = {},
      previousUrl
    } = options;

    const results = {
      url_changed: false,
      element_disappeared: false,
      success_message: false,
      position_at_end: false,
      no_error: true
    };

    try {
      const currentUrl = await browser.getCurrentUrl();
      if (previousUrl && currentUrl !== previousUrl) {
        results.url_changed = true;
      }

      if (successCheck.urlPattern) {
        const urlMatch = new RegExp(successCheck.urlPattern).test(currentUrl);
        results.url_changed = results.url_changed || urlMatch;
      } else {
        const hasCaptchaInUrl = /captcha|verify|validate|slider/i.test(currentUrl);
        if (!hasCaptchaInUrl && previousUrl && currentUrl !== previousUrl) {
          results.url_changed = true;
        }
      }
    } catch (e) {
      results.url_changed = false;
    }

    try {
      const btnSel = buttonSelector || '.slider-btn, .slide-btn';
      const btn = await browser.$(btnSel);
      if (btn) {
        const isDisplayed = await btn.isDisplayed().catch(() => false);
        const isEnabled = await btn.isEnabled().catch(() => false);
        const hasSuccessClass = await btn.getAttribute('class').then(cls =>
          /success|pass|ok|done|complete/i.test(cls || '')
        ).catch(() => false);

        results.element_disappeared = !isDisplayed;
        results.success_message = results.success_message || hasSuccessClass;

        if (isDisplayed && isEnabled) {
          const btnLoc = await btn.getLocation().catch(() => null);
          const track = await browser.$(trackSelector || '.slider-track');
          if (track && btnLoc) {
            const trackSize = await track.getSize().catch(() => ({ width: 0 }));
            const trackLoc = await track.getLocation().catch(() => ({ x: 0 }));
            const btnX = btnLoc.x - trackLoc.x;
            results.position_at_end = btnX > trackSize.width * 0.85;
          }
        }
      } else {
        results.element_disappeared = true;
      }
    } catch (e) {
      logger.debug(`元素检测失败: ${e.message}`);
    }

    try {
      const successSelectors = [
        '.success, .alert-success, .toast-success',
        '.verify-success, .captcha-success, .slider-success',
        '[class*="success"][class*="captcha"], [class*="success"][class*="verify"]',
        '.passed, .valid, .passed-verify'
      ];

      for (const sel of successSelectors) {
        const el = await browser.$(sel);
        if (el && await el.isDisplayed().catch(() => false)) {
          results.success_message = true;
          break;
        }
      }
    } catch (e) {
      logger.debug(`成功消息检测失败: ${e.message}`);
    }

    try {
      const errorSelectors = [
        '.error, .alert-error, .toast-error',
        '.verify-fail, .captcha-fail, .slider-fail',
        '[class*="fail"][class*="captcha"], [class*="fail"][class*="verify"]',
        '.error-tip, .error-message, .tip-error'
      ];

      for (const sel of errorSelectors) {
        const el = await browser.$(sel);
        if (el && await el.isDisplayed().catch(() => false)) {
          results.no_error = false;
          break;
        }
      }
    } catch (e) {
      logger.debug(`错误消息检测失败: ${e.message}`);
    }

    if (successCheck.customCheck) {
      try {
        const customResult = await browser.execute(successCheck.customCheck);
        if (customResult) {
          results.custom_check = true;
        }
      } catch (e) {
        logger.debug(`自定义检查失败: ${e.message}`);
      }
    }

    const positiveSignals = [
      results.url_changed,
      results.success_message,
      results.element_disappeared,
      results.custom_check
    ].filter(Boolean).length;

    const negativeSignals = [!results.no_error ? 1 : 0].filter(Boolean).length;

    const isSuccess = positiveSignals >= 2 && negativeSignals === 0;
    const isPartial = positiveSignals === 1 || (positiveSignals >= 1 && results.position_at_end);

    let method = 'multi_factor';
    if (results.success_message) method = 'success_message';
    else if (results.url_changed) method = 'url_changed';
    else if (results.element_disappeared && results.position_at_end) method = 'element_position';

    return {
      success: isSuccess,
      partialMatch: isPartial,
      method,
      details: results,
      score: positiveSignals - negativeSignals
    };
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
