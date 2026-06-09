import { BrowserContext, Page } from 'playwright';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger';
import { withRetry, circuitBreakerManager } from '../utils/retry';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { db } from '../storage/db';
import type { 
  PlatformType, 
  PlatformAccount, 
  SKUData, 
  ListingResult, 
  ListingStatus,
  PlatformAdapter 
} from '../../types';

dotenv.config();

const logger = createLogger('platform-base');

export interface AdapterContext {
  context: BrowserContext;
  contextId: string;
  page: Page;
  account: PlatformAccount;
}

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract platform: PlatformType;
  
  protected contextMap: Map<string, AdapterContext> = new Map();
  protected maxConcurrent = 3;
  
  constructor() {
    this.maxConcurrent = parseInt(process.env.MAX_BROWSERS_PER_PLATFORM || '3', 10);
  }

  protected async getOrCreateContext(account: PlatformAccount): Promise<AdapterContext> {
    const existing = this.contextMap.get(account.id);
    if (existing) {
      return existing;
    }

    if (this.contextMap.size >= this.maxConcurrent) {
      const oldestKey = this.contextMap.keys().next().value;
      if (oldestKey) {
        await this.closeContext(oldestKey);
      }
    }

    const cookies = authManager.getCookies(account.id);
    const { context, fingerprint } = await antiDetect.createContext(this.platform, cookies || undefined);
    const page = await context.newPage();
    const contextId = `${this.platform}-${account.id}-${Date.now()}`;

    page.setDefaultTimeout(parseInt(process.env.BROWSER_TIMEOUT || '30000', 10));

    const adapterContext: AdapterContext = {
      context,
      contextId,
      page,
      account
    };

    this.contextMap.set(account.id, adapterContext);
    logger.debug(`Created new browser context for ${account.id}`, { platform: this.platform });

    return adapterContext;
  }

  protected async closeContext(accountId: string): Promise<void> {
    const ctx = this.contextMap.get(accountId);
    if (ctx) {
      try {
        await ctx.page.close();
      } catch (e) {
        logger.warn(`Error closing page for ${accountId}`, e);
      }
      try {
        await ctx.context.close();
      } catch (e) {
        logger.warn(`Error closing context for ${accountId}`, e);
      }
      this.contextMap.delete(accountId);
      logger.debug(`Closed context for ${accountId}`);
    }
  }

  protected async saveSession(accountId: string): Promise<void> {
    const ctx = this.contextMap.get(accountId);
    if (ctx) {
      const cookies = await ctx.context.cookies();
      authManager.saveCookies(accountId, this.platform, cookies, 24 * 60 * 60 * 1000);
      logger.debug(`Saved session for ${accountId}`);
    }
  }

  async login(account: PlatformAccount): Promise<boolean> {
    return withRetry({
      operation: async () => {
        logger.info(`Logging into ${this.platform} as ${account.email}`);
        
        const ctx = await this.getOrCreateContext(account);
        
        try {
          const success = await this.doLogin(ctx, account);
          
          if (success) {
            await this.saveSession(account.id);
            logger.info(`Successfully logged into ${this.platform}`, { account: account.id });
            return true;
          }
          
          throw new Error(`Login failed for ${account.email}`);
        } catch (error) {
          await this.closeContext(account.id);
          throw error;
        }
      },
      operationName: `${this.platform}-login`,
      circuitBreakerName: `${this.platform}-auth`,
      fallbackAccount: async () => {
        const fallback = authManager.getNextAccount(this.platform, account.id);
        if (fallback) {
          logger.info(`Switching to fallback account: ${fallback.id}`);
          await this.login(fallback);
        }
      }
    });
  }

  protected abstract doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean>;

  async uploadListing(sku: SKUData, account: PlatformAccount, site: string): Promise<ListingResult> {
    const taskId = `${this.platform}-${sku.sku}-${site}-${Date.now()}`;
    const startTime = Date.now();
    
    db.createTask({
      id: taskId,
      type: 'upload',
      status: 'running',
      platform: this.platform,
      sku: sku.sku,
      accountId: account.id,
      site,
      startedAt: startTime,
      retryCount: 0
    });

    return withRetry({
      operation: async () => {
        logger.info(`Uploading listing ${sku.sku} to ${this.platform} ${site}`, { account: account.id });
        
        const ctx = await this.getOrCreateContext(account);
        
        if (authManager.shouldRenewCookies(account.id, 3600000)) {
          await this.ensureLoggedIn(account, ctx);
        }

        const result = await this.doUploadListing(ctx, sku, site);
        
        result.taskId = taskId;
        result.startedAt = startTime;
        result.completedAt = Date.now();
        result.sku = sku.sku;
        result.platform = this.platform;
        result.accountId = account.id;
        result.site = site;

        db.recordListingResult(result);
        
        logger.info(`Listing ${sku.sku} ${result.status} on ${this.platform}`, { 
          listingId: result.listingId,
          status: result.status 
        });

        return result;
      },
      operationName: `${this.platform}-upload-${sku.sku}`,
      circuitBreakerName: `${this.platform}-upload`,
      onRetry: (attempt, error, delay) => {
        logger.warn(`Retry attempt ${attempt} for ${sku.sku}`, { 
          error: error.message, 
          delay 
        });
        db.incrementRetryCount(sku.sku, this.platform, site);
      },
      onFailure: (error) => {
        const failResult: ListingResult = {
          taskId,
          sku: sku.sku,
          platform: this.platform,
          accountId: account.id,
          site,
          status: 'failed',
          errorMessage: error.message,
          startedAt: startTime,
          completedAt: Date.now(),
          retryCount: 3
        };
        db.recordListingResult(failResult);
      }
    });
  }

  protected abstract doUploadListing(ctx: AdapterContext, sku: SKUData, site: string): Promise<ListingResult>;

  protected async ensureLoggedIn(account: PlatformAccount, ctx: AdapterContext): Promise<void> {
    if (!authManager.areCookiesValid(account.id)) {
      logger.info(`Session expired for ${account.id}, re-logging in`);
      await this.doLogin(ctx, account);
      await this.saveSession(account.id);
    }
  }

  async getListingStatus(listingId: string, account: PlatformAccount): Promise<ListingStatus> {
    return withRetry({
      operation: async () => {
        const ctx = await this.getOrCreateContext(account);
        return this.doGetListingStatus(ctx, listingId);
      },
      operationName: `${this.platform}-status-${listingId}`,
      circuitBreakerName: `${this.platform}-status`
    });
  }

  protected abstract doGetListingStatus(ctx: AdapterContext, listingId: string): Promise<ListingStatus>;

  async updatePrice(listingId: string, price: number, site: string): Promise<boolean> {
    const account = authManager.getNextAccount(this.platform);
    if (!account) return false;

    return withRetry({
      operation: async () => {
        const ctx = await this.getOrCreateContext(account);
        return this.doUpdatePrice(ctx, listingId, price, site);
      },
      operationName: `${this.platform}-update-price-${listingId}`,
      circuitBreakerName: `${this.platform}-price`
    });
  }

  protected abstract doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean>;

  async updateInventory(listingId: string, quantity: number, site: string): Promise<boolean> {
    const account = authManager.getNextAccount(this.platform);
    if (!account) return false;

    return withRetry({
      operation: async () => {
        const ctx = await this.getOrCreateContext(account);
        return this.doUpdateInventory(ctx, listingId, quantity, site);
      },
      operationName: `${this.platform}-update-inventory-${listingId}`,
      circuitBreakerName: `${this.platform}-inventory`
    });
  }

  protected abstract doUpdateInventory(ctx: AdapterContext, listingId: string, quantity: number, site: string): Promise<boolean>;

  protected async waitForNavigation(page: Page, timeout = 30000): Promise<void> {
    try {
      await page.waitForNavigation({ timeout, waitUntil: 'domcontentloaded' });
    } catch (e) {
      logger.debug('Navigation timeout, continuing anyway');
    }
  }

  protected async waitForElement(page: Page, selector: string, timeout = 15000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      return true;
    } catch (e) {
      logger.debug(`Element not found: ${selector}`);
      return false;
    }
  }

  protected async takeScreenshot(ctx: AdapterContext, name: string): Promise<string> {
    return antiDetect.takeScreenshot(ctx.page, `${this.platform}-${ctx.account.id}-${name}`);
  }

  protected async handleCaptcha(ctx: AdapterContext, type: 'slider' | 'click' | 'text'): Promise<boolean> {
    logger.info(`Handling ${type} captcha for ${this.platform}`);
    const success = await antiDetect.solveCaptcha(ctx.page, type);
    
    if (!success) {
      const screenshot = await this.takeScreenshot(ctx, `captcha-${type}`);
      logger.warn(`Captcha solving failed, screenshot saved: ${screenshot}`);
    }
    
    return success;
  }

  protected async humanWait(): Promise<void> {
    await antiDetect.humanWait(this.platform);
  }

  async close(): Promise<void> {
    logger.info(`Closing ${this.platform} adapter, ${this.contextMap.size} contexts`);
    
    for (const accountId of this.contextMap.keys()) {
      try {
        await this.closeContext(accountId);
      } catch (e) {
        logger.warn(`Error closing context for ${accountId}`, e);
      }
    }
    
    this.contextMap.clear();
  }

  getActiveContextCount(): number {
    return this.contextMap.size;
  }

  isCircuitBreakerOpen(): boolean {
    return circuitBreakerManager.get(`${this.platform}-upload`).getState() === 'open' ||
           circuitBreakerManager.get(`${this.platform}-auth`).getState() === 'open';
  }
}

export default BasePlatformAdapter;
