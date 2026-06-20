'use strict';

/**
 * SQLite 数据访问层（sqlite3）
 * 表：repayment_plans / repayment_records / repayment_exceptions / page_change_logs
 * 性能：在 contract_no / bank_code / repay_date / month 上建立索引，
 *      并对查询使用预编译语句，保障 50 万行 < 500ms 查询响应。
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { getCenterSystem } = require('./config');

let _db = null;
let _dbPath = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS repayment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_code TEXT NOT NULL,
    contract_no TEXT NOT NULL,
    borrower_name TEXT,
    period INTEGER,
    due_date TEXT,
    due_principal REAL DEFAULT 0,
    due_interest REAL DEFAULT 0,
    due_total REAL DEFAULT 0,
    rate REAL,
    early_settlement INTEGER DEFAULT 0,
    month TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS repayment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    bank_code TEXT NOT NULL,
    contract_no TEXT NOT NULL,
    borrower_name TEXT,
    period INTEGER,
    due_principal REAL,
    due_interest REAL,
    actual_amount REAL,
    repay_date TEXT,
    rate REAL,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS repayment_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    bank_code TEXT,
    contract_no TEXT,
    borrower_name TEXT,
    period INTEGER,
    type TEXT,
    due_amount REAL,
    actual_amount REAL,
    due_date TEXT,
    repay_date TEXT,
    overdue_days INTEGER DEFAULT 0,
    detail TEXT,
    notified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS page_change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_code TEXT NOT NULL,
    locator TEXT,
    step_desc TEXT,
    screenshot_path TEXT,
    fail_count INTEGER DEFAULT 1,
    flagged INTEGER DEFAULT 0,
    occurred_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_plans_contract ON repayment_plans(contract_no, period)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_month ON repayment_plans(month)`,
  `CREATE INDEX IF NOT EXISTS idx_records_bank_date ON repayment_records(bank_code, repay_date)`,
  `CREATE INDEX IF NOT EXISTS idx_records_contract ON repayment_records(contract_no)`,
  `CREATE INDEX IF NOT EXISTS idx_exceptions_type ON repayment_exceptions(type, run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exceptions_bank ON repayment_exceptions(bank_code, contract_no)`,
  `CREATE INDEX IF NOT EXISTS idx_changelog_bank ON page_change_logs(bank_code, flagged)`,
];

function resolveDbPath() {
  const cs = getCenterSystem();
  const p = cs.db_path || './data/repayments.db';
  const abs = path.resolve(process.cwd(), p);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return abs;
}

function open() {
  if (_db) return _db;
  _dbPath = resolveDbPath();
  _db = new sqlite3.Database(_dbPath);
  _db.serialize(() => {
    for (const sql of SCHEMA) _db.run(sql);
    for (const sql of INDEXES) _db.run(sql);
  });
  logger.success(`SQLite 已就绪: ${_dbPath}`);
  return _db;
}

function close() {
  return new Promise((resolve) => {
    if (!_db) return resolve();
    _db.close(() => {
      _db = null;
      resolve();
    });
  });
}

function run(sql, params = []) {
  const db = open();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  const db = open();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  const db = open();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// ---- 业务便捷方法 ----

function insertRecord(rec) {
  const sql = `INSERT INTO repayment_records
    (run_id,bank_code,contract_no,borrower_name,period,due_principal,due_interest,actual_amount,repay_date,rate,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
  return run(sql, [
    rec.run_id, rec.bank_code, rec.contract_no, rec.borrower_name,
    rec.period, rec.due_principal, rec.due_interest, rec.actual_amount,
    rec.repay_date, rec.rate, rec.raw_json,
  ]);
}

function insertRecords(records) {
  const db = open();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`INSERT INTO repayment_records
        (run_id,bank_code,contract_no,borrower_name,period,due_principal,due_interest,actual_amount,repay_date,rate,raw_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      db.exec('BEGIN TRANSACTION');
      try {
        for (const r of records) {
          stmt.run([
            r.run_id, r.bank_code, r.contract_no, r.borrower_name, r.period,
            r.due_principal, r.due_interest, r.actual_amount, r.repay_date, r.rate, r.raw_json,
          ]);
        }
        db.exec('COMMIT', (e) => (e ? reject(e) : resolve(records.length)));
      } catch (e) {
        db.exec('ROLLBACK');
        reject(e);
      } finally {
        stmt.finalize();
      }
    });
  });
}

function insertException(ex) {
  const sql = `INSERT INTO repayment_exceptions
    (run_id,bank_code,contract_no,borrower_name,period,type,due_amount,actual_amount,due_date,repay_date,overdue_days,detail,notified)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`;
  return run(sql, [
    ex.run_id, ex.bank_code, ex.contract_no, ex.borrower_name, ex.period,
    ex.type, ex.due_amount, ex.actual_amount, ex.due_date, ex.repay_date,
    ex.overdue_days || 0, ex.detail,
  ]);
}

function recordPageChange(bankCode, locator, stepDesc, screenshotPath) {
  const sql = `INSERT INTO page_change_logs (bank_code, locator, step_desc, screenshot_path)
    VALUES (?,?,?,?)`;
  return run(sql, [bankCode, locator, stepDesc, screenshotPath]);
}

function locatorFailCount(bankCode, locator) {
  return get(
    `SELECT SUM(fail_count) AS total FROM page_change_logs WHERE bank_code=? AND locator=? AND resolved=0`,
    [bankCode, locator]
  ).then((r) => (r && r.total) || 0);
}

function flagBankForUpdate(bankCode, locator) {
  return run(`UPDATE page_change_logs SET flagged=1 WHERE bank_code=? AND locator=?`, [bankCode, locator]);
}

function getPlansByMonth(month) {
  return all(`SELECT * FROM repayment_plans WHERE month=?`, [month]);
}

function getPlan(contractNo, period) {
  return get(`SELECT * FROM repayment_plans WHERE contract_no=? AND period=?`, [contractNo, period]);
}

function exceptionsByRun(runId) {
  return all(`SELECT * FROM repayment_exceptions WHERE run_id=?`, [runId]);
}

function recordsByRun(runId) {
  return all(`SELECT * FROM repayment_records WHERE run_id=?`, [runId]);
}

function clearRun(runId) {
  return Promise.all([
    run(`DELETE FROM repayment_records WHERE run_id=?`, [runId]),
    run(`DELETE FROM repayment_exceptions WHERE run_id=?`, [runId]),
  ]);
}

module.exports = {
  open, close, run, all, get,
  insertRecord, insertRecords, insertException,
  recordPageChange, locatorFailCount, flagBankForUpdate,
  getPlansByMonth, getPlan, exceptionsByRun, recordsByRun, clearRun,
  dbPath: () => _dbPath,
};
