const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class PF16Page extends BaseScalePage {
  constructor(browser) {
    super(browser, 'PF16', '16PF卡特尔人格量表');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-PF16] 开始16PF卡特尔人格测评');
    await this._safeClick('.button-start-16pf, #startBtn');
    if (participantInfo) {
      await this._safeSendKeys('[name="subjectName"], #candidate_name', participantInfo.name || '');
      await this._safeSendKeys('[name="subjectId"], #candidate_id', participantInfo.employee_id || '');
    }
    await this._safeClick('.btn-start-confirmed');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const optLetter = ['a', 'b', 'c'][Math.min(optionIndex, 2)];
    const sel = `.q-${questionIndex} .opt-${optLetter} label, #q${questionIndex}_${optLetter}`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.btn-next-page, #goNext, .page-nav-next');
  }

  async submit() {
    logger.info('[page-PF16] 提交16PF测评');
    await this._safeClick('.btn-save-submit, #submitAllButton');
    await this._safeClick('.confirm-submit-dialog .primary-btn');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.pf16-report, .final-result, .test-completed', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.browser.$('a.pdf-report, .btn-download-pdf, [href*="16pf"]');
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = PF16Page;
