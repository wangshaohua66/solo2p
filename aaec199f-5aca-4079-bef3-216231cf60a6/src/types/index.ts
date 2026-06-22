export enum AnnouncementType {
  TENDER_NOTICE = 'tender_notice',
  WINNING_RESULT = 'winning_result',
  CHANGE_NOTICE = 'change_notice',
  QA_CLARIFICATION = 'qa_clarification'
}

export enum ProjectCategory {
  GOVERNMENT_PROCUREMENT = 'government_procurement',
  ENGINEERING_CONSTRUCTION = 'engineering_construction',
  LAND_MINERAL = 'land_mineral',
  PROPERTY_RIGHTS = 'property_rights'
}

export enum ChangeType {
  DEADLINE_EXTENSION = 'deadline_extension',
  BUDGET_ADJUSTMENT = 'budget_adjustment',
  CONTENT_MODIFICATION = 'content_modification',
  CANCELLATION = 'cancellation',
  OTHER = 'other'
}

export interface Announcement {
  id?: number;
  fingerprint: string;
  platformId: string;
  platformName: string;
  announcementType: AnnouncementType;
  projectCategory: ProjectCategory;
  title: string;
  publishTime: string;
  projectName: string;
  projectNumber?: string;
  tenderee?: string;
  tenderDeadline?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachmentUrls?: string[];
  content: string;
  detailUrl: string;
  region?: string;
  changeType?: ChangeType;
  originalAnnouncementId?: number;
  similarityScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnouncementListItem {
  title: string;
  detailUrl: string;
  publishTime: string;
  announcementType: AnnouncementType;
}

export interface PlatformConfig {
  id: string;
  name: string;
  baseUrl: string;
  listUrl: string;
  requiresLogin: boolean;
  loginConfig?: LoginConfig;
  selectors: Selectors;
  pagination: PaginationConfig;
  region: string;
  timeout: {
    listPage: number;
    detailPage: number;
  };
  rateLimit: number;
}

export interface LoginConfig {
  loginUrl: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  captchaSelector?: string;
  submitSelector: string;
  successIndicator: string;
  ocrServiceUrl?: string;
}

export interface Selectors {
  listContainer: string;
  listItems: string;
  itemTitle: string;
  itemLink: string;
  itemTime: string;
  nextPage: string;
  detailContent: string;
  projectName?: string;
  projectNumber?: string;
  tenderee?: string;
  tenderDeadline?: string;
  budgetAmount?: string;
  contactInfo?: string;
  attachments?: string;
}

export interface PaginationConfig {
  type: 'page_number' | 'infinite_scroll' | 'load_more';
  maxPages: number;
  startPage?: number;
  pageParam?: string;
}

export interface CrawlResult {
  platformId: string;
  platformName: string;
  success: boolean;
  listCount: number;
  detailCount: number;
  failedUrls: string[];
  durationMs: number;
  error?: string;
}

export interface CrawlTask {
  platformId: string;
  url: string;
  type: 'list' | 'detail';
  retries: number;
  maxRetries: number;
}

export interface KeywordRule {
  id: string;
  keywords: string[];
  excludedKeywords?: string[];
  minAmount?: number;
  maxAmount?: number;
  regions?: string[];
  categories?: ProjectCategory[];
  notificationChannels: ('email' | 'wework')[];
  emailRecipients?: string[];
  weworkWebhook?: string;
}

export interface HealthStats {
  platformId: string;
  successRate: number;
  avgResponseTimeMs: number;
  consecutiveFailures: number;
  lastCrawlTime?: string;
  status: 'healthy' | 'degraded' | 'paused';
  backoffMultiplier: number;
}

export interface CrawlLogEntry {
  timestamp: string;
  platform: string;
  url: string;
  statusCode: number;
  durationMs: number;
  error?: string;
}
