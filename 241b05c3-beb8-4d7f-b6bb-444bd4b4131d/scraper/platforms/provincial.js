const BasePlatform = require('./base');
const logger = require('../utils/logger');
const config = require('../../config/config');

class ProvincialPlatform extends BasePlatform {
  constructor(browserPool) {
    super('省公共资源交易平台', config.platforms.provincial, browserPool);
    this.username = process.env.PROVINCIAL_USERNAME || '';
    this.password = process.env.PROVINCIAL_PASSWORD || '';
  }

  async _doLogin(page) {
    if (!this.username || !this.password) {
      logger.warn('未配置省交易平台账号，使用匿名访问', this.name);
      return true;
    }

    try {
      await page.goto(this.config.loginUrl, { waitUntil: 'domcontentloaded' });
      await page.fill('input[name="username"], #username, .username-input', this.username);
      await page.fill('input[name="password"], #password, .password-input', this.password);

      const hasSlideCaptcha = await page.$('.slide-captcha, .verify-slide, #slide');
      if (hasSlideCaptcha) {
        logger.info('检测到滑块验证码，正在处理...', this.name);
        await this.captchaSolver.solveSlideCaptcha(page, '.slider-btn', '.slider-track');
        await page.waitForTimeout(1000);
      }

      const captchaInput = await page.$('input[name="captcha"], #captcha');
      if (captchaInput) {
        const captchaImg = await page.$('img.captcha, #captchaImg');
        if (captchaImg) {
          const screenshot = await captchaImg.screenshot();
          const result = await this.captchaSolver.solveTextCaptcha(screenshot);
          if (result) {
            await captchaInput.fill(result);
          }
        }
      }

      await Promise.all([
        page.click('button[type="submit"], .login-btn, #loginBtn'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      ]);

      const loggedIn = await page.evaluate(() => {
        return !!document.querySelector('.user-name, .avatar, .user-center, .logout-btn');
      });

      return loggedIn;
    } catch (error) {
      logger.debug(`登录过程异常: ${error.message}`, this.name);
      return false;
    }
  }

  async fetchList(pageNum = 1, contextWrapper) {
    const page = await this.browserPool.newPage(contextWrapper);
    const results = [];
    let hasNext = false;
    let totalCount = 0;

    try {
      const url = `${this.config.listUrl}?page=${pageNum}`;
      await this.safeNavigate(page, url);

      await this._waitForDynamicContent(page);

      const html = await page.content();
      const $ = this.parseHTML(html);

      totalCount = parseInt($('.total-count, .total, #totalCount').text()) || 0;

      const items = $('.list-item, .project-item, table tr.item, .result-item');
      logger.info(`第 ${pageNum} 页解析到 ${items.length} 条记录`, this.name);

      items.each((i, el) => {
        const $el = $(el);
        const title = $el.find('a, .project-name, .title').text().trim();
        const href = $el.find('a').attr('href');
        const projectNo = $el.find('.project-no, .code, .bid-no').text().trim();
        const purchaser = $el.find('.purchaser, .buyer, .unit').text().trim();
        const date = $el.find('.date, .time, .publish-date').text().trim();
        const price = $el.find('.price, .budget, .amount').text().trim();

        if (title) {
          const fullUrl = href ? (href.startsWith('http') ? href : new URL(href, this.config.baseUrl).href) : '';
          const budget = parseFloat(price.replace(/[^0-9.]/g, '')) || null;

          results.push({
            projectNo: projectNo || this._generateProjectNo(title),
            projectName: title,
            purchaser: purchaser || null,
            budget,
            noticeUrl: fullUrl,
            publishDate: date,
            platform: 'provincial',
          });
        }
      });

      hasNext = await this._hasNextPage(page, pageNum);

      return { items: results, hasNext, total: totalCount };
    } catch (error) {
      logger.error(`抓取第 ${pageNum} 页失败: ${error.message}`, this.name);
      throw error;
    } finally {
      await page.close();
    }
  }

  async _waitForDynamicContent(page) {
    try {
      await page.waitForSelector('.list-item, .project-item, table', {
        timeout: 10000,
      });

      await this.waitForPageStable(page, 500, 3000);
    } catch (e) {
      logger.debug('等待动态内容超时，尝试继续解析', this.name);
    }
  }

  async _hasNextPage(page, currentPage) {
    try {
      return await page.evaluate((current) => {
        const nextBtn = document.querySelector('.next, .next-page, .pagination .next');
        if (!nextBtn) return false;
        if (nextBtn.classList.contains('disabled')) return false;

        const pages = document.querySelectorAll('.pagination li, .page-item');
        if (pages.length > 0) {
          const lastPage = pages[pages.length - 1];
          const lastPageNum = parseInt(lastPage.textContent);
          if (!isNaN(lastPageNum) && current >= lastPageNum) return false;
        }

        return true;
      }, currentPage);
    } catch (e) {
      return false;
    }
  }

  _generateProjectNo(title) {
    const hash = title.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    return `PROV-${Math.abs(hash).toString(36).toUpperCase()}`;
  }

  _extractProjectNo(title) {
    const patterns = [
      /[（(]([A-Z0-9-]+)[)）]/g,
      /项目编号[：:]*\s*([A-Z0-9-]+)/gi,
      /招标编号[：:]*\s*([A-Z0-9-]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0].replace(/[（()）项目编号招标编号：:\s]/g, '');
      }
    }

    return null;
  }

  async fetchDetail(url, contextWrapper) {
    const page = await this.browserPool.newPage(contextWrapper);

    try {
      await this.safeNavigate(page, url);
      await this._waitForDynamicContent(page);

      const html = await page.content();
      const $ = this.parseHTML(html);

      const title = $('.detail-title, h1, .project-title, .title').first().text().trim();
      const content = $('.detail-content, .content, #content, .article').text().trim();

      const projectNo = this._extractFromContent(content, [/项目编号[：:]\s*([^\n\r，。；\s]+)/gi, /招标编号[：:]\s*([^\n\r，。；\s]+)/gi]);
      const purchaser = this._extractFromContent(content, [/采购人[：:]\s*([^\n\r，。；]+)/gi, /招标人[：:]\s*([^\n\r，。；]+)/gi, /业主单位[：:]\s*([^\n\r，。；]+)/gi]);
      const budget = this._extractBudget(content);

      const bidResults = this._extractBidResults($, content);

      return {
        projectNo: projectNo || this._generateProjectNo(title),
        projectName: title,
        purchaser,
        budget,
        content,
        bidResults,
        html,
        url,
      };
    } catch (error) {
      logger.error(`抓取详情失败 ${url}: ${error.message}`, this.name);
      throw error;
    } finally {
      await page.close();
    }
  }

  _extractFromContent(content, patterns) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0].replace(/[^\s：:]+[：:]\s*/, '').trim();
      }
    }
    return null;
  }

  _extractBudget(content) {
    const patterns = [
      /预算金额[：:]\s*([\d,.]+)\s*([万亿]?)元/gi,
      /采购预算[：:]\s*([\d,.]+)\s*([万亿]?)元/gi,
      /最高限价[：:]\s*([\d,.]+)\s*([万亿]?)元/gi,
      /项目预算[：:]\s*([\d,.]+)\s*([万亿]?)元/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0) {
        const match = matches[0];
        const numStr = match[1] || '';
        const unit = match[2] || '';
        let amount = parseFloat(numStr.replace(/,/g, ''));

        if (unit.includes('万')) amount *= 10000;
        if (unit.includes('亿')) amount *= 100000000;

        if (!isNaN(amount)) return amount;
      }
    }
    return null;
  }

  _extractBidResults($, content) {
    const results = [];

    const tables = $('table');
    tables.each((i, table) => {
      const rows = $(table).find('tr');
      if (rows.length < 3) return;

      const headerRow = rows.first();
      const headers = [];
      headerRow.find('th, td').each((j, cell) => {
        headers.push($(cell).text().trim());
      });

      const bidderIdx = headers.findIndex(h => /投标人|供应商|竞标|单位名称/.test(h));
      const amountIdx = headers.findIndex(h => /报价|金额|价格|投标价/.test(h));
      const rankIdx = headers.findIndex(h => /排名|名次|排序|第.*名/.test(h));
      const scoreIdx = headers.findIndex(h => /得分|评分/.test(h));

      if (bidderIdx === -1 || amountIdx === -1) return;

      rows.slice(1).each((j, row) => {
        const cells = [];
        $(row).find('td').each((k, cell) => {
          cells.push($(cell).text().trim());
        });

        if (cells.length < 2) return;

        const bidderName = cells[bidderIdx];
        const amountStr = cells[amountIdx] || '';
        const rankStr = rankIdx >= 0 ? cells[rankIdx] : '';
        const scoreStr = scoreIdx >= 0 ? cells[scoreIdx] : '';

        const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
        const rank = parseInt(rankStr) || (j + 1);
        const score = parseFloat(scoreStr) || null;

        if (bidderName && !isNaN(amount)) {
          results.push({
            bidderName,
            bidAmount: amount,
            winAmount: rank === 1 ? amount : null,
            rank,
            score,
            isWinner: rank === 1,
          });
        }
      });
    });

    if (results.length === 0) {
      results.push(...this._extractFromText(content));
    }

    return results;
  }

  _extractFromText(content) {
    const results = [];

    const winnerPattern = /(?:中标|成交|预中标)(?:供应商|单位|人)[：:]\s*([^\n\r，。；]+)/gi;
    const amountPattern = /(?:中标|成交|预中标)(?:金额|价格|价)[：:]\s*([\d,.]+)\s*([万亿]?)元/gi;

    const winners = [...content.matchAll(winnerPattern)];
    const amounts = [...content.matchAll(amountPattern)];

    for (let i = 0; i < winners.length; i++) {
      const name = winners[i][1]?.trim();
      if (!name) continue;

      let amount = null;
      if (amounts[i]) {
        const numStr = amounts[i][1];
        const unit = amounts[i][2] || '';
        amount = parseFloat(numStr.replace(/,/g, ''));
        if (unit.includes('万')) amount *= 10000;
        if (unit.includes('亿')) amount *= 100000000;
      }

      results.push({
        bidderName: name,
        bidAmount: amount,
        winAmount: amount,
        rank: i + 1,
        isWinner: true,
      });
    }

    return results;
  }

  async fetchBidResults(projectId, contextWrapper) {
    const url = `${this.config.baseUrl}/result/${projectId}`;
    const detail = await this.fetchDetail(url, contextWrapper);
    return detail.bidResults || [];
  }
}

module.exports = ProvincialPlatform;
