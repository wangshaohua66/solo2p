export type PlatformType = 'amazon' | 'ebay' | 'shopee' | 'lazada' | 'tiktok';

export type ListingStatus = 'pending' | 'uploading' | 'under_review' | 'active' | 'rejected' | 'failed' | 'manual_review';

export type TaskType = 'upload' | 'sync_status' | 'update_price' | 'update_inventory';

export interface SKUData {
  sku: string;
  title: {
    en: string;
    es?: string;
    pt?: string;
    id?: string;
  };
  description: {
    en: string;
    es?: string;
    pt?: string;
    id?: string;
  };
  images: string[];
  video?: string;
  prices: Record<string, number>;
  inventory: Record<string, number>;
  category?: string;
  brand?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface PlatformAccount {
  id: string;
  platform: PlatformType;
  email: string;
  encryptedPassword: string;
  encryptedTotpSeed?: string;
  sites: string[];
  status: 'active' | 'suspended' | 'maintenance';
  lastLogin?: number;
  cookieExpiry?: number;
}

export interface PlatformCookie {
  accountId: string;
  platform: PlatformType;
  cookies: string;
  createdAt: number;
  expiresAt: number;
}

export interface ListingResult {
  taskId: string;
  sku: string;
  platform: PlatformType;
  accountId: string;
  site: string;
  status: ListingStatus;
  listingId?: string;
  listingUrl?: string;
  errorMessage?: string;
  rejectReason?: string;
  screenshot?: string;
  startedAt: number;
  completedAt?: number;
  retryCount: number;
}

export interface TaskConfig {
  id: string;
  type: TaskType;
  platforms: PlatformType[];
  skuFile: string;
  batchSize: number;
  concurrencyPerPlatform: number;
  resumeFrom?: string;
  scheduledAt?: number;
}

export interface SKUMapping {
  sku: string;
  platform: PlatformType;
  site: string;
  listingId: string | null;
  listingUrl: string | null;
  status: ListingStatus;
  lastSynced: number;
  rejectReason: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export interface PlatformAdapter {
  platform: PlatformType;
  login(account: PlatformAccount): Promise<boolean>;
  uploadListing(sku: SKUData, account: PlatformAccount, site: string): Promise<ListingResult>;
  getListingStatus(listingId: string, account: PlatformAccount): Promise<ListingStatus>;
  updatePrice(listingId: string, price: number, site: string): Promise<boolean>;
  updateInventory(listingId: string, quantity: number, site: string): Promise<boolean>;
  isCircuitBreakerOpen(): boolean;
  close(): Promise<void>;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  successThreshold: number;
}

export interface OperationError extends Error {
  code?: string;
  type: 'network_dns' | 'network_tcp' | 'network_tls' | 'platform_error' | 'auth_error' | 'validation_error' | 'unknown';
  accountLevel?: boolean;
  retryable?: boolean;
}

export interface BrowserFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  platform: string;
  language: string;
  timezone: string;
  webdriver: boolean;
  plugins: string[];
  mimeTypes: string[];
}
