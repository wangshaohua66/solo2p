use anyhow::{Context, Result};
use chrono::{Datelike, Local, NaiveDate, NaiveDateTime};
use colored::*;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

use crate::db::{AlertRecord, Db};
use crate::dose::{get_personal_dose, get_yearly_dose_for_worker};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertLevel {
    Yellow,
    Red,
}

impl AlertLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            AlertLevel::Yellow => "yellow",
            AlertLevel::Red => "red",
        }
    }

    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "yellow" | "warning" => Ok(AlertLevel::Yellow),
            "red" | "critical" | "danger" => Ok(AlertLevel::Red),
            _ => Err(anyhow::anyhow!("无效的预警级别: {}", s)),
        }
    }

    pub fn display_text(&self, text: &str) -> String {
        match self {
            AlertLevel::Yellow => text.yellow().bold().to_string(),
            AlertLevel::Red => text.red().bold().to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DoseLimit {
    pub category: String,
    pub period_type: String,
    pub period_value: i32,
    pub limit_value: f64,
    pub unit: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AlertCheckResult {
    pub total_checked: usize,
    pub yellow_alerts: usize,
    pub red_alerts: usize,
    pub alerts: Vec<AlertRecord>,
}

const YELLOW_THRESHOLD_RATIO: f64 = 0.8;

pub fn check_all_dose_alerts(db: &Db, log_file: Option<PathBuf>) -> Result<AlertCheckResult> {
    let mut all_alerts = Vec::new();
    let now = Local::now().naive_local();
    let current_year = now.year();

    let workers = get_all_workers(db)?;
    let total = workers.len();

    let year_limit_msv = db.get_dose_limit("occupational", "year", 1)?.unwrap_or(50.0);
    let year_limit_usv = year_limit_msv * 1000.0;

    for worker in &workers {
        let yearly_dose = get_yearly_dose_for_worker(db, &worker.employee_id, current_year)?;

        if yearly_dose >= year_limit_usv {
            all_alerts.push(create_alert(
                "dose_yearly",
                AlertLevel::Red,
                Some(&worker.employee_id),
                None,
                yearly_dose,
                year_limit_usv,
                format!(
                    "员工{}({})年度累积剂量{:.2}uSv，超过年限值{:.2}uSv",
                    worker.name, worker.employee_id, yearly_dose, year_limit_usv
                ),
                now,
            ));
        } else if yearly_dose >= year_limit_usv * YELLOW_THRESHOLD_RATIO {
            all_alerts.push(create_alert(
                "dose_yearly",
                AlertLevel::Yellow,
                Some(&worker.employee_id),
                None,
                yearly_dose,
                year_limit_usv * YELLOW_THRESHOLD_RATIO,
                format!(
                    "员工{}({})年度累积剂量{:.2}uSv，接近年限值80%",
                    worker.name, worker.employee_id, yearly_dose
                ),
                now,
            ));
        }
    }

    let month_limit_msv = db.get_dose_limit("occupational", "month", 1)?.unwrap_or(5.0);
    let month_limit_usv = month_limit_msv * 1000.0;
    let month_start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();

    let month_summaries = get_personal_dose(db, None, Some(month_start), Some(now))?;
    for summary in &month_summaries {
        if summary.total_dose >= month_limit_usv {
            all_alerts.push(create_alert(
                "dose_monthly",
                AlertLevel::Red,
                Some(&summary.employee_id),
                None,
                summary.total_dose,
                month_limit_usv,
                format!(
                    "员工{}({})月度累积剂量{:.2}uSv，超过月限值{:.2}uSv",
                    summary.employee_name, summary.employee_id, summary.total_dose, month_limit_usv
                ),
                now,
            ));
        } else if summary.total_dose >= month_limit_usv * YELLOW_THRESHOLD_RATIO {
            all_alerts.push(create_alert(
                "dose_monthly",
                AlertLevel::Yellow,
                Some(&summary.employee_id),
                None,
                summary.total_dose,
                month_limit_usv * YELLOW_THRESHOLD_RATIO,
                format!(
                    "员工{}({})月度累积剂量{:.2}uSv，接近月限值80%",
                    summary.employee_name, summary.employee_id, summary.total_dose
                ),
                now,
            ));
        }
    }

    let yellow_count = all_alerts
        .iter()
        .filter(|a| a.level == "yellow")
        .count();
    let red_count = all_alerts.iter().filter(|a| a.level == "red").count();

    save_alerts(db, &all_alerts)?;

    if let Some(log_path) = log_file {
        write_alert_log(&all_alerts, &log_path)?;
    }

    Ok(AlertCheckResult {
        total_checked: total,
        yellow_alerts: yellow_count,
        red_alerts: red_count,
        alerts: all_alerts,
    })
}

fn create_alert(
    alert_type: &str,
    level: AlertLevel,
    employee_id: Option<&str>,
    point_code: Option<&str>,
    value: f64,
    threshold: f64,
    message: String,
    alert_time: NaiveDateTime,
) -> AlertRecord {
    AlertRecord {
        id: 0,
        alert_type: alert_type.to_string(),
        level: level.as_str().to_string(),
        employee_id: employee_id.map(|s| s.to_string()),
        point_code: point_code.map(|s| s.to_string()),
        value,
        threshold,
        message,
        alert_time,
        acknowledged: false,
    }
}

fn save_alerts(db: &Db, alerts: &[AlertRecord]) -> Result<()> {
    let conn = db.conn();
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO alert_records (alert_type, level, employee_id, point_code, value, threshold, message, alert_time, acknowledged)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )?;
        for alert in alerts {
            stmt.execute(params![
                alert.alert_type,
                alert.level,
                alert.employee_id,
                alert.point_code,
                alert.value,
                alert.threshold,
                alert.message,
                alert.alert_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                alert.acknowledged as i32,
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

fn write_alert_log(alerts: &[AlertRecord], log_path: &std::path::Path) -> Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("无法打开预警日志文件: {:?}", log_path))?;

    for alert in alerts {
        writeln!(
            file,
            "[{}] [{}] {} - value:{:.2} threshold:{:.2} - {}",
            alert.alert_time.format("%Y-%m-%d %H:%M:%S"),
            alert.level.to_uppercase(),
            alert.alert_type,
            alert.value,
            alert.threshold,
            alert.message
        )?;
    }
    Ok(())
}

fn get_all_workers(db: &Db) -> Result<Vec<WorkerInfo>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT employee_id, name, department, category FROM workers ORDER BY department, name",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WorkerInfo {
            employee_id: row.get(0)?,
            name: row.get(1)?,
            department: row.get(2)?,
            category: row.get(3)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

#[derive(Debug, Clone)]
struct WorkerInfo {
    employee_id: String,
    name: String,
    department: String,
    category: String,
}

pub fn check_survey_alerts(db: &Db) -> Result<AlertCheckResult> {
    let now = Local::now().naive_local();
    let mut alerts = Vec::new();

    let control_limit = db.get_dose_limit("control_area", "hour", 1)?.unwrap_or(0.025);
    let supervised_limit = db
        .get_dose_limit("supervised_area", "hour", 1)?
        .unwrap_or(0.0025);

    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT s.point_code, s.measure_time, s.dose_rate, s.unit, m.area_type
         FROM survey_records s
         JOIN monitor_points m ON s.point_code = m.point_code
         WHERE s.measure_time >= datetime('now', '-24 hours')
         ORDER BY s.measure_time DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
        ))
    })?;

    let mut checked = 0;
    let collected: Vec<_> = rows.collect::<Result<Vec<_>, _>>()?;

    for (point_code, time_str, dose_rate, unit, area_type) in &collected {
        checked += 1;
        let limit_muv = match area_type.as_str() {
            "控制区" | "control" => control_limit * 1000.0,
            "监督区" | "supervised" => supervised_limit * 1000.0,
            _ => continue,
        };

        let dose_uv = if unit.to_lowercase().contains("msv") {
            dose_rate * 1000.0
        } else {
            *dose_rate
        };

        if dose_uv >= limit_muv {
            let measure_time = NaiveDateTime::parse_from_str(time_str, "%Y-%m-%d %H:%M:%S")
                .unwrap_or(now);
            alerts.push(create_alert(
                "survey_dose_rate",
                AlertLevel::Red,
                None,
                Some(point_code),
                dose_uv,
                limit_muv,
                format!(
                    "监测点{}剂量率{:.3}uSv/h，超过{}限值{:.3}uSv/h",
                    point_code, dose_uv, area_type, limit_muv
                ),
                measure_time,
            ));
        }
    }

    let yellow_count = alerts.iter().filter(|a| a.level == "yellow").count();
    let red_count = alerts.iter().filter(|a| a.level == "red").count();

    save_alerts(db, &alerts)?;

    Ok(AlertCheckResult {
        total_checked: checked,
        yellow_alerts: yellow_count,
        red_alerts: red_count,
        alerts,
    })
}

pub fn list_alerts(
    db: &Db,
    level: Option<AlertLevel>,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
    limit: Option<i64>,
) -> Result<Vec<AlertRecord>> {
    let mut sql =
        String::from("SELECT id, alert_type, level, employee_id, point_code, value, threshold, message, alert_time, acknowledged FROM alert_records WHERE 1=1");
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(lv) = level {
        sql.push_str(" AND level = ?");
        params_vec.push(lv.as_str().to_string());
    }
    if let Some(f) = from {
        sql.push_str(" AND alert_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = to {
        sql.push_str(" AND alert_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" ORDER BY alert_time DESC");
    if let Some(l) = limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }

    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let alert_time_str: String = row.get(8)?;
        Ok(AlertRecord {
            id: row.get(0)?,
            alert_type: row.get(1)?,
            level: row.get(2)?,
            employee_id: row.get(3)?,
            point_code: row.get(4)?,
            value: row.get(5)?,
            threshold: row.get(6)?,
            message: row.get(7)?,
            alert_time: NaiveDateTime::parse_from_str(&alert_time_str, "%Y-%m-%d %H:%M:%S")
                .unwrap_or_default(),
            acknowledged: row.get::<_, i32>(9)? != 0,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}
