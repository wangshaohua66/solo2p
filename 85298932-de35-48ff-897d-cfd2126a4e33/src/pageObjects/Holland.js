const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class HollandPage extends BaseScalePage {
  constructor(driver) {
    super(driver, 'HOLLAND', '霍兰德职业兴趣量表');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-HOLLAND] 开始霍兰德职业兴趣测评');
    await this._safeClick('.start-test, button[data-action="start"]');
    if (participantInfo) {
      await this._safeSendKeys('#userName, [name="username"]', participantInfo.name || '');
    }
    await this._safeClick('.confirm-user-info');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const sel = `#q_${questionIndex} .option:nth-child(${optionIndex + 1}) label`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('#nextQuestion, .nav-next, .btn-goto-next');
  }

  async submit() {
    logger.info('[page-HOLLAND] 提交霍兰德测评');
    await this._safeClick('.btn-submit-all, #submitAll');
    await this._safeClick('.modal .btn-primary, .submit-confirm');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.result-panel, .report-section, .holland-result', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.driver.findElement({ css: 'a[href*="holland"], .btn-download-report, .report-link' });
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = HollandPage;
