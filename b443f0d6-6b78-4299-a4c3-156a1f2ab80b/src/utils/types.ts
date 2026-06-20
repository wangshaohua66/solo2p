export interface InsuranceCompany {
  id: string;
  name: string;
  shortName: string;
  loginUrl: string;
  username: string;
  password: string;
  selectors: Selectors;
  features: CompanyFeatures;
}

export interface Selectors {
  usernameInput: string;
  passwordInput: string;
  captchaInput?: string;
  captchaImage?: string;
  loginButton: string;
  logoutButton?: string;
  sessionExpiredPatterns: string[];
  quoteForm: QuoteFormSelectors;
  quoteResult: QuoteResultSelectors;
  policyList: PolicyListSelectors;
  policyDetail: PolicyDetailSelectors;
}

export interface QuoteFormSelectors {
  industrySelect: string;
  employeeCountInput: string;
  riskLevelSelect: string;
  coverageAmountInput: string;
  deductibleInput: string;
  productTypeSelect: string;
  submitButton: string;
}

export interface QuoteResultSelectors {
  premiumAmount: string;
  coverageDetails: string;
  deductibleInfo: string;
  specialClauses: string;
  loadingSpinner: string;
  resultContainer: string;
}

export interface PolicyListSelectors {
  listContainer: string;
  policyItem: string;
  policyNumber: string;
  policyStatus: string;
  expireDate: string;
  nextPageButton?: string;
}

export interface PolicyDetailSelectors {
  policyNumber: string;
  insuredCompany: string;
  coverageAmount: string;
  premium: string;
  startDate: string;
  endDate: string;
  coverageType: string;
}

export interface CompanyFeatures {
  supportsCaptcha: boolean;
  captchaType: 'none' | 'image' | 'slider';
  supportsAjax: boolean;
  ajaxWaitTime: number;
  sessionTimeout: number;
}

export interface QuoteRequest {
  companyId: string;
  productType: ProductType;
  industry: string;
  employeeCount: number;
  riskLevel: RiskLevel;
  coverageAmount: number;
  deductible: number;
}

export interface QuoteResult {
  companyId: string;
  companyName: string;
  productType: ProductType;
  premium: number;
  coverageAmount: number;
  deductible: number;
  coverageDetails: string;
  specialClauses: string[];
  scrapedAt: Date;
  success: boolean;
  errorMessage?: string;
}

export interface PolicyInfo {
  companyId: string;
  companyName: string;
  policyNumber: string;
  insuredCompany: string;
  productType: ProductType;
  coverageAmount: number;
  premium: number;
  startDate: Date;
  endDate: Date;
  status: PolicyStatus;
}

export interface CustomerInfo {
  id: string;
  name: string;
  industry: string;
  employeeCount: number;
  riskLevel: RiskLevel;
  contactPerson: string;
  contactPhone: string;
}

export interface RenewalRecord {
  customerId: string;
  customerName: string;
  policyNumber: string;
  companyId: string;
  companyName: string;
  currentPremium: number;
  renewalPremium: number;
  rateChange: number;
  expireDate: Date;
  daysToExpire: number;
  status: RenewalStatus;
  notes?: string;
}

export interface CompareResult {
  customerId: string;
  customerName: string;
  request: QuoteRequest;
  quotes: QuoteResult[];
  topRecommendations: Recommendation[];
  generatedAt: Date;
}

export interface Recommendation {
  rank: number;
  quote: QuoteResult;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  premium: number;
  coverage: number;
  deductible: number;
  clauses: number;
}

export type ProductType = 'employer-liability' | 'group-accident' | 'group-medical' | 'group-critical-illness';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high';
export type PolicyStatus = 'active' | 'expired' | 'pending' | 'cancelled';
export type RenewalStatus = 'normal' | 'warning' | 'urgent' | 'expired' | 'abnormal';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface ScrapingTask {
  id: string;
  type: 'quote' | 'renewal' | 'policy';
  companyId: string;
  customerId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  checkpoint?: any;
}

export interface ScraperProgress {
  companyId: string;
  stage: string;
  progress: number;
  message: string;
}
