use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use colored::*;
use std::collections::HashMap;
use std::fmt::Write;

use crate::db::Observation;

#[derive(Debug, Clone)]
pub struct QueryFilter {
    pub station_ids: Vec<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub elements: Vec<String>,
    pub qc_status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl Default for QueryFilter {
    fn default() -> Self {
        QueryFilter {
            station_ids: Vec::new(),
            start_time: None,
            end_time: None,
            elements: Vec::new(),
            qc_status: None,
            limit: Some(1000),
            offset: None,
        }
    }
}

#[derive(Debug, Clone)]
pub enum OutputFormat {
    Table,
    Json,
    Csv,
}

pub fn query_observations(
    conn: &rusqlite::Connection,
    filter: &QueryFilter,
) -> Result<Vec<Observation>> {
    let mut sql = String::from(
        "SELECT id, station_id, obs_time, temperature, pressure, relative_humidity,
         wind_speed, wind_direction, precipitation, visibility, raw_data, source_file, qc_status
         FROM observations WHERE 1=1",
    );

    let mut params: Vec<String> = Vec::new();
    let mut param_index = 1;

    if !filter.station_ids.is_empty() {
        let placeholders: Vec<String> = filter
            .station_ids
            .iter()
            .enumerate()
            .map(|(i, _)| {
                let idx = param_index + i;
                format!("?{}", idx)
            })
            .collect();
        sql.push_str(&format!(" AND station_id IN ({})", placeholders.join(", ")));
        param_index += filter.station_ids.len();
        params.extend(filter.station_ids.iter().cloned());
    }

    if let Some(start) = &filter.start_time {
        sql.push_str(&format!(" AND obs_time >= ?{}", param_index));
        params.push(start.to_rfc3339());
        param_index += 1;
    }

    if let Some(end) = &filter.end_time {
        sql.push_str(&format!(" AND obs_time <= ?{}", param_index));
        params.push(end.to_rfc3339());
        param_index += 1;
    }

    if let Some(status) = &filter.qc_status {
        sql.push_str(&format!(" AND qc_status = ?{}", param_index));
        params.push(status.clone());
        param_index += 1;
    }

    if !filter.elements.is_empty() {
        let element_cols: Vec<String> = filter
            .elements
            .iter()
            .map(|e| match e.as_str() {
                "temperature" | "temp" => "temperature IS NOT NULL".to_string(),
                "pressure" | "pres" => "pressure IS NOT NULL".to_string(),
                "humidity" | "rh" | "relative_humidity" => "relative_humidity IS NOT NULL".to_string(),
                "wind_speed" | "ws" => "wind_speed IS NOT NULL".to_string(),
                "wind_direction" | "wd" => "wind_direction IS NOT NULL".to_string(),
                "precipitation" | "precip" | "rain" => "precipitation IS NOT NULL".to_string(),
                "visibility" | "vis" => "visibility IS NOT NULL".to_string(),
                _ => format!("{} IS NOT NULL", e),
            })
            .collect();
        sql.push_str(&format!(" AND ({})", element_cols.join(" OR ")));
    }

    sql.push_str(" ORDER BY obs_time DESC");

    if let Some(lim) = filter.limit {
        sql.push_str(&format!(" LIMIT {}", lim));
    }

    if let Some(off) = filter.offset {
        sql.push_str(&format!(" OFFSET {}", off));
    }

    let mut stmt = conn.prepare(&sql)?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let mut rows = stmt.query(param_refs.as_slice())?;

    let mut results = Vec::new();
    while let Some(row) = rows.next()? {
        let obs_time_str: String = row.get(2)?;
        let obs_time = DateTime::parse_from_rfc3339(&obs_time_str)?.with_timezone(&Utc);

        results.push(Observation {
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

    Ok(results)
}

pub fn format_output(observations: &[Observation], format: OutputFormat) -> Result<String> {
    match format {
        OutputFormat::Table => format_table(observations),
        OutputFormat::Json => format_json(observations),
        OutputFormat::Csv => format_csv(observations),
    }
}

fn format_table(observations: &[Observation]) -> Result<String> {
    if observations.is_empty() {
        return Ok("无匹配记录".to_string());
    }

    let headers = vec![
        "站点ID",
        "观测时间",
        "气温(℃)",
        "气压(hPa)",
        "湿度(%)",
        "风速(m/s)",
        "风向(°)",
        "降水(mm)",
        "能见度(m)",
        "审核状态",
    ];

    let mut rows: Vec<Vec<String>> = Vec::new();
    for obs in observations {
        let local_time = obs.obs_time + Duration::hours(8);
        let status = match obs.qc_status.as_str() {
            "passed" => "通过".green().to_string(),
            "suspect" => "可疑".yellow().to_string(),
            "failed" => "错误".red().to_string(),
            "pending" => "待审".blue().to_string(),
            s => s.to_string(),
        };

        rows.push(vec![
            obs.station_id.clone(),
            local_time.format("%Y-%m-%d %H:%M").to_string(),
            obs.temperature
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.pressure
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.relative_humidity
                .map(|v| format!("{:.0}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.wind_speed
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.wind_direction
                .map(|v| format!("{:.0}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.precipitation
                .map(|v| format!("{:.2}", v))
                .unwrap_or_else(|| "-".to_string()),
            obs.visibility
                .map(|v| format!("{:.0}", v))
                .unwrap_or_else(|| "-".to_string()),
            status,
        ]);
    }

    let mut col_widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            let plain_len = strip_color_len(cell);
            if plain_len > col_widths[i] {
                col_widths[i] = plain_len;
            }
        }
    }

    let mut output = String::new();

    for (i, header) in headers.iter().enumerate() {
        write!(output, "{:<width$}  ", header, width = col_widths[i])?;
    }
    writeln!(output)?;

    for width in &col_widths {
        write!(output, "{}  ", "-".repeat(*width))?;
    }
    writeln!(output)?;

    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            let plain_len = strip_color_len(cell);
            let pad = col_widths[i].saturating_sub(plain_len);
            write!(output, "{}{}  ", cell, " ".repeat(pad))?;
        }
        writeln!(output)?;
    }

    writeln!(output, "\n共 {} 条记录", observations.len())?;

    Ok(output)
}

fn strip_color_len(s: &str) -> usize {
    let mut count = 0;
    let mut in_escape = false;
    for c in s.chars() {
        if in_escape {
            if c == 'm' {
                in_escape = false;
            }
        } else if c == '\x1b' {
            in_escape = true;
        } else {
            count += 1;
        }
    }
    count
}

fn format_json(observations: &[Observation]) -> Result<String> {
    #[derive(serde::Serialize)]
    struct ObservationJson {
        station_id: String,
        obs_time: String,
        temperature: Option<f64>,
        pressure: Option<f64>,
        relative_humidity: Option<f64>,
        wind_speed: Option<f64>,
        wind_direction: Option<f64>,
        precipitation: Option<f64>,
        visibility: Option<f64>,
        qc_status: String,
    }

    let json_obs: Vec<ObservationJson> = observations
        .iter()
        .map(|obs| ObservationJson {
            station_id: obs.station_id.clone(),
            obs_time: (obs.obs_time + Duration::hours(8))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
            temperature: obs.temperature,
            pressure: obs.pressure,
            relative_humidity: obs.relative_humidity,
            wind_speed: obs.wind_speed,
            wind_direction: obs.wind_direction,
            precipitation: obs.precipitation,
            visibility: obs.visibility,
            qc_status: obs.qc_status.clone(),
        })
        .collect();

    Ok(serde_json::to_string_pretty(&json_obs)?)
}

fn format_csv(observations: &[Observation]) -> Result<String> {
    let mut wtr = csv::Writer::from_writer(Vec::new());

    wtr.write_record([
        "station_id",
        "obs_time",
        "temperature",
        "pressure",
        "relative_humidity",
        "wind_speed",
        "wind_direction",
        "precipitation",
        "visibility",
        "qc_status",
    ])?;

    for obs in observations {
        let local_time = obs.obs_time + Duration::hours(8);
        wtr.write_record([
            obs.station_id.as_str(),
            &local_time.format("%Y-%m-%d %H:%M:%S").to_string(),
            &obs.temperature.map(|v| v.to_string()).unwrap_or_default(),
            &obs.pressure.map(|v| v.to_string()).unwrap_or_default(),
            &obs
                .relative_humidity
                .map(|v| v.to_string())
                .unwrap_or_default(),
            &obs.wind_speed.map(|v| v.to_string()).unwrap_or_default(),
            &obs
                .wind_direction
                .map(|v| v.to_string())
                .unwrap_or_default(),
            &obs
                .precipitation
                .map(|v| v.to_string())
                .unwrap_or_default(),
            &obs.visibility.map(|v| v.to_string()).unwrap_or_default(),
            &obs.qc_status,
        ])?;
    }

    let result = String::from_utf8(wtr.into_inner()?)?;
    Ok(result)
}

#[derive(Debug, Default, Clone)]
pub struct DailyStats {
    pub date: String,
    pub station_id: String,
    pub temperature_avg: Option<f64>,
    pub temperature_max: Option<f64>,
    pub temperature_min: Option<f64>,
    pub pressure_avg: Option<f64>,
    pub humidity_avg: Option<f64>,
    pub wind_speed_avg: Option<f64>,
    pub precipitation_sum: Option<f64>,
    pub visibility_avg: Option<f64>,
    pub total_records: i64,
    pub missing_rate: f64,
    pub monthly_temp_max: Option<f64>,
    pub monthly_temp_min: Option<f64>,
    pub monthly_precip_sum: Option<f64>,
    pub monthly_humidity_max: Option<f64>,
    pub monthly_humidity_min: Option<f64>,
    pub monthly_wind_speed_max: Option<f64>,
}

pub fn compute_daily_stats(
    conn: &rusqlite::Connection,
    filter: &QueryFilter,
) -> Result<Vec<DailyStats>> {
    let mut sql = String::from(
        "SELECT
            strftime('%Y-%m-%d', obs_time) as date,
            station_id,
            AVG(temperature) as temp_avg,
            MAX(temperature) as temp_max,
            MIN(temperature) as temp_min,
            AVG(pressure) as pres_avg,
            AVG(relative_humidity) as rh_avg,
            AVG(wind_speed) as ws_avg,
            SUM(precipitation) as precip_sum,
            AVG(visibility) as vis_avg,
            COUNT(*) as total_count,
            SUM(CASE WHEN temperature IS NULL THEN 1 ELSE 0 END) as temp_missing
         FROM observations
         WHERE 1=1",
    );

    let mut params: Vec<String> = Vec::new();
    let mut param_index = 1;

    if !filter.station_ids.is_empty() {
        let placeholders: Vec<String> = filter
            .station_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", param_index + i))
            .collect();
        sql.push_str(&format!(" AND station_id IN ({})", placeholders.join(", ")));
        param_index += filter.station_ids.len();
        params.extend(filter.station_ids.iter().cloned());
    }

    if let Some(start) = &filter.start_time {
        sql.push_str(&format!(" AND obs_time >= ?{}", param_index));
        params.push(start.to_rfc3339());
        param_index += 1;
    }

    if let Some(end) = &filter.end_time {
        sql.push_str(&format!(" AND obs_time <= ?{}", param_index));
        params.push(end.to_rfc3339());
        param_index += 1;
    }

    sql.push_str(" GROUP BY date, station_id ORDER BY date DESC, station_id");

    let mut stmt = conn.prepare(&sql)?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let mut rows = stmt.query(param_refs.as_slice())?;

    let mut results = Vec::new();
    while let Some(row) = rows.next()? {
        let total: i64 = row.get(10)?;
        let temp_missing: i64 = row.get(11)?;
        let missing_rate = if total > 0 {
            temp_missing as f64 / total as f64
        } else {
            0.0
        };

        results.push(DailyStats {
            date: row.get(0)?,
            station_id: row.get(1)?,
            temperature_avg: row.get(2)?,
            temperature_max: row.get(3)?,
            temperature_min: row.get(4)?,
            pressure_avg: row.get(5)?,
            humidity_avg: row.get(6)?,
            wind_speed_avg: row.get(7)?,
            precipitation_sum: row.get(8)?,
            visibility_avg: row.get(9)?,
            total_records: total,
            missing_rate,
            monthly_temp_max: None,
            monthly_temp_min: None,
            monthly_precip_sum: None,
            monthly_humidity_max: None,
            monthly_humidity_min: None,
            monthly_wind_speed_max: None,
        });
    }

    fill_monthly_extremes(conn, filter, &mut results)?;

    Ok(results)
}

fn fill_monthly_extremes(
    conn: &rusqlite::Connection,
    filter: &QueryFilter,
    results: &mut [DailyStats],
) -> Result<()> {
    let mut sql = String::from(
        "SELECT
            strftime('%Y-%m', obs_time) as month,
            station_id,
            MAX(temperature) as m_temp_max,
            MIN(temperature) as m_temp_min,
            SUM(precipitation) as m_precip_sum,
            MAX(relative_humidity) as m_rh_max,
            MIN(relative_humidity) as m_rh_min,
            MAX(wind_speed) as m_ws_max
         FROM observations
         WHERE 1=1",
    );

    let mut params: Vec<String> = Vec::new();
    let mut param_index = 1;

    if !filter.station_ids.is_empty() {
        let placeholders: Vec<String> = filter
            .station_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", param_index + i))
            .collect();
        sql.push_str(&format!(" AND station_id IN ({})", placeholders.join(", ")));
        param_index += filter.station_ids.len();
        params.extend(filter.station_ids.iter().cloned());
    }

    if let Some(start) = &filter.start_time {
        sql.push_str(&format!(" AND obs_time >= ?{}", param_index));
        params.push(start.to_rfc3339());
        param_index += 1;
    }

    if let Some(end) = &filter.end_time {
        sql.push_str(&format!(" AND obs_time <= ?{}", param_index));
        params.push(end.to_rfc3339());
    }

    sql.push_str(" GROUP BY month, station_id");

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();
    let mut rows = stmt.query(param_refs.as_slice())?;

    let mut monthly_map: HashMap<String, (Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<f64>)> = HashMap::new();

    while let Some(row) = rows.next()? {
        let month: String = row.get(0)?;
        let station_id: String = row.get(1)?;
        let key = format!("{}|{}", month, station_id);
        monthly_map.insert(key, (
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
        ));
    }

    for stat in results.iter_mut() {
        if stat.date.len() >= 7 {
            let month = &stat.date[..7];
            let key = format!("{}|{}", month, stat.station_id);
            if let Some((t_max, t_min, precip, rh_max, rh_min, ws_max)) = monthly_map.get(&key) {
                stat.monthly_temp_max = *t_max;
                stat.monthly_temp_min = *t_min;
                stat.monthly_precip_sum = *precip;
                stat.monthly_humidity_max = *rh_max;
                stat.monthly_humidity_min = *rh_min;
                stat.monthly_wind_speed_max = *ws_max;
            }
        }
    }

    Ok(())
}

pub fn format_stats_table(stats: &[DailyStats]) -> Result<String> {
    if stats.is_empty() {
        return Ok("无统计数据".to_string());
    }

    let headers = vec![
        "日期",
        "站点",
        "均温(℃)",
        "最高温(℃)",
        "最低温(℃)",
        "均压(hPa)",
        "均湿(%)",
        "风速(m/s)",
        "降水(mm)",
        "缺测率",
        "记录数",
        "月最高温(℃)",
        "月最低温(℃)",
        "月降水(mm)",
    ];

    let mut rows: Vec<Vec<String>> = Vec::new();
    for s in stats {
        let missing_pct = format!("{:.1}%", s.missing_rate * 100.0);
        let missing_display = if s.missing_rate > 0.05 {
            missing_pct.red().to_string()
        } else if s.missing_rate > 0.02 {
            missing_pct.yellow().to_string()
        } else {
            missing_pct.green().to_string()
        };

        rows.push(vec![
            s.date.clone(),
            s.station_id.clone(),
            s.temperature_avg
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.temperature_max
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.temperature_min
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.pressure_avg
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.humidity_avg
                .map(|v| format!("{:.0}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.wind_speed_avg
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.precipitation_sum
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "0.0".to_string()),
            missing_display,
            s.total_records.to_string(),
            s.monthly_temp_max
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.monthly_temp_min
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
            s.monthly_precip_sum
                .map(|v| format!("{:.1}", v))
                .unwrap_or_else(|| "-".to_string()),
        ]);
    }

    let mut col_widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            let plain_len = strip_color_len(cell);
            if plain_len > col_widths[i] {
                col_widths[i] = plain_len;
            }
        }
    }

    let mut output = String::new();

    for (i, header) in headers.iter().enumerate() {
        write!(output, "{:<width$}  ", header, width = col_widths[i])?;
    }
    writeln!(output)?;

    for width in &col_widths {
        write!(output, "{}  ", "-".repeat(*width))?;
    }
    writeln!(output)?;

    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            let plain_len = strip_color_len(cell);
            let pad = col_widths[i].saturating_sub(plain_len);
            write!(output, "{}{}  ", cell, " ".repeat(pad))?;
        }
        writeln!(output)?;
    }

    writeln!(output, "\n共 {} 条统计记录", stats.len())?;

    Ok(output)
}
