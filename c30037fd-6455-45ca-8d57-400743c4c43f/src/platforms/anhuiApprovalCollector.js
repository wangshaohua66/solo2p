'use strict';

const BasePlatformCollector = require('./basePlatform');

class AnhuiApprovalCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'east_anhui_approval' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (dataType === 'gsp_inspection' && nav.gsp_notice) {
        const el = await this.driver.findElement(By.css(nav.gsp_notice)).catch(() => null);
        if (el) await el.click();
      } else if (dataType === 'license_change' && nav.license_notice) {
        const el = await this.driver.findElement(By.css(nav.license_notice)).catch(() => null);
        if (el) await el.click();
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (_) {}
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.gsp_result) {
      if (/不合格|严重缺陷|不符合/.test(rec.gsp_result)) rec.gsp_failed = true;
    }
    return rec;
  }
}

module.exports = AnhuiApprovalCollector;
