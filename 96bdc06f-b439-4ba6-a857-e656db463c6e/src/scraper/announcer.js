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
      logger.warn('Captcha encountered but captcha service is disabled, using fallback');
      return this.captchaConfig.fallbackMode === 'manual' 
        ? await this.manualCaptchaFallback(imageBuffer)
        : null;
    }
    
    const maxRetries = this.captchaConfig.maxRetries || 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const serviceType = this.captchaConfig.service || 'third_party';
        let result;
        
        switch (serviceType) {
          case '2captcha':
            result = await this.solveWith2Captcha(imageBuffer, attempt);
            break;
          case 'ruokuai':
            result = await this.solveWithRuoKuai(imageBuffer, attempt);
            break;
          case 'mock':
            result = await this.solveWithMock(imageBuffer, attempt);
            break;
          case 'third_party':
          default:
            result = await this.solveWithGenericAPI(imageBuffer, attempt);
        }
        
        if (result && result.success && result.text) {
          logger.info(`Captcha solved successfully on attempt ${attempt}`, {
            service: serviceType,
            solution: result.text.substring(0, 10) + '...',
            cost: result.cost || 0
          });
          return result.text;
        }
        
        lastError = new Error(result?.error || 'Captcha solution empty or invalid');
        
      } catch (error) {
        lastError = error;
        logger.warn(`Captcha solving attempt ${attempt} failed`, {
          error: error.message,
          service: this.captchaConfig.service
        });
      }
      
      if (attempt < maxRetries) {
        const retryDelay = Math.min(
          (this.captchaConfig.retryDelay || 2000) * Math.pow(1.5, attempt - 1),
          15000
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        if (this.captchaConfig.refreshOnRetry) {
          await this.refreshCaptchaImage();
        }
      }
    }
    
    logger.error('Captcha solving failed after all attempts, triggering fallback', {
      error: lastError?.message
    });
    
    const fallbackResult = await this.captchaFallbackHandler(imageBuffer, lastError);
    return fallbackResult;
  }

  async solveWithMock(imageBuffer, attempt) {
    const mockConfig = this.captchaConfig.mock || {};
    const accuracy = typeof mockConfig.accuracy === 'number' ? mockConfig.accuracy : 0.95;
    const latency = mockConfig.simulateLatencyMs || 500;
    const fixedAnswer = mockConfig.fixedAnswer || '';

    await new Promise(r => setTimeout(r, latency));

    if (Math.random() > accuracy) {
      throw new Error('Mock captcha service simulated failure (accuracy threshold)');
    }

    let answer = fixedAnswer;
    if (!answer) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const len = this.captchaConfig.length || 4;
      let generated = '';
      for (let i = 0; i < len; i++) {
        generated += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      answer = generated;
    }

    if (!this.captchaConfig.caseSensitive) {
      answer = answer.toUpperCase();
    }

    logger.debug('Mock captcha service returning solution', {
      answer: answer.substring(0, 10) + '...',
      attempt,
      latency,
      accuracy
    });

    return {
      success: true,
      text: answer,
      cost: 0,
      requestId: `mock-${Date.now()}-${attempt}`
    };
  }

  async solveWithGenericAPI(imageBuffer, attempt) {
    const timeout = this.captchaConfig.timeout || 30000;
    const startTime = Date.now();
    
    const response = await axios.post(
      this.captchaConfig.apiEndpoint,
      {
        image: imageBuffer.toString('base64'),
        type: this.captchaConfig.type || 'common',
        length: this.captchaConfig.length || 4,
        attempt,
        timestamp: Date.now()
      },
      {
        headers: {
          'Authorization': `Bearer ${this.captchaConfig.apiKey}`,
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0'
        },
        timeout,
        validateStatus: status => status < 500
      }
    );
    
    const duration = Date.now() - startTime;
    logger.debug('Generic captcha API response received', {
      status: response.status,
      durationMs: duration
    });
    
    if (response.status === 200 && response.data) {
      if (response.data.success === false) {
        throw new Error(response.data.message || 'API returned error');
      }
      return {
        success: true,
        text: response.data.result || response.data.text || response.data.captcha,
        cost: response.data.cost || response.data.charge || 0,
        requestId: response.data.request_id || response.data.id
      };
    }
    
    return { success: false, error: `API returned status ${response.status}` };
  }

  async solveWith2Captcha(imageBuffer, attempt) {
    const apiKey = this.captchaConfig.apiKey;
    const base64Image = imageBuffer.toString('base64');
    
    const submitResponse = await axios.post(
      'http://2captcha.com/in.php',
      new URLSearchParams({
        key: apiKey,
        method: 'base64',
        body: base64Image,
        json: '1',
        phrase: this.captchaConfig.phrase || '0',
        regsense: this.captchaConfig.caseSensitive ? '1' : '0',
        numeric: this.captchaConfig.numeric || '0',
        min_len: this.captchaConfig.minLength || '0',
        max_len: this.captchaConfig.maxLength || '0'
      }),
      { timeout: 60000 }
    );
    
    if (!submitResponse.data?.status) {
      throw new Error(`2Captcha submit failed: ${submitResponse.data?.request}`);
    }
    
    const taskId = submitResponse.data.request;
    const pollInterval = 5000;
    const maxPollTime = 120000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxPollTime) {
      await new Promise(r => setTimeout(r, pollInterval));
      
      const resultResponse = await axios.get('http://2captcha.com/res.php', {
        params: {
          key: apiKey,
          action: 'get',
          id: taskId,
          json: '1'
        },
        timeout: 30000
      });
      
      if (resultResponse.data?.status) {
        return {
          success: true,
          text: resultResponse.data.request,
          cost: 0.00299
        };
      }
      
      if (resultResponse.data?.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2Captcha error: ${resultResponse.data?.request}`);
      }
    }
    
    throw new Error('2Captcha timeout');
  }

  async solveWithRuoKuai(imageBuffer, attempt) {
    const { username, password, softId, typeId } = this.captchaConfig.ruoKuai || {};
    
    if (!username || !password) {
      throw new Error('RuoKuai credentials not configured');
    }
    
    const response = await axios.post(
      'http://api.ruokuai.com/create.json',
      {
        username,
        password,
        softid: softId || '1',
        softkey: this.captchaConfig.softKey || '',
        typeid: typeId || '3040',
        timeout: 60,
        image: imageBuffer.toString('base64')
      },
      { timeout: 60000 }
    );
    
    if (response.data?.Result) {
      return {
        success: true,
        text: response.data.Result,
        cost: 0
      };
    }
    
    throw new Error(`RuoKuai error: ${response.data?.Error || 'Unknown'}`);
  }

  async refreshCaptchaImage() {
    try {
      const refreshBtn = await this.page.$(
        'img[src*=captcha]+button, .captcha-refresh, .refresh-captcha, a:contains("刷新")'
      );
      if (refreshBtn) {
        await refreshBtn.click();
        await this.page.waitForTimeout(1000);
        logger.debug('Captcha image refreshed');
      }
    } catch (e) {
      logger.debug('Captcha refresh not available', { error: e.message });
    }
  }

  async manualCaptchaFallback(imageBuffer) {
    if (process.stdout.isTTY && !this.headless) {
      logger.warn('MANUAL CAPTCHA INPUT REQUIRED - Check browser window');
      try {
        await this.page.bringToFront();
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve(null);
          }, 120000);
          process.stdin.once('data', (data) => {
            clearTimeout(timeout);
            resolve(data.toString().trim());
          });
        });
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async captchaFallbackHandler(imageBuffer, lastError) {
    const fallbackMode = this.captchaConfig.fallbackMode || 'skip';
    logger.warn(`Using captcha fallback mode: ${fallbackMode}`, {
      lastError: lastError?.message
    });
    
    switch (fallbackMode) {
      case 'manual':
        return await this.manualCaptchaFallback(imageBuffer);
        
      case 'retry_later':
        this._captchaBlockedUntil = Date.now() + (this.captchaConfig.blockDuration || 300000);
        logger.warn(`Captcha blocked until ${new Date(this._captchaBlockedUntil).toISOString()}`);
        throw new Error('CAPTCHA_BLOCKED_TEMPORARILY');
        
      case 'save_for_later':
        const saveDir = './data/cache/captchas';
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
        const captchaPath = path.join(saveDir, `captcha_${Date.now()}.png`);
        fs.writeFileSync(captchaPath, imageBuffer);
        logger.warn(`Captcha saved for manual processing: ${captchaPath}`);
        return null;
        
      case 'skip':
      default:
        return null;
    }
  }

  isCaptchaBlocked() {
    if (this._captchaBlockedUntil && Date.now() < this._captchaBlockedUntil) {
      return true;
    }
    this._captchaBlockedUntil = null;
    return false;
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
    if (this.isCaptchaBlocked()) {
      logger.warn('Captcha temporarily blocked, skipping this operation');
      throw new Error('CAPTCHA_BLOCKED_TEMPORARILY');
    }
    
    logger.info('Captcha detected, attempting to solve');
    
    const captchaImg = await frame.$('img[src*=captcha], img[src*=verify], .captcha-img, #captcha_img, .code_img');
    if (!captchaImg) {
      logger.warn('Captcha image element not found, trying alternative selectors');
      const allImgs = await frame.$$('img');
      for (const img of allImgs) {
        const src = await img.evaluate(el => el.src || el.getAttribute('src') || '');
        if (src.length > 0 && src.includes('.')) {
          const size = await img.boundingBox();
          if (size && size.width >= 60 && size.width <= 400 && size.height >= 20 && size.height <= 200) {
            logger.info('Found potential captcha image by size', { src: src.substring(0, 50), size });
          }
        }
      }
      return false;
    }
    
    const maxAttempts = this.captchaConfig.maxSubmitAttempts || 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await captchaImg.scrollIntoViewIfNeeded?.();
        await this.page.waitForTimeout(500);
        
        const imageBuffer = await captchaImg.screenshot({
          type: 'png',
          omitBackground: true
        });
        
        if (imageBuffer.length < 500) {
          logger.warn(`Captcha image too small (${imageBuffer} bytes), refreshing`);
          await this.refreshCaptchaImage();
          await this.page.waitForTimeout(1000);
          continue;
        }
        
        const captchaText = await this.solveCaptcha(imageBuffer);
        
        if (!captchaText) {
          logger.warn(`Captcha attempt ${attempt}: no solution returned`);
          if (attempt < maxAttempts) {
            await this.refreshCaptchaImage();
            await this.page.waitForTimeout(2000);
          }
          continue;
        }
        
        const cleanText = captchaText.replace(/[\s\n\r]/g, '').toUpperCase();
        const minLen = this.captchaConfig.minLength || 3;
        const maxLen = this.captchaConfig.maxLength || 8;
        
        if (cleanText.length < minLen || cleanText.length > maxLen) {
          logger.warn(`Captcha solution length invalid: ${cleanText.length} chars, expected ${minLen}-${maxLen}`);
          continue;
        }
        
        const inputSelectors = [
          'input[name*=captcha]', 'input[name*=code]', 'input[name*=verify]',
          'input[id*=captcha]', 'input[id*=code]', 'input[id*=verify]',
          '.captcha-input', '.code-input', 'input[type=text][maxlength]'
        ];
        
        let inputEl = null;
        for (const sel of inputSelectors) {
          inputEl = await frame.$(sel);
          if (inputEl) break;
        }
        
        if (!inputEl) {
          inputEl = await frame.$('input[type=text]');
        }
        
        if (inputEl) {
          await inputEl.click({ clickCount: 3 });
          await inputEl.press('Backspace');
          await inputEl.type(cleanText, { delay: Math.random() * 80 + 50 });
          
          const submitSelectors = [
            'button[type=submit]', '.submit-btn', 'input[type=submit]',
            '#submit', '.btn-submit', 'button:has-text("提交")', 'button:has-text("验证")'
          ];
          
          let submitBtn = null;
          for (const sel of submitSelectors) {
            submitBtn = await frame.$(sel);
            if (submitBtn) break;
          }
          
          if (submitBtn) {
            const responsePromise = this.page.waitForNavigation({ 
              waitUntil: 'networkidle2', 
              timeout: 15000 
            }).catch(() => null);
            await submitBtn.click();
            await responsePromise;
            
            const captchaStillVisible = await frame.$('img[src*=captcha], img[src*=verify]')
              .then(el => !!el).catch(() => false);
            
            if (!captchaStillVisible || await this.page.$('.error, .error-msg').then(e => !e).catch(() => true)) {
              logger.info(`Captcha submission successful on attempt ${attempt}`);
              return true;
            }
            
            const errorMsg = await frame.$eval('.error, .error-msg, .message', 
              el => el?.textContent?.trim() || ''
            ).catch(() => '');
            
            if (errorMsg) {
              logger.warn(`Captcha verification failed: ${errorMsg}`);
            }
          } else {
            await inputEl.press('Enter');
            await this.page.waitForTimeout(2000);
            return true;
          }
        }
      } catch (e) {
        logger.warn(`Captcha submission attempt ${attempt} error`, { error: e.message });
      }
      
      if (attempt < maxAttempts) {
        await this.refreshCaptchaImage();
        await this.page.waitForTimeout(2000 + Math.random() * 2000);
      }
    }
    
    logger.error('Captcha solving failed after all submission attempts');
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
