import { EventEmitter } from 'events';
import { InsuranceCompany, QuoteRequest, QuoteResult, PolicyInfo, ScraperProgress, ProductType } from '../utils/types';
import BrowserManager from '../core/browser-manager';
import SessionGuard from '../core/session-guard';
import { sleep, randomInt } from '../utils/helpers';
import logger from '../utils/logger';
import { CheckpointManager, CheckpointData } from '../utils/checkpoint';

export abstract class BaseScraper extends EventEmitter {
  protected company: InsuranceCompany;
  protected driver!: WebdriverIO.Browser;
  protected browserManager: BrowserManager;
  protected sessionGuard: SessionGuard;
  protected taskId: string;
  protected isLoggedIn: boolean = false;
  protected checkpointManager: CheckpointManager;
  protected checkpoint: CheckpointData | null = null;

  constructor(company: InsuranceCompany, taskId: string, checkpointManager?: CheckpointManager) {
    super();
    this.company = company;
    this.taskId = taskId;
    this.browserManager = BrowserManager.getInstance();
    this.sessionGuard = SessionGuard.getInstance();
    this.checkpointManager = checkpointManager || CheckpointManager.getInstance();
  }

  public async initialize(): Promise<void> {
    logger.info(`初始化抓取器: ${this.company.name}`);
    const instance = await this.browserManager.acquireBrowser(this.company.id);
    this.driver = instance.driver;
    this.sessionGuard.registerSession(this.company.id);
    this.loadCheckpoint();
  }

  public loadCheckpoint(): void {
    const existing = this.checkpointManager.getCheckpoint(this.taskId);
    if (existing) {
      this.checkpoint = existing;
      logger.info(`恢复检查点进度: ${this.taskId}, 当前 ${existing.progress.current}/${existing.progress.total}`);
    }
  }

  public saveCheckpoint(itemId?: string, success?: boolean): void {
    if (itemId !== undefined && success !== undefined) {
      this.checkpointManager.updateProgress(this.taskId, itemId, success);
    }
    const updated = this.checkpointManager.getCheckpoint(this.taskId);
    if (updated) {
      this.checkpoint = updated;
    }
  }

  public isCheckpointItemCompleted(itemId: string): boolean {
    return this.checkpointManager.isItemCompleted(this.taskId, itemId);
  }

  public async login(): Promise<boolean> {
    if (this.isLoggedIn) {
      return true;
    }

    logger.info(`正在登录 ${this.company.name}...`);
    this.emitProgress('登录中', 10);

    try {
      await this.driver.url(this.company.loginUrl);
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

      const usernameInput = await this.driver.$(selectors.usernameInput);
      await usernameInput.clearValue();
      await bm.humanType(this.driver, usernameInput, this.company.username);

      await sleep(randomInt(500, 1500));

      const passwordInput = await this.driver.$(selectors.passwordInput);
      await passwordInput.clearValue();
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

      const loginButton = await this.driver.$(selectors.loginButton);
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
        const elements = await this.driver.$$(selector);
        if (elements.length > 0) {
          const isDisplayed = await elements[0].isDisplayed().catch(() => false);
          if (isDisplayed) {
            logger.debug(`等待加载动画消失: ${selector}`);
            await this.driver.waitUntil(
              async () => {
                try {
                  const el = await this.driver.$(selector);
                  return !(await el.isDisplayed());
                } catch {
                  return true;
                }
              },
              { timeout: 10000, interval: 500 }
            ).catch(() => {});
          }
        }
      } catch {
        continue;
      }
    }
  }

  protected async waitForElement(selector: string, timeout: number = 10000): Promise<WebdriverIO.Element> {
    return this.driver.waitUntil(
      async () => {
        const el = await this.driver.$(selector);
        return await el.isExisting();
      },
      { timeout, interval: 500 }
    ).then(() => this.driver.$(selector));
  }

  protected async safeFindElement(selector: string): Promise<WebdriverIO.Element | null> {
    try {
      const elements = await this.driver.$$(selector);
      if (elements.length > 0) {
        return elements[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  protected async safeGetText(element: WebdriverIO.Element): Promise<string> {
    try {
      return await element.getText();
    } catch {
      return '';
    }
  }

  protected async safeGetAttribute(element: WebdriverIO.Element, attr: string): Promise<string> {
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

  public setCheckpoint(checkpoint: CheckpointData | null): void {
    this.checkpoint = checkpoint;
  }

  public getCheckpoint(): CheckpointData | null {
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
  constructor(company: InsuranceCompany, taskId: string, checkpointManager?: CheckpointManager) {
    super(company, taskId, checkpointManager);
  }

  abstract scrapeQuote(request: QuoteRequest): Promise<QuoteResult>;
}

export abstract class PolicyScraper extends BaseScraper {
  constructor(company: InsuranceCompany, taskId: string, checkpointManager?: CheckpointManager) {
    super(company, taskId, checkpointManager);
  }

  abstract getPolicyList(page?: number, productType?: ProductType): Promise<PolicyInfo[]>;
  abstract getPolicyDetail(policyNumber: string): Promise<PolicyInfo | null>;
  abstract getRenewalPremium(policyNumber: string): Promise<number | null>;
}

export default BaseScraper;
