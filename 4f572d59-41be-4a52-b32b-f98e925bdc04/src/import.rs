use anyhow::{Context, Result};
use chrono::{DateTime, Duration, TimeZone, Utc};
use csv::ReaderBuilder;
use nom::{
    bytes::complete::{tag, take},
    number::complete::{le_f32, le_f64, le_u32},
    sequence::tuple,
    IResult,
};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use crate::config::{convert_unit, StationConfig};
use crate::db::{insert_observation, Observation, QcStatus};

#[derive(Debug, Default, Clone)]
pub struct ImportStats {
    pub total: usize,
    pub imported: usize,
    pub duplicates: usize,
    pub errors: usize,
    pub error_details: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FileFormat {
    Csv,
    Binary,
    Unknown,
}

pub fn detect_format<P: AsRef<Path>>(path: P) -> FileFormat {
    let path = path.as_ref();
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("csv") | Some("txt") => FileFormat::Csv,
        Some("bin") | Some("dat") => FileFormat::Binary,
        _ => {
            if let Ok(file) = File::open(path) {
                let mut reader = BufReader::new(file);
                let mut header = [0u8; 16];
                if reader.read(&mut header).is_ok() {
                    if header.starts_with(b"METEO_BIN") {
                        return FileFormat::Binary;
                    }
                    if header.iter().all(|&b| b.is_ascii_graphic() || b == b',' || b == b'\n' || b == b'\r' || b == b' ') {
                        return FileFormat::Csv;
                    }
                }
            }
            FileFormat::Unknown
        }
    }
}

pub fn import_file<P: AsRef<Path>>(
    path: P,
    station_id: &str,
    station_config: &StationConfig,
    conn: &rusqlite::Connection,
    dry_run: bool,
) -> Result<ImportStats> {
    let path = path.as_ref();
    let format = detect_format(path);

    let observations = match format {
        FileFormat::Csv => parse_csv(path, station_id, station_config)?,
        FileFormat::Binary => parse_binary(path, station_id, station_config)?,
        FileFormat::Unknown => {
            anyhow::bail!("Unknown file format: {}", path.display());
        }
    };

    let mut stats = ImportStats::default();
    stats.total = observations.len();

    if dry_run {
        stats.imported = observations.len();
        return Ok(stats);
    }

    let tx = conn.unchecked_transaction()?;

    for obs in observations {
        match insert_observation(&tx, &obs) {
            Ok(id) => {
                if id == 0 {
                    stats.duplicates += 1;
                } else {
                    stats.imported += 1;
                }
            }
            Err(e) => {
                stats.errors += 1;
                if stats.error_details.len() < 100 {
                    stats
                        .error_details
                        .push(format!("Record {}: {}", obs.obs_time, e));
                }
            }
        }
    }

    tx.commit()?;

    Ok(stats)
}

fn parse_csv<P: AsRef<Path>>(
    path: P,
    station_id: &str,
    config: &StationConfig,
) -> Result<Vec<Observation>> {
    let path = path.as_ref();
    let file = File::open(path)
        .with_context(|| format!("Failed to open CSV file: {}", path.display()))?;

    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(BufReader::new(file));

    let headers = rdr
        .headers()?
        .iter()
        .map(|h| h.to_string())
        .collect::<Vec<_>>();

    let column_map = build_column_map(&headers, config);

    let mut observations = Vec::new();
    let source_file = path.file_name().and_then(|f| f.to_str()).map(|s| s.to_string());

    for (idx, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                log::warn!("CSV record {} parse error: {}", idx, e);
                continue;
            }
        };

        match parse_csv_record(&record, &column_map, station_id, config, &source_file) {
            Ok(obs) => observations.push(obs),
            Err(e) => {
                log::warn!("CSV record {} parse error: {}", idx, e);
            }
        }
    }

    Ok(observations)
}

fn build_column_map(headers: &[String], config: &StationConfig) -> HashMap<String, usize> {
    let mut map = HashMap::new();

    for (idx, header) in headers.iter().enumerate() {
        let header_lower = header.to_lowercase().trim().to_string();

        let element = config
            .csv_column_mapping
            .iter()
            .find(|(_, v)| v.to_lowercase() == header_lower)
            .map(|(k, _)| k.clone())
            .or_else(|| match header_lower.as_str() {
                "time" | "timestamp" | "datetime" | "obs_time" | "观测时间" | "时间" => {
                    Some("obs_time".to_string())
                }
                "temperature" | "temp" | "气温" | "温度" => Some("temperature".to_string()),
                "pressure" | "pres" | "气压" => Some("pressure".to_string()),
                "humidity" | "rh" | "relative_humidity" | "湿度" | "相对湿度" => {
                    Some("relative_humidity".to_string())
                }
                "wind_speed" | "windspeed" | "ws" | "风速" => Some("wind_speed".to_string()),
                "wind_direction" | "winddir" | "wd" | "风向" => Some("wind_direction".to_string()),
                "precipitation" | "precip" | "rain" | "降水量" | "雨量" => {
                    Some("precipitation".to_string())
                }
                "visibility" | "vis" | "能见度" => Some("visibility".to_string()),
                "station" | "station_id" | "站点" | "站号" => Some("station_id".to_string()),
                _ => None,
            });

        if let Some(elem) = element {
            map.insert(elem, idx);
        }
    }

    map
}

fn parse_csv_record(
    record: &csv::StringRecord,
    column_map: &HashMap<String, usize>,
    station_id: &str,
    config: &StationConfig,
    source_file: &Option<String>,
) -> Result<Observation> {
    let obs_time_str = column_map
        .get("obs_time")
        .and_then(|&idx| record.get(idx))
        .ok_or_else(|| anyhow::anyhow!("Missing observation time"))?;

    let obs_time = parse_datetime(obs_time_str, &config.timezone)?;

    let get_value = |elem: &str| -> Option<f64> {
        let idx = column_map.get(elem)?;
        let val_str = record.get(*idx)?;
        if val_str.is_empty() || val_str == "NA" || val_str == "N/A" || val_str == "-" {
            return None;
        }
        let val = val_str.trim().parse::<f64>().ok()?;
        let unit = config.get_element_unit(elem);
        let standard_unit = default_standard_unit(elem);
        if unit != standard_unit {
            convert_unit(val, &unit, &standard_unit)
        } else {
            Some(val)
        }
    };

    let sid = column_map
        .get("station_id")
        .and_then(|&idx| record.get(idx))
        .unwrap_or(station_id)
        .to_string();

    Ok(Observation {
        id: None,
        station_id: sid,
        obs_time,
        temperature: get_value("temperature"),
        pressure: get_value("pressure"),
        relative_humidity: get_value("relative_humidity"),
        wind_speed: get_value("wind_speed"),
        wind_direction: get_value("wind_direction"),
        precipitation: get_value("precipitation"),
        visibility: get_value("visibility"),
        raw_data: Some(format!("{:?}", record.iter().collect::<Vec<_>>())),
        source_file: source_file.clone(),
        qc_status: QcStatus::Pending.as_str().to_string(),
    })
}

fn default_standard_unit(element: &str) -> &'static str {
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

fn parse_datetime(s: &str, timezone: &str) -> Result<DateTime<Utc>> {
    let s = s.trim();

    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y%m%d%H%M%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ];

    for fmt in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, fmt) {
            return match timezone {
                "Asia/Shanghai" | "Asia/Beijing" | "UTC+8" | "CST" => {
                    let local = chrono::FixedOffset::east_opt(8 * 3600)
                        .unwrap()
                        .from_local_datetime(&dt)
                        .single()
                        .ok_or_else(|| anyhow::anyhow!("Ambiguous datetime: {}", s))?;
                    Ok(local.with_timezone(&Utc))
                }
                _ => Ok(Utc.from_utc_datetime(&dt)),
            };
        }
    }

    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Ok(dt.with_timezone(&Utc));
    }

    anyhow::bail!("Failed to parse datetime: {}", s)
}

#[derive(Debug)]
struct BinaryRecordHeader {
    magic: [u8; 8],
    version: u32,
    station_id_len: u32,
}

fn parse_binary<P: AsRef<Path>>(
    path: P,
    station_id: &str,
    config: &StationConfig,
) -> Result<Vec<Observation>> {
    let path = path.as_ref();
    let mut file = File::open(path)
        .with_context(|| format!("Failed to open binary file: {}", path.display()))?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)?;

    let mut observations = Vec::new();
    let source_file = path.file_name().and_then(|f| f.to_str()).map(|s| s.to_string());

    if data.len() < 12 {
        anyhow::bail!("Binary file too short");
    }

    let magic = &data[0..8];
    if magic != b"METEO_BIN" && magic != b"METDAT\x01\x00" {
        anyhow::bail!("Invalid binary magic number");
    }

    let mut offset = 12;

    while offset + 8 <= data.len() {
        match parse_binary_record(&data[offset..], station_id, config, &source_file) {
            Ok((consumed, obs)) => {
                observations.push(obs);
                offset += consumed;
            }
            Err(e) => {
                log::warn!("Binary record at offset {} parse error: {}", offset, e);
                offset += 1;
            }
        }
    }

    Ok(observations)
}

fn parse_binary_record(
    input: &[u8],
    default_station_id: &str,
    config: &StationConfig,
    source_file: &Option<String>,
) -> Result<(usize, Observation)> {
    let (rem, record_size) = le_u32(input).map_err(|_| anyhow::anyhow!("Failed to read record size"))?;

    let (rem, timestamp) = le_u32(rem).map_err(|_| anyhow::anyhow!("Failed to read timestamp"))?;

    let obs_time = chrono::NaiveDateTime::from_timestamp_opt(timestamp as i64, 0)
        .ok_or_else(|| anyhow::anyhow!("Invalid timestamp: {}", timestamp))?;
    let obs_time = match config.timezone.as_str() {
        "Asia/Shanghai" | "Asia/Beijing" => {
            let local = chrono::FixedOffset::east_opt(8 * 3600)
                .unwrap()
                .from_local_datetime(&obs_time)
                .single()
                .ok_or_else(|| anyhow::anyhow!("Ambiguous datetime"))?;
            local.with_timezone(&Utc)
        }
        _ => Utc.from_utc_datetime(&obs_time),
    };

    let (rem, temperature) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read temperature"))?;
    let (rem, pressure) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read pressure"))?;
    let (rem, humidity) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read humidity"))?;
    let (rem, wind_speed) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read wind speed"))?;
    let (rem, wind_dir) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read wind direction"))?;
    let (rem, precip) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read precipitation"))?;
    let (rem, visibility) = le_f32(rem).map_err(|_| anyhow::anyhow!("Failed to read visibility"))?;

    let obs = Observation {
        id: None,
        station_id: default_station_id.to_string(),
        obs_time,
        temperature: if temperature.is_nan() || temperature == -9999.0 {
            None
        } else {
            Some(temperature as f64)
        },
        pressure: if pressure.is_nan() || pressure == -9999.0 {
            None
        } else {
            Some(pressure as f64)
        },
        relative_humidity: if humidity.is_nan() || humidity == -9999.0 {
            None
        } else {
            Some(humidity as f64)
        },
        wind_speed: if wind_speed.is_nan() || wind_speed == -9999.0 {
            None
        } else {
            Some(wind_speed as f64)
        },
        wind_direction: if wind_dir.is_nan() || wind_dir == -9999.0 {
            None
        } else {
            Some(wind_dir as f64)
        },
        precipitation: if precip.is_nan() || precip == -9999.0 {
            None
        } else {
            Some(precip as f64)
        },
        visibility: if visibility.is_nan() || visibility == -9999.0 {
            None
        } else {
            Some(visibility as f64)
        },
        raw_data: Some(format!("binary_record_size={}", record_size)),
        source_file: source_file.clone(),
        qc_status: QcStatus::Pending.as_str().to_string(),
    };

    Ok((record_size as usize, obs))
}

pub fn import_directory<P: AsRef<Path>>(
    dir: P,
    station_id: Option<&str>,
    config: &crate::config::AppConfig,
    conn: &rusqlite::Connection,
    dry_run: bool,
) -> Result<ImportStats> {
    let dir = dir.as_ref();
    let mut total_stats = ImportStats::default();

    let mut files: Vec<PathBuf> = Vec::new();
    for entry in walkdir::WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path = entry.path().to_path_buf();
            let fmt = detect_format(&path);
            if fmt != FileFormat::Unknown {
                files.push(path);
            }
        }
    }

    for file_path in files {
        let sid = station_id
            .or_else(|| infer_station_from_filename(&file_path, config))
            .unwrap_or("unknown");

        let station_config = config
            .get_station(sid)
            .cloned()
            .unwrap_or_else(|| default_station_config(sid));

        match import_file(&file_path, sid, &station_config, conn, dry_run) {
            Ok(stats) => {
                total_stats.total += stats.total;
                total_stats.imported += stats.imported;
                total_stats.duplicates += stats.duplicates;
                total_stats.errors += stats.errors;
                total_stats.error_details.extend(stats.error_details);
            }
            Err(e) => {
                log::error!("Failed to import {}: {}", file_path.display(), e);
                total_stats.errors += 1;
            }
        }
    }

    Ok(total_stats)
}

pub fn infer_station_from_filename<P: AsRef<Path>>(
    path: P,
    config: &crate::config::AppConfig,
) -> Option<&str> {
    let path = path.as_ref();
    let filename = path.file_name()?.to_str()?;

    for station in &config.stations {
        if filename.contains(&station.id) {
            return Some(station.id.as_str());
        }
        if filename.contains(&station.name) {
            return Some(station.id.as_str());
        }
    }

    None
}

fn default_station_config(id: &str) -> crate::config::StationConfig {
    crate::config::StationConfig {
        id: id.to_string(),
        name: format!("Station {}", id),
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
