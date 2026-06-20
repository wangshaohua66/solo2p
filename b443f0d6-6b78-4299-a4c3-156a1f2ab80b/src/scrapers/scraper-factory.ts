import { InsuranceCompany, QuoteRequest, QuoteResult, PolicyInfo } from '../utils/types';
import { QuoteScraper, PolicyScraper } from './base-scraper';
import PiccQuoteScraper from './picc/quote-scraper';
import PiccPolicyScraper from './picc/policy-scraper';
import PinganQuoteScraper from './pingan/quote-scraper';
import PinganPolicyScraper from './pingan/policy-scraper';
import CpicQuoteScraper from './cpic/quote-scraper';
import CpicPolicyScraper from './cpic/policy-scraper';
import ChinalifeQuoteScraper from './chinalife/quote-scraper';
import ChinalifePolicyScraper from './chinalife/policy-scraper';
import TaikangQuoteScraper from './taikang/quote-scraper';
import TaikangPolicyScraper from './taikang/policy-scraper';
import NewchinaQuoteScraper from './newchina/quote-scraper';
import NewchinaPolicyScraper from './newchina/policy-scraper';
import SinoyangQuoteScraper from './sinoyang/quote-scraper';
import SinoyangPolicyScraper from './sinoyang/policy-scraper';
import ChinaaciQuoteScraper from './chinaaci/quote-scraper';
import ChinaaciPolicyScraper from './chinaaci/policy-scraper';
import { getCompanyById } from '../config/profiles';
import { generateId } from '../utils/helpers';
import logger from '../utils/logger';

export class ScraperFactory {
  static createQuoteScraper(companyId: string, taskId?: string): QuoteScraper {
    const company = getCompanyById(companyId);
    if (!company) {
      throw new Error(`未知的保险公司: ${companyId}`);
    }

    const tid = taskId || generateId();

    switch (companyId) {
      case 'picc':
        return new PiccQuoteScraper(company, tid);
      case 'pingan':
        return new PinganQuoteScraper(company, tid);
      case 'cpic':
        return new CpicQuoteScraper(company, tid);
      case 'chinalife':
        return new ChinalifeQuoteScraper(company, tid);
      case 'taikang':
        return new TaikangQuoteScraper(company, tid);
      case 'newchina':
        return new NewchinaQuoteScraper(company, tid);
      case 'sinoyang':
        return new SinoyangQuoteScraper(company, tid);
      case 'chinaaci':
        return new ChinaaciQuoteScraper(company, tid);
      default:
        throw new Error(`不支持的保险公司: ${companyId}`);
    }
  }

  static createPolicyScraper(companyId: string, taskId?: string): PolicyScraper {
    const company = getCompanyById(companyId);
    if (!company) {
      throw new Error(`未知的保险公司: ${companyId}`);
    }

    const tid = taskId || generateId();

    switch (companyId) {
      case 'picc':
        return new PiccPolicyScraper(company, tid);
      case 'pingan':
        return new PinganPolicyScraper(company, tid);
      case 'cpic':
        return new CpicPolicyScraper(company, tid);
      case 'chinalife':
        return new ChinalifePolicyScraper(company, tid);
      case 'taikang':
        return new TaikangPolicyScraper(company, tid);
      case 'newchina':
        return new NewchinaPolicyScraper(company, tid);
      case 'sinoyang':
        return new SinoyangPolicyScraper(company, tid);
      case 'chinaaci':
        return new ChinaaciPolicyScraper(company, tid);
      default:
        throw new Error(`不支持的保险公司: ${companyId}`);
    }
  }

  static createAllQuoteScrapers(taskId?: string): QuoteScraper[] {
    const companyIds = ['picc', 'pingan', 'cpic', 'chinalife', 'taikang', 'newchina', 'sinoyang', 'chinaaci'];
    return companyIds
      .map(id => {
        try {
          return this.createQuoteScraper(id, taskId);
        } catch (error) {
          logger.error(`创建报价抓取器失败: ${id}`, { error: (error as Error).message });
          return null;
        }
      })
      .filter((s): s is QuoteScraper => s !== null);
  }

  static createAllPolicyScrapers(taskId?: string): PolicyScraper[] {
    const companyIds = ['picc', 'pingan', 'cpic', 'chinalife', 'taikang', 'newchina', 'sinoyang', 'chinaaci'];
    return companyIds
      .map(id => {
        try {
          return this.createPolicyScraper(id, taskId);
        } catch {
          return null;
        }
      })
      .filter((s): s is PolicyScraper => s !== null);
  }
}

export default ScraperFactory;
