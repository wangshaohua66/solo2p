use anyhow::{anyhow, Context, Result};
use chrono::NaiveDateTime;
use csv::ReaderBuilder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use crate::db::{Db, DoseRecord, SurveyRecord};
use crate::error_codes::{err, ErrorCode};

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub total: usize,
    pub inserted: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub duration_ms: u128,
}

#[derive(Debug, Deserialize)]
struct SurveyCsvRow {
    point_code: String,
    measure_time: String,
    dose_rate: f64,
    unit: Option<String>,
    surveyor: Option<String>,
    instrument: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DoseJsonRecord {
    employee_id: String,
    employee_name: String,
    department: String,
    record_time: String,
    cumulative_dose: f64,
    unit: Option<String>,
}

pub fn import_survey_csv<P: AsRef<Path>>(db: &Db, path: P) -> Result<ImportResult> {
    let start = std::time::Instant::now();
    let path = path.as_ref();
    let file = File::open(path).with_context(|| format!("无法打开文件: {:?}", path))?;
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(BufReader::new(file));

    let mut records: Vec<SurveyRecord> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut total = 0usize;

    for (idx, result) in rdr.deserialize::<SurveyCsvRow>().enumerate() {
        total += 1;
        let line_num = idx + 2;
        match result {
            Ok(row) => {
                match validate_survey_row(&row) {
                    Ok(rec) => records.push(rec),
                    Err(e) => errors.push(format!("第{}行: {}", line_num, e)),
                }
            }
            Err(e) => errors.push(format!("第{}行: 解析失败 - {}", line_num, e)),
        }
    }

    let (inserted, skipped) = db.batch_insert_survey(&records)
        .context("批量插入巡检数据失败")?;

    Ok(ImportResult {
        total,
        inserted,
        skipped: skipped + errors.len(),
        errors,
        duration_ms: start.elapsed().as_millis(),
    })
}

fn validate_survey_row(row: &SurveyCsvRow) -> Result<SurveyRecord> {
    if row.point_code.trim().is_empty() {
        return Err(err(ErrorCode::EmptyValue, "监测点编号不能为空".to_string()));
    }
    let measure_time = NaiveDateTime::parse_from_str(&row.measure_time, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(&row.measure_time, "%Y/%m/%d %H:%M:%S"))
        .map_err(|_| err(ErrorCode::InvalidTimestamp, format!("时间戳格式无效: {}", row.measure_time)))?;
    if row.dose_rate < 0.0 {
        return Err(err(ErrorCode::ValueOutOfRange, format!("剂量率不能为负数: {}", row.dose_rate)));
    }
    if row.dose_rate > 10000.0 {
        return Err(err(ErrorCode::ValueOutOfRange, format!("剂量率超出合理范围: {}", row.dose_rate)));
    }
    Ok(SurveyRecord {
        id: 0,
        point_code: row.point_code.trim().to_string(),
        measure_time,
        dose_rate: row.dose_rate,
        unit: row.unit.clone().unwrap_or_else(|| "uSv/h".to_string()),
        surveyor: row.surveyor.clone(),
        instrument: row.instrument.clone(),
    })
}

pub fn import_dose_json<P: AsRef<Path>>(db: &Db, path: P) -> Result<ImportResult> {
    let start = std::time::Instant::now();
    let path = path.as_ref();
    let file = File::open(path).with_context(|| format!("无法打开文件: {:?}", path))?;
    let reader = BufReader::new(file);

    let value: Value = serde_json::from_reader(reader)
        .context("JSON解析失败")?;

    let records_array = value.as_array()
        .ok_or_else(|| err(ErrorCode::InvalidFormat, "JSON必须是数组格式".to_string()))?;

    let mut records: Vec<DoseRecord> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let total = records_array.len();

    for (idx, item) in records_array.iter().enumerate() {
        let line_num = idx + 1;
        match serde_json::from_value::<DoseJsonRecord>(item.clone()) {
            Ok(row) => {
                match validate_dose_record(&row) {
                    Ok(rec) => {
                        db.upsert_worker(&rec.employee_id, &rec.employee_name, &rec.department, "occupational")?;
                        records.push(rec);
                    }
                    Err(e) => errors.push(format!("第{}条: {}", line_num, e)),
                }
            }
            Err(e) => errors.push(format!("第{}条: 解析失败 - {}", line_num, e)),
        }
    }

    let (inserted, skipped) = db.batch_insert_dose(&records)
        .context("批量插入剂量数据失败")?;

    Ok(ImportResult {
        total,
        inserted,
        skipped: skipped + errors.len(),
        errors,
        duration_ms: start.elapsed().as_millis(),
    })
}

fn validate_dose_record(row: &DoseJsonRecord) -> Result<DoseRecord> {
    if row.employee_id.trim().is_empty() {
        return Err(err(ErrorCode::EmptyValue, "员工工号不能为空".to_string()));
    }
    if row.employee_name.trim().is_empty() {
        return Err(err(ErrorCode::EmptyValue, "员工姓名不能为空".to_string()));
    }
    if row.department.trim().is_empty() {
        return Err(err(ErrorCode::EmptyValue, "部门不能为空".to_string()));
    }
    let record_time = NaiveDateTime::parse_from_str(&row.record_time, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(&row.record_time, "%Y/%m/%d %H:%M:%S"))
        .or_else(|_| NaiveDateTime::parse_from_str(&row.record_time, "%Y-%m-%dT%H:%M:%S"))
        .map_err(|_| err(ErrorCode::InvalidTimestamp, format!("时间戳格式无效: {}", row.record_time)))?;
    if row.cumulative_dose < 0.0 {
        return Err(err(ErrorCode::ValueOutOfRange, format!("累积剂量不能为负数: {}", row.cumulative_dose)));
    }
    if row.cumulative_dose > 10000.0 {
        return Err(err(ErrorCode::ValueOutOfRange, format!("累积剂量超出合理范围: {}", row.cumulative_dose)));
    }
    Ok(DoseRecord {
        id: 0,
        employee_id: row.employee_id.trim().to_string(),
        employee_name: row.employee_name.trim().to_string(),
        department: row.department.trim().to_string(),
        record_time,
        cumulative_dose: row.cumulative_dose,
        unit: row.unit.clone().unwrap_or_else(|| "uSv".to_string()),
    })
}

pub fn auto_import<P: AsRef<Path>>(db: &Db, path: P) -> Result<ImportResult> {
    let path = path.as_ref();
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| err(ErrorCode::UnsupportedExt, "无法识别文件扩展名".to_string()))?;

    match ext.as_str() {
        "csv" => import_survey_csv(db, path),
        "json" => import_dose_json(db, path),
        _ => Err(err(ErrorCode::UnsupportedFormat, format!("不支持的文件格式: .{}，仅支持 .csv 和 .json", ext))),
    }
}
