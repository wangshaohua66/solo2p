const { By, until } = require('selenium-webdriver');
const logger = require('../logger');

class BaseScalePage {
  constructor(driver, scaleCode, scaleName) {
    this.driver = driver;
    this.scaleCode = scaleCode;
    this.scaleName = scaleName;
    this.timeout = 30000;
  }

  async navigateTo(assessmentUrl) {
    logger.debug(`[page-${this.scaleCode}] 导航到测评页面: ${assessmentUrl}`);
    await this.driver.get(assessmentUrl);
    await this.driver.wait(until.elementLocated(By.css('body')), this.timeout);
    await this._waitForPageReady();
    return true;
  }

  async _waitForPageReady() {
    return this.driver.wait(async () => {
      const state = await this.driver.executeScript('return document.readyState');
      return state === 'complete' || state === 'interactive';
    }, this.timeout);
  }

  async _safeClick(selector, timeout = 10000) {
    try {
      const el = await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
      await this.driver.wait(until.elementIsVisible(el), timeout);
      await this.driver.wait(until.elementIsEnabled(el), timeout);
      await el.click();
      return true;
    } catch (err) {
      logger.warn(`[page-${this.scaleCode}] 点击失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async _safeSendKeys(selector, text, timeout = 10000) {
    try {
      const el = await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
      await el.clear();
      await el.sendKeys(text);
      return true;
    } catch (err) {
      logger.warn(`[page-${this.scaleCode}] 输入失败 ${selector}: ${err.message}`);
      return false;
    }
  }

  async _elementExists(selector, timeout = 3000) {
    try {
      await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
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
      await this._sleep(500);
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
        const options = await this.driver.findElements(By.css(sel));
        if (options.length > 0) {
          const groups = this._groupOptionsByQuestion(options);
          for (const group of groups) {
            const pickIdx = strategy === 'first' ? 0
              : strategy === 'last' ? group.length - 1
              : Math.floor(Math.random() * group.length);
            try {
              const el = group[pickIdx];
              await this.driver.executeScript('arguments[0].scrollIntoView({block: "center"})', el);
              await el.click();
              answered++;
              await this._sleep(50);
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
    return groups.length > 0 ? groups : [elements];
  }

  async _isLastPage() {
    const nextSelectors = ['.next-btn:not([disabled])', '#next:not([disabled])', 'a.next:not(.disabled)'];
    for (const sel of nextSelectors) {
      try {
        const el = await this.driver.findElement(By.css(sel));
        if (el) return false;
      } catch (e) { /* continue */ }
    }
    return true;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = BaseScalePage;
