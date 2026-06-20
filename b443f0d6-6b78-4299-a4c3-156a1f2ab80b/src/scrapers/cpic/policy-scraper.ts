import { PolicyScraper } from '../base-scraper';
import { PolicyInfo, PolicyStatus, ProductType } from '../../utils/types';
import { sleep, randomInt } from '../../utils/helpers';
import logger from '../../utils/logger';

export class CpicPolicyScraper extends PolicyScraper {
  async getPolicyList(page: number = 1, productType: ProductType = 'employer-liability'): Promise<PolicyInfo[]> {
    logger.info(`获取太保保单列表 - 第${page}页`);

    try {
      if (!this.isCheckpointItemCompleted('step-login')) {
        if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
        return [];
        }
        }

        const sessionOk = await this.ensureSession();
        if (!sessionOk) {
        return [];
        }
        this.saveCheckpoint('step-login', true);
      } else {
        this.isLoggedIn = true;
        logger.info('断点续传: 跳过登录步骤');
      }

      if (!this.isCheckpointItemCompleted('step-navigate')) {
        this.emitProgress('加载保单列表', 30);
        await this.navigateToPolicyList();

        if (page > 1) {
          await this.goToPage(page);
        }
        this.saveCheckpoint('step-navigate', true);
      } else {
        logger.info('断点续传: 跳过导航/翻页步骤');
      }

      this.emitProgress('解析保单列表', 70);
      const policies = await this.parsePolicyList(productType);
      if (!this.isCheckpointItemCompleted('step-parse')) {
        this.saveCheckpoint('step-parse', true);
      }

      this.emitProgress('完成', 100);
      logger.info(`获取到 ${policies.length} 条太保保单`);
      return policies;
    } catch (error) {
      logger.error('获取太保保单列表失败', { error: (error as Error).message });
      return [];
    }
  }

  async getPolicyDetail(policyNumber: string): Promise<PolicyInfo | null> {
    logger.info(`获取太保保单详情: ${policyNumber}`);

    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          return null;
        }
      }

      const sessionOk = await this.ensureSession();
      if (!sessionOk) {
        return null;
      }

      this.emitProgress('查找保单', 30);
      await this.searchPolicy(policyNumber);

      this.emitProgress('解析保单详情', 70);
      const policy = await this.parsePolicyDetail();

      this.emitProgress('完成', 100);
      return policy;
    } catch (error) {
      logger.error(`获取太保保单详情失败: ${policyNumber}`, { error: (error as Error).message });
      return null;
    }
  }

  async getRenewalPremium(policyNumber: string): Promise<number | null> {
    logger.info(`获取太保续保保费: ${policyNumber}`);

    try {
      if (!this.isLoggedIn) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          return null;
        }
      }

      const sessionOk = await this.ensureSession();
      if (!sessionOk) {
        return null;
      }

      await this.navigateToRenewalPage();
      await this.searchPolicyForRenewal(policyNumber);
      await this.waitForAjax();

      const renewalPremium = await this.parseRenewalPremium();
      
      logger.info(`太保续保保费: ¥${renewalPremium}`);
      return renewalPremium;
    } catch (error) {
      logger.error(`获取太保续保保费失败: ${policyNumber}`, { error: (error as Error).message });
      return null;
    }
  }

  private async navigateToPolicyList(): Promise<void> {
    await this.driver.url(this.company.loginUrl + '/policy/list');
    await sleep(randomInt(2000, 4000));
  }

  private async goToPage(page: number): Promise<void> {
    const nextSelector = this.company.selectors.policyList.nextPageButton;
    if (nextSelector) {
      for (let i = 1; i < page; i++) {
        const nextButton = await this.safeFindElement(nextSelector);
        if (nextButton) {
          await this.browserManager.humanClick(this.driver, nextButton);
          await this.waitForAjax();
        }
      }
    }
  }

  private async parsePolicyList(productType: ProductType = 'employer-liability'): Promise<PolicyInfo[]> {
    const selectors = this.company.selectors.policyList;
    const policies: PolicyInfo[] = [];

    const policyItems = await this.driver.$$(selectors.policyItem);

    for (const item of policyItems) {
      try {
        const policyNumEl = await item.$(selectors.policyNumber);
        const statusEl = await item.$(selectors.policyStatus);
        const expireEl = await item.$(selectors.expireDate);

        const policyNumber = await this.safeGetText(policyNumEl);
        const statusText = await this.safeGetText(statusEl);
        const expireDateText = await this.safeGetText(expireEl);

        const policy: PolicyInfo = {
          companyId: this.company.id,
          companyName: this.company.name,
          policyNumber: policyNumber.trim(),
          insuredCompany: '',
          productType,
          coverageAmount: 0,
          premium: 0,
          startDate: new Date(),
          endDate: this.parseDate(expireDateText) || new Date(),
          status: this.parsePolicyStatus(statusText),
        };

        policies.push(policy);
      } catch {
        continue;
      }
    }

    return policies;
  }

  private parsePolicyStatus(statusText: string): PolicyStatus {
    const status = statusText.toLowerCase();
    if (status.includes('有效') || status.includes('active')) return 'active';
    if (status.includes('过期') || status.includes('expired')) return 'expired';
    if (status.includes('待生效') || status.includes('pending')) return 'pending';
    if (status.includes('取消') || status.includes('cancelled')) return 'cancelled';
    return 'active';
  }

  private async searchPolicy(policyNumber: string): Promise<void> {
    await this.driver.url(this.company.loginUrl + '/policy/detail?no=' + policyNumber);
    await sleep(randomInt(2000, 3000));
  }

  private async parsePolicyDetail(): Promise<PolicyInfo | null> {
    const selectors = this.company.selectors.policyDetail;

    const policyNumberEl = await this.safeFindElement(selectors.policyNumber);
    if (!policyNumberEl) return null;

    const insuredCompanyEl = await this.safeFindElement(selectors.insuredCompany);
    const coverageAmountEl = await this.safeFindElement(selectors.coverageAmount);
    const premiumEl = await this.safeFindElement(selectors.premium);
    const startDateEl = await this.safeFindElement(selectors.startDate);
    const endDateEl = await this.safeFindElement(selectors.endDate);
    const coverageTypeEl = await this.safeFindElement(selectors.coverageType);

    const policyNumber = policyNumberEl ? await this.safeGetText(policyNumberEl) : '';
    const insuredCompany = insuredCompanyEl ? await this.safeGetText(insuredCompanyEl) : '';
    const coverageAmountText = coverageAmountEl ? await this.safeGetText(coverageAmountEl) : '0';
    const premiumText = premiumEl ? await this.safeGetText(premiumEl) : '0';
    const startDateText = startDateEl ? await this.safeGetText(startDateEl) : '';
    const endDateText = endDateEl ? await this.safeGetText(endDateEl) : '';
    const coverageTypeText = coverageTypeEl ? await this.safeGetText(coverageTypeEl) : '';

    return {
      companyId: this.company.id,
      companyName: this.company.name,
      policyNumber: policyNumber.trim(),
      insuredCompany: insuredCompany.trim(),
      productType: this.parseProductType(coverageTypeText),
      coverageAmount: this.parseNumber(coverageAmountText),
      premium: this.parseNumber(premiumText),
      startDate: this.parseDate(startDateText) || new Date(),
      endDate: this.parseDate(endDateText) || new Date(),
      status: 'active',
    };
  }

  private parseProductType(text: string): any {
    if (text.includes('雇主')) return 'employer-liability';
    if (text.includes('意外')) return 'group-accident';
    if (text.includes('医疗')) return 'group-medical';
    if (text.includes('重疾')) return 'group-critical-illness';
    return 'employer-liability';
  }

  private async navigateToRenewalPage(): Promise<void> {
    await this.driver.url(this.company.loginUrl + '/renewal');
    await sleep(randomInt(2000, 3000));
  }

  private async searchPolicyForRenewal(policyNumber: string): Promise<void> {
    const searchInput = await this.safeFindElement('.policy-search-input');
    if (searchInput) {
      await searchInput.clearValue();
      await this.browserManager.humanType(this.driver, searchInput, policyNumber);
      const searchBtn = await this.safeFindElement('.search-btn');
      if (searchBtn) {
        await this.browserManager.humanClick(this.driver, searchBtn);
      }
    }
    await sleep(randomInt(1000, 2000));
  }

  private async parseRenewalPremium(): Promise<number> {
    const renewalPremiumEl = await this.safeFindElement('.renewal-premium');
    if (renewalPremiumEl) {
      const text = await this.safeGetText(renewalPremiumEl);
      return this.parseNumber(text);
    }
    return 0;
  }
}

export default CpicPolicyScraper;
