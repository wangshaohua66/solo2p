const Database = require('better-sqlite3');
const path = require('path');
const { dbConfig } = require('../config/carriers');
const { runMigrations } = require('./migrations');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const { db } = runMigrations();
    dbInstance = db;
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function now() {
  return new Date().toISOString();
}

const rateSnapshots = {
  insertBatch(records) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO rate_snapshots 
      (carrier_id, carrier_name, port_from, port_to, container_type, 
       base_rate, currency, valid_from, valid_to, surcharges_total, 
       total_rate, collected_at, source_url, change_from_previous, change_percent)
      VALUES (@carrier_id, @carrier_name, @port_from, @port_to, @container_type,
              @base_rate, @currency, @valid_from, @valid_to, @surcharges_total,
              @total_rate, @collected_at, @source_url, @change_from_previous, @change_percent)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        if (!record.collected_at) record.collected_at = now();
        if (record.change_from_previous === undefined) record.change_from_previous = null;
        if (record.change_percent === undefined) record.change_percent = null;
        stmt.run(record);
      }
    });
    
    insertMany(records);
    return records.length;
  },

  getLatest(carrierId, portFrom, portTo, containerType) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rate_snapshots 
      WHERE carrier_id = ? AND port_from = ? AND port_to = ? AND container_type = ?
      ORDER BY collected_at DESC
      LIMIT 1
    `).get(carrierId, portFrom, portTo, containerType);
  },

  getByRouteAndPeriod(portFrom, portTo, containerType, days = 30) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rate_snapshots 
      WHERE port_from = ? AND port_to = ? AND container_type = ?
        AND collected_at >= datetime('now', '-' || ? || ' days')
      ORDER BY collected_at DESC
    `).all(portFrom, portTo, containerType, days);
  },

  getAverageByRoute(portFrom, portTo, containerType, days = 30) {
    const db = getDb();
    return db.prepare(`
      SELECT AVG(total_rate) as avg_rate, COUNT(*) as count, 
             MIN(total_rate) as min_rate, MAX(total_rate) as max_rate
      FROM rate_snapshots 
      WHERE port_from = ? AND port_to = ? AND container_type = ?
        AND collected_at >= datetime('now', '-' || ? || ' days')
    `).get(portFrom, portTo, containerType, days);
  },

  getLatestByCarrier(carrierId, limit = 50) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM rate_snapshots 
      WHERE carrier_id = ?
      ORDER BY collected_at DESC
      LIMIT ?
    `).all(carrierId, limit);
  },

  getAllLatest(limit = 100) {
    const db = getDb();
    return db.prepare(`
      SELECT r.* FROM rate_snapshots r
      INNER JOIN (
        SELECT carrier_id, port_from, port_to, container_type, MAX(collected_at) as latest
        FROM rate_snapshots
        GROUP BY carrier_id, port_from, port_to, container_type
      ) latest ON r.carrier_id = latest.carrier_id 
        AND r.port_from = latest.port_from 
        AND r.port_to = latest.port_to 
        AND r.container_type = latest.container_type
        AND r.collected_at = latest.latest
      ORDER BY r.carrier_id, r.port_from, r.port_to
      LIMIT ?
    `).all(limit);
  }
};

const spaceStatus = {
  insertBatch(records) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO space_status
      (carrier_id, carrier_name, port_from, port_to, container_type,
       available_count, status, status_text, vessel_name, voyage_number,
       departure_date, collected_at)
      VALUES (@carrier_id, @carrier_name, @port_from, @port_to, @container_type,
              @available_count, @status, @status_text, @vessel_name, @voyage_number,
              @departure_date, @collected_at)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        if (!record.collected_at) record.collected_at = now();
        stmt.run(record);
      }
    });
    
    insertMany(records);
    return records.length;
  },

  getLatest(carrierId, portFrom, portTo, containerType) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM space_status
      WHERE carrier_id = ? AND port_from = ? AND port_to = ? AND container_type = ?
      ORDER BY collected_at DESC
      LIMIT 1
    `).get(carrierId, portFrom, portTo, containerType);
  },

  getByRoute(portFrom, portTo, containerType = null) {
    const db = getDb();
    let sql = `
      SELECT s.* FROM space_status s
      INNER JOIN (
        SELECT carrier_id, MAX(collected_at) as latest
        FROM space_status
        WHERE port_from = ? AND port_to = ?
    `;
    const params = [portFrom, portTo];
    if (containerType) {
      sql += ' AND container_type = ?';
      params.push(containerType);
    }
    sql += `
        GROUP BY carrier_id
      ) latest ON s.carrier_id = latest.carrier_id AND s.collected_at = latest.latest
      WHERE s.port_from = ? AND s.port_to = ?
    `;
    params.push(portFrom, portTo);
    if (containerType) {
      sql += ' AND s.container_type = ?';
      params.push(containerType);
    }
    sql += ' ORDER BY s.available_count DESC';
    
    return db.prepare(sql).all(...params);
  }
};

const schedules = {
  insertBatch(records) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO schedules
      (carrier_id, carrier_name, port_from, port_to, vessel_name,
       voyage_number, departure_date, arrival_date, transit_days,
       service_code, collected_at)
      VALUES (@carrier_id, @carrier_name, @port_from, @port_to, @vessel_name,
              @voyage_number, @departure_date, @arrival_date, @transit_days,
              @service_code, @collected_at)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        if (!record.collected_at) record.collected_at = now();
        stmt.run(record);
      }
    });
    
    insertMany(records);
    return records.length;
  },

  getByRoute(portFrom, portTo, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM schedules
      WHERE port_from = ? AND port_to = ?
        AND departure_date >= date('now')
      ORDER BY departure_date ASC
      LIMIT ?
    `).all(portFrom, portTo, limit);
  },

  getByCarrier(carrierId, portFrom, portTo, limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM schedules
      WHERE carrier_id = ? AND port_from = ? AND port_to = ?
        AND departure_date >= date('now')
      ORDER BY departure_date ASC
      LIMIT ?
    `).all(carrierId, portFrom, portTo, limit);
  }
};

const surchargeChanges = {
  insertBatch(records) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO surcharge_changes
      (carrier_id, carrier_name, surcharge_code, surcharge_name,
       previous_amount, new_amount, currency, effective_date,
       change_type, description, detected_at, source_url)
      VALUES (@carrier_id, @carrier_name, @surcharge_code, @surcharge_name,
              @previous_amount, @new_amount, @currency, @effective_date,
              @change_type, @description, @detected_at, @source_url)
    `);
    
    const insertMany = db.transaction((records) => {
      for (const record of records) {
        if (!record.detected_at) record.detected_at = now();
        stmt.run(record);
      }
    });
    
    insertMany(records);
    return records.length;
  },

  getLatestByCarrier(carrierId, limit = 20) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM surcharge_changes
      WHERE carrier_id = ?
      ORDER BY detected_at DESC
      LIMIT ?
    `).all(carrierId, limit);
  },

  getRecent(days = 7) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM surcharge_changes
      WHERE detected_at >= datetime('now', '-' || ? || ' days')
      ORDER BY detected_at DESC
    `).all(days);
  },

  getLastSurcharge(carrierId, surchargeCode) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM surcharge_changes
      WHERE carrier_id = ? AND surcharge_code = ?
      ORDER BY detected_at DESC
      LIMIT 1
    `).get(carrierId, surchargeCode);
  }
};

const alerts = {
  create(alert) {
    const db = getDb();
    if (!alert.created_at) alert.created_at = now();
    const stmt = db.prepare(`
      INSERT INTO alerts
      (alert_type, severity, carrier_id, carrier_name, port_from,
       port_to, container_type, title, message, previous_value,
       current_value, threshold, status, created_at, metadata)
      VALUES (@alert_type, @severity, @carrier_id, @carrier_name, @port_from,
              @port_to, @container_type, @title, @message, @previous_value,
              @current_value, @threshold, @status, @created_at, @metadata)
    `);
    const result = stmt.run(alert);
    return result.lastInsertRowid;
  },

  getActive(limit = 50) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM alerts
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  },

  getByType(alertType, limit = 50) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM alerts
      WHERE alert_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(alertType, limit);
  },

  getRecent(days = 7) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM alerts
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY created_at DESC
    `).all(days);
  },

  resolve(id) {
    const db = getDb();
    return db.prepare(`
      UPDATE alerts SET status = 'resolved', resolved_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },

  checkExists(alertType, carrierId, portFrom, portTo, containerType) {
    const db = getDb();
    return db.prepare(`
      SELECT id FROM alerts
      WHERE alert_type = ? AND status = 'active'
        AND (carrier_id = ? OR carrier_id IS NULL)
        AND (port_from = ? OR port_from IS NULL)
        AND (port_to = ? OR port_to IS NULL)
        AND (container_type = ? OR container_type IS NULL)
      LIMIT 1
    `).get(alertType, carrierId || null, portFrom || null, portTo || null, containerType || null);
  }
};

const taskLogs = {
  create(log) {
    const db = getDb();
    if (!log.start_time) log.start_time = now();
    if (log.http_status === undefined) log.http_status = null;
    if (log.records_parsed === undefined) log.records_parsed = 0;
    if (log.records_failed === undefined) log.records_failed = 0;
    if (log.duration_ms === undefined) log.duration_ms = null;
    if (log.end_time === undefined) log.end_time = null;
    if (log.error_message === undefined) log.error_message = null;
    if (log.retry_count === undefined) log.retry_count = 0;
    const stmt = db.prepare(`
      INSERT INTO task_logs
      (task_id, carrier_id, carrier_name, task_type, status,
       start_time, end_time, duration_ms, http_status, records_parsed,
       records_failed, error_message, retry_count)
      VALUES (@task_id, @carrier_id, @carrier_name, @task_type, @status,
              @start_time, @end_time, @duration_ms, @http_status, @records_parsed,
              @records_failed, @error_message, @retry_count)
    `);
    const result = stmt.run(log);
    return result.lastInsertRowid;
  },

  update(id, updates) {
    const db = getDb();
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    updates.id = id;
    return db.prepare(`UPDATE task_logs SET ${fields} WHERE id = @id`).run(updates);
  },

  finishTask(id, status, durationMs, recordsParsed = 0, recordsFailed = 0, errorMessage = null) {
    const db = getDb();
    return db.prepare(`
      UPDATE task_logs 
      SET status = ?, end_time = datetime('now'), duration_ms = ?, 
          records_parsed = ?, records_failed = ?, error_message = ?
      WHERE id = ?
    `).run(status, durationMs, recordsParsed, recordsFailed, errorMessage, id);
  },

  getByCarrier(carrierId, limit = 50) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM task_logs
      WHERE carrier_id = ?
      ORDER BY start_time DESC
      LIMIT ?
    `).all(carrierId, limit);
  },

  getByDateRange(startDate, endDate) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM task_logs
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `).all(startDate, endDate);
  },

  getRecent(limit = 100) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM task_logs
      ORDER BY start_time DESC
      LIMIT ?
    `).all(limit);
  },

  getStatsByCarrier() {
    const db = getDb();
    return db.prepare(`
      SELECT carrier_id, carrier_name, 
             COUNT(*) as total_tasks,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
             MAX(start_time) as last_run
      FROM task_logs
      WHERE start_time >= datetime('now', '-1 day')
      GROUP BY carrier_id
      ORDER BY carrier_id
    `).all();
  },

  cleanupOldRecords(retentionDays) {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM task_logs 
      WHERE start_time < datetime('now', '-' || ? || ' days')
    `).run(retentionDays);
    return result.changes;
  }
};

const sessions = {
  save(carrierId, cookies, localStorage, expiresAt = null) {
    const db = getDb();
    const cookieStr = JSON.stringify(cookies || []);
    const storageStr = JSON.stringify(localStorage || {});
    return db.prepare(`
      INSERT OR REPLACE INTO sessions 
      (carrier_id, cookies, localStorage, last_used, expires_at, is_valid)
      VALUES (?, ?, ?, datetime('now'), ?, 1)
    `).run(carrierId, cookieStr, storageStr, expiresAt);
  },

  get(carrierId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sessions WHERE carrier_id = ? AND is_valid = 1').get(carrierId);
    if (row) {
      row.cookies = row.cookies ? JSON.parse(row.cookies) : [];
      row.localStorage = row.localStorage ? JSON.parse(row.localStorage) : {};
    }
    return row;
  },

  invalidate(carrierId) {
    const db = getDb();
    return db.prepare('UPDATE sessions SET is_valid = 0 WHERE carrier_id = ?').run(carrierId);
  },

  updateLastUsed(carrierId) {
    const db = getDb();
    return db.prepare('UPDATE sessions SET last_used = datetime(\'now\') WHERE carrier_id = ?').run(carrierId);
  }
};

module.exports = {
  getDb,
  closeDb,
  rateSnapshots,
  spaceStatus,
  schedules,
  surchargeChanges,
  alerts,
  taskLogs,
  sessions
};
