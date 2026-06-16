import Database from 'better-sqlite3';
import { resolve } from 'path';
import { getEnv } from '../config.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('db');

let _db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS vin_batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS dmv_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  registration_date TEXT,
  transfer_count INTEGER,
  usage_type TEXT,
  plate_number TEXT,
  engine_number TEXT,
  vehicle_model TEXT,
  risk_flags TEXT,
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  verified_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS insurance_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  total_claims INTEGER DEFAULT 0,
  total_claim_amount REAL DEFAULT 0,
  compulsory_claims INTEGER DEFAULT 0,
  commercial_claims INTEGER DEFAULT 0,
  has_total_loss INTEGER DEFAULT 0,
  has_water_damage INTEGER DEFAULT 0,
  has_fire_damage INTEGER DEFAULT 0,
  risk_flags TEXT,
  claim_records TEXT,
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  verified_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS recall_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  recall_count INTEGER DEFAULT 0,
  unresolved_count INTEGER DEFAULT 0,
  recall_details TEXT,
  risk_flags TEXT,
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  verified_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS emission_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  last_inspection_date TEXT,
  inspection_result TEXT,
  valid_until TEXT,
  emission_standard TEXT,
  is_expired INTEGER DEFAULT 0,
  risk_flags TEXT,
  raw_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  verified_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS compliance_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  vin TEXT NOT NULL,
  dmv_status TEXT DEFAULT 'pending',
  insurance_status TEXT DEFAULT 'pending',
  recall_status TEXT DEFAULT 'pending',
  emission_status TEXT DEFAULT 'pending',
  overall_status TEXT DEFAULT 'pending',
  risk_level TEXT DEFAULT 'unknown',
  report_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, vin)
);

CREATE TABLE IF NOT EXISTS checkpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  last_processed_vin TEXT,
  last_processed_index INTEGER DEFAULT 0,
  total_vins INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(batch_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_vin_batch_status ON vin_batch(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_dmv_vin ON dmv_result(batch_id, vin);
CREATE INDEX IF NOT EXISTS idx_insurance_vin ON insurance_result(batch_id, vin);
CREATE INDEX IF NOT EXISTS idx_recall_vin ON recall_result(batch_id, vin);
CREATE INDEX IF NOT EXISTS idx_emission_vin ON emission_result(batch_id, vin);
CREATE INDEX IF NOT EXISTS idx_report_vin ON compliance_report(batch_id, vin);
`;

export function getDb() {
  if (_db) return _db;
  const dbPath = getEnv('DB_PATH', './data/verification.db');
  _db = new Database(resolve(dbPath));
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000');
  _db.pragma('temp_store = MEMORY');
  _db.exec(SCHEMA);
  log.info('Database initialized', { path: dbPath });
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
    log.info('Database closed');
  }
}

export function insertBatchVins(batchId, vins) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO vin_batch (batch_id, vin, status) VALUES (?, ?, 'pending')`
  );
  const insertMany = db.transaction((vinList) => {
    for (const vin of vinList) {
      stmt.run(batchId, vin);
    }
  });
  insertMany(vins);
  log.info('Batch VINs inserted', { batchId, count: vins.length });
}

export function updateVinStatus(batchId, vin, status) {
  const db = getDb();
  db.prepare(
    `UPDATE vin_batch SET status = ?, updated_at = datetime('now', 'localtime') WHERE batch_id = ? AND vin = ?`
  ).run(status, batchId, vin);
}

export function getPendingVins(batchId) {
  const db = getDb();
  return db.prepare(
    `SELECT vin FROM vin_batch WHERE batch_id = ? AND status != 'completed' ORDER BY id`
  ).all(batchId);
}

export function getCompletedVins(batchId, platform) {
  const db = getDb();
  const tableMap = {
    dmv: 'dmv_result',
    insurance: 'insurance_result',
    recall: 'recall_result',
    emission: 'emission_result',
  };
  const table = tableMap[platform];
  if (!table) return new Set();
  const rows = db.prepare(
    `SELECT vin FROM ${table} WHERE batch_id = ? AND status = 'completed'`
  ).all(batchId);
  return new Set(rows.map((r) => r.vin));
}

export function upsertDmvResult(batchId, vin, data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO dmv_result (batch_id, vin, registration_date, transfer_count, usage_type,
      plate_number, engine_number, vehicle_model, risk_flags, raw_html, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, vin) DO UPDATE SET
      registration_date=excluded.registration_date, transfer_count=excluded.transfer_count,
      usage_type=excluded.usage_type, plate_number=excluded.plate_number,
      engine_number=excluded.engine_number, vehicle_model=excluded.vehicle_model,
      risk_flags=excluded.risk_flags, raw_html=excluded.raw_html, status=excluded.status,
      error_message=excluded.error_message, verified_at=datetime('now', 'localtime')
  `).run(batchId, vin, data.registrationDate, data.transferCount, data.usageType,
    data.plateNumber, data.engineNumber, data.vehicleModel,
    JSON.stringify(data.riskFlags || []), data.rawHtml || '', data.status, data.errorMessage || null);
}

export function upsertInsuranceResult(batchId, vin, data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO insurance_result (batch_id, vin, total_claims, total_claim_amount,
      compulsory_claims, commercial_claims, has_total_loss, has_water_damage, has_fire_damage,
      risk_flags, claim_records, raw_html, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, vin) DO UPDATE SET
      total_claims=excluded.total_claims, total_claim_amount=excluded.total_claim_amount,
      compulsory_claims=excluded.compulsory_claims, commercial_claims=excluded.commercial_claims,
      has_total_loss=excluded.has_total_loss, has_water_damage=excluded.has_water_damage,
      has_fire_damage=excluded.has_fire_damage, risk_flags=excluded.risk_flags,
      claim_records=excluded.claim_records, raw_html=excluded.raw_html, status=excluded.status,
      error_message=excluded.error_message, verified_at=datetime('now', 'localtime')
  `).run(batchId, vin, data.totalClaims, data.totalClaimAmount, data.compulsoryClaims,
    data.commercialClaims, data.hasTotalLoss, data.hasWaterDamage, data.hasFireDamage,
    JSON.stringify(data.riskFlags || []), JSON.stringify(data.claimRecords || []),
    data.rawHtml || '', data.status, data.errorMessage || null);
}

export function upsertRecallResult(batchId, vin, data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO recall_result (batch_id, vin, recall_count, unresolved_count,
      recall_details, risk_flags, raw_html, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, vin) DO UPDATE SET
      recall_count=excluded.recall_count, unresolved_count=excluded.unresolved_count,
      recall_details=excluded.recall_details, risk_flags=excluded.risk_flags,
      raw_html=excluded.raw_html, status=excluded.status,
      error_message=excluded.error_message, verified_at=datetime('now', 'localtime')
  `).run(batchId, vin, data.recallCount, data.unresolvedCount,
    JSON.stringify(data.recallDetails || []), JSON.stringify(data.riskFlags || []),
    data.rawHtml || '', data.status, data.errorMessage || null);
}

export function upsertEmissionResult(batchId, vin, data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO emission_result (batch_id, vin, last_inspection_date, inspection_result,
      valid_until, emission_standard, is_expired, risk_flags, raw_html, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, vin) DO UPDATE SET
      last_inspection_date=excluded.last_inspection_date, inspection_result=excluded.inspection_result,
      valid_until=excluded.valid_until, emission_standard=excluded.emission_standard,
      is_expired=excluded.is_expired, risk_flags=excluded.risk_flags,
      raw_html=excluded.raw_html, status=excluded.status,
      error_message=excluded.error_message, verified_at=datetime('now', 'localtime')
  `).run(batchId, vin, data.lastInspectionDate, data.inspectionResult,
    data.validUntil, data.emissionStandard, data.isExpired ? 1 : 0,
    JSON.stringify(data.riskFlags || []), data.rawHtml || '', data.status, data.errorMessage || null);
}

export function upsertComplianceReport(batchId, vin, data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO compliance_report (batch_id, vin, dmv_status, insurance_status,
      recall_status, emission_status, overall_status, risk_level, report_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, vin) DO UPDATE SET
      dmv_status=excluded.dmv_status, insurance_status=excluded.insurance_status,
      recall_status=excluded.recall_status, emission_status=excluded.emission_status,
      overall_status=excluded.overall_status, risk_level=excluded.risk_level,
      report_json=excluded.report_json, updated_at=datetime('now', 'localtime')
  `).run(batchId, vin, data.dmvStatus, data.insuranceStatus, data.recallStatus,
    data.emissionStatus, data.overallStatus, data.riskLevel, JSON.stringify(data.reportJson || {}));
}

export function saveCheckpoint(batchId, platform, lastVin, lastIndex, totalVins) {
  const db = getDb();
  db.prepare(`
    INSERT INTO checkpoint (batch_id, platform, last_processed_vin, last_processed_index, total_vins)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, platform) DO UPDATE SET
      last_processed_vin=excluded.last_processed_vin,
      last_processed_index=excluded.last_processed_index,
      total_vins=excluded.total_vins,
      updated_at=datetime('now', 'localtime')
  `).run(batchId, platform, lastVin, lastIndex, totalVins);
}

export function getCheckpoint(batchId, platform) {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM checkpoint WHERE batch_id = ? AND platform = ?`
  ).get(batchId, platform);
}

export function getBatchSummary(batchId) {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as count FROM vin_batch WHERE batch_id = ?`).get(batchId);
  const completed = db.prepare(`SELECT COUNT(*) as count FROM vin_batch WHERE batch_id = ? AND status = 'completed'`).get(batchId);
  const failed = db.prepare(`SELECT COUNT(*) as count FROM vin_batch WHERE batch_id = ? AND status = 'error'`).get(batchId);
  const pending = db.prepare(`SELECT COUNT(*) as count FROM vin_batch WHERE batch_id = ? AND status = 'pending'`).get(batchId);
  const processing = db.prepare(`SELECT COUNT(*) as count FROM vin_batch WHERE batch_id = ? AND status = 'processing'`).get(batchId);
  return {
    total: total.count,
    completed: completed.count,
    failed: failed.count,
    pending: pending.count,
    processing: processing.count,
  };
}

export function getAllResults(batchId, vin) {
  const db = getDb();
  const dmv = db.prepare(`SELECT * FROM dmv_result WHERE batch_id = ? AND vin = ?`).get(batchId, vin);
  const insurance = db.prepare(`SELECT * FROM insurance_result WHERE batch_id = ? AND vin = ?`).get(batchId, vin);
  const recall = db.prepare(`SELECT * FROM recall_result WHERE batch_id = ? AND vin = ?`).get(batchId, vin);
  const emission = db.prepare(`SELECT * FROM emission_result WHERE batch_id = ? AND vin = ?`).get(batchId, vin);
  return { dmv, insurance, recall, emission };
}

export function getVinStatuses(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT vb.vin, vb.status as batch_status,
      dr.status as dmv_status, ir.status as insurance_status,
      rr.status as recall_status, er.status as emission_status,
      cr.overall_status, cr.risk_level
    FROM vin_batch vb
    LEFT JOIN dmv_result dr ON vb.batch_id = dr.batch_id AND vb.vin = dr.vin
    LEFT JOIN insurance_result ir ON vb.batch_id = ir.batch_id AND vb.vin = ir.vin
    LEFT JOIN recall_result rr ON vb.batch_id = rr.batch_id AND vb.vin = rr.vin
    LEFT JOIN emission_result er ON vb.batch_id = er.batch_id AND vb.vin = er.vin
    LEFT JOIN compliance_report cr ON vb.batch_id = cr.batch_id AND vb.vin = cr.vin
    WHERE vb.batch_id = ?
    ORDER BY vb.id
  `).all(batchId);
}
