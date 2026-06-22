use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;

use crate::calculator::dispute::{AdjustmentItem, DisputeRecord, DisputeStatus};
use crate::calculator::fee::{FeeDetail, FeeResult};
use crate::db::schema;
use crate::models::port::{FeeCategory, Port, PortRateConfig, RateRule, TierRate};
use crate::models::ship::{Ship, VesselType};

#[derive(Debug, Error)]
pub enum DbError {
    #[error("数据库错误: {0}")]
    SqlError(#[from] rusqlite::Error),
    #[error("数据解析错误: {0}")]
    ParseError(String),
    #[error("记录不存在: {0}")]
    NotFound(String),
    #[error("事务失败: {0}")]
    TransactionError(String),
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, DbError> {
        if let Some(parent) = path.as_ref().parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| DbError::ParseError(e.to_string()))?;
            }
        }

        let conn = Connection::open(path)?;
        schema::init_schema(&conn)?;
        Ok(Database { conn })
    }

    pub fn open_in_memory() -> Result<Self, DbError> {
        let conn = Connection::open_in_memory()?;
        schema::init_schema(&conn)?;
        Ok(Database { conn })
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    pub fn insert_ship(&self, ship: &Ship) -> Result<i64, DbError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO ships (
                imo, vessel_name, vessel_type, net_tonnage,
                arrival_time, departure_time, port_code,
                cargo_tonnage, pilot_hours, tug_count, tug_hours, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                ship.imo,
                ship.vessel_name,
                ship.vessel_type.as_str(),
                ship.net_tonnage,
                ship.arrival_time.to_rfc3339(),
                ship.departure_time.to_rfc3339(),
                ship.port_code,
                ship.cargo_tonnage,
                ship.pilot_hours,
                ship.tug_count as i64,
                ship.tug_hours,
                ship.created_at.to_rfc3339(),
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn find_conflicting_ships(&self, ship: &Ship) -> Result<Vec<Ship>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM ships WHERE imo = ?1 AND arrival_time = ?2"
        )?;
        let conflicts = stmt
            .query_map(
                params![ship.imo, ship.arrival_time.to_rfc3339()],
                row_to_ship,
            )?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(conflicts)
    }

    pub fn update_ship(&self, ship: &Ship) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE ships SET
                vessel_name = ?2,
                vessel_type = ?3,
                net_tonnage = ?4,
                departure_time = ?5,
                port_code = ?6,
                cargo_tonnage = ?7,
                pilot_hours = ?8,
                tug_count = ?9,
                tug_hours = ?10
             WHERE imo = ?1 AND arrival_time = ?11",
            params![
                ship.imo,
                ship.vessel_name,
                ship.vessel_type.as_str(),
                ship.net_tonnage,
                ship.departure_time.to_rfc3339(),
                ship.port_code,
                ship.cargo_tonnage,
                ship.pilot_hours,
                ship.tug_count as i64,
                ship.tug_hours,
                ship.arrival_time.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_ship(&self, id: i64) -> Result<Option<Ship>, DbError> {
        self.conn
            .query_row(
                "SELECT * FROM ships WHERE id = ?1",
                params![id],
                row_to_ship,
            )
            .optional()
            .map_err(DbError::from)
    }

    pub fn find_ships(
        &self,
        imo: Option<&str>,
        port_code: Option<&str>,
        date_from: Option<DateTime<Utc>>,
        date_to: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<Ship>, DbError> {
        let mut sql = String::from("SELECT * FROM ships WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(i) = imo {
            sql.push_str(" AND imo LIKE ?");
            params_vec.push(Box::new(format!("%{}%", i)));
        }
        if let Some(p) = port_code {
            sql.push_str(" AND port_code = ?");
            params_vec.push(Box::new(p.to_string()));
        }
        if let Some(d) = date_from {
            sql.push_str(" AND arrival_time >= ?");
            params_vec.push(Box::new(d.to_rfc3339()));
        }
        if let Some(d) = date_to {
            sql.push_str(" AND arrival_time <= ?");
            params_vec.push(Box::new(d.to_rfc3339()));
        }

        sql.push_str(" ORDER BY arrival_time DESC LIMIT ?");
        params_vec.push(Box::new(limit));

        let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let ships = stmt
            .query_map(refs.as_slice(), row_to_ship)?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(ships)
    }

    pub fn list_ships(&self, limit: i64) -> Result<Vec<Ship>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM ships ORDER BY created_at DESC LIMIT ?1",
        )?;
        let ships = stmt
            .query_map(params![limit], row_to_ship)?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(ships)
    }

    pub fn insert_rate_rule(&self, rule: &RateRule) -> Result<i64, DbError> {
        self.conn.execute(
            "INSERT INTO rate_rules (
                port_code, fee_category, tier_from, tier_to, unit_rate, base_fee,
                effective_date, expiry_date, is_active, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                rule.port_code,
                rule.fee_category.as_str(),
                rule.tier.tier_from,
                rule.tier.tier_to,
                rule.tier.unit_rate,
                rule.tier.base_fee,
                rule.effective_date.to_rfc3339(),
                rule.expiry_date.map(|d| d.to_rfc3339()),
                rule.is_active as i32,
                rule.created_at.to_rfc3339(),
                rule.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_rate_rule(
        &self,
        id: i64,
        unit_rate: Option<f64>,
        base_fee: Option<f64>,
        effective_date: Option<DateTime<Utc>>,
    ) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE rate_rules SET
                unit_rate = COALESCE(?2, unit_rate),
                base_fee = COALESCE(?3, base_fee),
                effective_date = COALESCE(?4, effective_date),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            params![
                id,
                unit_rate,
                base_fee,
                effective_date.map(|d| d.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn delete_rate_rule(&self, id: i64) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE rate_rules SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn list_rate_rules(
        &self,
        port_code: Option<&str>,
        category: Option<&str>,
        active_only: bool,
    ) -> Result<Vec<RateRule>, DbError> {
        let mut sql = String::from("SELECT * FROM rate_rules WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(p) = port_code {
            sql.push_str(" AND port_code = ?");
            params_vec.push(Box::new(p.to_string()));
        }
        if let Some(c) = category {
            sql.push_str(" AND fee_category = ?");
            params_vec.push(Box::new(c.to_string()));
        }
        if active_only {
            sql.push_str(" AND is_active = 1");
        }

        sql.push_str(" ORDER BY port_code, fee_category, tier_from");

        let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let rules = stmt
            .query_map(refs.as_slice(), row_to_rate_rule)?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(rules)
    }

    pub fn load_port_rate_configs(&self) -> Result<HashMap<String, PortRateConfig>, DbError> {
        let ports: Vec<Port> = self.list_ports()?;
        let mut configs = HashMap::new();

        for port in &ports {
            configs.insert(port.code.clone(), PortRateConfig::new(port.code.clone()));
        }

        let rules = self.list_rate_rules(None, None, true)?;
        for rule in rules {
            configs
                .entry(rule.port_code.clone())
                .or_insert_with(|| PortRateConfig::new(rule.port_code.clone()))
                .add_rule(rule);
        }

        Ok(configs)
    }

    pub fn list_ports(&self) -> Result<Vec<Port>, DbError> {
        let mut stmt = self.conn.prepare(
            "SELECT code, name, province, created_at FROM ports ORDER BY code",
        )?;
        let ports = stmt
            .query_map([], |row| {
                Ok(Port {
                    code: row.get(0)?,
                    name: row.get(1)?,
                    province: row.get(2)?,
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                        .map(|d| d.with_timezone(&Utc))
                        .unwrap_or(Utc::now()),
                })
            })?
            .collect::<SqlResult<Vec<_>>>()?;
        Ok(ports)
    }

    pub fn insert_fee_result(&self, fee: &FeeResult) -> Result<i64, DbError> {
        let tx = self.conn.unchecked_transaction()?;

        let record_id = {
            tx.execute(
                "INSERT INTO fee_records (
                    ship_id, imo, vessel_name, vessel_type, port_code, arrival_time, departure_time,
                    compute_time, total_amount, tax_amount, grand_total,
                    has_dispute, is_settled, settled_amount
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    fee.ship_id,
                    fee.imo,
                    fee.vessel_name,
                    fee.vessel_type,
                    fee.port_code,
                    fee.arrival_time.to_rfc3339(),
                    fee.departure_time.to_rfc3339(),
                    fee.compute_time.to_rfc3339(),
                    fee.total_amount,
                    fee.tax_amount,
                    fee.grand_total,
                    fee.has_dispute as i32,
                    fee.is_settled as i32,
                    fee.settled_amount,
                ],
            )?;
            tx.last_insert_rowid()
        };

        for detail in &fee.details {
            tx.execute(
                "INSERT INTO fee_details (
                    fee_record_id, category, category_name, rule_id,
                    base_fee, unit_rate, quantity, unit_label, amount, remarks
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    record_id,
                    detail.category.as_str(),
                    detail.category_name,
                    detail.rule_id,
                    detail.base_fee,
                    detail.unit_rate,
                    detail.quantity,
                    detail.unit_label,
                    detail.amount,
                    detail.remarks,
                ],
            )?;
        }

        tx.commit().map_err(|e| DbError::TransactionError(e.to_string()))?;
        Ok(record_id)
    }

    pub fn get_fee_record(&self, id: i64) -> Result<Option<FeeResult>, DbError> {
        let record = self
            .conn
            .query_row(
                "SELECT * FROM fee_records WHERE id = ?1",
                params![id],
                row_to_fee_result,
            )
            .optional()?;

        if let Some(mut fee) = record {
            let mut stmt = self.conn.prepare(
                "SELECT * FROM fee_details WHERE fee_record_id = ?1",
            )?;
            let details = stmt
                .query_map(params![id], row_to_fee_detail)?
                .collect::<SqlResult<Vec<_>>>()?;
            fee.details = details;
            Ok(Some(fee))
        } else {
            Ok(None)
        }
    }

    pub fn find_fee_records(
        &self,
        imo: Option<&str>,
        vessel_name: Option<&str>,
        port_code: Option<&str>,
        date_from: Option<DateTime<Utc>>,
        date_to: Option<DateTime<Utc>>,
        year: Option<i32>,
    ) -> Result<Vec<FeeResult>, DbError> {
        let mut sql = String::from("SELECT * FROM fee_records WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(i) = imo {
            sql.push_str(" AND imo LIKE ?");
            params_vec.push(Box::new(format!("%{}%", i)));
        }
        if let Some(n) = vessel_name {
            sql.push_str(" AND vessel_name LIKE ?");
            params_vec.push(Box::new(format!("%{}%", n)));
        }
        if let Some(p) = port_code {
            sql.push_str(" AND port_code = ?");
            params_vec.push(Box::new(p.to_string()));
        }
        if let Some(d) = date_from {
            sql.push_str(" AND compute_time >= ?");
            params_vec.push(Box::new(d.to_rfc3339()));
        }
        if let Some(d) = date_to {
            sql.push_str(" AND compute_time <= ?");
            params_vec.push(Box::new(d.to_rfc3339()));
        }
        if let Some(y) = year {
            sql.push_str(" AND strftime('%Y', compute_time) = ?");
            params_vec.push(Box::new(y.to_string()));
        }

        sql.push_str(" ORDER BY compute_time DESC");

        let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let records = stmt
            .query_map(refs.as_slice(), row_to_fee_result)?
            .collect::<SqlResult<Vec<_>>>()?;

        let mut results = Vec::with_capacity(records.len());
        for mut fee in records {
            let fee_id = fee.id.unwrap_or(0);
            let details = self.conn.prepare(
                "SELECT * FROM fee_details WHERE fee_record_id = ?1",
            )?
            .query_map(params![fee_id], row_to_fee_detail)?
            .collect::<SqlResult<Vec<_>>>()?;
            fee.details = details;
            results.push(fee);
        }

        Ok(results)
    }

    pub fn insert_dispute(&self, dispute: &DisputeRecord) -> Result<i64, DbError> {
        let tx = self.conn.unchecked_transaction()?;

        let dispute_id = {
            tx.execute(
                "INSERT INTO disputes (
                    fee_record_id, reason, requester, approver,
                    original_total, adjusted_total, delta_total, status,
                    submitted_at, approved_at, applied_at, approval_comments, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    dispute.fee_record_id,
                    dispute.reason,
                    dispute.requester,
                    dispute.approver,
                    dispute.original_total,
                    dispute.adjusted_total,
                    dispute.delta_total,
                    match dispute.status {
                        DisputeStatus::Pending => "pending",
                        DisputeStatus::Submitted => "submitted",
                        DisputeStatus::Approved => "approved",
                        DisputeStatus::Rejected => "rejected",
                        DisputeStatus::Applied => "applied",
                    },
                    dispute.submitted_at.map(|d| d.to_rfc3339()),
                    dispute.approved_at.map(|d| d.to_rfc3339()),
                    dispute.applied_at.map(|d| d.to_rfc3339()),
                    dispute.approval_comments,
                    dispute.created_at.to_rfc3339(),
                ],
            )?;
            tx.last_insert_rowid()
        };

        for adj in &dispute.adjustments {
            tx.execute(
                "INSERT INTO adjustments (
                    dispute_id, category, original_amount, adjust_amount, final_amount
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    dispute_id,
                    adj.category.as_str(),
                    adj.original_amount,
                    adj.adjust_amount,
                    adj.final_amount,
                ],
            )?;
        }

        tx.commit().map_err(|e| DbError::TransactionError(e.to_string()))?;
        Ok(dispute_id)
    }

    pub fn update_dispute_status(&self, dispute: &DisputeRecord) -> Result<(), DbError> {
        self.conn.execute(
            "UPDATE disputes SET
                status = ?2,
                approver = ?3,
                submitted_at = ?4,
                approved_at = ?5,
                applied_at = ?6,
                approval_comments = ?7
             WHERE id = ?1",
            params![
                dispute.id,
                match dispute.status {
                    DisputeStatus::Pending => "pending",
                    DisputeStatus::Submitted => "submitted",
                    DisputeStatus::Approved => "approved",
                    DisputeStatus::Rejected => "rejected",
                    DisputeStatus::Applied => "applied",
                },
                dispute.approver,
                dispute.submitted_at.map(|d| d.to_rfc3339()),
                dispute.approved_at.map(|d| d.to_rfc3339()),
                dispute.applied_at.map(|d| d.to_rfc3339()),
                dispute.approval_comments,
            ],
        )?;
        Ok(())
    }

    pub fn get_dispute(&self, id: i64) -> Result<Option<DisputeRecord>, DbError> {
        let dispute = self
            .conn
            .query_row(
                "SELECT * FROM disputes WHERE id = ?1",
                params![id],
                row_to_dispute,
            )
            .optional()?;

        if let Some(mut d) = dispute {
            let mut stmt = self.conn.prepare(
                "SELECT * FROM adjustments WHERE dispute_id = ?1",
            )?;
            d.adjustments = stmt
                .query_map(params![id], row_to_adjustment)?
                .collect::<SqlResult<Vec<_>>>()?;
            Ok(Some(d))
        } else {
            Ok(None)
        }
    }

    pub fn list_disputes(
        &self,
        status: Option<DisputeStatus>,
        fee_record_id: Option<i64>,
    ) -> Result<Vec<DisputeRecord>, DbError> {
        let mut sql = String::from("SELECT * FROM disputes WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(s) = status {
            sql.push_str(" AND status = ?");
            params_vec.push(Box::new(match s {
                DisputeStatus::Pending => "pending",
                DisputeStatus::Submitted => "submitted",
                DisputeStatus::Approved => "approved",
                DisputeStatus::Rejected => "rejected",
                DisputeStatus::Applied => "applied",
            }));
        }
        if let Some(fid) = fee_record_id {
            sql.push_str(" AND fee_record_id = ?");
            params_vec.push(Box::new(fid));
        }

        sql.push_str(" ORDER BY created_at DESC");

        let refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let mut disputes: Vec<DisputeRecord> = stmt
            .query_map(refs.as_slice(), row_to_dispute)?
            .collect::<SqlResult<Vec<_>>>()?;

        for d in disputes.iter_mut() {
            let did = d.id.unwrap_or(0);
            d.adjustments = self
                .conn
                .prepare("SELECT * FROM adjustments WHERE dispute_id = ?1")?
                .query_map(params![did], row_to_adjustment)?
                .collect::<SqlResult<Vec<_>>>()?;
        }

        Ok(disputes)
    }
}

fn parse_dt(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or(Utc::now())
}

fn row_to_ship(row: &rusqlite::Row) -> SqlResult<Ship> {
    Ok(Ship {
        id: Some(row.get(0)?),
        imo: row.get(1)?,
        vessel_name: row.get(2)?,
        vessel_type: VesselType::from_str(&row.get::<_, String>(3)?).unwrap_or(VesselType::Container),
        net_tonnage: row.get(4)?,
        arrival_time: parse_dt(&row.get::<_, String>(5)?),
        departure_time: parse_dt(&row.get::<_, String>(6)?),
        port_code: row.get(7)?,
        cargo_tonnage: row.get(8)?,
        pilot_hours: row.get(9)?,
        tug_count: row.get::<_, i64>(10)? as u32,
        tug_hours: row.get(11)?,
        created_at: parse_dt(&row.get::<_, String>(12)?),
    })
}

fn row_to_rate_rule(row: &rusqlite::Row) -> SqlResult<RateRule> {
    let fee_cat: String = row.get(2)?;
    Ok(RateRule {
        id: Some(row.get(0)?),
        port_code: row.get(1)?,
        fee_category: std::str::FromStr::from_str(&fee_cat).unwrap_or(FeeCategory::Other),
        tier: TierRate::new(
            row.get::<_, f64>(3)?,
            row.get::<_, f64>(4)?,
            row.get::<_, f64>(5)?,
            row.get::<_, f64>(6)?,
        )
        .unwrap(),
        effective_date: parse_dt(&row.get::<_, String>(7)?),
        expiry_date: row
            .get::<_, Option<String>>(8)?
            .map(|s| parse_dt(&s)),
        created_at: parse_dt(&row.get::<_, String>(10)?),
        updated_at: parse_dt(&row.get::<_, String>(11)?),
        is_active: row.get::<_, i32>(9)? == 1,
    })
}

fn row_to_fee_result(row: &rusqlite::Row) -> SqlResult<FeeResult> {
    Ok(FeeResult {
        id: Some(row.get(0)?),
        ship_id: row.get(1)?,
        imo: row.get(2)?,
        vessel_name: row.get(3)?,
        vessel_type: row.get(4)?,
        port_code: row.get(5)?,
        arrival_time: parse_dt(&row.get::<_, String>(6)?),
        departure_time: parse_dt(&row.get::<_, String>(7)?),
        compute_time: parse_dt(&row.get::<_, String>(8)?),
        details: Vec::new(),
        total_amount: row.get(9)?,
        tax_amount: row.get(10)?,
        grand_total: row.get(11)?,
        has_dispute: row.get::<_, i32>(12)? == 1,
        is_settled: row.get::<_, i32>(13)? == 1,
        settled_amount: row.get(14)?,
    })
}

fn row_to_fee_detail(row: &rusqlite::Row) -> SqlResult<FeeDetail> {
    let cat: String = row.get(2)?;
    Ok(FeeDetail {
        category: std::str::FromStr::from_str(&cat).unwrap_or(FeeCategory::Other),
        category_name: row.get(3)?,
        rule_id: row.get(4)?,
        base_fee: row.get(5)?,
        unit_rate: row.get(6)?,
        quantity: row.get(7)?,
        unit_label: row.get(8)?,
        amount: row.get(9)?,
        remarks: row.get(10)?,
    })
}

fn row_to_dispute(row: &rusqlite::Row) -> SqlResult<DisputeRecord> {
    let status_str: String = row.get(8)?;
    let status = match status_str.as_str() {
        "submitted" => DisputeStatus::Submitted,
        "approved" => DisputeStatus::Approved,
        "rejected" => DisputeStatus::Rejected,
        "applied" => DisputeStatus::Applied,
        _ => DisputeStatus::Pending,
    };

    Ok(DisputeRecord {
        id: Some(row.get(0)?),
        fee_record_id: row.get(1)?,
        reason: row.get(2)?,
        requester: row.get(3)?,
        approver: row.get(4)?,
        adjustments: Vec::new(),
        original_total: row.get(5)?,
        adjusted_total: row.get(6)?,
        delta_total: row.get(7)?,
        status,
        submitted_at: row.get::<_, Option<String>>(9)?.map(|s| parse_dt(&s)),
        approved_at: row.get::<_, Option<String>>(10)?.map(|s| parse_dt(&s)),
        applied_at: row.get::<_, Option<String>>(11)?.map(|s| parse_dt(&s)),
        approval_comments: row.get(12)?,
        created_at: parse_dt(&row.get::<_, String>(13)?),
    })
}

fn row_to_adjustment(row: &rusqlite::Row) -> SqlResult<AdjustmentItem> {
    let cat: String = row.get(2)?;
    Ok(AdjustmentItem::new(
        std::str::FromStr::from_str(&cat).unwrap_or(FeeCategory::Other),
        row.get(3)?,
        row.get(4)?,
    )
    .unwrap())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlySummary {
    pub port_code: String,
    pub port_name: String,
    pub vessel_count: usize,
    pub total_amount: f64,
    pub tax_amount: f64,
    pub grand_total: f64,
    pub settled_amount: f64,
    pub unsettled_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgingBucket {
    pub range: String,
    pub count: usize,
    pub amount: f64,
}

pub fn compute_monthly_summary(
    db: &Database,
    year: i32,
    month: u32,
    by_port: bool,
    by_vessel_type: bool,
) -> Result<Vec<MonthlySummary>, DbError> {
    let start = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let end = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };

    let start_dt = start.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let end_dt = end.and_hms_opt(0, 0, 0).unwrap().and_utc();

    let records = db.find_fee_records(None, None, None, Some(start_dt), Some(end_dt), None)?;

    let vessel_type_names: HashMap<&str, &str> = [
        ("container", "集装箱船"),
        ("bulk", "散货船"),
        ("oil", "油轮"),
        ("lpg", "液化气船"),
        ("ro-ro", "滚装船"),
    ].iter().cloned().collect();

    let mut map: HashMap<String, MonthlySummary> = HashMap::new();

    for fee in &records {
        let key = if by_port && by_vessel_type {
            format!("{}:{}", fee.port_code, fee.vessel_type)
        } else if by_port {
            fee.port_code.clone()
        } else if by_vessel_type {
            fee.vessel_type.clone()
        } else {
            "ALL".to_string()
        };

        let display_name = if by_port && by_vessel_type {
            let parts: Vec<&str> = key.split(':').collect();
            let vt_name = vessel_type_names.get(parts.get(1).unwrap_or(&"")).copied().unwrap_or(parts.get(1).unwrap_or(&""));
            format!("{} ({})", parts[0], vt_name)
        } else if by_port {
            key.clone()
        } else if by_vessel_type {
            vessel_type_names.get(key.as_str()).copied().unwrap_or(&key).to_string()
        } else {
            "合计".to_string()
        };

        let code = if by_vessel_type && !by_port {
            fee.vessel_type.clone()
        } else if by_port && by_vessel_type {
            key.clone()
        } else {
            key.clone()
        };

        let entry = map.entry(key.clone()).or_insert(MonthlySummary {
            port_code: code,
            port_name: display_name,
            vessel_count: 0,
            total_amount: 0.0,
            tax_amount: 0.0,
            grand_total: 0.0,
            settled_amount: 0.0,
            unsettled_amount: 0.0,
        });

        entry.vessel_count += 1;
        entry.total_amount += fee.total_amount;
        entry.tax_amount += fee.tax_amount;
        entry.grand_total += fee.grand_total;
        entry.settled_amount += fee.settled_amount;
        entry.unsettled_amount += fee.grand_total - fee.settled_amount;
    }

    let mut result: Vec<MonthlySummary> = map.into_values().collect();
    result.sort_by(|a, b| b.grand_total.partial_cmp(&a.grand_total).unwrap_or(std::cmp::Ordering::Equal));
    Ok(result)
}

pub fn compute_aging_analysis(db: &Database) -> Result<Vec<AgingBucket>, DbError> {
    let records = db.find_fee_records(None, None, None, None, None, None)?;
    let now = Utc::now();

    let buckets = vec![
        ("0-30天", 0, 30),
        ("31-60天", 31, 60),
        ("61-90天", 61, 90),
        ("90天以上", 91, 99999),
    ];

    let mut result = Vec::new();

    for (range, min_days, max_days) in buckets {
        let mut count = 0;
        let mut amount = 0.0;

        for fee in &records {
            if fee.is_settled {
                continue;
            }
            let days = (now - fee.compute_time).num_days();
            if days >= min_days && days <= max_days {
                count += 1;
                amount += fee.grand_total - fee.settled_amount;
            }
        }

        result.push(AgingBucket {
            range: range.to_string(),
            count,
            amount,
        });
    }

    Ok(result)
}
