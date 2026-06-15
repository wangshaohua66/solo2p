'use strict';

const BasePlatformCollector = require('./basePlatform');

class JiangsuApprovalCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'east_jiangsu_approval' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (dataType === 'license_expiry' && nav.expiry_query) {
        const sub = await this.driver.findElement(By.css(nav.expiry_query)).catch(() => null);
        if (sub) await sub.click();
      }
    } catch (_) {}
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.status && /即将到期|到期|即将失效/.test(rec.status)) {
      rec.expiry_warning = true;
    }
    if (rec.expiry_date && !rec.publish_date) rec.publish_date = rec.expiry_date;
    return rec;
  }
}

module.exports = JiangsuApprovalCollector;
