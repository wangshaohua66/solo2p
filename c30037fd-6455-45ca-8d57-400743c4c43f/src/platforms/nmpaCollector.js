'use strict';

const BasePlatformCollector = require('./basePlatform');

class NMPACollector extends BasePlatformCollector {
  constructor(config, options = {}) {
    super(config, { ...options, platformKey: 'nmpa' });
  }

  async navigateToDataType(dataType) {
    await super.navigateToDataType(dataType);
    if (dataType === 'recall') {
      try {
        const { By, until } = require('selenium-webdriver');
        const urgentFilter = await this.driver.findElement(By.css('.filter-bar .urgent-tag')).catch(() => null);
        if (urgentFilter) await urgentFilter.click();
        this.taskLogger.debug('已勾选紧急召回筛选');
      } catch (_) {}
    }
  }

  _extractRow($, row, cfg) {
    const rec = super._extractRow($, row, cfg);
    if (rec.urgency) {
      if (rec.urgency.includes('一') || /紧急|停止/.test(rec.urgency)) rec.recall_level = '一级召回';
      else if (rec.urgency.includes('二')) rec.recall_level = '二级召回';
      else if (rec.urgency.includes('三')) rec.recall_level = '三级召回';
    }
    if (rec.detail_url && /^\//.test(rec.detail_url)) {
      rec.detail_url = this.config.base_url + rec.detail_url;
    }
    return rec;
  }
}

module.exports = NMPACollector;
