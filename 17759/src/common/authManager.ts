import fs from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';
import totpGenerator from 'totp-generator';
import * as base32 from 'hi-base32';
import dotenv from 'dotenv';
import Joi from 'joi';
import chokidar from 'chokidar';
import { createLogger } from '../utils/logger';
import { db } from '../storage/db';
import type { PlatformType, PlatformAccount } from '../../types';

dotenv.config();

const logger = createLogger('authManager');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const ACCOUNTS_FILE = path.join(process.cwd(), 'config', 'accounts.json');

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  logger.warn('ENCRYPTION_KEY is not set or too short. Data will not be properly encrypted.');
}

function encrypt(data: string): string {
  if (!ENCRYPTION_KEY) return data;
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

function decrypt(encryptedData: string): string {
  if (!ENCRYPTION_KEY) return encryptedData;
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

const accountSchema = Joi.object({
  id: Joi.string().required(),
  platform: Joi.string().valid('amazon', 'ebay', 'shopee', 'lazada', 'tiktok').required(),
  email: Joi.string().email().required(),
  encryptedPassword: Joi.string().required(),
  encryptedTotpSeed: Joi.string().optional(),
  sites: Joi.array().items(Joi.string()).min(1).required(),
  status: Joi.string().valid('active', 'suspended', 'maintenance').required(),
  lastLogin: Joi.number().optional(),
  cookieExpiry: Joi.number().optional()
});

const accountsFileSchema = Joi.object({
  version: Joi.string().required(),
  lastUpdated: Joi.number().required(),
  accounts: Joi.array().items(accountSchema).required()
});

interface AccountsFile {
  version: string;
  lastUpdated: number;
  accounts: PlatformAccount[];
}

class AuthManager {
  private accounts: Map<string, PlatformAccount> = new Map();
  private accountPool: Map<PlatformType, string[]> = new Map();
  private roundRobinIndex: Map<PlatformType, number> = new Map();
  private watcher: chokidar.FSWatcher | null = null;
  private lastLoadTime: number = 0;
  private watcherRetryCount: number = 0;
  private maxWatcherRetries: number = 5;
  private watcherRebuildInProgress: boolean = false;

  constructor() {
    this.loadAccounts();
    this.setupFileWatcher();
  }

  private loadAccounts(): void {
    try {
      if (!fs.existsSync(ACCOUNTS_FILE)) {
        logger.warn('Accounts file not found, creating empty structure');
        this.saveAccounts({
          version: '1.0',
          lastUpdated: Date.now(),
          accounts: []
        });
        return;
      }

      const rawContent = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const data = JSON.parse(rawContent) as AccountsFile;

      const { error } = accountsFileSchema.validate(data);
      if (error) {
        logger.error('Accounts file validation failed', error);
        this.backupAndRestore(data);
        return;
      }

      this.accounts.clear();
      this.accountPool.clear();
      this.roundRobinIndex.clear();

      for (const account of data.accounts) {
        this.accounts.set(account.id, account);
        
        if (account.status === 'active') {
          if (!this.accountPool.has(account.platform)) {
            this.accountPool.set(account.platform, []);
            this.roundRobinIndex.set(account.platform, 0);
          }
          this.accountPool.get(account.platform)!.push(account.id);
        }
      }

      this.lastLoadTime = Date.now();
      logger.info(`Loaded ${this.accounts.size} accounts across ${this.accountPool.size} platforms`);
    } catch (error) {
      logger.error('Failed to load accounts', error);
    }
  }

  private setupFileWatcher(): void {
    if (this.watcher) return;

    if (!fs.existsSync(ACCOUNTS_FILE)) {
      logger.warn(`Accounts file not found at ${ACCOUNTS_FILE}, watcher setup deferred`);
      return;
    }

    this.tryCreateWatcher();
  }

  private tryCreateWatcher(attempt = 1): void {
    if (this.watcherRebuildInProgress) {
      logger.debug('Watcher rebuild already in progress, skipping');
      return;
    }

    try {
      this.watcherRebuildInProgress = true;

      if (this.watcher) {
        this.watcher.close().catch(() => {});
        this.watcher = null;
      }

      const watcher = chokidar.watch(ACCOUNTS_FILE, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100
        },
        usePolling: attempt > 2
      });

      watcher.on('ready', () => {
        this.watcher = watcher;
        this.watcherRetryCount = 0;
        this.watcherRebuildInProgress = false;
        logger.info('Accounts file watcher initialized successfully');
      });

      watcher.on('change', () => {
        const now = Date.now();
        if (now - this.lastLoadTime < 2000) {
          return;
        }
        this.lastLoadTime = now;
        
        logger.info('Accounts file changed, hot reloading...');
        this.backupCurrent();
        this.loadAccounts();
      });

      watcher.on('error', (error) => {
        logger.error('Accounts file watcher error, will attempt to rebuild', error);
        this.scheduleWatcherRebuild();
      });

      watcher.on('unlink', () => {
        logger.warn('Accounts file was deleted, watcher will attempt to reattach');
        this.scheduleWatcherRebuild();
      });

      setTimeout(() => {
        if (!this.watcher && attempt < this.maxWatcherRetries) {
          logger.warn(`Watcher not ready after 2s, retrying (attempt ${attempt}/${this.maxWatcherRetries})`);
          this.watcherRebuildInProgress = false;
          setTimeout(() => this.tryCreateWatcher(attempt + 1), attempt * 2000);
        } else if (!this.watcher) {
          this.watcherRebuildInProgress = false;
          logger.error(`Failed to initialize watcher after ${this.maxWatcherRetries} attempts`);
        }
      }, 2000);

    } catch (error) {
      this.watcherRebuildInProgress = false;
      logger.error(`Failed to create watcher (attempt ${attempt}/${this.maxWatcherRetries})`, error);
      
      if (attempt < this.maxWatcherRetries) {
        const delay = Math.min(attempt * 2000, 30000);
        logger.info(`Retrying watcher setup in ${delay}ms`);
        setTimeout(() => this.tryCreateWatcher(attempt + 1), delay);
      } else {
        logger.error('Max watcher setup attempts exceeded, giving up');
      }
    }
  }

  private scheduleWatcherRebuild(): void {
    if (this.watcherRebuildInProgress) {
      return;
    }

    this.watcherRetryCount++;
    
    if (this.watcherRetryCount > this.maxWatcherRetries * 2) {
      logger.error('Too many watcher failures, stopping automatic rebuild');
      return;
    }

    const delay = Math.min(this.watcherRetryCount * 5000, 60000);
    logger.info(`Scheduling watcher rebuild in ${delay}ms (retry ${this.watcherRetryCount})`);
    
    setTimeout(() => {
      this.tryCreateWatcher(1);
    }, delay);
  }

  async close(): Promise<void> {
    if (this.watcher) {
      try {
        await this.watcher.close();
      } catch (e) {
        logger.warn('Error closing file watcher', e);
      }
      this.watcher = null;
      logger.info('Auth manager watcher closed');
    }
  }

  private backupCurrent(): void {
    try {
      if (!fs.existsSync(ACCOUNTS_FILE)) return;
      
      const content = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
      const data = JSON.parse(content) as AccountsFile;
      
      db.saveConfigBackup('accounts', content, data.version);
      logger.debug('Accounts file backed up to database');
    } catch (error) {
      logger.error('Failed to backup accounts file', error);
    }
  }

  private backupAndRestore(invalidData: AccountsFile): void {
    logger.warn('Attempting to restore from backup...');
    
    const backups = db.getConfigBackups('accounts', 1);
    if (backups.length > 0) {
      try {
        const rawResult = db.getRawDB()
          .prepare('SELECT content FROM config_backups WHERE id = ?')
          .get(backups[0].id) as { content: string };
        const backupContent = JSON.parse(rawResult.content) as AccountsFile;
        
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(backupContent, null, 2));
        logger.info('Restored accounts file from backup');
        this.loadAccounts();
      } catch (restoreError) {
        logger.error('Failed to restore from backup', restoreError);
      }
    }
  }

  private saveAccounts(data: AccountsFile): void {
    try {
      const dir = path.dirname(ACCOUNTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Failed to save accounts file', error);
    }
  }

  encryptValue(plaintext: string): string {
    return encrypt(plaintext);
  }

  decryptValue(ciphertext: string): string {
    return decrypt(ciphertext);
  }

  getAccount(accountId: string): PlatformAccount | undefined {
    return this.accounts.get(accountId);
  }

  getAccountsByPlatform(platform: PlatformType, activeOnly = true): PlatformAccount[] {
    const accounts: PlatformAccount[] = [];
    for (const account of this.accounts.values()) {
      if (account.platform === platform) {
        if (!activeOnly || account.status === 'active') {
          accounts.push(account);
        }
      }
    }
    return accounts;
  }

  getNextAccount(platform: PlatformType, excludeAccountId?: string): PlatformAccount | null {
    const pool = this.accountPool.get(platform);
    if (!pool || pool.length === 0) {
      logger.warn(`No active accounts available for platform: ${platform}`);
      return null;
    }

    let availablePool = pool;
    if (excludeAccountId) {
      availablePool = pool.filter(id => id !== excludeAccountId);
      if (availablePool.length === 0) {
        logger.warn(`No fallback accounts available for platform: ${platform}`);
        return null;
      }
    }

    const currentIndex = this.roundRobinIndex.get(platform) || 0;
    const accountIndex = currentIndex % availablePool.length;
    const accountId = availablePool[accountIndex];
    
    if (!excludeAccountId) {
      this.roundRobinIndex.set(platform, (currentIndex + 1) % pool.length);
    }

    const account = this.accounts.get(accountId);
    if (!account || account.status !== 'active') {
      return this.getNextAccount(platform, accountId);
    }

    logger.debug(`Selected account ${accountId} for ${platform} (round-robin index: ${accountIndex})`);
    return account;
  }

  getAccountPassword(accountId: string): string | null {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    return decrypt(account.encryptedPassword);
  }

  generateTOTP(accountId: string): string | null {
    const account = this.accounts.get(accountId);
    if (!account || !account.encryptedTotpSeed) return null;

    try {
      const seed = decrypt(account.encryptedTotpSeed);
      const token = totpGenerator(seed, {
        digits: 6,
        algorithm: 'SHA-1',
        period: 30
      });
      logger.debug(`Generated TOTP for account ${accountId}`);
      return token;
    } catch (error) {
      logger.error(`Failed to generate TOTP for account ${accountId}`, error);
      return null;
    }
  }

  generateTOTPFromSeed(seed: string): string {
    return totpGenerator(seed, {
      digits: 6,
      algorithm: 'SHA-1',
      period: 30
    });
  }

  generateTOTPSeed(): { seed: string; base32Seed: string } {
    const buffer = CryptoJS.lib.WordArray.random(20);
    const seed = buffer.toString(CryptoJS.enc.Hex);
    const base32Seed = base32.encode(buffer.toString(CryptoJS.enc.Latin1)).replace(/=/g, '');
    return { seed, base32Seed };
  }

  saveCookies(accountId: string, platform: PlatformType, cookies: unknown[], ttlMs = 24 * 60 * 60 * 1000): void {
    const encryptedCookies = encrypt(JSON.stringify(cookies));
    const expiresAt = Date.now() + ttlMs;
    
    db.saveCookie(accountId, platform, encryptedCookies, expiresAt);
    
    const account = this.accounts.get(accountId);
    if (account) {
      account.lastLogin = Date.now();
      account.cookieExpiry = expiresAt;
    }
    
    logger.info(`Saved cookies for account ${accountId}, expires in ${Math.round(ttlMs / 3600000)}h`);
  }

  getCookies(accountId: string): unknown[] | null {
    const cookieRecord = db.getCookie(accountId);
    if (!cookieRecord) {
      logger.debug(`No valid cookies found for account ${accountId}`);
      return null;
    }

    try {
      const decrypted = decrypt(cookieRecord.cookies);
      const cookies = JSON.parse(decrypted) as unknown[];
      logger.debug(`Loaded ${cookies.length} cookies for account ${accountId}`);
      return cookies;
    } catch (error) {
      logger.error(`Failed to parse cookies for account ${accountId}`, error);
      db.deleteCookie(accountId);
      return null;
    }
  }

  areCookiesValid(accountId: string): boolean {
    return db.isCookieValid(accountId);
  }

  clearCookies(accountId: string): void {
    db.deleteCookie(accountId);
    logger.info(`Cleared cookies for account ${accountId}`);
  }

  shouldRenewCookies(accountId: string, thresholdMs = 60 * 60 * 1000): boolean {
    const cookieRecord = db.getCookie(accountId);
    if (!cookieRecord) return true;
    return cookieRecord.expiresAt - Date.now() < thresholdMs;
  }

  updateAccountStatus(accountId: string, status: PlatformAccount['status']): void {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn(`Account ${accountId} not found for status update`);
      return;
    }

    account.status = status;
    this.persistAccounts();
    logger.info(`Updated account ${accountId} status to ${status}`);

    if (status !== 'active') {
      const pool = this.accountPool.get(account.platform);
      if (pool) {
        const idx = pool.indexOf(accountId);
        if (idx !== -1) {
          pool.splice(idx, 1);
        }
      }
    } else {
      if (!this.accountPool.has(account.platform)) {
        this.accountPool.set(account.platform, []);
        this.roundRobinIndex.set(account.platform, 0);
      }
      if (!this.accountPool.get(account.platform)!.includes(accountId)) {
        this.accountPool.get(account.platform)!.push(accountId);
      }
    }
  }

  addAccount(account: Omit<PlatformAccount, 'id'> & { id?: string }, plaintextPassword: string, totpSeed?: string): PlatformAccount {
    const id = account.id || `${account.platform}-${Date.now()}`;
    
    const newAccount: PlatformAccount = {
      ...account,
      id,
      encryptedPassword: encrypt(plaintextPassword),
      encryptedTotpSeed: totpSeed ? encrypt(totpSeed) : undefined
    };

    const { error } = accountSchema.validate(newAccount);
    if (error) {
      throw new Error(`Invalid account data: ${error.message}`);
    }

    this.accounts.set(id, newAccount);
    
    if (newAccount.status === 'active') {
      if (!this.accountPool.has(account.platform)) {
        this.accountPool.set(account.platform, []);
        this.roundRobinIndex.set(account.platform, 0);
      }
      this.accountPool.get(account.platform)!.push(id);
    }

    this.persistAccounts();
    logger.info(`Added new account ${id} for ${account.platform}`);
    return newAccount;
  }

  removeAccount(accountId: string): boolean {
    const account = this.accounts.get(accountId);
    if (!account) return false;

    this.accounts.delete(accountId);
    
    const pool = this.accountPool.get(account.platform);
    if (pool) {
      const idx = pool.indexOf(accountId);
      if (idx !== -1) pool.splice(idx, 1);
    }

    this.clearCookies(accountId);
    this.persistAccounts();
    logger.info(`Removed account ${accountId}`);
    return true;
  }

  private persistAccounts(): void {
    const data: AccountsFile = {
      version: '1.0',
      lastUpdated: Date.now(),
      accounts: Array.from(this.accounts.values())
    };
    this.saveAccounts(data);
  }

  getAccountCount(platform?: PlatformType): { total: number; active: number } {
    let total = 0;
    let active = 0;
    
    for (const account of this.accounts.values()) {
      if (!platform || account.platform === platform) {
        total++;
        if (account.status === 'active') active++;
      }
    }
    
    return { total, active };
  }

  getAllAccounts(): PlatformAccount[] {
    return Array.from(this.accounts.values());
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.accounts.size === 0) {
      errors.push('No accounts configured');
    }

    for (const [id, account] of this.accounts) {
      if (account.sites.length === 0) {
        errors.push(`Account ${id} has no sites configured`);
      }
      if (!account.encryptedPassword) {
        errors.push(`Account ${id} has no password`);
      }
    }

    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
      errors.push('ENCRYPTION_KEY is not properly configured (min 32 chars)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

}

export const authManager = new AuthManager();

export default AuthManager;
