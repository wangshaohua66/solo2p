use anyhow::Result;
use chrono::{Duration, NaiveDateTime};
use rusqlite::params;
use serde::Serialize;
use std::collections::HashSet;

use crate::db::Db;

#[derive(Debug, Serialize)]
pub struct CheckResult {
    pub total_monitor_points: i64,
    pub points_without_data: Vec<String>,
    pub anomalous_jumps: Vec<AnomalousJump>,
    pub time_interval_anomalies: Vec<TimeIntervalAnomaly>,
    pub total_survey_records: i64,
    pub total_dose_records: i64,
    pub workers_without_dose: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AnomalousJump {
    pub point_code: String,
    pub measure_time: String,
    pub previous_value: f64,
    pub current_value: f64,
    pub jump_ratio: f64,
}

#[derive(Debug, Serialize)]
pub struct TimeIntervalAnomaly {
    pub point_code: String,
    pub expected_interval_secs: i64,
    pub actual_interval_secs: i64,
    pub first_time: String,
    pub second_time: String,
}

pub fn run_data_check(db: &Db) -> Result<CheckResult> {
    let points = get_all_points(db)?;
    let total_points = points.len() as i64;

    let points_with_data = get_points_with_recent_data(db, 30)?;
    let points_set: HashSet<String> = points_with_data.into_iter().collect();
    let points_without_data: Vec<String> = points
        .into_iter()
        .filter(|p| !points_set.contains(p))
        .collect();

    let anomalous_jumps = detect_anomalous_jumps(db, 5.0)?;

    let time_interval_anomalies = detect_time_interval_anomalies(db, 86400)?;

    let total_survey: i64 = db
        .conn()
        .query_row("SELECT COUNT(*) FROM survey_records", [], |row| row.get(0))?;

    let total_dose: i64 = db
        .conn()
        .query_row("SELECT COUNT(*) FROM dose_records", [], |row| row.get(0))?;

    let workers = get_all_workers(db)?;
    let workers_with_dose = get_workers_with_recent_dose(db, 30)?;
    let workers_set: HashSet<String> = workers_with_dose.into_iter().collect();
    let workers_without_dose: Vec<String> = workers
        .into_iter()
        .filter(|w| !workers_set.contains(w))
        .collect();

    Ok(CheckResult {
        total_monitor_points: total_points,
        points_without_data,
        anomalous_jumps,
        time_interval_anomalies,
        total_survey_records: total_survey,
        total_dose_records: total_dose,
        workers_without_dose,
    })
}

fn get_all_points(db: &Db) -> Result<Vec<String>> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT point_code FROM monitor_points ORDER BY point_code")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn get_points_with_recent_data(db: &Db, days: i64) -> Result<Vec<String>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT point_code FROM survey_records 
         WHERE measure_time >= datetime('now', ?1)",
    )?;
    let param = format!("-{} days", days);
    let rows = stmt.query_map(params![param], |row| row.get::<_, String>(0))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn detect_anomalous_jumps(db: &Db, max_ratio: f64) -> Result<Vec<AnomalousJump>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT point_code, measure_time, dose_rate 
         FROM survey_records 
         ORDER BY point_code, measure_time",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
        ))
    })?;

    let mut result = Vec::new();
    let mut prev_point: Option<String> = None;
    let mut prev_value: Option<f64> = None;
    let mut prev_time: Option<String> = None;

    for row in rows {
        let (point, time, value) = row?;
        if prev_point.as_deref() == Some(&point) {
            if let Some(prev) = prev_value {
                if prev > 0.0 {
                    let ratio = (value - prev).abs() / prev;
                    if ratio > max_ratio {
                        result.push(AnomalousJump {
                            point_code: point.clone(),
                            measure_time: time.clone(),
                            previous_value: prev,
                            current_value: value,
                            jump_ratio: ratio,
                        });
                    }
                }
            }
        }
        prev_point = Some(point);
        prev_value = Some(value);
        prev_time = Some(time);
    }

    result.truncate(50);
    Ok(result)
}

fn detect_time_interval_anomalies(
    db: &Db,
    max_expected_secs: i64,
) -> Result<Vec<TimeIntervalAnomaly>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT point_code, measure_time 
         FROM survey_records 
         ORDER BY point_code, measure_time",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut result = Vec::new();
    let mut prev_point: Option<String> = None;
    let mut prev_time: Option<NaiveDateTime> = None;

    for row in rows {
        let (point, time_str) = row?;
        let time = match NaiveDateTime::parse_from_str(&time_str, "%Y-%m-%d %H:%M:%S") {
            Ok(t) => t,
            Err(_) => continue,
        };

        if prev_point.as_deref() == Some(&point) {
            if let Some(prev) = prev_time {
                let interval = (time - prev).num_seconds();
                if interval > max_expected_secs * 3 {
                    result.push(TimeIntervalAnomaly {
                        point_code: point.clone(),
                        expected_interval_secs: max_expected_secs,
                        actual_interval_secs: interval,
                        first_time: prev.format("%Y-%m-%d %H:%M:%S").to_string(),
                        second_time: time.format("%Y-%m-%d %H:%M:%S").to_string(),
                    });
                }
            }
        }
        prev_point = Some(point);
        prev_time = Some(time);
    }

    result.truncate(50);
    Ok(result)
}

fn get_all_workers(db: &Db) -> Result<Vec<String>> {
    let conn = db.conn();
    let mut stmt = conn.prepare("SELECT employee_id FROM workers ORDER BY employee_id")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn get_workers_with_recent_dose(db: &Db, days: i64) -> Result<Vec<String>> {
    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT employee_id FROM dose_records 
         WHERE record_time >= datetime('now', ?1)",
    )?;
    let param = format!("-{} days", days);
    let rows = stmt.query_map(params![param], |row| row.get::<_, String>(0))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn format_check_report(result: &CheckResult) -> String {
    let mut s = String::new();
    s.push_str("===== 数据完整性校验报告 =====\n\n");

    s.push_str(&format!("监测点总数: {}\n", result.total_monitor_points));
    s.push_str(&format!("巡检记录总数: {}\n", result.total_survey_records));
    s.push_str(&format!("剂量记录总数: {}\n\n", result.total_dose_records));

    s.push_str(&format!(
        "近30天无数据监测点: {} 个\n",
        result.points_without_data.len()
    ));
    if !result.points_without_data.is_empty() {
        for p in &result.points_without_data {
            s.push_str(&format!("  - {}\n", p));
        }
    }
    s.push('\n');

    s.push_str(&format!(
        "异常跳变记录: {} 条\n",
        result.anomalous_jumps.len()
    ));
    for j in result.anomalous_jumps.iter().take(10) {
        s.push_str(&format!(
            "  [{}] {}: {:.4} -> {:.4} (跳变率 {:.1}%)\n",
            j.measure_time,
            j.point_code,
            j.previous_value,
            j.current_value,
            j.jump_ratio * 100.0
        ));
    }
    if result.anomalous_jumps.len() > 10 {
        s.push_str(&format!(
            "  ... 还有 {} 条\n",
            result.anomalous_jumps.len() - 10
        ));
    }
    s.push('\n');

    s.push_str(&format!(
        "时间间隔异常: {} 处\n",
        result.time_interval_anomalies.len()
    ));
    for a in result.time_interval_anomalies.iter().take(10) {
        s.push_str(&format!(
            "  {}: {} ~ {} 间隔 {}秒 (期望 {}秒)\n",
            a.point_code,
            a.first_time,
            a.second_time,
            a.actual_interval_secs,
            a.expected_interval_secs
        ));
    }
    if result.time_interval_anomalies.len() > 10 {
        s.push_str(&format!(
            "  ... 还有 {} 条\n",
            result.time_interval_anomalies.len() - 10
        ));
    }
    s.push('\n');

    s.push_str(&format!(
        "近30天无剂量记录人员: {} 人\n",
        result.workers_without_dose.len()
    ));
    for w in result.workers_without_dose.iter().take(10) {
        s.push_str(&format!("  - {}\n", w));
    }
    if result.workers_without_dose.len() > 10 {
        s.push_str(&format!(
            "  ... 还有 {} 人\n",
            result.workers_without_dose.len() - 10
        ));
    }

    s.push_str("\n===============================\n");
    s
}
