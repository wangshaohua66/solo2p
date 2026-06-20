use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationConfig {
    pub id: String,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub elevation: Option<f64>,
    pub instrument_model: Option<String>,
    pub timezone: String,
    #[serde(default)]
    pub csv_column_mapping: HashMap<String, String>,
    #[serde(default)]
    pub unit_mapping: HashMap<String, String>,
    #[serde(default)]
    pub neighbors: Vec<String>,
    #[serde(default)]
    pub qc_thresholds: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QcRuleConfig {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub element: Option<String>,
    pub threshold: f64,
    #[serde(default = "default_weight")]
    pub weight: f64,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_weight() -> f64 {
    1.0
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClimateLimits {
    pub temperature_min: f64,
    pub temperature_max: f64,
    pub pressure_min: f64,
    pub pressure_max: f64,
    pub humidity_min: f64,
    pub humidity_max: f64,
    pub wind_speed_max: f64,
    pub precipitation_max: f64,
    pub visibility_min: f64,
    pub visibility_max: f64,
}

impl Default for ClimateLimits {
    fn default() -> Self {
        ClimateLimits {
            temperature_min: -50.0,
            temperature_max: 50.0,
            pressure_min: 800.0,
            pressure_max: 1100.0,
            humidity_min: 0.0,
            humidity_max: 100.0,
            wind_speed_max: 100.0,
            precipitation_max: 500.0,
            visibility_min: 0.0,
            visibility_max: 50000.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub stations: Vec<StationConfig>,
    #[serde(default)]
    pub qc_rules: Vec<QcRuleConfig>,
    #[serde(default)]
    pub climate_limits: ClimateLimits,
    #[serde(default)]
    pub database_path: String,
    #[serde(default)]
    pub archive_output_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            stations: Vec::new(),
            qc_rules: default_qc_rules(),
            climate_limits: ClimateLimits::default(),
            database_path: "meteoc.db".to_string(),
            archive_output_dir: "./archive".to_string(),
        }
    }
}

fn default_qc_rules() -> Vec<QcRuleConfig> {
    vec![
        QcRuleConfig {
            id: "missing_check".to_string(),
            name: "缺测值检测".to_string(),
            description: Some("检测各要素是否存在缺测值".to_string()),
            element: None,
            threshold: 0.0,
            weight: 1.0,
            enabled: true,
        },
        QcRuleConfig {
            id: "climatological_limit".to_string(),
            name: "气候极值界限检查".to_string(),
            description: Some("检查要素值是否在历史气候极值范围内".to_string()),
            element: None,
            threshold: 0.0,
            weight: 1.0,
            enabled: true,
        },
        QcRuleConfig {
            id: "temporal_consistency".to_string(),
            name: "时间一致性检查".to_string(),
            description: Some("检查相邻时次要素跳变是否超过阈值".to_string()),
            element: None,
            threshold: 5.0,
            weight: 1.0,
            enabled: true,
        },
        QcRuleConfig {
            id: "spatial_consistency".to_string(),
            name: "空间一致性检查".to_string(),
            description: Some("对比邻近站点同要素偏差".to_string()),
            element: None,
            threshold: 3.0,
            weight: 1.0,
            enabled: true,
        },
        QcRuleConfig {
            id: "internal_consistency".to_string(),
            name: "内部一致性检查".to_string(),
            description: Some("校验要素间物理关系".to_string()),
            element: None,
            threshold: 0.0,
            weight: 1.0,
            enabled: true,
        },
        QcRuleConfig {
            id: "persistence_check".to_string(),
            name: "持续性检查".to_string(),
            description: Some("识别连续N个时次值不变".to_string()),
            element: None,
            threshold: 6.0,
            weight: 1.0,
            enabled: true,
        },
    ]
}

impl AppConfig {
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        if path.exists() {
            let content = std::fs::read_to_string(path)
                .with_context(|| format!("Failed to read config file: {}", path.display()))?;
            let config: AppConfig = serde_json::from_str(&content)
                .with_context(|| format!("Failed to parse config file: {}", path.display()))?;
            Ok(config)
        } else {
            Ok(AppConfig::default())
        }
    }

    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    pub fn get_station(&self, station_id: &str) -> Option<&StationConfig> {
        self.stations.iter().find(|s| s.id == station_id)
    }

    pub fn add_station(&mut self, station: StationConfig) {
        if let Some(idx) = self.stations.iter().position(|s| s.id == station.id) {
            self.stations[idx] = station;
        } else {
            self.stations.push(station);
        }
    }

    pub fn remove_station(&mut self, station_id: &str) -> bool {
        if let Some(idx) = self.stations.iter().position(|s| s.id == station_id) {
            self.stations.remove(idx);
            true
        } else {
            false
        }
    }

    pub fn get_neighbors(&self, station_id: &str) -> Vec<&StationConfig> {
        self.get_station(station_id)
            .map(|s| {
                s.neighbors
                    .iter()
                    .filter_map(|nid| self.get_station(nid))
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl StationConfig {
    pub fn get_element_unit(&self, element: &str) -> String {
        self.unit_mapping
            .get(element)
            .cloned()
            .unwrap_or_else(|| default_unit(element).to_string())
    }

    pub fn get_csv_column(&self, element: &str) -> Option<&String> {
        self.csv_column_mapping.get(element)
    }
}

fn default_unit(element: &str) -> &'static str {
    match element {
        "temperature" => "C",
        "pressure" => "hPa",
        "relative_humidity" => "%",
        "wind_speed" => "m/s",
        "wind_direction" => "deg",
        "precipitation" => "mm",
        "visibility" => "m",
        _ => "",
    }
}

pub fn convert_unit(value: f64, from_unit: &str, to_unit: &str) -> Option<f64> {
    match (from_unit, to_unit) {
        (a, b) if a == b => Some(value),
        ("C", "K") => Some(value + 273.15),
        ("K", "C") => Some(value - 273.15),
        ("F", "C") => Some((value - 32.0) * 5.0 / 9.0),
        ("C", "F") => Some(value * 9.0 / 5.0 + 32.0),
        ("hPa", "Pa") => Some(value * 100.0),
        ("Pa", "hPa") => Some(value / 100.0),
        ("hPa", "kPa") => Some(value / 10.0),
        ("kPa", "hPa") => Some(value * 10.0),
        ("m/s", "km/h") => Some(value * 3.6),
        ("km/h", "m/s") => Some(value / 3.6),
        ("m/s", "knot") => Some(value * 1.94384),
        ("knot", "m/s") => Some(value / 1.94384),
        ("mm", "cm") => Some(value / 10.0),
        ("cm", "mm") => Some(value * 10.0),
        ("m", "km") => Some(value / 1000.0),
        ("km", "m") => Some(value * 1000.0),
        _ => None,
    }
}

pub fn get_default_config_path() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".meteoc").join("config.json")
    } else {
        PathBuf::from("config.json")
    }
}
