use anyhow::{Context, Result};
use chrono::{Local, NaiveDate, NaiveDateTime};
use csv::Writer;
use rusqlite::params;
use serde::Serialize;
use std::fs::File;
use std::path::Path;

use crate::alert::{list_alerts, AlertLevel};
use crate::db::Db;
use crate::dose::{get_department_dose, get_period_stats, get_personal_dose, StatsPeriod};

#[derive(Debug, Serialize)]
pub struct MonthlyDoseReport {
    pub report_type: String,
    pub period: String,
    pub generated_at: NaiveDateTime,
    pub summary: ReportSummary,
    pub personal_details: Vec<PersonalDoseDetail>,
    pub department_summary: Vec<DepartmentDoseRow>,
    pub alerts: Vec<AlertRow>,
}

#[derive(Debug, Serialize)]
pub struct ReportSummary {
    pub total_workers: i64,
    pub collective_dose: f64,
    pub average_dose: f64,
    pub max_dose: f64,
    pub min_dose: f64,
    pub unit: String,
    pub yellow_alert_count: usize,
    pub red_alert_count: usize,
}

#[derive(Debug, Serialize)]
pub struct PersonalDoseDetail {
    pub employee_id: String,
    pub employee_name: String,
    pub department: String,
    pub period_dose: f64,
    pub unit: String,
    pub rank: i32,
}

#[derive(Debug, Serialize)]
pub struct DepartmentDoseRow {
    pub department: String,
    pub worker_count: i64,
    pub collective_dose: f64,
    pub average_dose: f64,
    pub max_dose: f64,
    pub unit: String,
}

#[derive(Debug, Serialize)]
pub struct AlertRow {
    pub alert_time: String,
    pub level: String,
    pub alert_type: String,
    pub employee_id: String,
    pub message: String,
}

pub enum ReportFormat {
    Text,
    Csv,
}

pub fn generate_monthly_dose_report(
    db: &Db,
    year: i32,
    month: u32,
) -> Result<MonthlyDoseReport> {
    let from_date = NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| anyhow::anyhow!("无效的年月: {}-{}", year, month))?;
    let to_date = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };

    let from = from_date.and_hms_opt(0, 0, 0).unwrap();
    let to = to_date.and_hms_opt(0, 0, 0).unwrap();

    let personal = get_personal_dose(db, None, Some(from), Some(to))?;
    let departments = get_department_dose(db, Some(from), Some(to))?;
    let alerts = list_alerts(db, None, Some(from), Some(to), None)?;

    let mut personal_details: Vec<PersonalDoseDetail> = personal
        .iter()
        .enumerate()
        .map(|(idx, s)| PersonalDoseDetail {
            employee_id: s.employee_id.clone(),
            employee_name: s.employee_name.clone(),
            department: s.department.clone(),
            period_dose: s.total_dose,
            unit: s.unit.clone(),
            rank: (idx + 1) as i32,
        })
        .collect();
    personal_details.sort_by(|a, b| {
        b.period_dose
            .partial_cmp(&a.period_dose)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (i, d) in personal_details.iter_mut().enumerate() {
        d.rank = (i + 1) as i32;
    }

    let dept_rows: Vec<DepartmentDoseRow> = departments
        .iter()
        .map(|d| DepartmentDoseRow {
            department: d.department.clone(),
            worker_count: d.worker_count,
            collective_dose: d.collective_dose,
            average_dose: d.average_dose,
            max_dose: d.max_dose,
            unit: d.unit.clone(),
        })
        .collect();

    let alert_rows: Vec<AlertRow> = alerts
        .iter()
        .map(|a| AlertRow {
            alert_time: a.alert_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            level: a.level.clone(),
            alert_type: a.alert_type.clone(),
            employee_id: a.employee_id.clone().unwrap_or_default(),
            message: a.message.clone(),
        })
        .collect();

    let total_workers = personal_details.len() as i64;
    let collective: f64 = personal_details.iter().map(|d| d.period_dose).sum();
    let avg = if total_workers > 0 {
        collective / total_workers as f64
    } else {
        0.0
    };
    let max = personal_details
        .iter()
        .map(|d| d.period_dose)
        .fold(0.0f64, f64::max);
    let min = personal_details
        .iter()
        .map(|d| d.period_dose)
        .fold(f64::INFINITY, f64::min);
    let min = if min == f64::INFINITY { 0.0 } else { min };

    let yellow_count = alert_rows.iter().filter(|a| a.level == "yellow").count();
    let red_count = alert_rows.iter().filter(|a| a.level == "red").count();

    Ok(MonthlyDoseReport {
        report_type: "月度剂量统计报告".to_string(),
        period: format!("{}-{:02}", year, month),
        generated_at: Local::now().naive_local(),
        summary: ReportSummary {
            total_workers,
            collective_dose: collective,
            average_dose: avg,
            max_dose: max,
            min_dose: min,
            unit: "uSv".to_string(),
            yellow_alert_count: yellow_count,
            red_alert_count: red_count,
        },
        personal_details,
        department_summary: dept_rows,
        alerts: alert_rows,
    })
}

pub fn report_to_text(report: &MonthlyDoseReport) -> String {
    let mut s = String::new();

    s.push_str(&format!("{:=^60}\n", ""));
    s.push_str(&format!("{:^60}\n", report.report_type));
    s.push_str(&format!("{:=^60}\n", ""));
    s.push_str(&format!("统计周期: {}\n", report.period));
    s.push_str(&format!(
        "生成时间: {}\n\n",
        report.generated_at.format("%Y-%m-%d %H:%M:%S")
    ));

    s.push_str("【汇总统计】\n");
    s.push_str(&format!("  工作人员总数: {} 人\n", report.summary.total_workers));
    s.push_str(&format!(
        "  集体有效剂量: {:.2} {}\n",
        report.summary.collective_dose, report.summary.unit
    ));
    s.push_str(&format!(
        "  人均剂量: {:.2} {}\n",
        report.summary.average_dose, report.summary.unit
    ));
    s.push_str(&format!(
        "  最大个人剂量: {:.2} {}\n",
        report.summary.max_dose, report.summary.unit
    ));
    s.push_str(&format!(
        "  最小个人剂量: {:.2} {}\n",
        report.summary.min_dose, report.summary.unit
    ));
    s.push_str(&format!(
        "  黄色预警: {} 条\n",
        report.summary.yellow_alert_count
    ));
    s.push_str(&format!(
        "  红色预警: {} 条\n\n",
        report.summary.red_alert_count
    ));

    s.push_str("【部门剂量汇总】\n");
    s.push_str(&format!("  {:<15} {:>6} {:>12} {:>10} {:>10}\n",
        "部门", "人数", "集体剂量", "人均", "最大"));
    s.push_str(&format!("  {:-<55}\n", ""));
    for d in &report.department_summary {
        s.push_str(&format!(
            "  {:<15} {:>6} {:>10.2}{} {:>8.2}{} {:>8.2}{}\n",
            d.department, d.worker_count,
            d.collective_dose, d.unit,
            d.average_dose, d.unit,
            d.max_dose, d.unit,
        ));
    }
    s.push('\n');

    s.push_str("【个人剂量排名 (Top 10)】\n");
    s.push_str(&format!("  {:>4} {:<10} {:<12} {:<15} {:>12}\n",
        "排名", "工号", "姓名", "部门", "剂量"));
    s.push_str(&format!("  {:-<55}\n", ""));
    let top_n = std::cmp::min(10, report.personal_details.len());
    for d in report.personal_details.iter().take(top_n) {
        s.push_str(&format!(
            "  {:>4} {:<10} {:<12} {:<15} {:>10.2}{}\n",
            d.rank, d.employee_id, d.employee_name, d.department,
            d.period_dose, d.unit
        ));
    }
    s.push('\n');

    if !report.alerts.is_empty() {
        s.push_str("【预警记录】\n");
        for a in &report.alerts {
            s.push_str(&format!(
                "  [{}] [{}] {} - {}\n",
                a.alert_time,
                a.level.to_uppercase(),
                a.alert_type,
                a.message
            ));
        }
    }

    s.push_str(&format!("{:=^60}\n", ""));
    s
}

pub fn report_to_csv(report: &MonthlyDoseReport, output_dir: &Path) -> Result<()> {
    std::fs::create_dir_all(output_dir)
        .with_context(|| format!("无法创建输出目录: {:?}", output_dir))?;

    let summary_path = output_dir.join(format!("{}_summary.csv", report.period));
    let mut wtr = Writer::from_path(&summary_path)
        .with_context(|| format!("无法创建汇总CSV: {:?}", summary_path))?;
    wtr.write_record(&[
        "report_type", "period", "total_workers", "collective_dose",
        "average_dose", "max_dose", "min_dose", "unit",
        "yellow_alerts", "red_alerts",
    ])?;
    wtr.write_record(&[
        &report.report_type,
        &report.period,
        &report.summary.total_workers.to_string(),
        &format!("{:.2}", report.summary.collective_dose),
        &format!("{:.2}", report.summary.average_dose),
        &format!("{:.2}", report.summary.max_dose),
        &format!("{:.2}", report.summary.min_dose),
        &report.summary.unit,
        &report.summary.yellow_alert_count.to_string(),
        &report.summary.red_alert_count.to_string(),
    ])?;
    wtr.flush()?;

    let personal_path = output_dir.join(format!("{}_personal_dose.csv", report.period));
    let mut wtr = Writer::from_path(&personal_path)
        .with_context(|| format!("无法创建个人剂量CSV: {:?}", personal_path))?;
    wtr.write_record(&["rank", "employee_id", "employee_name", "department", "period_dose", "unit"])?;
    for d in &report.personal_details {
        wtr.write_record(&[
            &d.rank.to_string(),
            &d.employee_id,
            &d.employee_name,
            &d.department,
            &format!("{:.2}", d.period_dose),
            &d.unit,
        ])?;
    }
    wtr.flush()?;

    let dept_path = output_dir.join(format!("{}_department.csv", report.period));
    let mut wtr = Writer::from_path(&dept_path)
        .with_context(|| format!("无法创建部门CSV: {:?}", dept_path))?;
    wtr.write_record(&["department", "worker_count", "collective_dose", "average_dose", "max_dose", "unit"])?;
    for d in &report.department_summary {
        wtr.write_record(&[
            &d.department,
            &d.worker_count.to_string(),
            &format!("{:.2}", d.collective_dose),
            &format!("{:.2}", d.average_dose),
            &format!("{:.2}", d.max_dose),
            &d.unit,
        ])?;
    }
    wtr.flush()?;

    let alert_path = output_dir.join(format!("{}_alerts.csv", report.period));
    let mut wtr = Writer::from_path(&alert_path)
        .with_context(|| format!("无法创建预警CSV: {:?}", alert_path))?;
    wtr.write_record(&["alert_time", "level", "alert_type", "employee_id", "message"])?;
    for a in &report.alerts {
        wtr.write_record(&[&a.alert_time, &a.level, &a.alert_type, &a.employee_id, &a.message])?;
    }
    wtr.flush()?;

    Ok(())
}

pub fn generate_survey_report(db: &Db, from: NaiveDateTime, to: NaiveDateTime) -> Result<String> {
    let mut s = String::new();
    s.push_str("巡检异常报告\n");
    s.push_str(&format!("时间范围: {} 至 {}\n\n",
        from.format("%Y-%m-%d %H:%M"), to.format("%Y-%m-%d %H:%M")));

    let conn = db.conn();
    let mut stmt = conn.prepare(
        "SELECT s.point_code, m.area_name, m.area_type, s.measure_time, s.dose_rate, s.unit, s.surveyor
         FROM survey_records s
         JOIN monitor_points m ON s.point_code = m.point_code
         WHERE s.measure_time >= ?1 AND s.measure_time <= ?2
         ORDER BY s.dose_rate DESC
         LIMIT 20",
    )?;

    let rows = stmt.query_map(
        params![
            from.format("%Y-%m-%d %H:%M:%S").to_string(),
            to.format("%Y-%m-%d %H:%M:%S").to_string()
        ],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        },
    )?;

    s.push_str("Top 20 高剂量率监测点\n");
    s.push_str(&format!("{:<18} {:<12} {:<10} {:<20} {:>10} {:<8}\n",
        "监测点", "区域", "区域类型", "测量时间", "剂量率", "巡检员"));
    s.push_str(&format!("{:-<80}\n", ""));

    for row in rows {
        let (code, area, atype, time, rate, unit, surveyor) = row?;
        s.push_str(&format!(
            "{:<18} {:<12} {:<10} {:<20} {:>8.3}{} {:<8}\n",
            code, area, atype, time, rate, unit,
            surveyor.unwrap_or_default()
        ));
    }

    Ok(s)
}
