import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { createSiteLogger } from './logger.js';

class SiteParser {
  constructor(siteConfig) {
    this.site = siteConfig;
    this.logger = createSiteLogger(siteConfig.id, siteConfig.name);
    this.listSelector = siteConfig.listSelector || {};
    this.detailSelector = siteConfig.detailSelector || {};
    this.baseUrl = siteConfig.url || '';
  }

  parseList(html) {
    const $ = cheerio.load(html);
    const { container, items, title, link, date: dateSel, changeFlag } = this.listSelector;

    const result = [];
    const $container = container ? $(container) : $('body');

    if ($container.length === 0) {
      this.logger.warn(`列表容器选择器未找到: ${container}`);
      return result;
    }

    const $items = items ? $container.find(items) : $container.children();

    if ($items.length === 0) {
      this.logger.warn(`列表项选择器未找到: ${items}`);
      return result;
    }

    $items.each((index, element) => {
      const $item = $(element);

      let itemTitle = '';
      let itemLink = '';
      let itemDate = '';
      let hasChange = false;
      let isChange = false;
      let isClarification = false;

      if (title) {
        const $title = $item.find(title).first();
        itemTitle = $title.text().trim();
      }

      if (link) {
        const $link = $item.find(link).first();
        itemLink = $link.attr('href') || '';
        if (itemLink && !itemLink.startsWith('http')) {
          itemLink = this.resolveUrl(itemLink);
        }
        if (!itemTitle) {
          itemTitle = $link.text().trim();
        }
      }

      if (dateSel) {
        const $date = $item.find(dateSel).first();
        itemDate = $date.text().trim();
      }

      if (changeFlag) {
        const $flag = $item.find(changeFlag);
        hasChange = $flag.length > 0;
        if (hasChange) {
          const flagText = $flag.text().trim();
          isChange = flagText.includes('变更') || flagText.includes('修改');
          isClarification = flagText.includes('补遗') || flagText.includes('答疑') || flagText.includes('澄清');
        }
      }

      if (itemTitle || itemLink) {
        result.push({
          title: itemTitle,
          link: itemLink,
          publishDate: itemDate ? this.parseDate(itemDate) : null,
          publishDateRaw: itemDate,
          hasChange,
          isChange,
          isClarification,
          siteId: this.site.id,
          siteName: this.site.name
        });
      }
    });

    this.logger.debug(`列表解析完成, 共 ${result.length} 条公告`);
    return result;
  }

  parseDetail(html, listItem = null) {
    const $ = cheerio.load(html);
    const sel = this.detailSelector;

    const result = {
      title: listItem?.title || '',
      projectNo: '',
      budget: null,
      budgetRaw: '',
      bidDeadline: null,
      bidDeadlineRaw: '',
      openTime: null,
      openTimeRaw: '',
      qualification: '',
      contact: '',
      content: '',
      link: listItem?.link || '',
      siteId: this.site.id,
      siteName: this.site.name,
      hasChange: listItem?.hasChange || false,
      isChange: listItem?.isChange || false,
      isClarification: listItem?.isClarification || false,
      publishDate: listItem?.publishDate || null,
      publishDateRaw: listItem?.publishDateRaw || '',
      parsedAt: new Date().toISOString()
    };

    if (sel.title) {
      const $title = $(sel.title).first();
      const titleText = $title.text().trim();
      if (titleText) {
        result.title = titleText;
      }
    }

    if (sel.projectNo) {
      const $projectNo = $(sel.projectNo).first();
      result.projectNo = $projectNo.text().replace(/项目编号[:：]?\s*/i, '').trim();
    }

    if (sel.budget) {
      const $budget = $(sel.budget).first();
      const budgetText = $budget.text().trim();
      result.budgetRaw = budgetText;
      result.budget = this.parseBudget(budgetText);
    }

    if (sel.bidDeadline) {
      const $deadline = $(sel.bidDeadline).first();
      const deadlineText = $deadline.text().trim();
      result.bidDeadlineRaw = deadlineText;
      result.bidDeadline = this.parseDate(deadlineText);
    }

    if (sel.openTime) {
      const $openTime = $(sel.openTime).first();
      const openTimeText = $openTime.text().trim();
      result.openTimeRaw = openTimeText;
      result.openTime = this.parseDate(openTimeText);
    }

    if (sel.qualification) {
      const $qualification = $(sel.qualification).first();
      result.qualification = $qualification.text().trim();
    }

    if (sel.contact) {
      const $contact = $(sel.contact).first();
      result.contact = $contact.text().trim();
    }

    if (!result.projectNo) {
      result.projectNo = this.extractProjectNo($.text());
    }
    if (!result.budget) {
      const budgetInfo = this.extractBudget($.text());
      if (budgetInfo) {
        result.budget = budgetInfo.value;
        result.budgetRaw = budgetInfo.raw;
      }
    }
    if (!result.bidDeadline) {
      const deadlineInfo = this.extractDeadline($.text());
      if (deadlineInfo) {
        result.bidDeadline = deadlineInfo.value;
        result.bidDeadlineRaw = deadlineInfo.raw;
      }
    }
    if (!result.openTime) {
      const openTimeInfo = this.extractOpenTime($.text());
      if (openTimeInfo) {
        result.openTime = openTimeInfo.value;
        result.openTimeRaw = openTimeInfo.raw;
      }
    }

    result.content = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);

    this.logger.debug(`详情解析完成: ${result.title}`);
    return result;
  }

  resolveUrl(relativeUrl) {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }

    try {
      const base = new URL(this.baseUrl);
      if (relativeUrl.startsWith('/')) {
        return `${base.origin}${relativeUrl}`;
      } else {
        const pathname = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
        return `${base.origin}${pathname}${relativeUrl}`;
      }
    } catch (e) {
      return relativeUrl;
    }
  }

  parseDate(dateStr) {
    if (!dateStr) return null;

    const cleaned = dateStr.trim().replace(/[年月日./]/g, '-').replace(/\s+/g, ' ');

    const patterns = [
      /(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{1,2})?(:\d{1,2})?/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
      /(\d{2})-(\d{2})-(\d{4})/,
      /(\d{1,2})月(\d{1,2})日/
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let year, month, day, hour = 0, minute = 0;

        if (pattern.source.includes('\\d{4}') && match[1].length === 4) {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
          if (match[4]) hour = parseInt(match[4]);
          if (match[5]) minute = parseInt(match[5]);
        } else if (match[3] && match[3].length === 4) {
          year = parseInt(match[3]);
          month = parseInt(match[1]);
          day = parseInt(match[2]);
        } else {
          const now = new Date();
          year = now.getFullYear();
          month = parseInt(match[1]);
          day = parseInt(match[2]);
        }

        const date = dayjs(`${year}-${month}-${day} ${hour}:${minute || 0}`);
        if (date.isValid()) {
          return date.toISOString();
        }
      }
    }

    return null;
  }

  parseBudget(budgetStr) {
    if (!budgetStr) return null;

    const cleaned = budgetStr.replace(/\s+/g, '').replace(/,/g, '');

    const patterns = [
      /预算金额?[:：]?\s*([\d.]+)\s*(万元|亿元|元|万|亿)/i,
      /([\d.]+)\s*(万元|亿元|元|万|亿)/,
      /¥\s*([\d.]+)/,
      /￥\s*([\d.]+)/
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2] || '元';

        if (isNaN(value)) continue;

        let amountInYuan = value;
        if (unit.includes('亿')) {
          amountInYuan = value * 100000000;
        } else if (unit.includes('万')) {
          amountInYuan = value * 10000;
        }

        return {
          value: amountInYuan,
          unit: '元',
          display: this.formatBudget(amountInYuan)
        };
      }
    }

    return null;
  }

  formatBudget(amountInYuan) {
    if (amountInYuan === null || amountInYuan === undefined) return '';

    if (amountInYuan >= 100000000) {
      return `${(amountInYuan / 100000000).toFixed(2)}亿元`;
    } else if (amountInYuan >= 10000) {
      return `${(amountInYuan / 10000).toFixed(2)}万元`;
    } else {
      return `${amountInYuan.toFixed(2)}元`;
    }
  }

  extractProjectNo(text) {
    if (!text) return '';

    const patterns = [
      /项目编号[:：]\s*([A-Za-z0-9\-_]+)/,
      /项目编号[:：]([^\s，。；、]+)/,
      /招标编号[:：]\s*([A-Za-z0-9\-_]+)/,
      /采购编号[:：]\s*([A-Za-z0-9\-_]+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return '';
  }

  extractBudget(text) {
    if (!text) return null;

    const patterns = [
      /预算金额?[:：]?\s*([\d.，]+\s*(?:万元|亿元|万|亿|元))/i,
      /采购预算[:：]?\s*([\d.，]+\s*(?:万元|亿元|万|亿|元))/i,
      /最高限价[:：]?\s*([\d.，]+\s*(?:万元|亿元|万|亿|元))/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = this.parseBudget(match[1]);
        if (value) {
          return {
            raw: match[1],
            value
          };
        }
      }
    }

    return null;
  }

  extractDeadline(text) {
    if (!text) return null;

    const patterns = [
      /投标截止时间?[:：]?\s*([^，。；、\n]+(?:日|号)(?:\s*\d{1,2}[:：时点]\d{1,2}分?)?)/i,
      /递交投标文件截止时间?[:：]?\s*([^，。；、\n]+(?:日|号)(?:\s*\d{1,2}[:：时点]\d{1,2}分?)?)/i,
      /投标截止[:：]?\s*([^，。；、\n]+(?:日|号)(?:\s*\d{1,2}[:：时点]\d{1,2}分?)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = this.parseDate(match[1]);
        if (value) {
          return {
            raw: match[1].trim(),
            value
          };
        }
      }
    }

    return null;
  }

  extractOpenTime(text) {
    if (!text) return null;

    const patterns = [
      /开标时间?[:：]?\s*([^，。；、\n]+(?:日|号)(?:\s*\d{1,2}[:：时点]\d{1,2}分?)?)/i,
      /开标地点及时间?[:：]?\s*([^，。；、\n]+(?:日|号)(?:\s*\d{1,2}[:：时点]\d{1,2}分?)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = this.parseDate(match[1]);
        if (value) {
          return {
            raw: match[1].trim(),
            value
          };
        }
      }
    }

    return null;
  }
}

export default SiteParser;
