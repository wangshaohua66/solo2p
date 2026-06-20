const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class RavenIQPage extends BaseScalePage {
  constructor(driver) {
    super(driver, 'IQ', '瑞文标准推理测验(IQ)');
    this.pageMode = 'pagination';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-IQ] 开始瑞文标准推理测验');
    await this._safeClick('.raven-start, #startRaven');
    if (participantInfo) {
      await this._safeSendKeys('#raven_subject, [name="raven_name"]', participantInfo.name || '');
    }
    await this._safeClick('.raven-start-confirmed');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const sel = `.raven-q-${questionIndex + 1} .ans-${optionIndex + 1}, #raven_${questionIndex + 1}_opt${optionIndex + 1}`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.raven-next, #ravenNext, .btn-next-raven');
  }

  async submit() {
    logger.info('[page-IQ] 提交瑞文推理测验');
    await this._safeClick('.raven-submit, #submitRaven');
    await this._safeClick('.raven-confirm-dialog .btn-confirm');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.raven-result, .raven-report, .raven-finished', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.driver.findElement({ css: 'a.raven-pdf, .download-raven-report, [href*="raven"]' });
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = RavenIQPage;
