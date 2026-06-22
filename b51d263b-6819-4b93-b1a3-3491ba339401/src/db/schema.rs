use rusqlite::{Connection, Result};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SchemaError {
    #[error("数据库操作失败: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    #[error("迁移失败: {0}")]
    MigrationError(String),
}

pub const SCHEMA_VERSION: i32 = 1;

pub fn init_schema(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")?;

    create_ships_table(conn)?;
    create_rate_rules_table(conn)?;
    create_fee_records_table(conn)?;
    create_fee_details_table(conn)?;
    create_disputes_table(conn)?;
    create_adjustments_table(conn)?;
    create_config_table(conn)?;
    create_ports_table(conn)?;
    create_indexes(conn)?;
    insert_initial_ports(conn)?;
    set_schema_version(conn, SCHEMA_VERSION)?;

    Ok(())
}

fn create_ships_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imo TEXT NOT NULL,
            vessel_name TEXT NOT NULL,
            vessel_type TEXT NOT NULL,
            net_tonnage REAL NOT NULL,
            arrival_time TEXT NOT NULL,
            departure_time TEXT NOT NULL,
            port_code TEXT NOT NULL,
            cargo_tonnage REAL NOT NULL DEFAULT 0,
            pilot_hours REAL NOT NULL DEFAULT 4,
            tug_count INTEGER NOT NULL DEFAULT 2,
            tug_hours REAL NOT NULL DEFAULT 3,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(imo, arrival_time)
        )",
        [],
    )?;
    Ok(())
}

fn create_rate_rules_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rate_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            port_code TEXT NOT NULL,
            fee_category TEXT NOT NULL,
            tier_from REAL NOT NULL DEFAULT 0,
            tier_to REAL NOT NULL DEFAULT 0,
            unit_rate REAL NOT NULL,
            base_fee REAL NOT NULL DEFAULT 0,
            effective_date TEXT NOT NULL,
            expiry_date TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

fn create_fee_records_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS fee_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ship_id INTEGER,
            imo TEXT NOT NULL,
            vessel_name TEXT NOT NULL,
            vessel_type TEXT NOT NULL DEFAULT 'container',
            port_code TEXT NOT NULL,
            arrival_time TEXT NOT NULL,
            departure_time TEXT NOT NULL,
            compute_time TEXT NOT NULL,
            total_amount REAL NOT NULL,
            tax_amount REAL NOT NULL,
            grand_total REAL NOT NULL,
            has_dispute INTEGER NOT NULL DEFAULT 0,
            is_settled INTEGER NOT NULL DEFAULT 0,
            settled_amount REAL NOT NULL DEFAULT 0,
            settled_at TEXT,
            settlement_reference TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ship_id) REFERENCES ships(id) ON DELETE SET NULL
        )",
        [],
    )?;
    Ok(())
}

fn create_fee_details_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS fee_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fee_record_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            category_name TEXT NOT NULL,
            rule_id INTEGER,
            base_fee REAL NOT NULL DEFAULT 0,
            unit_rate REAL NOT NULL DEFAULT 0,
            quantity REAL NOT NULL DEFAULT 0,
            unit_label TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL,
            remarks TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (fee_record_id) REFERENCES fee_records(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

fn create_disputes_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS disputes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fee_record_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            requester TEXT NOT NULL,
            approver TEXT,
            original_total REAL NOT NULL,
            adjusted_total REAL NOT NULL,
            delta_total REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            submitted_at TEXT,
            approved_at TEXT,
            applied_at TEXT,
            approval_comments TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (fee_record_id) REFERENCES fee_records(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

fn create_adjustments_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dispute_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            original_amount REAL NOT NULL,
            adjust_amount REAL NOT NULL,
            final_amount REAL NOT NULL,
            FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

fn create_config_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

fn create_ports_table(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ports (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            province TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

fn create_indexes(conn: &Connection) -> Result<(), SchemaError> {
    let indexes = vec![
        "CREATE INDEX IF NOT EXISTS idx_ships_imo ON ships(imo)",
        "CREATE INDEX IF NOT EXISTS idx_ships_port ON ships(port_code)",
        "CREATE INDEX IF NOT EXISTS idx_ships_arrival ON ships(arrival_time)",
        "CREATE INDEX IF NOT EXISTS idx_ships_vessel_type ON ships(vessel_type)",
        "CREATE INDEX IF NOT EXISTS idx_rate_rules_port ON rate_rules(port_code)",
        "CREATE INDEX IF NOT EXISTS idx_rate_rules_category ON rate_rules(fee_category)",
        "CREATE INDEX IF NOT EXISTS idx_rate_rules_effective ON rate_rules(port_code, fee_category, effective_date)",
        "CREATE INDEX IF NOT EXISTS idx_fee_records_imo ON fee_records(imo)",
        "CREATE INDEX IF NOT EXISTS idx_fee_records_port ON fee_records(port_code)",
        "CREATE INDEX IF NOT EXISTS idx_fee_records_compute ON fee_records(compute_time)",
        "CREATE INDEX IF NOT EXISTS idx_fee_records_port_date ON fee_records(port_code, compute_time)",
        "CREATE INDEX IF NOT EXISTS idx_fee_records_settled ON fee_records(is_settled, grand_total)",
        "CREATE INDEX IF NOT EXISTS idx_fee_details_record ON fee_details(fee_record_id)",
        "CREATE INDEX IF NOT EXISTS idx_disputes_fee ON disputes(fee_record_id)",
        "CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)",
        "CREATE INDEX IF NOT EXISTS idx_adjustments_dispute ON adjustments(dispute_id)",
    ];

    for sql in indexes {
        conn.execute(sql, [])?;
    }

    Ok(())
}

fn insert_initial_ports(conn: &Connection) -> Result<(), SchemaError> {
    let ports = vec![
        ("SHA", "上海港", "上海"),
        ("NGB", "宁波舟山港", "浙江"),
        ("SZX", "深圳港", "广东"),
        ("GZH", "广州港", "广东"),
        ("QDO", "青岛港", "山东"),
        ("TJJ", "天津港", "天津"),
        ("XMN", "厦门港", "福建"),
        ("DAL", "大连港", "辽宁"),
        ("LYG", "连云港港", "江苏"),
        ("YTI", "烟台港", "山东"),
        ("FZH", "福州港", "福建"),
        ("ZHA", "湛江港", "广东"),
        ("HKG", "香港港", "香港"),
        ("KHH", "高雄港", "台湾"),
        ("KEE", "基隆港", "台湾"),
        ("TPE", "台北港", "台湾"),
        ("MTW", "湄洲湾港", "福建"),
        ("WZO", "温州港", "浙江"),
        ("SZH", "苏州港", "江苏"),
        ("NJG", "南京港", "江苏"),
        ("NTG", "南通港", "江苏"),
        ("ZJG", "镇江港", "江苏"),
        ("JAX", "嘉兴港", "浙江"),
        ("TZG", "台州港", "浙江"),
        ("TZJ", "泰州港", "江苏"),
        ("YZC", "盐城港", "江苏"),
        ("BHI", "北海港", "广西"),
        ("QZH", "钦州港", "广西"),
        ("FCG", "防城港", "广西"),
        ("HKT", "海口港", "海南"),
        ("SYA", "三亚港", "海南"),
        ("YKH", "营口港", "辽宁"),
        ("JNZ", "锦州港", "辽宁"),
        ("QHD", "秦皇岛港", "河北"),
        ("CFN", "曹妃甸港", "河北"),
        ("HSH", "黄骅港", "河北"),
    ];

    for (code, name, province) in ports {
        conn.execute(
            "INSERT OR IGNORE INTO ports (code, name, province) VALUES (?1, ?2, ?3)",
            rusqlite::params![code, name, province],
        )?;
    }

    Ok(())
}

fn set_schema_version(conn: &Connection, version: i32) -> Result<(), SchemaError> {
    conn.execute(
        "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('schema_version', ?1, CURRENT_TIMESTAMP)",
        rusqlite::params![version.to_string()],
    )?;
    Ok(())
}

pub fn get_schema_version(conn: &Connection) -> Result<i32, SchemaError> {
    let result: Option<String> = conn.query_row(
        "SELECT value FROM app_config WHERE key = 'schema_version'",
        [],
        |row| row.get(0),
    ).ok();

    Ok(result
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0))
}

pub fn vacuum(conn: &Connection) -> Result<(), SchemaError> {
    conn.execute_batch("VACUUM;")?;
    Ok(())
}
