const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { getConfig } = require('../config');
const { getLogger } = require('../logger/appLogger');

let dbInstance = null;
const logger = getLogger();

function initDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getConfig('database.path', './data/trademark_monitor.db');
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error('Failed to open database:', err.message);
      throw err;
    }
    logger.info('Database connected successfully');
  });

  dbInstance.serialize(() => {
    createTables();
    createIndexes();
  });

  return dbInstance;
}

function createTables() {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_number TEXT UNIQUE NOT NULL,
      announcement_date DATE,
      total_trademarks INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      download_path TEXT,
      processed_at DATETIME,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trademarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_id INTEGER,
      trademark_name TEXT NOT NULL,
      applicant TEXT,
      application_number TEXT,
      registration_number TEXT,
      class_number TEXT,
      announcement_type TEXT,
      announcement_date DATE,
      raw_data TEXT,
      pdf_page INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (announcement_id) REFERENCES announcements (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS client_trademarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      client_name TEXT,
      trademark_name TEXT NOT NULL,
      class_number TEXT,
      application_number TEXT,
      contact_email TEXT,
      contact_name TEXT,
      risk_threshold TEXT DEFAULT 'medium',
      instant_alert INTEGER DEFAULT 1,
      weekly_summary INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, trademark_name, class_number)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS match_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trademark_id INTEGER NOT NULL,
      client_trademark_id INTEGER NOT NULL,
      match_type TEXT NOT NULL,
      similarity_score REAL,
      risk_level TEXT,
      is_opposable INTEGER DEFAULT 0,
      opposition_deadline DATE,
      matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trademark_id) REFERENCES trademarks (id),
      FOREIGN KEY (client_trademark_id) REFERENCES client_trademarks (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER,
      client_id TEXT,
      notification_type TEXT,
      channel TEXT,
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      subject TEXT,
      recipient TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES match_results (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS processing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_number TEXT,
      operation TEXT,
      status TEXT,
      records_processed INTEGER,
      duration_ms INTEGER,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function createIndexes() {
  const db = getDatabase();
  
  db.run('CREATE INDEX IF NOT EXISTS idx_trademarks_name ON trademarks(trademark_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trademarks_class ON trademarks(class_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_trademarks_announcement ON trademarks(announcement_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_match_results_client ON match_results(client_trademark_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_match_results_risk ON match_results(risk_level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)');
}

function getDatabase() {
  if (!dbInstance) {
    initDatabase();
  }
  return dbInstance;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function saveAnnouncement(announcementData) {
  const existing = await getQuery(
    'SELECT id FROM announcements WHERE announcement_number = ?',
    [announcementData.announcement_number]
  );

  if (existing) {
    await runQuery(
      `UPDATE announcements SET 
        announcement_date = COALESCE(?, announcement_date),
        total_trademarks = COALESCE(?, total_trademarks),
        status = COALESCE(?, status),
        download_path = COALESCE(?, download_path),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        announcementData.announcement_date,
        announcementData.total_trademarks,
        announcementData.status,
        announcementData.download_path,
        existing.id
      ]
    );
    return existing.id;
  } else {
    const result = await runQuery(
      `INSERT INTO announcements 
        (announcement_number, announcement_date, total_trademarks, status, download_path)
       VALUES (?, ?, ?, ?, ?)`,
      [
        announcementData.announcement_number,
        announcementData.announcement_date,
        announcementData.total_trademarks || 0,
        announcementData.status || 'pending',
        announcementData.download_path
      ]
    );
    return result.lastID;
  }
}

async function saveTrademarks(trademarks, announcementId) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO trademarks 
      (announcement_id, trademark_name, applicant, application_number, 
       registration_number, class_number, announcement_type, announcement_date, 
       raw_data, pdf_page)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      trademarks.forEach(tm => {
        stmt.run([
          announcementId,
          tm.trademarkName || tm.trademark_name,
          tm.applicant,
          tm.applicationNumber || tm.application_number,
          tm.registrationNumber || tm.registration_number,
          tm.classNumber || tm.class_number,
          tm.announcementType || tm.announcement_type,
          tm.announcementDate || tm.announcement_date,
          JSON.stringify(tm.rawData || tm.raw_data || tm),
          tm.pdfPage || tm.pdf_page
        ]);
      });

      stmt.finalize(err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) reject(commitErr);
            else resolve(trademarks.length);
          });
        }
      });
    });
  });
}

async function saveMatchResults(matches) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO match_results 
      (trademark_id, client_trademark_id, match_type, similarity_score, 
       risk_level, is_opposable, opposition_deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      matches.forEach(match => {
        stmt.run([
          match.trademarkId,
          match.clientTrademarkId,
          match.matchType,
          match.similarityScore,
          match.riskLevel,
          match.isOpposable ? 1 : 0,
          match.oppositionDeadline
        ]);
      });

      stmt.finalize(err => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) reject(commitErr);
            else resolve(matches.length);
          });
        }
      });
    });
  });
}

async function syncClientTrademarks(clientTrademarks) {
  for (const ct of clientTrademarks) {
    const existing = await getQuery(
      `SELECT id FROM client_trademarks 
       WHERE client_id = ? AND trademark_name = ? AND class_number = ?`,
      [ct.clientId, ct.name, ct.classNumber]
    );

    if (existing) {
      await runQuery(
        `UPDATE client_trademarks SET
          client_name = ?,
          application_number = ?,
          contact_email = ?,
          contact_name = ?,
          risk_threshold = ?,
          instant_alert = ?,
          weekly_summary = ?
         WHERE id = ?`,
        [
          ct.clientName,
          ct.applicationNumber,
          ct.contact?.email,
          ct.contact?.name,
          ct.notificationPreferences?.riskLevelThreshold || 'medium',
          ct.notificationPreferences?.instantAlert ? 1 : 0,
          ct.notificationPreferences?.weeklySummary ? 1 : 0,
          existing.id
        ]
      );
    } else {
      await runQuery(
        `INSERT INTO client_trademarks
          (client_id, client_name, trademark_name, class_number, application_number,
           contact_email, contact_name, risk_threshold, instant_alert, weekly_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ct.clientId,
          ct.clientName,
          ct.name,
          ct.classNumber,
          ct.applicationNumber,
          ct.contact?.email,
          ct.contact?.name,
          ct.notificationPreferences?.riskLevelThreshold || 'medium',
          ct.notificationPreferences?.instantAlert ? 1 : 0,
          ct.notificationPreferences?.weeklySummary ? 1 : 0
        ]
      );
    }
  }
}

async function getPendingAnnouncements() {
  return allQuery(
    `SELECT * FROM announcements 
     WHERE status IN ('pending', 'failed') 
       AND retry_count < ?
     ORDER BY announcement_date DESC`,
    [getConfig('system.retry.maxAttempts', 3)]
  );
}

async function getProcessedAnnouncementNumbers() {
  const rows = await allQuery(
    `SELECT announcement_number FROM announcements WHERE status = 'processed'`
  );
  return rows.map(r => r.announcement_number);
}

async function updateAnnouncementStatus(announcementNumber, status, errorMessage = null) {
  const updates = [status, new Date().toISOString()];
  let sql = `UPDATE announcements SET status = ?, updated_at = CURRENT_TIMESTAMP`;
  
  if (status === 'processing') {
    sql += `, processed_at = ?`;
    updates.push(new Date().toISOString());
  }
  
  if (errorMessage) {
    sql += `, error_message = ?, retry_count = retry_count + 1`;
    updates.push(errorMessage);
  }
  
  sql += ` WHERE announcement_number = ?`;
  updates.push(announcementNumber);
  
  return runQuery(sql, updates);
}

async function getAllClientTrademarks() {
  return allQuery('SELECT * FROM client_trademarks');
}

async function getTrademarksByAnnouncementId(announcementId) {
  return allQuery('SELECT * FROM trademarks WHERE announcement_id = ?', [announcementId]);
}

async function getUnsentNotifications() {
  return allQuery(
    `SELECT n.*, m.*, ct.*, t.*
     FROM notifications n
     JOIN match_results m ON n.match_id = m.id
     JOIN client_trademarks ct ON m.client_trademark_id = ct.id
     JOIN trademarks t ON m.trademark_id = t.id
     WHERE n.status IN ('pending', 'failed') AND n.retry_count < ?`,
    [getConfig('system.retry.maxAttempts', 3)]
  );
}

async function saveNotification(notification) {
  return runQuery(
    `INSERT INTO notifications
      (match_id, client_id, notification_type, channel, subject, recipient)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      notification.matchId,
      notification.clientId,
      notification.notificationType,
      notification.channel,
      notification.subject,
      notification.recipient
    ]
  );
}

async function updateNotificationStatus(notificationId, status, errorMessage = null) {
  const updates = [status];
  let sql = `UPDATE notifications SET status = ?`;
  
  if (status === 'sent') {
    sql += `, sent_at = CURRENT_TIMESTAMP`;
  }
  
  if (errorMessage) {
    sql += `, error_message = ?, retry_count = retry_count + 1`;
    updates.push(errorMessage);
  }
  
  sql += ` WHERE id = ?`;
  updates.push(notificationId);
  
  return runQuery(sql, updates);
}

async function getMatchesByClient(clientId, startDate = null, endDate = null) {
  let sql = `
    SELECT m.*, t.*, ct.client_name, ct.trademark_name as client_trademark_name
    FROM match_results m
    JOIN trademarks t ON m.trademark_id = t.id
    JOIN client_trademarks ct ON m.client_trademark_id = ct.id
    WHERE ct.client_id = ?
  `;
  const params = [clientId];
  
  if (startDate) {
    sql += ` AND m.matched_at >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND m.matched_at <= ?`;
    params.push(endDate);
  }
  
  sql += ` ORDER BY m.matched_at DESC`;
  
  return allQuery(sql, params);
}

async function getStatistics(startDate, endDate) {
  const stats = {};

  stats.byClient = await allQuery(
    `SELECT ct.client_id, ct.client_name, COUNT(*) as match_count,
            SUM(CASE WHEN m.risk_level = 'high' THEN 1 ELSE 0 END) as high_risk_count,
            SUM(CASE WHEN m.risk_level = 'medium' THEN 1 ELSE 0 END) as medium_risk_count
     FROM match_results m
     JOIN client_trademarks ct ON m.client_trademark_id = ct.id
     WHERE m.matched_at BETWEEN ? AND ?
     GROUP BY ct.client_id, ct.client_name
     ORDER BY match_count DESC`,
    [startDate, endDate]
  );

  stats.byClass = await allQuery(
    `SELECT t.class_number, COUNT(*) as count
     FROM match_results m
     JOIN trademarks t ON m.trademark_id = t.id
     WHERE m.matched_at BETWEEN ? AND ?
     GROUP BY t.class_number
     ORDER BY count DESC`,
    [startDate, endDate]
  );

  stats.byAnnouncementType = await allQuery(
    `SELECT t.announcement_type, COUNT(*) as count
     FROM match_results m
     JOIN trademarks t ON m.trademark_id = t.id
     WHERE m.matched_at BETWEEN ? AND ?
     GROUP BY t.announcement_type
     ORDER BY count DESC`,
    [startDate, endDate]
  );

  stats.totalAnnouncements = await getQuery(
    `SELECT COUNT(*) as count, 
            SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed_count
     FROM announcements
     WHERE created_at BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  stats.totalTrademarks = await getQuery(
    `SELECT COUNT(*) as count FROM trademarks
     WHERE created_at BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  return stats;
}

async function getOppositionDeadlines(thresholdDays = 30) {
  const thresholdDate = moment().add(thresholdDays, 'days').format('YYYY-MM-DD');
  return allQuery(
    `SELECT m.*, t.*, ct.*,
            julianday(m.opposition_deadline) - julianday('now') as days_remaining
     FROM match_results m
     JOIN trademarks t ON m.trademark_id = t.id
     JOIN client_trademarks ct ON m.client_trademark_id = ct.id
     WHERE m.is_opposable = 1 
       AND m.opposition_deadline IS NOT NULL
       AND m.opposition_deadline <= ?
       AND m.opposition_deadline >= date('now')
     ORDER BY m.opposition_deadline ASC`,
    [thresholdDate]
  );
}

async function logProcessing(announcementNumber, operation, status, recordsProcessed, durationMs, errorMessage = null) {
  return runQuery(
    `INSERT INTO processing_logs
      (announcement_number, operation, status, records_processed, duration_ms, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [announcementNumber, operation, status, recordsProcessed, durationMs, errorMessage]
  );
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        logger.error('Error closing database:', err.message);
      } else {
        logger.info('Database closed successfully');
      }
    });
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  saveAnnouncement,
  saveTrademarks,
  saveMatchResults,
  syncClientTrademarks,
  getPendingAnnouncements,
  getProcessedAnnouncementNumbers,
  updateAnnouncementStatus,
  getAllClientTrademarks,
  getTrademarksByAnnouncementId,
  getUnsentNotifications,
  saveNotification,
  updateNotificationStatus,
  getMatchesByClient,
  getStatistics,
  getOppositionDeadlines,
  logProcessing,
  closeDatabase,
  runQuery,
  getQuery,
  allQuery
};
