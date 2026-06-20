use anyhow::{anyhow, Context, Result};
use chrono::{Datelike, Local, NaiveDate, NaiveDateTime};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::Db;
use crate::dose::get_yearly_dose_for_worker;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePermitRequest {
    pub employee_id: String,
    pub employee_name: String,
    pub department: String,
    pub area_type: String,
    pub area_name: String,
    pub work_type: String,
    pub valid_from: NaiveDate,
    pub valid_to: NaiveDate,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermitInfo {
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

#[derive(Debug, Serialize)]
pub struct ApprovalResult {
    pub approved: bool,
    pub permit_no: String,
    pub reason: String,
    pub current_yearly_dose: f64,
    pub yearly_limit: f64,
}

pub fn create_permit(db: &Db, req: CreatePermitRequest) -> Result<PermitInfo> {
    if req.valid_from > req.valid_to {
        return Err(anyhow!("有效期开始日期不能晚于结束日期"));
    }
    if req.valid_to < Local::now().date_naive() {
        return Err(anyhow!("有效期结束日期不能早于今天"));
    }

    let now = Local::now().naive_local();
    let permit_no = generate_permit_no(&now);

    db.conn().execute(
        "INSERT INTO work_permits (permit_no, employee_id, employee_name, department, 
             area_type, area_name, work_type, valid_from, valid_to, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)",
        params![
            permit_no,
            req.employee_id,
            req.employee_name,
            req.department,
            req.area_type,
            req.area_name,
            req.work_type,
            req.valid_from.format("%Y-%m-%d").to_string(),
            req.valid_to.format("%Y-%m-%d").to_string(),
            now.format("%Y-%m-%d %H:%M:%S").to_string(),
        ],
    )?;

    db.upsert_worker(&req.employee_id, &req.employee_name, &req.department, "occupational")?;

    get_permit_by_no(db, &permit_no)
}

fn generate_permit_no(now: &NaiveDateTime) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let rand: u32 = rng.gen_range(1000..9999);
    format!(
        "RP-{}{:02}{:02}-{:04}",
        now.year(),
        now.month(),
        now.day(),
        rand
    )
}

pub fn get_permit_by_no(db: &Db, permit_no: &str) -> Result<PermitInfo> {
    let conn = db.conn();
    conn.query_row(
        "SELECT id, permit_no, employee_id, employee_name, department,
                area_type, area_name, work_type, valid_from, valid_to,
                status, approved_by, approved_at, reject_reason, created_at
         FROM work_permits WHERE permit_no = ?1",
        params![permit_no],
        |row| parse_permit_row(row),
    )
    .with_context(|| format!("许可证不存在: {}", permit_no))
}

fn parse_permit_row(row: &rusqlite::Row) -> Result<PermitInfo, rusqlite::Error> {
    let valid_from_str: String = row.get(8)?;
    let valid_to_str: String = row.get(9)?;
    let approved_at_str: Option<String> = row.get(12)?;
    let created_at_str: String = row.get(14)?;

    Ok(PermitInfo {
        id: row.get(0)?,
        permit_no: row.get(1)?,
        employee_id: row.get(2)?,
        employee_name: row.get(3)?,
        department: row.get(4)?,
        area_type: row.get(5)?,
        area_name: row.get(6)?,
        work_type: row.get(7)?,
        valid_from: NaiveDate::parse_from_str(&valid_from_str, "%Y-%m-%d").unwrap_or_default(),
        valid_to: NaiveDate::parse_from_str(&valid_to_str, "%Y-%m-%d").unwrap_or_default(),
        status: row.get(10)?,
        approved_by: row.get(11)?,
        approved_at: approved_at_str.and_then(|s| {
            NaiveDateTime::parse_from_str(&s, "%Y-%m-%d %H:%M:%S").ok()
        }),
        reject_reason: row.get(13)?,
        created_at: NaiveDateTime::parse_from_str(&created_at_str, "%Y-%m-%d %H:%M:%S")
            .unwrap_or_default(),
    })
}

pub fn approve_permit(db: &Db, permit_no: &str, approver: &str) -> Result<ApprovalResult> {
    let permit = get_permit_by_no(db, permit_no)?;

    if permit.status != "pending" {
        return Err(anyhow!(
            "许可证状态为 {}，无法审批",
            permit.status
        ));
    }

    let current_year = Local::now().year();
    let yearly_dose_usv = get_yearly_dose_for_worker(db, &permit.employee_id, current_year)?;
    let yearly_dose_msv = yearly_dose_usv / 1000.0;

    let year_limit_msv = db.get_dose_limit("occupational", "year", 1)?.unwrap_or(50.0);

    if yearly_dose_msv >= year_limit_msv {
        let reason = format!(
            "员工{}({})年度累积剂量已达{:.2}mSv，超过年限值{:.2}mSv，不予批准",
            permit.employee_name, permit.employee_id, yearly_dose_msv, year_limit_msv
        );
        reject_permit_internal(db, permit_no, &reason)?;
        return Ok(ApprovalResult {
            approved: false,
            permit_no: permit_no.to_string(),
            reason,
            current_yearly_dose: yearly_dose_msv,
            yearly_limit: year_limit_msv,
        });
    }

    let now = Local::now().naive_local();
    db.conn().execute(
        "UPDATE work_permits SET status = 'approved', approved_by = ?1, approved_at = ?2 WHERE permit_no = ?3",
        params![
            approver,
            now.format("%Y-%m-%d %H:%M:%S").to_string(),
            permit_no
        ],
    )?;

    Ok(ApprovalResult {
        approved: true,
        permit_no: permit_no.to_string(),
        reason: format!(
            "批准通过，当前年度剂量{:.2}mSv，年限值{:.2}mSv",
            yearly_dose_msv, year_limit_msv
        ),
        current_yearly_dose: yearly_dose_msv,
        yearly_limit: year_limit_msv,
    })
}

fn reject_permit_internal(db: &Db, permit_no: &str, reason: &str) -> Result<()> {
    db.conn().execute(
        "UPDATE work_permits SET status = 'rejected', reject_reason = ?1 WHERE permit_no = ?2",
        params![reason, permit_no],
    )?;
    Ok(())
}

pub fn reject_permit(db: &Db, permit_no: &str, reason: &str) -> Result<()> {
    let permit = get_permit_by_no(db, permit_no)?;
    if permit.status != "pending" {
        return Err(anyhow!(
            "许可证状态为 {}，无法驳回",
            permit.status
        ));
    }
    reject_permit_internal(db, permit_no, reason)
}

pub fn list_permits(
    db: &Db,
    status: Option<&str>,
    employee_id: Option<&str>,
    limit: Option<i64>,
) -> Result<Vec<PermitInfo>> {
    let mut sql = String::from(
        "SELECT id, permit_no, employee_id, employee_name, department,
                area_type, area_name, work_type, valid_from, valid_to,
                status, approved_by, approved_at, reject_reason, created_at
         FROM work_permits WHERE 1=1",
    );
    let mut params_vec: Vec<String> = Vec::new();

    if let Some(s) = status {
        sql.push_str(" AND status = ?");
        params_vec.push(s.to_string());
    }
    if let Some(e) = employee_id {
        sql.push_str(" AND employee_id = ?");
        params_vec.push(e.to_string());
    }
    sql.push_str(" ORDER BY created_at DESC");
    if let Some(l) = limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }

    let conn = db.conn();
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| parse_permit_row(row))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}
