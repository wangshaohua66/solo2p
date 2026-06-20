const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class BigFivePage extends BaseScalePage {
  constructor(browser) {
    super(browser, 'BIG5', '大五人格量表');
    this.pageMode = 'single-long';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-BIG5] 开始大五人格测评');
    await this._safeClick('.btn-start, #start');
    if (participantInfo) {
      await this._safeSendKeys('input[name="name"]', participantInfo.name || '');
    }
    await this._safeClick('.btn-begin');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const likertScores = [1, 2, 3, 4, 5];
    const score = likertScores[Math.min(optionIndex, 4)];
    const sel = `.question[data-idx="${questionIndex}"] [data-score="${score}"]`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.btn-next, #nextBtn, .pagination-next');
  }

  async submit() {
    logger.info('[page-BIG5] 提交大五人格测评');
    await this._safeClick('.btn-final-submit, #finalSubmit');
    await this._safeClick('.confirm-dialog .btn-ok');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.finish-page, .assessment-result, .download-btn', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.browser.$('a.report-pdf, .pdf-download, [href*=".pdf"]');
      await el.waitForExist({ timeout: 15000 });
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = BigFivePage;
