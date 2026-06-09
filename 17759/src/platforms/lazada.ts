import BasePlatformAdapter, { AdapterContext } from './base';
import { createLogger } from '../utils/logger';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { imageProcessor } from '../utils/imageProcessor';
import { translator } from '../utils/translator';
import type { PlatformType, SKUData, ListingResult, ListingStatus, PlatformAccount } from '../../types';

const logger = createLogger('lazada-adapter');

const SITE_DOMAINS: Record<string, string> = {
  MY: 'sellercenter.lazada.com.my',
  SG: 'sellercenter.lazada.sg',
  TH: 'sellercenter.lazada.co.th',
  VN: 'sellercenter.lazada.vn',
  PH: 'sellercenter.lazada.com.ph',
  ID: 'sellercenter.lazada.co.id'
};

const SITE_LANGUAGES: Record<string, string> = {
  MY: 'en',
  SG: 'en',
  TH: 'th',
  VN: 'vi',
  PH: 'en',
  ID: 'id'
};

class LazadaAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'lazada';

  protected async doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean> {
    const { page, contextId } = ctx;
    const domain = SITE_DOMAINS[account.sites[0]] || 'sellercenter.lazada.com.my';
    const loginUrl = `https://${domain}/app/seller/login`;

    logger.info(`Navigating to Lazada login: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await antiDetect.waitBetweenOperations(contextId, 'lazada');

    try {
      const email = account.email;
      const password = authManager.getAccountPassword(account.id);
      
      if (!password) {
        throw new Error('Failed to get account password');
      }

      const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email"]';
      await antiDetect.smartType(page, emailSelector, email);
      await antiDetect.humanWait('lazada', 0.3, 0.8);

      const passwordSelector = 'input[type="password"], input[name="password"]';
      await antiDetect.smartType(page, passwordSelector, password);
      await antiDetect.humanWait('lazada', 0.3, 0.8);

      const loginBtn = 'button[type="submit"], .login-btn, button:has-text("Sign In"), button:has-text("Log In")';
      await antiDetect.smartClick(page, loginBtn);
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const totpSelector = 'input[name="otp"], input[type="text"][maxlength="6"], .otp-input input, input[autocomplete="one-time-code"]';
      const hasTOTP = await this.waitForElement(page, totpSelector, 5000);
      
      if (hasTOTP) {
        logger.info('2FA verification required, generating TOTP');
        const totp = authManager.generateTOTP(account.id);
        
        if (!totp) {
          throw new Error('Failed to generate TOTP code');
        }

        await antiDetect.smartType(page, totpSelector, totp);
        await antiDetect.humanWait('lazada', 0.3, 0.6);

        const verifyBtn = 'button:has-text("Verify"), button[type="submit"], .submit-btn';
        await antiDetect.smartClick(page, verifyBtn);
        await antiDetect.waitBetweenOperations(contextId, 'lazada');
      }

      const captchaPresent = await this.checkForCaptcha(page);
      if (captchaPresent) {
        logger.info('Captcha detected during login');
        const solved = await this.handleCaptcha(ctx, 'slider');
        if (!solved) {
          await this.takeScreenshot(ctx, 'login-captcha-failed');
          return false;
        }
      }

      await page.waitForNavigation({ timeout: 30000, waitUntil: 'domcontentloaded' }).catch(() => {});
      
      const loggedIn = await this.isLoggedIn(page);
      if (loggedIn) {
        logger.info('Successfully logged into Lazada Seller Center');
        return true;
      }

      const errorElement = await page.$('.error-message, .alert-error, .message-error');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Lazada login error: ${errorText?.trim() || 'Unknown error'}`);
      }

      return false;
    } catch (error) {
      logger.error('Lazada login failed', error);
      await this.takeScreenshot(ctx, 'login-error');
      throw error;
    }
  }

  private async isLoggedIn(page: any): Promise<boolean> {
    try {
      const url = page.url();
      if (url.includes('/login') || url.includes('/signin')) {
        return false;
      }

      const dashboardSelector = '.seller-dashboard, .main-content, .lazada-header';
      const userMenu = await page.$('.user-info, .account-menu, .header-avatar');
      
      return !!userMenu || url.includes('sellercenter.lazada') && !url.includes('/login');
    } catch (e) {
      return false;
    }
  }

  private async checkForCaptcha(page: any): Promise<boolean> {
    const captchaSelectors = [
      '.captcha-container',
      '.lazada-captcha',
      '#nc_1_wrapper',
      '.nc-container',
      'iframe[src*="captcha"], iframe[src*="nocaptcha"]'
    ];

    for (const selector of captchaSelectors) {
      if (await page.$(selector)) {
        return true;
      }
    }
    return false;
  }

  protected async doUploadListing(ctx: AdapterContext, sku: SKUData, site: string): Promise<ListingResult> {
    const { page, contextId, account } = ctx;
    const domain = SITE_DOMAINS[site] || 'sellercenter.lazada.com.my';
    const targetLang = SITE_LANGUAGES[site] || 'en';
    
    logger.info(`Uploading listing ${sku.sku} to Lazada ${site} (${targetLang})`);

    try {
      const processedImages = await imageProcessor.processImages(
        sku.images,
        'lazada',
        sku.sku,
        { text: sku.brand || 'LAZADA' }
      );

      const localizedTitle = await translator.translateAndTruncate(
        sku.title.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'title',
        'lazada'
      );

      const localizedDesc = await translator.translateAndTruncate(
        sku.description.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'description',
        'lazada'
      );

      const productUrl = `https://${domain}/app/seller/product/manage`;
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      await this.ensureLoggedIn(account, ctx);

      const addProductBtn = 'button:has-text("Add Product"), a[href*="/product/add"], .add-btn, .create-product-btn';
      await antiDetect.smartClick(page, addProductBtn);
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const categorySelector = '.category-search input, input[placeholder*="category"], .search-category-input';
      if (sku.category) {
        await antiDetect.smartType(page, categorySelector, sku.category);
        await antiDetect.humanWait('lazada', 0.5, 1);
        
        const firstCategory = '.category-tree li:first-child, .suggestion-item:first-child, .category-result:first-child';
        if (await this.waitForElement(page, firstCategory, 3000)) {
          await antiDetect.smartClick(page, firstCategory);
          await antiDetect.waitBetweenOperations(contextId, 'lazada');
        }
      }

      const confirmCategoryBtn = 'button:has-text("Confirm"), button:has-text("Next"), .next-btn';
      if (await this.waitForElement(page, confirmCategoryBtn, 5000)) {
        await antiDetect.smartClick(page, confirmCategoryBtn);
        await antiDetect.waitBetweenOperations(contextId, 'lazada');
      }

      const titleInput = 'textarea[name="title"], input[name="title"], .product-title-input';
      await antiDetect.smartType(page, titleInput, localizedTitle);
      await antiDetect.humanWait('lazada', 0.3, 0.6);

      const brandInput = 'input[name="brand"], .brand-input, input[placeholder*="brand"]';
      if (sku.brand) {
        await antiDetect.smartType(page, brandInput, sku.brand);
        await antiDetect.humanWait('lazada', 0.2, 0.4);
      }

      const descriptionTab = 'div[role="tab"]:has-text("Description"), .tab-description';
      if (await this.waitForElement(page, descriptionTab, 3000)) {
        await antiDetect.smartClick(page, descriptionTab);
        await antiDetect.humanWait('lazada', 0.3, 0.5);
      }

      const descriptionInput = '.description-editor textarea, .product-description textarea, [data-testid="description-input"]';
      await antiDetect.smartType(page, descriptionInput, localizedDesc);
      await antiDetect.humanWait('lazada', 0.3, 0.6);

      const imagesTab = 'div[role="tab"]:has-text("Images"), .tab-images';
      if (await this.waitForElement(page, imagesTab, 3000)) {
        await antiDetect.smartClick(page, imagesTab);
        await antiDetect.humanWait('lazada', 0.3, 0.5);
      }

      for (let i = 0; i < Math.min(processedImages.length, 8); i++) {
        const imagePath = processedImages[i];
        const fileInput = 'input[type="file"][accept*="image"], .image-upload input, .upload-input';
        
        const input = await page.$(fileInput);
        if (input) {
          await input.setInputFiles(imagePath);
          logger.debug(`Uploaded image ${i + 1}/${processedImages.length} for ${sku.sku}`);
          await antiDetect.humanWait('lazada', 0.8, 1.5);
        }
      }

      const priceTab = 'div[role="tab"]:has-text("Price"), .tab-price, .tab-inventory';
      if (await this.waitForElement(page, priceTab, 3000)) {
        await antiDetect.smartClick(page, priceTab);
        await antiDetect.humanWait('lazada', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input, input[placeholder*="price"]';
      const price = sku.prices[site] || sku.prices['MY'] || 0;
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('lazada', 0.2, 0.4);

      const stockInput = 'input[name="stock"], .stock-input, input[placeholder*="stock"], input[name="quantity"]';
      const qty = sku.inventory[site] || sku.inventory['MY'] || 0;
      await antiDetect.smartType(page, stockInput, qty.toString());
      await antiDetect.humanWait('lazada', 0.2, 0.4);

      const weightInput = 'input[name="weight"], .weight-input';
      if (sku.weight) {
        await antiDetect.smartType(page, weightInput, sku.weight.toString());
        await antiDetect.humanWait('lazada', 0.2, 0.4);
      }

      const publishBtn = 'button:has-text("Publish"), button:has-text("Save and Publish"), .submit-btn';
      await antiDetect.smartClick(page, publishBtn);
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      await page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});

      const successIndicator = await page.$('.success-message, .alert-success, .message-success, .lzd-message--success');
      const errorIndicator = await page.$('.error-message, .alert-danger, .message-error, .lzd-message--error');

      if (successIndicator) {
        const listingId = await this.extractListingId(page);
        logger.info(`Successfully created listing for ${sku.sku}`, { listingId });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'lazada',
          accountId: account.id,
          site,
          status: 'under_review',
          listingId,
          listingUrl: listingId ? `https://www.lazada.com.my/products/i${listingId}.html` : undefined,
          startedAt: Date.now(),
          completedAt: Date.now(),
          retryCount: 0
        };
      }

      if (errorIndicator) {
        const errorText = await errorIndicator.textContent();
        logger.error(`Listing creation failed for ${sku.sku}`, { error: errorText });
        
        const rejectReason = await this.parseRejectReason(page);
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'lazada',
          accountId: account.id,
          site,
          status: 'rejected',
          errorMessage: errorText || 'Unknown error',
          rejectReason,
          startedAt: Date.now(),
          completedAt: Date.now(),
          retryCount: 0
        };
      }

      return {
        taskId: '',
        sku: sku.sku,
        platform: 'lazada',
        accountId: account.id,
        site,
        status: 'under_review',
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    } catch (error) {
      logger.error(`Failed to upload listing ${sku.sku} to Lazada`, error);
      await this.takeScreenshot(ctx, `upload-error-${sku.sku}`);
      
      return {
        taskId: '',
        sku: sku.sku,
        platform: 'lazada',
        accountId: account.id,
        site,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    }
  }

  private async extractListingId(page: any): Promise<string | undefined> {
    try {
      const url = page.url();
      const idMatch = url.match(/\/products\/i(\d+)/) || url.match(/itemId=(\d+)/);
      if (idMatch) return idMatch[1];

      const successText = await page.$('.product-id, .item-id, .success-text');
      if (successText) {
        const text = await successText.textContent();
        const match = text?.match(/\d{8,}/);
        if (match) return match[0];
      }
    } catch (e) {
      logger.debug('Failed to extract listing ID', e);
    }
    return undefined;
  }

  private async parseRejectReason(page: any): Promise<string | undefined> {
    try {
      const errorElements = await page.$$('.validation-error, .field-error, .form-error, .lzd-form-item__error');
      const reasons: string[] = [];
      
      for (const el of errorElements) {
        const text = await el.textContent();
        if (text?.trim()) {
          reasons.push(text.trim());
        }
      }
      
      return reasons.length > 0 ? reasons.join('; ') : undefined;
    } catch (e) {
      return undefined;
    }
  }

  protected async doGetListingStatus(ctx: AdapterContext, listingId: string): Promise<ListingStatus> {
    const { page, contextId } = ctx;

    try {
      const domain = 'sellercenter.lazada.com.my';
      const manageUrl = `https://${domain}/app/seller/product/manage`;
      
      await page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const searchInput = 'input[placeholder*="search"], .search-input, input[aria-label*="search"]';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const statusCell = `.status-tag, .product-status, [data-status], .status-badge`;
      if (await this.waitForElement(page, statusCell, 10000)) {
        const statusText = await page.textContent(statusCell);
        const status = this.parseStatus(statusText || '');
        logger.debug(`Listing ${listingId} status: ${status}`);
        return status;
      }

      return 'pending';
    } catch (error) {
      logger.error(`Failed to get status for listing ${listingId}`, error);
      throw error;
    }
  }

  private parseStatus(statusText: string): ListingStatus {
    const status = statusText.toLowerCase();
    
    if (status.includes('active') || status.includes('live') || status.includes('online') || status.includes('published')) {
      return 'active';
    } else if (status.includes('inactive') || status.includes('offline') || status.includes('unpublished')) {
      return 'under_review';
    } else if (status.includes('pending') || status.includes('review') || status.includes('processing') || status.includes('auditing')) {
      return 'under_review';
    } else if (status.includes('rejected') || status.includes('failed') || status.includes('violation') || status.includes('banned')) {
      return 'rejected';
    } else if (status.includes('draft') || status.includes('editing')) {
      return 'pending';
    }
    
    return 'under_review';
  }

  protected async doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const domain = SITE_DOMAINS[site] || 'sellercenter.lazada.com.my';
      const productUrl = `https://${domain}/app/seller/product/manage`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const editBtn = 'button.edit, .edit-btn, [data-action="edit"], button:has-text("Edit")';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('lazada', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input';
      await page.fill(priceInput, '');
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('lazada', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      logger.info(`Updated price for ${listingId} to ${price}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update price for ${listingId}`, error);
      return false;
    }
  }

  protected async doUpdateInventory(ctx: AdapterContext, listingId: string, quantity: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const domain = SITE_DOMAINS[site] || 'sellercenter.lazada.com.my';
      const productUrl = `https://${domain}/app/seller/product/manage`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      const editBtn = 'button.edit, .edit-btn, [data-action="edit"], button:has-text("Edit")';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('lazada', 0.3, 0.5);
      }

      const qtyInput = 'input[name="stock"], .stock-input, input[name="quantity"]';
      await page.fill(qtyInput, '');
      await antiDetect.smartType(page, qtyInput, quantity.toString());
      await antiDetect.humanWait('lazada', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'lazada');

      logger.info(`Updated inventory for ${listingId} to ${quantity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update inventory for ${listingId}`, error);
      return false;
    }
  }
}

export const lazadaAdapter = new LazadaAdapter();

export default LazadaAdapter;
