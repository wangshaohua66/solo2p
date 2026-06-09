import BasePlatformAdapter, { AdapterContext } from './base';
import { createLogger } from '../utils/logger';
import { authManager } from '../common/authManager';
import { antiDetect } from '../common/antiDetect';
import { imageProcessor } from '../utils/imageProcessor';
import type { PlatformType, SKUData, ListingResult, ListingStatus, PlatformAccount } from '../../types';

const logger = createLogger('ebay-adapter');

const SITE_DOMAINS: Record<string, string> = {
  US: 'www.ebay.com',
  UK: 'www.ebay.co.uk',
  DE: 'www.ebay.de',
  FR: 'www.ebay.fr',
  IT: 'www.ebay.it',
  ES: 'www.ebay.es',
  CA: 'www.ebay.ca',
  AU: 'www.ebay.com.au'
};

class EbayAdapter extends BasePlatformAdapter {
  platform: PlatformType = 'ebay';

  protected async doLogin(ctx: AdapterContext, account: PlatformAccount): Promise<boolean> {
    const { page, contextId } = ctx;
    const domain = SITE_DOMAINS[account.sites[0]] || 'www.ebay.com';
    const loginUrl = `https://signin.ebay.com/signin/s`;

    logger.info(`Navigating to eBay login: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await antiDetect.waitBetweenOperations(contextId, 'ebay');

    try {
      const email = account.email;
      const password = authManager.getAccountPassword(account.id);
      
      if (!password) {
        throw new Error('Failed to get account password');
      }

      const emailSelector = 'input[type="email"], input[name="userid"], #userid';
      await antiDetect.smartType(page, emailSelector, email);
      await antiDetect.humanWait('ebay', 0.3, 0.8);

      const continueBtn = 'button[type="submit"], #signin-continue-btn, [data-testid="signin-continue-btn"]';
      await antiDetect.smartClick(page, continueBtn);
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const passwordSelector = 'input[type="password"], input[name="pass"], #pass';
      await antiDetect.smartType(page, passwordSelector, password);
      await antiDetect.humanWait('ebay', 0.3, 0.8);

      const signInBtn = 'button[type="submit"], #sgnBt, [data-testid="signin-submit-button"]';
      await antiDetect.smartClick(page, signInBtn);
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const totpSelector = 'input[name="otp"], input[type="text"][maxlength="6"], .otp-input';
      const hasTOTP = await this.waitForElement(page, totpSelector, 5000);
      
      if (hasTOTP) {
        logger.info('2FA verification required, generating TOTP');
        const totp = authManager.generateTOTP(account.id);
        
        if (!totp) {
          throw new Error('Failed to generate TOTP code');
        }

        await antiDetect.smartType(page, totpSelector, totp);
        await antiDetect.humanWait('ebay', 0.3, 0.6);

        const verifyBtn = 'button[type="submit"], [data-testid="verify-button"], #verifyBtn';
        await antiDetect.smartClick(page, verifyBtn);
        await antiDetect.waitBetweenOperations(contextId, 'ebay');
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
        logger.info('Successfully logged into eBay');
        return true;
      }

      const errorElement = await page.$('.error-box, #error, .inline-error');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`eBay login error: ${errorText?.trim() || 'Unknown error'}`);
      }

      return false;
    } catch (error) {
      logger.error('eBay login failed', error);
      await this.takeScreenshot(ctx, 'login-error');
      throw error;
    }
  }

  private async isLoggedIn(page: any): Promise<boolean> {
    try {
      const url = page.url();
      if (url.includes('/signin')) {
        return false;
      }

      const userMenu = await page.$('.gh-eb-u, #gh-ug, [data-testid="user-menu"]');
      const sellerHub = url.includes('sellerhub.ebay.com') || url.includes('/mes');
      
      return !!userMenu || sellerHub;
    } catch (e) {
      return false;
    }
  }

  private async checkForCaptcha(page: any): Promise<boolean> {
    const captchaSelectors = [
      '#captcha_form',
      '.captcha-container',
      'iframe[src*="captcha"]',
      'div[data-captcha]'
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
    
    logger.info(`Uploading listing ${sku.sku} to eBay ${site}`);

    try {
      const processedImages = await imageProcessor.processImages(
        sku.images,
        'ebay',
        sku.sku,
        { text: sku.brand || 'BRANDED' }
      );

      const sellerHubUrl = 'https://sellerhub.ebay.com/listing/new';
      await page.goto(sellerHubUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      await this.ensureLoggedIn(account, ctx);

      const titleInput = 'input[placeholder="Tell buyers what you\'re selling"], #title, .title-input';
      await antiDetect.smartType(page, titleInput, sku.title.en);
      await antiDetect.humanWait('ebay', 0.5, 1);

      const suggestionFirst = '.suggestion-item:first-child, .category-suggestion:first-child';
      if (await this.waitForElement(page, suggestionFirst, 5000)) {
        await antiDetect.smartClick(page, suggestionFirst);
        await antiDetect.waitBetweenOperations(contextId, 'ebay');
      }

      if (sku.category) {
        const categoryInput = 'input[name="category"], .category-search input';
        await antiDetect.smartType(page, categoryInput, sku.category);
        await antiDetect.humanWait('ebay', 0.5, 1);
      }

      const conditionSelect = 'select[name="condition"], #condition, [data-testid="condition-select"]';
      if (await this.waitForElement(page, conditionSelect, 3000)) {
        await page.selectOption(conditionSelect, '1000');
        await antiDetect.humanWait('ebay', 0.2, 0.4);
      }

      const photoUpload = 'input[type="file"][accept*="image"], .photo-upload input';
      for (let i = 0; i < Math.min(processedImages.length, 12); i++) {
        const imagePath = processedImages[i];
        const input = await page.$(photoUpload);
        if (input) {
          await input.setInputFiles(imagePath);
          logger.debug(`Uploaded image ${i + 1}/${processedImages.length} for ${sku.sku}`);
          await antiDetect.humanWait('ebay', 0.8, 1.5);
        }
      }

      const itemSpecifics = 'button:has-text("Item specifics"), [data-testid="item-specifics"]';
      if (await this.waitForElement(page, itemSpecifics, 3000)) {
        await antiDetect.smartClick(page, itemSpecifics);
        await antiDetect.humanWait('ebay', 0.3, 0.5);

        const brandInput = 'input[name="Brand"], .brand-input';
        if (sku.brand && await this.waitForElement(page, brandInput, 3000)) {
          await antiDetect.smartType(page, brandInput, sku.brand);
          await antiDetect.humanWait('ebay', 0.2, 0.4);
        }

        const mpnInput = 'input[name="MPN"], .mpn-input';
        if (await this.waitForElement(page, mpnInput, 2000)) {
          await antiDetect.smartType(page, mpnInput, sku.sku);
          await antiDetect.humanWait('ebay', 0.2, 0.4);
        }
      }

      const descriptionTab = 'button:has-text("Description"), [data-testid="description-tab"]';
      if (await this.waitForElement(page, descriptionTab, 3000)) {
        await antiDetect.smartClick(page, descriptionTab);
        await antiDetect.humanWait('ebay', 0.3, 0.5);
      }

      const descriptionEditor = '.description-editor textarea, #desc, [contenteditable="true"]';
      await antiDetect.smartType(page, descriptionEditor, sku.description.en);
      await antiDetect.humanWait('ebay', 0.3, 0.6);

      const priceInput = 'input[name="price"], #BuyItNowPrice, .price-input';
      const price = sku.prices[site] || sku.prices['US'] || 0;
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('ebay', 0.2, 0.4);

      const qtyInput = 'input[name="quantity"], #quantity, .quantity-input';
      const qty = sku.inventory[site] || sku.inventory['US'] || 0;
      await antiDetect.smartType(page, qtyInput, qty.toString());
      await antiDetect.humanWait('ebay', 0.2, 0.4);

      const durationSelect = 'select[name="duration"], #listing-duration';
      if (await this.waitForElement(page, durationSelect, 3000)) {
        await page.selectOption(durationSelect, 'GTC');
        await antiDetect.humanWait('ebay', 0.2, 0.4);
      }

      const shippingSection = 'button:has-text("Shipping"), [data-testid="shipping-tab"]';
      if (await this.waitForElement(page, shippingSection, 3000)) {
        await antiDetect.smartClick(page, shippingSection);
        await antiDetect.humanWait('ebay', 0.3, 0.5);

        const freeShipping = 'label:has-text("Free shipping"), [data-testid="free-shipping"]';
        if (await this.waitForElement(page, freeShipping, 3000)) {
          await antiDetect.smartClick(page, freeShipping);
          await antiDetect.humanWait('ebay', 0.2, 0.4);
        }
      }

      const listItemBtn = 'button[type="submit"]:has-text("List item"), [data-testid="list-item-button"]';
      await antiDetect.smartClick(page, listItemBtn);
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      await page.waitForNavigation({ timeout: 60000, waitUntil: 'domcontentloaded' }).catch(() => {});

      const successIndicator = await page.$('.success-message, .congrats, [data-testid="listing-success"]');
      const errorIndicator = await page.$('.error-message, .validation-error, [data-testid="error"]');

      if (successIndicator) {
        const listingId = await this.extractListingId(page);
        logger.info(`Successfully created eBay listing for ${sku.sku}`, { listingId });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'ebay',
          accountId: account.id,
          site,
          status: 'active',
          listingId,
          listingUrl: listingId ? `https://www.ebay.com/itm/${listingId}` : undefined,
          startedAt: Date.now(),
          completedAt: Date.now(),
          retryCount: 0
        };
      }

      if (errorIndicator) {
        const errorText = await errorIndicator.textContent();
        logger.error(`eBay listing creation failed for ${sku.sku}`, { error: errorText });
        
        return {
          taskId: '',
          sku: sku.sku,
          platform: 'ebay',
          accountId: account.id,
          site,
          status: 'rejected',
          errorMessage: errorText || 'Unknown error',
          startedAt: Date.now(),
          completedAt: Date.now(),
          retryCount: 0
        };
      }

      return {
        taskId: '',
        sku: sku.sku,
        platform: 'ebay',
        accountId: account.id,
        site,
        status: 'under_review',
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0
      };
    } catch (error) {
      logger.error(`Failed to upload listing ${sku.sku} to eBay`, error);
      await this.takeScreenshot(ctx, `upload-error-${sku.sku}`);
      
      return {
        taskId: '',
        sku: sku.sku,
        platform: 'ebay',
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
      const idMatch = url.match(/\/itm\/(\d+)/) || url.match(/itemId=(\d+)/);
      if (idMatch) return idMatch[1];

      const idElement = await page.$('.item-id, [data-item-id], .listing-id');
      if (idElement) {
        const text = await idElement.textContent();
        const match = text?.match(/\d{10,13}/);
        if (match) return match[0];
      }
    } catch (e) {
      logger.debug('Failed to extract listing ID', e);
    }
    return undefined;
  }

  protected async doGetListingStatus(ctx: AdapterContext, listingId: string): Promise<ListingStatus> {
    const { page, contextId } = ctx;

    try {
      const manageUrl = `https://sellerhub.ebay.com/mes/dashboard`;
      
      await page.goto(manageUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const searchInput = 'input[placeholder="Search listings"], .search-input';
      await antiDetect.smartType(page, searchInput, listingId);
      await page.keyboard.press('Enter');
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const statusCell = `.status, .listing-status, [data-status]`;
      if (await this.waitForElement(page, statusCell, 10000)) {
        const statusText = await page.textContent(statusCell);
        const status = this.parseStatus(statusText || '');
        logger.debug(`eBay listing ${listingId} status: ${status}`);
        return status;
      }

      return 'pending';
    } catch (error) {
      logger.error(`Failed to get eBay status for listing ${listingId}`, error);
      throw error;
    }
  }

  private parseStatus(statusText: string): ListingStatus {
    const status = statusText.toLowerCase();
    
    if (status.includes('active') || status.includes('for sale')) {
      return 'active';
    } else if (status.includes('ended') || status.includes('sold')) {
      return 'under_review';
    } else if (status.includes('processing') || status.includes('pending')) {
      return 'pending';
    } else if (status.includes('rejected') || status.includes('error') || status.includes('violation')) {
      return 'rejected';
    }
    
    return 'under_review';
  }

  protected async doUpdatePrice(ctx: AdapterContext, listingId: string, price: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const editUrl = `https://sellerhub.ebay.com/lstng/edit?itemId=${listingId}`;
      
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const priceInput = 'input[name="price"], #BuyItNowPrice, .price-input';
      await page.fill(priceInput, '');
      await antiDetect.smartType(page, priceInput, price.toString());
      await antiDetect.humanWait('ebay', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save and continue"), button:has-text("Update listing")';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      logger.info(`Updated eBay price for ${listingId} to ${price}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update eBay price for ${listingId}`, error);
      return false;
    }
  }

  protected async doUpdateInventory(ctx: AdapterContext, listingId: string, quantity: number, site: string): Promise<boolean> {
    const { page, contextId } = ctx;

    try {
      const editUrl = `https://sellerhub.ebay.com/lstng/edit?itemId=${listingId}`;
      
      await page.goto(editUrl, { waitUntil: 'domcontentloaded' });
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      const qtyInput = 'input[name="quantity"], #quantity, .quantity-input';
      await page.fill(qtyInput, '');
      await antiDetect.smartType(page, qtyInput, quantity.toString());
      await antiDetect.humanWait('ebay', 0.2, 0.4);

      const saveBtn = 'button:has-text("Save and continue"), button:has-text("Update listing")';
      await antiDetect.smartClick(page, saveBtn);
      await antiDetect.waitBetweenOperations(contextId, 'ebay');

      logger.info(`Updated eBay inventory for ${listingId} to ${quantity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update eBay inventory for ${listingId}`, error);
      return false;
    }
  }
}

export const ebayAdapter = new EbayAdapter();

export default EbayAdapter;
