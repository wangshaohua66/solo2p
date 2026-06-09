#!/usr/bin/env node

import dotenv from 'dotenv';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

dotenv.config();

import { createLogger } from './utils/logger';
import { taskScheduler, TaskProgress } from './core/taskScheduler';
import { statusSyncManager, SyncReport } from './core/statusSync';
import { reporter } from './utils/reporter';
import { authManager } from './common/authManager';
import { db } from './storage/db';
import type { PlatformType, SKUData, TaskConfig } from '../types';

const logger = createLogger('cli');

const program = new Command();

program
  .name('cpla')
  .description('Cross-Platform Listing Automation System')
  .version('1.0.0');

program
  .command('upload')
  .description('Batch upload SKUs to multiple platforms')
  .option('-f, --file <path>', 'CSV file with SKU data', 'data/sku-source.csv')
  .option('-p, --platforms <platforms>', 'Comma-separated list of platforms')
  .option('-s, --sites <sites>', 'Comma-separated list of sites')
  .option('-b, --batch-size <number>', 'Batch size per platform', '200')
  .option('-c, --concurrency <number>', 'Concurrent browsers per platform', '3')
  .option('-r, --resume <sku>', 'Resume from a specific SKU')
  .option('--no-interactive', 'Run without interactive prompts')
  .action(async (options) => {
    try {
      logger.info('Starting upload command');
      
      let platforms: PlatformType[] = [];
      let interactive = options.interactive !== false;

      if (interactive) {
        const answers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'platforms',
            message: 'Select platforms to upload to:',
            choices: [
              { name: 'Amazon', value: 'amazon' },
              { name: 'eBay', value: 'ebay' },
              { name: 'Shopee', value: 'shopee' },
              { name: 'Lazada', value: 'lazada' },
              { name: 'TikTok Shop', value: 'tiktok' }
            ],
            validate: (input) => input.length > 0 || 'Please select at least one platform'
          }
        ]);
        platforms = answers.platforms;
      } else if (options.platforms) {
        platforms = options.platforms.split(',').map((p: string) => p.trim() as PlatformType);
      } else {
        platforms = ['amazon', 'ebay', 'shopee', 'lazada', 'tiktok'];
      }

      logger.info(`Selected platforms: ${platforms.join(', ')}`);

      const skuList = await parseSKUFile(options.file);
      logger.info(`Loaded ${skuList.length} SKUs from ${options.file}`);

      if (skuList.length === 0) {
        console.log(chalk.yellow('No SKUs found in the file. Exiting.'));
        return;
      }

      const taskConfig: TaskConfig = {
        id: `upload-${Date.now()}`,
        type: 'upload',
        platforms,
        skuFile: options.file,
        batchSize: parseInt(options.batchSize, 10),
        concurrencyPerPlatform: parseInt(options.concurrency, 10),
        resumeFrom: options.resume,
        scheduledAt: Date.now()
      };

      await taskScheduler.initialize(taskConfig);
      await taskScheduler.loadSKUs(skuList, options.resume);

      const progress = taskScheduler.getProgress();
      console.log(chalk.cyan(`\nUpload Summary:`));
      console.log(chalk.white(`  Total tasks: ${progress.total}`));
      console.log(chalk.white(`  Platforms: ${platforms.join(', ')}`));
      console.log(chalk.white(`  Concurrency: ${taskConfig.concurrencyPerPlatform} per platform\n`));

      if (interactive) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'start',
            message: 'Start upload process?',
            default: true
          }
        ]);

        if (!confirm.start) {
          console.log(chalk.yellow('Upload cancelled.'));
          return;
        }
      }

      const spinner = ora('Starting upload process...').start();
      let lastProgress = { ...progress };

      taskScheduler.on('progress', (p: TaskProgress) => {
        const percentage = p.total > 0 ? ((p.completed + p.failed) / p.total * 100).toFixed(1) : '0';
        spinner.text = `Uploading: ${p.completed} completed, ${p.failed} failed, ${p.active} active | ${percentage}%`;
        
        if (p.currentSKU && (lastProgress.currentSKU !== p.currentSKU || lastProgress.currentPlatform !== p.currentPlatform)) {
          console.log(chalk.gray(`\n  → Processing: ${p.currentSKU} on ${p.currentPlatform}`));
          lastProgress = { ...p };
        }
      });

      taskScheduler.on('circuitBreakerOpen', (errorRate: number) => {
        console.log(chalk.red(`\n⚠️  Circuit breaker triggered! Error rate: ${(errorRate * 100).toFixed(1)}%`));
      });

      taskScheduler.on('taskError', (item: any, error: Error) => {
        console.log(chalk.red(`\n  ✗ ${item.sku} on ${item.platform}: ${error.message}`));
      });

      const results = await taskScheduler.start();
      spinner.succeed('Upload process completed!');

      await displayResultsTable(results);

      const htmlReport = await reporter.generateHTMLReport(results, 'Cross-Platform Upload Report');
      const csvReport = await reporter.generateCSVReport(results);

      console.log(chalk.green(`\nReports generated:`));
      console.log(chalk.white(`  HTML: ${htmlReport}`));
      console.log(chalk.white(`  CSV: ${csvReport}`));

      await taskScheduler.close();

    } catch (error) {
      logger.error('Upload command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Sync listing status across all platforms')
  .option('-p, --platform <platform>', 'Sync specific platform only')
  .option('--schedule [cron]', 'Run on schedule (cron expression)')
  .option('--daemon', 'Run as daemon with default schedule')
  .action(async (options) => {
    try {
      logger.info('Starting status sync');

      if (options.daemon || options.schedule) {
        const cronExpr = options.schedule === true ? process.env.STATUS_SYNC_CRON || '0 */2 * * *' : options.schedule;
        console.log(chalk.cyan(`Starting status sync daemon with schedule: ${cronExpr}`));
        
        if (options.platform) {
          statusSyncManager.startSchedule(options.platform as PlatformType, cronExpr);
        } else {
          statusSyncManager.startSchedule();
        }

        console.log(chalk.green('Sync daemon running. Press Ctrl+C to stop.'));
        
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\nStopping sync daemon...'));
          statusSyncManager.stopSchedule();
          await statusSyncManager.close();
          process.exit(0);
        });

        return;
      }

      const spinner = ora('Syncing status across platforms...').start();
      
      let report: SyncReport;
      if (options.platform) {
        const results = await statusSyncManager.syncPlatformStatus(options.platform as PlatformType);
        report = {
          total: results.length,
          changed: results.filter(r => r.changed).length,
          unchanged: results.filter(r => !r.changed && r.newStatus !== 'failed').length,
          failed: results.filter(r => r.newStatus === 'failed').length,
          results,
          startTime: Date.now() - 1000,
          endTime: Date.now()
        };
      } else {
        report = await statusSyncManager.syncAllPlatforms();
      }

      spinner.succeed('Status sync completed!');

      const diff = statusSyncManager.generateDiffReport(report);
      console.log(chalk.gray('\n' + diff));

      const stats = db.getBatchStatusSummary();
      console.log(chalk.cyan('\nOverall Status:'));
      console.log(chalk.white(`  Active: ${stats.byStatus.active}`));
      console.log(chalk.white(`  Under Review: ${stats.byStatus.under_review}`));
      console.log(chalk.white(`  Rejected: ${stats.byStatus.rejected}`));
      console.log(chalk.white(`  Failed: ${stats.byStatus.failed}`));
      console.log(chalk.white(`  Manual Review: ${stats.manualReviewCount}`));
      console.log(chalk.white(`  Success Rate: ${(stats.successRate * 100).toFixed(1)}%`));

      await statusSyncManager.close();

    } catch (error) {
      logger.error('Sync command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current SKU status summary')
  .option('-p, --platform <platform>', 'Filter by platform')
  .option('--sku <sku>', 'Show status for specific SKU')
  .action(async (options) => {
    try {
      if (options.sku) {
        const statuses = db.getAllSKUStatuses(options.sku);
        if (statuses.length === 0) {
          console.log(chalk.yellow(`No status found for SKU: ${options.sku}`));
          return;
        }

        const table = new Table({
          head: ['Platform', 'Site', 'Status', 'Listing ID', 'Last Synced'],
          colWidths: [15, 10, 18, 20, 25]
        });

        for (const s of statuses) {
          table.push([
            s.platform,
            s.site,
            getStatusColor(s.status),
            s.listingId || '-',
            new Date(s.lastSynced).toLocaleString()
          ]);
        }

        console.log(table.toString());
      } else {
        const stats = db.getBatchStatusSummary(options.platform as PlatformType);
        
        console.log(chalk.cyan(`\nStatus Summary ${options.platform ? `(${options.platform})` : '(All Platforms)'}:\n`));

        const table = new Table({
          head: ['Status', 'Count', 'Percentage'],
          colWidths: [20, 10, 15]
        });

        for (const [status, count] of Object.entries(stats.byStatus)) {
          const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) + '%' : '0%';
          table.push([getStatusColor(status as any), count.toString(), percentage]);
        }

        table.push(['Total', stats.total.toString(), '100%']);
        console.log(table.toString());

        console.log(chalk.green(`\nSuccess Rate: ${(stats.successRate * 100).toFixed(1)}%`));
        console.log(chalk.yellow(`Manual Review Queue: ${stats.manualReviewCount}\n`));

        const manualQueue = db.getManualQueue(options.platform as PlatformType);
        if (manualQueue.length > 0) {
          console.log(chalk.yellow('\nManual Review Queue:'));
          const mqTable = new Table({
            head: ['SKU', 'Platform', 'Site', 'Error', 'Created'],
            colWidths: [15, 12, 8, 40, 20]
          });
          
          for (const item of manualQueue.slice(0, 10)) {
            mqTable.push([
              item.sku,
              item.platform,
              item.site,
              item.errorMessage.substring(0, 37) + (item.errorMessage.length > 37 ? '...' : ''),
              new Date(item.createdAt).toLocaleDateString()
            ]);
          }
          
          console.log(mqTable.toString());
          if (manualQueue.length > 10) {
            console.log(chalk.gray(`... and ${manualQueue.length - 10} more`));
          }
        }
      }
    } catch (error) {
      logger.error('Status command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('accounts')
  .description('Manage platform accounts')
  .option('--add', 'Add a new account')
  .option('--list', 'List all accounts')
  .option('--test <platform>', 'Test login for a platform')
  .action(async (options) => {
    try {
      if (options.add) {
        console.log(chalk.yellow('Account encryption must be done using the encrypt-account utility.'));
        console.log(chalk.gray('Run: node dist/utils/encrypt-account.js'));
        return;
      }

      if (options.list) {
        const accounts = authManager.getAllAccounts();
        
        const table = new Table({
          head: ['ID', 'Platform', 'Email', 'Sites', 'Status'],
          colWidths: [15, 12, 25, 20, 12]
        });

        for (const acc of accounts) {
          table.push([
            acc.id,
            acc.platform,
            acc.email,
            acc.sites.join(', '),
            acc.status === 'active' ? chalk.green('Active') : chalk.red(acc.status)
          ]);
        }

        console.log(table.toString());
        return;
      }

      if (options.test) {
        const platform = options.test as PlatformType;
        const account = authManager.getNextAccount(platform);
        
        if (!account) {
          console.log(chalk.red(`No active account found for ${platform}`));
          return;
        }

        const spinner = ora(`Testing login for ${account.email} on ${platform}...`).start();
        
        try {
          const adapter = getAdapterForPlatform(platform);
          const success = await adapter.login(account);
          
          if (success) {
            spinner.succeed(`Login successful! Cookies saved.`);
          } else {
            spinner.fail(`Login failed. Check credentials.`);
          }
          
          await adapter.close();
        } catch (error) {
          spinner.fail(`Login error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      logger.error('Accounts command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate reports')
  .option('--html', 'Generate HTML report')
  .option('--csv', 'Generate CSV report')
  .option('--task <taskId>', 'Report for specific task')
  .action(async (options) => {
    try {
      const statuses = db.getAllSKUStatuses();
      const results = statuses.map(s => ({
        taskId: '',
        sku: s.sku,
        platform: s.platform,
        accountId: '',
        site: s.site,
        status: s.status,
        listingId: s.listingId || undefined,
        listingUrl: s.listingUrl || undefined,
        errorMessage: s.errorMessage || undefined,
        rejectReason: s.rejectReason || undefined,
        startedAt: s.lastSynced,
        completedAt: s.lastSynced,
        retryCount: s.retryCount
      }));

      if (options.html || (!options.html && !options.csv)) {
        const htmlReport = await reporter.generateHTMLReport(results, 'Inventory Status Report');
        console.log(chalk.green(`HTML report: ${htmlReport}`));
      }

      if (options.csv) {
        const csvReport = await reporter.generateCSVReport(results);
        console.log(chalk.green(`CSV report: ${csvReport}`));
      }
    } catch (error) {
      logger.error('Report command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

function getStatusColor(status: string): string {
  const colors: Record<string, (s: string) => string> = {
    active: chalk.green,
    under_review: chalk.yellow,
    rejected: chalk.red,
    failed: chalk.red,
    pending: chalk.gray,
    uploading: chalk.blue,
    manual_review: chalk.magenta
  };
  return colors[status] ? colors[status](status.replace('_', ' ')) : status;
}

function getAdapterForPlatform(platform: PlatformType) {
  switch (platform) {
    case 'amazon': return require('./platforms/amazon').amazonAdapter;
    case 'ebay': return require('./platforms/ebay').ebayAdapter;
    case 'shopee': return require('./platforms/shopee').shopeeAdapter;
    case 'lazada': return require('./platforms/lazada').lazadaAdapter;
    case 'tiktok': return require('./platforms/tiktok').tiktokAdapter;
    default: throw new Error(`Unknown platform: ${platform}`);
  }
}

async function parseSKUFile(filePath: string): Promise<SKUData[]> {
  const results: SKUData[] = [];
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`SKU file not found: ${fullPath}`);
  }

  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const stream = fs.createReadStream(fullPath);
    stream.pipe(parser);

    parser.on('data', (row: any) => {
      try {
        const sku: SKUData = {
          sku: row.sku || row.SKU,
          title: {
            en: row.title_en || row.title || '',
            es: row.title_es || undefined,
            pt: row.title_pt || undefined,
            id: row.title_id || undefined
          },
          description: {
            en: row.description_en || row.description || '',
            es: row.description_es || undefined,
            pt: row.description_pt || undefined,
            id: row.description_id || undefined
          },
          images: (row.images || row.image_urls || '').split('|').filter(Boolean),
          video: row.video || undefined,
          prices: parsePriceMap(row.prices || row.price || '{}'),
          inventory: parseInventoryMap(row.inventory || row.stock || '{}'),
          category: row.category || undefined,
          brand: row.brand || undefined,
          weight: row.weight ? parseFloat(row.weight) : undefined,
          dimensions: row.dimensions ? parseDimensions(row.dimensions) : undefined
        };

        if (sku.sku && sku.title.en) {
          results.push(sku);
        }
      } catch (e) {
        logger.warn('Skipping invalid SKU row', { row, error: e });
      }
    });

    parser.on('end', () => resolve(results));
    parser.on('error', reject);
  });
}

function parsePriceMap(str: string): Record<string, number> {
  try {
    if (str.startsWith('{') && str.endsWith('}')) {
      return JSON.parse(str);
    }
    const result: Record<string, number> = {};
    str.split(',').forEach(pair => {
      const [site, price] = pair.split(':').map(s => s.trim());
      if (site && price) {
        result[site] = parseFloat(price);
      }
    });
    return result;
  } catch {
    return { US: 0 };
  }
}

function parseInventoryMap(str: string): Record<string, number> {
  try {
    if (str.startsWith('{') && str.endsWith('}')) {
      return JSON.parse(str);
    }
    const result: Record<string, number> = {};
    str.split(',').forEach(pair => {
      const [site, qty] = pair.split(':').map(s => s.trim());
      if (site && qty) {
        result[site] = parseInt(qty, 10);
      }
    });
    return result;
  } catch {
    return { US: 0 };
  }
}

function parseDimensions(str: string): { length: number; width: number; height: number } | undefined {
  try {
    const parts = str.split('x').map(s => parseFloat(s.trim()));
    if (parts.length === 3) {
      return { length: parts[0], width: parts[1], height: parts[2] };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function displayResultsTable(results: any[]): Promise<void> {
  const table = new Table({
    head: ['SKU', 'Platform', 'Site', 'Status', 'Listing ID'],
    colWidths: [15, 12, 8, 18, 22]
  });

  for (const r of results) {
    table.push([
      r.sku,
      r.platform,
      r.site,
      getStatusColor(r.status),
      r.listingId || '-'
    ]);
  }

  console.log('\n' + table.toString());

  const success = results.filter(r => r.status === 'active' || r.status === 'under_review').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'rejected').length;
  const successRate = results.length > 0 ? ((success / results.length) * 100).toFixed(1) : '0';

  console.log(chalk.cyan(`\nSuccess: ${success} | Failed: ${failed} | Success Rate: ${successRate}%`));
}

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nGracefully shutting down...'));
  try {
    await taskScheduler.close();
    await statusSyncManager.close();
    db.close();
  } catch (e) {
    logger.error('Error during shutdown', e);
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', { promise, reason });
  console.log(chalk.red('Unhandled promise rejection. Check logs for details.'));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.log(chalk.red(`Uncaught exception: ${error.message}`));
  process.exit(1);
});

if (require.main === module) {
  const startTime = Date.now();
  logger.info('Cross-Platform Listing Automation started');
  
  program.parseAsync(process.argv)
    .then(() => {
      const elapsed = Date.now() - startTime;
      logger.info(`Command completed in ${elapsed}ms`);
    })
    .catch((error) => {
      logger.error('Command failed', error);
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    });
}

export { program };
