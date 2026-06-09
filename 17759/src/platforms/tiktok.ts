import BasePlatformAdapter, { AdapterContext } from './base';
import { createLogger } from '../utils/logger';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { imageProcessor } from '../utils/imageProcessor';
import { translator } from '../utils/translator';
import type { PlatformType, SKUData, ListingResult, ListingStatus, PlatformAccount } from '../../types';

const logger = createLogger('tiktok-adapter');

const SITE_DOMAINS: Record<string, string> = {
  US: 'seller.tiktok.com/us',
  UK: 'seller.tiktok.com/uk',
  SG: 'seller.tiktok.com/sg',
  MY: 'seller.tiktok.com/my',
  TH: 'seller.tiktok.com/th',
  VN: 'seller.tiktok.com/vn',
  PH: 'seller.tiktok.com/ph',
  ID: 'seller.tiktok.com/id'
};

const SITE_LANGUAGES: Record<string, string> = {
  US: 'en',
  UK: 'en',
  SG: 'en',
  MY: 'en',
  TH: 'th',
  VN: 'vi',
  PH: 'en',
  ID: 'id'
};

class TikTokAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'tiktok';

  protected async doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean> {
    const { page, contextId } = ctx;
    const domain = SITE_DOMAINS[account.sites[0]] || 'seller.tiktok.com/us';
    const loginUrl = `https://${domain}/passport/login`;

    logger.info(`Navigating to TikTok Shop login: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await antiDetect.waitBetweenOperations(contextId, 'tiktok');

    try {
      const email = account.email;
      const password = authManager.getAccountPassword(account.id);
      
      if (!password) {
        throw new Error('Failed to get account password');
      }

      const switchToEmail = 'button:has-text("Use email / phone"), a[href*="email"], .switch-login-method';
      if (await this.waitForElement(page, switchToEmail, 3000)) {
        await antiDetect.smartClick(page, switchToEmail);
        await antiDetect.humanWait('tiktok', 0.3, 0.5);
      }

      const emailSelector = 'input[type="email"], input[name="email"], input[placeholder*="email"]';
      await antiDetect.smartType(page, emailSelector, email);
      await antiDetect.humanWait('tiktok', 0.3, 0.8);

      const passwordSelector = 'input[type="password"], input[name="password"]';
      await antiDetect.smartType(page, passwordSelector, password);
      await antiDetect.humanWait('tiktok', 0.3, 0.8);

      const loginBtn = 'button[type="submit"], .login-button, button:has-text("Log In"), button:has-text("Sign In")';
      await antiDetect.smartClick(page, loginBtn);
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const totpSelector = 'input[name="otp"], input[type="text"][maxlength="6"], .verification-code input, input[autocomplete="one-time-code"]';
      const hasTOTP = await this.waitForElement(page, totpSelector, 5000);
      
      if (hasTOTP) {
        logger.info('2FA verification required, generating TOTP');
        const totp = authManager.generateTOTP(account.id);
        
        if (!totp) {
          throw new Error('Failed to generate TOTP code');
        }

        const codeInputs = await page.$$('.code-inputs input, .otp-inputs input, input[maxlength="1"]');
        if (codeInputs.length > 0) {
          for (let i = 0; i < Math.min(totp.length, codeInputs.length); i++) {
            await codeInputs[i].fill(totp[i]);
            await antiDetect.humanWait('tiktok', 0.1, 0.2);
          }
        } else {
          await antiDetect.smartType(page, totpSelector, totp);
        }
        await antiDetect.humanWait('tiktok', 0.3, 0.6);

        const verifyBtn = 'button:has-text("Verify"), button[type="submit"], .submit-btn';
        await antiDetect.smartClick(page, verifyBtn);
        await antiDetect.waitBetweenOperations(contextId, 'tiktok');
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
        logger.info('Successfully logged into TikTok Shop Seller Center');
        return true;
      }

      const errorElement = await page.$('.error-message, .login-error, .error-text');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`TikTok login error: ${errorText?.trim() || 'Unknown error'}`);
      }

      return false;
    } catch (error) {
      logger.error('TikTok login failed', error);
      await this.takeScreenshot(ctx, 'login-error');
      throw error;
    }
  }

  private async isLoggedIn(page: any): Promise<boolean> {
    try {
      const url = page.url();
      if (url.includes('/login') || url.includes('/signin') || url.includes('/passport')) {
        return false;
      }

      const dashboardSelector = '.seller-dashboard, .main-container, .tiktok-seller-header';
      const userMenu = await page.$('.user-profile, .account-info, .header-avatar, [data-testid="user-avatar"]');
      
      return !!userMenu || (url.includes('seller.tiktok') && !url.includes('/login') && !url.includes('/passport'));
    } catch (e) {
      return false;
    }
  }

  private async checkForCaptcha(page: any): Promise<boolean> {
    const captchaSelectors = [
      '.captcha-container',
      '.tiktok-captcha',
      '.verify-captcha',
      '#captcha',
      'iframe[src*="captcha"], iframe[src*="verify"]'
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
    const domain = SITE_DOMAINS[site] || 'seller.tiktok.com/us';
    const targetLang = SITE_LANGUAGES[site] || 'en';
    
    logger.info(`Uploading listing ${sku.sku} to TikTok Shop ${site} (${targetLang})`);

    try {
      const processedImages = await imageProcessor.processImages(
        sku.images,
        'tiktok',
        sku.sku,
        { text: sku.brand || 'TIKTOK' }
      );

      let processedVideo: string | undefined;
      if (sku.video) {
        const videoProcessor = await import('../utils/videoProcessor');
        processedVideo = await videoProcessor.videoProcessor.processVideo(
          sku.video,
          'tiktok',
          sku.sku
        );
        logger.debug(`Processed video for ${sku.sku}`);
      }

      const localizedTitle = await translator.translateAndTruncate(
        sku.title.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'title',
        'tiktok'
      );

      const localizedDesc = await translator.translateAndTruncate(
        sku.description.en,
        targetLang as import('../utils/translator').TargetLanguage,
        'description',
        'tiktok'
      );

      const productUrl = `https://${domain}/product/list`;
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      await this.ensureLoggedIn(account, ctx);

      const addProductBtn = 'button:has-text("Add Product"), a[href*="/product/add"], .add-btn, [data-testid="add-product"]';
      await antiDetect.smartClick(page, addProductBtn);
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const categorySelector = '.category-search input, input[placeholder*="category"], .search-category';
      if (sku.category) {
        await antiDetect.smartType(page, categorySelector, sku.category);
        await antiDetect.humanWait('tiktok', 0.5, 1);
        
        const firstCategory = '.category-option:first-child, .suggestion-item:first-child, .category-list li:first-child';
        if (await this.waitForElement(page, firstCategory, 3000)) {
          await antiDetect.smartClick(page, firstCategory);
          await antiDetect.waitBetweenOperations(contextId, 'tiktok');
        }
      }

      const nextBtn = 'button:has-text("Next"), .next-step, [data-testid="next-button"]';
      if (await this.waitForElement(page, nextBtn, 5000)) {
        await antiDetect.smartClick(page, nextBtn);
        await antiDetect.waitBetweenOperations(contextId, 'tiktok');
      }

      const titleInput = 'textarea[name="productName"], input[name="productName"], .product-title-input, [data-testid="product-name-input"]';
      await antiDetect.smartType(page, titleInput, localizedTitle);
      await antiDetect.humanWait('tiktok', 0.3, 0.6);

      const brandInput = 'input[name="brand"], .brand-input, [data-testid="brand-input"]';
      if (sku.brand) {
        await antiDetect.smartType(page, brandInput, sku.brand);
        await antiDetect.humanWait('tiktok', 0.2, 0.4);
      }

      const descriptionInput = '.product-description textarea, .description-editor, [data-testid="description-input"]';
      await antiDetect.smartType(page, descriptionInput, localizedDesc);
      await antiDetect.humanWait('tiktok', 0.3, 0.6);

      const mediaTab = 'div[role="tab"]:has-text("Media"), .tab-media, [data-testid="media-tab"]';
      if (await this.waitForElement(page, mediaTab, 3000)) {
        await antiDetect.smartClick(page, mediaTab);
        await antiDetect.humanWait('tiktok', 0.3, 0.5);
      }

      if (processedVideo) {
        const videoInput = 'input[type="file"][accept*="video"], .video-upload input';
        const videoUpload = await page.$(videoInput);
        if (videoUpload) {
          await videoUpload.setInputFiles(processedVideo);
          logger.debug(`Uploaded video for ${sku.sku}`);
          await antiDetect.humanWait('tiktok', 2, 4);
        }
      }

      for (let i = 0; i < Math.min(processedImages.length, 9); i++) {
        const imagePath = processedImages[i];
        const fileInput = 'input[type="file"][accept*="image"], .image-upload input, .upload-input';
        
        const input = await page.$(fileInput);
        if (input) {
          await input.setInputFiles(imagePath);
          logger.debug(`Uploaded image ${i + 1}/${processedImages.length} for ${sku.sku}`);
          await antiDetect.humanWait('tiktok', 0.8, 1.5);
        }
      }

      const pricingTab = 'div[role="tab"]:has-text("Price"), .tab-price, [data-testid="pricing-tab"]';
      if (await this.waitForElement(page, pricingTab, 3000)) {
        await antiDetect.smartClick(page, pricingTab);
        await antiDetect.humanWait('tiktok', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input, input[placeholder*="price"], [data-testid="price-input"]';
      const price = sku.prices[site] || sku.prices['US'] || 0;
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('tiktok', 0.2, 0.4);

      const stockInput = 'input[name="stock"], .stock-input, input[placeholder*="stock"], input[name="quantity"], [data-testid="stock-input"]';
      const qty = sku.inventory[site] || sku.inventory['US'] || 0;
      await antiDetect.smartType(page, stockInput, qty.toString());
      await antiDetect.humanWait('tiktok', 0.2, 0.4);

      const weightInput = 'input[name="weight"], .weight-input, [data-testid="weight-input"]';
      if (sku.weight) {
        await antiDetect.smartType(page, weightInput, sku.weight.toString());
        await antiDetect.humanWait('tiktok', 0.2, 0.4);
      }

      if (sku.dimensions) {
        const lengthInput = 'input[name="length"], .length-input';
        const widthInput = 'input[name="width"], .width-input';
        const heightInput = 'input[name="height"], .height-input';
        
        await antiDetect.smartType(page, lengthInput, sku.dimensions.length.toString());
        await antiDetect.humanWait('tiktok', 0.1, 0.3);
        await antiDetect.smartType(page, widthInput, sku.dimensions.width.toString());
        await antiDetect.humanWait('tiktok', 0.1, 0.3);
        await antiDetect.smartType(page, heightInput, sku.dimensions.height.toString());
        await antiDetect.humanWait('tiktok', 0.1, 0.3);
      }

      const publishBtn = 'button:has-text("Publish"), button:has-text("List"), .submit-btn, [data-testid="publish-button"]';
      await antiDetect.smartClick(page, publishBtn);
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      await page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});

      const successIndicator = await page.$('.success-message, .toast--success, .notification-success, [data-testid="success-notification"]');
      const errorIndicator = await page.$('.error-message, .toast--error, .notification-error, [data-testid="error-notification"]');

      if (successIndicator) {
        const listingId = await this.extractListingId(page);
        logger.info(`Successfully created listing for ${sku.sku}`, { listingId });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'tiktok',
          accountId: account.id,
          site,
          status: 'under_review',
          listingId,
          listingUrl: listingId ? `https://www.tiktok.com/product/${listingId}` : undefined,
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
          platform: 'tiktok',
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
        platform: 'tiktok',
        accountId: account.id,
        site,
        status: 'under_review',
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    } catch (error) {
      logger.error(`Failed to upload listing ${sku.sku} to TikTok Shop`, error);
      await this.takeScreenshot(ctx, `upload-error-${sku.sku}`);
      
      return {
        taskId: '',
        sku: sku.sku,
        platform: 'tiktok',
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
      const idMatch = url.match(/\/product\/(\d+)/) || url.match(/product_id=(\d+)/);
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
      const errorElements = await page.$$('.validation-error, .field-error, .form-error, .error-detail');
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
      const domain = 'seller.tiktok.com/us';
      const manageUrl = `https://${domain}/product/list`;
      
      await page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const searchInput = 'input[placeholder*="search"], .search-input, input[aria-label*="search"], [data-testid="search-input"]';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const statusCell = `.status-tag, .product-status, [data-status], .status-badge, [data-testid="status-badge"]`;
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
    
    if (status.includes('active') || status.includes('live') || status.includes('online') || status.includes('for sale')) {
      return 'active';
    } else if (status.includes('inactive') || status.includes('offline') || status.includes('unpublished') || status.includes('hidden')) {
      return 'under_review';
    } else if (status.includes('pending') || status.includes('review') || status.includes('processing') || status.includes('under review')) {
      return 'under_review';
    } else if (status.includes('rejected') || status.includes('failed') || status.includes('violation') || status.includes('banned') || status.includes('removed')) {
      return 'rejected';
    } else if (status.includes('draft') || status.includes('editing')) {
      return 'pending';
    }
    
    return 'under_review';
  }

  protected async doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const domain = SITE_DOMAINS[site] || 'seller.tiktok.com/us';
      const productUrl = `https://${domain}/product/list`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const editBtn = 'button.edit, .edit-btn, [data-action="edit"], button:has-text("Edit"), [data-testid="edit-button"]';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('tiktok', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input, [data-testid="price-input"]';
      await page.fill(priceInput, '');
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('tiktok', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn, [data-testid="save-button"]';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

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
      const domain = SITE_DOMAINS[site] || 'seller.tiktok.com/us';
      const productUrl = `https://${domain}/product/list`;
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const searchInput = 'input[placeholder*="search"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      const editBtn = 'button.edit, .edit-btn, [data-action="edit"], button:has-text("Edit"), [data-testid="edit-button"]';
      if (await this.waitForElement(page, editBtn, 5000)) {
        await antiDetect.smartClick(page, editBtn);
        await antiDetect.humanWait('tiktok', 0.3, 0.5);
      }

      const qtyInput = 'input[name="stock"], .stock-input, input[name="quantity"], [data-testid="stock-input"]';
      await page.fill(qtyInput, '');
      await antiDetect.smartType(page, qtyInput, quantity.toString());
      await antiDetect.humanWait('tiktok', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save"), button.save, .submit-btn, [data-testid="save-button"]';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'tiktok');

      logger.info(`Updated inventory for ${listingId} to ${quantity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update inventory for ${listingId}`, error);
      return false;
    }
  }
}

export const tiktokAdapter = new TikTokAdapter();

export default TikTokAdapter;
