import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { SiteConfig } from '../types';
import logger from '../utils/logger';
import repository from '../storage/repository';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'sites.json');

export class SiteRegistry {
  private sites: Map<string, SiteConfig> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  private onConfigChangeCallbacks: Array<(sites: SiteConfig[]) => void> = [];

  constructor() {
    this.loadFromFile();
    this.setupWatcher();
  }

  private loadFromFile(): void {
    try {
      if (!fs.existsSync(CONFIG_PATH)) {
        logger.warn('Site config file not found, using empty registry');
        return;
      }
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const configs: SiteConfig[] = JSON.parse(raw);
      this.sites.clear();
      for (const config of configs) {
        this.sites.set(config.id, config);
        repository.insertSiteConfig(config);
      }
      logger.info(`Loaded ${this.sites.size} site configurations from file`);
    } catch (err) {
      logger.error(`Failed to load site config: ${(err as Error).message}`);
    }
  }

  private setupWatcher(): void {
    this.watcher = chokidar.watch(CONFIG_PATH, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher.on('change', () => {
      logger.info('Site config file changed, reloading...');
      const prevCount = this.sites.size;
      this.loadFromFile();
      const newCount = this.sites.size;

      repository.insertAuditLog('config_reload', {
        prevCount,
        newCount,
        timestamp: new Date().toISOString()
      });

      for (const cb of this.onConfigChangeCallbacks) {
        try {
          cb(this.getAllSites());
        } catch (err) {
          logger.error(`Config change callback error: ${(err as Error).message}`);
        }
      }
    });

    logger.info('Config file watcher started');
  }

  onConfigChange(callback: (sites: SiteConfig[]) => void): void {
    this.onConfigChangeCallbacks.push(callback);
  }

  getSite(siteId: string): SiteConfig | undefined {
    return this.sites.get(siteId);
  }

  getAllSites(): SiteConfig[] {
    return Array.from(this.sites.values());
  }

  getEnabledSites(): SiteConfig[] {
    return this.getAllSites().filter(s => s.enabled);
  }

  getSitesByProvince(province: string): SiteConfig[] {
    return this.getEnabledSites().filter(s => s.province === province);
  }

  getSitesByCategory(category: SiteConfig['category']): SiteConfig[] {
    return this.getEnabledSites().filter(s => s.category === category);
  }

  getProvinces(): string[] {
    const provinces = new Set(this.getEnabledSites().map(s => s.province));
    return Array.from(provinces).sort();
  }

  groupByProvince(): Map<string, SiteConfig[]> {
    const groups = new Map<string, SiteConfig[]>();
    for (const site of this.getEnabledSites()) {
      if (!groups.has(site.province)) {
        groups.set(site.province, []);
      }
      groups.get(site.province)!.push(site);
    }
    return groups;
  }

  getSiteCount(): number {
    return this.sites.size;
  }

  addSite(config: SiteConfig): void {
    this.sites.set(config.id, config);
    repository.insertSiteConfig(config);
    this.saveToFile();
    repository.insertAuditLog('site_add', { siteId: config.id });
    logger.info(`Site added: ${config.id}`);
  }

  updateSite(config: SiteConfig): void {
    const exists = this.sites.has(config.id);
    this.sites.set(config.id, config);
    repository.insertSiteConfig(config);
    this.saveToFile();
    repository.insertAuditLog(exists ? 'site_update' : 'site_add', { siteId: config.id });
    logger.info(`Site ${exists ? 'updated' : 'added'}: ${config.id}`);
  }

  removeSite(siteId: string): boolean {
    const removed = this.sites.delete(siteId);
    if (removed) {
      this.saveToFile();
      repository.insertAuditLog('site_remove', { siteId });
      logger.info(`Site removed: ${siteId}`);
    }
    return removed;
  }

  private saveToFile(): void {
    const configs = this.getAllSites();
    try {
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(configs, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save site config: ${(err as Error).message}`);
    }
  }

  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('Config file watcher stopped');
    }
  }
}

export const siteRegistry = new SiteRegistry();
export default siteRegistry;
