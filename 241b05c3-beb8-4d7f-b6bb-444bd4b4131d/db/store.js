const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

class Store {
  constructor(dbPath = config.database.path) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('cache_size = -20000');
    this._initTables();
    this._initIndexes();
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_no TEXT UNIQUE NOT NULL,
        project_name TEXT NOT NULL,
        purchaser TEXT,
        budget REAL,
        platform TEXT,
        project_type TEXT,
        status TEXT DEFAULT 'published',
        publish_date TEXT,
        notice_url TEXT,
        raw_data TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bidders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        contact_person TEXT,
        legal_representative TEXT,
        registration_no TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(name, registration_no)
      );

      CREATE TABLE IF NOT EXISTS bid_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_no TEXT NOT NULL,
        bidder_id INTEGER,
        bidder_name TEXT NOT NULL,
        bid_amount REAL,
        win_amount REAL,
        is_winner INTEGER DEFAULT 0,
        rank INTEGER,
        announce_date TEXT,
        raw_data TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (bidder_id) REFERENCES bidders(id),
        UNIQUE(project_no, bidder_name)
      );

      CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_no TEXT,
        project_name TEXT,
        risk_type TEXT NOT NULL,
        risk_score REAL NOT NULL,
        risk_details TEXT,
        evidence_screenshot TEXT,
        evidence_html TEXT,
        evidence_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS bidder_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bidder_a_id INTEGER NOT NULL,
        bidder_b_id INTEGER NOT NULL,
        relation_type TEXT NOT NULL,
        relation_value TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (bidder_a_id) REFERENCES bidders(id),
        FOREIGN KEY (bidder_b_id) REFERENCES bidders(id),
        UNIQUE(bidder_a_id, bidder_b_id, relation_type)
      );

      CREATE TABLE IF NOT EXISTS crawl_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        task_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        last_crawl_date TEXT,
        next_crawl_date TEXT,
        total_count INTEGER DEFAULT 0,
        error_msg TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS crawl_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT,
        task_type TEXT,
        page INTEGER,
        items_count INTEGER,
        status TEXT,
        error_msg TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  _initIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_platform ON projects(platform);
      CREATE INDEX IF NOT EXISTS idx_projects_publish_date ON projects(publish_date);
      CREATE INDEX IF NOT EXISTS idx_bid_results_project_no ON bid_results(project_no);
      CREATE INDEX IF NOT EXISTS idx_bid_results_is_winner ON bid_results(is_winner);
      CREATE INDEX IF NOT EXISTS idx_risk_events_score ON risk_events(risk_score);
      CREATE INDEX IF NOT EXISTS idx_risk_events_created_at ON risk_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_bidder_relations_type ON bidder_relations(relation_type);
    `);
  }

  _projectExists(projectNo) {
    const row = this.db.prepare('SELECT id FROM projects WHERE project_no = ?').get(projectNo);
    return !!row;
  }

  insertProject(project) {
    if (this._projectExists(project.projectNo)) {
      return null;
    }

    const stmt = this.db.prepare(`
      INSERT INTO projects (project_no, project_name, purchaser, budget, platform, project_type, status, publish_date, notice_url, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      project.projectNo,
      project.projectName,
      project.purchaser || null,
      project.budget || null,
      project.platform,
      project.projectType || null,
      project.status || 'published',
      project.publishDate || null,
      project.noticeUrl || null,
      project.rawData ? JSON.stringify(project.rawData) : null
    );

    return result.lastInsertRowid;
  }

  batchInsertProjects(projects) {
    const insert = this.db.transaction((projList) => {
      let count = 0;
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO projects (project_no, project_name, purchaser, budget, platform, project_type, status, publish_date, notice_url, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of projList) {
        const result = stmt.run(
          p.projectNo,
          p.projectName,
          p.purchaser || null,
          p.budget || null,
          p.platform,
          p.projectType || null,
          p.status || 'published',
          p.publishDate || null,
          p.noticeUrl || null,
          p.rawData ? JSON.stringify(p.rawData) : null
        );
        if (result.changes > 0) count++;
      }
      return count;
    });

    return insert(projects);
  }

  getProjectsByDateRange(startDate, endDate, platform = null) {
    let sql = 'SELECT * FROM projects WHERE publish_date >= ? AND publish_date <= ?';
    const params = [startDate, endDate];
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    sql += ' ORDER BY publish_date DESC';
    return this.db.prepare(sql).all(...params);
  }

  getProjectByNo(projectNo) {
    return this.db.prepare('SELECT * FROM projects WHERE project_no = ?').get(projectNo);
  }

  insertBidder(bidder) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO bidders (name, address, phone, contact_person, legal_representative, registration_no)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      bidder.name,
      bidder.address || null,
      bidder.phone || null,
      bidder.contactPerson || null,
      bidder.legalRepresentative || null,
      bidder.registrationNo || null
    );
    if (result.lastInsertRowid) {
      return result.lastInsertRowid;
    }
    const existing = this.db.prepare('SELECT id FROM bidders WHERE name = ? AND registration_no = ?').get(bidder.name, bidder.registrationNo || '');
    return existing ? existing.id : null;
  }

  insertBidResult(result) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bid_results (project_id, project_no, bidder_id, bidder_name, bid_amount, win_amount, is_winner, rank, announce_date, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      result.projectId || null,
      result.projectNo,
      result.bidderId || null,
      result.bidderName,
      result.bidAmount || null,
      result.winAmount || null,
      result.isWinner ? 1 : 0,
      result.rank || null,
      result.announceDate || null,
      result.rawData ? JSON.stringify(result.rawData) : null
    );

    return res.lastInsertRowid;
  }

  batchInsertBidResults(results) {
    const insert = this.db.transaction((resultList) => {
      let count = 0;
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO bid_results (project_id, project_no, bidder_id, bidder_name, bid_amount, win_amount, is_winner, rank, announce_date, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of resultList) {
        stmt.run(
          r.projectId || null,
          r.projectNo,
          r.bidderId || null,
          r.bidderName,
          r.bidAmount || null,
          r.winAmount || null,
          r.isWinner ? 1 : 0,
          r.rank || null,
          r.announceDate || null,
          r.rawData ? JSON.stringify(r.rawData) : null
        );
        count++;
      }
      return count;
    });

    return insert(results);
  }

  getWinningBidsByPurchaser(purchaser, year = null) {
    let sql = `
      SELECT br.*, p.purchaser, p.budget, p.project_name, p.publish_date
      FROM bid_results br
      JOIN projects p ON br.project_no = p.project_no
      WHERE br.is_winner = 1 AND p.purchaser = ?
    `;
    const params = [purchaser];
    if (year) {
      sql += ` AND strftime('%Y', p.publish_date) = ?`;
      params.push(year.toString());
    }
    sql += ' ORDER BY p.publish_date DESC';
    return this.db.prepare(sql).all(...params);
  }

  getWinnersByPurchaserGroup(purchaser, year = null) {
    let sql = `
      SELECT br.bidder_name, COUNT(*) as win_count, p.budget, br.win_amount
      FROM bid_results br
      JOIN projects p ON br.project_no = p.project_no
      WHERE br.is_winner = 1 AND p.purchaser = ?
    `;
    const params = [purchaser];
    if (year) {
      sql += ` AND strftime('%Y', p.publish_date) = ?`;
      params.push(year.toString());
    }
    sql += ' GROUP BY br.bidder_name ORDER BY win_count DESC';
    return this.db.prepare(sql).all(...params);
  }

  getBiddersByProject(projectNo) {
    return this.db.prepare('SELECT * FROM bid_results WHERE project_no = ? ORDER BY rank').all(projectNo);
  }

  insertRiskEvent(event) {
    const stmt = this.db.prepare(`
      INSERT INTO risk_events (project_id, project_no, project_name, risk_type, risk_score, risk_details, evidence_screenshot, evidence_html, evidence_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.projectId || null,
      event.projectNo || null,
      event.projectName || null,
      event.riskType,
      event.riskScore,
      event.riskDetails ? JSON.stringify(event.riskDetails) : null,
      event.evidenceScreenshot || null,
      event.evidenceHtml || null,
      event.evidenceHash || null,
      event.status || 'pending'
    );

    return result.lastInsertRowid;
  }

  getHighRiskEvents(threshold = 70, limit = 100) {
    return this.db.prepare(`
      SELECT * FROM risk_events
      WHERE risk_score >= ?
      ORDER BY risk_score DESC, created_at DESC
      LIMIT ?
    `).all(threshold, limit);
  }

  getRiskEventsByDate(startDate, endDate) {
    return this.db.prepare(`
      SELECT * FROM risk_events
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY risk_score DESC
    `).all(startDate, endDate);
  }

  insertBidderRelation(relation) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO bidder_relations (bidder_a_id, bidder_b_id, relation_type, relation_value)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(
      relation.bidderAId,
      relation.bidderBId,
      relation.relationType,
      relation.relationValue || null
    );
  }

  getBidderRelations(bidderId) {
    return this.db.prepare(`
      SELECT br.*, b1.name as bidder_a_name, b2.name as bidder_b_name
      FROM bidder_relations br
      JOIN bidders b1 ON br.bidder_a_id = b1.id
      JOIN bidders b2 ON br.bidder_b_id = b2.id
      WHERE br.bidder_a_id = ? OR br.bidder_b_id = ?
    `).all(bidderId, bidderId);
  }

  getBiddersWithSamePhone() {
    return this.db.prepare(`
      SELECT phone, COUNT(*) as cnt, GROUP_CONCAT(name) as bidders
      FROM bidders
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING cnt > 1
      ORDER BY cnt DESC
    `).all();
  }

  getBiddersWithSameAddress() {
    return this.db.prepare(`
      SELECT address, COUNT(*) as cnt, GROUP_CONCAT(name) as bidders
      FROM bidders
      WHERE address IS NOT NULL AND address != ''
      GROUP BY address
      HAVING cnt > 1
      ORDER BY cnt DESC
    `).all();
  }

  updateCrawlTask(platform, taskType, data) {
    const existing = this.db.prepare('SELECT id FROM crawl_tasks WHERE platform = ? AND task_type = ?').get(platform, taskType);

    if (existing) {
      const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
      const values = Object.values(data);
      values.push(platform, taskType);
      this.db.prepare(`UPDATE crawl_tasks SET ${fields}, updated_at = datetime('now') WHERE platform = ? AND task_type = ?`).run(...values);
    } else {
      const fields = ['platform', 'task_type', ...Object.keys(data)].join(', ');
      const placeholders = ['?', '?', ...Object.keys(data).map(() => '?')].join(', ');
      const values = [platform, taskType, ...Object.values(data)];
      this.db.prepare(`INSERT INTO crawl_tasks (${fields}) VALUES (${placeholders})`).run(...values);
    }
  }

  getCrawlTasks() {
    return this.db.prepare('SELECT * FROM crawl_tasks ORDER BY updated_at DESC').all();
  }

  addCrawlLog(log) {
    const stmt = this.db.prepare(`
      INSERT INTO crawl_logs (platform, task_type, page, items_count, status, error_msg, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      log.platform || null,
      log.taskType || null,
      log.page || null,
      log.itemsCount || 0,
      log.status || 'success',
      log.errorMsg || null,
      log.durationMs || null
    ).lastInsertRowid;
  }

  getStats() {
    const projectCount = this.db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
    const bidderCount = this.db.prepare('SELECT COUNT(*) as cnt FROM bidders').get().cnt;
    const riskCount = this.db.prepare('SELECT COUNT(*) as cnt FROM risk_events').get().cnt;
    const highRiskCount = this.db.prepare('SELECT COUNT(*) as cnt FROM risk_events WHERE risk_score >= 85').get().cnt;
    const todayProjects = this.db.prepare(`SELECT COUNT(*) as cnt FROM projects WHERE date(publish_date) = date('now')`).get().cnt;

    return {
      projectCount,
      bidderCount,
      riskCount,
      highRiskCount,
      todayProjects,
    };
  }

  close() {
    this.db.close();
  }
}

let instance = null;

function getStore() {
  if (!instance) {
    instance = new Store();
  }
  return instance;
}

module.exports = {
  Store,
  getStore,
};
