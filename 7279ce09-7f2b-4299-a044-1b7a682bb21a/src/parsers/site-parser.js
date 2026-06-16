import { By } from 'selenium-webdriver';
import { BaseParser } from './base-parser.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

export class TaobaoParser extends BaseParser {
  constructor(siteConfig) {
    super(siteConfig);
  }

  async parseListItem(element) {
    logger.debug(`[${this.siteName}] 淘宝拍卖定制化列表解析`);
    const data = await super.parseListItem(element);

    try {
      const statusEl = await element.findElement(By.css('.item-status'));
      const statusText = await statusEl.getText();
      data.status = statusText.trim();
      logger.debug(`[${this.siteName}] 列表状态提取成功: ${data.status}`);
    } catch (e) {
      logger.debug(`[${this.siteName}] 列表状态提取失败: ${e.message}`);
    }

    try {
      const bidCountEl = await element.findElement(By.css('.bid-count'));
      const bidCountText = await bidCountEl.getText();
      data.bidCount = this.cleanNumber(bidCountText);
      logger.debug(`[${this.siteName}] 列表出价次数提取成功: ${data.bidCount}`);
    } catch (e) {
      logger.debug(`[${this.siteName}] 列表出价次数提取失败: ${e.message}`);
    }

    return data;
  }

  async parseDetailPage(driver) {
    logger.info(`[${this.siteName}] 淘宝拍卖定制化详情页解析`);
    const data = await super.parseDetailPage(driver);

    try {
      const roundText = await this.extractField(driver, {
        selector: "//div[contains(@class, 'round')]//span[contains(text(), '第')]",
        selectorType: 'xpath',
        type: 'text',
        clean: 'text'
      });
      if (roundText) {
        const roundMatch = roundText.match(/第([一二三四五六七八九十百千\d]+)次/);
        if (roundMatch) {
          data.round = roundMatch[0];
          logger.debug(`[${this.siteName}] 拍卖轮次解析成功: ${data.round}`);
        }
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 拍卖轮次解析失败: ${e.message}`);
    }

    try {
      const assessPriceEl = await driver.findElement(By.xpath("//dt[contains(text(), '评估价')]/following-sibling::dd"));
      const assessPriceText = await assessPriceEl.getText();
      if (assessPriceText) {
        data.assessPrice = this.cleanPrice(assessPriceText);
        logger.debug(`[${this.siteName}] 评估价XPath提取成功: ${data.assessPrice}分`);
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 评估价XPath提取失败: ${e.message}`);
    }

    try {
      const areaEl = await driver.findElement(By.xpath("//li[contains(text(), '建筑面积')]/span"));
      const areaText = await areaEl.getText();
      if (areaText) {
        data.area = this.cleanArea(areaText);
        logger.debug(`[${this.siteName}] 面积XPath提取成功: ${data.area}㎡`);
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 面积XPath提取失败: ${e.message}`);
    }

    return data;
  }
}

export class JdParser extends BaseParser {
  constructor(siteConfig) {
    super(siteConfig);
  }

  async parseListItem(element) {
    logger.debug(`[${this.siteName}] 京东拍卖定制化列表解析`);
    const data = await super.parseListItem(element);

    try {
      const discountEl = await element.findElement(By.css('.jv-discount'));
      const discountText = await discountEl.getText();
      data.discountText = discountText.trim();
      logger.debug(`[${this.siteName}] 折扣信息提取成功: ${data.discountText}`);
    } catch (e) {
      logger.debug(`[${this.siteName}] 折扣信息提取失败: ${e.message}`);
    }

    try {
      const cityEl = await element.findElement(By.css('.jv-city'));
      const cityText = await cityEl.getText();
      data.city = cityText.trim();
      logger.debug(`[${this.siteName}] 城市信息提取成功: ${data.city}`);
    } catch (e) {
      logger.debug(`[${this.siteName}] 城市信息提取失败: ${e.message}`);
    }

    return data;
  }

  async parseDetailPage(driver) {
    logger.info(`[${this.siteName}] 京东拍卖定制化详情页解析`);
    const data = await super.parseDetailPage(driver);

    try {
      const priceInfo = await driver.findElements(By.css('.pm-price-info li'));
      for (const item of priceInfo) {
        try {
          const labelEl = await item.findElement(By.css('label'));
          const labelText = await labelEl.getText();
          const valueEl = await item.findElement(By.css('em, span'));
          const valueText = await valueEl.getText();

          if (labelText.includes('评估价')) {
            data.assessPrice = this.cleanPrice(valueText);
            logger.debug(`[${this.siteName}] 评估价列表提取成功: ${data.assessPrice}分`);
          } else if (labelText.includes('起拍价')) {
            data.startPrice = this.cleanPrice(valueText);
            logger.debug(`[${this.siteName}] 起拍价列表提取成功: ${data.startPrice}分`);
          } else if (labelText.includes('保证金')) {
            data.deposit = this.cleanPrice(valueText);
            logger.debug(`[${this.siteName}] 保证金提取成功: ${data.deposit}分`);
          } else if (labelText.includes('加价幅度')) {
            data.increment = this.cleanPrice(valueText);
            logger.debug(`[${this.siteName}] 加价幅度提取成功: ${data.increment}分`);
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 价格信息列表提取失败: ${e.message}`);
    }

    try {
      const detailItems = await driver.findElements(By.css('.pm-detail-info li'));
      for (const item of detailItems) {
        try {
          const text = await item.getText();
          if (text.includes('建筑面积')) {
            const areaMatch = text.match(/建筑面积[：:]\s*([\d.]+)\s*[平㎡]/);
            if (areaMatch) {
              data.area = this.cleanArea(areaMatch[1] + '㎡');
              logger.debug(`[${this.siteName}] 建筑面积正则提取成功: ${data.area}㎡`);
            }
          } else if (text.includes('房屋地址')) {
            const addrMatch = text.match(/房屋地址[：:]\s*(.+)/);
            if (addrMatch) {
              data.address = addrMatch[1].trim();
              logger.debug(`[${this.siteName}] 房屋地址正则提取成功: ${data.address}`);
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 详情信息列表提取失败: ${e.message}`);
    }

    try {
      const courtNameEl = await driver.findElement(By.css('.pm-court-info .name'));
      const courtName = await courtNameEl.getText();
      if (courtName) {
        data.court = courtName.trim();
        logger.debug(`[${this.siteName}] 法院名称提取成功: ${data.court}`);
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 法院名称提取失败: ${e.message}`);
    }

    return data;
  }
}

export class GpaiParser extends BaseParser {
  constructor(siteConfig) {
    super(siteConfig);
  }

  async parseListItem(element) {
    logger.debug(`[${this.siteName}] 公拍网定制化列表解析`);
    const data = await super.parseListItem(element);

    try {
      const itemInfos = await element.findElements(By.css('.sf-item-info span'));
      for (const info of itemInfos) {
        try {
          const text = await info.getText();
          if (text.includes('起拍价')) {
            const priceMatch = text.match(/起拍价[：:]\s*(.+)/);
            if (priceMatch) {
              data.startPrice = this.cleanPrice(priceMatch[1]);
              logger.debug(`[${this.siteName}] 列表起拍价提取成功: ${data.startPrice}分`);
            }
          } else if (text.includes('评估价')) {
            const priceMatch = text.match(/评估价[：:]\s*(.+)/);
            if (priceMatch) {
              data.assessPrice = this.cleanPrice(priceMatch[1]);
              logger.debug(`[${this.siteName}] 列表评估价提取成功: ${data.assessPrice}分`);
            }
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 列表补充信息提取失败: ${e.message}`);
    }

    return data;
  }

  async parseDetailPage(driver) {
    logger.info(`[${this.siteName}] 公拍网定制化详情页解析`);
    const data = await super.parseDetailPage(driver);

    try {
      const tableRows = await driver.findElements(By.xpath('//table//tr'));
      for (const row of tableRows) {
        try {
          const cells = await row.findElements(By.css('td, th'));
          if (cells.length >= 2) {
            const labelText = await cells[0].getText();
            const valueText = await cells[1].getText();

            if (labelText.includes('标的名称')) {
              data.title = valueText.trim();
            } else if (labelText.includes('标的地址')) {
              data.address = valueText.trim();
            } else if (labelText.includes('建筑面积')) {
              data.area = this.cleanArea(valueText);
            } else if (labelText.includes('评估价')) {
              data.assessPrice = this.cleanPrice(valueText);
            } else if (labelText.includes('起拍价')) {
              data.startPrice = this.cleanPrice(valueText);
            } else if (labelText.includes('拍卖阶段')) {
              data.round = valueText.trim();
            } else if (labelText.includes('拍卖日期')) {
              data.auctionDate = this.cleanDate(valueText);
            } else if (labelText.includes('委托法院')) {
              data.court = valueText.trim();
            } else if (labelText.includes('当前状态')) {
              data.status = valueText.trim();
            } else if (labelText.includes('出价次数')) {
              data.bidCount = this.cleanNumber(valueText);
            }
          }
        } catch (e) {
          continue;
        }
      }
      logger.debug(`[${this.siteName}] 表格数据提取完成`);
    } catch (e) {
      logger.debug(`[${this.siteName}] 表格数据提取失败: ${e.message}`);
    }

    try {
      const noticeLinks = await driver.findElements(By.xpath('//a[contains(text(), "拍卖公告")]'));
      if (noticeLinks.length > 0) {
        const href = await noticeLinks[0].getAttribute('href');
        if (href) {
          data.noticeUrl = href;
          if (!data.noticeUrl.startsWith('http')) {
            data.noticeUrl = new URL(data.noticeUrl, this.siteConfig.baseUrl).href;
          }
          logger.debug(`[${this.siteName}] 公告链接XPath提取成功: ${data.noticeUrl}`);
        }
      }
    } catch (e) {
      logger.debug(`[${this.siteName}] 公告链接XPath提取失败: ${e.message}`);
    }

    return data;
  }
}

export class DefaultParser extends BaseParser {
  constructor(siteConfig) {
    super(siteConfig);
  }
}

export default {
  TaobaoParser,
  JdParser,
  GpaiParser,
  DefaultParser
};
