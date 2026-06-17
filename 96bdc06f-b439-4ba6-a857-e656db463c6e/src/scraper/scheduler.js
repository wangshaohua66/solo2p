const cron = require('node-cron');
const moment = require('moment');
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const { getLogger } = require('../logger/appLogger');
const { getConfig, getClientTrademarks } = require('../config');
const { fetchLatestAnnouncements } = require('./announcer');
const { extractPDF } = require('../parser/pdfExtractor');
const { matchTrademarks } = require('../matcher/trademarkMatcher');
const { 
  saveTrademarks, 
  saveMatchResults, 
  syncClientTrademarks,
  getPendingAnnouncements,
  getAllClientTrademarks,
  updateAnnouncementStatus,
  getTrademarksByAnnouncementId,
  getOppositionDeadlines,
  logProcessing,
  saveAnnouncement
} = require('../store/database');

const logger = getLogger();

class TaskScheduler {
  constructor(options = {}) {
    const config = getConfig('scheduler', {});
    this.cronExpression = options.cronExpression || config.cronExpression || '0 0 2 * * 1';
    this.concurrency = options.concurrency || config.concurrency || 5;
    this.batchSize = options.batchSize || config.batchSize || 100;
    this.runOnStartup = options.runOnStartup !== undefined 
      ? options.runOnStartup 
      : config.runOnStartup !== false;
    
    this.tasks = new Map();
    this.isRunning = false;
  }

  start() {
    logger.info('Starting task scheduler', { cronExpression: this.cronExpression });
    
    const task = cron.schedule(this.cronExpression, () => {
      this.runFullPipeline().catch(error => {
        logger.error('Scheduled pipeline failed', { error: error.message });
      });
    }, {
      scheduled: true,
      timezone: getConfig('system.timezone', 'Asia/Shanghai')
    });
    
    this.tasks.set('main', task);
    
    this.startOppositionChecker();
    
    if (this.runOnStartup) {
      logger.info('Running initial pipeline on startup');
      setTimeout(() => this.runFullPipeline(), 5000);
    }
    
    logger.info('Task scheduler started successfully');
    
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    logger.info('Stopping task scheduler');
    this.tasks.forEach((task, name) => {
      if (task && task.stop) {
        task.stop();
      }
    });
    this.tasks.clear();
    this.isRunning = false;
    logger.info('Task scheduler stopped');
  }

  startOppositionChecker() {
    const task = cron.schedule('0 0 9 * * *', () => {
      this.checkOppositionDeadlines().catch(error => {
        logger.error('Opposition deadline check failed', { error: error.message });
      });
    }, {
      scheduled: true,
      timezone: getConfig('system.timezone', 'Asia/Shanghai')
    });
    this.tasks.set('opposition', task);
    logger.info('Opposition deadline checker scheduled');
  }

  async checkOppositionDeadlines() {
    logger.info('Checking opposition deadlines');
    
    const deadlines = await getOppositionDeadlines(30);
    const urgentDeadlines = [];
    
    for (const deadline of deadlines) {
      const daysRemaining = Math.ceil(deadline.days_remaining);
      
      if (daysRemaining === 30 || daysRemaining === 15 || daysRemaining === 7 || daysRemaining <= 3) {
        urgentDeadlines.push({
          ...deadline,
          daysRemaining,
          urgency: daysRemaining <= 3 ? 'critical' : 
                   daysRemaining <= 7 ? 'high' : 
                   daysRemaining <= 15 ? 'medium' : 'low'
        });
      }
    }
    
    logger.info(`Found ${urgentDeadlines.length} urgent opposition deadlines`, {
      critical: urgentDeadlines.filter(d => d.urgency === 'critical').length,
      high: urgentDeadlines.filter(d => d.urgency === 'high').length,
      medium: urgentDeadlines.filter(d => d.urgency === 'medium').length
    });
    
    return urgentDeadlines;
  }

  async runFullPipeline() {
    if (this.isRunning) {
      logger.warn('Pipeline already running, skipping this run');
      return;
    }
    
    this.isRunning = true;
    const pipelineStart = Date.now();
    
    try {
      logger.info('='.repeat(60));
      logger.info('Starting full processing pipeline');
      logger.info('='.repeat(60));
      
      await this.syncClientData();
      
      const fetchResult = await this.fetchAnnouncements();
      
      const pendingAnnouncements = await getPendingAnnouncements();
      
      const processResults = [];
      for (const announcement of pendingAnnouncements) {
        const result = await this.processSingleAnnouncement(announcement);
        processResults.push(result);
      }
      
      const matchResults = [];
      for (const result of processResults) {
        if (result.success && result.announcementId) {
          const matchResult = await this.runMatching(result.announcementId);
          matchResults.push(matchResult);
        }
      }
      
      const duration = Date.now() - pipelineStart;
      logger.info('='.repeat(60));
      logger.info('Pipeline completed', {
        durationMs: duration,
        fetched: fetchResult?.totalFound || 0,
        processed: processResults.filter(r => r.success).length,
        totalMatches: matchResults.reduce((sum, r) => sum + (r?.matches?.length || 0), 0)
      });
      logger.info('='.repeat(60));
      
      return {
        success: true,
        durationMs: duration,
        fetchResult,
        processResults,
        matchResults
      };
      
    } catch (error) {
      const duration = Date.now() - pipelineStart;
      logger.error('Pipeline failed', { error: error.message, durationMs: duration });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async syncClientData() {
    logger.info('Syncing client trademark data');
    const clientTrademarks = getClientTrademarks();
    await syncClientTrademarks(clientTrademarks);
    logger.info(`Synced ${clientTrademarks.length} client trademarks`);
    return clientTrademarks.length;
  }

  async fetchAnnouncements(options = {}) {
    logger.info('Step 1: Fetching latest announcements');
    
    const progressBar = new cliProgress.SingleBar({
      format: `${chalk.cyan('抓取公告')} [{bar}] {percentage}% | {value}/{total} 期`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    try {
      progressBar.start(1, 0);
      const result = await fetchLatestAnnouncements({
        maxPages: options.maxPages || 5
      });
      progressBar.update(1);
      progressBar.stop();
      
      if (result.success) {
        console.log(chalk.green(`✓ 成功发现 ${result.totalFound} 期新公告，已下载 ${result.processedSuccessfully} 期`));
      } else {
        console.log(chalk.yellow('⚠ 公告抓取未发现新数据'));
      }
      
      return result;
      
    } catch (error) {
      progressBar.stop();
      logger.error('Fetch announcements failed', { error: error.message });
      throw error;
    }
  }

  async processSingleAnnouncement(announcement) {
    const startTime = Date.now();
    const annNumber = announcement.announcement_number;
    
    logger.info(`Processing announcement: ${annNumber}`);
    console.log(chalk.cyan(`\n处理公告: ${annNumber}`));
    
    try {
      await updateAnnouncementStatus(annNumber, 'processing');
      
      let pdfPaths = [];
      try {
        pdfPaths = JSON.parse(announcement.download_path || '[]');
      } catch (e) {
        pdfPaths = announcement.download_path ? [announcement.download_path] : [];
      }
      
      if (pdfPaths.length === 0) {
        throw new Error('No PDF files available for processing');
      }
      
      const progressBar = new cliProgress.SingleBar({
        format: `${chalk.cyan('解析PDF')} [{bar}] {percentage}% | {value}/{total} 个文件`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      
      progressBar.start(pdfPaths.length, 0);
      
      const allTrademarks = [];
      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];
        const extractResult = await extractPDF(pdfPath);
        
        if (extractResult.success) {
          allTrademarks.push(...extractResult.trademarks);
        } else {
          logger.warn(`PDF extraction failed for ${pdfPath}`, { error: extractResult.error });
        }
        
        progressBar.update(i + 1);
      }
      
      progressBar.stop();
      
      if (allTrademarks.length === 0) {
        throw new Error('No trademarks extracted from PDFs');
      }
      
      console.log(chalk.cyan(`  保存商标数据...`));
      const savedCount = await saveTrademarks(allTrademarks, announcement.id);
      
      await saveAnnouncement({
        ...announcement,
        status: 'processed',
        total_trademarks: savedCount
      });
      
      const duration = Date.now() - startTime;
      await logProcessing(annNumber, 'process', 'success', savedCount, duration);
      
      console.log(chalk.green(`✓ 公告 ${annNumber} 处理完成，提取 ${savedCount} 条商标，耗时 ${(duration / 1000).toFixed(1)}s`));
      
      return {
        success: true,
        announcementId: announcement.id,
        announcementNumber: annNumber,
        trademarksCount: savedCount,
        durationMs: duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to process announcement ${annNumber}`, { error: error.message });
      
      await updateAnnouncementStatus(annNumber, 'failed', error.message);
      await logProcessing(annNumber, 'process', 'failed', 0, duration, error.message);
      
      console.log(chalk.red(`✗ 公告 ${annNumber} 处理失败: ${error.message}`));
      
      return {
        success: false,
        announcementNumber: annNumber,
        error: error.message,
        durationMs: duration
      };
    }
  }

  async runMatching(announcementId) {
    const startTime = Date.now();
    logger.info(`Step 3: Running trademark matching for announcement ${announcementId}`);
    
    try {
      const trademarks = await getTrademarksByAnnouncementId(announcementId);
      const clientTrademarks = await getAllClientTrademarks();
      
      if (trademarks.length === 0) {
        logger.warn('No trademarks to match');
        return { success: true, matches: [] };
      }
      
      console.log(chalk.cyan(`\n商标匹配: ${trademarks.length} 条公告商标 vs ${clientTrademarks.length} 条客户商标`));
      
      const progressBar = new cliProgress.SingleBar({
        format: `${chalk.cyan('匹配进度')} [{bar}] {percentage}% | {value}/{total} 条`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      
      progressBar.start(trademarks.length, 0);
      
      const batchSize = this.batchSize;
      const allMatches = [];
      
      for (let i = 0; i < trademarks.length; i += batchSize) {
        const batch = trademarks.slice(i, i + batchSize);
        const result = await matchTrademarks(batch, clientTrademarks);
        
        if (result.matches.length > 0) {
          const cleanMatches = result.matches.map(m => ({
            ...m,
            trademarkId: m.trademarkId || m.trademarkData?.id,
            clientTrademarkId: m.clientTrademarkId || m.clientTrademarkData?.id
          })).filter(m => m.trademarkId && m.clientTrademarkId);
          
          if (cleanMatches.length > 0) {
            await saveMatchResults(cleanMatches);
            allMatches.push(...cleanMatches);
          }
        }
        
        progressBar.update(Math.min(i + batchSize, trademarks.length));
      }
      
      progressBar.stop();
      
      const duration = Date.now() - startTime;
      
      const stats = {
        high: allMatches.filter(m => m.riskLevel === 'high').length,
        medium: allMatches.filter(m => m.riskLevel === 'medium').length,
        low: allMatches.filter(m => m.riskLevel === 'low').length
      };
      
      console.log(chalk.green(`✓ 匹配完成: ${allMatches.length} 条匹配结果`));
      if (allMatches.length > 0) {
        console.log(chalk.yellow(`  风险等级: 高=${stats.high}, 中=${stats.medium}, 低=${stats.low}`));
      }
      
      logger.info('Matching completed', {
        announcementId,
        totalTrademarks: trademarks.length,
        matchesFound: allMatches.length,
        durationMs: duration,
        stats
      });
      
      return {
        success: true,
        announcementId,
        matches: allMatches,
        stats,
        durationMs: duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Matching failed', { announcementId, error: error.message, durationMs: duration });
      throw error;
    }
  }

  async runManual(options = {}) {
    logger.info('Running manual pipeline trigger');
    return this.runFullPipeline();
  }

  getTaskStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.tasks.keys()),
      nextRun: this.tasks.get('main')?.nextDates()?.[0] || null
    };
  }
}

let schedulerInstance = null;

function createScheduler(options = {}) {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler(options);
  }
  return schedulerInstance;
}

function getScheduler() {
  return schedulerInstance;
}

module.exports = {
  TaskScheduler,
  createScheduler,
  getScheduler
};
