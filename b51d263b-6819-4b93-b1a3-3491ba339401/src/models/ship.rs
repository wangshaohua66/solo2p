use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ShipError {
    #[error("无效的IMO号: 必须是7位数字")]
    InvalidImoFormat,
    #[error("IMO号校验位不匹配")]
    InvalidImoChecksum,
    #[error("无效的船舶类型: {0}, 应为 container/bulk/oil/lpg/ro-ro")]
    InvalidVesselType(String),
    #[error("净吨位必须为正数")]
    InvalidNetTonnage,
    #[error("时间格式错误，应为 YYYY-MM-DD HH:MM")]
    InvalidTimeFormat,
    #[error("抵港时间必须早于离港时间")]
    InvalidTimeRange,
    #[error("货物吨数不能为负数")]
    InvalidCargoTonnage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VesselType {
    Container,
    Bulk,
    Oil,
    Lpg,
    RoRo,
}

impl VesselType {
    pub fn as_str(&self) -> &'static str {
        match self {
            VesselType::Container => "container",
            VesselType::Bulk => "bulk",
            VesselType::Oil => "oil",
            VesselType::Lpg => "lpg",
            VesselType::RoRo => "ro-ro",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            VesselType::Container => "集装箱船",
            VesselType::Bulk => "散货船",
            VesselType::Oil => "油轮",
            VesselType::Lpg => "液化气船",
            VesselType::RoRo => "滚装船",
        }
    }

    pub fn all() -> Vec<VesselType> {
        vec![
            VesselType::Container,
            VesselType::Bulk,
            VesselType::Oil,
            VesselType::Lpg,
            VesselType::RoRo,
        ]
    }
}

impl FromStr for VesselType {
    type Err = ShipError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "container" | "集装箱" => Ok(VesselType::Container),
            "bulk" | "散货" => Ok(VesselType::Bulk),
            "oil" | "油轮" | "tanker" => Ok(VesselType::Oil),
            "lpg" | "液化气" | "gas" => Ok(VesselType::Lpg),
            "ro-ro" | "ro_ro" | "roro" | "滚装" => Ok(VesselType::RoRo),
            other => Err(ShipError::InvalidVesselType(other.to_string())),
        }
    }
}

pub fn validate_imo(imo: &str) -> Result<(), ShipError> {
    if imo.len() != 7 || !imo.chars().all(|c| c.is_ascii_digit()) {
        return Err(ShipError::InvalidImoFormat);
    }

    let digits: Vec<u32> = imo.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() != 7 {
        return Err(ShipError::InvalidImoFormat);
    }

    let mut sum = 0;
    for i in 0..6 {
        sum += digits[i] * (7 - i as u32);
    }

    let checksum = sum % 10;
    if checksum != digits[6] {
        return Err(ShipError::InvalidImoChecksum);
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ship {
    pub id: Option<i64>,
    pub imo: String,
    pub vessel_name: String,
    pub vessel_type: VesselType,
    pub net_tonnage: f64,
    pub arrival_time: DateTime<Utc>,
    pub departure_time: DateTime<Utc>,
    pub port_code: String,
    pub cargo_tonnage: f64,
    pub pilot_hours: f64,
    pub tug_count: u32,
    pub tug_hours: f64,
    pub created_at: DateTime<Utc>,
}

impl Ship {
    pub fn new(
        imo: String,
        vessel_name: String,
        vessel_type: VesselType,
        net_tonnage: f64,
        arrival_time: DateTime<Utc>,
        departure_time: DateTime<Utc>,
        port_code: String,
        cargo_tonnage: f64,
        pilot_hours: f64,
        tug_count: u32,
        tug_hours: f64,
    ) -> Result<Self, ShipError> {
        if net_tonnage <= 0.0 {
            return Err(ShipError::InvalidNetTonnage);
        }
        if arrival_time >= departure_time {
            return Err(ShipError::InvalidTimeRange);
        }
        if cargo_tonnage < 0.0 {
            return Err(ShipError::InvalidCargoTonnage);
        }

        Ok(Ship {
            id: None,
            imo,
            vessel_name,
            vessel_type,
            net_tonnage,
            arrival_time,
            departure_time,
            port_code,
            cargo_tonnage,
            pilot_hours,
            tug_count,
            tug_hours,
            created_at: Utc::now(),
        })
    }

    pub fn berthing_hours(&self) -> f64 {
        let duration = self.departure_time - self.arrival_time;
        duration.num_minutes() as f64 / 60.0
    }

    pub fn berthing_days(&self) -> f64 {
        (self.berthing_hours() / 24.0).ceil()
    }

    pub fn parse_datetime(s: &str) -> Result<DateTime<Utc>, ShipError> {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M")
            .map(|nd| nd.and_utc())
            .map_err(|_| ShipError::InvalidTimeFormat)
    }

    pub fn tonnage_category(&self) -> &'static str {
        match self.net_tonnage as u64 {
            0..=5000 => "5000以下",
            5001..=10000 => "5001-10000",
            10001..=30000 => "10001-30000",
            30001..=50000 => "30001-50000",
            _ => "50001以上",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShipCsvRow {
    pub imo: String,
    pub vessel_name: String,
    pub vessel_type: String,
    pub net_tonnage: f64,
    pub arrival_time: String,
    pub departure_time: String,
    pub port_code: String,
    pub cargo_tonnage: Option<f64>,
    pub pilot_hours: Option<f64>,
    pub tug_count: Option<u32>,
    pub tug_hours: Option<f64>,
}

impl TryFrom<ShipCsvRow> for Ship {
    type Error = ShipError;

    fn try_from(row: ShipCsvRow) -> Result<Self, Self::Error> {
        let vessel_type = VesselType::from_str(&row.vessel_type)?;
        let arrival = Ship::parse_datetime(&row.arrival_time)?;
        let departure = Ship::parse_datetime(&row.departure_time)?;

        Ship::new(
            row.imo,
            row.vessel_name,
            vessel_type,
            row.net_tonnage,
            arrival,
            departure,
            row.port_code,
            row.cargo_tonnage.unwrap_or(0.0),
            row.pilot_hours.unwrap_or(4.0),
            row.tug_count.unwrap_or(2),
            row.tug_hours.unwrap_or(3.0),
        )
    }
}
