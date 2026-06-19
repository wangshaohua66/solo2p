use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IcaoAddress(pub [u8; 3]);

impl IcaoAddress {
    pub fn new(bytes: [u8; 3]) -> Self {
        Self(bytes)
    }

    pub fn to_hex_string(&self) -> String {
        hex::encode(self.0)
    }

    pub fn from_hex(hex_str: &str) -> Result<Self, hex::FromHexError> {
        let bytes = hex::decode(hex_str)?;
        if bytes.len() != 3 {
            return Err(hex::FromHexError::InvalidStringLength);
        }
        let mut arr = [0u8; 3];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }
}

impl fmt::Display for IcaoAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex_string().to_uppercase())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Position3D {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
}

impl Position3D {
    pub fn new(lat: f64, lon: f64, alt: f64) -> Self {
        Self {
            latitude: lat,
            longitude: lon,
            altitude: alt,
        }
    }

    pub fn distance_horizontal(&self, other: &Self) -> f64 {
        let r = 6371000.0;
        let lat1 = self.latitude.to_radians();
        let lat2 = other.latitude.to_radians();
        let dlat = (other.latitude - self.latitude).to_radians();
        let dlon = (other.longitude - self.longitude).to_radians();

        let a = (dlat / 2.0).sin().powi(2)
            + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().asin();
        r * c
    }

    pub fn distance_vertical(&self, other: &Self) -> f64 {
        (self.altitude - other.altitude).abs()
    }

    pub fn distance_3d(&self, other: &Self) -> f64 {
        let h = self.distance_horizontal(other);
        let v = self.distance_vertical(other);
        (h * h + v * v).sqrt()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Velocity3D {
    pub ground_speed: f64,
    pub vertical_speed: f64,
    pub heading: f64,
}

impl Velocity3D {
    pub fn new(gs: f64, vs: f64, hdg: f64) -> Self {
        Self {
            ground_speed: gs,
            vertical_speed: vs,
            heading: hdg,
        }
    }
}

impl fmt::Display for Position3D {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "纬度: {:.6}°, 经度: {:.6}°, 高度: {:.0}米",
            self.latitude, self.longitude, self.altitude
        )
    }
}

impl fmt::Display for Velocity3D {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "地速: {:.1}km/h, 升降: {:.1}m/s, 航向: {:.1}°",
            self.ground_speed, self.vertical_speed, self.heading
        )
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrackPoint {
    pub timestamp: DateTime<Utc>,
    pub position: Position3D,
    pub velocity: Velocity3D,
    pub icao_address: IcaoAddress,
    pub callsign: Option<String>,
    pub radar_id: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FusedTrack {
    pub icao_address: IcaoAddress,
    pub callsign: Option<String>,
    pub points: Vec<TrackPoint>,
    pub last_update: DateTime<Utc>,
    pub contributing_radars: Vec<String>,
}

impl fmt::Display for TrackPoint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let callsign = self.callsign.as_deref().unwrap_or("N/A");
        write!(
            f,
            "[{}] ICAO: {}, 呼号: {}, 雷达: {}, 置信度: {:.2}, {}, {}",
            self.timestamp.format("%Y-%m-%d %H:%M:%S%.3f"),
            self.icao_address,
            callsign,
            self.radar_id,
            self.confidence,
            self.position,
            self.velocity
        )
    }
}

impl FusedTrack {
    pub fn latest_point(&self) -> Option<&TrackPoint> {
        self.points.last()
    }
}

impl fmt::Display for FusedTrack {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let callsign = self.callsign.as_deref().unwrap_or("N/A");
        let radars = self.contributing_radars.join(", ");
        writeln!(
            f,
            "=== 融合轨迹 ICAO: {}, 呼号: {} ===",
            self.icao_address, callsign
        )?;
        writeln!(f, "  贡献雷达: [{}]", radars)?;
        writeln!(f, "  最后更新: {}", self.last_update.format("%Y-%m-%d %H:%M:%S"))?;
        writeln!(f, "  轨迹点数: {}", self.points.len())?;
        if let Some(p) = self.latest_point() {
            writeln!(f, "  最新位置: {}", p.position)?;
        }
        Ok(())
    }
}

impl fmt::Display for ConflictAlert {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{}] [{}] {}: 飞机 {} <-> {}, 预测时间 {}, 距离 {:.0}米 (水平: {:.0}米, 垂直: {:.0}米)",
            self.timestamp.format("%Y-%m-%d %H:%M:%S"),
            self.severity,
            self.conflict_type,
            self.aircraft1,
            self.aircraft2,
            self.predicted_time.format("%H:%M:%S"),
            self.predicted_distance,
            self.horizontal_distance,
            self.vertical_distance
        )
    }
}

impl fmt::Display for TrafficStats {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(
            f,
            "=== 流量统计: {} 至 {} ===",
            self.time_range.0.format("%Y-%m-%d %H:%M"),
            self.time_range.1.format("%Y-%m-%d %H:%M")
        )?;
        writeln!(f, "  总架次: {}", self.total_flights)?;
        writeln!(
            f,
            "  峰值架次: {} ({})",
            self.peak_flights,
            self.peak_time.format("%Y-%m-%d %H:%M")
        )?;
        writeln!(f, "  平均速度: {:.1} km/h", self.average_speed)?;
        write!(f, "  高度分布: ")?;
        for (i, (alt, count)) in self.altitude_distribution.iter().enumerate() {
            if i > 0 {
                write!(f, ", ")?;
            }
            write!(f, "{:.0}m: {}", alt, count)?;
        }
        writeln!(f)?;
        write!(f, "  扇区热力: ")?;
        for (i, (sector, count)) in self.sector_heatmap.iter().enumerate() {
            if i > 0 {
                write!(f, ", ")?;
            }
            write!(f, "{}: {}", sector, count)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictType {
    Horizontal,
    Vertical,
    ThreeDimensional,
}

impl fmt::Display for ConflictType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConflictType::Horizontal => write!(f, "水平冲突"),
            ConflictType::Vertical => write!(f, "垂直冲突"),
            ConflictType::ThreeDimensional => write!(f, "三维冲突"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConflictAlert {
    pub timestamp: DateTime<Utc>,
    pub conflict_type: ConflictType,
    pub aircraft1: IcaoAddress,
    pub aircraft2: IcaoAddress,
    pub predicted_time: DateTime<Utc>,
    pub predicted_distance: f64,
    pub horizontal_distance: f64,
    pub vertical_distance: f64,
    pub severity: AlertSeverity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

impl fmt::Display for AlertSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AlertSeverity::Info => write!(f, "INFO"),
            AlertSeverity::Warning => write!(f, "WARN"),
            AlertSeverity::Critical => write!(f, "ERROR"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficStats {
    pub time_range: (DateTime<Utc>, DateTime<Utc>),
    pub total_flights: usize,
    pub peak_flights: usize,
    pub peak_time: DateTime<Utc>,
    pub altitude_distribution: Vec<(f64, usize)>,
    pub sector_heatmap: Vec<(String, usize)>,
    pub average_speed: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OutputFormat {
    Json,
    Csv,
    Text,
}

impl Default for OutputFormat {
    fn default() -> Self {
        OutputFormat::Text
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StatsMode {
    SlidingWindow,
    Cumulative,
}

impl Default for StatsMode {
    fn default() -> Self {
        StatsMode::Cumulative
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadarStation {
    pub id: String,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    pub weight: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SafetyThresholds {
    pub horizontal_separation: f64,
    pub vertical_separation: f64,
    pub lookahead_seconds: i64,
    pub warning_factor: f64,
}

impl Default for SafetyThresholds {
    fn default() -> Self {
        Self {
            horizontal_separation: 5000.0,
            vertical_separation: 300.0,
            lookahead_seconds: 120,
            warning_factor: 1.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackQuery {
    pub time_start: Option<DateTime<Utc>>,
    pub time_end: Option<DateTime<Utc>>,
    pub callsign_pattern: Option<String>,
    pub icao_pattern: Option<String>,
    pub sector_id: Option<String>,
}
