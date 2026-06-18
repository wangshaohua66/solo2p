import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import { PolicySnapshot, PolicyDetail, ChangeRecord, SiteConfig, ListSnapshot, CustomerMapping } from '../types';
import logger from '../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'policy-monitor.db');
const MAX_DB_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const RETENTION_MONTHS = 6;

export interface CleanupResult {
  deletedSnapshots: number;
  deletedListSnapshots: number;
  deletedChanges: number;
  deletedRuns: number;
  deletedLogs: number;
  freedBytes: number;
}

export class Repository {
  private db: Database.Database;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initTables();
    logger.info('Database initialized', { path: DB_PATH });
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS policy_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        publish_date TEXT,
        content_hash TEXT NOT NULL,
        content_text TEXT,
        content_html TEXT,
        fetched_at TEXT NOT NULL,
        snapshot_version INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_site ON policy_snapshots(site_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_url ON policy_snapshots(url);
      CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON policy_snapshots(content_hash);

      CREATE TABLE IF NOT EXISTS policy_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        doc_number TEXT,
        issue_org TEXT,
        publish_date TEXT,
        effective_date TEXT,
        expiry_date TEXT,
        key_clauses TEXT,
        tables_json TEXT,
        content_hash TEXT NOT NULL,
        raw_html TEXT,
        extracted_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_details_site ON policy_details(site_id);
      CREATE INDEX IF NOT EXISTS idx_details_hash ON policy_details(content_hash);

      CREATE TABLE IF NOT EXISTS change_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        policy_url TEXT NOT NULL,
        policy_title TEXT NOT NULL,
        change_type TEXT NOT NULL,
        similarity REAL,
        diff_summary TEXT,
        previous_snapshot_id INTEGER,
        current_snapshot_id INTEGER,
        change_level TEXT NOT NULL,
        affected_customers TEXT,
        detected_at TEXT NOT NULL,
        notified INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_changes_site ON change_records(site_id);
      CREATE INDEX IF NOT EXISTS idx_changes_detected ON change_records(detected_at);
      CREATE INDEX IF NOT EXISTS idx_changes_level ON change_records(change_level);
      CREATE INDEX IF NOT EXISTS idx_changes_notified ON change_records(notified);

      CREATE TABLE IF NOT EXISTS site_configs (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_modified TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crawl_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        total_sites INTEGER,
        success_count INTEGER,
        failed_count INTEGER,
        captcha_count INTEGER,
        new_changes INTEGER,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        event_data TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS list_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        url TEXT NOT NULL,
        items_json TEXT NOT NULL,
        items_hash TEXT NOT NULL,
        item_count INTEGER DEFAULT 0,
        fetched_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_list_snapshots_site ON list_snapshots(site_id);
      CREATE INDEX IF NOT EXISTS idx_list_snapshots_fetched ON list_snapshots(fetched_at);

      CREATE TABLE IF NOT EXISTS customer_mappings (
        customer_id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        province TEXT NOT NULL,
        categories_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_customers_province ON customer_mappings(province);
    `);
  }

  insertSnapshot(snapshot: PolicySnapshot): number {
    const stmt = this.db.prepare(`
      INSERT INTO policy_snapshots
      (site_id, url, title, publish_date, content_hash, content_text, content_html, fetched_at, snapshot_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      snapshot.siteId,
      snapshot.url,
      snapshot.title,
      snapshot.publishDate || null,
      snapshot.contentHash,
      snapshot.contentText || null,
      snapshot.contentHtml || null,
      snapshot.fetchedAt,
      snapshot.snapshotVersion || 1
    );
    return Number(result.lastInsertRowid);
  }

  getLatestSnapshotByUrl(siteId: string, url: string): PolicySnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM policy_snapshots
      WHERE site_id = ? AND url = ?
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
    `);
    const row = stmt.get(siteId, url) as any;
    return row ? this.rowToSnapshot(row) : null;
  }

  getLatestSnapshots(siteId: string, limit = 50): PolicySnapshot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM policy_snapshots
      WHERE site_id = ?
      ORDER BY fetched_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(siteId, limit) as any[];
    return rows.map(row => this.rowToSnapshot(row));
  }

  private rowToSnapshot(row: any): PolicySnapshot {
    return {
      id: row.id,
      siteId: row.site_id,
      url: row.url,
      title: row.title,
      publishDate: row.publish_date,
      contentHash: row.content_hash,
      contentText: row.content_text,
      contentHtml: row.content_html,
      fetchedAt: row.fetched_at,
      snapshotVersion: row.snapshot_version
    };
  }

  insertPolicyDetail(detail: PolicyDetail): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO policy_details
      (site_id, url, title, doc_number, issue_org, publish_date, effective_date, expiry_date,
       key_clauses, tables_json, content_hash, raw_html, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      detail.siteId,
      detail.url,
      detail.title,
      detail.docNumber || null,
      detail.issueOrg || null,
      detail.publishDate || null,
      detail.effectiveDate || null,
      detail.expiryDate || null,
      detail.keyClauses ? JSON.stringify(detail.keyClauses) : null,
      detail.tables ? JSON.stringify(detail.tables) : null,
      detail.contentHash,
      detail.rawHtml || null,
      detail.extractedAt
    );
    return Number(result.lastInsertRowid);
  }

  getPolicyDetailByUrl(url: string): PolicyDetail | null {
    const stmt = this.db.prepare('SELECT * FROM policy_details WHERE url = ?');
    const row = stmt.get(url) as any;
    return row ? this.rowToDetail(row) : null;
  }

  private rowToDetail(row: any): PolicyDetail {
    return {
      id: row.id,
      siteId: row.site_id,
      url: row.url,
      title: row.title,
      docNumber: row.doc_number,
      issueOrg: row.issue_org,
      publishDate: row.publish_date,
      effectiveDate: row.effective_date,
      expiryDate: row.expiry_date,
      keyClauses: row.key_clauses ? JSON.parse(row.key_clauses) : [],
      tables: row.tables_json ? JSON.parse(row.tables_json) : [],
      contentHash: row.content_hash,
      rawHtml: row.raw_html,
      extractedAt: row.extracted_at
    };
  }

  insertChangeRecord(record: ChangeRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO change_records
      (site_id, policy_url, policy_title, change_type, similarity, diff_summary,
       previous_snapshot_id, current_snapshot_id, change_level, affected_customers, detected_at, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.siteId,
      record.policyUrl,
      record.policyTitle,
      record.changeType,
      record.similarity || null,
      record.diffSummary,
      record.previousSnapshotId || null,
      record.currentSnapshotId || null,
      record.changeLevel,
      record.affectedCustomers ? JSON.stringify(record.affectedCustomers) : null,
      record.detectedAt,
      record.notified ? 1 : 0
    );
    return Number(result.lastInsertRowid);
  }

  getUnnotifiedChanges(): ChangeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM change_records
      WHERE notified = 0
      ORDER BY detected_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToChange(row));
  }

  markChangeNotified(changeId: number): void {
    const stmt = this.db.prepare('UPDATE change_records SET notified = 1 WHERE id = ?');
    stmt.run(changeId);
  }

  getRecentChanges(limit = 20): ChangeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM change_records
      ORDER BY detected_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.rowToChange(row));
  }

  getChangesByDateRange(startDate: string, endDate: string): ChangeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM change_records
      WHERE detected_at BETWEEN ? AND ?
      ORDER BY detected_at DESC
    `);
    const rows = stmt.all(startDate, endDate) as any[];
    return rows.map(row => this.rowToChange(row));
  }

  private rowToChange(row: any): ChangeRecord {
    return {
      id: row.id,
      siteId: row.site_id,
      policyUrl: row.policy_url,
      policyTitle: row.policy_title,
      changeType: row.change_type as 'add' | 'modify' | 'abolish',
      similarity: row.similarity,
      diffSummary: row.diff_summary,
      previousSnapshotId: row.previous_snapshot_id,
      currentSnapshotId: row.current_snapshot_id,
      changeLevel: row.change_level as 'high' | 'medium' | 'low',
      affectedCustomers: row.affected_customers ? JSON.parse(row.affected_customers) : undefined,
      detectedAt: row.detected_at,
      notified: !!row.notified
    };
  }

  insertSiteConfig(config: SiteConfig): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO site_configs (id, config_json, enabled, last_modified)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(config.id, JSON.stringify(config), config.enabled ? 1 : 0);
  }

  getAllSiteConfigs(): SiteConfig[] {
    const stmt = this.db.prepare('SELECT * FROM site_configs');
    const rows = stmt.all() as any[];
    return rows.map(row => JSON.parse(row.config_json) as SiteConfig);
  }

  insertCrawlRun(startedAt: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO crawl_runs (started_at, status)
      VALUES (?, 'running')
    `);
    const result = stmt.run(startedAt);
    return Number(result.lastInsertRowid);
  }

  updateCrawlRun(runId: number, data: Partial<{
    endedAt: string;
    totalSites: number;
    successCount: number;
    failedCount: number;
    captchaCount: number;
    newChanges: number;
    status: string;
  }>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.endedAt !== undefined) { fields.push('ended_at = ?'); values.push(data.endedAt); }
    if (data.totalSites !== undefined) { fields.push('total_sites = ?'); values.push(data.totalSites); }
    if (data.successCount !== undefined) { fields.push('success_count = ?'); values.push(data.successCount); }
    if (data.failedCount !== undefined) { fields.push('failed_count = ?'); values.push(data.failedCount); }
    if (data.captchaCount !== undefined) { fields.push('captcha_count = ?'); values.push(data.captchaCount); }
    if (data.newChanges !== undefined) { fields.push('new_changes = ?'); values.push(data.newChanges); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    values.push(runId);
    const stmt = this.db.prepare(`UPDATE crawl_runs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  insertAuditLog(eventType: string, eventData?: Record<string, unknown>): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (event_type, event_data, created_at)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(eventType, eventData ? JSON.stringify(eventData) : null);
  }

  insertListSnapshot(snapshot: ListSnapshot): number {
    const stmt = this.db.prepare(`
      INSERT INTO list_snapshots
      (site_id, url, items_json, items_hash, item_count, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      snapshot.siteId,
      snapshot.url,
      snapshot.itemsJson,
      snapshot.itemsHash,
      snapshot.itemCount,
      snapshot.fetchedAt
    );
    return Number(result.lastInsertRowid);
  }

  getLatestListSnapshot(siteId: string, url: string): ListSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM list_snapshots
      WHERE site_id = ? AND url = ?
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
    `);
    const row = stmt.get(siteId, url) as any;
    if (!row) return null;
    return {
      id: row.id,
      siteId: row.site_id,
      url: row.url,
      itemsJson: row.items_json,
      itemsHash: row.items_hash,
      itemCount: row.item_count,
      fetchedAt: row.fetched_at
    };
  }

  getListSnapshotHistory(siteId: string, url: string, limit = 5): ListSnapshot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM list_snapshots
      WHERE site_id = ? AND url = ?
      ORDER BY fetched_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(siteId, url, limit) as any[];
    return rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      url: row.url,
      itemsJson: row.items_json,
      itemsHash: row.items_hash,
      itemCount: row.item_count,
      fetchedAt: row.fetched_at
    }));
  }

  upsertCustomer(customer: CustomerMapping): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO customer_mappings
      (customer_id, customer_name, province, categories_json)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      customer.customerId,
      customer.customerName,
      customer.province,
      customer.categories ? JSON.stringify(customer.categories) : null
    );
  }

  getCustomersByProvince(province: string): CustomerMapping[] {
    const stmt = this.db.prepare('SELECT * FROM customer_mappings WHERE province = ?');
    const rows = stmt.all(province) as any[];
    return rows.map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      province: row.province,
      categories: row.categories_json ? JSON.parse(row.categories_json) : []
    }));
  }

  getCustomersByCategoryAndProvince(category: string, province: string): CustomerMapping[] {
    const customers = this.getCustomersByProvince(province);
    return customers.filter(c =>
      c.categories.length === 0 || c.categories.includes(category as any)
    );
  }

  getAllCustomers(): CustomerMapping[] {
    const stmt = this.db.prepare('SELECT * FROM customer_mappings');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      province: row.province,
      categories: row.categories_json ? JSON.parse(row.categories_json) : []
    }));
  }

  getDb(): Database.Database {
    return this.db;
  }

  getDbSizeBytes(): number {
    let totalSize = 0;
    const walPath = DB_PATH + '-wal';
    const shmPath = DB_PATH + '-shm';
    try {
      if (fs.existsSync(DB_PATH)) totalSize += fs.statSync(DB_PATH).size;
      if (fs.existsSync(walPath)) totalSize += fs.statSync(walPath).size;
      if (fs.existsSync(shmPath)) totalSize += fs.statSync(shmPath).size;
    } catch {
      // ignore
    }
    return totalSize;
  }

  cleanupOldData(months: number = RETENTION_MONTHS): {
    deletedSnapshots: number;
    deletedListSnapshots: number;
    deletedChanges: number;
    deletedRuns: number;
    deletedLogs: number;
    freedBytes: number;
  } {
    const beforeSize = this.getDbSizeBytes();
    const cutoffDate = dayjs().subtract(months, 'month').format('YYYY-MM-DD HH:mm:ss');
    logger.info(`Cleaning up data older than ${cutoffDate} (${months} months retention)`);

    const delSnapshots = this.db.prepare(`
      DELETE FROM policy_snapshots WHERE fetched_at < ?
    `).run(cutoffDate);

    const delListSnapshots = this.db.prepare(`
      DELETE FROM list_snapshots WHERE fetched_at < ?
    `).run(cutoffDate);

    const delChanges = this.db.prepare(`
      DELETE FROM change_records WHERE detected_at < ?
    `).run(cutoffDate);

    const delRuns = this.db.prepare(`
      DELETE FROM crawl_runs WHERE started_at < ?
    `).run(cutoffDate);

    const delLogs = this.db.prepare(`
      DELETE FROM audit_logs WHERE created_at < ?
    `).run(cutoffDate);

    const deletedDetails = this.db.prepare(`
      DELETE FROM policy_details WHERE extracted_at < ?
    `).run(cutoffDate);

    this.db.pragma('wal_checkpoint(TRUNCATE)');
    this.db.pragma('optimize');

    const afterSize = this.getDbSizeBytes();
    const freedBytes = Math.max(0, beforeSize - afterSize);

    const result = {
      deletedSnapshots: delSnapshots.changes + deletedDetails.changes,
      deletedListSnapshots: delListSnapshots.changes,
      deletedChanges: delChanges.changes,
      deletedRuns: delRuns.changes,
      deletedLogs: delLogs.changes,
      freedBytes
    };

    logger.info('Data cleanup completed', result);
    return result;
  }

  enforceSizeLimit(maxBytes: number = MAX_DB_SIZE_BYTES): { cleaned: boolean; result?: CleanupResult } {
    const currentSize = this.getDbSizeBytes();
    if (currentSize <= maxBytes) {
      return { cleaned: false };
    }

    logger.warn(`Database size ${currentSize} bytes exceeds limit ${maxBytes} bytes, triggering aggressive cleanup`);

    let result = this.cleanupOldData(RETENTION_MONTHS);

    if (this.getDbSizeBytes() > maxBytes) {
      logger.warn('Still over limit after 6-month cleanup, reducing to 3 months');
      result = this.cleanupOldData(3);
    }

    if (this.getDbSizeBytes() > maxBytes) {
      logger.warn('Still over limit, reducing to 1 month');
      result = this.cleanupOldData(1);
    }

    return { cleaned: true, result };
  }

  close(): void {
    this.db.close();
    logger.info('Database closed');
  }
}

export const repository = new Repository();
export default repository;
