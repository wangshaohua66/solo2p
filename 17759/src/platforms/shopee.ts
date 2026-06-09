import BasePlatformAdapter, { AdapterContext } from './base';
import { createLogger } from '../utils/logger';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { imageProcessor } from '../utils/imageProcessor';
import { translator } from '../utils/translator';
import type { PlatformType, SKUData, ListingResult, ListingStatus, PlatformAccount } from '../../types';

const logger = createLogger('shopee-adapter');

const SITE_DOMAINS: Record<string, string> = {
  MY: 'seller.shopee.com.my',
  SG: 'seller.shopee.sg',
  TH: 'seller.shopee.co.th',
  VN: 'seller.shopee.vn',
  PH: 'seller.shopee.ph',
  ID: 'seller.shopee.co.id',
  TW: 'seller.shopee.tw',
  BR: 'seller.shopee.com.br'
};

const SITE_LANGUAGES: Record<string, string> = {
  MY: 'en',
  SG: 'en',
  TH: 'th',
  VN: 'vi',
  PH: 'en',
  ID: 'id',
  TW: 'zh-TW',
  BR: 'pt'
};

class ShopeeAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'shopee';

  protected async doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean> {
    const { page, contextId } = ctx;
    const domain = SITE_DOMAINS[account.sites[0]] || 'seller.shopee.com.my';
    const loginUrl = `https://${domain}/account/login`;

    logger.info(`Navigating to Shopee login: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await antiDetect.waitBetweenOperations(contextId, 'shopee');

    try {
      const email = account.email;
      const password = authManager.getAccountPassword(account.id);
      
      if (!password) {
        throw new Error('Failed to get account password');
      }

      const phoneSelector = 'input[type="text"], input[name="phone"], input[placeholder*="phone"], input[placeholder*="email"]';
      await antiDetect.smartType(page, phoneSelector, email);
      await antiDetect.humanWait('shopee', 0.3, 0.8);

      const passwordSelector = 'input[type="password"], input[name="password"]';
      await antiDetect.smartType(page, passwordSelector, password);
      await antiDetect.humanWait('shopee', 0.3, 0.8);

      const loginBtn = 'button[type="submit"], .login-button, button:has-text("Log In"), button:has-text("Sign In")';
      await antiDetect.smartClick(page, loginBtn);
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const totpSelector = 'input[name="otp"], input[type="text"][maxlength="6"], .otp-input input';
      const hasTOTP = await this.waitForElement(page, totpSelector, 5000);
      
      if (hasTOTP) {
        logger.info('2FA verification required, generating TOTP');
        const totp = authManager.generateTOTP(account.id);
        
        if (!totp) {
          throw new Error('Failed to generate TOTP code');
        }

        const otpInputs = await page.$$('.otp-input input, input[maxlength="1"]');
        if (otpInputs.length > 0) {
          for (let i = 0; i < Math.min(totp.length, otpInputs.length); i++) {
            await antiDetect.smartType(page, `input:nth-child(${i + 1})`, totp[i]);
            await antiDetect.humanWait('shopee', 0.1, 0.2);
          }
        } else {
          await antiDetect.smartType(page, totpSelector, totp);
        }
        await antiDetect.humanWait('shopee', 0.3, 0.6);

        const verifyBtn = 'button:has-text("Verify"), button[type="submit"]';
        await antiDetect.smartClick(page, verifyBtn);
        await antiDetect.waitBetweenOperations(contextId, 'shopee');
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
        logger.info('Successfully logged into Shopee Seller Center');
        return true;
      }

      const errorElement = await page.$('.error-message, .shopee-alert--error, .shopee-form-item__error');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Shopee login error: ${errorText?.trim() || 'Unknown error'}`);
      }

      return false;
    } catch (error) {
      logger.error('Shopee login failed', error);
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

      const dashboardSelector = '.seller-dashboard, .main-dashboard, .shopee-seller-header';
      const userMenu = await page.$('.user-info, .account-dropdown, [data-testid="user-avatar"]');
      
      return !!userMenu || url.includes('seller.shopee') && !url.includes('/login');
    } catch (e) {
      return false;
    }
  }

  private async checkForCaptcha(page: any): Promise<boolean> {
    const captchaSelectors = [
      '.shopee-captcha',
      '.captcha-container',
      '#captcha-slider',
      '.geetest_panel',
      'iframe[src*="captcha"]'
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
    const domain = SITE_DOMAINS[site] || 'seller.shopee.com.my';
    const targetLang = SITE_LANGUAGES[site] || 'en';
    
    logger.info(`Uploading listing ${sku.sku} to Shopee ${site} (${targetLang})`);

    try {
      const processedImages = await imageProcessor.processImages(
        sku.images,
        'shopee',
        sku.sku,
        { text: sku.brand || 'SHOPPE' }
      );

      const localizedTitle = await translator.translateAndTruncate(
        sku.title.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'title',
        'shopee'
      );

      const localizedDesc = await translator.translateAndTruncate(
        sku.description.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'description',
        'shopee'
      );

      const productUrl = `https://${domain}/portal/product/list/all`;
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      await this.ensureLoggedIn(account, ctx);

      const addProductBtn = 'button:has-text("Add Product"), a[href*="/product/add"], .add-product-btn';
      await antiDetect.smartClick(page, addProductBtn);
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const categorySelector = '.category-search input, input[placeholder*="category"]';
      if (sku.category) {
        await antiDetect.smartType(page, categorySelector, sku.category);
        await antiDetect.humanWait('shopee', 0.5, 1);
        
        const firstCategory = '.category-result li:first-child, .suggestion-item:first-child';
        if (await this.waitForElement(page, firstCategory, 3000)) {
          await antiDetect.smartClick(page, firstCategory);
          await antiDetect.waitBetweenOperations(contextId, 'shopee');
        }
      }

      const nextBtn = 'button:has-text("Next"), .next-step-btn';
      if (await this.waitForElement(page, nextBtn, 5000)) {
        await antiDetect.smartClick(page, nextBtn);
        await antiDetect.waitBetweenOperations(contextId, 'shopee');
      }

      const titleInput = 'textarea[name="productName"], input[name="productName"], .product-name-input';
      await antiDetect.smartType(page, titleInput, localizedTitle);
      await antiDetect.humanWait('shopee', 0.3, 0.6);

      const brandInput = 'input[name="brand"], .brand-input';
      if (sku.brand) {
        await antiDetect.smartType(page, brandInput, sku.brand);
        await antiDetect.humanWait('shopee', 0.2, 0.4);
      }

      const descriptionInput = '.product-description textarea, .description-editor, [data-testid="description-input"]';
      await antiDetect.smartType(page, descriptionInput, localizedDesc);
      await antiDetect.humanWait('shopee', 0.3, 0.6);

      const imagesTab = 'div[role="tab"]:has-text("Images"), .images-section';
      if (await this.waitForElement(page, imagesTab, 3000)) {
        await antiDetect.smartClick(page, imagesTab);
        await antiDetect.humanWait('shopee', 0.3, 0.5);
      }

      for (let i = 0; i < Math.min(processedImages.length, 9); i++) {
        const imagePath = processedImages[i];
        const fileInput = 'input[type="file"][accept*="image"], .image-upload input';
        
        const input = await page.$(fileInput);
        if (input) {
          await input.setInputFiles(imagePath);
          logger.debug(`Uploaded image ${i + 1}/${processedImages.length} for ${sku.sku}`);
          await antiDetect.humanWait('shopee', 0.8, 1.5);
        }
      }

      const pricingTab = 'div[role="tab"]:has-text("Price"), .pricing-section';
      if (await this.waitForElement(page, pricingTab, 3000)) {
        await antiDetect.smartClick(page, pricingTab);
        await antiDetect.humanWait('shopee', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input, input[placeholder*="price"]';
      const price = sku.prices[site] || sku.prices['MY'] || 0;
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('shopee', 0.2, 0.4);

      const stockInput = 'input[name="stock"], .stock-input, input[placeholder*="stock"], input[placeholder*="quantity"]';
      const qty = sku.inventory[site] || sku.inventory['MY'] || 0;
      await antiDetect.smartType(page, stockInput, qty.toString());
      await antiDetect.humanWait('shopee', 0.2, 0.4);

      const weightInput = 'input[name="weight"], .weight-input';
      if (sku.weight) {
        await antiDetect.smartType(page, weightInput, sku.weight.toString());
        await antiDetect.humanWait('shopee', 0.2, 0.4);
      }

      const publishBtn = 'button:has-text("Publish"), button:has-text("List"), .submit-btn';
      await antiDetect.smartClick(page, publishBtn);
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      await page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});

      const successIndicator = await page.$('.success-message, .shopee-alert--success, [data-testid="success-notification"]');
      const errorIndicator = await page.$('.error-message, .shopee-alert--error, .form-error');

      if (successIndicator) {
        const listingId = await this.extractListingId(page);
        logger.info(`Successfully created listing for ${sku.sku}`, { listingId });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'shopee',
          accountId: account.id,
          site,
          status: 'under_review',
          listingId,
          listingUrl: listingId ? `https://shopee.com.my/product/${listingId}` : undefined,
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
          platform: 'shopee',
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
        platform: 'shopee',
        accountId: account.id,
        site,
        status: 'under_review',
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    } catch (error) {
      logger.error(`Failed to upload listing ${sku.sku} to Shopee`, error);
      await this.takeScreenshot(ctx, `upload-error-${sku.sku}`);
      
      return {
        taskId: '',
        sku: sku.sku,
        platform: 'shopee',
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
      const idMatch = url.match(/\/product\/(\d+)/) || url.match(/itemId=(\d+)/);
      if (idMatch) return idMatch[1];

      const successText = await page.$('.success-text, .product-id');
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
      const errorElements = await page.$$('.validation-error, .field-error, .shopee-form-item__error');
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
      const domain = 'seller.shopee.com.my';
      const manageUrl = `https://${domain}/portal/product/list/all`;
      
      await page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const searchInput = 'input[placeholder*="search"], .search-input, input[aria-label*="search"]';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const statusCell = `.status-badge, .product-status, [data-status]`;
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
    
    if (status.includes('active') || status.includes('live') || status.includes('selling') || status.includes('normal')) {
      return 'active';
    } else if (status.includes('inactive') || status.includes('unpublished') || status.includes('off')) {
      return 'under_review';
    } else if (status.includes('pending') || status.includes('review') || status.includes('processing')) {
      return 'under_review';
    } else if (status.includes('rejected') || status.includes('banned') || status.includes('violation') || status.includes('error')) {
      return 'rejected';
    } else if (status.includes('draft') || status.includes('unlisted')) {
      return 'pending';
    }
    
    return 'under_review';
  }

  protected async doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const domain = SITE_DOMAINS[site] || 'seller.shopee.com.my';
      const productUrl = `https://${domain}/portal/product/list/all`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const editBtn = 'button.edit, .edit-price-btn, [data-action="edit"]';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('shopee', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input';
      await page.fill(priceInput, '');
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('shopee', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

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
      const domain = SITE_DOMAINS[site] || 'seller.shopee.com.my';
      const productUrl = `https://${domain}/portal/product/list/all`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      const editBtn = 'button.edit, .edit-stock-btn, [data-action="edit"]';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('shopee', 0.3, 0.5);
      }

      const qtyInput = 'input[name="stock"], .stock-input, input[name="quantity"]';
      await page.fill(qtyInput, '');
      await antiDetect.smartType(page, qtyInput, quantity.toString());
      await antiDetect.humanWait('shopee', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'shopee');

      logger.info(`Updated inventory for ${listingId} to ${quantity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update inventory for ${listingId}`, error);
      return false;
    }
  }
}

export const shopeeAdapter = new ShopeeAdapter();

export default ShopeeAdapter;
