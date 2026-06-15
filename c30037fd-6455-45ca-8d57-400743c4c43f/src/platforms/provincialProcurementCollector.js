'use strict';

const BasePlatformCollector = require('./basePlatform');

class ProvincialProcurementCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'provincial_procurement' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (nav.category_filter) {
        const filter = await this.driver.findElement(By.css(nav.category_filter)).catch(() => null);
        if (filter) {
          const opt = await filter.findElement(By.css('option[value="all"]')).catch(() => null);
          if (opt) await opt.click();
        }
      }
      this.taskLogger.debug('集采平台导航完成');
    } catch (_) {}
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.price) {
      const num = Number(String(rec.price).replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) rec.bid_price = num;
    }
    if (rec.winner) rec.bid_winner = rec.winner;
    return rec;
  }
}

module.exports = ProvincialProcurementCollector;
