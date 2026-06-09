import BasePlatformAdapter, { AdapterContext } from './base';
import { createLogger } from '../utils/logger';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { imageProcessor } from '../utils/imageProcessor';
import type { PlatformType, SKUData, ListingResult, ListingStatus, PlatformAccount } from '../../types';

const logger = createLogger('amazon-adapter');

const SITE_DOMAINS: Record<string, string> = {
  US: 'sellercentral.amazon.com',
  CA: 'sellercentral.amazon.ca',
  UK: 'sellercentral.amazon.co.uk',
  DE: 'sellercentral.amazon.de',
  JP: 'sellercentral.amazon.co.jp',
  FR: 'sellercentral.amazon.fr',
  IT: 'sellercentral.amazon.it',
  ES: 'sellercentral.amazon.es'
};

class AmazonAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'amazon';

  protected async doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean> {
    const { page, contextId } = ctx;
    const domain = SITE_DOMAINS[account.sites[0]] || 'sellercentral.amazon.com';
    const loginUrl = `https://${domain}/ap/signin`;

    logger.info(`Navigating to Amazon login: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await antiDetect.waitBetweenOperations(contextId, 'amazon');

    try {
      const email = account.email;
      const password = authManager.getAccountPassword(account.id);
      
      if (!password) {
        throw new Error('Failed to get account password');
      }

      const emailSelector = 'input[type="email"], input[name="email"], #ap_email';
      await antiDetect.smartType(page, emailSelector, email);
      await antiDetect.humanWait('amazon', 0.3, 0.8);

      const continueBtn = 'input[type="submit"], #continue, button[type="submit"]';
      await antiDetect.smartClick(page, continueBtn);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const passwordSelector = 'input[type="password"], input[name="password"], #ap_password';
      await antiDetect.smartType(page, passwordSelector, password);
      await antiDetect.humanWait('amazon', 0.3, 0.8);

      const signInBtn = 'input[type="submit"], #signInSubmit, button[type="submit"]';
      await antiDetect.smartClick(page, signInBtn);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const totpSelector = 'input[name="otpCode"], input[type="text"][autocomplete="one-time-code"]';
      const hasTOTP = await this.waitForElement(page, totpSelector, 5000);
      
      if (hasTOTP) {
        logger.info('2FA verification required, generating TOTP');
        const totp = authManager.generateTOTP(account.id);
        
        if (!totp) {
          throw new Error('Failed to generate TOTP code');
        }

        await antiDetect.smartType(page, totpSelector, totp);
        await antiDetect.humanWait('amazon', 0.3, 0.6);

        const verifyBtn = 'input[type="submit"], button[type="submit"], #continue';
        await antiDetect.smartClick(page, verifyBtn);
        await antiDetect.waitBetweenOperations(contextId, 'amazon');
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
        logger.info('Successfully logged into Amazon Seller Central');
        return true;
      }

      const errorElement = await page.$('#auth-error-message-box, .a-alert-content');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Amazon login error: ${errorText?.trim() || 'Unknown error'}`);
      }

      return false;
    } catch (error) {
      logger.error('Amazon login failed', error);
      await this.takeScreenshot(ctx, 'login-error');
      throw error;
    }
  }

  private async isLoggedIn(page: any): Promise<boolean> {
    try {
      const url = page.url();
      if (url.includes('/ap/signin') || url.includes('/signin')) {
        return false;
      }

      const dashboardSelector = '.sc-top-nav, #sellerCentralApp, .dashboard-container';
      const userMenu = await page.$('.sc-global-header-account-name, [data-testid="user-menu"]');
      
      return !!userMenu || url.includes('sellercentral.amazon');
    } catch (e) {
      return false;
    }
  }

  private async checkForCaptcha(page: any): Promise<boolean> {
    const captchaSelectors = [
      '#captchacharacters',
      'div.a-row.captcha-container',
      '#auth-captcha-image-container',
      'img[src*="captcha"]'
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
    const domain = SITE_DOMAINS[site] || 'sellercentral.amazon.com';
    
    logger.info(`Uploading listing ${sku.sku} to Amazon ${site}`);

    try {
      const processedImages = await imageProcessor.processImages(
        sku.images,
        'amazon',
        sku.sku,
        { text: sku.brand || 'BRANDED' }
      );

      const inventoryUrl = `https://${domain}/inventory/ref=xx_invmenu_dnav_home`;
      await page.goto(inventoryUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      await this.ensureLoggedIn(account, ctx);

      const addProductBtn = 'button[data-testid="add-product-button"], #btn-add-products, a[href*="/inventory/add"]';
      await antiDetect.smartClick(page, addProductBtn);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const iAmSellingBtn = 'button:has-text("I\'m selling a product not sold on Amazon"), #dont-have-asin';
      const hasBtn = await this.waitForElement(page, iAmSellingBtn, 5000);
      if (hasBtn) {
        await antiDetect.smartClick(page, iAmSellingBtn);
        await antiDetect.waitBetweenOperations(contextId, 'amazon');
      }

      const categorySelector = 'input[name="product-category"], .category-search input';
      if (sku.category) {
        await antiDetect.smartType(page, categorySelector, sku.category);
        await antiDetect.humanWait('amazon', 0.5, 1);
        
        const firstCategory = '.category-suggestions li:first-child, .autocomplete-result:first-child';
        if (await this.waitForElement(page, firstCategory, 3000)) {
          await antiDetect.smartClick(page, firstCategory);
          await antiDetect.waitBetweenOperations(contextId, 'amazon');
        }
      }

      const titleInput = 'textarea[name="title"], input[name="product-title"], #title';
      await antiDetect.smartType(page, titleInput, sku.title.en);
      await antiDetect.humanWait('amazon', 0.3, 0.6);

      const brandInput = 'input[name="brand"], #brand, input[placeholder="brand"]';
      if (sku.brand) {
        await antiDetect.smartType(page, brandInput, sku.brand);
        await antiDetect.humanWait('amazon', 0.2, 0.4);
      }

      const descriptionTab = 'button:has-text("Description"), a[href*="#description"]';
      if (await this.waitForElement(page, descriptionTab, 3000)) {
        await antiDetect.smartClick(page, descriptionTab);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      const descriptionInput = 'textarea[name="description"], #product-description, .description-editor';
      await antiDetect.smartType(page, descriptionInput, sku.description.en);
      await antiDetect.humanWait('amazon', 0.3, 0.6);

      const imagesTab = 'button:has-text("Images"), a[href*="#images"]';
      if (await this.waitForElement(page, imagesTab, 3000)) {
        await antiDetect.smartClick(page, imagesTab);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      for (let i = 0; i < Math.min(processedImages.length, 9); i++) {
        const imagePath = processedImages[i];
        const fileInput = 'input[type="file"][accept*="image"]';
        
        const input = await page.$(fileInput);
        if (input) {
          await input.setInputFiles(imagePath);
          logger.debug(`Uploaded image ${i + 1}/${processedImages.length} for ${sku.sku}`);
          await antiDetect.humanWait('amazon', 0.8, 1.5);
        }
      }

      const pricingTab = 'button:has-text("Pricing"), a[href*="#pricing"]';
      if (await this.waitForElement(page, pricingTab, 3000)) {
        await antiDetect.smartClick(page, pricingTab);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      const priceInput = 'input[name="standard_price"], #price, input[placeholder="price"]';
      const price = sku.prices[site] || sku.prices['US'] || 0;
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('amazon', 0.2, 0.4);

      const inventoryTab = 'button:has-text("Inventory"), a[href*="#inventory"]';
      if (await this.waitForElement(page, inventoryTab, 3000)) {
        await antiDetect.smartClick(page, inventoryTab);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      const qtyInput = 'input[name="quantity"], #quantity, input[placeholder="quantity"]';
      const qty = sku.inventory[site] || sku.inventory['US'] || 0;
      await antiDetect.smartType(page, qtyInput, qty.toString());
      await antiDetect.humanWait('amazon', 0.2, 0.4);

      const saveAndFinish = 'button:has-text("Save and finish"), #submit-button';
      await antiDetect.smartClick(page, saveAndFinish);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      await page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});

      const successIndicator = await page.$('.success-message, .alert-success, [data-testid="success-banner"]');
      const errorIndicator = await page.$('.error-message, .alert-danger, [data-testid="error-banner"]');

      if (successIndicator) {
        const listingId = await this.extractListingId(page);
        logger.info(`Successfully created listing for ${sku.sku}`, { listingId });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'amazon',
          accountId: account.id,
          site,
          status: 'under_review',
          listingId,
          listingUrl: listingId ? `https://${domain}/dp/${listingId}` : undefined,
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
          platform: 'amazon',
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
        platform: 'amazon',
        accountId: account.id,
        site,
        status: 'under_review',
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    } catch (error) {
      logger.error(`Failed to upload listing ${sku.sku} to Amazon`, error);
      await this.takeScreenshot(ctx, `upload-error-${sku.sku}`);
      
      return {
        taskId: '',
        sku: sku.sku,
        platform: 'amazon',
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
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/) || url.match(/asin=([A-Z0-9]{10})/);
      if (asinMatch) return asinMatch[1];

      const asinElement = await page.$('.asin-value, [data-asin], .product-asin');
      if (asinElement) {
        const text = await asinElement.textContent();
        const match = text?.match(/[A-Z0-9]{10}/);
        if (match) return match[0];
      }
    } catch (e) {
      logger.debug('Failed to extract listing ID', e);
    }
    return undefined;
  }

  private async parseRejectReason(page: any): Promise<string | undefined> {
    try {
      const errorElements = await page.$$('.validation-error, .field-error, .error-detail');
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
      const domain = 'sellercentral.amazon.com';
      const manageUrl = `https://${domain}/inventory/ref=xx_invmenu_dnav_home`;
      
      await page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const searchInput = 'input[placeholder="Search inventory"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const statusCell = `.status-cell, [data-listing-status], .listing-status`;
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
    
    if (status.includes('active') || status.includes('live') || status.includes('for sale')) {
      return 'active';
    } else if (status.includes('inactive') || status.includes('suppressed')) {
      return 'under_review';
    } else if (status.includes('pending') || status.includes('processing')) {
      return 'pending';
    } else if (status.includes('rejected') || status.includes('error') || status.includes('failed')) {
      return 'rejected';
    }
    
    return 'under_review';
  }

  protected async doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const domain = SITE_DOMAINS[site] || 'sellercentral.amazon.com';
      const priceUrl = `https://${domain}/inventory/ref=xx_invmenu_dnav_home`;
      
      await page.goto(priceUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const searchInput = 'input[placeholder="Search inventory"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const editPriceBtn = 'button.edit-price, .price-edit, [data-action="edit-price"]';
      if (await this.waitForElement(page, editPriceBtn, 5000)) {
        await antiDetect.smartClick(page, editPriceBtn);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      const priceInput = 'input[name="price"], .price-input';
      await page.fill(priceInput, '');
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('amazon', 0.2, 0.4);

      const saveBtn = 'button.save, button:has-text("Save"), [data-action="save"]';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

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
      const domain = SITE_DOMAINS[site] || 'sellercentral.amazon.com';
      const inventoryUrl = `https://${domain}/inventory/ref=xx_invmenu_dnav_home`;
      
      await page.goto(inventoryUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const searchInput = 'input[placeholder="Search inventory"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      const editQtyBtn = 'button.edit-quantity, .quantity-edit, [data-action="edit-quantity"]';
      if (await this.waitForElement(page, editQtyBtn, 5000)) {
        await antiDetect.smartClick(page, editQtyBtn);
        await antiDetect.humanWait('amazon', 0.3, 0.5);
      }

      const qtyInput = 'input[name="quantity"], .quantity-input';
      await page.fill(qtyInput, '');
      await antiDetect.smartType(page, qtyInput, quantity.toString());
      await antiDetect.humanWait('amazon', 0.2, 0.4);

      const saveBtn = 'button.save, button:has-text("Save"), [data-action="save"]';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'amazon');

      logger.info(`Updated inventory for ${listingId} to ${quantity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update inventory for ${listingId}`, error);
      return false;
    }
  }
}

export const amazonAdapter = new AmazonAdapter();

export default AmazonAdapter;
