const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class DISCPage extends BaseScalePage {
  constructor(browser) {
    super(browser, 'DISC', 'DISC行为风格测验');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-DISC] 开始DISC行为风格测验');
    await this._safeClick('.disc-start, #beginDisc');
    if (participantInfo) {
      await this._safeSendKeys('#disc_name, [name="tester"]', participantInfo.name || '');
    }
    await this._safeClick('.disc-begin-test');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const sel = `.disc-row-${questionIndex} .option-${optionIndex + 1}, #d${questionIndex}o${optionIndex}`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.disc-next, #nextDisc, .btn-next-group');
  }

  async submit() {
    logger.info('[page-DISC] 提交DISC测验');
    await this._safeClick('.disc-submit, #submitDisc');
    await this._safeClick('.disc-confirm .btn-ok');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.disc-result, .disc-report, .disc-finish', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.browser.$('a.disc-pdf-link, .download-disc-report, [href*="disc"]');
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = DISCPage;
