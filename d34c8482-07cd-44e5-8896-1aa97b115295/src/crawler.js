const puppeteer = require('puppeteer');
const pLimit = require('p-limit');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');
const winston = require('winston');
const chalk = require('chalk');

const config = require('../config/default.json');
const sitesConfig = require('../config/sites.json');

class Crawler {
  constructor(storage, parser, options = {}) {
    this.storage = storage;
    this.parser = parser;
    this.options = { ...config.crawler, ...options };
    this.browser = null;
    this.userAgents = sitesConfig.defaults.userAgents;
    this.currentUserAgentIndex = 0;
    this.requestCount = 0;
    this.logger = this._initLogger();
    this.concurrencyLimit = pLimit(this.options.concurrency);
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      articlesFetched: 0
    };
  }

  _initLogger() {
    const logDir = path.resolve(config.app.logsDir);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    return winston.createLogger({
      level: config.logging.level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, `crawler-${dayjs().format('YYYY-MM-DD')}.log`),
          level: config.logging.fileLevel,
          maxsize: 100 * 1024 * 1024,
          maxFiles: 30
        }),
        new winston.transports.Console({
          level: config.logging.consoleLevel,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${chalk.gray(timestamp)} [${level}] ${message} ${
                Object.keys(meta).length ? chalk.gray(JSON.stringify(meta)) : ''
              }`;
            })
          )
        })
      ]
    });
  }

  async init() {
    this.logger.info('正在启动浏览器...');
    const launchOptions = {
      headless: this.options.headless,
      ignoreHTTPSErrors: this.options.ignoreHTTPSErrors,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--disable-infobars',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled'
      ],
      executablePath: puppeteer.executablePath()
    };

    if (this.options.proxy) {
      launchOptions.args.push(`--proxy-server=${this.options.proxy}`);
    }

    this.browser = await puppeteer.launch(launchOptions);

    this.browser.on('disconnected', () => {
      this.logger.warn('浏览器连接断开，尝试重新启动...');
    });

    const version = await this.browser.version();
    this.logger.info(`浏览器已启动: ${chalk.cyan(version)}`);
  }

  _getNextUserAgent() {
    if (!this.options.userAgentRotation) {
      return this.userAgents[0];
    }
    const ua = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return ua;
  }

  _randomDelay() {
    const { randomDelayMin, randomDelayMax } = this.options;
    const delay = Math.floor(Math.random() * (randomDelayMax - randomDelayMin)) + randomDelayMin;
    return new Promise((r) => setTimeout(r, delay));
  }

  async _createPage(customUA = null) {
    const page = await this.browser.newPage();
    const userAgent = customUA || this._getNextUserAgent();

    await page.setUserAgent(userAgent);
    await page.setViewport(this.options.viewport);

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const blockTypes = ['image', 'media', 'font', 'stylesheet'];
      if (blockTypes.includes(resourceType) && Math.random() > 0.3) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en']
      });
      window.chrome = { runtime: {} };
    });

    page.setDefaultNavigationTimeout(this.options.navigationTimeout);
    page.setDefaultTimeout(this.options.requestTimeout);

    return page;
  }

  async _safeNavigate(page, url, options = {}) {
    const maxRetries = options.maxRetries || this.options.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.stats.totalRequests++;
        this.logger.debug(`请求 [${attempt}/${maxRetries}]: ${chalk.gray(url)}`);

        await page.goto(url, {
          waitUntil: options.waitUntil || 'domcontentloaded',
          timeout: this.options.navigationTimeout
        });

        await this._randomDelay();

        this.stats.successRequests++;
        return { success: true, page };
      } catch (err) {
        lastError = err;
        this.stats.failedRequests++;

        const delay = Math.min(
          this.options.retryDelayBase * Math.pow(2, attempt - 1),
          this.options.maxRetriesDelay
        );

        this.logger.warn(
          `请求失败 [${attempt}/${maxRetries}] ${chalk.gray(url)}: ${err.message}. ${delay}ms后重试...`
        );

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, delay));
          try {
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          } catch (e) {
            // ignore
          }
        }
      }
    }

    return { success: false, error: lastError };
  }

  async _scrollPage(page, scrollCount = null) {
    const count = scrollCount || sitesConfig.defaults.scrollCount;
    const delay = sitesConfig.defaults.scrollDelay;

    for (let i = 0; i < count; i++) {
      const scrolled = await page.evaluate(() => {
        const before = window.scrollY;
        window.scrollTo(0, document.body.scrollHeight);
        return window.scrollY > before;
      });

      if (!scrolled && i > 1) break;
      await new Promise((r) => setTimeout(r, delay));
    }

    await page.evaluate(() => window.scrollTo(0, 0));
  }

  async _handlePagination(page, site, listUrl) {
    const allUrls = [listUrl];

    if (site.pageType === 'paginated' && site.maxPages > 1) {
      const baseUrl = listUrl.replace(/index\d*\.html?$/, '').replace(/\/$/, '');
      for (let p = 2; p <= site.maxPages; p++) {
        const pagePattern = site.pagePattern || '/index{page}.html';
        const pageUrl = baseUrl + pagePattern.replace('{page}', p);
        allUrls.push(pageUrl);
      }
    }

    return allUrls;
  }

  async _takeScreenshot(page, siteId, type = 'detail') {
    const evidenceDir = path.resolve(config.app.evidenceDir);
    const siteDir = path.join(evidenceDir, siteId);
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }

    const filename = `${type}_${dayjs().format('YYYYMMDD_HHmmss')}_${uuidv4().slice(0, 8)}.png`;
    const filepath = path.join(siteDir, filename);

    try {
      await page.screenshot({
        path: filepath,
        fullPage: config.evidence.fullPage,
        type: config.evidence.screenshotFormat,
        quality: config.evidence.screenshotQuality
      });
      this.logger.debug(`截图已保存: ${chalk.gray(filepath)}`);
      return filepath;
    } catch (err) {
      this.logger.error(`截图失败: ${err.message}`);
      return null;
    }
  }

  async _saveHTML(page, siteId) {
    if (!config.evidence.saveHTML) return null;

    const evidenceDir = path.resolve(config.app.evidenceDir);
    const siteDir = path.join(evidenceDir, siteId);
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }

    const filename = `html_${dayjs().format('YYYYMMDD_HHmmss')}_${uuidv4().slice(0, 8)}.html`;
    const filepath = path.join(siteDir, filename);

    try {
      const content = await page.content();
      fs.writeFileSync(filepath, content, 'utf-8');
      return filepath;
    } catch (err) {
      this.logger.error(`HTML保存失败: ${err.message}`);
      return null;
    }
  }

  async _fetchArticleDetail(page, url, site) {
    const result = await this._safeNavigate(page, url);
    if (!result.success) {
      return {
        success: false,
        error: result.error ? result.error.message : '导航失败'
      };
    }

    const html = await page.content();
    const parsed = this.parser.parseDetailPage(html, site);

    const pageHash = CryptoJS.SHA256(html).toString();
    const screenshotPath = parsed.content ? await this._takeScreenshot(page, site.id, 'detail') : null;
    const htmlPath = parsed.content ? await this._saveHTML(page, site.id) : null;

    return {
      success: true,
      url,
      title: parsed.title || '',
      content: parsed.content || '',
      publish_time: parsed.time || null,
      source_annotation: parsed.source || null,
      author: parsed.author || null,
      raw_html: html,
      screenshot_path: screenshotPath,
      html_path: htmlPath,
      page_hash: pageHash,
      fetched_at: dayjs().format(),
      word_count: parsed.content ? parsed.content.length : 0
    };
  }

  async crawlSite(site, options = {}) {
    const { maxArticles = null, onProgress = null, checkpoint = null } = options;
    const page = await this._createPage();
    const crawlId = uuidv4();
    const siteLogger = this.logger.child({ site: site.name, site_id: site.id });

    siteLogger.info(`开始抓取: ${chalk.yellow(site.name)}`);
    const siteStart = Date.now();
    const results = [];
    const articleLimit = maxArticles || this.options.maxArticlesPerSite;
    const processedUrls = new Set(checkpoint ? checkpoint.processedUrls || [] : []);
    let detailErrorCount = 0;

    try {
      const listUrls = await this._handlePagination(page, site, site.listUrl);
      const allArticleLinks = [];

      for (const listUrl of listUrls) {
        if (allArticleLinks.length >= articleLimit) break;

        siteLogger.debug(`抓取列表页: ${chalk.gray(listUrl)}`);
        const listResult = await this._safeNavigate(page, listUrl);

        if (!listResult.success) {
          siteLogger.warn(`列表页抓取失败: ${listUrl}`);
          continue;
        }

        if (site.infiniteScroll || site.pageType === 'scroll') {
          await this._scrollPage(page, site.scrollCount);
        }

        const listHtml = await page.content();
        const links = this.parser.parseListPage(listHtml, site);

        for (const link of links) {
          if (allArticleLinks.length >= articleLimit) break;
          if (!link.url) continue;

          let fullUrl = link.url;
          if (!fullUrl.startsWith('http')) {
            try {
              const base = new URL(site.listUrl);
              fullUrl = new URL(fullUrl, base.origin).href;
            } catch {
              continue;
            }
          }

          if (!fullUrl.includes(site.domain)) continue;
          if (processedUrls.has(fullUrl)) continue;

          allArticleLinks.push({ ...link, url: fullUrl });
        }

        await this._randomDelay();
      }

      siteLogger.info(`获取到 ${chalk.cyan(allArticleLinks.length)} 条链接`);

      const detailTasks = allArticleLinks.map((link, idx) =>
        this.concurrencyLimit(async () => {
          if (detailErrorCount >= 20) return null;

          try {
            const detailPage = await this._createPage();
            const result = await this._fetchArticleDetail(detailPage, link.url, site);
            await detailPage.close().catch(() => {});

            processedUrls.add(link.url);
            this.stats.articlesFetched++;

            if (result.success && result.content && result.content.length >= 50) {
              const article = {
                crawl_id: crawlId,
                site_id: site.id,
                ...result
              };

              const dbResult = await this.storage.addCrawledArticle(article);
              results.push({
                ...result,
                crawled_id: dbResult ? dbResult.lastID : null
              });
            } else if (!result.success) {
              detailErrorCount++;
              siteLogger.warn(`详情页失败 [${idx + 1}/${allArticleLinks.length}]: ${result.error}`);
              await this.storage.addCrawledArticle({
                crawl_id: crawlId,
                site_id: site.id,
                url: link.url,
                fetched_at: dayjs().format(),
                status: 'failed',
                error_message: result.error,
                retry_count: 0
              });
            }

            if (onProgress) {
              onProgress({
                site: site.name,
                current: idx + 1,
                total: allArticleLinks.length,
                success: results.length,
                failed: detailErrorCount
              });
            }

            return result;
          } catch (err) {
            detailErrorCount++;
            siteLogger.error(`处理异常 [${idx + 1}/${allArticleLinks.length}]: ${err.message}`);
            return null;
          }
        })
      );

      await Promise.all(detailTasks);

      const duration = ((Date.now() - siteStart) / 1000).toFixed(1);
      siteLogger.info(
        `抓取完成: ${chalk.green(results.length)} 篇成功, ${chalk.red(detailErrorCount)} 篇失败, 耗时 ${chalk.cyan(duration)}s`
      );

      return {
        success: true,
        siteId: site.id,
        siteName: site.name,
        crawlId,
        totalLinks: allArticleLinks.length,
        successCount: results.length,
        failedCount: detailErrorCount,
        durationSeconds: parseFloat(duration),
        articles: results,
        checkpoint: {
          processedUrls: Array.from(processedUrls),
          lastIndex: allArticleLinks.length,
          completedAt: dayjs().format()
        }
      };
    } catch (err) {
      siteLogger.error(`站点抓取异常: ${err.message}`);
      return {
        success: false,
        siteId: site.id,
        siteName: site.name,
        crawlId,
        error: err.message,
        checkpoint: {
          processedUrls: Array.from(processedUrls),
          error: err.message,
          interruptedAt: dayjs().format()
        }
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  async crawlMultipleSites(sites, options = {}) {
    const { priorityBatch = true, onSiteComplete = null, onProgress = null } = options;
    const results = [];

    let sortedSites = [...sites];
    if (priorityBatch) {
      sortedSites.sort((a, b) => (a.priority || 3) - (b.priority || 3));
    }

    const priorityGroups = {};
    for (const site of sortedSites) {
      const p = site.priority || 3;
      if (!priorityGroups[p]) priorityGroups[p] = [];
      priorityGroups[p].push(site);
    }

    for (const [priority, groupSites] of Object.entries(priorityGroups)) {
      this.logger.info(
        `\n${chalk.bgBlue.white(` 处理优先级 ${priority} 站点组 (${groupSites.length}个) `)}`
      );

      for (let i = 0; i < groupSites.length; i++) {
        const site = groupSites[i];
        const checkpoint = await this.storage.getLastCheckpoint(site.id);

        if (checkpoint && !checkpoint.completedAt) {
          this.logger.info(`  恢复中断的任务: ${chalk.yellow(site.name)}`);
        }

        const result = await this.crawlSite(site, {
          checkpoint,
          onProgress: (p) => {
            if (onProgress) onProgress({ ...p, priority: parseInt(priority) });
          }
        });

        results.push(result);

        if (onSiteComplete) onSiteComplete(result);

        if (priorityBatch && i < groupSites.length - 1) {
          await new Promise((r) => setTimeout(r, config.scheduler.batchDelay));
        }
      }
    }

    return results;
  }

  async getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests
        ? ((this.stats.successRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  async close() {
    if (this.browser) {
      this.logger.info('正在关闭浏览器...');
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.logger.info(`最终统计: ${JSON.stringify(this.stats)}`);
  }
}

module.exports = Crawler;
