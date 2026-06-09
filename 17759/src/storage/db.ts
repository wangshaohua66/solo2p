import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger';
import type { PlatformType, ListingStatus, ListingResult, PlatformAccount } from '../../types';

dotenv.config();

const logger = createLogger('db');

const DB_PATH = process.env.DATABASE_PATH || './data/cpla.db';

let instanceCache: DatabaseManager | null = null;

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

export interface TaskRecord {
  id: string;
  type: 'upload' | 'sync_status' | 'update_price' | 'update_inventory';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'fused';
  platform: PlatformType;
  sku: string;
  accountId: string;
  site: string;
  startedAt: number;
  completedAt: number | null;
  retryCount: number;
  errorMessage: string | null;
  result: string | null;
}

export interface CookieRecord {
  accountId: string;
  platform: PlatformType;
  cookies: string;
  createdAt: number;
  expiresAt: number;
}

export interface ManualQueueItem {
  id: string;
  sku: string;
  platform: PlatformType;
  site: string;
  errorMessage: string;
  failedAttempts: number;
  createdAt: number;
  resolved: boolean;
  resolvedAt: number | null;
}

class DatabaseManager {
  private db: Database.Database;

  private constructor() {
    const dbDir = path.dirname(DB_PATH);
    this.db = new Database(DB_PATH, {
      fileMustExist: false,
      timeout: 5000
    });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -20000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000');
    this.initializeSchema();
    logger.info('Database initialized', { path: DB_PATH });
  }

  static getInstance(): DatabaseManager {
    if (!instanceCache) {
      instanceCache = new DatabaseManager();
    }
    return instanceCache;
  }

  private initializeSchema(): void {
    const start = Date.now();
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sku_mapping (
        sku TEXT NOT NULL,
        platform TEXT NOT NULL,
        site TEXT NOT NULL,
        listing_id TEXT,
        listing_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        last_synced INTEGER,
        reject_reason TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        PRIMARY KEY (sku, platform, site)
      );
      
      CREATE INDEX IF NOT EXISTS idx_sku_mapping_sku_platform_site ON sku_mapping(sku, platform, site);
      CREATE INDEX IF NOT EXISTS idx_sku_mapping_status ON sku_mapping(status);
      CREATE INDEX IF NOT EXISTS idx_sku_mapping_platform ON sku_mapping(platform);
      CREATE INDEX IF NOT EXISTS idx_sku_mapping_last_synced ON sku_mapping(last_synced);
      
      CREATE TABLE IF NOT EXISTS task_history (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        platform TEXT NOT NULL,
        sku TEXT NOT NULL,
        account_id TEXT NOT NULL,
        site TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        result TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_task_history_status ON task_history(status);
      CREATE INDEX IF NOT EXISTS idx_task_history_platform ON task_history(platform);
      CREATE INDEX IF NOT EXISTS idx_task_history_started_at ON task_history(started_at);
      CREATE INDEX IF NOT EXISTS idx_task_history_sku ON task_history(sku);
      
      CREATE TABLE IF NOT EXISTS cookie_store (
        account_id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        cookies TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_cookie_store_expires ON cookie_store(expires_at);
      
      CREATE TABLE IF NOT EXISTS manual_queue (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        platform TEXT NOT NULL,
        site TEXT NOT NULL,
        error_message TEXT NOT NULL,
        failed_attempts INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolved_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_manual_queue_resolved ON manual_queue(resolved);
      CREATE INDEX IF NOT EXISTS idx_manual_queue_platform ON manual_queue(platform);
      
      CREATE TABLE IF NOT EXISTS config_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_type TEXT NOT NULL,
        content TEXT NOT NULL,
        version TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    
    const elapsed = Date.now() - start;
    logger.debug(`Schema initialized in ${elapsed}ms`);
  }

  getSKUStatus(sku: string, platform: PlatformType, site: string): SKUMapping | null {
    const start = Date.now();
    const stmt = this.db.prepare(`
      SELECT 
        sku, platform, site, listing_id as listingId, listing_url as listingUrl,
        status, last_synced as lastSynced, reject_reason as rejectReason,
        error_message as errorMessage, retry_count as retryCount
      FROM sku_mapping 
      WHERE sku = ? AND platform = ? AND site = ?
    `);
    const result = stmt.get(sku, platform, site) as SKUMapping | undefined;
    const elapsed = Date.now() - start;
    
    if (elapsed > 50) {
      logger.warn('Slow SKU query detected', { sku, platform, site, elapsed });
    }
    
    return result || null;
  }

  getAllSKUStatuses(sku?: string): SKUMapping[] {
    const start = Date.now();
    let stmt;
    if (sku) {
      stmt = this.db.prepare(`
        SELECT 
          sku, platform, site, listing_id as listingId, listing_url as listingUrl,
          status, last_synced as lastSynced, reject_reason as rejectReason,
          error_message as errorMessage, retry_count as retryCount
        FROM sku_mapping 
        WHERE sku = ?
      `);
      const result = stmt.all(sku) as SKUMapping[];
      logger.debug(`getAllSKUStatuses for ${sku} took ${Date.now() - start}ms`);
      return result;
    } else {
      stmt = this.db.prepare(`
        SELECT 
          sku, platform, site, listing_id as listingId, listing_url as listingUrl,
          status, last_synced as lastSynced, reject_reason as rejectReason,
          error_message as errorMessage, retry_count as retryCount
        FROM sku_mapping
      `);
      const result = stmt.all() as SKUMapping[];
      logger.debug(`getAllSKUStatuses all took ${Date.now() - start}ms, count: ${result.length}`);
      return result;
    }
  }

  upsertSKUMapping(mapping: Omit<SKUMapping, 'retryCount'> & { retryCount?: number }): void {
    const stmt = this.db.prepare(`
      INSERT INTO sku_mapping 
        (sku, platform, site, listing_id, listing_url, status, last_synced, reject_reason, error_message, retry_count)
      VALUES 
        (@sku, @platform, @site, @listingId, @listingUrl, @status, @lastSynced, @rejectReason, @errorMessage, COALESCE(@retryCount, 0))
      ON CONFLICT(sku, platform, site) DO UPDATE SET
        listing_id = excluded.listing_id,
        listing_url = excluded.listing_url,
        status = excluded.status,
        last_synced = excluded.last_synced,
        reject_reason = COALESCE(excluded.reject_reason, sku_mapping.reject_reason),
        error_message = COALESCE(excluded.error_message, sku_mapping.error_message),
        retry_count = CASE 
          WHEN excluded.status IN ('failed', 'rejected') THEN sku_mapping.retry_count + 1
          ELSE sku_mapping.retry_count
        END
    `);
    stmt.run({
      ...mapping,
      retryCount: mapping.retryCount ?? 0
    });
  }

  incrementRetryCount(sku: string, platform: PlatformType, site: string): number {
    const stmt = this.db.prepare(`
      UPDATE sku_mapping 
      SET retry_count = retry_count + 1 
      WHERE sku = ? AND platform = ? AND site = ?
      RETURNING retry_count
    `);
    const result = stmt.get(sku, platform, site) as { retry_count: number } | undefined;
    return result?.retry_count || 0;
  }

  createTask(task: Omit<TaskRecord, 'completedAt' | 'errorMessage' | 'result'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO task_history 
        (id, type, status, platform, sku, account_id, site, started_at, retry_count)
      VALUES 
        (@id, @type, @status, @platform, @sku, @accountId, @site, @startedAt, @retryCount)
    `);
    stmt.run(task);
  }

  updateTaskStatus(taskId: string, status: TaskRecord['status'], errorMessage?: string, result?: unknown): void {
    const stmt = this.db.prepare(`
      UPDATE task_history 
      SET status = ?, 
          completed_at = CASE WHEN ? IN ('completed', 'failed', 'fused') THEN ? ELSE completed_at END,
          error_message = ?,
          result = ?
      WHERE id = ?
    `);
    const now = Date.now();
    stmt.run(
      status,
      status,
      now,
      errorMessage || null,
      result ? JSON.stringify(result) : null,
      taskId
    );
  }

  getPendingTasks(platform?: PlatformType): TaskRecord[] {
    let sql = `
      SELECT 
        id, type, status, platform, sku, account_id as accountId,
        site, started_at as startedAt, completed_at as completedAt,
        retry_count as retryCount, error_message as errorMessage, result
      FROM task_history 
      WHERE status = 'pending'
    `;
    const params: unknown[] = [];
    
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    
    sql += ' ORDER BY started_at ASC';
    
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as TaskRecord[];
  }

  getTaskStats(platform?: PlatformType): Record<ListingStatus, number> {
    let sql = `
      SELECT status, COUNT(*) as count 
      FROM sku_mapping
    `;
    const params: unknown[] = [];
    
    if (platform) {
      sql += ' WHERE platform = ?';
      params.push(platform);
    }
    
    sql += ' GROUP BY status';
    
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as { status: string; count: number }[];
    
    const stats: Record<string, number> = {
      pending: 0,
      uploading: 0,
      under_review: 0,
      active: 0,
      rejected: 0,
      failed: 0,
      manual_review: 0
    };
    
    for (const row of rows) {
      stats[row.status] = row.count;
    }
    
    return stats as Record<ListingStatus, number>;
  }

  saveCookie(accountId: string, platform: PlatformType, cookies: string, expiresAt: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO cookie_store (account_id, platform, cookies, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        cookies = excluded.cookies,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `);
    stmt.run(accountId, platform, cookies, Date.now(), expiresAt);
  }

  getCookie(accountId: string): CookieRecord | null {
    const stmt = this.db.prepare(`
      SELECT account_id as accountId, platform, cookies, created_at as createdAt, expires_at as expiresAt
      FROM cookie_store 
      WHERE account_id = ? AND expires_at > ?
    `);
    const result = stmt.get(accountId, Date.now()) as CookieRecord | undefined;
    return result || null;
  }

  deleteCookie(accountId: string): void {
    const stmt = this.db.prepare('DELETE FROM cookie_store WHERE account_id = ?');
    stmt.run(accountId);
  }

  isCookieValid(accountId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM cookie_store 
      WHERE account_id = ? AND expires_at > ?
    `);
    const result = stmt.get(accountId, Date.now());
    return !!result;
  }

  addToManualQueue(data: { sku: string; platform: PlatformType; site: string; reason: string; createdAt?: number }): void;
  addToManualQueue(sku: string, platform: PlatformType, site: string, errorMessage: string, failedAttempts: number): void;
  addToManualQueue(...args: unknown[]): void {
    let sku: string, platform: PlatformType, site: string, reason: string, failedAttempts: number, createdAt: number;
    
    if (typeof args[0] === 'object' && args[0] !== null) {
      const data = args[0] as { sku: string; platform: PlatformType; site: string; reason: string; createdAt?: number };
      sku = data.sku;
      platform = data.platform;
      site = data.site;
      reason = data.reason;
      failedAttempts = 3;
      createdAt = data.createdAt || Date.now();
    } else {
      sku = args[0] as string;
      platform = args[1] as PlatformType;
      site = args[2] as string;
      reason = args[3] as string;
      failedAttempts = args[4] as number;
      createdAt = Date.now();
    }

    const stmt = this.db.prepare(`
      INSERT INTO manual_queue 
        (id, sku, platform, site, error_message, failed_attempts, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const id = `${sku}-${platform}-${site}-${Date.now()}`;
    stmt.run(id, sku, platform, site, reason, failedAttempts, createdAt);
  }

  getListingsForPlatform(platform: PlatformType): SKUMapping[] {
    const stmt = this.db.prepare(`
      SELECT 
        sku, platform, site, listing_id as listingId, listing_url as listingUrl,
        status, last_synced as lastSynced, reject_reason as rejectReason,
        error_message as errorMessage, retry_count as retryCount
      FROM sku_mapping 
      WHERE platform = ? AND status != 'manual_review'
      ORDER BY last_synced DESC
    `);
    return stmt.all(platform) as SKUMapping[];
  }

  updateSKUStatus(
    sku: string,
    platform: PlatformType,
    site: string,
    status: ListingStatus,
    listingId?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE sku_mapping 
      SET 
        status = ?,
        last_synced = ?,
        listing_id = COALESCE(?, listing_id)
      WHERE sku = ? AND platform = ? AND site = ?
    `);
    stmt.run(status, Date.now(), listingId || null, sku, platform, site);
  }

  getManualQueue(platform?: PlatformType, includeResolved = false): ManualQueueItem[] {
    let sql = `
      SELECT id, sku, platform, site, error_message as errorMessage,
             failed_attempts as failedAttempts, created_at as createdAt,
             resolved, resolved_at as resolvedAt
      FROM manual_queue
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];
    
    if (!includeResolved) {
      conditions.push('resolved = 0');
    }
    
    if (platform) {
      conditions.push('platform = ?');
      params.push(platform);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as ManualQueueItem[];
  }

  resolveManualQueueItem(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE manual_queue 
      SET resolved = 1, resolved_at = ? 
      WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  saveConfigBackup(configType: string, content: string, version: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO config_backups (config_type, content, version, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(configType, content, version, Date.now());
  }

  getConfigBackups(configType?: string, limit = 10): { id: number; configType: string; version: string; createdAt: number }[] {
    let sql = `
      SELECT id, config_type as configType, version, created_at as createdAt
      FROM config_backups
    `;
    const params: unknown[] = [];
    
    if (configType) {
      sql += ' WHERE config_type = ?';
      params.push(configType);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as { id: number; configType: string; version: string; createdAt: number }[];
  }

  recordListingResult(result: ListingResult): void {
    const tx = this.db.transaction(() => {
      this.upsertSKUMapping({
        sku: result.sku,
        platform: result.platform,
        site: result.site,
        listingId: result.listingId || null,
        listingUrl: result.listingUrl || null,
        status: result.status,
        lastSynced: result.completedAt || Date.now(),
        rejectReason: result.rejectReason || null,
        errorMessage: result.errorMessage || null
      });
      
      this.updateTaskStatus(
        result.taskId,
        result.status === 'active' ? 'completed' : result.status === 'failed' ? 'failed' : 'running',
        result.errorMessage,
        result
      );
      
      if (result.retryCount >= 3 && result.status === 'failed') {
        this.addToManualQueue(
          result.sku,
          result.platform,
          result.site,
          result.errorMessage || 'Max retries exceeded',
          result.retryCount
        );
      }
    });
    
    tx();
  }

  getBatchStatusSummary(platform?: PlatformType): {
    total: number;
    byStatus: Record<ListingStatus, number>;
    successRate: number;
    manualReviewCount: number;
  } {
    const all = this.getAllSKUStatuses();
    const filtered = platform ? all.filter(s => s.platform === platform) : all;
    
    const byStatus: Record<ListingStatus, number> = {
      pending: 0,
      uploading: 0,
      under_review: 0,
      active: 0,
      rejected: 0,
      failed: 0,
      manual_review: 0
    };
    
    for (const item of filtered) {
      byStatus[item.status]++;
    }
    
    const completed = byStatus.active + byStatus.rejected + byStatus.failed + byStatus.manual_review;
    const successRate = completed > 0 ? byStatus.active / completed : 0;
    const manualReviewCount = this.getManualQueue(platform, false).length;
    
    return {
      total: filtered.length,
      byStatus,
      successRate,
      manualReviewCount
    };
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }

  getRawDB(): Database.Database {
    return this.db;
  }
}

export const db = DatabaseManager.getInstance();

export default DatabaseManager;
