const BaseScalePage = require('./BaseScalePage');
const logger = require('../logger');

class SCL90Page extends BaseScalePage {
  constructor(driver) {
    super(driver, 'SCL90', 'SCL-90症状自评量表');
    this.pageMode = 'single-long';
  }

  async startAssessment(participantInfo) {
    logger.info('[page-SCL90] 开始SCL-90症状自评');
    await this._safeClick('#startSCL90, .start-btn');
    if (participantInfo) {
      await this._safeSendKeys('#respondentName', participantInfo.name || '');
    }
    await this._safeClick('.btn-continue');
    return true;
  }

  async selectScaleOption(questionIndex, optionIndex) {
    const score = Math.min(optionIndex, 4);
    const sel = `.item-${questionIndex} [data-value="${score}"], .symptom-${questionIndex} .likert-${score}`;
    return this._safeClick(sel);
  }

  async goToNextPage() {
    return this._safeClick('.scroll-next, .btn-section-next');
  }

  async submit() {
    logger.info('[page-SCL90] 提交SCL-90测评');
    await this._safeClick('#submitSCL90, .btn-finish');
    await this._safeClick('.warning-confirm .btn-yes');
    return true;
  }

  async isCompleted() {
    return this._elementExists('.scl90-result, .symptom-summary, .assessment-finished', 5000);
  }

  async getReportUrl() {
    try {
      const el = await this.driver.findElement({ css: 'a.download-pdf, .btn-export-report, [href*="scl90"]' });
      return el.getAttribute('href');
    } catch (e) { return null; }
  }
}

module.exports = SCL90Page;
