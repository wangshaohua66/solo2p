import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import {
  CompareResult,
  MultiProductCompareResult,
  QuoteResult,
  RenewalRecord,
  CustomerInfo,
  PolicyInfo,
  Recommendation,
  ProductType,
} from '../utils/types';
import { formatDate, sanitizeFileName } from '../utils/helpers';
import logger from '../utils/logger';
import { PRODUCT_TYPES, RISK_LEVELS } from '../config/profiles';

dotenv.config();

export class ExcelWriter {
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.OUTPUT_DIR || './output';
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public generateQuoteReport(
    compareResult: CompareResult,
    customer?: CustomerInfo
  ): string {
    logger.info('生成报价比较报告...');

    const workbook = XLSX.utils.book_new();

    this.addSummarySheet(workbook, compareResult, customer);
    this.addDetailSheet(workbook, compareResult);
    this.addRecommendationSheet(workbook, compareResult);
    this.addComparisonSheet(workbook, compareResult);

    const fileName = `报价比较_${customer?.name || '通用'}_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(this.outputDir, sanitizeFileName(fileName));

    XLSX.writeFile(workbook, filePath);

    logger.info(`报价报告已生成: ${filePath}`);
    return filePath;
  }

  private addSummarySheet(
    workbook: XLSX.WorkBook,
    result: CompareResult,
    customer?: CustomerInfo
  ): void {
    const data: any[][] = [
      ['保险报价比较报告'],
      [],
      ['生成时间', formatDate(result.generatedAt, 'YYYY-MM-DD HH:mm:ss')],
      ['客户名称', customer?.name || '-'],
      ['客户行业', customer?.industry || '-'],
      ['员工人数', customer?.employeeCount || '-'],
      ['风险等级', RISK_LEVELS[result.request.riskLevel] || result.request.riskLevel],
      ['产品类型', PRODUCT_TYPES[result.request.productType] || result.request.productType],
      [],
      ['报价统计'],
      ['参与报价公司数', result.quotes.length],
      ['成功报价数', result.quotes.filter(q => q.success).length],
      ['失败报价数', result.quotes.filter(q => !q.success).length],
      [],
    ];

    const validQuotes = result.quotes.filter(q => q.success && q.premium > 0);
    if (validQuotes.length > 0) {
      const premiums = validQuotes.map(q => q.premium);
      const minPremium = Math.min(...premiums);
      const maxPremium = Math.max(...premiums);
      const avgPremium = premiums.reduce((a, b) => a + b, 0) / premiums.length;

      data.push(
        ['保费分析'],
        ['最低保费', `¥${minPremium.toLocaleString()}`],
        ['最高保费', `¥${maxPremium.toLocaleString()}`],
        ['平均保费', `¥${avgPremium.toFixed(2).toLocaleString()}`],
        ['保费差距', `¥${(maxPremium - minPremium).toLocaleString()}`]
      );
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, '报告摘要');
  }

  private addDetailSheet(
    workbook: XLSX.WorkBook,
    result: CompareResult
  ): void {
    const headers = [
      '保险公司',
      '产品类型',
      '保费(元)',
      '保额(元)',
      '免赔额(元)',
      '保障详情',
      '特约条款',
      '抓取状态',
      '错误信息',
      '抓取时间',
    ];

    const data = result.quotes.map(q => [
      q.companyName,
      PRODUCT_TYPES[q.productType] || q.productType,
      q.premium,
      q.coverageAmount,
      q.deductible,
      q.coverageDetails,
      q.specialClauses.join('; '),
      q.success ? '成功' : '失败',
      q.errorMessage || '',
      formatDate(q.scrapedAt, 'YYYY-MM-DD HH:mm:ss'),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 40 },
      { wch: 30 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '报价明细');
  }

  private addRecommendationSheet(
    workbook: XLSX.WorkBook,
    result: CompareResult
  ): void {
    const headers = [
      '排名',
      '保险公司',
      '综合得分',
      '保费得分',
      '保障得分',
      '免赔得分',
      '条款得分',
      '保费(元)',
      '保额(元)',
      '免赔额(元)',
    ];

    const data = result.topRecommendations.map(rec => [
      `TOP${rec.rank}`,
      rec.quote.companyName,
      rec.totalScore,
      rec.scoreBreakdown.premium,
      rec.scoreBreakdown.coverage,
      rec.scoreBreakdown.deductible,
      rec.scoreBreakdown.clauses,
      rec.quote.premium,
      rec.quote.coverageAmount,
      rec.quote.deductible,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '推荐方案');
  }

  private addComparisonSheet(
    workbook: XLSX.WorkBook,
    result: CompareResult
  ): void {
    const validQuotes = result.quotes.filter(q => q.success);
    
    const headers = ['对比维度', ...validQuotes.map(q => q.companyName)];
    
    const rows = [
      ['保费(元)', ...validQuotes.map(q => q.premium)],
      ['保额(元)', ...validQuotes.map(q => q.coverageAmount)],
      ['免赔额(元)', ...validQuotes.map(q => q.deductible)],
      ['保障详情', ...validQuotes.map(q => q.coverageDetails)],
      ['特约条款数', ...validQuotes.map(q => q.specialClauses.length)],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 15 },
      ...validQuotes.map(() => ({ wch: 20 })),
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '横向对比');
  }

  public generateRenewalReport(
    records: RenewalRecord[],
    customers: CustomerInfo[]
  ): string {
    logger.info(`生成续保监控报告，共 ${records.length} 条记录`);

    const workbook = XLSX.utils.book_new();

    this.addRenewalSummarySheet(workbook, records);
    this.addRenewalDetailSheet(workbook, records);
    this.addUrgentRenewalsSheet(workbook, records);
    this.addAbnormalRatesSheet(workbook, records);

    const fileName = `续保监控_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(this.outputDir, sanitizeFileName(fileName));

    XLSX.writeFile(workbook, filePath);

    logger.info(`续保报告已生成: ${filePath}`);
    return filePath;
  }

  private addRenewalSummarySheet(
    workbook: XLSX.WorkBook,
    records: RenewalRecord[]
  ): void {
    const urgent = records.filter(r => r.status === 'urgent').length;
    const warning = records.filter(r => r.status === 'warning').length;
    const normal = records.filter(r => r.status === 'normal').length;
    const expired = records.filter(r => r.status === 'expired').length;
    const abnormal = records.filter(r => r.status === 'abnormal').length;

    const data = [
      ['续保监控报告'],
      [],
      ['生成时间', formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')],
      ['监控保单总数', records.length],
      [],
      ['状态统计'],
      ['正常续保', normal],
      ['预警提醒', warning],
      ['紧急续保', urgent],
      ['费率异常', abnormal],
      ['已过期', expired],
      [],
      ['注意事项'],
      ['- 紧急续保单，请立即联系客户确认续保意向'],
      ['- 费率异常单，需与保险公司确认涨幅原因'],
      ['- 已过期保单，需评估重新投保方案'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, '监控摘要');
  }

  private addRenewalDetailSheet(
    workbook: XLSX.WorkBook,
    records: RenewalRecord[]
  ): void {
    const headers = [
      '客户名称',
      '保险公司',
      '保单号',
      '当前保费(元)',
      '续保保费(元)',
      '费率变动(%)',
      '到期日期',
      '剩余天数',
      '状态',
      '备注',
    ];

    const statusMap: Record<string, string> = {
      'normal': '正常',
      'warning': '预警',
      'urgent': '紧急',
      'expired': '已过期',
      'abnormal': '异常',
    };

    const sortedRecords = [...records].sort((a, b) => a.daysToExpire - b.daysToExpire);

    const data = sortedRecords.map(r => [
      r.customerName,
      r.companyName,
      r.policyNumber,
      r.currentPremium,
      r.renewalPremium || '-',
      r.rateChange !== 0 ? `${r.rateChange > 0 ? '+' : ''}${r.rateChange}%` : '-',
      formatDate(r.expireDate, 'YYYY-MM-DD'),
      r.daysToExpire,
      statusMap[r.status] || r.status,
      r.notes || '',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '续保明细');
  }

  private addUrgentRenewalsSheet(
    workbook: XLSX.WorkBook,
    records: RenewalRecord[]
  ): void {
    const urgentRecords = records.filter(r => r.status === 'urgent' || r.status === 'expired');

    const headers = [
      '客户名称',
      '保险公司',
      '保单号',
      '到期日期',
      '剩余天数',
      '当前保费(元)',
      '状态',
      '紧急程度',
    ];

    const data = urgentRecords.map(r => [
      r.customerName,
      r.companyName,
      r.policyNumber,
      formatDate(r.expireDate, 'YYYY-MM-DD'),
      r.daysToExpire,
      r.currentPremium,
      r.status === 'expired' ? '已过期' : '紧急续保',
      r.status === 'expired' ? '最高' : '高',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '紧急续保');
  }

  private addAbnormalRatesSheet(
    workbook: XLSX.WorkBook,
    records: RenewalRecord[]
  ): void {
    const abnormalRecords = records.filter(r => r.status === 'abnormal');

    const headers = [
      '客户名称',
      '保险公司',
      '保单号',
      '当前保费(元)',
      '续保保费(元)',
      '费率涨幅(%)',
      '到期日期',
      '异常说明',
    ];

    const data = abnormalRecords.map(r => [
      r.customerName,
      r.companyName,
      r.policyNumber,
      r.currentPremium,
      r.renewalPremium,
      `+${r.rateChange}%`,
      formatDate(r.expireDate, 'YYYY-MM-DD'),
      r.notes || '费率上涨超过阈值',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '费率异常');
  }

  public generatePolicyReport(
    policies: PolicyInfo[],
    customer?: CustomerInfo
  ): string {
    logger.info(`生成保单清单报告，共 ${policies.length} 份保单`);

    const workbook = XLSX.utils.book_new();

    const headers = [
      '保险公司',
      '保单号',
      '投保公司',
      '产品类型',
      '保额(元)',
      '保费(元)',
      '生效日期',
      '到期日期',
      '状态',
    ];

    const statusMap: Record<string, string> = {
      'active': '有效',
      'expired': '已过期',
      'pending': '待生效',
      'cancelled': '已取消',
    };

    const data = policies.map(p => [
      p.companyName,
      p.policyNumber,
      p.insuredCompany,
      PRODUCT_TYPES[p.productType] || p.productType,
      p.coverageAmount,
      p.premium,
      formatDate(p.startDate, 'YYYY-MM-DD'),
      formatDate(p.endDate, 'YYYY-MM-DD'),
      statusMap[p.status] || p.status,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '保单清单');

    const fileName = `保单清单_${customer?.name || '全部'}_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(this.outputDir, sanitizeFileName(fileName));

    XLSX.writeFile(workbook, filePath);

    logger.info(`保单报告已生成: ${filePath}`);
    return filePath;
  }

  public generateMultiProductQuoteReport(
    result: MultiProductCompareResult,
    customer?: CustomerInfo
  ): string {
    logger.info(`生成多产品报价报告，共 ${result.productTypes.length} 类产品`);

    const workbook = XLSX.utils.book_new();

    this.addMultiProductSummarySheet(workbook, result, customer);

    for (const productType of result.productTypes) {
      const compareResult = result.results[productType];
      if (compareResult) {
        const productName = PRODUCT_TYPES[productType] || productType;
        this.addProductDetailSheet(workbook, compareResult, productName);
      }
    }

    const fileName = `多产品报价_${customer?.name || '客户'}_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(this.outputDir, sanitizeFileName(fileName));

    XLSX.writeFile(workbook, filePath);

    logger.info(`多产品报价报告已生成: ${filePath}`);
    return filePath;
  }

  private addProductDetailSheet(
    workbook: XLSX.WorkBook,
    result: CompareResult,
    sheetName: string
  ): void {
    const validQuotes = result.quotes.filter(q => q.success && q.premium > 0);
    const sortedByPremium = [...validQuotes].sort((a, b) => a.premium - b.premium);

    const headers = [
      '排名',
      '保险公司',
      '保费(元)',
      '保额(元)',
      '免赔额(元)',
      '保障详情',
      '综合得分',
    ];

    const scoreMap = new Map<string, number>();
    result.allRecommendations.forEach(rec => {
      scoreMap.set(rec.quote.companyId, rec.totalScore);
    });

    const data = sortedByPremium.map((quote, index) => [
      index + 1,
      quote.companyName,
      quote.premium,
      quote.coverageAmount,
      quote.deductible,
      quote.coverageDetails,
      scoreMap.get(quote.companyId)?.toFixed(1) || '-',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  }

  private addMultiProductSummarySheet(
    workbook: XLSX.WorkBook,
    result: MultiProductCompareResult,
    customer?: CustomerInfo
  ): void {
    const summaryData: any[][] = [];

    summaryData.push(['多产品比价汇总报告']);
    summaryData.push([]);
    summaryData.push(['客户名称', customer?.name || '-']);
    summaryData.push(['产品数量', result.productTypes.length]);
    summaryData.push(['生成时间', formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')]);
    summaryData.push([]);

    const headers = ['保险公司', ...result.productTypes.map(pt => PRODUCT_TYPES[pt] || pt), '总保费', '排名'];
    summaryData.push(headers);

    const sortedByTotal = Object.entries(result.totalPremium.perCompany)
      .sort(([, a], [, b]) => a - b);

    sortedByTotal.forEach(([companyId, total], index) => {
      const row: any[] = [companyId];
      for (const pt of result.productTypes) {
        const quote = result.results[pt]?.quotes.find(q => q.companyId === companyId && q.success);
        row.push(quote ? quote.premium : '-');
      }
      row.push(total);
      row.push(index + 1);
      summaryData.push(row);
    });

    summaryData.push([]);
    summaryData.push(['最优方案', result.totalPremium.cheapestCompany]);
    summaryData.push(['最低总保费', result.totalPremium.cheapestTotal]);

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    worksheet['!cols'] = [{ wch: 20 }, ...result.productTypes.map(() => ({ wch: 15 })), { wch: 15 }, { wch: 8 }];
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: result.productTypes.length + 2 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, '汇总');
  }

  public getOutputDir(): string {
    return this.outputDir;
  }

  public setOutputDir(dir: string): void {
    this.outputDir = dir;
    this.ensureOutputDir();
  }
}

export default ExcelWriter;
