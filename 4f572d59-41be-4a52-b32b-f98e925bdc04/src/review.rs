use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use colored::*;
use std::collections::HashMap;
use std::fmt::Write;

use crate::db::QcStatus;

#[derive(Debug, Clone)]
pub struct ReviewOverride {
    pub id: Option<i64>,
    pub observation_id: i64,
    pub original_status: String,
    pub new_status: String,
    pub reason: Option<String>,
    pub operator: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Default, Clone)]
pub struct QcReport {
    pub total_records: i64,
    pub passed: i64,
    pub suspect: i64,
    pub failed: i64,
    pub pending: i64,
    pub pass_rate: f64,
    pub suspect_rate: f64,
    pub fail_rate: f64,
    pub station_stats: HashMap<String, StationQcStats>,
    pub element_stats: HashMap<String, ElementQcDetail>,
}

#[derive(Debug, Default, Clone)]
pub struct StationQcStats {
    pub station_id: String,
    pub station_name: String,
    pub total: i64,
    pub passed: i64,
    pub suspect: i64,
    pub failed: i64,
    pub pass_rate: f64,
}

#[derive(Debug, Default, Clone)]
pub struct ElementQcDetail {
    pub element: String,
    pub total: i64,
    pub pass: i64,
    pub suspect: i64,
    pub fail: i64,
    pub missing: i64,
}

pub fn override_qc_status(
    conn: &rusqlite::Connection,
    observation_id: i64,
    new_status: &QcStatus,
    reason: Option<&str>,
    operator: &str,
    dry_run: bool,
) -> Result<()> {
    let original_status: String = conn.query_row(
        "SELECT qc_status FROM observations WHERE id = ?1",
        params![observation_id],
        |row| row.get(0),
    )?;

    if !dry_run {
        let tx = conn.unchecked_transaction()?;

        tx.execute(
            "INSERT INTO review_overrides
             (observation_id, original_status, new_status, reason, operator)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                observation_id,
                original_status,
                new_status.as_str(),
                reason,
                operator
            ],
        )?;

        tx.execute(
            "UPDATE observations SET qc_status = ?1 WHERE id = ?2",
            params![new_status.as_str(), observation_id],
        )?;

        tx.commit()?;
    }

    Ok(())
}

pub fn batch_override_by_range(
    conn: &rusqlite::Connection,
    station_id: Option<&str>,
    start_time: &DateTime<Utc>,
    end_time: &DateTime<Utc>,
    from_status: &QcStatus,
    to_status: &QcStatus,
    reason: Option<&str>,
    operator: &str,
    dry_run: bool,
) -> Result<i64> {
    let sql = match station_id {
        Some(_sid) => {
            "SELECT id, qc_status FROM observations
             WHERE station_id = ?1 AND obs_time >= ?2 AND obs_time <= ?3 AND qc_status = ?4"
        }
        None => {
            "SELECT id, qc_status FROM observations
             WHERE obs_time >= ?1 AND obs_time <= ?2 AND qc_status = ?3"
        }
    };

    let mut stmt = conn.prepare(sql)?;

    let mut rows = match station_id {
        Some(sid) => stmt.query(params![
            sid,
            start_time.to_rfc3339(),
            end_time.to_rfc3339(),
            from_status.as_str()
        ])?,
        None => stmt.query(params![
            start_time.to_rfc3339(),
            end_time.to_rfc3339(),
            from_status.as_str()
        ])?,
    };

    let mut ids = Vec::new();
    while let Some(row) = rows.next()? {
        let id: i64 = row.get(0)?;
        ids.push(id);
    }
    drop(rows);
    drop(stmt);

    let count = ids.len() as i64;

    if !dry_run {
        let tx = conn.unchecked_transaction()?;

        for &id in &ids {
            tx.execute(
                "INSERT INTO review_overrides
                 (observation_id, original_status, new_status, reason, operator)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    id,
                    from_status.as_str(),
                    to_status.as_str(),
                    reason,
                    operator
                ],
            )?;

            tx.execute(
                "UPDATE observations SET qc_status = ?1 WHERE id = ?2",
                params![to_status.as_str(), id],
            )?;
        }

        tx.commit()?;
    }

    Ok(count)
}

pub fn generate_qc_report(
    conn: &rusqlite::Connection,
    station_ids: Option<&[String]>,
    start_time: Option<&DateTime<Utc>>,
    end_time: Option<&DateTime<Utc>>,
) -> Result<QcReport> {
    let mut report = QcReport::default();

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    let mut param_index = 1;

    if let Some(stations) = station_ids {
        let placeholders: Vec<String> = stations
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", param_index + i))
            .collect();
        where_clauses.push(format!(
            "station_id IN ({})",
            placeholders.join(", ")
        ));
        param_index += stations.len();
        params.extend(stations.iter().cloned());
    }

    if let Some(start) = start_time {
        where_clauses.push(format!("obs_time >= ?{}", param_index));
        params.push(start.to_rfc3339());
        param_index += 1;
    }

    if let Some(end) = end_time {
        where_clauses.push(format!("obs_time <= ?{}", param_index));
        params.push(end.to_rfc3339());
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!(
        "SELECT qc_status, COUNT(*) as cnt FROM observations {} GROUP BY qc_status",
        where_sql
    );

    let mut stmt = conn.prepare(&count_sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> =
        params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let mut rows = stmt.query(param_refs.as_slice())?;

    let mut total = 0i64;
    while let Some(row) = rows.next()? {
        let status: String = row.get(0)?;
        let count: i64 = row.get(1)?;
        total += count;

        match status.as_str() {
            "passed" | "overridden_pass" => report.passed += count,
            "suspect" => report.suspect += count,
            "failed" | "overridden_fail" => report.failed += count,
            "pending" => report.pending += count,
            _ => {}
        }
    }
    report.total_records = total;

    if total > 0 {
        report.pass_rate = report.passed as f64 / total as f64;
        report.suspect_rate = report.suspect as f64 / total as f64;
        report.fail_rate = report.failed as f64 / total as f64;
    }

    let station_sql = format!(
        "SELECT station_id, qc_status, COUNT(*) as cnt FROM observations {} GROUP BY station_id, qc_status ORDER BY station_id",
        where_sql
    );

    let mut stmt = conn.prepare(&station_sql)?;
    let param_refs2: Vec<&dyn rusqlite::ToSql> =
        params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let mut rows = stmt.query(param_refs2.as_slice())?;

    while let Some(row) = rows.next()? {
        let station_id: String = row.get(0)?;
        let status: String = row.get(1)?;
        let count: i64 = row.get(2)?;

        let stats = report
            .station_stats
            .entry(station_id.clone())
            .or_insert_with(|| StationQcStats {
                station_id: station_id.clone(),
                station_name: station_id.clone(),
                total: 0,
                passed: 0,
                suspect: 0,
                failed: 0,
                pass_rate: 0.0,
            });

        stats.total += count;
        match status.as_str() {
            "passed" | "overridden_pass" => stats.passed += count,
            "suspect" => stats.suspect += count,
            "failed" | "overridden_fail" => stats.failed += count,
            _ => {}
        }
    }

    for stats in report.station_stats.values_mut() {
        if stats.total > 0 {
            stats.pass_rate = stats.passed as f64 / stats.total as f64;
        }
    }

    Ok(report)
}

pub fn format_qc_report(report: &QcReport) -> Result<String> {
    let mut output = String::new();

    writeln!(output, "{}", "=== 数据质量审核报告 ===".bold().underline())?;
    writeln!(output)?;

    writeln!(output, "{}", "总体统计:".bold())?;
    writeln!(output, "  总记录数: {}", report.total_records)?;
    writeln!(
        output,
        "  通过: {} ({:.2}%)",
        report.passed.to_string().green(),
        report.pass_rate * 100.0
    )?;
    writeln!(
        output,
        "  可疑: {} ({:.2}%)",
        report.suspect.to_string().yellow(),
        report.suspect_rate * 100.0
    )?;
    writeln!(
        output,
        "  错误: {} ({:.2}%)",
        report.failed.to_string().red(),
        report.fail_rate * 100.0
    )?;
    writeln!(output, "  待审: {}", report.pending)?;
    writeln!(output)?;

    if !report.station_stats.is_empty() {
        writeln!(output, "{}", "各站点统计:".bold())?;

        let headers = vec!["站点ID", "总记录", "通过", "可疑", "错误", "通过率"];
        let mut rows: Vec<Vec<String>> = Vec::new();

        let mut stations: Vec<&StationQcStats> = report.station_stats.values().collect();
        stations.sort_by(|a, b| a.station_id.cmp(&b.station_id));

        for stats in stations {
            let pass_str = format!("{:.1}%", stats.pass_rate * 100.0);
            let pass_display = if stats.pass_rate >= 0.95 {
                pass_str.green().to_string()
            } else if stats.pass_rate >= 0.85 {
                pass_str.yellow().to_string()
            } else {
                pass_str.red().to_string()
            };

            rows.push(vec![
                stats.station_id.clone(),
                stats.total.to_string(),
                stats.passed.to_string(),
                stats.suspect.to_string(),
                stats.failed.to_string(),
                pass_display,
            ]);
        }

        let mut col_widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
        for row in &rows {
            for (i, cell) in row.iter().enumerate() {
                let plain_len = strip_ansi_len(cell);
                if plain_len > col_widths[i] {
                    col_widths[i] = plain_len;
                }
            }
        }

        for (i, header) in headers.iter().enumerate() {
            write!(output, "  {:<width$}  ", header, width = col_widths[i])?;
        }
        writeln!(output)?;

        for width in &col_widths {
            write!(output, "  {}  ", "-".repeat(*width))?;
        }
        writeln!(output)?;

        for row in &rows {
            for (i, cell) in row.iter().enumerate() {
                let plain_len = strip_ansi_len(cell);
                let pad = col_widths[i].saturating_sub(plain_len);
                write!(output, "  {}{}  ", cell, " ".repeat(pad))?;
            }
            writeln!(output)?;
        }
    }

    Ok(output)
}

fn strip_ansi_len(s: &str) -> usize {
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
            count += c.len_utf8();
        }
    }
    count
}

pub struct ReauditDiff {
    pub total_checked: i64,
    pub status_changed: i64,
    pub to_pass: i64,
    pub to_suspect: i64,
    pub to_fail: i64,
}

pub fn reaudit_range(
    conn: &rusqlite::Connection,
    config: &crate::config::AppConfig,
    station_id: Option<&str>,
    start_time: &DateTime<Utc>,
    end_time: &DateTime<Utc>,
    dry_run: bool,
) -> Result<ReauditDiff> {
    let _old_statuses: Vec<(i64, String)> = {
        let sql = match station_id {
            Some(_sid) => {
                "SELECT id, qc_status FROM observations
                 WHERE station_id = ?1 AND obs_time >= ?2 AND obs_time <= ?3
                 ORDER BY station_id, obs_time"
            }
            None => {
                "SELECT id, qc_status FROM observations
                 WHERE obs_time >= ?1 AND obs_time <= ?2
                 ORDER BY station_id, obs_time"
            }
        };

        let mut stmt = conn.prepare(sql)?;
        let mut rows = match station_id {
            Some(sid) => stmt.query(params![
                sid,
                start_time.to_rfc3339(),
                end_time.to_rfc3339()
            ])?,
            None => stmt.query(params![start_time.to_rfc3339(), end_time.to_rfc3339()])?,
        };

        let mut result = Vec::new();
        while let Some(row) = rows.next()? {
            result.push((row.get::<_, i64>(0)?, row.get::<_, String>(1)?));
        }
        result
    };

    let stats = crate::qc::run_qc_for_range(
        conn,
        config,
        station_id,
        start_time,
        end_time,
        dry_run,
    )?;

    let diff = ReauditDiff {
        total_checked: stats.total as i64,
        status_changed: 0,
        to_pass: stats.passed as i64,
        to_suspect: stats.suspect as i64,
        to_fail: stats.failed as i64,
    };

    Ok(diff)
}
