import * as cheerio from 'cheerio';
import logger from '../utils/logger';
import { PolicyDetail, PolicyTable, SiteConfig } from '../types';
import { cleanText, stripHtml, extractDocNumber, extractDates, md5, nowIso, truncate } from '../utils/helpers';
import repository from '../storage/repository';

export class PolicyParser {
  private siteConfig: SiteConfig;

  constructor(siteConfig: SiteConfig) {
    this.siteConfig = siteConfig;
  }

  parse(html: string, url: string): PolicyDetail {
    const siteLogger = logger.getLogger(this.siteConfig.id);
    const $ = cheerio.load(html);
    const selectors = this.siteConfig.selectors;

    const $content = $(selectors.detailContent);
    if ($content.length === 0) {
      siteLogger.warn(`Content selector not found for ${url}`);
    }

    const title = this.extractTitle($, html);
    const docNumber = this.extractDocNumber($, html, selectors.docNumber);
    const issueOrg = this.extractIssueOrg($, html, selectors.issueOrg);
    const { publishDate, effectiveDate, expiryDate } = this.extractDates($, html, selectors.effectiveDate);
    const keyClauses = this.extractKeyClauses($, $content);
    const tables = this.extractTables($, $content);
    const contentHash = md5(cleanText($content.text() || $('body').text()));

    const detail: PolicyDetail = {
      siteId: this.siteConfig.id,
      url,
      title,
      docNumber,
      issueOrg,
      publishDate,
      effectiveDate,
      expiryDate,
      keyClauses,
      tables,
      contentHash,
      rawHtml: $content.html() || html,
      extractedAt: nowIso()
    };

    siteLogger.debug(`Parsed policy: ${truncate(title, 60)}`, {
      docNumber,
      issueOrg,
      effectiveDate,
      tables: tables.length,
      clauses: keyClauses.length
    });

    return detail;
  }

  private extractTitle($: cheerio.CheerioAPI, html: string): string {
    const selectors = [
      this.siteConfig.selectors.detailContent + ' h1',
      this.siteConfig.selectors.detailContent + ' h2',
      '.article-title',
      '.title',
      '#title',
      'h1',
      'title'
    ];

    for (const sel of selectors) {
      const text = cleanText($(sel).first().text());
      if (text && text.length > 4 && text.length < 200) {
        return text;
      }
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return cleanText(titleMatch[1]).split(/[-_丨|]/)[0].trim();
    }

    return '未命名政策';
  }

  private extractDocNumber($: cheerio.CheerioAPI, html: string, selector?: string): string | undefined {
    if (selector) {
      const text = cleanText($(selector).text());
      if (text) return text;
    }

    const contentText = $(this.siteConfig.selectors.detailContent).text();
    const docNumber = extractDocNumber(contentText);
    if (docNumber) return docNumber;

    const bodyText = $('body').text();
    return extractDocNumber(bodyText) || undefined;
  }

  private extractIssueOrg($: cheerio.CheerioAPI, html: string, selector?: string): string | undefined {
    if (selector) {
      const text = cleanText($(selector).text());
      if (text) return text;
    }

    const patterns = [
      /发文机关[：:]\s*([^\n]+)/,
      /发布机构[：:]\s*([^\n]+)/,
      /印发单位[：:]\s*([^\n]+)/,
      /主办单位[：:]\s*([^\n]+)/,
      /([^省市区\s]{2,}(?:省|市|区|县)(?:人力资源和社会保障厅|人力资源和社会保障局|医疗保障局|住房公积金管理中心|人民政府))/
    ];

    const contentText = $(this.siteConfig.selectors.detailContent).text();

    for (const pattern of patterns) {
      const match = contentText.match(pattern);
      if (match) {
        return cleanText(match[1]);
      }
    }

    return undefined;
  }

  private extractDates($: cheerio.CheerioAPI, html: string, effectiveSelector?: string): {
    publishDate?: string;
    effectiveDate?: string;
    expiryDate?: string;
  } {
    const result: { publishDate?: string; effectiveDate?: string; expiryDate?: string } = {};

    const contentText = $(this.siteConfig.selectors.detailContent).text();
    const allDates = extractDates(contentText);

    if (effectiveSelector) {
      const effText = cleanText($(effectiveSelector).text());
      if (effText) {
        const effDates = extractDates(effText);
        if (effDates.length > 0) {
          result.effectiveDate = effDates[0];
        }
      }
    }

    const patterns = {
      publish: [
        /发布日期[：:]\s*([^\n]+)/,
        /发文日期[：:]\s*([^\n]+)/,
        /发布时间[：:]\s*([^\n]+)/,
        /印发日期[：:]\s*([^\n]+)/
      ],
      effective: [
        /施行日期[：:]\s*([^\n]+)/,
        /生效日期[：:]\s*([^\n]+)/,
        /实施时间[：:]\s*([^\n]+)/,
        /自([^起]+)起施行/,
        /自([^起]+)起执行/,
        /从([^起]+)起实施/
      ],
      expiry: [
        /废止日期[：:]\s*([^\n]+)/,
        /失效日期[：:]\s*([^\n]+)/,
        /有效期至[：:]\s*([^\n]+)/,
        /本通知(?:自|从)([^起]+)起废止/,
        /有效期(?:为|是)([^。]+)/
      ]
    };

    for (const pattern of patterns.publish) {
      const match = contentText.match(pattern);
      if (match) {
        const dates = extractDates(match[1]);
        if (dates.length > 0) {
          result.publishDate = dates[0];
          break;
        }
      }
    }

    if (!result.effectiveDate) {
      for (const pattern of patterns.effective) {
        const match = contentText.match(pattern);
        if (match) {
          const dates = extractDates(match[1]);
          if (dates.length > 0) {
            result.effectiveDate = dates[0];
            break;
          }
        }
      }
    }

    for (const pattern of patterns.expiry) {
      const match = contentText.match(pattern);
      if (match) {
        const dates = extractDates(match[1]);
        if (dates.length > 0) {
          result.expiryDate = dates[0];
          break;
        }
      }
    }

    return result;
  }

  private extractKeyClauses($: cheerio.CheerioAPI, $content: cheerio.Cheerio<any>): string[] {
    const clauses: string[] = [];
    const contentText = $content.text();

    const keyPatterns = [
      /[一二三四五六七八九十]+[、\.].{10,}[。\n]/g,
      /第[一二三四五六七八九十百]+条[^。]+。/g,
      /（[一二三四五六七八九十]+）[^。]+。/g,
      /\d+[、\.][^。\n]{10,}[。\n]/g
    ];

    for (const pattern of keyPatterns) {
      const matches = contentText.match(pattern);
      if (matches) {
        for (const m of matches) {
          const clean = cleanText(m);
          if (clean.length > 15 && clean.length < 500) {
            clauses.push(clean);
          }
        }
      }
    }

    const headingSelectors = ['h3', 'h4', 'strong', 'b'];
    for (const sel of headingSelectors) {
      $content.find(sel).each((_, el) => {
        const text = cleanText($(el).text());
        if (text.length > 5 && text.length < 100) {
          const nextText = cleanText($(el).nextAll('p').first().text());
          if (nextText.length > 20) {
            clauses.push(`${text}：${truncate(nextText, 150)}`);
          }
        }
      });
    }

    const uniqueClauses = [...new Set(clauses)];
    return uniqueClauses.slice(0, 20);
  }

  private extractTables($: cheerio.CheerioAPI, $content: cheerio.Cheerio<any>): PolicyTable[] {
    const tables: PolicyTable[] = [];

    $content.find('table').each((_, tableEl) => {
      const $table = $(tableEl);
      const tableTitle = cleanText($table.prev('caption').text() || $table.prev('p').text() || '');

      const headers: string[] = [];
      const rows: string[][] = [];

      $table.find('thead tr th, thead tr td').each((_, th) => {
        headers.push(cleanText($(th).text()));
      });

      let hasBodyHeader = false;
      $table.find('tbody tr, tr').each((_, tr) => {
        const $tr = $(tr);
        const cells: string[] = [];
        $tr.find('td, th').each((_, td) => {
          cells.push(cleanText($(td).text()));
        });

        if (cells.length === 0) return;

        if (!hasBodyHeader && headers.length === 0 && cells.length > 0) {
          const firstCell = cells[0];
          if (firstCell.includes('项目') || firstCell.includes('类别') || firstCell.includes('名称')) {
            headers.push(...cells);
            hasBodyHeader = true;
            return;
          }
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length > 0 || headers.length > 0) {
        tables.push({
          title: tableTitle || undefined,
          headers,
          rows
        });
      }
    });

    logger.getLogger(this.siteConfig.id).debug(`Extracted ${tables.length} tables`);
    return tables;
  }

  async saveDetail(detail: PolicyDetail): Promise<number> {
    const id = repository.insertPolicyDetail(detail);
    logger.getLogger(this.siteConfig.id).debug(`Saved policy detail: ${detail.title} (id: ${id})`);
    return id;
  }

  parseAndSave(html: string, url: string): PolicyDetail {
    const detail = this.parse(html, url);
    this.saveDetail(detail);
    return detail;
  }

  identifyTableType(table: PolicyTable): 'payment_base' | 'ratio' | 'other' {
    const headerText = table.headers.join(' ');
    const allText = table.headers.join(' ') + table.rows.flat().join(' ');

    if (/缴费基数|缴存基数|基数|缴费工资/i.test(allText)) {
      return 'payment_base';
    }
    if (/比例|费率|百分比|%/i.test(allText) && /单位|个人|企业/i.test(allText)) {
      return 'ratio';
    }
    return 'other';
  }
}

export default PolicyParser;
