const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const CryptoJS = require('crypto-js');
const _ = require('lodash');

const config = require('../config/default.json');

class Storage {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.resolve(config.app.dbPath);
    this.db = null;
    this._initDir();
  }

  _initDir() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        }
      });

      this.db.serialize(() => {
        this._applyPragmas();
        this._createTables();
        this._createIndexes();
      });

      this.db.get('SELECT 1 as test', (err) => {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  _applyPragmas() {
    const { journalMode, synchronous, cacheSize, pageSize, busyTimeout } = config.storage;
    this.db.exec(`
      PRAGMA journal_mode = ${journalMode};
      PRAGMA synchronous = ${synchronous};
      PRAGMA cache_size = ${cacheSize};
      PRAGMA page_size = ${pageSize};
      PRAGMA busy_timeout = ${busyTimeout};
      PRAGMA foreign_keys = ON;
    `);
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS original_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        publish_time TEXT,
        source TEXT,
        author TEXT,
        url TEXT,
        category TEXT,
        keywords TEXT,
        word_count INTEGER DEFAULT 0,
        title_fingerprint TEXT,
        content_fingerprint TEXT,
        keyword_vector TEXT,
        content_hash TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitored_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        domain TEXT,
        priority INTEGER DEFAULT 3,
        category TEXT,
        config TEXT,
        is_enabled INTEGER DEFAULT 1,
        last_crawled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS crawled_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content TEXT,
        publish_time TEXT,
        source_annotation TEXT,
        author TEXT,
        word_count INTEGER DEFAULT 0,
        raw_html TEXT,
        screenshot_path TEXT,
        page_hash TEXT,
        fetched_at TEXT NOT NULL,
        status TEXT DEFAULT 'fetched',
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(site_id, url)
      );

      CREATE TABLE IF NOT EXISTS infringement_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT UNIQUE NOT NULL,
        original_article_id TEXT NOT NULL,
        crawled_article_id INTEGER NOT NULL,
        site_id TEXT NOT NULL,
        title_similarity REAL DEFAULT 0,
        content_similarity REAL DEFAULT 0,
        overall_score REAL DEFAULT 0,
        match_type TEXT,
        is_suspected INTEGER DEFAULT 0,
        is_confirmed INTEGER DEFAULT 0,
        matched_keywords TEXT,
        similarity_details TEXT,
        evidence_path TEXT,
        report_status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (original_article_id) REFERENCES original_articles(article_id),
        FOREIGN KEY (crawled_article_id) REFERENCES crawled_articles(id)
      );

      CREATE TABLE IF NOT EXISTS crawl_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT UNIQUE NOT NULL,
        round_name TEXT,
        site_id TEXT,
        batch_id TEXT,
        status TEXT DEFAULT 'pending',
        total_articles INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        suspected_count INTEGER DEFAULT 0,
        start_time TEXT,
        end_time TEXT,
        duration_seconds INTEGER DEFAULT 0,
        error_message TEXT,
        checkpoint TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id TEXT UNIQUE NOT NULL,
        level TEXT NOT NULL,
        module TEXT,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evidence_id TEXT UNIQUE NOT NULL,
        match_id TEXT NOT NULL,
        title TEXT,
        original_url TEXT,
        infringing_url TEXT,
        screenshot_path TEXT,
        html_path TEXT,
        hash_value TEXT,
        timestamp TEXT NOT NULL,
        notary_status TEXT DEFAULT 'pending',
        package_path TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES infringement_matches(match_id)
      );
    `);
  }

  _createIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_original_articles_publish_time ON original_articles(publish_time);
      CREATE INDEX IF NOT EXISTS idx_original_articles_content_hash ON original_articles(content_hash);
      CREATE INDEX IF NOT EXISTS idx_crawled_articles_site_id ON crawled_articles(site_id);
      CREATE INDEX IF NOT EXISTS idx_crawled_articles_fetched_at ON crawled_articles(fetched_at);
      CREATE INDEX IF NOT EXISTS idx_infringement_matches_original ON infringement_matches(original_article_id);
      CREATE INDEX IF NOT EXISTS idx_infringement_matches_site ON infringement_matches(site_id);
      CREATE INDEX IF NOT EXISTS idx_infringement_matches_suspected ON infringement_matches(is_suspected);
      CREATE INDEX IF NOT EXISTS idx_infringement_matches_created ON infringement_matches(created_at);
      CREATE INDEX IF NOT EXISTS idx_crawl_tasks_status ON crawl_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_crawl_tasks_created ON crawl_tasks(created_at);
    `);
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async addOriginalArticle(article) {
    const now = dayjs().format();
    const contentHash = CryptoJS.SHA256(article.content || '').toString();
    const articleId = article.article_id || uuidv4();

    const sql = `
      INSERT OR IGNORE INTO original_articles 
      (article_id, title, content, publish_time, source, author, url, category, 
       keywords, word_count, title_fingerprint, content_fingerprint, keyword_vector, 
       content_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      articleId,
      article.title || '',
      article.content || '',
      article.publish_time || null,
      article.source || null,
      article.author || null,
      article.url || null,
      article.category || null,
      article.keywords ? JSON.stringify(article.keywords) : null,
      article.word_count || (article.content ? article.content.length : 0),
      article.title_fingerprint || null,
      article.content_fingerprint || null,
      article.keyword_vector ? JSON.stringify(article.keyword_vector) : null,
      contentHash,
      now,
      now
    ]);

    return articleId;
  }

  async bulkAddOriginalArticles(articles) {
    const ids = [];
    for (const article of articles) {
      const id = await this.addOriginalArticle(article);
      ids.push(id);
    }
    return ids;
  }

  async getOriginalArticles(limit = 1000, offset = 0) {
    return this.all(
      'SELECT * FROM original_articles ORDER BY publish_time DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  async getOriginalArticleCount() {
    const row = await this.get('SELECT COUNT(*) as count FROM original_articles');
    return row ? row.count : 0;
  }

  async getAllOriginalArticlesForComparison() {
    return this.all(`
      SELECT article_id, title, content, publish_time, title_fingerprint, 
             content_fingerprint, keyword_vector, word_count
      FROM original_articles 
      WHERE word_count >= ?
      ORDER BY publish_time DESC
    `, [config.comparator.minArticleLength]);
  }

  async addCrawledArticle(article) {
    const now = dayjs().format();

    const sql = `
      INSERT OR REPLACE INTO crawled_articles 
      (crawl_id, site_id, url, title, content, publish_time, source_annotation, 
       author, word_count, raw_html, screenshot_path, page_hash, fetched_at, 
       status, error_message, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM crawled_articles WHERE site_id=? AND url=?), ?))
    `;

    return this.run(sql, [
      article.crawl_id || uuidv4(),
      article.site_id,
      article.url,
      article.title || null,
      article.content || null,
      article.publish_time || null,
      article.source_annotation || null,
      article.author || null,
      article.word_count || (article.content ? article.content.length : 0),
      article.raw_html || null,
      article.screenshot_path || null,
      article.page_hash || null,
      article.fetched_at || now,
      article.status || 'fetched',
      article.error_message || null,
      article.retry_count || 0,
      article.site_id,
      article.url,
      now
    ]);
  }

  async updateCrawledArticle(id, updates) {
    const now = dayjs().format();
    const fields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
    values.push(id);

    return this.run(
      `UPDATE crawled_articles SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async addInfringementMatch(match) {
    const now = dayjs().format();
    const matchId = match.match_id || uuidv4();

    const sql = `
      INSERT OR IGNORE INTO infringement_matches 
      (match_id, original_article_id, crawled_article_id, site_id, title_similarity, 
       content_similarity, overall_score, match_type, is_suspected, is_confirmed, 
       matched_keywords, similarity_details, evidence_path, report_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      matchId,
      match.original_article_id,
      match.crawled_article_id,
      match.site_id,
      match.title_similarity || 0,
      match.content_similarity || 0,
      match.overall_score || 0,
      match.match_type || null,
      match.is_suspected ? 1 : 0,
      match.is_confirmed ? 1 : 0,
      match.matched_keywords ? JSON.stringify(match.matched_keywords) : null,
      match.similarity_details ? JSON.stringify(match.similarity_details) : null,
      match.evidence_path || null,
      match.report_status || 'pending',
      now
    ]);

    return matchId;
  }

  async getSuspectedMatches(filters = {}) {
    let sql = `
      SELECT m.*, o.title as original_title, o.url as original_url,
             c.url as infringing_url, c.title as infringing_title,
             c.fetched_at, c.screenshot_path, ms.name as site_name
      FROM infringement_matches m
      LEFT JOIN original_articles o ON m.original_article_id = o.article_id
      LEFT JOIN crawled_articles c ON m.crawled_article_id = c.id
      LEFT JOIN monitored_sites ms ON m.site_id = ms.site_id
      WHERE m.is_suspected = 1
    `;
    const params = [];

    if (filters.siteId) {
      sql += ' AND m.site_id = ?';
      params.push(filters.siteId);
    }
    if (filters.startDate) {
      sql += ' AND m.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND m.created_at <= ?';
      params.push(filters.endDate);
    }
    if (filters.confirmedOnly) {
      sql += ' AND m.is_confirmed = 1';
    }

    sql += ' ORDER BY m.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.all(sql, params);
  }

  async createCrawlTask(task) {
    const now = dayjs().format();
    const taskId = task.task_id || uuidv4();

    await this.run(`
      INSERT INTO crawl_tasks 
      (task_id, round_name, site_id, batch_id, status, start_time, checkpoint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      taskId,
      task.round_name || null,
      task.site_id || null,
      task.batch_id || null,
      task.status || 'running',
      task.start_time || now,
      task.checkpoint ? JSON.stringify(task.checkpoint) : null,
      now,
      now
    ]);

    return taskId;
  }

  async updateCrawlTask(taskId, updates) {
    const now = dayjs().format();
    const fields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      if (key === 'checkpoint' && val && typeof val === 'object') {
        fields.push('checkpoint = ?');
        values.push(JSON.stringify(val));
      } else {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }
    fields.push('updated_at = ?');
    values.push(now);
    values.push(taskId);

    return this.run(
      `UPDATE crawl_tasks SET ${fields.join(', ')} WHERE task_id = ?`,
      values
    );
  }

  async getLastCheckpoint(siteId = null) {
    let sql = `SELECT checkpoint FROM crawl_tasks WHERE status IN ('completed','interrupted')`;
    const params = [];

    if (siteId) {
      sql += ' AND site_id = ?';
      params.push(siteId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 1';

    const row = await this.get(sql, params);
    if (row && row.checkpoint) {
      try {
        return JSON.parse(row.checkpoint);
      } catch {
        return null;
      }
    }
    return null;
  }

  async addEvidencePackage(evidence) {
    const now = dayjs().format();
    const evidenceId = evidence.evidence_id || uuidv4();

    await this.run(`
      INSERT INTO evidence_packages 
      (evidence_id, match_id, title, original_url, infringing_url, 
       screenshot_path, html_path, hash_value, timestamp, 
       notary_status, package_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      evidenceId,
      evidence.match_id,
      evidence.title || null,
      evidence.original_url || null,
      evidence.infringing_url || null,
      evidence.screenshot_path || null,
      evidence.html_path || null,
      evidence.hash_value || null,
      evidence.timestamp || now,
      evidence.notary_status || 'pending',
      evidence.package_path || null,
      now
    ]);

    return evidenceId;
  }

  async getInfringementStats(startDate, endDate) {
    return this.all(`
      SELECT 
        m.site_id,
        ms.name as site_name,
        COUNT(*) as total_matches,
        SUM(CASE WHEN m.is_suspected = 1 THEN 1 ELSE 0 END) as suspected_count,
        SUM(CASE WHEN m.is_confirmed = 1 THEN 1 ELSE 0 END) as confirmed_count,
        AVG(m.title_similarity) as avg_title_similarity,
        AVG(m.content_similarity) as avg_content_similarity
      FROM infringement_matches m
      LEFT JOIN monitored_sites ms ON m.site_id = ms.site_id
      WHERE m.created_at BETWEEN ? AND ?
      GROUP BY m.site_id, ms.name
      ORDER BY confirmed_count DESC, suspected_count DESC
    `, [startDate, endDate]);
  }

  async getDailyStats(days = 7) {
    const start = dayjs().subtract(days, 'day').format('YYYY-MM-DD 00:00:00');
    return this.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_matches,
        SUM(CASE WHEN is_suspected = 1 THEN 1 ELSE 0 END) as suspected_count,
        SUM(CASE WHEN is_confirmed = 1 THEN 1 ELSE 0 END) as confirmed_count
      FROM infringement_matches
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [start]);
  }

  async upsertMonitoredSite(site) {
    const now = dayjs().format();
    const existing = await this.get(
      'SELECT id FROM monitored_sites WHERE site_id = ?',
      [site.id]
    );

    if (existing) {
      await this.run(`
        UPDATE monitored_sites 
        SET name = ?, domain = ?, priority = ?, category = ?, config = ?, updated_at = ?
        WHERE site_id = ?
      `, [
        site.name,
        site.domain || null,
        site.priority || 3,
        site.category || null,
        JSON.stringify(site),
        now,
        site.id
      ]);
    } else {
      await this.run(`
        INSERT INTO monitored_sites 
        (site_id, name, domain, priority, category, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        site.id,
        site.name,
        site.domain || null,
        site.priority || 3,
        site.category || null,
        JSON.stringify(site),
        now,
        now
      ]);
    }
  }

  async getMonitoredSites(enabledOnly = true) {
    const sql = enabledOnly
      ? 'SELECT * FROM monitored_sites WHERE is_enabled = 1 ORDER BY priority ASC'
      : 'SELECT * FROM monitored_sites ORDER BY priority ASC';
    return this.all(sql);
  }

  async addLog(level, module, message, context = null) {
    const logId = uuidv4();
    const now = dayjs().format();
    await this.run(`
      INSERT INTO system_logs (log_id, level, module, message, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      logId,
      level,
      module || null,
      message,
      context ? JSON.stringify(context) : null,
      now
    ]);
    return logId;
  }
}

module.exports = Storage;
