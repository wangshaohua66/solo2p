use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OpenFlags};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
    pub path: PathBuf,
}

impl Database {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
        )
        .with_context(|| format!("Failed to open database: {}", path.display()))?;

        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "cache_size", "-20000")?;
        conn.pragma_update(None, "temp_store", "MEMORY")?;
        conn.pragma_update(None, "mmap_size", "3000000000")?;

        let db = Database {
            conn: Mutex::new(conn),
            path,
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS stations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                elevation REAL,
                instrument_model TEXT,
                csv_column_mapping TEXT,
                unit_mapping TEXT,
                timezone TEXT DEFAULT 'Asia/Shanghai',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS neighbors (
                station_id TEXT NOT NULL,
                neighbor_id TEXT NOT NULL,
                distance_km REAL,
                PRIMARY KEY (station_id, neighbor_id),
                FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
                FOREIGN KEY (neighbor_id) REFERENCES stations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id TEXT NOT NULL,
                obs_time TEXT NOT NULL,
                temperature REAL,
                pressure REAL,
                relative_humidity REAL,
                wind_speed REAL,
                wind_direction REAL,
                precipitation REAL,
                visibility REAL,
                raw_data TEXT,
                source_file TEXT,
                imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
                qc_status TEXT DEFAULT 'pending',
                UNIQUE(station_id, obs_time)
            );

            CREATE INDEX IF NOT EXISTS idx_obs_station_time ON observations(station_id, obs_time);
            CREATE INDEX IF NOT EXISTS idx_obs_time ON observations(obs_time);
            CREATE INDEX IF NOT EXISTS idx_obs_qc_status ON observations(qc_status);

            CREATE TABLE IF NOT EXISTS qc_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                observation_id INTEGER NOT NULL,
                station_id TEXT NOT NULL,
                obs_time TEXT NOT NULL,
                rule_code TEXT NOT NULL,
                element TEXT NOT NULL,
                result TEXT NOT NULL,
                detail TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_qc_obs_id ON qc_results(observation_id);
            CREATE INDEX IF NOT EXISTS idx_qc_station_time ON qc_results(station_id, obs_time);

            CREATE TABLE IF NOT EXISTS qc_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                element TEXT,
                threshold REAL,
                weight REAL DEFAULT 1.0,
                enabled INTEGER DEFAULT 1,
                station_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS review_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                observation_id INTEGER NOT NULL,
                original_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                reason TEXT,
                operator TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_review_obs_id ON review_overrides(observation_id);

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS import_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                station_id TEXT,
                total_records INTEGER DEFAULT 0,
                imported_records INTEGER DEFAULT 0,
                duplicate_records INTEGER DEFAULT 0,
                error_records INTEGER DEFAULT 0,
                status TEXT DEFAULT 'running',
                started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                finished_at TEXT
            );

            CREATE TABLE IF NOT EXISTS archive_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                archive_type TEXT NOT NULL,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                file_path TEXT,
                record_count INTEGER DEFAULT 0,
                md5_checksum TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                finished_at TEXT
            );
            "#,
        )?;

        Ok(())
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(sql)?;
        Ok(())
    }

    pub fn get_db_size_mb(&self) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        let page_size: i64 = conn.query_row("PRAGMA page_size", [], |row| row.get(0))?;
        let size_mb = (page_count * page_size) as f64 / (1024.0 * 1024.0);
        Ok(size_mb)
    }

    pub fn check_and_enable_wal(&self) -> Result<()> {
        let size_mb = self.get_db_size_mb()?;
        if size_mb > 100.0 {
            let conn = self.conn.lock().unwrap();
            conn.pragma_update(None, "journal_mode", "WAL")?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct Observation {
    pub id: Option<i64>,
    pub station_id: String,
    pub obs_time: DateTime<Utc>,
    pub temperature: Option<f64>,
    pub pressure: Option<f64>,
    pub relative_humidity: Option<f64>,
    pub wind_speed: Option<f64>,
    pub wind_direction: Option<f64>,
    pub precipitation: Option<f64>,
    pub visibility: Option<f64>,
    pub raw_data: Option<String>,
    pub source_file: Option<String>,
    pub qc_status: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum QcStatus {
    Pending,
    Passed,
    Suspect,
    Failed,
    OverriddenPass,
    OverriddenFail,
}

impl QcStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            QcStatus::Pending => "pending",
            QcStatus::Passed => "passed",
            QcStatus::Suspect => "suspect",
            QcStatus::Failed => "failed",
            QcStatus::OverriddenPass => "overridden_pass",
            QcStatus::OverriddenFail => "overridden_fail",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "passed" => QcStatus::Passed,
            "suspect" => QcStatus::Suspect,
            "failed" => QcStatus::Failed,
            "overridden_pass" => QcStatus::OverriddenPass,
            "overridden_fail" => QcStatus::OverriddenFail,
            _ => QcStatus::Pending,
        }
    }
}

#[derive(Debug, Clone)]
pub struct QcResult {
    pub observation_id: i64,
    pub station_id: String,
    pub obs_time: DateTime<Utc>,
    pub rule_code: String,
    pub element: String,
    pub result: String,
    pub detail: Option<String>,
}

pub fn insert_observation(conn: &Connection, obs: &Observation) -> Result<i64> {
    let mut stmt = conn.prepare_cached(
        r#"INSERT OR IGNORE INTO observations
           (station_id, obs_time, temperature, pressure, relative_humidity,
            wind_speed, wind_direction, precipitation, visibility, raw_data, source_file, qc_status)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)"#,
    )?;

    let id = stmt.insert(params![
        obs.station_id,
        obs.obs_time.to_rfc3339(),
        obs.temperature,
        obs.pressure,
        obs.relative_humidity,
        obs.wind_speed,
        obs.wind_direction,
        obs.precipitation,
        obs.visibility,
        obs.raw_data,
        obs.source_file,
        obs.qc_status,
    ])?;

    Ok(id)
}

pub fn insert_qc_result(conn: &Connection, qc: &QcResult) -> Result<i64> {
    let mut stmt = conn.prepare_cached(
        r#"INSERT INTO qc_results
           (observation_id, station_id, obs_time, rule_code, element, result, detail)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
    )?;

    let id = stmt.insert(params![
        qc.observation_id,
        qc.station_id,
        qc.obs_time.to_rfc3339(),
        qc.rule_code,
        qc.element,
        qc.result,
        qc.detail,
    ])?;

    Ok(id)
}

pub fn update_observation_qc_status(conn: &Connection, obs_id: i64, status: &str) -> Result<()> {
    let mut stmt = conn.prepare_cached(
        "UPDATE observations SET qc_status = ?1 WHERE id = ?2",
    )?;
    stmt.execute(params![status, obs_id])?;
    Ok(())
}

pub fn get_observations_by_range(
    conn: &Connection,
    station_id: Option<&str>,
    start_time: &DateTime<Utc>,
    end_time: &DateTime<Utc>,
    limit: Option<i64>,
) -> Result<Vec<Observation>> {
    let mut sql = String::from(
        "SELECT id, station_id, obs_time, temperature, pressure, relative_humidity,
         wind_speed, wind_direction, precipitation, visibility, raw_data, source_file, qc_status
         FROM observations WHERE obs_time >= ?1 AND obs_time <= ?2",
    );

    if station_id.is_some() {
        sql.push_str(" AND station_id = ?3");
    }
    sql.push_str(" ORDER BY obs_time ASC");

    if let Some(lim) = limit {
        sql.push_str(&format!(" LIMIT {}", lim));
    }

    let mut stmt = conn.prepare(&sql)?;
    let mut rows = if let Some(sid) = station_id {
        stmt.query(params![start_time.to_rfc3339(), end_time.to_rfc3339(), sid])?
    } else {
        stmt.query(params![start_time.to_rfc3339(), end_time.to_rfc3339()])?
    };

    let mut results = Vec::new();
    while let Some(row) = rows.next()? {
        let obs_time_str: String = row.get(2)?;
        let obs_time = DateTime::parse_from_rfc3339(&obs_time_str)?.with_timezone(&Utc);

        results.push(Observation {
            id: row.get(0)?,
            station_id: row.get(1)?,
            obs_time,
            temperature: row.get(3)?,
            pressure: row.get(4)?,
            relative_humidity: row.get(5)?,
            wind_speed: row.get(6)?,
            wind_direction: row.get(7)?,
            precipitation: row.get(8)?,
            visibility: row.get(9)?,
            raw_data: row.get(10)?,
            source_file: row.get(11)?,
            qc_status: row.get(12)?,
        });
    }

    Ok(results)
}
