use anyhow::Result;
use chrono::NaiveDateTime;
use comfy_table::{Cell, Color, ContentArrangement, Table};
use rusqlite::params;

use crate::db::{Db, DoseRecord, SurveyRecord};

#[derive(Debug)]
pub struct QueryParams {
    pub point_code: Option<String>,
    pub employee_id: Option<String>,
    pub from: Option<NaiveDateTime>,
    pub to: Option<NaiveDateTime>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn query_survey_records(db: &Db, params: &QueryParams) -> Result<Vec<SurveyRecord>> {
    let mut sql = String::from(
        "SELECT id, point_code, measure_time, dose_rate, unit, surveyor, instrument
         FROM survey_records WHERE 1=1",
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(pc) = &params.point_code {
        sql.push_str(" AND point_code LIKE ?");
        params_vec.push(format!("%{}%", pc));
    }
    if let Some(f) = params.from {
        sql.push_str(" AND measure_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = params.to {
        sql.push_str(" AND measure_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" ORDER BY measure_time DESC");
    if let Some(l) = params.limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }
    if let Some(o) = params.offset {
        sql.push_str(&format!(" OFFSET {}", o));
    }

    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let time_str: String = row.get(2)?;
        Ok(SurveyRecord {
            id: row.get(0)?,
            point_code: row.get(1)?,
            measure_time: NaiveDateTime::parse_from_str(&time_str, "%Y-%m-%d %H:%M:%S")
                .unwrap_or_default(),
            dose_rate: row.get(3)?,
            unit: row.get(4)?,
            surveyor: row.get(5)?,
            instrument: row.get(6)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn query_dose_records(db: &Db, params: &QueryParams) -> Result<Vec<DoseRecord>> {
    let mut sql = String::from(
        "SELECT id, employee_id, employee_name, department, record_time, cumulative_dose, unit
         FROM dose_records WHERE 1=1",
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(eid) = &params.employee_id {
        sql.push_str(" AND employee_id LIKE ?");
        params_vec.push(format!("%{}%", eid));
    }
    if let Some(pc) = &params.point_code {
        sql.push_str(" AND employee_id IN (SELECT DISTINCT wp.employee_id FROM work_permits wp JOIN monitor_points m ON wp.area_name = m.area_name WHERE m.point_code LIKE ?)");
        params_vec.push(format!("%{}%", pc));
    }
    if let Some(f) = params.from {
        sql.push_str(" AND record_time >= ?");
        params_vec.push(f.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if let Some(t) = params.to {
        sql.push_str(" AND record_time <= ?");
        params_vec.push(t.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    sql.push_str(" ORDER BY record_time DESC");
    if let Some(l) = params.limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }
    if let Some(o) = params.offset {
        sql.push_str(&format!(" OFFSET {}", o));
    }

    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        let time_str: String = row.get(4)?;
        Ok(DoseRecord {
            id: row.get(0)?,
            employee_id: row.get(1)?,
            employee_name: row.get(2)?,
            department: row.get(3)?,
            record_time: NaiveDateTime::parse_from_str(&time_str, "%Y-%m-%d %H:%M:%S")
                .unwrap_or_default(),
            cumulative_dose: row.get(5)?,
            unit: row.get(6)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn render_survey_table(records: &[SurveyRecord]) -> Table {
    let mut table = Table::new();
    table
        .set_header(vec![
            "ID", "监测点", "测量时间", "剂量率", "单位", "巡检员", "仪器",
        ])
        .set_content_arrangement(ContentArrangement::Dynamic);

    for rec in records {
        table.add_row(vec![
            Cell::new(rec.id),
            Cell::new(&rec.point_code),
            Cell::new(rec.measure_time.format("%Y-%m-%d %H:%M:%S").to_string()),
            Cell::new(format!("{:.4}", rec.dose_rate)),
            Cell::new(&rec.unit),
            Cell::new(rec.surveyor.as_deref().unwrap_or("-")),
            Cell::new(rec.instrument.as_deref().unwrap_or("-")),
        ]);
    }
    table
}

pub fn render_dose_table(records: &[DoseRecord]) -> Table {
    let mut table = Table::new();
    table
        .set_header(vec![
            "ID", "工号", "姓名", "部门", "记录时间", "累积剂量", "单位",
        ])
        .set_content_arrangement(ContentArrangement::Dynamic);

    for rec in records {
        let dose_str = format!("{:.4}", rec.cumulative_dose);
        table.add_row(vec![
            Cell::new(rec.id),
            Cell::new(&rec.employee_id),
            Cell::new(&rec.employee_name),
            Cell::new(&rec.department),
            Cell::new(rec.record_time.format("%Y-%m-%d %H:%M:%S").to_string()),
            Cell::new(dose_str),
            Cell::new(&rec.unit),
        ]);
    }
    table
}

pub fn export_survey_csv(records: &[SurveyRecord], path: &std::path::Path) -> Result<()> {
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(&["id", "point_code", "measure_time", "dose_rate", "unit", "surveyor", "instrument"])?;
    for rec in records {
        wtr.write_record(&[
            rec.id.to_string(),
            rec.point_code.clone(),
            rec.measure_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            format!("{:.6}", rec.dose_rate),
            rec.unit.clone(),
            rec.surveyor.clone().unwrap_or_default(),
            rec.instrument.clone().unwrap_or_default(),
        ])?;
    }
    wtr.flush()?;
    Ok(())
}

pub fn export_dose_csv(records: &[DoseRecord], path: &std::path::Path) -> Result<()> {
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(&["id", "employee_id", "employee_name", "department", "record_time", "cumulative_dose", "unit"])?;
    for rec in records {
        wtr.write_record(&[
            rec.id.to_string(),
            rec.employee_id.clone(),
            rec.employee_name.clone(),
            rec.department.clone(),
            rec.record_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            format!("{:.6}", rec.cumulative_dose),
            rec.unit.clone(),
        ])?;
    }
    wtr.flush()?;
    Ok(())
}
