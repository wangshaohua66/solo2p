'use strict';

const BasePlatformCollector = require('./basePlatform');

class ShanghaiApprovalCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'east_shanghai_approval' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (nav.quick_expiry) {
        const quick = await this.driver.findElement(By.css(nav.quick_expiry)).catch(() => null);
        if (quick) await quick.click();
      }
      if (nav.search_filter_license) {
        const f = await this.driver.findElement(By.css(nav.search_filter_license)).catch(() => null);
        if (f) await f.click();
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (_) {}
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.expiry && !rec.expiry_date) rec.expiry_date = rec.expiry;
    if (rec.holder && !rec.license_owner) rec.license_owner = rec.holder;
    return rec;
  }
}

module.exports = ShanghaiApprovalCollector;
