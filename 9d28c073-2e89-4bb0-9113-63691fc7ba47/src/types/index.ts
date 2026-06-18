export interface SiteConfig {
  id: string;
  name: string;
  province: string;
  category: 'social_security' | 'housing_fund' | 'medical_insurance' | 'labor';
  baseUrl: string;
  listUrl: string;
  selectors: {
    listItem: string;
    title: string;
    link: string;
    publishDate: string;
    detailContent: string;
    docNumber?: string;
    issueOrg?: string;
    effectiveDate?: string;
  };
  crawlStrategy: {
    requestIntervalMin: number;
    requestIntervalMax: number;
    maxRetries: number;
    timeout: number;
    needLogin: boolean;
    hasCaptcha: boolean;
    dynamicLoading: boolean;
  };
  enabled: boolean;
  priority: number;
}

export interface PolicySnapshot {
  id?: number;
  siteId: string;
  url: string;
  title: string;
  publishDate: string;
  contentHash: string;
  contentText: string;
  contentHtml: string;
  fetchedAt: string;
  snapshotVersion: number;
}

export interface PolicyDetail {
  id?: number;
  policyId?: number;
  siteId: string;
  url: string;
  title: string;
  docNumber?: string;
  issueOrg?: string;
  publishDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  keyClauses: string[];
  tables: PolicyTable[];
  contentHash: string;
  rawHtml: string;
  extractedAt: string;
}

export interface PolicyTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface ChangeRecord {
  id?: number;
  siteId: string;
  policyUrl: string;
  policyTitle: string;
  changeType: 'add' | 'modify' | 'abolish';
  similarity?: number;
  diffSummary: string;
  previousSnapshotId?: number;
  currentSnapshotId?: number;
  changeLevel: 'high' | 'medium' | 'low';
  affectedCustomers?: string[];
  detectedAt: string;
  notified: boolean;
}

export interface CrawlResult {
  siteId: string;
  success: boolean;
  status: 'ok' | 'captcha' | 'failed' | 'pending';
  message?: string;
  snapshot?: PolicySnapshot;
  policyList?: PolicyListItem[];
  error?: string;
  screenshotPath?: string;
  duration: number;
}

export interface PolicyListItem {
  title: string;
  url: string;
  publishDate: string;
}

export type SiteStatus = 'idle' | 'running' | 'success' | 'captcha' | 'failed' | 'pending';

export interface SiteRuntimeInfo {
  siteId: string;
  status: SiteStatus;
  lastCrawlTime?: string;
  lastSuccessTime?: string;
  consecutiveFailures: number;
  currentProgress?: number;
}

export interface NotificationConfig {
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
    recipients: string[];
  };
  wecom: {
    enabled: boolean;
    webhookUrl: string;
    mentionedList?: string[];
  };
}
