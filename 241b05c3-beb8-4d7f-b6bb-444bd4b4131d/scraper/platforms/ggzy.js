const BasePlatform = require('./base');
const logger = require('../utils/logger');
const config = require('../../config/config');

class GgzyPlatform extends BasePlatform {
  constructor(browserPool) {
    super('中国政府采购网', config.platforms.ggzy, browserPool);
    this.username = process.env.GGZY_USERNAME || '';
    this.password = process.env.GGZY_PASSWORD || '';
  }

  async _doLogin(page) {
    if (!this.username || !this.password) {
      logger.warn('未配置政府采购网账号，使用匿名访问', this.name);
      return true;
    }

    try {
      await page.goto(this.config.loginUrl, { waitUntil: 'domcontentloaded' });
      await page.fill('#username', this.username);
      await page.fill('#password', this.password);

      const captchaInput = await page.$('#captcha');
      if (captchaInput) {
        const captchaImg = await page.$('#captcha_img');
        if (captchaImg) {
          const screenshot = await captchaImg.screenshot();
          const result = await this.captchaSolver.solveTextCaptcha(screenshot);
          if (result) {
            await captchaInput.fill(result);
          }
        }
      }

      await Promise.all([
        page.click('#login-btn, .login-btn, button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      ]);

      const loggedIn = await page.evaluate(() => {
        return !!document.querySelector('.user-info, .username, .logout');
      });

      return loggedIn;
    } catch (error) {
      logger.debug(`登录过程异常: ${error.message}`, this.name);
      return false;
    }
  }

  async fetchList(pageNum = 1, contextWrapper) {
    let page = await this.browserPool.newPage(contextWrapper);
    const results = [];
    let hasNext = false;

    try {
      const listUrl = pageNum === 1
        ? this.config.listUrl
        : this.config.listUrl.replace('index.htm', `index_${pageNum - 1}.htm`);

      const result = await this.safeNavigate(page, listUrl, contextWrapper);
      if (result?.page) {
        page = result.page;
      }

      const html = await page.content();
      const $ = this.parseHTML(html);

      const items = $('.vF_detail_list li, .list li, tr.list-item');
      logger.info(`第 ${pageNum} 页解析到 ${items.length} 条记录`, this.name);

      items.each((i, el) => {
        const $el = $(el);
        const title = $el.find('a').text().trim();
        const href = $el.find('a').attr('href');
        const date = $el.find('.date, .time, span:last-child').text().trim();

        if (title && href) {
          const projectNo = this._extractProjectNo(title, href);
          results.push({
            projectNo,
            projectName: title,
            noticeUrl: href.startsWith('http') ? href : new URL(href, this.config.baseUrl).href,
            publishDate: date,
            platform: 'ggzy',
          });
        }
      });

      hasNext = await page.$('.next, .next-page, a:contains("下一页")') !== null;

      return { items: results, hasNext, total: results.length };
    } catch (error) {
      logger.error(`抓取第 ${pageNum} 页失败: ${error.message}`, this.name);
      throw error;
    } finally {
      await page.close();
    }
  }

  _extractProjectNo(title, url) {
    let projectNo = '';

    const patterns = [
      /[（(]([A-Z0-9-]+)[)）]/g,
      /项目编号[：:]*\s*([A-Z0-9-]+)/gi,
      /编号[：:]\s*([A-Z0-9-]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        projectNo = match[0].replace(/[（()）项目编号：:\s]/g, '');
        break;
      }
    }

    if (!projectNo) {
      const urlMatch = url.match(/\/(\d+)\.htm/);
      if (urlMatch) {
        projectNo = `GGZY-${urlMatch[1]}`;
      }
    }

    return projectNo || `GGZY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  async fetchDetail(url, contextWrapper) {
    let page = await this.browserPool.newPage(contextWrapper);

    try {
      const result = await this.safeNavigate(page, url, contextWrapper);
      if (result?.page) {
        page = result.page;
      }

      const html = await page.content();
      const $ = this.parseHTML(html);

      const title = $('.vF_detail_title, h1, .title').text().trim();
      const content = $('.vF_detail_content, .content, #content').text().trim();
      const purchaser = this._extractPurchaser(content);
      const budget = this._extractBudget(content);

      const bidResults = this._extractBidResults($, content);

      const projectNo = this._extractProjectNo(title, url);

      return {
        projectNo,
        projectName: title,
        purchaser,
        budget,
        content,
        bidResults,
        html: html,
        url,
      };
    } catch (error) {
      logger.error(`抓取详情失败 ${url}: ${error.message}`, this.name);
      throw error;
    } finally {
      await page.close();
    }
  }

  _extractPurchaser(content) {
    const patterns = [
      /采购人[：:]\s*([^\n\r，。；]+)/gi,
      /采购单位[：:]\s*([^\n\r，。；]+)/gi,
      /招标人[：:]\s*([^\n\r，。；]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0].replace(/采购人[：:]\s*|采购单位[：:]\s*|招标人[：:]\s*/gi, '').trim();
      }
    }
    return null;
  }

  _extractBudget(content) {
    const patterns = [
      /预算金额[：:]\s*([\d,.]+)\s*万?元/gi,
      /采购预算[：:]\s*([\d,.]+)\s*万?元/gi,
      /总预算[：:]\s*([\d,.]+)\s*万?元/gi,
      /最高限价[：:]\s*([\d,.]+)\s*万?元/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const numStr = match[0].replace(/[^0-9.]/g, '');
        let amount = parseFloat(numStr);
        if (match[0].includes('万')) {
          amount *= 10000;
        }
        return amount;
      }
    }
    return null;
  }

  _extractBidResults($, content) {
    const results = [];
    const tables = $('table');

    tables.each((i, table) => {
      const rows = $(table).find('tr');
      if (rows.length < 2) return;

      const headers = [];
      rows.first().find('th, td').each((j, cell) => {
        headers.push($(cell).text().trim());
      });

      const hasBidder = headers.some(h => /投标人|供应商|公司|单位/.test(h));
      const hasAmount = headers.some(h => /报价|金额|价格|投标/.test(h));
      const hasRank = headers.some(h => /排名|名次|排序/.test(h));

      if (hasBidder && hasAmount) {
        rows.slice(1).each((j, row) => {
          const cells = [];
          $(row).find('td').each((k, cell) => {
            cells.push($(cell).text().trim());
          });

          if (cells.length >= 2) {
            const bidderName = cells[headers.findIndex(h => /投标人|供应商/.test(h))] || cells[0];
            const amountStr = cells[headers.findIndex(h => /报价|金额/.test(h))] || cells[1];
            const rankStr = hasRank ? cells[headers.findIndex(h => /排名|名次/.test(h))] : '';

            const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
            const rank = parseInt(rankStr) || null;

            if (bidderName && !isNaN(amount)) {
              results.push({
                bidderName,
                bidAmount: amount,
                rank,
                isWinner: rank === 1,
              });
            }
          }
        });
      }
    });

    if (results.length === 0) {
      const winnerPatterns = [
        /中标供应商[：:]\s*([^\n\r，。；]+)/gi,
        /成交供应商[：:]\s*([^\n\r，。；]+)/gi,
        /预中标单位[：:]\s*([^\n\r，。；]+)/gi,
      ];

      for (const pattern of winnerPatterns) {
        const match = content.match(pattern);
        if (match) {
          const name = match[0].replace(/中标供应商[：:]\s*|成交供应商[：:]\s*|预中标单位[：:]\s*/gi, '').trim();
          if (name) {
            results.push({
              bidderName: name,
              isWinner: true,
              rank: 1,
            });
            break;
          }
        }
      }

      const amountPatterns = [
        /中标金额[：:]\s*([\d,.]+)\s*万?元/gi,
        /成交金额[：:]\s*([\d,.]+)\s*万?元/gi,
      ];

      for (const pattern of amountPatterns) {
        const match = content.match(pattern);
        if (match && results.length > 0) {
          const numStr = match[0].replace(/[^0-9.]/g, '');
          let amount = parseFloat(numStr);
          if (match[0].includes('万')) {
            amount *= 10000;
          }
          results[0].winAmount = amount;
          results[0].bidAmount = amount;
          break;
        }
      }
    }

    return results;
  }

  async fetchAnnouncements(type = 'bid', pageNum = 1, contextWrapper) {
    const urls = {
      bid: `${this.config.baseUrl}/cggg/dfgg/index.htm`,
      win: `${this.config.baseUrl}/cggg/dfgg/index.htm`,
    };

    let url = urls[type] || urls.bid;
    if (pageNum > 1) {
      url = url.replace('index.htm', `index_${pageNum - 1}.htm`);
    }

    return this.fetchList(pageNum, contextWrapper);
  }
}

module.exports = GgzyPlatform;
