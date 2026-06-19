use crate::error::{AtcError, AtcResult};
use crate::types::{OutputFormat, RadarStation, SafetyThresholds};
use chrono::{DateTime, Duration, Utc};
use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub radar_stations: Vec<RadarStation>,
    pub safety_thresholds: SafetyThresholds,
    pub output: OutputConfig,
    pub processing: ProcessingConfig,
    pub logging: LoggingConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            radar_stations: vec![
                RadarStation {
                    id: "RADAR01".to_string(),
                    name: "北京首都雷达站".to_string(),
                    latitude: 40.0801,
                    longitude: 116.5846,
                    altitude: 35.0,
                    weight: 1.0,
                },
                RadarStation {
                    id: "RADAR02".to_string(),
                    name: "上海浦东雷达站".to_string(),
                    latitude: 31.1433,
                    longitude: 121.8058,
                    altitude: 25.0,
                    weight: 1.0,
                },
                RadarStation {
                    id: "RADAR03".to_string(),
                    name: "广州白云雷达站".to_string(),
                    latitude: 23.3924,
                    longitude: 113.2988,
                    altitude: 30.0,
                    weight: 1.0,
                },
            ],
            safety_thresholds: SafetyThresholds::default(),
            output: OutputConfig::default(),
            processing: ProcessingConfig::default(),
            logging: LoggingConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    pub format: OutputFormat,
    pub path: Option<PathBuf>,
    pub pretty_print: bool,
    pub include_timestamp: bool,
}

impl Default for OutputConfig {
    fn default() -> Self {
        Self {
            format: OutputFormat::Text,
            path: None,
            pretty_print: true,
            include_timestamp: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingConfig {
    pub parallelism: usize,
    pub batch_size: usize,
    pub time_alignment_window_ms: i64,
    pub track_history_size: usize,
    pub fusion_timeout_ms: i64,
}

impl Default for ProcessingConfig {
    fn default() -> Self {
        Self {
            parallelism: 0,
            batch_size: 1000,
            time_alignment_window_ms: 100,
            track_history_size: 1000,
            fusion_timeout_ms: 5000,
        }
    }
}

impl ProcessingConfig {
    pub fn effective_parallelism(&self) -> usize {
        if self.parallelism == 0 {
            num_cpus::get()
        } else {
            self.parallelism
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file: Option<PathBuf>,
    pub json_format: bool,
    pub show_target: bool,
    pub show_module_path: bool,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file: None,
            json_format: false,
            show_target: false,
            show_module_path: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum, Serialize, Deserialize)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Trace => "trace",
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

impl AppConfig {
    pub fn load(path: &Path) -> AtcResult<Self> {
        if !path.exists() {
            return Err(AtcError::FileNotFound(path.display().to_string()));
        }

        let content = std::fs::read_to_string(path)
            .map_err(|e| AtcError::ConfigError(format!("读取配置文件失败: {}", e)))?;

        let user_config: AppConfig = toml::from_str(&content)?;
        let mut default_config = AppConfig::default();

        default_config.merge(user_config);
        default_config.validate()?;

        Ok(default_config)
    }

    pub fn load_or_default(path: Option<&Path>) -> AtcResult<Self> {
        match path {
            Some(p) if p.exists() => Self::load(p),
            _ => {
                let config = AppConfig::default();
                config.validate()?;
                Ok(config)
            }
        }
    }

    pub fn merge(&mut self, other: AppConfig) {
        if !other.radar_stations.is_empty() {
            self.radar_stations = other.radar_stations;
        }
        self.safety_thresholds = other.safety_thresholds;
        self.output = other.output;
        self.processing = other.processing;
        self.logging = other.logging;
    }

    pub fn validate(&self) -> AtcResult<()> {
        if self.radar_stations.is_empty() {
            return Err(AtcError::ValidationError(
                "至少需要配置一个雷达站".to_string(),
            ));
        }

        let mut radar_ids = std::collections::HashSet::new();
        for radar in &self.radar_stations {
            if radar.id.is_empty() {
                return Err(AtcError::ValidationError(
                    "雷达站ID不能为空".to_string(),
                ));
            }
            if !radar_ids.insert(&radar.id) {
                return Err(AtcError::ValidationError(format!(
                    "雷达站ID重复: {}",
                    radar.id
                )));
            }
            if !(-90.0..=90.0).contains(&radar.latitude) {
                return Err(AtcError::ValidationError(format!(
                    "雷达站 {} 纬度无效: {}",
                    radar.id, radar.latitude
                )));
            }
            if !(-180.0..=180.0).contains(&radar.longitude) {
                return Err(AtcError::ValidationError(format!(
                    "雷达站 {} 经度无效: {}",
                    radar.id, radar.longitude
                )));
            }
            if radar.weight <= 0.0 {
                return Err(AtcError::ValidationError(format!(
                    "雷达站 {} 权重必须大于0: {}",
                    radar.id, radar.weight
                )));
            }
        }

        self.safety_thresholds.validate()?;
        self.processing.validate()?;

        Ok(())
    }

    pub fn get_radar(&self, id: &str) -> Option<&RadarStation> {
        self.radar_stations.iter().find(|r| r.id == id)
    }

    pub fn radar_weights(&self) -> HashMap<String, f64> {
        self.radar_stations
            .iter()
            .map(|r| (r.id.clone(), r.weight))
            .collect()
    }
}

impl SafetyThresholds {
    pub fn validate(&self) -> AtcResult<()> {
        if self.horizontal_separation <= 0.0 {
            return Err(AtcError::ValidationError(format!(
                "水平安全间隔必须大于0: {}",
                self.horizontal_separation
            )));
        }
        if self.vertical_separation <= 0.0 {
            return Err(AtcError::ValidationError(format!(
                "垂直安全间隔必须大于0: {}",
                self.vertical_separation
            )));
        }
        if self.lookahead_seconds <= 0 {
            return Err(AtcError::ValidationError(format!(
                "预测时间窗口必须大于0秒: {}",
                self.lookahead_seconds
            )));
        }
        if self.warning_factor < 1.0 {
            return Err(AtcError::ValidationError(format!(
                "警告因子必须大于等于1.0: {}",
                self.warning_factor
            )));
        }
        Ok(())
    }
}

impl ProcessingConfig {
    pub fn validate(&self) -> AtcResult<()> {
        if self.batch_size == 0 {
            return Err(AtcError::ValidationError(
                "批处理大小必须大于0".to_string(),
            ));
        }
        if self.time_alignment_window_ms <= 0 {
            return Err(AtcError::ValidationError(
                "时间对齐窗口必须大于0毫秒".to_string(),
            ));
        }
        if self.track_history_size == 0 {
            return Err(AtcError::ValidationError(
                "轨迹历史大小必须大于0".to_string(),
            ));
        }
        Ok(())
    }
}

pub fn validate_time_range(
    start: &Option<DateTime<Utc>>,
    end: &Option<DateTime<Utc>>,
) -> AtcResult<()> {
    if let (Some(s), Some(e)) = (start, end) {
        if s >= e {
            return Err(AtcError::InvalidTimeRange(format!(
                "开始时间 {} 必须早于结束时间 {}",
                s, e
            )));
        }
        let duration = *e - *s;
        if duration < Duration::seconds(1) {
            return Err(AtcError::InvalidTimeRange(
                "时间范围至少为1秒".to_string(),
            ));
        }
    }
    Ok(())
}

pub fn validate_file_exists(path: &Path, label: &str) -> AtcResult<()> {
    if !path.exists() {
        return Err(AtcError::FileNotFound(format!(
            "{}: {}",
            label,
            path.display()
        )));
    }
    Ok(())
}

pub fn validate_threshold<T: PartialOrd + std::fmt::Display>(
    value: T,
    min: T,
    max: T,
    label: &str,
) -> AtcResult<()> {
    if value < min || value > max {
        return Err(AtcError::ValidationError(format!(
            "{} 必须在 [{}, {}] 范围内, 当前值: {}",
            label, min, max, value
        )));
    }
    Ok(())
}
