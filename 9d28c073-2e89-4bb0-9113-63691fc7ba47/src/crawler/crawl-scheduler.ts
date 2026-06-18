import cron from 'node-cron';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { nowIso, withTimeout, chunkArray, sleep } from '../utils/helpers';
import siteRegistry from '../crawler/site-registry';
import { PageFetcher } from '../crawler/page-fetcher';
import { ChangeDetector } from '../detector/change-detector';
import { PolicyParser } from '../extractor/policy-parser';
import { AlertService } from '../notifier/alert-service';
import repository from '../storage/repository';
import {
  SiteConfig,
  SiteRuntimeInfo,
  SiteStatus,
  CrawlResult,
  ChangeRecord,
  PolicyListItem
} from '../types';

export interface CrawlSession {
  runId: number;
  startTime: Date;
  endTime?: Date;
  totalSites: number;
  completedSites: number;
  successCount: number;
  failedCount: number;
  captchaCount: number;
  newChanges: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'timeout';
  siteStatuses: Map<string, SiteRuntimeInfo>;
}

export class CrawlScheduler extends EventEmitter {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private currentSession: CrawlSession | null = null;
  private maxConcurrentBrowsers: number = 3;
  private sessionTimeout: number = 30 * 60 * 1000;
  private alertService: AlertService;
  private isPaused: boolean = false;
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;

  constructor(alertService: AlertService) {
    super();
    this.alertService = alertService;
  }

  setupCronJobs(): void {
    const workdaySchedule = '0 8,12,17 * * 1-5';

    const job = cron.schedule(workdaySchedule, () => {
      logger.info('Cron triggered: starting scheduled crawl');
      this.startCrawl().catch(err => {
        logger.error(`Scheduled crawl failed: ${err.message}`);
      });
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    this.cronJobs.set('workday-3times', job);
    logger.info('Cron jobs setup: workdays at 08:00, 12:00, 17:00');
  }

  getCronJobNames(): string[] {
    return Array.from(this.cronJobs.keys());
  }

  async startCrawl(): Promise<CrawlSession> {
    if (this.currentSession && this.currentSession.status === 'running') {
      logger.warn('Crawl session already running, skipping');
      return this.currentSession;
    }

    const sites = siteRegistry.getEnabledSites();
    logger.info(`Starting crawl session with ${sites.length} sites`);

    const runId = repository.insertCrawlRun(nowIso());

    const siteStatuses = new Map<string, SiteRuntimeInfo>();
    for (const site of sites) {
      siteStatuses.set(site.id, {
        siteId: site.id,
        status: 'idle',
        consecutiveFailures: 0
      });
    }

    this.currentSession = {
      runId,
      startTime: new Date(),
      totalSites: sites.length,
      completedSites: 0,
      successCount: 0,
      failedCount: 0,
      captchaCount: 0,
      newChanges: 0,
      status: 'running',
      siteStatuses
    };

    this.emit('sessionStart', this.currentSession);

    try {
      await withTimeout(
        this.runCrawl(sites),
        this.sessionTimeout,
        'Crawl session timed out after 30 minutes'
      );
      this.currentSession.status = 'completed';
      this.currentSession.endTime = new Date();
      logger.info('Crawl session completed successfully', {
        success: this.currentSession.successCount,
        failed: this.currentSession.failedCount,
        captcha: this.currentSession.captchaCount,
        changes: this.currentSession.newChanges,
        duration: (this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime()) / 1000 + 's'
      });
    } catch (err) {
      this.currentSession.status = 'timeout';
      this.currentSession.endTime = new Date();
      logger.error(`Crawl session failed: ${(err as Error).message}`);
    }

    repository.updateCrawlRun(runId, {
      endedAt: nowIso(),
      totalSites: this.currentSession.totalSites,
      successCount: this.currentSession.successCount,
      failedCount: this.currentSession.failedCount,
      captchaCount: this.currentSession.captchaCount,
      newChanges: this.currentSession.newChanges,
      status: this.currentSession.status
    });

    this.emit('sessionEnd', this.currentSession);

    if (this.currentSession.newChanges > 0) {
      await this.sendAlertsForNewChanges();
    }

    return this.currentSession;
  }

  private async runCrawl(sites: SiteConfig[]): Promise<void> {
    const grouped = this.groupSitesForParallelism(sites);
    const totalGroups = grouped.length;

    logger.info(`Crawling ${sites.length} sites in ${totalGroups} groups (${this.maxConcurrentBrowsers} concurrent browsers)`);

    for (let i = 0; i < grouped.length; i++) {
      const group = grouped[i];
      logger.debug(`Processing group ${i + 1}/${totalGroups} with ${group.length} sites`);

      const promises = group.map(site => this.crawlSite(site));
      await Promise.all(promises);

      this.emit('progress', this.currentSession);
    }
  }

  private groupSitesForParallelism(sites: SiteConfig[]): SiteConfig[][] {
    const byProvince = siteRegistry.groupByProvince();
    const provinceGroups: SiteConfig[][] = [];

    for (const [, provinceSites] of byProvince) {
      const sorted = [...provinceSites].sort((a, b) => a.priority - b.priority);
      provinceGroups.push(sorted);
    }

    provinceGroups.sort((a, b) => {
      const minA = Math.min(...a.map(s => s.priority));
      const minB = Math.min(...b.map(s => s.priority));
      return minA - minB;
    });

    return chunkArray(provinceGroups.flat(), this.maxConcurrentBrowsers).map(chunk => chunk);
  }

  private async crawlSite(site: SiteConfig): Promise<CrawlResult> {
    const session = this.currentSession;
    if (!session) {
      return { siteId: site.id, success: false, status: 'failed', error: 'No active session', duration: 0 };
    }

    const startTime = Date.now();
    const siteStatus = session.siteStatuses.get(site.id)!;
    siteStatus.status = 'running';
    this.emit('siteStart', site.id);

    if (this.isPaused) {
      await this.waitForResume();
    }

    let fetcher: PageFetcher | null = null;
    let allChanges: ChangeRecord[] = [];

    try {
      fetcher = new PageFetcher(site);
      const detector = new ChangeDetector(site);
      const parser = new PolicyParser(site);

      const listResult = await fetcher.fetch(site.listUrl);

      if (!listResult.success) {
        if (listResult.captchaDetected) {
          siteStatus.status = 'captcha';
          session.captchaCount++;
          logger.getLogger(site.id).warn('Captcha detected, site needs manual review');

          const result: CrawlResult = {
            siteId: site.id,
            success: false,
            status: 'captcha',
            message: 'Captcha detected',
            screenshotPath: listResult.screenshotPath,
            duration: Date.now() - startTime
          };
          this.emit('siteComplete', site.id, result);
          session.completedSites++;
          return result;
        }

        siteStatus.status = 'failed';
        siteStatus.consecutiveFailures++;
        session.failedCount++;

        const result: CrawlResult = {
          siteId: site.id,
          success: false,
          status: 'failed',
          error: listResult.error,
          duration: Date.now() - startTime
        };
        this.emit('siteComplete', site.id, result);
        session.completedSites++;
        return result;
      }

      const listItems = detector.extractListItems(listResult.html!);
      logger.getLogger(site.id).info(`Fetched list page: ${listItems.length} items`);

      const previousItems = this.loadPreviousListItems(site.id);
      const listChanges = detector.detectListChanges(listItems, previousItems);

      if (listChanges.added.length > 0 || listChanges.removed.length > 0) {
        logger.getLogger(site.id).info(
          `List changes: +${listChanges.added.length} added, -${listChanges.removed.length} removed`
        );
      }

      this.saveListItems(site.id, listItems);

      const itemsToCrawl = listChanges.added.slice(0, 10);

      for (const item of itemsToCrawl) {
        if (this.isPaused) {
          await this.waitForResume();
        }

        try {
          const detailResult = await fetcher.fetch(item.url);

          if (detailResult.success && detailResult.html) {
            const change = await detector.detectDetailChange(
              item.url,
              detailResult.html,
              item.title
            );

            if (change) {
              allChanges.push(change);
              session.newChanges++;

              parser.parseAndSave(detailResult.html, item.url);

              this.emit('changeDetected', change);
            }
          }
        } catch (err) {
          logger.getLogger(site.id).error(
            `Failed to fetch detail ${item.url}: ${(err as Error).message}`
          );
        }
      }

      siteStatus.status = 'success';
      siteStatus.lastSuccessTime = nowIso();
      siteStatus.consecutiveFailures = 0;
      session.successCount++;

      const result: CrawlResult = {
        siteId: site.id,
        success: true,
        status: 'ok',
        policyList: listItems,
        duration: Date.now() - startTime
      };

      this.emit('siteComplete', site.id, result);
      session.completedSites++;
      return result;

    } catch (err) {
      siteStatus.status = 'failed';
      siteStatus.consecutiveFailures++;
      session.failedCount++;

      logger.getLogger(site.id).error(`Crawl failed: ${(err as Error).message}`);

      const result: CrawlResult = {
        siteId: site.id,
        success: false,
        status: 'failed',
        error: (err as Error).message,
        duration: Date.now() - startTime
      };

      this.emit('siteComplete', site.id, result);
      session.completedSites++;
      return result;
    } finally {
      if (fetcher) {
        await fetcher.close().catch(() => {});
      }
      siteStatus.lastCrawlTime = nowIso();
    }
  }

  private loadPreviousListItems(siteId: string): PolicyListItem[] {
    const snapshots = repository.getLatestSnapshots(siteId, 100);
    const items: PolicyListItem[] = snapshots.map(s => ({
      title: s.title,
      url: s.url,
      publishDate: s.publishDate || ''
    }));
    return items;
  }

  private saveListItems(siteId: string, items: PolicyListItem[]): void {
    // Items are saved as individual snapshots when details are fetched
    // This is a placeholder for potential list-level snapshotting
  }

  async retryFailedSites(): Promise<number> {
    if (!this.currentSession) {
      logger.warn('No active session, cannot retry failed sites');
      return 0;
    }

    const failedSites = Array.from(this.currentSession.siteStatuses.values())
      .filter(s => s.status === 'failed' || s.status === 'captcha')
      .map(s => siteRegistry.getSite(s.siteId))
      .filter((s): s is SiteConfig => s !== undefined && s.enabled);

    if (failedSites.length === 0) {
      logger.info('No failed sites to retry');
      return 0;
    }

    logger.info(`Retrying ${failedSites.length} failed sites`);

    for (const site of failedSites) {
      const status = this.currentSession.siteStatuses.get(site.id);
      if (status) {
        if (status.status === 'failed') {
          this.currentSession.failedCount--;
        } else if (status.status === 'captcha') {
          this.currentSession.captchaCount--;
        }
        status.status = 'idle';
        this.currentSession.completedSites--;
      }
    }

    const promises = failedSites.map(site => this.crawlSite(site));
    await Promise.all(promises);

    return failedSites.length;
  }

  pause(): void {
    if (this.isPaused) return;

    this.isPaused = true;
    this.pausePromise = new Promise(resolve => {
      this.pauseResolve = resolve;
    });

    if (this.currentSession) {
      this.currentSession.status = 'paused';
    }

    logger.info('Crawl session paused');
    this.emit('paused');
  }

  resume(): void {
    if (!this.isPaused) return;

    this.isPaused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
      this.pausePromise = null;
    }

    if (this.currentSession) {
      this.currentSession.status = 'running';
    }

    logger.info('Crawl session resumed');
    this.emit('resumed');
  }

  private async waitForResume(): Promise<void> {
    if (this.pausePromise) {
      await this.pausePromise;
    }
  }

  isPausedStatus(): boolean {
    return this.isPaused;
  }

  getCurrentSession(): CrawlSession | null {
    return this.currentSession;
  }

  private async sendAlertsForNewChanges(): Promise<void> {
    const unnotified = repository.getUnnotifiedChanges();
    if (unnotified.length === 0) return;

    logger.info(`Sending alerts for ${unnotified.length} unnotified changes`);

    try {
      const result = await this.alertService.sendAlerts(unnotified);
      logger.info(`Alerts sent: email ${result.email.sent}, wecom ${result.wecom.sent}`);
    } catch (err) {
      logger.error(`Failed to send alerts: ${(err as Error).message}`);
    }
  }

  generateReport(): string {
    const changes = repository.getRecentChanges(100);
    const sites = siteRegistry.getAllSites();
    return this.alertService.generateChangeReport(changes, sites);
  }

  setMaxConcurrentBrowsers(count: number): void {
    this.maxConcurrentBrowsers = Math.max(1, Math.min(10, count));
    logger.info(`Max concurrent browsers set to ${this.maxConcurrentBrowsers}`);
  }

  setSessionTimeout(timeoutMs: number): void {
    this.sessionTimeout = Math.max(5 * 60 * 1000, timeoutMs);
    logger.info(`Session timeout set to ${this.sessionTimeout / 1000}s`);
  }

  destroy(): void {
    for (const [name, job] of this.cronJobs) {
      job.stop();
      logger.info(`Cron job ${name} stopped`);
    }
    this.cronJobs.clear();
    logger.info('Crawl scheduler destroyed');
  }
}

export default CrawlScheduler;
