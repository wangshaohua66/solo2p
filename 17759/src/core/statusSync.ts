import cron from 'node-cron';
import { createLogger } from '../utils/logger';
import { db } from '../storage/db';
import { authManager } from '../common/authManager';
import { amazonAdapter } from '../platforms/amazon';
import { ebayAdapter } from '../platforms/ebay';
import { shopeeAdapter } from '../platforms/shopee';
import { lazadaAdapter } from '../platforms/lazada';
import { tiktokAdapter } from '../platforms/tiktok';
import { circuitBreakerManager } from '../utils/retry';
import type { PlatformType, ListingStatus, ListingResult, SKUMapping } from '../../types';

const logger = createLogger('status-sync');

export interface SyncResult {
  platform: PlatformType;
  listingId: string;
  sku: string;
  oldStatus: ListingStatus;
  newStatus: ListingStatus;
  changed: boolean;
  timestamp: number;
}

export interface SyncReport {
  total: number;
  changed: number;
  unchanged: number;
  failed: number;
  results: SyncResult[];
  startTime: number;
  endTime: number;
}

class StatusSyncManager {
  private scheduledTasks: Map<string, cron.ScheduledTask>;
  private isSyncing: boolean;
  private platformAdapters: Map<PlatformType, any>;

  constructor() {
    this.scheduledTasks = new Map();
    this.isSyncing = false;
    this.platformAdapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    this.platformAdapters.set('amazon', amazonAdapter);
    this.platformAdapters.set('ebay', ebayAdapter);
    this.platformAdapters.set('shopee', shopeeAdapter);
    this.platformAdapters.set('lazada', lazadaAdapter);
    this.platformAdapters.set('tiktok', tiktokAdapter);
  }

  public startSchedule(platform?: PlatformType, cronExpression?: string): void {
    const expression = cronExpression || process.env.STATUS_SYNC_CRON || '0 */2 * * *';
    const platforms: PlatformType[] = platform
      ? [platform]
      : ['amazon', 'ebay', 'shopee', 'lazada', 'tiktok'];

    for (const p of platforms) {
      const taskId = `sync-${p}`;
      
      if (this.scheduledTasks.has(taskId)) {
        this.scheduledTasks.get(taskId)?.stop();
      }

      const task = cron.schedule(expression, async () => {
        logger.info(`Scheduled status sync started for ${p}`);
        try {
          await this.syncPlatformStatus(p);
        } catch (error) {
          logger.error(`Scheduled sync failed for ${p}`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TZ || 'Asia/Shanghai'
      });

      this.scheduledTasks.set(taskId, task);
      logger.info(`Status sync scheduled for ${p} with cron: ${expression}`);
    }
  }

  public stopSchedule(platform?: PlatformType): void {
    if (platform) {
      const taskId = `sync-${platform}`;
      const task = this.scheduledTasks.get(taskId);
      if (task) {
        task.stop();
        this.scheduledTasks.delete(taskId);
        logger.info(`Status sync stopped for ${platform}`);
      }
    } else {
      for (const [taskId, task] of this.scheduledTasks) {
        task.stop();
        this.scheduledTasks.delete(taskId);
      }
      logger.info('All status sync schedules stopped');
    }
  }

  public async syncAllPlatforms(): Promise<SyncReport> {
    const startTime = Date.now();
    const allResults: SyncResult[] = [];

    logger.info('Starting full status sync for all platforms');

    for (const platform of this.platformAdapters.keys()) {
      try {
        const platformResults = await this.syncPlatformStatus(platform);
        allResults.push(...platformResults);
      } catch (error) {
        logger.error(`Sync failed for ${platform}`, error);
      }
    }

    const endTime = Date.now();
    const changed = allResults.filter(r => r.changed).length;
    const failed = allResults.filter(r => r.newStatus === 'failed').length;

    const report: SyncReport = {
      total: allResults.length,
      changed,
      unchanged: allResults.length - changed - failed,
      failed,
      results: allResults,
      startTime,
      endTime
    };

    logger.info(`Full sync completed: ${changed} changed, ${failed} failed`, {
      duration: endTime - startTime
    });

    return report;
  }

  public async syncPlatformStatus(platform: PlatformType): Promise<SyncResult[]> {
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping');
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];

    try {
      logger.info(`Starting status sync for ${platform}`);

      const adapter = this.platformAdapters.get(platform);
      if (!adapter) {
        throw new Error(`No adapter found for ${platform}`);
      }

      if (circuitBreakerManager.get(`${platform}-status`).getState() === 'open') {
        logger.warn(`Circuit breaker open for ${platform} status sync, skipping`);
        return [];
      }

      const listings = db.getListingsForPlatform(platform) || [];
      logger.info(`Found ${listings.length} listings to sync for ${platform}`);

      const account = authManager.getNextAccount(platform);
      if (!account) {
        logger.warn(`No active account for ${platform}, skipping sync`);
        return [];
      }

      const loggedIn = await adapter.login(account).catch(() => false);
      if (!loggedIn) {
        logger.error(`Failed to login to ${platform} for status sync`);
        return [];
      }

      for (const listing of listings) {
        if (!listing.listingId) continue;

        try {
          const oldStatus = listing.status as ListingStatus;
          const newStatus = await adapter.getListingStatus(listing.listingId, account);

          const changed = oldStatus !== newStatus;

          if (changed) {
            db.updateSKUStatus(
              listing.sku,
              platform,
              listing.site,
              newStatus,
              listing.listingId
            );
            logger.info(`Status changed for ${listing.sku} on ${platform}: ${oldStatus} -> ${newStatus}`);
          }

          results.push({
            platform,
            listingId: listing.listingId,
            sku: listing.sku,
            oldStatus,
            newStatus,
            changed,
            timestamp: Date.now()
          });
        } catch (error) {
          logger.error(`Failed to sync status for ${listing.sku} on ${platform}`, error);
          results.push({
            platform,
            listingId: listing.listingId,
            sku: listing.sku,
            oldStatus: listing.status as ListingStatus,
            newStatus: 'failed',
            changed: false,
            timestamp: Date.now()
          });
        }
      }

      const changedCount = results.filter(r => r.changed).length;
      logger.info(`Status sync completed for ${platform}: ${changedCount}/${results.length} changed`);

      return results;
    } finally {
      this.isSyncing = false;
    }
  }

  public generateDiffReport(report: SyncReport): string {
    const changedItems = report.results.filter(r => r.changed);
    const failedItems = report.results.filter(r => r.newStatus === 'failed');

    let diff = `Status Sync Report - ${new Date(report.startTime).toISOString()}\n`;
    diff += `Duration: ${((report.endTime - report.startTime) / 1000).toFixed(1)}s\n`;
    diff += `Total: ${report.total}, Changed: ${report.changed}, Failed: ${report.failed}\n\n`;

    if (changedItems.length > 0) {
      diff += '=== CHANGED ===\n';
      for (const item of changedItems) {
        diff += `${item.platform} | ${item.sku} | ${item.oldStatus} -> ${item.newStatus}\n`;
      }
      diff += '\n';
    }

    if (failedItems.length > 0) {
      diff += '=== FAILED ===\n';
      for (const item of failedItems) {
        diff += `${item.platform} | ${item.sku} | ${item.oldStatus} -> FAILED\n`;
      }
    }

    return diff;
  }

  public getScheduledTasks(): string[] {
    return Array.from(this.scheduledTasks.keys());
  }

  public async close(): Promise<void> {
    this.stopSchedule();
    
    for (const adapter of this.platformAdapters.values()) {
      try {
        await adapter.close();
      } catch (e) {
        logger.error('Error closing adapter', e);
      }
    }

    logger.info('Status sync manager closed');
  }
}

export const statusSyncManager = new StatusSyncManager();

export default StatusSyncManager;
