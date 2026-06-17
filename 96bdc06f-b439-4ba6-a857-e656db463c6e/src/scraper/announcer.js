const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { getLogger } = require('../logger/appLogger');
const { getConfig } = require('../config');
const { getProcessedAnnouncementNumbers, saveAnnouncement } = require('../store/database');

const logger = getLogger();

class AnnouncementScraper {
  constructor(options = {}) {
    const config = getConfig('scraper', {});
    this.baseUrl = config.baseUrl || 'https://sbj.cnipa.gov.cn';
    this.listUrl = config.announcementListUrl || '/sbcx/sbgg';
    this.detailUrl = config.detailUrl || '/sbcx/sbgg/detail';
    this.timeout = config.timeout || 30000;
    this.headless = options.headless !== undefined ? options.headless : config.headless !== false;
    this.userAgent = config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    this.downloadPath = options.downloadPath || config.downloadPath || './data/pdfs';
    this.captchaConfig = config.captcha || { enabled: false };
    this.retryConfig = getConfig('system.retry', { maxAttempts: 3, baseDelay: 1000 });
    
    this.browser = null;
    this.page = null;
    
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
  }

  async init() {
    logger.info('Initializing browser for scraping');
    
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      timeout: this.timeout
    });
    
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(this.userAgent);
    await this.page.setDefaultTimeout(this.timeout);
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    logger.info('Browser initialized successfully');
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Browser closed');
  }

  async retry(fn, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay || 30000
        );
        
        logger.warn(`${operationName} attempt ${attempt} failed`, {
          error: error.message,
          nextRetryIn: delay
        });
        
        if (attempt < this.retryConfig.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async solveCaptcha(imageBuffer) {
    if (!this.captchaConfig.enabled) {
      logger.warn('Captcha encountered but captcha service is disabled');
      return null;
    }
    
    try {
      const response = await axios.post(
        this.captchaConfig.apiEndpoint,
        {
          image: imageBuffer.toString('base64'),
          type: 'common'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.captchaConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      return response.data.result;
    } catch (error) {
      logger.error('Captcha solving failed:', error.message);
      return null;
    }
  }

  async getAnnouncementList(pageNum = 1, pageSize = 20) {
    const url = `${this.baseUrl}${this.listUrl}?page=${pageNum}&pageSize=${pageSize}`;
    logger.info(`Fetching announcement list: page ${pageNum}`);
    
    return this.retry(async () => {
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      
      const captchaFrame = await this.findCaptchaFrame();
      if (captchaFrame) {
        const captchaSolved = await this.handleCaptcha(captchaFrame);
        if (!captchaSolved) {
          throw new Error('Failed to solve captcha');
        }
      }
      
      const iframe = await this.page.$('iframe');
      let content;
      
      if (iframe) {
        const frame = await iframe.contentFrame();
        await frame.waitForSelector('table, .list, .announcement-list', { timeout: 10000 });
        content = await frame.content();
      } else {
        await this.page.waitForSelector('table, .list, .announcement-list', { timeout: 10000 });
        content = await this.page.content();
      }
      
      const announcements = this.parseAnnouncementList(content);
      logger.info(`Found ${announcements.length} announcements on page ${pageNum}`);
      
      return announcements;
    }, `Get announcement list page ${pageNum}`);
  }

  async findCaptchaFrame() {
    const frames = this.page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('captcha') || url.includes('verify') || url.includes('code')) {
        return frame;
      }
    }
    
    const captchaElement = await this.page.$('img[src*=captcha], img[src*=verify], .captcha-img');
    if (captchaElement) {
      return this.page.mainFrame();
    }
    
    return null;
  }

  async handleCaptcha(frame) {
    logger.info('Captcha detected, attempting to solve');
    
    const captchaImg = await frame.$('img[src*=captcha], img[src*=verify], .captcha-img');
    if (!captchaImg) {
      logger.warn('Captcha image element not found');
      return false;
    }
    
    const imageBuffer = await captchaImg.screenshot();
    const captchaText = await this.solveCaptcha(imageBuffer);
    
    if (!captchaText) {
      return false;
    }
    
    const input = await frame.$('input[name*=captcha], input[name*=code], input[id*=captcha], input[id*=code]');
    if (input) {
      await input.type(captchaText, { delay: 100 });
      const submitBtn = await frame.$('button[type=submit], .submit-btn, input[type=submit]');
      if (submitBtn) {
        await submitBtn.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        return true;
      }
    }
    
    return false;
  }

  parseAnnouncementList(html) {
    const $ = cheerio.load(html);
    const announcements = [];
    
    $('table tr, .list-item, .announcement-item').each((i, el) => {
      if (i === 0 && $(el).find('th').length > 0) return;
      
      const cells = $(el).find('td, .cell');
      if (cells.length < 3) return;
      
      const link = $(el).find('a[href*=detail], a[href*=announcement]');
      const href = link.attr('href') || '';
      
      const announcementNumber = this.extractAnnouncementNumber(
        link.text() || $(cells.get(0)).text()
      );
      
      if (!announcementNumber) return;
      
      const announcement = {
        announcement_number: announcementNumber,
        announcement_date: this.parseDate($(cells.get(1)).text() || $(el).find('.date').text()),
        title: link.text() || $(cells.get(0)).text(),
        url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
        total_trademarks: this.extractTotalCount($(el).text()),
        status: 'pending'
      };
      
      announcements.push(announcement);
    });
    
    return announcements;
  }

  extractAnnouncementNumber(text) {
    if (!text) return null;
    const match = text.match(/第?(\d{4,})[期号]/) || text.match(/(\d{6,})/);
    return match ? match[1] : null;
  }

  parseDate(text) {
    if (!text) return null;
    const normalized = text
      .replace(/年|月/g, '-')
      .replace(/日/g, '')
      .replace(/\./g, '-')
      .replace(/\//g, '-')
      .trim();
    
    const match = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }
    return null;
  }

  extractTotalCount(text) {
    if (!text) return 0;
    const match = text.match(/(\d+)\s*条/);
    return match ? parseInt(match[1]) : 0;
  }

  async getAnnouncementDetail(announcementUrl) {
    logger.info(`Fetching announcement detail: ${announcementUrl}`);
    
    return this.retry(async () => {
      await this.page.goto(announcementUrl, { waitUntil: 'networkidle2' });
      
      const iframe = await this.page.$('iframe');
      let content;
      
      if (iframe) {
        const frame = await iframe.contentFrame();
        await frame.waitForSelector('body', { timeout: 10000 });
        content = await frame.content();
      } else {
        await this.page.waitForSelector('body', { timeout: 10000 });
        content = await this.page.content();
      }
      
      const pdfLinks = this.parseAnnouncementDetail(content);
      logger.info(`Found ${pdfLinks.length} PDF links in announcement`);
      
      return pdfLinks;
    }, `Get announcement detail`);
  }

  parseAnnouncementDetail(html) {
    const $ = cheerio.load(html);
    const pdfLinks = [];
    
    $('a[href$=.pdf], a:contains("下载"), a:contains("PDF")').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      
      const url = href.startsWith('http') ? href : `${this.baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      const title = $(el).text().trim() || `附件${i + 1}`;
      
      pdfLinks.push({ url, title });
    });
    
    return _.uniqBy(pdfLinks, 'url');
  }

  async downloadPDF(pdfUrl, announcementNumber) {
    logger.info(`Downloading PDF: ${pdfUrl}`);
    
    return this.retry(async () => {
      const filename = `${announcementNumber}_${Date.now()}.pdf`;
      const filePath = path.join(this.downloadPath, filename);
      
      const response = await axios({
        method: 'GET',
        url: pdfUrl,
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': this.userAgent
        }
      });
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          logger.info(`PDF downloaded: ${filename}`, { size: writer.bytesWritten });
          resolve({
            success: true,
            filePath,
            filename,
            url: pdfUrl,
            size: writer.bytesWritten
          });
        });
        writer.on('error', reject);
      });
    }, `Download PDF ${pdfUrl}`);
  }

  async getNewAnnouncements(maxPages = 5) {
    logger.info(`Scanning for new announcements, max pages: ${maxPages}`);
    
    const processedNumbers = new Set(await getProcessedAnnouncementNumbers());
    const newAnnouncements = [];
    
    for (let page = 1; page <= maxPages; page++) {
      const announcements = await this.getAnnouncementList(page);
      
      let foundUnprocessed = false;
      
      for (const ann of announcements) {
        if (!processedNumbers.has(ann.announcement_number)) {
          newAnnouncements.push(ann);
          foundUnprocessed = true;
        }
      }
      
      if (!foundUnprocessed && page > 1) {
        logger.info(`No new announcements on page ${page}, stopping scan`);
        break;
      }
    }
    
    logger.info(`Found ${newAnnouncements.length} new announcements`);
    return newAnnouncements;
  }

  async processAnnouncement(announcement) {
    const startTime = Date.now();
    logger.info(`Processing announcement: ${announcement.announcement_number}`);
    
    try {
      const announcementId = await saveAnnouncement({
        ...announcement,
        status: 'processing'
      });
      
      const pdfLinks = await this.getAnnouncementDetail(announcement.url);
      const downloadedPDFs = [];
      
      for (const pdfLink of pdfLinks) {
        try {
          const downloadResult = await this.downloadPDF(pdfLink.url, announcement.announcement_number);
          if (downloadResult.success) {
            downloadedPDFs.push(downloadResult);
          }
        } catch (error) {
          logger.error(`Failed to download PDF for ${announcement.announcement_number}`, {
            error: error.message,
            url: pdfLink.url
          });
        }
      }
      
      if (downloadedPDFs.length === 0) {
        throw new Error('No PDFs downloaded successfully');
      }
      
      await saveAnnouncement({
        ...announcement,
        id: announcementId,
        download_path: JSON.stringify(downloadedPDFs.map(p => p.filePath)),
        status: 'downloaded',
        total_trademarks: announcement.total_trademarks
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Announcement ${announcement.announcement_number} processed successfully`, {
        pdfCount: downloadedPDFs.length,
        durationMs: duration
      });
      
      return {
        success: true,
        announcement,
        announcementId,
        downloadedPDFs,
        durationMs: duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to process announcement ${announcement.announcement_number}`, {
        error: error.message,
        durationMs: duration
      });
      
      await saveAnnouncement({
        ...announcement,
        status: 'failed',
        error_message: error.message
      });
      
      return {
        success: false,
        announcement,
        error: error.message,
        durationMs: duration
      };
    }
  }
}

async function fetchLatestAnnouncements(options = {}) {
  const scraper = new AnnouncementScraper(options);
  
  try {
    await scraper.init();
    const newAnnouncements = await scraper.getNewAnnouncements(options.maxPages);
    
    const results = [];
    for (const ann of newAnnouncements) {
      const result = await scraper.processAnnouncement(ann);
      results.push(result);
    }
    
    return {
      success: true,
      totalFound: newAnnouncements.length,
      processedSuccessfully: results.filter(r => r.success).length,
      results
    };
    
  } finally {
    await scraper.close();
  }
}

module.exports = {
  AnnouncementScraper,
  fetchLatestAnnouncements
};
