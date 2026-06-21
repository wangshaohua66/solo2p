use anyhow::{Context, Result};
use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::Db;
use crate::error_codes::{err, ErrorCode};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DoseSummary {
    pub employee_id: String,
    pub employee_name: String,
    pub department: String,
    pub total_dose: f64,
    pub unit: String,
    pub record_count: i64,
    pub first_record: Option<NaiveDateTime>,
    pub last_record: Option<NaiveDateTime>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepartmentDose {
    pub department: String,
    pub worker_count: i64,
    pub collective_dose: f64,
    pub average_dose: f64,
    pub max_dose: f64,
    pub unit: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AreaDose {
    pub area_type: String,
    pub area_name: String,
    pub worker_count: i64,
    pub collective_dose: f64,
    pub average_dose: f64,
    pub max_dose: f64,
    pub unit: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeriodStats {
    pub period_label: String,
    pub worker_count: i64,
    pub collective_dose: f64,
    pub average_dose: f64,
    pub max_dose: f64,
    pub min_dose: f64,
    pub unit: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatsPeriod {
    Monthly,
    Quarterly,
    Yearly,
    Custom,
}

impl StatsPeriod {
    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "month" | "monthly" => Ok(StatsPeriod::Monthly),
            "quarter" | "quarterly" => Ok(StatsPeriod::Quarterly),
            "year" | "yearly" => Ok(StatsPeriod::Yearly),
            "custom" => Ok(StatsPeriod::Custom),
            _ => Err(err(ErrorCode::InvalidPeriod, format!("不支持的统计周期: {}", s))),
        }
    }
}

pub fn get_personal_dose(
    db: &Db,
    employee_id: Option<&str>,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<Vec<DoseSummary>> {
    let mut sql = String::from(
        "SELECT employee_id, employee_name, department, 
                MAX(cumulative_dose) - MIN(cumulative_dose) as period_dose,
                COUNT(*) as record_count,
                MIN(record_time) as first_time,
                MAX(record_time) as last_time
         FROM dose_records WHERE 1=1",
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(eid) = employee_id {
        sql.push_str(" AND employee_id = ?");
        params_vec.push(eid.to_string());
    }
    if let Some(f) = from {
        sql.push_str(" AND record_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = to {
        sql.push_str(" AND record_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" GROUP BY employee_id, employee_name, department ORDER BY period_dose DESC");

    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(DoseSummary {
            employee_id: row.get(0)?,
            employee_name: row.get(1)?,
            department: row.get(2)?,
            total_dose: row.get::<_, f64>(3).unwrap_or(0.0),
            unit: "uSv".to_string(),
            record_count: row.get(4)?,
            first_record: row
                .get::<_, Option<String>>(5)?
                .and_then(|s| NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S").ok()),
            last_record: row
                .get::<_, Option<String>>(6)?
                .and_then(|s| NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S").ok()),
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn get_department_dose(
    db: &Db,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<Vec<DepartmentDose>> {
    let summaries = get_personal_dose(db, None, from, to)?;
    let mut dept_map: std::collections::HashMap<String, Vec<&DoseSummary>> =
        std::collections::HashMap::new();

    for s in &summaries {
        dept_map
            .entry(s.department.clone())
            .or_default()
            .push(s);
    }

    let mut result: Vec<DepartmentDose> = dept_map
        .into_iter()
        .map(|(dept, workers)| {
            let collective: f64 = workers.iter().map(|w| w.total_dose).sum();
            let avg = if workers.is_empty() {
                0.0
            } else {
                collective / workers.len() as f64
            };
            let max = workers
                .iter()
                .map(|w| w.total_dose)
                .fold(0.0f64, f64::max);
            DepartmentDose {
                department: dept,
                worker_count: workers.len() as i64,
                collective_dose: collective,
                average_dose: avg,
                max_dose: max,
                unit: "uSv".to_string(),
            }
        })
        .collect();

    result.sort_by(|a, b| b.collective_dose.partial_cmp(&a.collective_dose).unwrap_or(std::cmp::Ordering::Equal));
    Ok(result)
}

pub fn get_period_stats(
    db: &Db,
    period: StatsPeriod,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<Vec<PeriodStats>> {
    let (sql, params_vec) = build_period_query(period, from, to)?;
    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(PeriodStats {
            period_label: row.get(0)?,
            worker_count: row.get(1)?,
            collective_dose: row.get::<_, f64>(2).unwrap_or(0.0),
            average_dose: row.get::<_, f64>(3).unwrap_or(0.0),
            max_dose: row.get::<_, f64>(4).unwrap_or(0.0),
            min_dose: row.get::<_, f64>(5).unwrap_or(0.0),
            unit: "uSv".to_string(),
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

fn build_period_query(
    period: StatsPeriod,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<(String, Vec<String>)> {
    let date_format = match period {
        StatsPeriod::Monthly => "%Y-%m",
        StatsPeriod::Quarterly => "%Y-Q",
        StatsPeriod::Yearly => "%Y",
        StatsPeriod::Custom => "%Y-%m-%d",
    };

    let mut params_vec: Vec<String> = Vec::new();

    let inner_sql = if matches!(period, StatsPeriod::Quarterly) {
        "SELECT employee_id, 
                strftime('%Y', record_time) || '-Q' || ((CAST(strftime('%m', record_time) AS INTEGER) - 1) / 3 + 1) as period_key,
                MAX(cumulative_dose) - MIN(cumulative_dose) as person_dose
         FROM dose_records
         WHERE 1=1"
            .to_string()
    } else {
        format!(
            "SELECT employee_id, strftime('{}', record_time) as period_key,
                    MAX(cumulative_dose) - MIN(cumulative_dose) as person_dose
             FROM dose_records
             WHERE 1=1",
            date_format
        )
    };

    let mut sql = inner_sql;
    if let Some(f) = from {
        sql.push_str(" AND record_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = to {
        sql.push_str(" AND record_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" GROUP BY employee_id, period_key");

    sql = format!(
        "SELECT period_key as period_label,
                COUNT(*) as worker_count,
                SUM(person_dose) as collective_dose,
                AVG(person_dose) as average_dose,
                MAX(person_dose) as max_dose,
                MIN(person_dose) as min_dose
         FROM ({})
         GROUP BY period_key
         ORDER BY period_key",
        sql
    );

    Ok((sql, params_vec))
}

pub fn get_yearly_dose_for_worker(db: &Db, employee_id: &str, year: i32) -> Result<f64> {
    let from = NaiveDate::from_ymd_opt(year, 1, 1)
        .ok_or_else(|| err(ErrorCode::InvalidValue, "无效的年份".to_string()))?
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let to = NaiveDate::from_ymd_opt(year + 1, 1, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();

    let conn = db.conn();
    let result: Result<f64, _> = conn.query_row(
        "SELECT MAX(cumulative_dose) - MIN(cumulative_dose) 
         FROM dose_records 
         WHERE employee_id = ?1 AND record_time >= ?2 AND record_time < ?3",
        params![
            employee_id,
            from.format("%Y-%m-%d %H:%M:%S").to_string(),
            to.format("%Y-%m-%d %H:%M:%S").to_string()
        ],
        |row| row.get::<_, Option<f64>>(0).map(|v| v.unwrap_or(0.0)),
    );
    result.map_err(|e| err(ErrorCode::DatabaseQuery, format!("{}", e)))
}

pub fn get_5year_dose_for_worker(db: &Db, employee_id: &str, end_year: i32) -> Result<f64> {
    let mut total = 0.0;
    for y in (end_year - 4)..=end_year {
        total += get_yearly_dose_for_worker(db, employee_id, y).unwrap_or(0.0);
    }
    Ok(total)
}

pub fn get_collective_dose(
    db: &Db,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<f64> {
    let summaries = get_personal_dose(db, None, from, to)?;
    Ok(summaries.iter().map(|s| s.total_dose).sum())
}

pub fn get_area_dose(
    db: &Db,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
) -> Result<Vec<AreaDose>> {
    let mut sql = String::from(
        "SELECT wp.area_type, wp.area_name, d.employee_id,
                MAX(d.cumulative_dose) - MIN(d.cumulative_dose) as person_dose
         FROM dose_records d
         JOIN work_permits wp ON d.employee_id = wp.employee_id
         WHERE 1=1",
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(f) = from {
        sql.push_str(" AND d.record_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = to {
        sql.push_str(" AND d.record_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" GROUP BY wp.area_type, wp.area_name, d.employee_id");

    let outer_sql = format!(
        "SELECT area_type, area_name,
                COUNT(*) as worker_count,
                SUM(person_dose) as collective_dose,
                AVG(person_dose) as average_dose,
                MAX(person_dose) as max_dose
         FROM ({}) sub
         GROUP BY area_type, area_name
         ORDER BY collective_dose DESC",
        sql
    );

    let conn = db.conn();
    let mut stmt = conn.prepare(&outer_sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(AreaDose {
            area_type: row.get(0)?,
            area_name: row.get(1)?,
            worker_count: row.get(2)?,
            collective_dose: row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
            average_dose: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
            max_dose: row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
            unit: "uSv".to_string(),
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}
