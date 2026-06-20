const { By, until } = require('selenium-webdriver');
const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class MBTIPage extends BaseScalePage {
  constructor(driver) {
    super(driver, 'MBTI', 'MBTI人格类型量表');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-MBTI] 开始MBTI测评');
    await this._safeClick('.btn-start, #startBtn, .start-assessment');
    if (participantInfo) {
      await this._safeSendKeys('input[name="name"], #participantName', participantInfo.name || '');
      await this._safeSendKeys('input[name="employeeId"], #employeeId', participantInfo.employee_id || '');
    }
    await this._safeClick('.btn-confirm, #confirmBtn');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const qSel = `.question-item:nth-child(${questionIndex + 1})`;
    const optSel = `${qSel} .option-item:nth-child(${optionIndex + 1}) input, ${qSel} label:nth-child(${optionIndex + 1})`;
    return this._safeClick(optSel);
  }

  async goToNextPage() {
    return this._safeClick('.next-page, #nextPage, .btn-next');
  }

  async submit() {
    logger.info('[page-MBTI] 提交MBTI测评');
    await this._safeClick('.btn-submit, #submitBtn, .submit-assessment');
    try {
      await this._safeClick('.btn-confirm-submit, #confirmSubmit');
    } catch (e) { /* noop */ }
    return true;
  }

  async isCompleted() {
    return this._elementExists('.result-container, .report-link, .completed-banner', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.driver.wait(until.elementLocated(By.css('.report-link a, .download-report, a[href*="report"]')), 15000);
      return el.getAttribute('href');
    } catch (e) {
      return null;
    }
  }
}

module.exports = MBTIPage;
