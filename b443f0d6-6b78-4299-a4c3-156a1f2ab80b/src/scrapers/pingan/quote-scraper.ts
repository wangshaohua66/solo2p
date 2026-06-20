import { QuoteScraper } from '../base-scraper';
import { QuoteRequest, QuoteResult, ProductType } from '../../utils/types';
import { sleep, randomInt } from '../../utils/helpers';
import logger from '../../utils/logger';

export class PinganQuoteScraper extends QuoteScraper {
  async scrapeQuote(request: QuoteRequest): Promise<QuoteResult> {
    const startTime = Date.now();
    logger.info(`开始抓取平安报价: ${request.industry}, ${request.employeeCount}人`);

    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          return this.createErrorResult('登录失败', request.productType);
        }
      }

      const sessionOk = await this.ensureSession();
      if (!sessionOk) {
          return this.createErrorResult('会话验证失败', request.productType);
        }
      this.saveCheckpoint('step-login', true);

      this.emitProgress('填写报价表单', 30);
      await this.fillQuoteForm(request);
      this.saveCheckpoint('step-fill-form', true);

      this.emitProgress('提交报价计算', 50);
      await this.submitQuoteForm();
      this.saveCheckpoint('step-submit', true);

      this.emitProgress('等待报价结果', 70);
      await this.waitForQuoteResult();
      this.saveCheckpoint('step-wait-result', true);

      this.emitProgress('解析报价数据', 90);
      const result = await this.parseQuoteResult(request);
      this.saveCheckpoint('step-parse', true);

      const duration = (Date.now() - startTime) / 1000;
      logger.info(`平安报价抓取完成: ¥${result.premium}, 耗时 ${duration.toFixed(1)}s`);

      this.emitProgress('完成', 100);
      return result;
    } catch (error) {
      logger.error('平安报价抓取失败', { error: (error as Error).message });
      return this.createErrorResult((error as Error).message, request.productType);
    }
  }

  private async fillQuoteForm(request: QuoteRequest): Promise<void> {
    const selectors = this.company.selectors.quoteForm;
    const bm = this.browserManager;

    const industrySelect = await this.driver.$(selectors.industrySelect);
    await bm.humanClick(this.driver, industrySelect);
    await sleep(randomInt(300, 800));
    await industrySelect.addValue(request.industry);

    await sleep(randomInt(300, 600));

    const employeeInput = await this.driver.$(selectors.employeeCountInput);
    await employeeInput.clearValue();
    await bm.humanType(this.driver, employeeInput, String(request.employeeCount));

    await sleep(randomInt(300, 600));

    const riskSelect = await this.driver.$(selectors.riskLevelSelect);
    await bm.humanClick(this.driver, riskSelect);
    await sleep(randomInt(300, 800));
    await riskSelect.addValue(request.riskLevel);

    await sleep(randomInt(300, 600));

    const coverageInput = await this.driver.$(selectors.coverageAmountInput);
    await coverageInput.clearValue();
    await bm.humanType(this.driver, coverageInput, String(request.coverageAmount));

    await sleep(randomInt(300, 600));

    const deductibleInput = await this.driver.$(selectors.deductibleInput);
    await deductibleInput.clearValue();
    await bm.humanType(this.driver, deductibleInput, String(request.deductible));

    await sleep(randomInt(300, 600));

    const productSelect = await this.driver.$(selectors.productTypeSelect);
    await bm.humanClick(this.driver, productSelect);
    await sleep(randomInt(300, 800));
    await productSelect.addValue(request.productType);

    await bm.randomScroll(this.driver);
    await sleep(randomInt(500, 1000));
  }

  private async submitQuoteForm(): Promise<void> {
    const selectors = this.company.selectors.quoteForm;
    const submitButton = await this.driver.$(selectors.submitButton);
    await this.browserManager.humanClick(this.driver, submitButton);
  }

  private async waitForQuoteResult(): Promise<void> {
    await this.waitForAjax();
    
    const resultSelector = this.company.selectors.quoteResult.resultContainer;
    await this.waitForElement(resultSelector, 30000);
    
    await sleep(randomInt(1000, 2000));
  }

  private async parseQuoteResult(request: QuoteRequest): Promise<QuoteResult> {
    const selectors = this.company.selectors.quoteResult;

    const premiumElement = await this.safeFindElement(selectors.premiumAmount);
    const premiumText = premiumElement ? await this.safeGetText(premiumElement) : '0';
    const premium = this.parseNumber(premiumText);

    const coverageElement = await this.safeFindElement(selectors.coverageDetails);
    const coverageDetails = coverageElement ? await this.safeGetText(coverageElement) : '';

    const deductibleElement = await this.safeFindElement(selectors.deductibleInfo);
    const deductibleText = deductibleElement ? await this.safeGetText(deductibleElement) : '';
    const deductible = this.parseNumber(deductibleText) || request.deductible;

    const clausesElement = await this.safeFindElement(selectors.specialClauses);
    const clausesText = clausesElement ? await this.safeGetText(clausesElement) : '';
    const specialClauses = clausesText
      .split(/[;；\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      companyId: this.company.id,
      companyName: this.company.name,
      productType: request.productType,
      premium,
      coverageAmount: request.coverageAmount,
      deductible,
      coverageDetails,
      specialClauses,
      scrapedAt: new Date(),
      success: true,
    };
  }

  private createErrorResult(errorMessage: string, productType: ProductType): QuoteResult {
    return {
      companyId: this.company.id,
      companyName: this.company.name,
      productType,
      premium: 0,
      coverageAmount: 0,
      deductible: 0,
      coverageDetails: '',
      specialClauses: [],
      scrapedAt: new Date(),
      success: false,
      errorMessage,
    };
  }
}

export default PinganQuoteScraper;
