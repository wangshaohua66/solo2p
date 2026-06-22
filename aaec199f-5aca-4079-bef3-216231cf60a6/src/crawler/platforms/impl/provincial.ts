import { Page } from 'playwright';
import { BasePlatformAdapter } from '../base';
import { PlatformConfig, AnnouncementListItem, Announcement } from '../../../types';
import { logger } from '../../../utils/logger';
import * as dayjs from 'dayjs';

export class ProvincialPlatformAdapter extends BasePlatformAdapter {
  private loggedIn: boolean = false;

  constructor(config: PlatformConfig) {
    super(config);
  }

  async login(): Promise<boolean> {
    if (!this.config.requiresLogin || !this.config.loginConfig) {
      this.loggedIn = true;
      return true;
    }

    if (this.loggedIn) {
      return true;
    }

    const cookiesLoaded = await this.loadCookies();
    if (cookiesLoaded) {
      const testPage = await this.createPage();
      try {
        const isLoggedIn = await this.isLoggedIn(testPage);
        if (isLoggedIn) {
          this.loggedIn = true;
          await testPage.close();
          return true;
        }
      } catch (error) {
        logger.warn(`[${this.config.name}] Cookie验证失败，重新登录: ${(error as Error).message}`);
      }
      await testPage.close();
    }

    return this.withRetry(
      async () => this.performLogin(),
      '登录',
      this.config.loginConfig.loginUrl
    );
  }

  private async performLogin(): Promise<boolean> {
    const page = await this.createPage();
    const loginConfig = this.config.loginConfig!;

    try {
      await this.safeNavigate(page, loginConfig.loginUrl);

      await page.fill(loginConfig.usernameSelector, loginConfig.username);
      await page.fill(loginConfig.passwordSelector, loginConfig.password);

      if (loginConfig.captchaSelector) {
        const captcha = await this.resolveCaptcha(page, loginConfig.captchaSelector);
        if (captcha) {
          await page.fill('input[name="captcha"], #captchaInput, .captcha-input', captcha);
        }
      }

      await page.click(loginConfig.submitSelector);
      await page.waitForSelector(loginConfig.successIndicator, { timeout: 10000 });

      this.loggedIn = true;
      await this.saveCookies();

      return true;
    } catch (error) {
      logger.error(`[${this.config.name}] 登录失败: ${(error as Error).message}`);
      throw error;
    } finally {
      await page.close();
    }
  }

  async isLoggedIn(page: Page): Promise<boolean> {
    if (!this.config.loginConfig) return true;

    try {
      await this.safeNavigate(page, this.config.baseUrl);
      await page.waitForSelector(this.config.loginConfig.successIndicator, {
        timeout: 5000,
        state: 'visible'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async fetchList(pageNum: number): Promise<AnnouncementListItem[]> {
    return this.withRetry(
      () => this.fetchListInternal(pageNum),
      `列表页第${pageNum}页`,
      this.getListUrl(pageNum)
    );
  }

  private getListUrl(pageNum: number): string {
    const url = new URL(this.config.listUrl);
    if (this.config.pagination.pageParam) {
      url.searchParams.set(this.config.pagination.pageParam, pageNum.toString());
    }
    return url.toString();
  }

  private async fetchListInternal(pageNum: number): Promise<AnnouncementListItem[]> {
    const page = await this.createPage();
    const selectors = this.config.selectors;

    try {
      const url = this.getListUrl(pageNum);
      await this.safeNavigate(page, url, this.config.timeout.listPage);

      await this.waitForDynamicContent(page, selectors.listContainer);

      const items = await page.$$eval(
        selectors.listItems,
        (elements, selectors) => {
          return elements.map(el => {
            const titleEl = el.querySelector(selectors.itemTitle);
            const linkEl = el.querySelector(selectors.itemLink);
            const timeEl = el.querySelector(selectors.itemTime);

            return {
              title: titleEl?.textContent?.trim() || '',
              detailUrl: linkEl?.getAttribute('href') || '',
              publishTime: timeEl?.textContent?.trim() || ''
            };
          });
        },
        selectors
      );

      const listItems: AnnouncementListItem[] = [];
      for (const item of items) {
        if (item.title && item.detailUrl) {
          listItems.push({
            title: item.title,
            detailUrl: this.normalizeUrl(item.detailUrl),
            publishTime: this.normalizeDate(item.publishTime),
            announcementType: this.detectAnnouncementType(item.title)
          });
        }
      }

      logger.debug(`[${this.config.name}] 第${pageNum}页获取${listItems.length}条公告`);
      return listItems;
    } finally {
      await page.close();
    }
  }

  async fetchDetail(url: string): Promise<Announcement | null> {
    return this.withRetry(
      () => this.fetchDetailInternal(url),
      '详情页',
      url
    );
  }

  private async fetchDetailInternal(url: string): Promise<Announcement | null> {
    const page = await this.createPage();
    const selectors = this.config.selectors;

    try {
      await this.safeNavigate(page, url, this.config.timeout.detailPage);
      await this.waitForDynamicContent(page, selectors.detailContent);

      const title = await page.title();
      const content = await page.locator(selectors.detailContent).innerText();

      const projectName = selectors.projectName
        ? await this.safeTextContent(page, selectors.projectName)
        : this.extractProjectName(title, content);

      const projectNumber = selectors.projectNumber
        ? await this.safeTextContent(page, selectors.projectNumber)
        : this.extractProjectNumber(content);

      const tenderee = selectors.tenderee
        ? await this.safeTextContent(page, selectors.tenderee)
        : this.extractTenderee(content);

      const tenderDeadline = selectors.tenderDeadline
        ? await this.safeTextContent(page, selectors.tenderDeadline)
        : this.extractTenderDeadline(content);

      const budgetAmount = selectors.budgetAmount
        ? await this.safeTextContent(page, selectors.budgetAmount)
        : this.extractBudgetAmount(content);

      const contactInfo = selectors.contactInfo
        ? await this.safeTextContent(page, selectors.contactInfo)
        : this.extractContactInfo(content);

      const attachmentUrls = selectors.attachments
        ? await page.$$eval(
            selectors.attachments,
            (elements: Element[]) => elements.map(el => el.getAttribute('href') || '')
          )
        : this.extractAttachmentUrls(content);

      const publishTime = this.extractPublishTime(content);

      const announcement: Announcement = {
        fingerprint: this.generateFingerprint(url, title),
        platformId: this.config.id,
        platformName: this.config.name,
        announcementType: this.detectAnnouncementType(title),
        projectCategory: this.detectProjectCategory(title, content),
        title,
        publishTime: this.normalizeDate(publishTime),
        projectName,
        projectNumber,
        tenderee,
        tenderDeadline: this.normalizeDate(tenderDeadline),
        budgetAmount: this.parseAmount(budgetAmount),
        budgetCurrency: 'CNY',
        contactName: this.extractContactName(contactInfo),
        contactPhone: this.extractContactPhone(contactInfo),
        contactEmail: this.extractContactEmail(contactInfo),
        attachmentUrls: attachmentUrls.filter(u => u).map(u => this.normalizeUrl(u)),
        content,
        detailUrl: url,
        region: this.config.region,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };

      return announcement;
    } finally {
      await page.close();
    }
  }

  private async safeTextContent(page: Page, selector: string): Promise<string> {
    try {
      const locator = page.locator(selector).first();
      return await locator.innerText({ timeout: 2000 });
    } catch {
      return '';
    }
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';

    const cleanStr = dateStr
      .replace(/[年月]/g, '-')
      .replace(/[日号]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const formats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD',
      'MM-DD-YYYY',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY/MM/DD'
    ];

    for (const format of formats) {
      const parsed = dayjs(cleanStr, format);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD HH:mm:ss');
      }
    }

    return dateStr;
  }

  private parseAmount(amountStr: string): number | undefined {
    if (!amountStr) return undefined;

    const cleanStr = amountStr
      .replace(/[,，]/g, '')
      .replace(/[^\d.]/g, '');

    const amount = parseFloat(cleanStr);
    if (isNaN(amount)) return undefined;

    if (amountStr.includes('万元') || amountStr.includes('万')) {
      return amount * 10000;
    }
    if (amountStr.includes('亿元') || amountStr.includes('亿')) {
      return amount * 100000000;
    }

    return amount;
  }

  private extractProjectName(title: string, content: string): string {
    const patterns = [
      /项目名称[：:]\s*([^\n\r]+)/,
      /工程名称[：:]\s*([^\n\r]+)/,
      /采购项目名称[：:]\s*([^\n\r]+)/,
      /项目概况[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return title.replace(/【.*?】|\(.*?\)|\[.*?\]/g, '').trim();
  }

  private extractProjectNumber(content: string): string {
    const patterns = [
      /项目编号[：:]\s*([\w\-]+)/,
      /招标编号[：:]\s*([\w\-]+)/,
      /采购编号[：:]\s*([\w\-]+)/,
      /交易编号[：:]\s*([\w\-]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractTenderee(content: string): string {
    const patterns = [
      /招标人[：:]\s*([^\n\r]+)/,
      /采购人[：:]\s*([^\n\r]+)/,
      /建设单位[：:]\s*([^\n\r]+)/,
      /出让人[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractTenderDeadline(content: string): string {
    const patterns = [
      /投标截止时间[：:]\s*([^\n\r]+)/,
      /报价截止时间[：:]\s*([^\n\r]+)/,
      /响应文件递交截止[：:]\s*([^\n\r]+)/,
      /开标时间[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractBudgetAmount(content: string): string {
    const patterns = [
      /预算金额[：:]\s*([^\n\r]+)/,
      /最高限价[：:]\s*([^\n\r]+)/,
      /招标控制价[：:]\s*([^\n\r]+)/,
      /采购预算[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractContactInfo(content: string): string {
    const patterns = [
      /联系方式[：:]\s*([\s\S]*?)(?=\n\n|\n[A-Z][A-Z_]*[：:])/,
      /联系人信息[：:]\s*([\s\S]*?)(?=\n\n)/,
      /联系事项[：:]\s*([\s\S]*?)(?=\n\n)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return content;
  }

  private extractContactName(contactInfo: string): string {
    const patterns = [
      /联系人[：:]\s*([^\n\r]+)/,
      /项目联系人[：:]\s*([^\n\r]+)/,
      /姓名[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = contactInfo.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractContactPhone(contactInfo: string): string {
    const phonePattern = /1[3-9]\d{9}|0\d{2,3}-?\d{7,8}/g;
    const matches = contactInfo.match(phonePattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    return '';
  }

  private extractContactEmail(contactInfo: string): string {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = contactInfo.match(emailPattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
    return '';
  }

  private extractPublishTime(content: string): string {
    const patterns = [
      /发布时间[：:]\s*([^\n\r]+)/,
      /公告发布时间[：:]\s*([^\n\r]+)/,
      /信息发布时间[：:]\s*([^\n\r]+)/,
      /发布日期[：:]\s*([^\n\r]+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }

    return dayjs().format('YYYY-MM-DD HH:mm:ss');
  }

  private extractAttachmentUrls(content: string): string[] {
    const urlPattern = /https?:\/\/[^\s"<>]+?\.(pdf|doc|docx|xls|xlsx|zip|rar)/gi;
    const matches = content.match(urlPattern);
    return matches || [];
  }
}
