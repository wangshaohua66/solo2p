use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use flate2::write::GzEncoder;
use flate2::Compression;
use md5::{Digest, Md5};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use crate::db::Observation;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchiveType {
    Micaps1,
    Micaps11,
    Bufr4,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchivePeriod {
    Daily,
    Monthly,
}

#[derive(Debug, Clone)]
pub struct ArchiveResult {
    pub file_path: PathBuf,
    pub record_count: usize,
    pub md5_checksum: String,
    pub file_size: u64,
}

pub fn generate_micaps1(
    observations: &[Observation],
    output_path: &Path,
    station_id: &str,
    station_name: &str,
    latitude: f64,
    longitude: f64,
    elevation: Option<f64>,
) -> Result<usize> {
    if observations.is_empty() {
        return Ok(0);
    }

    let mut writer = File::create(output_path)
        .with_context(|| format!("Failed to create MICAPS file: {}", output_path.display()))?;
    let mut writer = BufWriter::new(writer);

    writeln!(writer, "diamond 1  {}", station_name)?;
    writeln!(
        writer,
        " {} {:.4} {:.4} {:.1} {} m/s hPa  %  mm",
        station_id,
        longitude,
        latitude,
        elevation.unwrap_or(0.0),
        observations.len()
    )?;
    writeln!(
        writer,
        " Station  YYYY MM DD HH MM SS  WindSpeed WindDir  T  P  RH  R  VIS"
    )?;

    let mut count = 0;
    for obs in observations {
        if obs.qc_status == "passed" || obs.qc_status == "overridden_pass" {
            let local_time = obs.obs_time + Duration::hours(8);
            let time_str = local_time.format("%Y %m %d %H %M %S");

            let wind_speed = obs
                .wind_speed
                .map(|v| format!("{:6.1}", v))
                .unwrap_or_else(|| "   9999".to_string());
            let wind_dir = obs
                .wind_direction
                .map(|v| format!("{:6.1}", v))
                .unwrap_or_else(|| "   9999".to_string());
            let temp = obs
                .temperature
                .map(|v| format!("{:5.1}", v))
                .unwrap_or_else(|| " 9999".to_string());
            let pres = obs
                .pressure
                .map(|v| format!("{:6.1}", v))
                .unwrap_or_else(|| "   9999".to_string());
            let rh = obs
                .relative_humidity
                .map(|v| format!("{:4.0}", v))
                .unwrap_or_else(|| "9999".to_string());
            let precip = obs
                .precipitation
                .map(|v| format!("{:5.1}", v))
                .unwrap_or_else(|| "9999".to_string());
            let vis = obs
                .visibility
                .map(|v| format!("{:8.0}", v))
                .unwrap_or_else(|| "   99999".to_string());

            writeln!(
                writer,
                " {:<9} {} {}{}{}{}{}{}",
                station_id, time_str, wind_speed, wind_dir, temp, pres, rh, precip, vis
            )?;
            count += 1;
        }
    }

    writer.flush()?;
    Ok(count)
}

pub fn generate_micaps11(
    observations: &[Observation],
    output_path: &Path,
    station_id: &str,
    station_name: &str,
) -> Result<usize> {
    if observations.is_empty() {
        return Ok(0);
    }

    let mut writer = File::create(output_path)
        .with_context(|| format!("Failed to create MICAPS file: {}", output_path.display()))?;
    let mut writer = BufWriter::new(writer);

    writeln!(writer, "diamond 11 {}", station_name)?;
    writeln!(writer, " {} {} {}", station_id, observations.len(), 6)?;
    writeln!(writer, " 气温 气压 相对湿度 风速 风向 降水量 能见度")?;

    let mut count = 0;
    for obs in observations {
        if obs.qc_status == "passed" || obs.qc_status == "overridden_pass" {
            let local_time = obs.obs_time + Duration::hours(8);
            let time_str = local_time.format("%Y%m%d%H%M%S");

            let temp = obs
                .temperature
                .map(|v| format!("{:.2}", v))
                .unwrap_or_else(|| "999999".to_string());
            let pres = obs
                .pressure
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "999999".to_string());
            let rh = obs
                .relative_humidity
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "999999".to_string());
            let ws = obs
                .wind_speed
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "999999".to_string());
            let wd = obs
                .wind_direction
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "999999".to_string());
            let precip = obs
                .precipitation
                .map(|v| format!("{:.2}", v))
                .unwrap_or_else(|| "999999".to_string());
            let vis = obs
                .visibility
                .map(|v| format!("{:.0}", v))
                .unwrap_or_else(|| "999999".to_string());

            writeln!(
                writer,
                " {} {} {} {} {} {} {} {}",
                time_str, temp, pres, rh, ws, wd, precip, vis
            )?;
            count += 1;
        }
    }

    writer.flush()?;
    Ok(count)
}

pub fn generate_bufr4(
    observations: &[Observation],
    output_path: &Path,
    _station_id: &str,
) -> Result<usize> {
    let mut writer = File::create(output_path)
        .with_context(|| format!("Failed to create BUFR file: {}", output_path.display()))?;
    let mut writer = BufWriter::new(writer);

    let mut count = 0;
    for obs in observations {
        if obs.qc_status == "passed" || obs.qc_status == "overridden_pass" {
            let buf = encode_single_obs_bufr(obs)?;
            writer.write_all(&buf)?;
            count += 1;
        }
    }

    writer.flush()?;
    Ok(count)
}

fn encode_single_obs_bufr(obs: &Observation) -> Result<Vec<u8>> {
    let mut buf = Vec::new();

    buf.extend_from_slice(b"BUFR");

    let timestamp = obs.obs_time.timestamp() as u32;

    let mut section1 = Vec::new();
    let section1_len: u32 = 22;
    section1.extend_from_slice(&section1_len.to_be_bytes());
    section1.push(0);
    section1.push(0);

    let station_id_bytes = obs.station_id.as_bytes();
    let mut station_padded = [0u8; 8];
    let copy_len = station_id_bytes.len().min(8);
    station_padded[..copy_len].copy_from_slice(&station_id_bytes[..copy_len]);
    section1.extend_from_slice(&station_padded);

    section1.extend_from_slice(&timestamp.to_be_bytes());

    let data: Vec<u8> = Vec::new();
    let data_len = data.len() as u32;

    let total_len = 8 + section1_len + data_len + 4;

    let mut header = Vec::new();
    header.extend_from_slice(b"BUFR");
    header.extend_from_slice(&total_len.to_be_bytes());
    header.extend_from_slice(&[0x00, 0x04]);
    header.extend_from_slice(&[0x00, 0x00]);

    let mut result = Vec::new();
    result.extend_from_slice(&header);
    result.extend_from_slice(&section1);
    result.extend_from_slice(&data);
    result.extend_from_slice(b"7777");

    let final_len = result.len() as u32;
    result[4..8].copy_from_slice(&final_len.to_be_bytes());

    Ok(result)
}

pub fn gzip_file(input_path: &Path, output_path: &Path) -> Result<u64> {
    let input = fs::read(input_path)?;
    let output = File::create(output_path)?;
    let mut encoder = GzEncoder::new(output, Compression::default());
    encoder.write_all(&input)?;
    let output = encoder.finish()?;
    Ok(output.metadata()?.len())
}

pub fn compute_md5(path: &Path) -> Result<String> {
    let data = fs::read(path)?;
    let mut hasher = Md5::new();
    hasher.update(data);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

pub struct ArchiveGenerator {
    output_dir: PathBuf,
}

impl ArchiveGenerator {
    pub fn new<P: AsRef<Path>>(output_dir: P) -> Self {
        ArchiveGenerator {
            output_dir: output_dir.as_ref().to_path_buf(),
        }
    }

    pub fn generate_daily_archive(
        &self,
        date: &DateTime<Utc>,
        observations: &[Observation],
        archive_type: ArchiveType,
        station_id: &str,
        station_name: &str,
        latitude: f64,
        longitude: f64,
        elevation: Option<f64>,
    ) -> Result<ArchiveResult> {
        let date_str = date.format("%Y%m%d");
        let type_str = match archive_type {
            ArchiveType::Micaps1 => "micaps1",
            ArchiveType::Micaps11 => "micaps11",
            ArchiveType::Bufr4 => "bufr4",
        };

        let station_dir = self.output_dir.join(station_id);
        fs::create_dir_all(&station_dir)?;

        let file_name = format!("{}_{}_{}.dat", station_id, date_str, type_str);
        let raw_path = station_dir.join(&file_name);

        let count = match archive_type {
            ArchiveType::Micaps1 => generate_micaps1(
                observations,
                &raw_path,
                station_id,
                station_name,
                latitude,
                longitude,
                elevation,
            )?,
            ArchiveType::Micaps11 => {
                generate_micaps11(observations, &raw_path, station_id, station_name)?
            }
            ArchiveType::Bufr4 => generate_bufr4(observations, &raw_path, station_id)?,
        };

        let gz_path = station_dir.join(format!("{}.gz", file_name));
        let file_size = gzip_file(&raw_path, &gz_path)?;
        fs::remove_file(&raw_path)?;

        let md5 = compute_md5(&gz_path)?;

        Ok(ArchiveResult {
            file_path: gz_path,
            record_count: count,
            md5_checksum: md5,
            file_size,
        })
    }

    pub fn generate_manifest(&self, results: &[ArchiveResult], manifest_path: &Path) -> Result<()> {
        let mut writer = File::create(manifest_path)?;
        writeln!(writer, "# Archive Manifest")?;
        writeln!(writer, "# Generated: {}", Utc::now().to_rfc3339())?;
        writeln!(writer)?;

        for result in results {
            let file_name = result
                .file_path
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            writeln!(
                writer,
                "{} {} {} {}",
                result.md5_checksum, result.file_size, result.record_count, file_name
            )?;
        }

        Ok(())
    }
}

pub fn archive_period(
    conn: &rusqlite::Connection,
    config: &crate::config::AppConfig,
    start_date: &DateTime<Utc>,
    end_date: &DateTime<Utc>,
    archive_type: ArchiveType,
    output_dir: &Path,
    period: ArchivePeriod,
    station_ids: Option<&[String]>,
) -> Result<Vec<ArchiveResult>> {
    let mut stmt = conn.prepare(
        "SELECT id, station_id, obs_time, temperature, pressure, relative_humidity,
         wind_speed, wind_direction, precipitation, visibility, raw_data, source_file, qc_status
         FROM observations
         WHERE obs_time >= ?1 AND obs_time < ?2
         AND (qc_status = 'passed' OR qc_status = 'overridden_pass')
         ORDER BY station_id, obs_time ASC",
    )?;

    let mut rows = stmt.query(params![
        start_date.to_rfc3339(),
        end_date.to_rfc3339()
    ])?;

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

    if observations.is_empty() {
        return Ok(Vec::new());
    }

    let mut grouped: HashMap<String, Vec<Observation>> = HashMap::new();
    for obs in observations {
        grouped
            .entry(obs.station_id.clone())
            .or_default()
            .push(obs);
    }

    let generator = ArchiveGenerator::new(output_dir);
    let mut all_results = Vec::new();

    for (sid, station_obs) in &grouped {
        if let Some(filter_stations) = station_ids {
            if !filter_stations.iter().any(|s| s == sid) {
                continue;
            }
        }

        let station_config = config.get_station(sid);
        let station_name = station_config.map(|s| s.name.as_str()).unwrap_or(sid);
        let lat = station_config.map(|s| s.latitude).unwrap_or(0.0);
        let lon = station_config.map(|s| s.longitude).unwrap_or(0.0);
        let elev = station_config.and_then(|s| s.elevation);

        match period {
            ArchivePeriod::Daily => {
                let mut current_date = *start_date;
                while current_date < *end_date {
                    let next_day = current_date + Duration::days(1);
                    let day_obs: Vec<Observation> = station_obs
                        .iter()
                        .filter(|o| o.obs_time >= current_date && o.obs_time < next_day)
                        .cloned()
                        .collect();

                    if !day_obs.is_empty() {
                        let result = generator.generate_daily_archive(
                            &current_date,
                            &day_obs,
                            archive_type,
                            sid,
                            station_name,
                            lat,
                            lon,
                            elev,
                        )?;
                        all_results.push(result);
                    }

                    current_date = next_day;
                }
            }
            ArchivePeriod::Monthly => {}
        }
    }

    Ok(all_results)
}
