'use strict';

const BasePlatformCollector = require('./basePlatform');
const { format, subDays } = require('date-fns');

class ADRMonitorCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'adr_monitor' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (nav.date_from && nav.date_to) {
        const from = format(subDays(new Date(), 60), 'yyyy-MM-dd');
        const to = format(new Date(), 'yyyy-MM-dd');
        const df = await this.driver.findElement(By.css(nav.date_from)).catch(() => null);
        const dt = await this.driver.findElement(By.css(nav.date_to)).catch(() => null);
        if (df) { await df.clear(); await df.sendKeys(from); }
        if (dt) { await dt.clear(); await dt.sendKeys(to); }
      }
      if (nav.serious_adr) {
        const tag = await this.driver.findElement(By.css(nav.serious_adr)).catch(() => null);
        if (tag) await tag.click();
      }
      if (nav.query_submit) {
        const btn = await this.driver.findElement(By.css(nav.query_submit)).catch(() => null);
        if (btn) await btn.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
      this.taskLogger.debug('ADR监测中心导航完成');
    } catch (err) {
      this.taskLogger.debug('ADR导航细节跳过: ' + err.message);
    }
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.severity) rec.adr_severity = rec.severity;
    if (rec.type) rec.adr_type = rec.type;
    if (rec.report_count) {
      const n = Number(String(rec.report_count).replace(/[^0-9]/g, ''));
      if (!isNaN(n)) rec.report_count = n;
    }
    if (rec.detail_url && /^\//.test(rec.detail_url)) {
      rec.detail_url = this.config.base_url + rec.detail_url;
    }
    return rec;
  }
}

module.exports = ADRMonitorCollector;
