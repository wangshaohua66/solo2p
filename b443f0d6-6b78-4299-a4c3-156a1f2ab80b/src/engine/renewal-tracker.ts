import { EventEmitter } from 'events';
import * as dotenv from 'dotenv';
import {
  PolicyInfo,
  RenewalRecord,
  RenewalStatus,
  CustomerInfo,
} from '../utils/types';
import { daysBetween, calculatePercentageChange, formatDate } from '../utils/helpers';
import logger from '../utils/logger';
import ScraperFactory from '../scrapers/scraper-factory';
import { PolicyScraper } from '../scrapers/base-scraper';

dotenv.config();

export interface RenewalCheckOptions {
  daysWarning1?: number;
  daysWarning2?: number;
  daysWarning3?: number;
  rateIncreaseThreshold?: number;
}

export class RenewalTracker extends EventEmitter {
  private static instance: RenewalTracker;
  private renewalRecords: Map<string, RenewalRecord[]> = new Map();
  private daysWarning1: number;
  private daysWarning2: number;
  private daysWarning3: number;
  private rateIncreaseThreshold: number;

  private constructor(options?: RenewalCheckOptions) {
    super();
    this.daysWarning1 = options?.daysWarning1 ?? parseInt(process.env.RENEWAL_DAYS_WARNING_1 || '30', 10);
    this.daysWarning2 = options?.daysWarning2 ?? parseInt(process.env.RENEWAL_DAYS_WARNING_2 || '15', 10);
    this.daysWarning3 = options?.daysWarning3 ?? parseInt(process.env.RENEWAL_DAYS_WARNING_3 || '7', 10);
    this.rateIncreaseThreshold = options?.rateIncreaseThreshold ?? parseFloat(process.env.RATE_INCREASE_THRESHOLD || '10');
  }

  public static getInstance(options?: RenewalCheckOptions): RenewalTracker {
    if (!RenewalTracker.instance) {
      RenewalTracker.instance = new RenewalTracker(options);
    }
    return RenewalTracker.instance;
  }

  public async checkAllRenewals(
    customers: CustomerInfo[],
    policies: Map<string, PolicyInfo[]>
  ): Promise<RenewalRecord[]> {
    logger.info('开始检查所有客户续保情况');
    const allRecords: RenewalRecord[] = [];

    for (const customer of customers) {
      const customerPolicies = policies.get(customer.id) || [];
      const records = await this.checkCustomerRenewals(customer, customerPolicies);
      this.renewalRecords.set(customer.id, records);
      allRecords.push(...records);
    }

    const urgentCount = allRecords.filter(r => r.status === 'urgent').length;
    const warningCount = allRecords.filter(r => r.status === 'warning').length;
    const abnormalCount = allRecords.filter(r => r.status === 'abnormal').length;

    logger.info(`续保检查完成: 紧急${urgentCount}条, 预警${warningCount}条, 异常${abnormalCount}条`);

    this.emit('renewal-check-complete', {
      total: allRecords.length,
      urgent: urgentCount,
      warning: warningCount,
      abnormal: abnormalCount,
    });

    return allRecords;
  }

  public async checkCustomerRenewals(
    customer: CustomerInfo,
    policies: PolicyInfo[]
  ): Promise<RenewalRecord[]> {
    logger.debug(`检查客户 ${customer.name} 的续保情况，共 ${policies.length} 份保单`);
    const records: RenewalRecord[] = [];

    for (const policy of policies) {
      const record = await this.checkSingleRenewal(customer, policy);
      records.push(record);

      if (record.status === 'urgent' || record.status === 'abnormal') {
        this.emit('renewal-alert', record);
      }
    }

    return records;
  }

  public async checkSingleRenewal(
    customer: CustomerInfo,
    policy: PolicyInfo
  ): Promise<RenewalRecord> {
    const today = new Date();
    const daysToExpire = daysBetween(today, policy.endDate);

    let status: RenewalStatus = 'normal';
    if (daysToExpire < 0) {
      status = 'expired';
    } else if (daysToExpire <= this.daysWarning3) {
      status = 'urgent';
    } else if (daysToExpire <= this.daysWarning2) {
      status = 'warning';
    } else if (daysToExpire <= this.daysWarning1) {
      status = 'warning';
    }

    let renewalPremium: number | null = null;
    let rateChange = 0;
    let notes = '';

    if (status !== 'expired' && daysToExpire <= this.daysWarning1) {
      try {
        renewalPremium = await this.fetchRenewalPremium(policy);
        
        if (renewalPremium !== null && policy.premium > 0) {
          rateChange = calculatePercentageChange(policy.premium, renewalPremium);
          
          if (rateChange > this.rateIncreaseThreshold) {
            status = 'abnormal';
            notes = `费率上涨 ${rateChange.toFixed(2)}%，超过阈值 ${this.rateIncreaseThreshold}%`;
            logger.warn(`保单 ${policy.policyNumber} 费率异常上涨: ${rateChange.toFixed(2)}%`);
          }
        }
      } catch (error) {
        logger.error(`获取续保保费失败: ${policy.policyNumber}`, { error: (error as Error).message });
        notes = '获取续保保费失败，需要人工确认';
      }
    }

    const record: RenewalRecord = {
      customerId: customer.id,
      customerName: customer.name,
      policyNumber: policy.policyNumber,
      companyId: policy.companyId,
      companyName: policy.companyName,
      currentPremium: policy.premium,
      renewalPremium: renewalPremium || 0,
      rateChange,
      expireDate: policy.endDate,
      daysToExpire,
      status,
      notes,
    };

    return record;
  }

  private async fetchRenewalPremium(policy: PolicyInfo): Promise<number | null> {
    logger.debug(`获取续保保费: ${policy.policyNumber}`);

    try {
      const scraper = ScraperFactory.createPolicyScraper(policy.companyId);
      await scraper.initialize();
      
      const premium = await scraper.getRenewalPremium(policy.policyNumber);
      
      await scraper.cleanup();
      
      return premium;
    } catch (error) {
      logger.error(`获取续保保费异常: ${policy.policyNumber}`, { error: (error as Error).message });
      return null;
    }
  }

  public getRenewalRecords(customerId?: string): RenewalRecord[] {
    if (customerId) {
      return this.renewalRecords.get(customerId) || [];
    }
    
    const allRecords: RenewalRecord[] = [];
    for (const records of this.renewalRecords.values()) {
      allRecords.push(...records);
    }
    return allRecords;
  }

  public getRecordsByStatus(status: RenewalStatus): RenewalRecord[] {
    const allRecords = this.getRenewalRecords();
    return allRecords.filter(r => r.status === status);
  }

  public getUrgentRecords(): RenewalRecord[] {
    return this.getRecordsByStatus('urgent');
  }

  public getWarningRecords(): RenewalRecord[] {
    return this.getRecordsByStatus('warning');
  }

  public getAbnormalRecords(): RenewalRecord[] {
    return this.getRecordsByStatus('abnormal');
  }

  public getExpiredRecords(): RenewalRecord[] {
    return this.getRecordsByStatus('expired');
  }

  public getStatistics(): {
    total: number;
    normal: number;
    warning: number;
    urgent: number;
    expired: number;
    abnormal: number;
  } {
    const records = this.getRenewalRecords();
    
    return {
      total: records.length,
      normal: records.filter(r => r.status === 'normal').length,
      warning: records.filter(r => r.status === 'warning').length,
      urgent: records.filter(r => r.status === 'urgent').length,
      expired: records.filter(r => r.status === 'expired').length,
      abnormal: records.filter(r => r.status === 'abnormal').length,
    };
  }

  public sortByUrgency(records: RenewalRecord[]): RenewalRecord[] {
    const statusOrder: Record<RenewalStatus, number> = {
      'expired': 0,
      'urgent': 1,
      'abnormal': 2,
      'warning': 3,
      'normal': 4,
    };

    return [...records].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.daysToExpire - b.daysToExpire;
    });
  }

  public setWarningDays(days1: number, days2: number, days3: number): void {
    this.daysWarning1 = days1;
    this.daysWarning2 = days2;
    this.daysWarning3 = days3;
    logger.info(`续保预警天数已更新: ${days1}/${days2}/${days3}`);
  }

  public setRateIncreaseThreshold(threshold: number): void {
    this.rateIncreaseThreshold = threshold;
    logger.info(`费率上涨阈值已更新: ${threshold}%`);
  }

  public clearRecords(): void {
    this.renewalRecords.clear();
    logger.info('已清除所有续保记录');
  }
}

export default RenewalTracker;
