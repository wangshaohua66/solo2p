const logger = require('../logger');

class BaseScalePage {
  constructor(browser, scaleCode, scaleName) {
    this.browser = browser;
    this.scaleCode = scaleCode;
    this.scaleName = scaleName;
    this.timeout = 30000;
  }

  async navigateTo(assessmentUrl) {
    logger.debug(`[page-${this.scaleCode}] 导航到测评页面: ${assessmentUrl}`);
    await this.browser.url(assessmentUrl);
    await this.browser.waitUntil(async () => {
      const state = await this.browser.execute(() => document.readyState);
      return state === 'complete' || state === 'interactive';
    }, { timeout: this.timeout, timeoutMsg: '页面加载超时' });
    return true;
  }

  async _safeClick(selector, timeout = 10000) {
    try {
      const el = await this.browser.$(selector);
      await el.waitForExist({ timeout });
      await el.waitForDisplayed({ timeout });
      await el.waitForClickable({ timeout });
      await el.scrollIntoView({ block: 'center' });
      await el.click();
      return true;
    } catch (err) {
      logger.warn(`[page-${this.scaleCode}] 点击失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async _safeSendKeys(selector, text, timeout = 10000) {
    try {
      const el = await this.browser.$(selector);
      await el.waitForExist({ timeout });
      await el.clearValue();
      await el.setValue(text);
      return true;
    } catch (err) {
      logger.warn(`[page-${this.scaleCode}] 输入失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async _elementExists(selector, timeout = 3000) {
    try {
      const el = await this.browser.$(selector);
      await el.waitForExist({ timeout });
      return true;
    } catch (e) {
      return false;
    }
  }

  async startAssessment(participantInfo) {
    throw new Error('子类必须实现 startAssessment 方法');
  }

  async selectScaleOption(questionIndex, optionIndex) {
    throw new Error('子类必须实现 selectScaleOption 方法');
  }

  async goToNextPage() {
    throw new Error('子类必须实现 goToNextPage 方法');
  }

  async submit() {
    throw new Error('子类必须实现 submit 方法');
  }

  async isCompleted() {
    throw new Error('子类必须实现 isCompleted 方法');
  }

  async getReportUrl() {
    throw new Error('子类必须实现 getReportUrl 方法');
  }

  async fillAllAnswersAuto(optionStrategy = 'random') {
    logger.info(`[page-${this.scaleCode}] 开始自动填写答案，策略: ${optionStrategy}`);
    let page = 0;
    const maxPages = 50;
    while (page < maxPages) {
      const answered = await this._answerCurrentPage(optionStrategy);
      if (answered === 0) {
        logger.info(`[page-${this.scaleCode}] 当前页无题目，尝试提交或翻页`);
        if (await this._isLastPage()) {
          break;
        }
      }
      const moved = await this.goToNextPage();
      if (!moved) break;
      page++;
      await this.browser.pause(500);
    }
    logger.info(`[page-${this.scaleCode}] 自动填写完成，共 ${page} 页`);
    return true;
  }

  async _answerCurrentPage(strategy) {
    const optionSelectors = [
      'input[type="radio"]', 'input[type="checkbox"]',
      '.option-item', '.answer-option', '[data-option]', '.radio-group label'
    ];
    let answered = 0;
    for (const sel of optionSelectors) {
      try {
        const options = await this.browser.$$(sel);
        if (options && options.length > 0) {
          const groups = this._groupOptionsByQuestion(options);
          for (const group of groups) {
            const pickIdx = strategy === 'first' ? 0
              : strategy === 'last' ? group.length - 1
              : Math.floor(Math.random() * group.length);
            try {
              const el = group[pickIdx];
              await el.scrollIntoView({ block: 'center' });
              await el.click();
              answered++;
              await this.browser.pause(50);
            } catch (e) { /* skip */ }
          }
          if (answered > 0) break;
        }
      } catch (e) { /* skip selector */ }
    }
    return answered;
  }

  _groupOptionsByQuestion(elements) {
    const groups = [];
    const current = [];
    for (const el of elements) {
      current.push(el);
      if (current.length >= 4) {
        groups.push([...current]);
        current.length = 0;
      }
    }
    if (current.length > 0) groups.push([...current]);
    return groups.length > 0 ? groups : [elements.filter(Boolean)];
  }

  async _isLastPage() {
    const nextSelectors = ['.next-btn:not([disabled])', '#next:not([disabled])', 'a.next:not(.disabled)'];
    for (const sel of nextSelectors) {
      try {
        const el = await this.browser.$(sel);
        const exists = await el.isExisting();
        if (exists) {
          const enabled = await el.isEnabled().catch(() => false);
          if (enabled) return false;
        }
      } catch (e) { /* continue */ }
    }
    return true;
  }
}

module.exports = BaseScalePage;
