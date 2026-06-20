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
import { CheckpointManager } from '../utils/checkpoint';

export class ScraperFactory {
  static createQuoteScraper(
    companyId: string,
    taskId?: string,
    checkpointManager?: CheckpointManager
  ): QuoteScraper {
    const company = getCompanyById(companyId);
    if (!company) {
      throw new Error(`未知的保险公司: ${companyId}`);
    }

    const tid = taskId || generateId();
    const cm = checkpointManager || CheckpointManager.getInstance();

    switch (companyId) {
      case 'picc':
        return new PiccQuoteScraper(company, tid, cm);
      case 'pingan':
        return new PinganQuoteScraper(company, tid, cm);
      case 'cpic':
        return new CpicQuoteScraper(company, tid, cm);
      case 'chinalife':
        return new ChinalifeQuoteScraper(company, tid, cm);
      case 'taikang':
        return new TaikangQuoteScraper(company, tid, cm);
      case 'newchina':
        return new NewchinaQuoteScraper(company, tid, cm);
      case 'sinoyang':
        return new SinoyangQuoteScraper(company, tid, cm);
      case 'chinaaci':
        return new ChinaaciQuoteScraper(company, tid, cm);
      default:
        throw new Error(`不支持的保险公司: ${companyId}`);
    }
  }

  static createPolicyScraper(
    companyId: string,
    taskId?: string,
    checkpointManager?: CheckpointManager
  ): PolicyScraper {
    const company = getCompanyById(companyId);
    if (!company) {
      throw new Error(`未知的保险公司: ${companyId}`);
    }

    const tid = taskId || generateId();
    const cm = checkpointManager || CheckpointManager.getInstance();

    switch (companyId) {
      case 'picc':
        return new PiccPolicyScraper(company, tid, cm);
      case 'pingan':
        return new PinganPolicyScraper(company, tid, cm);
      case 'cpic':
        return new CpicPolicyScraper(company, tid, cm);
      case 'chinalife':
        return new ChinalifePolicyScraper(company, tid, cm);
      case 'taikang':
        return new TaikangPolicyScraper(company, tid, cm);
      case 'newchina':
        return new NewchinaPolicyScraper(company, tid, cm);
      case 'sinoyang':
        return new SinoyangPolicyScraper(company, tid, cm);
      case 'chinaaci':
        return new ChinaaciPolicyScraper(company, tid, cm);
      default:
        throw new Error(`不支持的保险公司: ${companyId}`);
    }
  }

  static createAllQuoteScrapers(taskId?: string, checkpointManager?: CheckpointManager): QuoteScraper[] {
    const companyIds = ['picc', 'pingan', 'cpic', 'chinalife', 'taikang', 'newchina', 'sinoyang', 'chinaaci'];
    const cm = checkpointManager || CheckpointManager.getInstance();
    return companyIds
      .map(id => {
        try {
          return this.createQuoteScraper(id, taskId, cm);
        } catch (error) {
          logger.error(`创建报价抓取器失败: ${id}`, { error: (error as Error).message });
          return null;
        }
      })
      .filter((s): s is QuoteScraper => s !== null);
  }

  static createAllPolicyScrapers(taskId?: string, checkpointManager?: CheckpointManager): PolicyScraper[] {
    const companyIds = ['picc', 'pingan', 'cpic', 'chinalife', 'taikang', 'newchina', 'sinoyang', 'chinaaci'];
    const cm = checkpointManager || CheckpointManager.getInstance();
    return companyIds
      .map(id => {
        try {
          return this.createPolicyScraper(id, taskId, cm);
        } catch {
          return null;
        }
      })
      .filter((s): s is PolicyScraper => s !== null);
  }
}

export default ScraperFactory;
