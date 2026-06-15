'use strict';

const BasePlatformCollector = require('./basePlatform');

class ZhejiangApprovalCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'east_zhejiang_approval' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (dataType === 'gsp_cert' && nav.gsp_tab) {
        const tab = await this.driver.findElement(By.css(nav.gsp_tab)).catch(() => null);
        if (tab) await tab.click();
      } else if (nav.biz_license_tab) {
        const tab = await this.driver.findElement(By.css(nav.biz_license_tab)).catch(() => null);
        if (tab) await tab.click();
      }
      if (nav.date_filter) {
        const f = await this.driver.findElement(By.css(nav.date_filter)).catch(() => null);
        if (f) await f.click();
      }
      await new Promise((r) => setTimeout(r, 1500));
    } catch (_) {}
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.valid_to && !rec.expiry_date) rec.expiry_date = rec.valid_to;
    if (rec.cert_status && /失效|撤销|注销/.test(rec.cert_status)) {
      rec.cert_invalid = true;
    }
    return rec;
  }
}

module.exports = ZhejiangApprovalCollector;
