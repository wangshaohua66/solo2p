import cron from 'node-cron';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { nowIso, withTimeout, sleep, md5, exponentialBackoff } from '../utils/helpers';
import siteRegistry from '../crawler/site-registry';
import { PageFetcher } from '../crawler/page-fetcher';
import { BrowserPool, BrowserWorker } from '../crawler/browser-pool';
import { ChangeDetector } from '../detector/change-detector';
import { PolicyParser } from '../extractor/policy-parser';
import { AlertService } from '../notifier/alert-service';
import repository from '../storage/repository';
import {
  SiteConfig,
  SiteRuntimeInfo,
  CrawlResult,
  PolicyListItem,
  ListSnapshot,
  CaptchaManualIntervention
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
  private poolSize: number = 3;
  private sessionTimeout: number = 30 * 60 * 1000;
  private alertService: AlertService;
  private isPaused: boolean = false;
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;
  private browserPool: BrowserPool | null = null;
  private pendingCaptchaSites: Set<string> = new Set();

  constructor(alertService: AlertService, browserPool?: BrowserPool) {
    super();
    this.alertService = alertService;
    if (browserPool) {
      this.browserPool = browserPool;
    }
  }

  setBrowserPool(pool: BrowserPool): void {
    this.browserPool = pool;
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

    const cleanupJob = cron.schedule('0 3 * * 0', () => {
      logger.info('Cron triggered: weekly data cleanup');
      this.runDataCleanup().catch(err => {
        logger.error(`Data cleanup failed: ${err.message}`);
      });
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.cronJobs.set('weekly-cleanup', cleanupJob);

    logger.info('Cron jobs setup: workdays at 08:00, 12:00, 17:00 + weekly cleanup at 03:00 Sunday');
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

    await this.runDataCleanup();

    return this.currentSession;
  }

  private async runCrawl(sites: SiteConfig[]): Promise<void> {
    const grouped = this.groupSitesForParallelism(sites);
    const totalGroups = grouped.length;

    logger.info(`Crawling ${sites.length} sites in ${totalGroups} groups (${this.poolSize} browser instances)`);

    if (this.browserPool) {
      await this.runCrawlWithPool(grouped, totalGroups);
    } else {
      await this.runCrawlStandalone(grouped, totalGroups);
    }
  }

  private async runCrawlWithPool(grouped: SiteConfig[][], totalGroups: number): Promise<void> {
    const pool = this.browserPool!;

    const promises = grouped.map((provinceGroup, i) =>
      pool.runExclusive(async (worker: BrowserWorker) => {
        const province = provinceGroup[0]?.province || 'unknown';
        logger.debug(
          `Worker acquired for province group ${i + 1}/${totalGroups} ` +
          `(${province}, ${provinceGroup.length} sites) - processing sequentially`
        );
        for (const site of provinceGroup) {
          await this.crawlSiteWithWorker(site, worker);
        }
        logger.debug(`Worker released after completing province group ${i + 1}/${totalGroups} (${province})`);
      })
    );
    await Promise.all(promises);

    this.emit('progress', this.currentSession);
  }

  private async runCrawlStandalone(grouped: SiteConfig[][], totalGroups: number): Promise<void> {
    for (let i = 0; i < grouped.length; i++) {
      const group = grouped[i];
      const province = group[0]?.province || 'unknown';
      logger.debug(`Processing province group ${i + 1}/${totalGroups} (${province}, ${group.length} sites) sequentially`);

      for (const site of group) {
        await this.crawlSite(site);
      }

      this.emit('progress', this.currentSession);
    }
  }

  private groupSitesForParallelism(sites: SiteConfig[]): SiteConfig[][] {
    const byProvince = new Map<string, SiteConfig[]>();

    for (const site of sites) {
      if (!byProvince.has(site.province)) {
        byProvince.set(site.province, []);
      }
      byProvince.get(site.province)!.push(site);
    }

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

    return provinceGroups;
  }

  private async crawlSiteWithWorker(site: SiteConfig, worker: BrowserWorker): Promise<void> {
    const session = this.currentSession;
    if (!session) return;

    const startTime = Date.now();
    const siteStatus = session.siteStatuses.get(site.id)!;
    siteStatus.status = 'running';
    this.emit('siteStart', site.id);

    if (this.isPaused) {
      await this.waitForResume();
    }

    let fetcher: PageFetcher | null = null;

    try {
      fetcher = new PageFetcher(site, worker.browser, worker.userAgent);
      const detector = new ChangeDetector(site);
      const parser = new PolicyParser(site);

      const listResult = await fetcher.fetch(site.listUrl);

      if (!listResult.success) {
        if (listResult.captchaDetected) {
          const captchaType = listResult.captchaType || 'unknown';

          if (captchaType === 'slider') {
            logger.getLogger(site.id).info('Slider captcha detected, attempting auto-solve (max 3 attempts)');
            const solved = await fetcher.attemptSliderSolve();
            if (solved) {
              logger.getLogger(site.id).info('Slider captcha solved, retrying list fetch');
              const retryResult = await fetcher.fetch(site.listUrl);
              if (retryResult.success) {
                await this.processListPage(site, fetcher, detector, parser, retryResult.html!, startTime);
                return;
              }
            }
          }

          await this.handleCaptchaIntervention(site, listResult.screenshotPath, captchaType, siteStatus, startTime);
          return;
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
        return;
      }

      await this.processListPage(site, fetcher, detector, parser, listResult.html!, startTime);
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
    } finally {
      if (fetcher) {
        await fetcher.close().catch(() => {});
      }
      siteStatus.lastCrawlTime = nowIso();
    }
  }

  private async processListPage(
    site: SiteConfig,
    fetcher: PageFetcher,
    detector: ChangeDetector,
    parser: PolicyParser,
    listHtml: string,
    startTime: number
  ): Promise<void> {
    const session = this.currentSession!;
;

    const listItems = detector.extractListItems(listHtml);
    logger.getLogger(site.id).info(`Fetched list page: ${listItems.length} items`);

    const previousItems = this.loadPreviousListItems(site.id, site.listUrl);
    const listChanges = detector.detectListChanges(listItems, previousItems);

    if (listChanges.added.length > 0 || listChanges.removed.length > 0) {
      logger.getLogger(site.id).info(
        `List changes: +${listChanges.added.length} added, -${listChanges.removed.length} removed`
      );
    }

    this.saveListItems(site.id, site.listUrl, listItems);

    if (listChanges.removed.length > 0) {
      const abolishRecords = detector.detectAbolishFromListRemoval(listChanges.removed);
      for (const record of abolishRecords) {
        session.newChanges++;
        this.emit('changeDetected', record);
      }
    }

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
            session.newChanges++;
            parser.parseAndSave(detailResult.html, item.url);
            this.emit('changeDetected', change);
          }
        } else if (detailResult.captchaDetected) {
          const captchaType = detailResult.captchaType || 'unknown';
          if (captchaType === 'slider') {
            const solved = await fetcher.attemptSliderSolve();
            if (solved) {
              const retryResult = await fetcher.fetch(item.url);
              if (retryResult.success && retryResult.html) {
                const change = await detector.detectDetailChange(
                  item.url,
                  retryResult.html,
                  item.title
                );
                if (change) {
                  session.newChanges++;
                  this.emit('changeDetected', change);
                }
                continue;
              }
            }
          }

          await this.handleCaptchaIntervention(site, detailResult.screenshotPath, captchaType, session.siteStatuses.get(site.id)!, startTime);
          break;
        }
      } catch (err) {
        logger.getLogger(site.id).error(
          `Failed to fetch detail ${item.url}: ${(err as Error).message}`
        );
      }
    }

    const siteStatus = session.siteStatuses.get(site.id)!;
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
  }

  private async handleCaptchaIntervention(
    site: SiteConfig,
    screenshotPath: string | undefined,
    captchaType: 'graphic' | 'slider' | 'unknown',
    siteStatus: SiteRuntimeInfo,
    startTime: number
  ): Promise<void> {
    const session = this.currentSession!;
    siteStatus.status = 'captcha';
    session.captchaCount++;

    const intervention: CaptchaManualIntervention = {
      siteId: site.id,
      url: site.listUrl,
      captchaType: captchaType === 'slider' ? 'slider' : 'graphic',
      screenshotPath: screenshotPath || '',
      detectedAt: nowIso(),
      resolved: false
    };

    this.pendingCaptchaSites.add(site.id);

    logger.getLogger(site.id).warn(
      `Graphic/unknown captcha detected - PAUSING crawl flow for manual intervention. ` +
      `Site: ${site.name}, Type: ${captchaType}, Screenshot: ${screenshotPath || 'none'}`
    );

    this.emit('captchaManualIntervention', intervention);
    this.emit('siteCaptcha', site.id, intervention);

    if (captchaType !== 'slider') {
      logger.info(`Crawl flow paused due to graphic captcha at site ${site.id}. Waiting for manual resolution...`);
      this.pause();
      await this.waitForCaptchaResolution(site.id);
    }

    const result: CrawlResult = {
      siteId: site.id,
      success: false,
      status: 'captcha',
      message: 'Captcha detected - manual intervention required',
      screenshotPath,
      duration: Date.now() - startTime
    };
    this.emit('siteComplete', site.id, result);
    session.completedSites++;
  }

  private async waitForCaptchaResolution(siteId: string): Promise<void> {
    const maxWaitMs = 30 * 60 * 1000;
    const checkIntervalMs = 5000;
    const startWait = Date.now();

    while (this.pendingCaptchaSites.has(siteId)) {
      if (Date.now() - startWait > maxWaitMs) {
        logger.warn(`Captcha resolution timeout for site ${siteId} after ${maxWaitMs / 60000} minutes, continuing`);
        this.pendingCaptchaSites.delete(siteId);
        break;
      }
      await sleep(checkIntervalMs);
    }

    if (this.isPaused) {
      this.resume();
    }

    logger.info(`Captcha resolved for site ${siteId}, crawl flow continues`);
  }

  resolveCaptcha(siteId: string): void {
    if (this.pendingCaptchaSites.has(siteId)) {
      this.pendingCaptchaSites.delete(siteId);
      logger.info(`Captcha manually resolved for site ${siteId}`);
      this.emit('captchaResolved', siteId);
    }
  }

  getPendingCaptchaSites(): string[] {
    return Array.from(this.pendingCaptchaSites);
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

    try {
      fetcher = new PageFetcher(site);
      const detector = new ChangeDetector(site);
      const parser = new PolicyParser(site);

      const listResult = await fetcher.fetch(site.listUrl);

      if (!listResult.success) {
        if (listResult.captchaDetected) {
          const captchaType = listResult.captchaType || 'unknown';

          if (captchaType === 'slider') {
            logger.getLogger(site.id).info('Slider captcha detected, attempting auto-solve');
            const solved = await fetcher.attemptSliderSolve();
            if (solved) {
              const retryResult = await fetcher.fetch(site.listUrl);
              if (retryResult.success) {
                await this.processListPage(site, fetcher, detector, parser, retryResult.html!, startTime);
                const result: CrawlResult = {
                  siteId: site.id,
                  success: true,
                  status: 'ok',
                  duration: Date.now() - startTime
                };
                return result;
              }
            }
          }

          await this.handleCaptchaIntervention(site, listResult.screenshotPath, captchaType, siteStatus, startTime);
          return {
            siteId: site.id,
            success: false,
            status: 'captcha',
            message: 'Captcha detected - manual intervention required',
            screenshotPath: listResult.screenshotPath,
            duration: Date.now() - startTime
          };
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

      await this.processListPage(site, fetcher, detector, parser, listResult.html!, startTime);

      const result: CrawlResult = {
        siteId: site.id,
        success: true,
        status: 'ok',
        duration: Date.now() - startTime
      };
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

  private loadPreviousListItems(siteId: string, url: string): PolicyListItem[] {
    const latestSnapshot = repository.getLatestListSnapshot(siteId, url);
    if (!latestSnapshot) {
      logger.getLogger(siteId).debug(`No previous list snapshot for ${url}, treating all items as new`);
      return [];
    }

    try {
      const items = JSON.parse(latestSnapshot.itemsJson) as PolicyListItem[];
      logger.getLogger(siteId).debug(
        `Loaded ${items.length} previous list items from snapshot (fetched at ${latestSnapshot.fetchedAt})`
      );
      return items;
    } catch (err) {
      logger.getLogger(siteId).warn(`Failed to parse previous list snapshot: ${(err as Error).message}`);
      return [];
    }
  }

  private saveListItems(siteId: string, url: string, items: PolicyListItem[]): void {
    if (items.length === 0) {
      logger.getLogger(siteId).debug('No list items to save, skipping snapshot');
      return;
    }

    const itemsJson = JSON.stringify(items);
    const itemsHash = md5(itemsJson);

    const previous = repository.getLatestListSnapshot(siteId, url);
    if (previous && previous.itemsHash === itemsHash) {
      logger.getLogger(siteId).debug(`List items unchanged (hash: ${itemsHash}), skipping snapshot save`);
      return;
    }

    const snapshot: ListSnapshot = {
      siteId,
      url,
      itemsJson,
      itemsHash,
      itemCount: items.length,
      fetchedAt: nowIso()
    };

    try {
      repository.insertListSnapshot(snapshot);
      logger.getLogger(siteId).info(
        `List snapshot saved: ${items.length} items, hash: ${itemsHash.slice(0, 8)}...`
      );
    } catch (err) {
      logger.getLogger(siteId).error(`Failed to save list snapshot: ${(err as Error).message}`);
    }
  }

  async retryFailedSites(): Promise<number> {
    if (!this.currentSession) {
      logger.warn('No active session, cannot retry failed sites');
      return 0;
    }

    const MAX_RETRY_ROUNDS = 3;
    const BASE_BACKOFF_MS = 2000;
    let totalRetried = 0;

    for (let round = 1; round <= MAX_RETRY_ROUNDS; round++) {
      const failedSites = this.collectFailedSites();

      if (failedSites.length === 0) {
        if (round === 1) {
          logger.info('No failed sites to retry');
        } else {
          logger.info(`All failed sites recovered after ${round - 1} retry round(s), no more retries needed`);
        }
        break;
      }

      if (round > 1) {
        const backoffMs = exponentialBackoff(round - 1, BASE_BACKOFF_MS);
        logger.info(
          `Retry round ${round}/${MAX_RETRY_ROUNDS}: exponential backoff waiting ${backoffMs}ms ` +
          `before retrying ${failedSites.length} still-failed site(s)`
        );
        await sleep(backoffMs);
      } else {
        logger.info(`Retry round ${round}/${MAX_RETRY_ROUNDS}: retrying ${failedSites.length} failed site(s)`);
      }

      const retriedCount = await this.executeRetryRound(failedSites);
      totalRetried += retriedCount;

      const stillFailed = this.collectFailedSites();
      if (stillFailed.length === 0) {
        logger.info(`All failed sites recovered after retry round ${round}/${MAX_RETRY_ROUNDS}`);
        break;
      } else if (round < MAX_RETRY_ROUNDS) {
        logger.info(`Retry round ${round} completed, ${stillFailed.length} site(s) still failing, will retry`);
      } else {
        logger.warn(
          `Retry round ${round}/${MAX_RETRY_ROUNDS} completed, ${stillFailed.length} site(s) still failing ` +
          `- max retries exhausted, giving up`
        );
      }
    }

    return totalRetried;
  }

  private collectFailedSites(): SiteConfig[] {
    if (!this.currentSession) return [];

    return Array.from(this.currentSession.siteStatuses.values())
      .filter(s => s.status === 'failed' || s.status === 'captcha')
      .map(s => siteRegistry.getSite(s.siteId))
      .filter((s): s is SiteConfig => s !== undefined && s.enabled);
  }

  private async executeRetryRound(failedSites: SiteConfig[]): Promise<number> {
    if (!this.currentSession) return 0;

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

    const grouped = this.groupSitesForParallelism(failedSites);

    if (this.browserPool) {
      const pool = this.browserPool;
      const promises = grouped.map((provinceGroup) =>
        pool.runExclusive(async (worker: BrowserWorker) => {
          for (const site of provinceGroup) {
            await this.crawlSiteWithWorker(site, worker);
          }
        })
      );
      await Promise.all(promises);
    } else {
      for (const group of grouped) {
        for (const site of group) {
          await this.crawlSite(site);
        }
      }
    }

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
      const sites = siteRegistry.getAllSites();
      const result = await this.alertService.sendAlerts(unnotified, sites);
      logger.info(
        `Alerts sent: email ${result.email.sent}, wecom ${result.wecom.sent}` +
        (result.reportFile ? `, report: ${result.reportFile}` : '')
      );
    } catch (err) {
      logger.error(`Failed to send alerts: ${(err as Error).message}`);
    }
  }

  generateReport(): string {
    const changes = repository.getRecentChanges(100);
    const sites = siteRegistry.getAllSites();
    const filepath = this.alertService.exportChangeReportToFile(changes, sites);
    logger.info(`Report generated and exported to: ${filepath}`);
    return filepath;
  }

  async runDataCleanup(): Promise<void> {
    try {
      logger.info('Starting data retention cleanup...');

      const sizeBefore = repository.getDbSizeBytes();
      logger.info(`Database size before cleanup: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB`);

      const retentionResult = repository.cleanupOldData(6);
      logger.info(
        `Retention cleanup: removed ${retentionResult.deletedSnapshots} snapshots, ` +
        `${retentionResult.deletedChanges} change records, ` +
        `${retentionResult.deletedListSnapshots} list snapshots`
      );

      const sizeAfter = repository.getDbSizeBytes();
      logger.info(`Database size after retention cleanup: ${(sizeAfter / 1024 / 1024).toFixed(2)} MB`);

      if (sizeAfter > 2 * 1024 * 1024 * 1024) {
        logger.warn(
          `Database size ${(sizeAfter / 1024 / 1024 / 1024).toFixed(2)} GB exceeds 2GB limit, ` +
          `running additional size enforcement cleanup`
        );
        const sizeResult = repository.enforceSizeLimit(2 * 1024 * 1024 * 1024);
        if (sizeResult.cleaned && sizeResult.result) {
          logger.info(
            `Size enforcement: removed ${sizeResult.result.deletedSnapshots} snapshots, ` +
            `${sizeResult.result.deletedChanges} change records, ` +
            `${sizeResult.result.deletedListSnapshots} list snapshots. ` +
            `Final size: ${(repository.getDbSizeBytes() / 1024 / 1024).toFixed(2)} MB`
          );
        }
      } else {
        logger.info('Database size within 2GB limit, no additional cleanup needed');
      }
    } catch (err) {
      logger.error(`Data cleanup failed: ${(err as Error).message}`);
    }
  }

  setPoolSize(count: number): void {
    this.poolSize = Math.max(1, Math.min(10, count));
    logger.info(`Browser pool size set to ${this.poolSize}`);
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
