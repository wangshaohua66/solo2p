const axios = require('axios');
const config = require('../../config/config');
const { retry } = require('./retry');
const logger = require('./logger');

class CaptchaSolver {
  constructor() {
    this.apiKey = config.captcha.apiKey;
    this.apiUrl = config.captcha.apiUrl;
  }

  async solveTextCaptcha(imageBuffer) {
    if (!this.apiKey || !this.apiUrl) {
      logger.warn('未配置打码平台API，使用OCR本地识别（模拟）', 'Captcha');
      return this._mockSolve(imageBuffer);
    }

    try {
      return await retry(
        async () => {
          const base64 = imageBuffer.toString('base64');
          const response = await axios.post(
            this.apiUrl,
            {
              key: this.apiKey,
              method: 'base64',
              body: base64,
              type: '1005',
            },
            { timeout: 30000 }
          );

          if (response.data.status === 1) {
            return response.data.request;
          }
          throw new Error(response.data.info || '打码失败');
        },
        {
          maxRetries: 2,
          baseDelay: 3000,
        }
      );
    } catch (error) {
      logger.error(`打码失败: ${error.message}`, 'Captcha');
      return null;
    }
  }

  async solveSlideCaptcha(page, slideSelector, trackSelector) {
    try {
      const slideBtn = await page.$(slideSelector);
      if (!slideBtn) {
        throw new Error('未找到滑块元素');
      }

      const track = await page.$(trackSelector);
      const trackBox = await track.boundingBox();
      const btnBox = await slideBtn.boundingBox();

      if (!trackBox || !btnBox) {
        throw new Error('无法获取滑块或轨道位置');
      }

      const distance = trackBox.width - btnBox.width;
      const startX = btnBox.x + btnBox.width / 2;
      const startY = btnBox.y + btnBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      const trajectory = this._generateHumanTrajectory(distance);

      for (const point of trajectory) {
        await page.mouse.move(startX + point.x, startY + point.y, {
          steps: 1,
        });
        await this._randomDelay(10, 30);
      }

      await page.mouse.up();
      return true;
    } catch (error) {
      logger.error(`滑块验证失败: ${error.message}`, 'Captcha');
      return false;
    }
  }

  _generateHumanTrajectory(distance) {
    const points = [];
    const steps = Math.floor(distance / 5) + Math.floor(Math.random() * 20);

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const easeProgress = this._easeOutBounce(progress);
      const x = distance * easeProgress;
      const y = (Math.random() - 0.5) * 8;

      points.push({ x, y });
    }

    const overshoot = Math.floor(Math.random() * 15) + 5;
    points.push({ x: distance + overshoot, y: (Math.random() - 0.5) * 5 });
    points.push({ x: distance - 3, y: (Math.random() - 0.5) * 2 });
    points.push({ x: distance, y: 0 });

    return points;
  }

  _easeOutBounce(x) {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  }

  _randomDelay(min, max) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min);
    });
  }

  _mockSolve(imageBuffer) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        resolve(result);
      }, 1000);
    });
  }
}

module.exports = CaptchaSolver;
