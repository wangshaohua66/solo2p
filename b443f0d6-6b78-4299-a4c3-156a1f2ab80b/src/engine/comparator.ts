import {
  QuoteResult,
  CompareResult,
  MultiProductCompareResult,
  Recommendation,
  ScoreBreakdown,
  QuoteRequest,
  RiskLevel,
  ProductType,
  CustomerInfo,
} from '../utils/types';
import { SCORING_WEIGHTS, RISK_PREMIUM_ADJUSTMENT } from '../config/profiles';
import logger from '../utils/logger';

export class QuoteComparator {
  private riskLevel: RiskLevel;

  constructor(riskLevel: RiskLevel = 'medium') {
    this.riskLevel = riskLevel;
  }

  public compare(
    quotes: QuoteResult[],
    request: QuoteRequest,
    customer?: CustomerInfo
  ): CompareResult {
    logger.info(`开始比价，共 ${quotes.length} 家保险公司报价`);

    const validQuotes = quotes.filter(q => q.success && q.premium > 0);
    const failedQuotes = quotes.filter(q => !q.success);

    if (failedQuotes.length > 0) {
      logger.warn(`${failedQuotes.length} 家保险公司报价抓取失败`);
      failedQuotes.forEach(q => {
        logger.warn(`  - ${q.companyName}: ${q.errorMessage}`);
      });
    }

    if (validQuotes.length === 0) {
      logger.error('没有有效的报价数据');
      return {
        customerId: customer?.id || '',
        customerName: customer?.name || '',
        request,
        quotes,
        allRecommendations: [],
        topRecommendations: [],
        generatedAt: new Date(),
      };
    }

    const sortedByPremium = [...validQuotes].sort((a, b) => a.premium - b.premium);
    const minPremium = sortedByPremium[0].premium;
    const maxPremium = sortedByPremium[sortedByPremium.length - 1].premium;

    const recommendations: Recommendation[] = validQuotes.map(quote => {
      const scoreBreakdown = this.calculateScore(quote, minPremium, maxPremium);
      const totalScore =
        scoreBreakdown.premium * SCORING_WEIGHTS.premium +
        scoreBreakdown.coverage * SCORING_WEIGHTS.coverage +
        scoreBreakdown.deductible * SCORING_WEIGHTS.deductible +
        scoreBreakdown.clauses * SCORING_WEIGHTS.clauses;

      return {
        rank: 0,
        quote,
        totalScore: parseFloat(totalScore.toFixed(2)),
        scoreBreakdown,
      };
    });

    recommendations.sort((a, b) => b.totalScore - a.totalScore);
    recommendations.forEach((rec, index) => {
      rec.rank = index + 1;
    });

    const top3 = recommendations.slice(0, 3);

    const result: CompareResult = {
      customerId: customer?.id || '',
      customerName: customer?.name || '',
      request,
      quotes,
      allRecommendations: recommendations,
      topRecommendations: top3,
      generatedAt: new Date(),
    };

    logger.info(`比价完成，TOP1: ${top3[0]?.quote.companyName} (${top3[0]?.totalScore}分)`);
    return result;
  }

  private calculateScore(
    quote: QuoteResult,
    minPremium: number,
    maxPremium: number
  ): ScoreBreakdown {
    const premiumScore = this.calculatePremiumScore(quote.premium, minPremium, maxPremium);
    const coverageScore = this.calculateCoverageScore(quote);
    const deductibleScore = this.calculateDeductibleScore(quote);
    const clausesScore = this.calculateClausesScore(quote);

    return {
      premium: premiumScore,
      coverage: coverageScore,
      deductible: deductibleScore,
      clauses: clausesScore,
    };
  }

  private calculatePremiumScore(
    premium: number,
    minPremium: number,
    maxPremium: number
  ): number {
    if (maxPremium === minPremium) return 100;

    const riskAdjustment = RISK_PREMIUM_ADJUSTMENT[this.riskLevel] || 1.0;
    const adjustedPremium = premium / riskAdjustment;
    const adjustedMin = minPremium / riskAdjustment;
    const adjustedMax = maxPremium / riskAdjustment;

    const score = 100 - ((adjustedPremium - adjustedMin) / (adjustedMax - adjustedMin)) * 100;
    return Math.max(0, Math.min(100, parseFloat(score.toFixed(2))));
  }

  private calculateCoverageScore(quote: QuoteResult): number {
    let score = 60;

    if (quote.coverageAmount > 0) {
      const coverageScore = Math.min((quote.coverageAmount / 1000000) * 20, 20);
      score += coverageScore;
    }

    if (quote.coverageDetails) {
      const details = quote.coverageDetails;
      const keywords = ['身故', '伤残', '医疗', '住院', '门诊', '重疾', '意外'];
      let keywordCount = 0;
      keywords.forEach(kw => {
        if (details.includes(kw)) keywordCount++;
      });
      score += Math.min(keywordCount * 3, 20);
    }

    return Math.min(100, score);
  }

  private calculateDeductibleScore(quote: QuoteResult): number {
    if (quote.deductible === 0) return 100;

    const deductibleRatios = [
      { threshold: 0, score: 100 },
      { threshold: 100, score: 90 },
      { threshold: 500, score: 80 },
      { threshold: 1000, score: 70 },
      { threshold: 5000, score: 60 },
      { threshold: 10000, score: 50 },
    ];

    for (let i = deductibleRatios.length - 1; i >= 0; i--) {
      if (quote.deductible >= deductibleRatios[i].threshold) {
        return deductibleRatios[i].score;
      }
    }

    return 40;
  }

  private calculateClausesScore(quote: QuoteResult): number {
    if (!quote.specialClauses || quote.specialClauses.length === 0) {
      return 50;
    }

    const positiveKeywords = ['扩展', '增加', '优惠', '赠送', '免费', '不限'];
    const negativeKeywords = ['除外', '限制', '不承担', '免赔额提高', '等待期'];

    let score = 50;
    quote.specialClauses.forEach(clause => {
      positiveKeywords.forEach(kw => {
        if (clause.includes(kw)) score += 5;
      });
      negativeKeywords.forEach(kw => {
        if (clause.includes(kw)) score -= 3;
      });
    });

    return Math.max(0, Math.min(100, score));
  }

  public getPremiumRange(quotes: QuoteResult[]): { min: number; max: number; avg: number } {
    const validQuotes = quotes.filter(q => q.success && q.premium > 0);
    if (validQuotes.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const premiums = validQuotes.map(q => q.premium);
    const min = Math.min(...premiums);
    const max = Math.max(...premiums);
    const avg = premiums.reduce((a, b) => a + b, 0) / premiums.length;

    return { min, max, avg: parseFloat(avg.toFixed(2)) };
  }

  public getCheapestQuote(quotes: QuoteResult[]): QuoteResult | null {
    const validQuotes = quotes.filter(q => q.success && q.premium > 0);
    if (validQuotes.length === 0) return null;
    return validQuotes.sort((a, b) => a.premium - b.premium)[0];
  }

  public getBestValueQuote(quotes: QuoteResult[]): Recommendation | null {
    const result = this.compare(quotes, {
      companyId: '',
      productType: 'employer-liability',
      industry: '',
      employeeCount: 0,
      riskLevel: 'medium',
      coverageAmount: 0,
      deductible: 0,
    });

    return result.topRecommendations[0] || null;
  }

  public setRiskLevel(riskLevel: RiskLevel): void {
    this.riskLevel = riskLevel;
  }

  public compareMultipleProducts(
    quotesByProduct: Record<ProductType, QuoteResult[]>,
    requestsByProduct: Record<ProductType, QuoteRequest>,
    customer?: CustomerInfo
  ): MultiProductCompareResult {
    const productTypes = Object.keys(quotesByProduct) as ProductType[];
    logger.info(`开始多产品比价，共 ${productTypes.length} 类产品`);

    const results: Record<ProductType, CompareResult> = {} as Record<ProductType, CompareResult>;

    for (const productType of productTypes) {
      const quotes = quotesByProduct[productType] || [];
      const request = requestsByProduct[productType];
      if (request) {
        const comparator = new QuoteComparator(request.riskLevel);
        results[productType] = comparator.compare(quotes, request, customer);
      }
    }

    const perCompany: Record<string, number> = {};
    const allCompanies = new Set<string>();

    for (const productType of productTypes) {
      const compareResult = results[productType];
      if (compareResult) {
        compareResult.quotes.forEach(quote => {
          if (quote.success) {
            allCompanies.add(quote.companyId);
            if (!perCompany[quote.companyId]) {
              perCompany[quote.companyId] = 0;
            }
            perCompany[quote.companyId] += quote.premium;
          }
        });
      }
    }

    let cheapestCompany = '';
    let cheapestTotal = Infinity;

    for (const [companyId, total] of Object.entries(perCompany)) {
      if (total < cheapestTotal) {
        cheapestTotal = total;
        cheapestCompany = companyId;
      }
    }

    const result: MultiProductCompareResult = {
      customerId: customer?.id || '',
      customerName: customer?.name || '',
      productTypes,
      results,
      totalPremium: {
        perCompany,
        cheapestCompany,
        cheapestTotal: cheapestTotal === Infinity ? 0 : cheapestTotal,
      },
      generatedAt: new Date(),
    };

    logger.info(`多产品比价完成，最优总保费: ${cheapestCompany} ¥${cheapestTotal.toFixed(2)}`);
    return result;
  }
}

export default QuoteComparator;
