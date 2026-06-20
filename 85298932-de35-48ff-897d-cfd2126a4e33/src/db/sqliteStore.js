const path = require('path');
const fs = require('fs-extra');
const logger = require('../logger');
const configLoader = require('../configLoader');

let Database = null;
let useFallback = false;

try {
  Database = require('better-sqlite3');
  useFallback = false;
} catch (e) {
  logger.warn('[store] better-sqlite3 不可用，使用内存+JSON fallback 存储');
  useFallback = true;
}

class SqliteStore {
  constructor() {
    const storageCfg = configLoader.getStorageConfig();
    this.dbPath = path.resolve(storageCfg.sqlitePath || './data/assessment.db');
    this.maxRecordsPerTable = storageCfg.maxRecordsPerTable || 100000;
    this.jsonPath = path.resolve('./data/store_backup.json');
    fs.ensureDirSync(path.dirname(this.dbPath));

    if (!useFallback) {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this._initSchema();
        this._initIndexes();
        return;
      } catch (e) {
        logger.warn(`[store] SQLite初始化失败，切换到fallback: ${e.message}`);
        useFallback = true;
      }
    }

    this._initFallbackStore();
  }

  _initFallbackStore() {
    this._data = {
      batches: {},
      participants: [],
      assessment_tasks: [],
      account_sessions: {},
      operation_logs: [],
      _logCounter: 0
    };
    try {
      if (fs.existsSync(this.jsonPath)) {
        const saved = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
        Object.assign(this._data, saved);
      }
    } catch (e) {
      logger.warn(`[store] 读取JSON备份失败: ${e.message}`);
    }
  }

  _persistFallback() {
    try {
      fs.writeFileSync(this.jsonPath, JSON.stringify(this._data, null, 2));
    } catch (e) { /* ignore */ }
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        enterprise_name TEXT NOT NULL,
        scale_codes TEXT NOT NULL,
        time_window_start TEXT,
        time_window_end TEXT,
        priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        total_participants INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        report_archive_dir TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error_msg TEXT
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        employee_id TEXT,
        department TEXT,
        email TEXT,
        phone TEXT,
        extra_data TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_tasks (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        scale_code TEXT NOT NULL,
        account_id TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        assessment_url TEXT,
        report_url TEXT,
        report_path TEXT,
        report_file_name TEXT,
        started_at TEXT,
        completed_at TEXT,
        last_heartbeat TEXT,
        error_msg TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_sessions (
        account_id TEXT PRIMARY KEY,
        session_cookie TEXT,
        session_expire_at TEXT,
        last_heartbeat TEXT,
        status TEXT DEFAULT 'offline',
        current_concurrency INTEGER DEFAULT 0,
        error_msg TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        module TEXT,
        message TEXT NOT NULL,
        details TEXT
      );
    `);
  }

  _initIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON assessment_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_account ON assessment_tasks(account_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_batch ON assessment_tasks(batch_id);
      CREATE INDEX IF NOT EXISTS idx_participants_batch ON participants(batch_id);
      CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
      CREATE INDEX IF NOT EXISTS idx_logs_ts ON operation_logs(timestamp);
    `);
  }

  _now() {
    return new Date().toISOString();
  }

  cleanOldRecords() {
    try {
      const tables = ['assessment_tasks', 'participants', 'batches', 'operation_logs'];
      for (const table of tables) {
        if (!useFallback) {
          const countRow = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get();
          if (countRow.cnt > this.maxRecordsPerTable) {
            const deleteCount = countRow.cnt - this.maxRecordsPerTable;
            if (table === 'operation_logs') {
              this.db.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} ORDER BY id ASC LIMIT ?)`).run(deleteCount);
            } else {
              this.db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} ORDER BY created_at ASC LIMIT ?)`).run(deleteCount);
            }
            logger.info(`[store] 清理${table}表旧记录 ${deleteCount} 条`);
          }
        } else {
          const arr = this._data[table] || [];
          if (Array.isArray(arr) && arr.length > this.maxRecordsPerTable) {
            this._data[table] = arr.slice(arr.length - this.maxRecordsPerTable);
          }
        }
      }
      if (useFallback) this._persistFallback();
    } catch (err) {
      logger.error(`[store] 清理旧记录失败: ${err.message}`);
    }
  }

  insertBatch(batch) {
    const now = this._now();
    if (!useFallback) {
      const stmt = this.db.prepare(`
        INSERT INTO batches (id, enterprise_name, scale_codes, time_window_start, time_window_end,
          priority, status, total_participants, report_archive_dir, created_at, updated_at)
        VALUES (@id, @enterprise_name, @scale_codes, @time_window_start, @time_window_end,
          @priority, @status, @total_participants, @report_archive_dir, @created_at, @updated_at)
      `);
      stmt.run({
        ...batch,
        scale_codes: JSON.stringify(batch.scale_codes || []),
        created_at: now,
        updated_at: now
      });
    } else {
      this._data.batches[batch.id] = {
        ...batch,
        scale_codes: JSON.stringify(batch.scale_codes || []),
        created_at: now,
        updated_at: now
      };
      this._persistFallback();
    }
  }

  updateBatchStatus(batchId, status, extra = {}) {
    const now = this._now();
    const fields = ['status', 'completed_count', 'failed_count', 'error_msg', 'report_archive_dir'];
    if (!useFallback) {
      const sets = ['updated_at = ?'];
      const values = [now];
      if (status !== undefined) { sets.push('status = ?'); values.push(status); }
      for (const f of fields) {
        if (extra[f] !== undefined) { sets.push(`${f} = ?`); values.push(extra[f]); }
      }
      values.push(batchId);
      this.db.prepare(`UPDATE batches SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    } else {
      const b = this._data.batches[batchId];
      if (b) {
        b.updated_at = now;
        if (status !== undefined) b.status = status;
        for (const f of fields) if (extra[f] !== undefined) b[f] = extra[f];
        this._persistFallback();
      }
    }
  }

  getBatch(batchId) {
    let row;
    if (!useFallback) {
      row = this.db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    } else {
      row = this._data.batches[batchId] || null;
    }
    if (row && typeof row.scale_codes === 'string') {
      row = { ...row, scale_codes: JSON.parse(row.scale_codes || '[]') };
    }
    return row;
  }

  listBatches(status) {
    let rows;
    if (!useFallback) {
      rows = status
        ? this.db.prepare('SELECT * FROM batches WHERE status = ? ORDER BY created_at DESC').all(status)
        : this.db.prepare('SELECT * FROM batches ORDER BY created_at DESC LIMIT 100').all();
    } else {
      rows = Object.values(this._data.batches)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, 100);
      if (status) rows = rows.filter(r => r.status === status);
    }
    return rows.map(r => ({ ...r, scale_codes: typeof r.scale_codes === 'string' ? JSON.parse(r.scale_codes || '[]') : (r.scale_codes || []) }));
  }

  insertParticipants(batchId, participants) {
    const now = this._now();
    if (!useFallback) {
      const stmt = this.db.prepare(`
        INSERT INTO participants (id, batch_id, name, employee_id, department, email, phone, extra_data, created_at)
        VALUES (@id, @batch_id, @name, @employee_id, @department, @email, @phone, @extra_data, @created_at)
      `);
      const tx = this.db.transaction((list) => {
        for (const p of list) stmt.run({ ...p, batch_id: batchId, created_at: now, extra_data: JSON.stringify(p.extra_data || {}) });
      });
      tx(participants);
    } else {
      for (const p of participants) {
        this._data.participants.push({ ...p, batch_id: batchId, created_at: now, extra_data: JSON.stringify(p.extra_data || {}) });
      }
      this._persistFallback();
    }
  }

  listParticipants(batchId) {
    if (!useFallback) {
      return this.db.prepare('SELECT * FROM participants WHERE batch_id = ?').all(batchId);
    }
    return this._data.participants.filter(p => p.batch_id === batchId);
  }

  insertTasks(tasks) {
    const now = this._now();
    if (!useFallback) {
      const stmt = this.db.prepare(`
        INSERT INTO assessment_tasks (id, batch_id, participant_id, scale_code, status, priority, created_at, updated_at)
        VALUES (@id, @batch_id, @participant_id, @scale_code, @status, @priority, @created_at, @updated_at)
      `);
      const tx = this.db.transaction((list) => {
        for (const t of list) stmt.run({ ...t, created_at: now, updated_at: now });
      });
      tx(tasks);
    } else {
      for (const t of tasks) {
        this._data.assessment_tasks.push({ ...t, created_at: now, updated_at: now });
      }
      this._persistFallback();
    }
  }

  updateTask(taskId, fields) {
    const now = this._now();
    const keys = Object.keys(fields).filter(k => fields[k] !== undefined);
    if (keys.length === 0) return;
    if (!useFallback) {
      const sets = [...keys.map(k => `${k} = ?`), 'updated_at = ?'];
      const values = [...keys.map(k => fields[k]), now, taskId];
      this.db.prepare(`UPDATE assessment_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    } else {
      const t = this._data.assessment_tasks.find(x => x.id === taskId);
      if (t) {
        t.updated_at = now;
        for (const k of keys) t[k] = fields[k];
        this._persistFallback();
      }
    }
  }

  getTasksByBatch(batchId) {
    if (!useFallback) {
      return this.db.prepare('SELECT * FROM assessment_tasks WHERE batch_id = ?').all(batchId);
    }
    return this._data.assessment_tasks.filter(t => t.batch_id === batchId);
  }

  _findParticipantByIdFallback(id) {
    return this._data.participants.find(p => p.id === id) || {};
  }

  getPendingTasks(limit = 100) {
    if (!useFallback) {
      return this.db.prepare(`
        SELECT t.*, p.name as participant_name, p.employee_id
        FROM assessment_tasks t
        LEFT JOIN participants p ON t.participant_id = p.id
        WHERE t.status = 'pending'
        ORDER BY t.priority DESC, t.created_at ASC
        LIMIT ?
      `).all(limit);
    }
    return this._data.assessment_tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => (b.priority - a.priority) || (a.created_at || '').localeCompare(b.created_at || ''))
      .slice(0, limit)
      .map(t => {
        const p = this._findParticipantByIdFallback(t.participant_id);
        return { ...t, participant_name: p.name, employee_id: p.employee_id };
      });
  }

  getRunningTasks() {
    if (!useFallback) {
      return this.db.prepare(`
        SELECT t.*, p.name as participant_name
        FROM assessment_tasks t
        LEFT JOIN participants p ON t.participant_id = p.id
        WHERE t.status = 'running'
        ORDER BY t.last_heartbeat ASC
      `).all();
    }
    return this._data.assessment_tasks
      .filter(t => t.status === 'running')
      .sort((a, b) => (a.last_heartbeat || '').localeCompare(b.last_heartbeat || ''))
      .map(t => {
        const p = this._findParticipantByIdFallback(t.participant_id);
        return { ...t, participant_name: p.name };
      });
  }

  getTasksForReportDownload() {
    if (!useFallback) {
      return this.db.prepare(`
        SELECT t.*, p.name as participant_name, b.enterprise_name
        FROM assessment_tasks t
        LEFT JOIN participants p ON t.participant_id = p.id
        LEFT JOIN batches b ON t.batch_id = b.id
        WHERE t.status = 'completed' AND t.report_path IS NULL
        ORDER BY t.completed_at ASC
        LIMIT 50
      `).all();
    }
    return this._data.assessment_tasks
      .filter(t => t.status === 'completed' && !t.report_path)
      .sort((a, b) => (a.completed_at || '').localeCompare(b.completed_at || ''))
      .slice(0, 50)
      .map(t => {
        const p = this._findParticipantByIdFallback(t.participant_id);
        const b = this._data.batches[t.batch_id] || {};
        return { ...t, participant_name: p.name, enterprise_name: b.enterprise_name };
      });
  }

  incrementTaskRetry(taskId) {
    if (!useFallback) {
      this.db.prepare('UPDATE assessment_tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?')
        .run(this._now(), taskId);
      return this.db.prepare('SELECT retry_count FROM assessment_tasks WHERE id = ?').get(taskId).retry_count;
    }
    const t = this._data.assessment_tasks.find(x => x.id === taskId);
    if (t) {
      t.retry_count = (t.retry_count || 0) + 1;
      t.updated_at = this._now();
      this._persistFallback();
      return t.retry_count;
    }
    return 0;
  }

  upsertAccountSession(accountId, session) {
    const now = this._now();
    if (!useFallback) {
      const existing = this.db.prepare('SELECT account_id FROM account_sessions WHERE account_id = ?').get(accountId);
      if (existing) {
        this.db.prepare(`
          UPDATE account_sessions SET session_cookie = ?, session_expire_at = ?,
            last_heartbeat = ?, status = ?, current_concurrency = ?, error_msg = ?, updated_at = ?
          WHERE account_id = ?
        `).run(session.session_cookie || null, session.session_expire_at || null,
          session.last_heartbeat || now, session.status || 'offline',
          session.current_concurrency || 0, session.error_msg || null, now, accountId);
      } else {
        this.db.prepare(`
          INSERT INTO account_sessions (account_id, session_cookie, session_expire_at,
            last_heartbeat, status, current_concurrency, error_msg, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(accountId, session.session_cookie || null, session.session_expire_at || null,
          session.last_heartbeat || now, session.status || 'offline',
          session.current_concurrency || 0, session.error_msg || null, now, now);
      }
    } else {
      const existing = this._data.account_sessions[accountId];
      if (existing) {
        Object.assign(existing, {
          session_cookie: session.session_cookie || null,
          session_expire_at: session.session_expire_at || null,
          last_heartbeat: session.last_heartbeat || now,
          status: session.status || 'offline',
          current_concurrency: session.current_concurrency || 0,
          error_msg: session.error_msg || null,
          updated_at: now
        });
      } else {
        this._data.account_sessions[accountId] = {
          account_id: accountId,
          session_cookie: session.session_cookie || null,
          session_expire_at: session.session_expire_at || null,
          last_heartbeat: session.last_heartbeat || now,
          status: session.status || 'offline',
          current_concurrency: session.current_concurrency || 0,
          error_msg: session.error_msg || null,
          created_at: now,
          updated_at: now
        };
      }
      this._persistFallback();
    }
  }

  listAccountSessions() {
    if (!useFallback) {
      return this.db.prepare('SELECT * FROM account_sessions ORDER BY account_id').all();
    }
    return Object.values(this._data.account_sessions).sort((a, b) => a.account_id.localeCompare(b.account_id));
  }

  logOperation(level, module, message, details) {
    if (!useFallback) {
      this.db.prepare(`
        INSERT INTO operation_logs (timestamp, level, module, message, details)
        VALUES (?, ?, ?, ?, ?)
      `).run(this._now(), level, module, message, details ? JSON.stringify(details) : null);
    } else {
      this._data.operation_logs.push({
        id: ++this._data._logCounter,
        timestamp: this._now(),
        level,
        module,
        message,
        details: details ? JSON.stringify(details) : null
      });
      this._persistFallback();
    }
  }

  getDashboardSummary() {
    let tasks, batches;
    if (!useFallback) {
      tasks = this.db.prepare(`SELECT status, COUNT(*) as cnt FROM assessment_tasks GROUP BY status`).all();
      batches = this.db.prepare(`SELECT status, COUNT(*) as cnt FROM batches GROUP BY status`).all();
    } else {
      const taskMap = {};
      for (const t of this._data.assessment_tasks) taskMap[t.status] = (taskMap[t.status] || 0) + 1;
      tasks = Object.entries(taskMap).map(([status, cnt]) => ({ status, cnt }));
      const batchMap = {};
      for (const b of Object.values(this._data.batches)) batchMap[b.status] = (batchMap[b.status] || 0) + 1;
      batches = Object.entries(batchMap).map(([status, cnt]) => ({ status, cnt }));
    }
    const taskSummary = tasks.reduce((acc, r) => { acc[r.status] = r.cnt; return acc; }, {});
    const batchSummary = batches.reduce((acc, r) => { acc[r.status] = r.cnt; return acc; }, {});
    return { tasks: taskSummary, batches: batchSummary };
  }

  close() {
    try { if (this.db) this.db.close(); } catch (e) { /* ignore */ }
    if (useFallback) this._persistFallback();
  }
}

module.exports = new SqliteStore();
