const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { dbConfig } = require('../config/carriers');

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS rate_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carrier_id TEXT NOT NULL,
          carrier_name TEXT NOT NULL,
          port_from TEXT NOT NULL,
          port_to TEXT NOT NULL,
          container_type TEXT NOT NULL,
          base_rate REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          valid_from TEXT,
          valid_to TEXT,
          surcharges_total REAL DEFAULT 0,
          total_rate REAL NOT NULL,
          collected_at TEXT NOT NULL,
          source_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_rate_snapshots_carrier ON rate_snapshots(carrier_id);
        CREATE INDEX IF NOT EXISTS idx_rate_snapshots_route ON rate_snapshots(port_from, port_to, container_type);
        CREATE INDEX IF NOT EXISTS idx_rate_snapshots_collected ON rate_snapshots(collected_at);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS space_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carrier_id TEXT NOT NULL,
          carrier_name TEXT NOT NULL,
          port_from TEXT NOT NULL,
          port_to TEXT NOT NULL,
          container_type TEXT NOT NULL,
          available_count INTEGER,
          status TEXT NOT NULL,
          status_text TEXT,
          vessel_name TEXT,
          voyage_number TEXT,
          departure_date TEXT,
          collected_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_space_status_carrier ON space_status(carrier_id);
        CREATE INDEX IF NOT EXISTS idx_space_status_route ON space_status(port_from, port_to);
        CREATE INDEX IF NOT EXISTS idx_space_status_collected ON space_status(collected_at);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carrier_id TEXT NOT NULL,
          carrier_name TEXT NOT NULL,
          port_from TEXT NOT NULL,
          port_to TEXT NOT NULL,
          vessel_name TEXT,
          voyage_number TEXT,
          departure_date TEXT,
          arrival_date TEXT,
          transit_days INTEGER,
          service_code TEXT,
          collected_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_schedules_carrier ON schedules(carrier_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_route ON schedules(port_from, port_to);
        CREATE INDEX IF NOT EXISTS idx_schedules_departure ON schedules(departure_date);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS surcharge_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carrier_id TEXT NOT NULL,
          carrier_name TEXT NOT NULL,
          surcharge_code TEXT NOT NULL,
          surcharge_name TEXT NOT NULL,
          previous_amount REAL,
          new_amount REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          effective_date TEXT,
          change_type TEXT NOT NULL,
          description TEXT,
          detected_at TEXT NOT NULL,
          source_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_surcharge_carrier ON surcharge_changes(carrier_id);
        CREATE INDEX IF NOT EXISTS idx_surcharge_detected ON surcharge_changes(detected_at);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          carrier_id TEXT,
          carrier_name TEXT,
          port_from TEXT,
          port_to TEXT,
          container_type TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          previous_value REAL,
          current_value REAL,
          threshold REAL,
          status TEXT DEFAULT 'active',
          created_at TEXT NOT NULL,
          resolved_at TEXT,
          metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS task_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          carrier_id TEXT NOT NULL,
          carrier_name TEXT NOT NULL,
          task_type TEXT NOT NULL,
          status TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          duration_ms INTEGER,
          http_status INTEGER,
          records_parsed INTEGER,
          records_failed INTEGER,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_task_logs_carrier ON task_logs(carrier_id);
        CREATE INDEX IF NOT EXISTS idx_task_logs_status ON task_logs(status);
        CREATE INDEX IF NOT EXISTS idx_task_logs_start_time ON task_logs(start_time);
        CREATE INDEX IF NOT EXISTS idx_task_logs_task_type ON task_logs(task_type);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carrier_id TEXT UNIQUE NOT NULL,
          cookies TEXT,
          localStorage TEXT,
          last_used TEXT,
          expires_at TEXT,
          is_valid INTEGER DEFAULT 1
        );
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL,
          name TEXT
        );
      `);
    }
  },
  {
    version: 2,
    name: 'add_price_trend_fields',
    up: (db) => {
      const cols = db.pragma('table_info(rate_snapshots)').map(c => c.name);
      if (!cols.includes('change_from_previous')) {
        db.exec(`
          ALTER TABLE rate_snapshots ADD COLUMN change_from_previous REAL;
          ALTER TABLE rate_snapshots ADD COLUMN change_percent REAL;
        `);
      }
    }
  }
];

function getCurrentVersion(db) {
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get();
    if (!tableExists) return 0;
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
    return row && row.version ? row.version : 0;
  } catch (e) {
    return 0;
  }
}

function runMigrations() {
  const dbPath = dbConfig.path;
  const dataDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  try {
    const currentVersion = getCurrentVersion(db);
    console.log(`当前数据库版本: ${currentVersion}`);

    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('数据库已是最新版本');
      return { db, version: currentVersion };
    }

    console.log(`待执行迁移数: ${pendingMigrations.length}`);

    const transaction = db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(`执行迁移 v${migration.version}: ${migration.name}`);
        migration.up(db);
        db.prepare('INSERT INTO schema_version (version, applied_at, name) VALUES (?, datetime(\'now\'), ?)')
          .run(migration.version, migration.name);
      }
    });

    transaction();
    console.log(`迁移完成，当前版本: ${getCurrentVersion(db)}`);

    return { db, version: getCurrentVersion(db) };
  } catch (error) {
    console.error('迁移执行失败:', error.message);
    throw error;
  }
}

module.exports = {
  runMigrations,
  migrations,
  getCurrentVersion
};
