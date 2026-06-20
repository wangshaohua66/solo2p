use anyhow::{Context, Result};
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, Utc};
use rusqlite::{params, Connection, OpenFlags};
use std::path::Path;

#[derive(Debug)]
pub struct Db {
    conn: Connection,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct MonitorPoint {
    pub id: i64,
    pub point_code: String,
    pub unit: i32,
    pub area_type: String,
    pub area_name: String,
    pub description: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct SurveyRecord {
    pub id: i64,
    pub point_code: String,
    pub measure_time: NaiveDateTime,
    pub dose_rate: f64,
    pub unit: String,
    pub surveyor: Option<String>,
    pub instrument: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct DoseRecord {
    pub id: i64,
    pub employee_id: String,
    pub employee_name: String,
    pub department: String,
    pub record_time: NaiveDateTime,
    pub cumulative_dose: f64,
    pub unit: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Worker {
    pub id: i64,
    pub employee_id: String,
    pub name: String,
    pub department: String,
    pub category: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct WorkPermit {
    pub id: i64,
    pub permit_no: String,
    pub employee_id: String,
    pub employee_name: String,
    pub department: String,
    pub area_type: String,
    pub area_name: String,
    pub work_type: String,
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,
    pub status: String,
    pub approved_by: Option<String>,
    pub approved_at: Option<NaiveDateTime>,
    pub reject_reason: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AlertRecord {
    pub id: i64,
    pub alert_type: String,
    pub level: String,
    pub employee_id: Option<String>,
    pub point_code: Option<String>,
    pub value: f64,
    pub threshold: f64,
    pub message: String,
    pub alert_time: NaiveDateTime,
    pub acknowledged: bool,
}

impl Db {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX;
        let conn = Connection::open_with_flags(path, flags)
            .context("无法打开数据库")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "cache_size", "20000")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Db { conn })
    }

    pub fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS monitor_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                point_code TEXT NOT NULL UNIQUE,
                unit INTEGER NOT NULL,
                area_type TEXT NOT NULL,
                area_name TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS workers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'occupational'
            );

            CREATE TABLE IF NOT EXISTS survey_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                point_code TEXT NOT NULL,
                measure_time TEXT NOT NULL,
                dose_rate REAL NOT NULL,
                unit TEXT NOT NULL,
                surveyor TEXT,
                instrument TEXT,
                UNIQUE(point_code, measure_time)
            );
            CREATE INDEX IF NOT EXISTS idx_survey_time ON survey_records(measure_time);
            CREATE INDEX IF NOT EXISTS idx_survey_point ON survey_records(point_code);

            CREATE TABLE IF NOT EXISTS dose_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                department TEXT NOT NULL,
                record_time TEXT NOT NULL,
                cumulative_dose REAL NOT NULL,
                unit TEXT NOT NULL DEFAULT 'uSv',
                UNIQUE(employee_id, record_time)
            );
            CREATE INDEX IF NOT EXISTS idx_dose_employee ON dose_records(employee_id);
            CREATE INDEX IF NOT EXISTS idx_dose_time ON dose_records(record_time);
            CREATE INDEX IF NOT EXISTS idx_dose_dept ON dose_records(department);

            CREATE TABLE IF NOT EXISTS work_permits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                permit_no TEXT NOT NULL UNIQUE,
                employee_id TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                department TEXT NOT NULL,
                area_type TEXT NOT NULL,
                area_name TEXT NOT NULL,
                work_type TEXT NOT NULL,
                valid_from TEXT NOT NULL,
                valid_to TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                approved_by TEXT,
                approved_at TEXT,
                reject_reason TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_permit_employee ON work_permits(employee_id);
            CREATE INDEX IF NOT EXISTS idx_permit_status ON work_permits(status);

            CREATE TABLE IF NOT EXISTS alert_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_type TEXT NOT NULL,
                level TEXT NOT NULL,
                employee_id TEXT,
                point_code TEXT,
                value REAL NOT NULL,
                threshold REAL NOT NULL,
                message TEXT NOT NULL,
                alert_time TEXT NOT NULL,
                acknowledged INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_alert_time ON alert_records(alert_time);
            CREATE INDEX IF NOT EXISTS idx_alert_level ON alert_records(level);

            CREATE TABLE IF NOT EXISTS dose_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                period_type TEXT NOT NULL,
                period_value INTEGER,
                limit_value REAL NOT NULL,
                unit TEXT NOT NULL,
                description TEXT,
                UNIQUE(category, period_type, period_value)
            );
            "#,
        )?;
        self.init_default_limits()?;
        self.init_seed_data()?;
        Ok(())
    }

    fn init_default_limits(&self) -> Result<()> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM dose_limits",
            [],
            |row| row.get(0),
        )?;
        if count > 0 {
            return Ok(());
        }
        let limits = vec![
            ("occupational", "year", 1, 50.0, "mSv", "职业照射年剂量限值 50mSv"),
            ("occupational", "year5", 5, 100.0, "mSv", "职业照射5年平均剂量限值 100mSv"),
            ("occupational", "month", 1, 5.0, "mSv", "职业照射月剂量限值 5mSv"),
            ("public", "year", 1, 1.0, "mSv", "公众照射年剂量限值 1mSv"),
            ("control_area", "hour", 1, 0.025, "mSv/h", "控制区剂量率限值"),
            ("supervised_area", "hour", 1, 0.0025, "mSv/h", "监督区剂量率限值"),
        ];
        for (cat, ptype, pval, lval, unit, desc) in limits {
            self.conn.execute(
                "INSERT INTO dose_limits (category, period_type, period_value, limit_value, unit, description)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![cat, ptype, pval, lval, unit, desc],
            )?;
        }
        Ok(())
    }

    fn init_seed_data(&self) -> Result<()> {
        let mp_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM monitor_points",
            [],
            |row| row.get(0),
        )?;
        if mp_count > 0 {
            return Ok(());
        }
        let area_types = vec![
            ("控制区", "control", 15),
            ("监督区", "supervised", 10),
            ("非限制区", "unrestricted", 15),
        ];
        for unit in 1..=3 {
            for (area_name, area_type, count_per) in &area_types {
                for i in 1..=*count_per {
                    let point_code = format!("U{:02}-{}-{:03}", unit, area_type.to_uppercase(), i);
                    self.conn.execute(
                        "INSERT INTO monitor_points (point_code, unit, area_type, area_name, description)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![
                            point_code,
                            unit,
                            area_type,
                            format!("{}{}号机组{}", area_name, unit, i),
                            format!("{}{}号机组{}号监测点", area_name, unit, i),
                        ],
                    )?;
                }
            }
        }
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn insert_survey_record(&self, rec: &SurveyRecord) -> Result<i64> {
        self.conn.execute(
            "INSERT OR IGNORE INTO survey_records (point_code, measure_time, dose_rate, unit, surveyor, instrument)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                rec.point_code,
                rec.measure_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                rec.dose_rate,
                rec.unit,
                rec.surveyor,
                rec.instrument,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn insert_dose_record(&self, rec: &DoseRecord) -> Result<i64> {
        self.conn.execute(
            "INSERT OR IGNORE INTO dose_records (employee_id, employee_name, department, record_time, cumulative_dose, unit)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                rec.employee_id,
                rec.employee_name,
                rec.department,
                rec.record_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                rec.cumulative_dose,
                rec.unit,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn batch_insert_survey(&self, records: &[SurveyRecord]) -> Result<(usize, usize)> {
        let tx = self.conn.unchecked_transaction()?;
        let mut inserted = 0usize;
        let mut skipped = 0usize;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO survey_records (point_code, measure_time, dose_rate, unit, surveyor, instrument)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )?;
            for rec in records {
                let changes = stmt.execute(params![
                    rec.point_code,
                    rec.measure_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                    rec.dose_rate,
                    rec.unit,
                    rec.surveyor,
                    rec.instrument,
                ])?;
                if changes > 0 {
                    inserted += 1;
                } else {
                    skipped += 1;
                }
            }
        }
        tx.commit()?;
        Ok((inserted, skipped))
    }

    pub fn batch_insert_dose(&self, records: &[DoseRecord]) -> Result<(usize, usize)> {
        let tx = self.conn.unchecked_transaction()?;
        let mut inserted = 0usize;
        let mut skipped = 0usize;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO dose_records (employee_id, employee_name, department, record_time, cumulative_dose, unit)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            )?;
            for rec in records {
                let changes = stmt.execute(params![
                    rec.employee_id,
                    rec.employee_name,
                    rec.department,
                    rec.record_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                    rec.cumulative_dose,
                    rec.unit,
                ])?;
                if changes > 0 {
                    inserted += 1;
                } else {
                    skipped += 1;
                }
            }
        }
        tx.commit()?;
        Ok((inserted, skipped))
    }

    pub fn get_dose_limit(&self, category: &str, period_type: &str, period_value: i32) -> Result<Option<f64>> {
        let result = self.conn.query_row(
            "SELECT limit_value FROM dose_limits WHERE category = ?1 AND period_type = ?2 AND period_value = ?3",
            params![category, period_type, period_value],
            |row| row.get::<_, f64>(0),
        );
        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn upsert_worker(&self, employee_id: &str, name: &str, department: &str, category: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO workers (employee_id, name, department, category)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(employee_id) DO UPDATE SET name = excluded.name, department = excluded.department, category = excluded.category",
            params![employee_id, name, department, category],
        )?;
        let id: i64 = self.conn.query_row(
            "SELECT id FROM workers WHERE employee_id = ?1",
            params![employee_id],
            |row| row.get(0),
        )?;
        Ok(id)
    }
}
