import { WebDriver, By, until } from 'selenium-webdriver';
import { EventEmitter } from 'events';
import { InsuranceCompany } from '../utils/types';
import BrowserManager from './browser-manager';
import logger from '../utils/logger';
import { sleep, randomInt } from '../utils/helpers';

export type SessionStatus = 'active' | 'expired' | 'unknown' | 'captcha-required';
export type CaptchaType = 'image' | 'slider' | 'none';

export interface SessionInfo {
  companyId: string;
  status: SessionStatus;
  lastActivity: Date;
  expiresAt?: Date;
  captchaType?: CaptchaType;
  captchaImage?: string;
  loginRetryCount: number;
}

export interface CaptchaEvent {
  companyId: string;
  captchaType: CaptchaType;
  captchaImage?: string;
  taskId: string;
}

export class SessionGuard extends EventEmitter {
  private static instance: SessionGuard;
  private sessions: Map<string, SessionInfo> = new Map();
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private browserManager: BrowserManager;

  private constructor() {
    super();
    this.browserManager = BrowserManager.getInstance();
    this.startKeepAliveMonitor();
  }

  public static getInstance(): SessionGuard {
    if (!SessionGuard.instance) {
      SessionGuard.instance = new SessionGuard();
    }
    return SessionGuard.instance;
  }

  private startKeepAliveMonitor(): void {
    this.keepAliveInterval = setInterval(() => {
      this.checkAllSessions();
    }, 60000);
  }

  public stopKeepAliveMonitor(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  public async checkSession(driver: WebDriver, company: InsuranceCompany): Promise<SessionStatus> {
    try {
      const currentUrl = await driver.getCurrentUrl();
      const pageSource = await driver.getPageSource();

      const expiredPatterns = company.selectors.sessionExpiredPatterns;
      for (const pattern of expiredPatterns) {
        if (pageSource.includes(pattern)) {
          logger.warn(`检测到 ${company.name} 会话已过期: ${pattern}`);
          this.updateSessionStatus(company.id, 'expired');
          return 'expired';
        }
      }

      const loginPagePatterns = ['login', 'signin', '登录'];
      for (const pattern of loginPagePatterns) {
        if (currentUrl.toLowerCase().includes(pattern.toLowerCase())) {
          logger.warn(`${company.name} 重定向到登录页，会话可能已过期`);
          this.updateSessionStatus(company.id, 'expired');
          return 'expired';
        }
      }

      const captchaDetected = await this.detectCaptcha(driver, company);
      if (captchaDetected !== 'none') {
        logger.warn(`检测到 ${company.name} 需要验证码: ${captchaDetected}`);
        this.updateSessionStatus(company.id, 'captcha-required');
        return 'captcha-required';
      }

      this.updateSessionStatus(company.id, 'active');
      return 'active';
    } catch (error) {
      logger.error(`检查会话状态失败: ${company.name}`, { error: (error as Error).message });
      return 'unknown';
    }
  }

  public async detectCaptcha(driver: WebDriver, company: InsuranceCompany): Promise<CaptchaType> {
    try {
      const selectors = company.selectors;

      if (selectors.captchaImage) {
        const captchaElements = await driver.findElements(By.css(selectors.captchaImage));
        if (captchaElements.length > 0) {
          const isDisplayed = await captchaElements[0].isDisplayed();
          if (isDisplayed) {
            return company.features.captchaType;
          }
        }
      }

      const commonCaptchaSelectors = [
        '.captcha',
        '#captcha',
        '.verification',
        '.verify',
        'img[src*="captcha"]',
        'img[src*="verify"]',
        '.slide-verify',
        '.slider-captcha',
      ];

      for (const selector of commonCaptchaSelectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            const isDisplayed = await elements[0].isDisplayed();
            if (isDisplayed) {
              const tagName = await elements[0].getTagName();
              if (selector.includes('slide') || selector.includes('slider')) {
                return 'slider';
              }
              return 'image';
            }
          }
        } catch {
          continue;
        }
      }

      return 'none';
    } catch (error) {
      logger.error(`检测验证码失败: ${company.name}`, { error: (error as Error).message });
      return 'none';
    }
  }

  public async handleCaptcha(
    driver: WebDriver,
    company: InsuranceCompany,
    taskId: string
  ): Promise<boolean> {
    const captchaType = await this.detectCaptcha(driver, company);
    
    if (captchaType === 'none') {
      return true;
    }

    let captchaImage: string | undefined;
    if (captchaType === 'image' && company.selectors.captchaImage) {
      try {
        const captchaImg = await driver.findElement(By.css(company.selectors.captchaImage));
        captchaImage = await captchaImg.takeScreenshot();
      } catch (error) {
        logger.error(`获取验证码图片失败: ${company.name}`, { error: (error as Error).message });
      }
    }

    const captchaEvent: CaptchaEvent = {
      companyId: company.id,
      captchaType,
      captchaImage,
      taskId,
    };

    this.emit('captcha-required', captchaEvent);
    logger.warn(`需要人工处理验证码: ${company.name}, 类型: ${captchaType}`);

    const resolved = await this.waitForCaptchaResolution(taskId);
    return resolved;
  }

  private waitForCaptchaResolution(taskId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeAllListeners(`captcha-resolved-${taskId}`);
        resolve(false);
      }, 300000);

      this.once(`captcha-resolved-${taskId}`, (success: boolean) => {
        clearTimeout(timeout);
        resolve(success);
      });
    });
  }

  public resolveCaptcha(taskId: string, success: boolean): void {
    this.emit(`captcha-resolved-${taskId}`, success);
  }

  public async ensureSession(
    driver: WebDriver,
    company: InsuranceCompany,
    taskId: string
  ): Promise<boolean> {
    const status = await this.checkSession(driver, company);

    if (status === 'active') {
      return true;
    }

    if (status === 'captcha-required') {
      return this.handleCaptcha(driver, company, taskId);
    }

    if (status === 'expired') {
      return this.relogin(driver, company, taskId);
    }

    return false;
  }

  public async relogin(
    driver: WebDriver,
    company: InsuranceCompany,
    taskId: string
  ): Promise<boolean> {
    const sessionInfo = this.sessions.get(company.id);
    if (sessionInfo && sessionInfo.loginRetryCount >= 3) {
      logger.error(`${company.name} 登录重试次数过多，放弃`);
      return false;
    }

    logger.info(`正在重新登录 ${company.name}...`);

    try {
      await driver.get(company.loginUrl);
      await sleep(randomInt(2000, 4000));

      const captchaType = await this.detectCaptcha(driver, company);
      if (captchaType !== 'none') {
        const captchaResolved = await this.handleCaptcha(driver, company, taskId);
        if (!captchaResolved) {
          return false;
        }
      }

      const bm = BrowserManager.getInstance();

      const usernameInput = await driver.findElement(By.css(company.selectors.usernameInput));
      await usernameInput.clear();
      await bm.humanType(driver, usernameInput, company.username);

      await sleep(randomInt(500, 1500));

      const passwordInput = await driver.findElement(By.css(company.selectors.passwordInput));
      await passwordInput.clear();
      await bm.humanType(driver, passwordInput, company.password);

      if (company.selectors.captchaInput && captchaType === 'image') {
        logger.warn(`${company.name} 需要图形验证码，等待人工输入`);
        const captchaResolved = await this.handleCaptcha(driver, company, taskId);
        if (!captchaResolved) {
          return false;
        }
      }

      await sleep(randomInt(500, 1000));

      const loginButton = await driver.findElement(By.css(company.selectors.loginButton));
      await bm.humanClick(driver, loginButton);

      await sleep(randomInt(3000, 5000));

      const newStatus = await this.checkSession(driver, company);
      if (newStatus === 'active') {
        logger.info(`${company.name} 重新登录成功`);
        this.updateSessionStatus(company.id, 'active');
        return true;
      }

      logger.error(`${company.name} 重新登录失败`);
      return false;
    } catch (error) {
      logger.error(`${company.name} 登录过程出错`, { error: (error as Error).message });
      return false;
    }
  }

  public async keepAlive(driver: WebDriver, company: InsuranceCompany): Promise<void> {
    try {
      logger.debug(`保活 ${company.name} 会话`);
      
      const currentUrl = await driver.getCurrentUrl();
      
      if (currentUrl === 'about:blank' || currentUrl === '') {
        await driver.get(company.loginUrl);
      } else {
        await driver.navigate().refresh();
      }

      await sleep(randomInt(1000, 2000));
      await this.checkSession(driver, company);
    } catch (error) {
      logger.error(`保活会话失败: ${company.name}`, { error: (error as Error).message });
    }
  }

  private async checkAllSessions(): Promise<void> {
    const now = Date.now();
    const instances = this.browserManager['instances'];
    
    for (const [instanceId, instance] of instances.entries()) {
      if (instance.isBusy || !instance.companyId) {
        continue;
      }

      const sessionInfo = this.sessions.get(instance.companyId);
      if (!sessionInfo) {
        continue;
      }

      const idleTime = now - sessionInfo.lastActivity.getTime();
      const timeoutMs = 300000;

      if (idleTime > timeoutMs) {
        logger.info(`会话空闲超时，执行保活: ${instance.companyId}`);
        await this.keepAlive(instance.driver, {
          id: instance.companyId,
          name: '',
          shortName: '',
          loginUrl: '',
          username: '',
          password: '',
          selectors: {
            usernameInput: '',
            passwordInput: '',
            loginButton: '',
            sessionExpiredPatterns: [],
            quoteForm: {} as any,
            quoteResult: {} as any,
            policyList: {} as any,
            policyDetail: {} as any,
          },
          features: {} as any,
        });
      }
    }
  }

  private updateSessionStatus(companyId: string, status: SessionStatus): void {
    const existing = this.sessions.get(companyId);
    this.sessions.set(companyId, {
      companyId,
      status,
      lastActivity: new Date(),
      loginRetryCount: existing?.loginRetryCount || 0,
      ...existing,
    });
  }

  public registerSession(companyId: string): void {
    this.sessions.set(companyId, {
      companyId,
      status: 'unknown',
      lastActivity: new Date(),
      loginRetryCount: 0,
    });
  }

  public getSessionInfo(companyId: string): SessionInfo | undefined {
    return this.sessions.get(companyId);
  }

  public resetLoginRetryCount(companyId: string): void {
    const session = this.sessions.get(companyId);
    if (session) {
      session.loginRetryCount = 0;
    }
  }

  public async cleanup(): Promise<void> {
    this.stopKeepAliveMonitor();
    this.removeAllListeners();
    this.sessions.clear();
  }
}

export default SessionGuard;
