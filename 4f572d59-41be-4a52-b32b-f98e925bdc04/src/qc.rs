use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use std::collections::HashMap;
use std::fmt;

use crate::config::{AppConfig, ClimateLimits, StationConfig};
use crate::db::{
    insert_qc_result, update_observation_qc_status, Observation, QcResult, QcStatus,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Element {
    Temperature,
    Pressure,
    RelativeHumidity,
    WindSpeed,
    WindDirection,
    Precipitation,
    Visibility,
}

impl Element {
    pub fn as_str(&self) -> &'static str {
        match self {
            Element::Temperature => "temperature",
            Element::Pressure => "pressure",
            Element::RelativeHumidity => "relative_humidity",
            Element::WindSpeed => "wind_speed",
            Element::WindDirection => "wind_direction",
            Element::Precipitation => "precipitation",
            Element::Visibility => "visibility",
        }
    }

    pub fn all() -> Vec<Element> {
        vec![
            Element::Temperature,
            Element::Pressure,
            Element::RelativeHumidity,
            Element::WindSpeed,
            Element::WindDirection,
            Element::Precipitation,
            Element::Visibility,
        ]
    }

    pub fn from_str(s: &str) -> Option<Element> {
        match s {
            "temperature" => Some(Element::Temperature),
            "pressure" => Some(Element::Pressure),
            "relative_humidity" => Some(Element::RelativeHumidity),
            "wind_speed" => Some(Element::WindSpeed),
            "wind_direction" => Some(Element::WindDirection),
            "precipitation" => Some(Element::Precipitation),
            "visibility" => Some(Element::Visibility),
            _ => None,
        }
    }
}

impl fmt::Display for Element {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QcResultCode {
    Pass,
    Suspect,
    Fail,
    Missing,
}

impl QcResultCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            QcResultCode::Pass => "pass",
            QcResultCode::Suspect => "suspect",
            QcResultCode::Fail => "fail",
            QcResultCode::Missing => "missing",
        }
    }
}

pub trait QcRule {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn check(&self, obs: &Observation, context: &QcContext) -> Vec<QcResultEntry>;
}

pub struct QcContext<'a> {
    pub station: &'a StationConfig,
    pub climate_limits: &'a ClimateLimits,
    pub previous_obs: Option<&'a Observation>,
    pub next_obs: Option<&'a Observation>,
    pub neighbor_obs: HashMap<String, &'a Observation>,
    pub recent_obs: Vec<&'a Observation>,
    pub thresholds: HashMap<String, f64>,
}

#[derive(Debug, Clone)]
pub struct QcResultEntry {
    pub rule_code: String,
    pub element: String,
    pub result: String,
    pub detail: Option<String>,
}

pub struct MissingCheckRule;

impl MissingCheckRule {
    pub fn new() -> Self {
        MissingCheckRule
    }
}

impl QcRule for MissingCheckRule {
    fn id(&self) -> &str {
        "missing_check"
    }

    fn name(&self) -> &str {
        "缺测值检测"
    }

    fn check(&self, obs: &Observation, _context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();
        let elements = [
            ("temperature", obs.temperature),
            ("pressure", obs.pressure),
            ("relative_humidity", obs.relative_humidity),
            ("wind_speed", obs.wind_speed),
            ("wind_direction", obs.wind_direction),
            ("precipitation", obs.precipitation),
            ("visibility", obs.visibility),
        ];

        for (elem, value) in elements {
            let result = if value.is_none() {
                QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Missing.as_str().to_string(),
                    detail: Some("要素值缺测".to_string()),
                }
            } else {
                QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: None,
                }
            };
            results.push(result);
        }

        results
    }
}

pub struct ClimatologicalLimitRule {
    climate_limits: ClimateLimits,
}

impl ClimatologicalLimitRule {
    pub fn new(climate_limits: &ClimateLimits) -> Self {
        ClimatologicalLimitRule {
            climate_limits: climate_limits.clone(),
        }
    }

    fn check_limit(&self, value: f64, min: f64, max: f64) -> (QcResultCode, Option<String>) {
        if value < min || value > max {
            (
                QcResultCode::Fail,
                Some(format!("值 {} 超出界限 [{}, {}]", value, min, max)),
            )
        } else {
            (QcResultCode::Pass, None)
        }
    }
}

impl QcRule for ClimatologicalLimitRule {
    fn id(&self) -> &str {
        "climatological_limit"
    }

    fn name(&self) -> &str {
        "气候极值界限检查"
    }

    fn check(&self, obs: &Observation, _context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();
        let limits = &self.climate_limits;

        let checks = [
            (
                "temperature",
                obs.temperature,
                limits.temperature_min,
                limits.temperature_max,
            ),
            (
                "pressure",
                obs.pressure,
                limits.pressure_min,
                limits.pressure_max,
            ),
            (
                "relative_humidity",
                obs.relative_humidity,
                limits.humidity_min,
                limits.humidity_max,
            ),
            ("wind_speed", obs.wind_speed, 0.0, limits.wind_speed_max),
            ("wind_direction", obs.wind_direction, 0.0, 360.0),
            (
                "precipitation",
                obs.precipitation,
                0.0,
                limits.precipitation_max,
            ),
            (
                "visibility",
                obs.visibility,
                limits.visibility_min,
                limits.visibility_max,
            ),
        ];

        for (elem, value, min, max) in checks {
            if let Some(v) = value {
                let (code, detail) = self.check_limit(v, min, max);
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: code.as_str().to_string(),
                    detail,
                });
            }
        }

        results
    }
}

pub struct TemporalConsistencyRule {
    default_threshold: f64,
}

impl TemporalConsistencyRule {
    pub fn new(threshold: f64) -> Self {
        TemporalConsistencyRule {
            default_threshold: threshold,
        }
    }

    fn get_threshold(&self, element: &str, context: &QcContext) -> f64 {
        let key = format!("temporal_{}", element);
        context
            .thresholds
            .get(&key)
            .copied()
            .unwrap_or_else(|| match element {
                "temperature" => 5.0,
                "pressure" => 10.0,
                "relative_humidity" => 30.0,
                "wind_speed" => 15.0,
                "wind_direction" => 180.0,
                "precipitation" => 50.0,
                "visibility" => 10000.0,
                _ => self.default_threshold,
            })
    }
}

impl QcRule for TemporalConsistencyRule {
    fn id(&self) -> &str {
        "temporal_consistency"
    }

    fn name(&self) -> &str {
        "时间一致性检查"
    }

    fn check(&self, obs: &Observation, context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();

        let prev = context.previous_obs;
        let next = context.next_obs;

        let elements = [
            ("temperature", |o: &Observation| o.temperature),
            ("pressure", |o: &Observation| o.pressure),
            ("relative_humidity", |o: &Observation| o.relative_humidity),
            ("wind_speed", |o: &Observation| o.wind_speed),
            ("wind_direction", |o: &Observation| o.wind_direction),
            ("precipitation", |o: &Observation| o.precipitation),
            ("visibility", |o: &Observation| o.visibility),
        ];

        for (elem, get_val) in elements {
            let current_val = match get_val(obs) {
                Some(v) => v,
                None => continue,
            };

            let threshold = self.get_threshold(elem, context);
            let mut check_count = 0;
            let mut fail_count = 0;

            if let Some(prev_obs) = prev {
                if let Some(prev_val) = get_val(prev_obs) {
                    check_count += 1;
                    let diff = (current_val - prev_val).abs();
                    if diff > threshold {
                        fail_count += 1;
                    }
                }
            }

            if let Some(next_obs) = next {
                if let Some(next_val) = get_val(next_obs) {
                    check_count += 1;
                    let diff = (current_val - next_val).abs();
                    if diff > threshold {
                        fail_count += 1;
                    }
                }
            }

            if check_count == 0 {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: Some("无相邻数据可对比".to_string()),
                });
            } else if fail_count >= check_count {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Suspect.as_str().to_string(),
                    detail: Some(format!("与相邻时次差值超过阈值 {}", threshold)),
                });
            } else {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: None,
                });
            }
        }

        results
    }
}

pub struct SpatialConsistencyRule {
    default_threshold: f64,
}

impl SpatialConsistencyRule {
    pub fn new(threshold: f64) -> Self {
        SpatialConsistencyRule {
            default_threshold: threshold,
        }
    }

    fn get_threshold(&self, element: &str, context: &QcContext) -> f64 {
        let key = format!("spatial_{}", element);
        context
            .thresholds
            .get(&key)
            .copied()
            .unwrap_or_else(|| match element {
                "temperature" => 3.0,
                "pressure" => 5.0,
                "relative_humidity" => 20.0,
                "wind_speed" => 10.0,
                _ => self.default_threshold,
            })
    }
}

impl QcRule for SpatialConsistencyRule {
    fn id(&self) -> &str {
        "spatial_consistency"
    }

    fn name(&self) -> &str {
        "空间一致性检查"
    }

    fn check(&self, obs: &Observation, context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();

        let elements = [
            ("temperature", |o: &Observation| o.temperature),
            ("pressure", |o: &Observation| o.pressure),
            ("relative_humidity", |o: &Observation| o.relative_humidity),
            ("wind_speed", |o: &Observation| o.wind_speed),
        ];

        for (elem, get_val) in elements {
            let current_val = match get_val(obs) {
                Some(v) => v,
                None => continue,
            };

            let threshold = self.get_threshold(elem, context);
            let mut neighbor_values = Vec::new();

            for (_neighbor_id, neighbor_obs) in &context.neighbor_obs {
                if let Some(v) = get_val(neighbor_obs) {
                    neighbor_values.push(v);
                }
            }

            if neighbor_values.is_empty() {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: Some("无邻近站点数据可对比".to_string()),
                });
                continue;
            }

            let avg: f64 = neighbor_values.iter().sum::<f64>() / neighbor_values.len() as f64;
            let diff = (current_val - avg).abs();

            if diff > threshold * 2.0 {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Fail.as_str().to_string(),
                    detail: Some(format!(
                        "与邻近站点均值偏差 {:.2} 远超阈值 {}",
                        diff, threshold
                    )),
                });
            } else if diff > threshold {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Suspect.as_str().to_string(),
                    detail: Some(format!(
                        "与邻近站点均值偏差 {:.2} 超过阈值 {}",
                        diff, threshold
                    )),
                });
            } else {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: None,
                });
            }
        }

        results
    }
}

pub struct InternalConsistencyRule;

impl InternalConsistencyRule {
    pub fn new() -> Self {
        InternalConsistencyRule
    }

    fn calculate_dew_point(temperature: f64, rh: f64) -> f64 {
        let a = 17.27;
        let b = 237.7;
        let alpha = ((rh / 100.0).ln() + a * temperature / (b + temperature)) / a;
        b * alpha / (1.0 - alpha)
    }
}

impl QcRule for InternalConsistencyRule {
    fn id(&self) -> &str {
        "internal_consistency"
    }

    fn name(&self) -> &str {
        "内部一致性检查"
    }

    fn check(&self, obs: &Observation, _context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();

        if let (Some(temp), Some(rh)) = (obs.temperature, obs.relative_humidity) {
            if rh > 0.0 && rh <= 100.0 {
                let dew_point = Self::calculate_dew_point(temp, rh);
                if dew_point > temp + 0.5 {
                    results.push(QcResultEntry {
                        rule_code: self.id().to_string(),
                        element: "temperature_humidity".to_string(),
                        result: QcResultCode::Fail.as_str().to_string(),
                        detail: Some(format!(
                            "露点温度 {:.1}℃ 高于气温 {:.1}℃，物理矛盾",
                            dew_point, temp
                        )),
                    });
                } else {
                    results.push(QcResultEntry {
                        rule_code: self.id().to_string(),
                        element: "temperature_humidity".to_string(),
                        result: QcResultCode::Pass.as_str().to_string(),
                        detail: None,
                    });
                }
            }
        }

        if let (Some(ws), Some(wd)) = (obs.wind_speed, obs.wind_direction) {
            if ws == 0.0 && wd != 0.0 {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: "wind".to_string(),
                    result: QcResultCode::Suspect.as_str().to_string(),
                    detail: Some("风速为0但风向不为0，存在矛盾".to_string()),
                });
            } else if ws > 0.0 && (wd < 0.0 || wd > 360.0) {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: "wind".to_string(),
                    result: QcResultCode::Fail.as_str().to_string(),
                    detail: Some(format!("风向值 {} 超出有效范围", wd)),
                });
            } else {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: "wind".to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: None,
                });
            }
        }

        if let Some(precip) = obs.precipitation {
            if precip < 0.0 {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: "precipitation".to_string(),
                    result: QcResultCode::Fail.as_str().to_string(),
                    detail: Some("降水量为负值".to_string()),
                });
            }
        }

        if let Some(vis) = obs.visibility {
            if vis < 0.0 {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: "visibility".to_string(),
                    result: QcResultCode::Fail.as_str().to_string(),
                    detail: Some("能见度为负值".to_string()),
                });
            }
        }

        results
    }
}

pub struct PersistenceCheckRule {
    default_duration: f64,
}

impl PersistenceCheckRule {
    pub fn new(duration_threshold: f64) -> Self {
        PersistenceCheckRule {
            default_duration: duration_threshold,
        }
    }

    fn get_threshold(&self, element: &str, context: &QcContext) -> usize {
        let key = format!("persistence_{}", element);
        context
            .thresholds
            .get(&key)
            .copied()
            .unwrap_or_else(|| match element {
                "temperature" => 6.0,
                "pressure" => 12.0,
                "relative_humidity" => 6.0,
                "visibility" => 3.0,
                _ => self.default_duration,
            }) as usize
    }
}

impl QcRule for PersistenceCheckRule {
    fn id(&self) -> &str {
        "persistence_check"
    }

    fn name(&self) -> &str {
        "持续性检查"
    }

    fn check(&self, obs: &Observation, context: &QcContext) -> Vec<QcResultEntry> {
        let mut results = Vec::new();

        let elements = [
            ("temperature", |o: &Observation| o.temperature),
            ("pressure", |o: &Observation| o.pressure),
            ("relative_humidity", |o: &Observation| o.relative_humidity),
            ("wind_speed", |o: &Observation| o.wind_speed),
            ("visibility", |o: &Observation| o.visibility),
        ];

        for (elem, get_val) in elements {
            let current_val = match get_val(obs) {
                Some(v) => v,
                None => continue,
            };

            let threshold = self.get_threshold(elem, context);
            let mut consecutive = 0;
            let epsilon = match elem {
                "temperature" => 0.1,
                "pressure" => 0.1,
                "relative_humidity" => 1.0,
                "wind_speed" => 0.1,
                "visibility" => 1.0,
                _ => 0.01,
            };

            for prev_obs in context.recent_obs.iter() {
                if let Some(v) = get_val(prev_obs) {
                    if (v - current_val).abs() < epsilon {
                        consecutive += 1;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            if consecutive >= threshold {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Suspect.as_str().to_string(),
                    detail: Some(format!(
                        "连续 {} 个时次值不变，疑似仪器故障",
                        consecutive + 1
                    )),
                });
            } else {
                results.push(QcResultEntry {
                    rule_code: self.id().to_string(),
                    element: elem.to_string(),
                    result: QcResultCode::Pass.as_str().to_string(),
                    detail: None,
                });
            }
        }

        results
    }
}

pub struct QcEngine {
    rules: Vec<Box<dyn QcRule + Send + Sync>>,
}

impl QcEngine {
    pub fn new(config: &AppConfig) -> Self {
        let mut rules: Vec<Box<dyn QcRule + Send + Sync>> = Vec::new();

        for rule_config in &config.qc_rules {
            if !rule_config.enabled {
                continue;
            }

            match rule_config.id.as_str() {
                "missing_check" => {
                    rules.push(Box::new(MissingCheckRule::new()));
                }
                "climatological_limit" => {
                    rules.push(Box::new(ClimatologicalLimitRule::new(&config.climate_limits)));
                }
                "temporal_consistency" => {
                    rules.push(Box::new(TemporalConsistencyRule::new(rule_config.threshold)));
                }
                "spatial_consistency" => {
                    rules.push(Box::new(SpatialConsistencyRule::new(rule_config.threshold)));
                }
                "internal_consistency" => {
                    rules.push(Box::new(InternalConsistencyRule::new()));
                }
                "persistence_check" => {
                    rules.push(Box::new(PersistenceCheckRule::new(rule_config.threshold)));
                }
                _ => {}
            }
        }

        QcEngine { rules }
    }

    pub fn check_observation(
        &self,
        obs: &Observation,
        context: &QcContext,
    ) -> Vec<QcResultEntry> {
        let mut all_results = Vec::new();
        for rule in &self.rules {
            let results = rule.check(obs, context);
            all_results.extend(results);
        }
        all_results
    }

    pub fn determine_overall_status(&self, results: &[QcResultEntry]) -> QcStatus {
        let mut has_fail = false;
        let mut has_suspect = false;
        let mut has_missing = false;

        for r in results {
            match r.result.as_str() {
                "fail" => has_fail = true,
                "suspect" => has_suspect = true,
                "missing" => has_missing = true,
                _ => {}
            }
        }

        if has_fail {
            QcStatus::Failed
        } else if has_suspect || has_missing {
            QcStatus::Suspect
        } else {
            QcStatus::Passed
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct QcStats {
    pub total: usize,
    pub passed: usize,
    pub suspect: usize,
    pub failed: usize,
    pub element_stats: HashMap<String, ElementQcStats>,
}

#[derive(Debug, Default, Clone)]
pub struct ElementQcStats {
    pub total: usize,
    pub pass: usize,
    pub suspect: usize,
    pub fail: usize,
    pub missing: usize,
}

pub fn run_qc_for_range(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    station_id: Option<&str>,
    start_time: &DateTime<Utc>,
    end_time: &DateTime<Utc>,
    dry_run: bool,
) -> Result<QcStats> {
    let mut stmt = conn.prepare(
        "SELECT id, station_id, obs_time, temperature, pressure, relative_humidity,
         wind_speed, wind_direction, precipitation, visibility, raw_data, source_file, qc_status
         FROM observations 
         WHERE obs_time >= ?1 AND obs_time <= ?2 
         AND (qc_status = 'pending' OR qc_status = 'suspect')
         ORDER BY station_id, obs_time ASC",
    )?;

    let mut rows = if let Some(sid) = station_id {
        stmt.query(params![start_time.to_rfc3339(), end_time.to_rfc3339()])?
    } else {
        stmt.query(params![start_time.to_rfc3339(), end_time.to_rfc3339()])?
    };

    let mut observations: Vec<Observation> = Vec::new();
    while let Some(row) = rows.next()? {
        let obs_time_str: String = row.get(2)?;
        let obs_time = DateTime::parse_from_rfc3339(&obs_time_str)?.with_timezone(&Utc);

        observations.push(Observation {
            id: row.get(0)?,
            station_id: row.get(1)?,
            obs_time,
            temperature: row.get(3)?,
            pressure: row.get(4)?,
            relative_humidity: row.get(5)?,
            wind_speed: row.get(6)?,
            wind_direction: row.get(7)?,
            precipitation: row.get(8)?,
            visibility: row.get(9)?,
            raw_data: row.get(10)?,
            source_file: row.get(11)?,
            qc_status: row.get(12)?,
        });
    }

    drop(rows);
    drop(stmt);

    let engine = QcEngine::new(config);
    let mut stats = QcStats::default();

    if observations.is_empty() {
        return Ok(stats);
    }

    let obs_by_station = group_observations_by_station(&observations);
    let mut all_qc_results: Vec<QcResult> = Vec::new();
    let mut status_updates: Vec<(i64, String)> = Vec::new();

    for (sid, station_obs) in &obs_by_station {
        let station_config = match config.get_station(sid) {
            Some(sc) => sc.clone(),
            None => {
                log::warn!("Station config not found for {}, using defaults", sid);
                crate::config::StationConfig {
                    id: sid.clone(),
                    name: sid.clone(),
                    latitude: 0.0,
                    longitude: 0.0,
                    elevation: None,
                    instrument_model: None,
                    timezone: "Asia/Shanghai".to_string(),
                    csv_column_mapping: HashMap::new(),
                    unit_mapping: HashMap::new(),
                    neighbors: Vec::new(),
                    qc_thresholds: HashMap::new(),
                }
            }
        };

        for (i, obs) in station_obs.iter().enumerate() {
            let prev_obs = if i > 0 { station_obs.get(i - 1) } else { None };
            let next_obs = station_obs.get(i + 1);

            let recent_obs: Vec<&Observation> = station_obs
                .iter()
                .take(i)
                .rev()
                .take(12)
                .collect();

            let neighbor_obs = get_neighbor_observations(obs, &obs_by_station, config);

            let context = QcContext {
                station: &station_config,
                climate_limits: &config.climate_limits,
                previous_obs: prev_obs,
                next_obs,
                neighbor_obs,
                recent_obs,
                thresholds: station_config.qc_thresholds.clone(),
            };

            let qc_entries = engine.check_observation(obs, &context);
            let overall_status = engine.determine_overall_status(&qc_entries);

            for entry in &qc_entries {
                let elem_stat = stats
                    .element_stats
                    .entry(entry.element.clone())
                    .or_insert_with(ElementQcStats::default);
                elem_stat.total += 1;
                match entry.result.as_str() {
                    "pass" => elem_stat.pass += 1,
                    "suspect" => elem_stat.suspect += 1,
                    "fail" => elem_stat.fail += 1,
                    "missing" => elem_stat.missing += 1,
                    _ => {}
                }

                if let Some(obs_id) = obs.id {
                    all_qc_results.push(QcResult {
                        observation_id: obs_id,
                        station_id: obs.station_id.clone(),
                        obs_time: obs.obs_time,
                        rule_code: entry.rule_code.clone(),
                        element: entry.element.clone(),
                        result: entry.result.clone(),
                        detail: entry.detail.clone(),
                    });
                }
            }

            stats.total += 1;
            match overall_status {
                QcStatus::Passed => stats.passed += 1,
                QcStatus::Suspect => stats.suspect += 1,
                QcStatus::Failed => stats.failed += 1,
                _ => {}
            }

            if let Some(obs_id) = obs.id {
                status_updates.push((obs_id, overall_status.as_str().to_string()));
            }
        }
    }

    if !dry_run {
        let tx = conn.unchecked_transaction()?;

        for qr in &all_qc_results {
            insert_qc_result(&tx, qr)?;
        }

        for (obs_id, status) in &status_updates {
            update_observation_qc_status(&tx, *obs_id, status)?;
        }

        tx.commit()?;
    }

    Ok(stats)
}

fn group_observations_by_station(obs: &[Observation]) -> HashMap<String, Vec<Observation>> {
    let mut map: HashMap<String, Vec<Observation>> = HashMap::new();
    for o in obs {
        map.entry(o.station_id.clone())
            .or_default()
            .push(o.clone());
    }
    for v in map.values_mut() {
        v.sort_by_key(|o| o.obs_time);
    }
    map
}

fn get_neighbor_observations(
    obs: &Observation,
    obs_by_station: &HashMap<String, Vec<Observation>>,
    config: &AppConfig,
) -> HashMap<String, &Observation> {
    let mut result = HashMap::new();

    let neighbors = config.get_neighbors(&obs.station_id);

    for neighbor in neighbors {
        if let Some(neighbor_obs_list) = obs_by_station.get(&neighbor.id) {
            if let Some(closest) = find_closest_obs(obs.obs_time, neighbor_obs_list) {
                result.insert(neighbor.id.clone(), closest);
            }
        }
    }

    result
}

fn find_closest_obs<'a>(
    target_time: DateTime<Utc>,
    obs_list: &'a [Observation],
) -> Option<&'a Observation> {
    let max_diff = Duration::minutes(10);

    obs_list
        .iter()
        .filter(|o| (o.obs_time - target_time).abs() <= max_diff)
        .min_by_key(|o| (o.obs_time - target_time).abs())
}
