'use strict';

const BasePlatformCollector = require('./basePlatform');
const { format, subDays } = require('date-fns');

class ProvincialSamplingCollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'provincial_sampling' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    try {
      const { By, until } = require('selenium-webdriver');
      const nav = this.config.selectors?.navigation || {};
      if (nav.date_range_start) {
        const start = await this.driver.findElement(By.css(nav.date_range_start));
        const end = await this.driver.findElement(By.css(nav.date_range_end));
        const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');
        const to = format(new Date(), 'yyyy-MM-dd');
        await start.clear();
        await start.sendKeys(from);
        await end.clear();
        await end.sendKeys(to);
        this.taskLogger.debug(`已设置抽检日期范围 ${from} ~ ${to}`);
      }
    } catch (err) {
      this.taskLogger.debug('日期范围设置跳过: ' + err.message);
    }
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.sample_result) {
      const t = String(rec.sample_result);
      if (/合格|pass/i.test(t) && !/不/.test(t)) rec._isPass = true;
    }
    if (rec.detail_url && !/^https?:/.test(rec.detail_url)) {
      rec.detail_url = this.config.base_url.replace(/\/$/, '') + (rec.detail_url.startsWith('/') ? '' : '/') + rec.detail_url;
    }
    return rec;
  }
}

module.exports = ProvincialSamplingCollector;
