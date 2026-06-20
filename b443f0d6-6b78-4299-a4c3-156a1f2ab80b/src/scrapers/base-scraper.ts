import { WebDriver, By, until } from 'selenium-webdriver';
import { EventEmitter } from 'events';
import { InsuranceCompany, QuoteRequest, QuoteResult, PolicyInfo, ScraperProgress } from '../utils/types';
import BrowserManager from '../core/browser-manager';
import SessionGuard from '../core/session-guard';
import { sleep, randomInt } from '../utils/helpers';
import logger from '../utils/logger';

export abstract class BaseScraper extends EventEmitter {
  protected company: InsuranceCompany;
  protected driver!: WebDriver;
  protected browserManager: BrowserManager;
  protected sessionGuard: SessionGuard;
  protected taskId: string;
  protected isLoggedIn: boolean = false;
  protected checkpoint: any = null;

  constructor(company: InsuranceCompany, taskId: string) {
    super();
    this.company = company;
    this.taskId = taskId;
    this.browserManager = BrowserManager.getInstance();
    this.sessionGuard = SessionGuard.getInstance();
  }

  public async initialize(): Promise<void> {
    logger.info(`初始化抓取器: ${this.company.name}`);
    const instance = await this.browserManager.acquireBrowser(this.company.id);
    this.driver = instance.driver;
    this.sessionGuard.registerSession(this.company.id);
  }

  public async login(): Promise<boolean> {
    if (this.isLoggedIn) {
      return true;
    }

    logger.info(`正在登录 ${this.company.name}...`);
    this.emitProgress('登录中', 10);

    try {
      await this.driver.get(this.company.loginUrl);
      await sleep(randomInt(2000, 4000));

      const captchaType = await this.sessionGuard.detectCaptcha(this.driver, this.company);
      if (captchaType !== 'none') {
        logger.warn(`${this.company.name} 登录需要验证码: ${captchaType}`);
        const captchaResolved = await this.sessionGuard.handleCaptcha(
          this.driver,
          this.company,
          this.taskId
        );
        if (!captchaResolved) {
          logger.error(`${this.company.name} 验证码处理失败`);
          return false;
        }
      }

      const selectors = this.company.selectors;
      const bm = this.browserManager;

      const usernameInput = await this.driver.findElement(By.css(selectors.usernameInput));
      await usernameInput.clear();
      await bm.humanType(this.driver, usernameInput, this.company.username);

      await sleep(randomInt(500, 1500));

      const passwordInput = await this.driver.findElement(By.css(selectors.passwordInput));
      await passwordInput.clear();
      await bm.humanType(this.driver, passwordInput, this.company.password);

      if (selectors.captchaInput && captchaType === 'image') {
        logger.info(`${this.company.name} 等待输入验证码...`);
        const captchaResolved = await this.sessionGuard.handleCaptcha(
          this.driver,
          this.company,
          this.taskId
        );
        if (!captchaResolved) {
          return false;
        }
      }

      await sleep(randomInt(500, 1000));

      const loginButton = await this.driver.findElement(By.css(selectors.loginButton));
      await bm.humanClick(this.driver, loginButton);

      await sleep(randomInt(3000, 5000));

      const sessionStatus = await this.sessionGuard.checkSession(this.driver, this.company);
      this.isLoggedIn = sessionStatus === 'active';

      if (this.isLoggedIn) {
        logger.info(`${this.company.name} 登录成功`);
        this.sessionGuard.resetLoginRetryCount(this.company.id);
        this.emitProgress('登录成功', 20);
      } else {
        logger.error(`${this.company.name} 登录失败`);
      }

      return this.isLoggedIn;
    } catch (error) {
      logger.error(`${this.company.name} 登录过程出错`, { error: (error as Error).message });
      return false;
    }
  }

  public async ensureSession(): Promise<boolean> {
    return this.sessionGuard.ensureSession(this.driver, this.company, this.taskId);
  }

  protected async waitForAjax(): Promise<void> {
    if (!this.company.features.supportsAjax) {
      return;
    }

    const waitTime = this.company.features.ajaxWaitTime;
    await sleep(waitTime);

    const loadingSelectors = [
      this.company.selectors.quoteResult.loadingSpinner,
      '.loading',
      '.spinner',
      '.ant-spin',
    ];

    for (const selector of loadingSelectors) {
      if (!selector) continue;
      try {
        const elements = await this.driver.findElements(By.css(selector));
        if (elements.length > 0) {
          const isDisplayed = await elements[0].isDisplayed().catch(() => false);
          if (isDisplayed) {
            logger.debug(`等待加载动画消失: ${selector}`);
            await this.driver.wait(until.elementIsNotVisible(elements[0]), 10000).catch(() => {});
          }
        }
      } catch {
        continue;
      }
    }
  }

  protected async waitForElement(selector: string, timeout: number = 10000): Promise<any> {
    return this.driver.wait(until.elementLocated(By.css(selector)), timeout);
  }

  protected async safeFindElement(selector: string): Promise<any | null> {
    try {
      const elements = await this.driver.findElements(By.css(selector));
      if (elements.length > 0) {
        return elements[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  protected async safeGetText(element: any): Promise<string> {
    try {
      return await element.getText();
    } catch {
      return '';
    }
  }

  protected async safeGetAttribute(element: any, attr: string): Promise<string> {
    try {
      return await element.getAttribute(attr);
    } catch {
      return '';
    }
  }

  protected parseNumber(text: string): number {
    const cleaned = text.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  protected parseDate(text: string): Date | null {
    const cleaned = text.trim();
    const date = new Date(cleaned);
    return isNaN(date.getTime()) ? null : date;
  }

  protected emitProgress(stage: string, progress: number, message?: string): void {
    const progressInfo: ScraperProgress = {
      companyId: this.company.id,
      stage,
      progress,
      message: message || stage,
    };
    this.emit('progress', progressInfo);
    logger.debug(`${this.company.name}: ${stage} - ${progress}%`);
  }

  public setCheckpoint(checkpoint: any): void {
    this.checkpoint = checkpoint;
  }

  public getCheckpoint(): any {
    return this.checkpoint;
  }

  public async cleanup(): Promise<void> {
    if (this.driver) {
      const instance = this.browserManager.getInstanceById(
        Array.from(this.browserManager['instances'].keys()).find(
          id => this.browserManager['instances'].get(id)?.driver === this.driver
        ) || ''
      );
      if (instance) {
        this.browserManager.releaseBrowser(instance.id);
      }
    }
    this.isLoggedIn = false;
  }

  public async close(): Promise<void> {
    if (this.driver) {
      const instances = this.browserManager['instances'] as Map<string, any>;
      for (const [id, inst] of instances.entries()) {
        if (inst.driver === this.driver) {
          await this.browserManager.closeBrowser(id);
          break;
        }
      }
    }
    this.isLoggedIn = false;
  }

  public getCompany(): InsuranceCompany {
    return this.company;
  }

  public getTaskId(): string {
    return this.taskId;
  }
}

export abstract class QuoteScraper extends BaseScraper {
  constructor(company: InsuranceCompany, taskId: string) {
    super(company, taskId);
  }

  abstract scrapeQuote(request: QuoteRequest): Promise<QuoteResult>;
}

export abstract class PolicyScraper extends BaseScraper {
  constructor(company: InsuranceCompany, taskId: string) {
    super(company, taskId);
  }

  abstract getPolicyList(page?: number): Promise<PolicyInfo[]>;
  abstract getPolicyDetail(policyNumber: string): Promise<PolicyInfo | null>;
  abstract getRenewalPremium(policyNumber: string): Promise<number | null>;
}

export default BaseScraper;
