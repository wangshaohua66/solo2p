const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class EQPage extends BaseScalePage {
  constructor(browser) {
    super(browser, 'EQ', '情商EQ测评量表');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-EQ] 开始情商EQ测评');
    await this._safeClick('.eq-start-btn, #startEQ');
    if (participantInfo) {
      await this._safeSendKeys('#eq_tester, [name="eq_name"]', participantInfo.name || '');
    }
    await this._safeClick('.eq-continue');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const sel = `.eq-q-${questionIndex} .choice-${optionIndex + 1}, .eq-item-${questionIndex} [data-choice="${optionIndex}"]`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.eq-next, #eqNext, .btn-next-eq');
  }

  async submit() {
    logger.info('[page-EQ] 提交EQ测评');
    await this._safeClick('.eq-final-submit, #submitEQ');
    await this._safeClick('.eq-modal .btn-primary');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.eq-result-page, .eq-report, .eq-assessment-done', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.browser.$('a.eq-report-link, .download-eq-pdf, [href*="eq"]');
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = EQPage;
