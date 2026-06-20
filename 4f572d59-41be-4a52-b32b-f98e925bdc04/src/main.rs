use anyhow::{Context, Result};
use chrono::{DateTime, Duration, TimeZone, Utc};
use colored::*;
use log::LevelFilter;
use std::path::PathBuf;
use structopt::StructOpt;

mod archive;
mod config;
mod db;
mod import;
mod qc;
mod query;
mod review;

use config::AppConfig;
use db::Database;

#[derive(Debug, StructOpt)]
#[structopt(
    name = "meteoc",
    about = "气象探测数据质量审核与归档系统",
    version = "0.1.0"
)]
struct Cli {
    #[structopt(
        short,
        long,
        global = true,
        help = "配置文件路径",
        default_value = "config.json"
    )]
    config: PathBuf,

    #[structopt(
        short,
        long,
        global = true,
        help = "数据库路径",
        default_value = "meteoc.db"
    )]
    database: PathBuf,

    #[structopt(short, long, global = true, help = "详细日志输出")]
    verbose: bool,

    #[structopt(long, global = true, help = "预览模式，不写入数据库")]
    dry_run: bool,

    #[structopt(subcommand)]
    command: Command,
}

#[derive(Debug, StructOpt)]
enum Command {
    #[structopt(about = "导入观测数据文件")]
    Import {
        #[structopt(help = "数据文件或目录路径")]
        path: PathBuf,

        #[structopt(short, long, help = "站点ID")]
        station: Option<String>,

        #[structopt(short, long, help = "递归导入目录下的所有文件")]
        recursive: bool,
    },

    #[structopt(about = "执行数据质量控制审核")]
    Qc {
        #[structopt(short, long, help = "站点ID列表，逗号分隔")]
        stations: Option<String>,

        #[structopt(short, long, help = "开始时间 (YYYY-MM-DD HH:MM:SS)")]
        start: Option<String>,

        #[structopt(short, long, help = "结束时间 (YYYY-MM-DD HH:MM:SS)")]
        end: Option<String>,

        #[structopt(long, help = "审核所有待审数据")]
        all: bool,
    },

    #[structopt(about = "生成归档文件")]
    Archive {
        #[structopt(
            short,
            long,
            help = "归档类型: micaps1, micaps11, bufr4",
            default_value = "micaps1"
        )]
        r#type: String,

        #[structopt(short, long, help = "归档周期: daily, monthly", default_value = "daily")]
        period: String,

        #[structopt(short, long, help = "站点ID列表，逗号分隔")]
        stations: Option<String>,

        #[structopt(short, long, help = "开始日期 (YYYY-MM-DD)")]
        start: Option<String>,

        #[structopt(short, long, help = "结束日期 (YYYY-MM-DD)")]
        end: Option<String>,

        #[structopt(short, long, help = "输出目录", default_value = "./archive")]
        output: PathBuf,
    },

    #[structopt(about = "查询历史数据")]
    Query {
        #[structopt(short, long, help = "站点ID列表，逗号分隔")]
        stations: Option<String>,

        #[structopt(short, long, help = "开始时间 (YYYY-MM-DD HH:MM:SS)")]
        start: Option<String>,

        #[structopt(short, long, help = "结束时间 (YYYY-MM-DD HH:MM:SS)")]
        end: Option<String>,

        #[structopt(short, long, help = "要素类型列表，逗号分隔")]
        elements: Option<String>,

        #[structopt(short = "s", long, help = "审核状态过滤: pending, passed, suspect, failed")]
        qc_status: Option<String>,

        #[structopt(
            short,
            long,
            help = "输出格式: table, json, csv",
            default_value = "table"
        )]
        format: String,

        #[structopt(short, long, help = "最大返回记录数", default_value = "1000")]
        limit: i64,

        #[structopt(long, help = "统计模式: daily")]
        stats: Option<String>,
    },

    #[structopt(about = "站点与系统配置管理")]
    Config {
        #[structopt(subcommand)]
        subcommand: ConfigCommand,
    },

    #[structopt(about = "审核结果人工覆写与报告")]
    Review {
        #[structopt(subcommand)]
        subcommand: ReviewCommand,
    },
}

#[derive(Debug, StructOpt)]
enum ConfigCommand {
    #[structopt(about = "显示当前配置")]
    Show,

    #[structopt(about = "添加或更新站点配置")]
    AddStation {
        #[structopt(help = "站点ID")]
        id: String,

        #[structopt(help = "站点名称")]
        name: String,

        #[structopt(help = "纬度")]
        latitude: f64,

        #[structopt(help = "经度")]
        longitude: f64,

        #[structopt(short, long, help = "海拔高度(米)")]
        elevation: Option<f64>,

        #[structopt(short, long, help = "仪器型号")]
        instrument: Option<String>,
    },

    #[structopt(about = "删除站点配置")]
    RemoveStation {
        #[structopt(help = "站点ID")]
        id: String,
    },

    #[structopt(about = "列出所有站点")]
    ListStations,

    #[structopt(about = "导出配置到文件")]
    Export {
        #[structopt(help = "导出文件路径")]
        path: PathBuf,
    },

    #[structopt(about = "从文件导入配置")]
    Import {
        #[structopt(help = "导入文件路径")]
        path: PathBuf,
    },

    #[structopt(about = "添加邻近站点关系")]
    AddNeighbor {
        #[structopt(help = "站点ID")]
        station_id: String,

        #[structopt(help = "邻近站点ID")]
        neighbor_id: String,

        #[structopt(short, long, help = "距离(公里)")]
        distance: Option<f64>,
    },

    #[structopt(about = "删除邻近站点关系")]
    RemoveNeighbor {
        #[structopt(help = "站点ID")]
        station_id: String,

        #[structopt(help = "邻近站点ID")]
        neighbor_id: String,
    },

    #[structopt(about = "查询站点的邻近站点列表")]
    ListNeighbors {
        #[structopt(help = "站点ID")]
        station_id: String,
    },
}

#[derive(Debug, StructOpt)]
enum ReviewCommand {
    #[structopt(about = "生成审核报告")]
    Report {
        #[structopt(short, long, help = "站点ID列表，逗号分隔")]
        stations: Option<String>,

        #[structopt(short, long, help = "开始时间")]
        start: Option<String>,

        #[structopt(short, long, help = "结束时间")]
        end: Option<String>,
    },

    #[structopt(about = "人工覆写单条记录审核状态")]
    Override {
        #[structopt(help = "记录ID")]
        id: i64,

        #[structopt(help = "新状态: passed, failed")]
        status: String,

        #[structopt(short, long, help = "覆写原因")]
        reason: Option<String>,

        #[structopt(short, long, help = "操作人")]
        operator: String,
    },

    #[structopt(about = "批量覆写指定范围的审核状态")]
    BatchOverride {
        #[structopt(short, long, help = "站点ID")]
        station: Option<String>,

        #[structopt(short, long, help = "开始时间")]
        start: String,

        #[structopt(short, long, help = "结束时间")]
        end: String,

        #[structopt(long, help = "原状态")]
        from: String,

        #[structopt(long, help = "新状态")]
        to: String,

        #[structopt(short, long, help = "覆写原因")]
        reason: Option<String>,

        #[structopt(short, long, help = "操作人")]
        operator: String,
    },

    #[structopt(about = "对指定时间范围数据重新审核")]
    Reaudit {
        #[structopt(short, long, help = "站点ID")]
        station: Option<String>,

        #[structopt(short, long, help = "开始时间")]
        start: String,

        #[structopt(short, long, help = "结束时间")]
        end: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::from_args();

    init_logger(cli.verbose);

    let config = AppConfig::load(&cli.config).unwrap_or_else(|e| {
        log::warn!("加载配置文件失败: {}，使用默认配置", e);
        AppConfig::default()
    });

    let db = Database::open(&cli.database)
        .with_context(|| format!("打开数据库失败: {}", cli.database.display()))?;

    let conn = db.conn.lock().unwrap();

    match &cli.command {
        Command::Import {
            path,
            station,
            recursive,
        } => {
            handle_import(&conn, &config, path, station.as_deref(), *recursive, cli.dry_run)?;
        }
        Command::Qc {
            stations,
            start,
            end,
            all,
        } => {
            handle_qc(&conn, &config, stations.as_deref(), start.as_deref(), end.as_deref(), *all, cli.dry_run)?;
        }
        Command::Archive {
            r#type,
            period,
            stations,
            start,
            end,
            output,
        } => {
            handle_archive(&conn, &config, r#type, period, stations.as_deref(), start.as_deref(), end.as_deref(), output, cli.dry_run)?;
        }
        Command::Query {
            stations,
            start,
            end,
            elements,
            qc_status,
            format,
            limit,
            stats,
        } => {
            handle_query(&conn, stations.as_deref(), start.as_deref(), end.as_deref(), elements.as_deref(), qc_status.as_deref(), format, *limit, stats.as_deref())?;
        }
        Command::Config { subcommand } => {
            handle_config(&conn, &config, subcommand, &cli.config)?;
        }
        Command::Review { subcommand } => {
            handle_review(&conn, &config, subcommand, cli.dry_run)?;
        }
    }

    Ok(())
}

fn init_logger(verbose: bool) {
    let level = if verbose {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };

    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .filter_level(level)
        .format_timestamp(None)
        .format_target(false)
        .init();
}

fn handle_import(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    path: &std::path::Path,
    station_id: Option<&str>,
    recursive: bool,
    dry_run: bool,
) -> Result<()> {
    println!("{}", "=== 数据导入 ===".bold());

    let metadata = std::fs::metadata(path)?;

    let stats = if metadata.is_dir() || recursive {
        import::import_directory(path, station_id, config, conn, dry_run)
    } else {
        let sid = station_id
            .or_else(|| import::infer_station_from_filename(path, config))
            .unwrap_or("unknown");

        let station_config = config
            .get_station(sid)
            .cloned()
            .unwrap_or_else(|| default_station_config(sid));

        import::import_file(path, sid, &station_config, conn, dry_run).map(|s| s)
    }?;

    println!();
    println!("  总记录数: {}", stats.total);
    println!("  成功导入: {}", stats.imported.to_string().green());
    println!("  重复记录: {}", stats.duplicates.to_string().yellow());
    println!("  错误记录: {}", stats.errors.to_string().red());

    if !stats.error_details.is_empty() {
        println!();
        println!("  错误详情 (前{}条):", stats.error_details.len().min(10));
        for err in stats.error_details.iter().take(10) {
            println!("    - {}", err);
        }
    }

    if dry_run {
        println!();
        println!("{}", "  [预览模式] 未实际写入数据库".yellow());
    }

    Ok(())
}

fn default_station_config(id: &str) -> config::StationConfig {
    config::StationConfig {
        id: id.to_string(),
        name: format!("Station {}", id),
        latitude: 0.0,
        longitude: 0.0,
        elevation: None,
        instrument_model: None,
        timezone: "Asia/Shanghai".to_string(),
        csv_column_mapping: std::collections::HashMap::new(),
        unit_mapping: std::collections::HashMap::new(),
        neighbors: Vec::new(),
        qc_thresholds: std::collections::HashMap::new(),
    }
}

fn handle_qc(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    stations: Option<&str>,
    start: Option<&str>,
    end: Option<&str>,
    all: bool,
    dry_run: bool,
) -> Result<()> {
    println!("{}", "=== 数据质量控制 ===".bold());

    let station_list = parse_station_list(stations);

    let (start_time, end_time) = parse_time_range(start, end)?;

    println!("  时间范围: {} ~ {}",
        start_time.format("%Y-%m-%d %H:%M"),
        end_time.format("%Y-%m-%d %H:%M"));

    if let Some(ref sids) = station_list {
        println!("  站点: {}", sids.join(", "));
    }

    if all {
        println!("  模式: {}", "审核所有状态数据".cyan());
    }

    println!();

    let stats = qc::run_qc_for_range(conn, config, station_list.as_deref(), &start_time, &end_time, dry_run, all)?;

    println!("  总记录数: {}", stats.total);
    println!("  通过: {} ({:.1}%)", stats.passed.to_string().green(), if stats.total > 0 { stats.passed as f64 / stats.total as f64 * 100.0 } else { 0.0 });
    println!("  可疑: {} ({:.1}%)", stats.suspect.to_string().yellow(), if stats.total > 0 { stats.suspect as f64 / stats.total as f64 * 100.0 } else { 0.0 });
    println!("  错误: {} ({:.1}%)", stats.failed.to_string().red(), if stats.total > 0 { stats.failed as f64 / stats.total as f64 * 100.0 } else { 0.0 });

    if !stats.element_stats.is_empty() {
        println!();
        println!("  各要素统计:");
        for (elem, estat) in &stats.element_stats {
            println!("    {:<20} 总数:{} 通过:{} 可疑:{} 错误:{} 缺测:{}",
                elem, estat.total,
                estat.pass.to_string().green(),
                estat.suspect.to_string().yellow(),
                estat.fail.to_string().red(),
                estat.missing);
        }
    }

    if dry_run {
        println!();
        println!("{}", "  [预览模式] 未实际写入数据库".yellow());
    }

    Ok(())
}

fn handle_archive(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    archive_type: &str,
    period: &str,
    stations: Option<&str>,
    start: Option<&str>,
    end: Option<&str>,
    output: &std::path::Path,
    dry_run: bool,
) -> Result<()> {
    println!("{}", "=== 归档文件生成 ===".bold());

    let atype = match archive_type.to_lowercase().as_str() {
        "micaps1" => archive::ArchiveType::Micaps1,
        "micaps11" => archive::ArchiveType::Micaps11,
        "bufr4" => archive::ArchiveType::Bufr4,
        _ => anyhow::bail!("不支持的归档类型: {}", archive_type),
    };

    let aperiod = match period.to_lowercase().as_str() {
        "daily" => archive::ArchivePeriod::Daily,
        "monthly" => archive::ArchivePeriod::Monthly,
        _ => anyhow::bail!("不支持的归档周期: {}", period),
    };

    let (start_time, end_time) = parse_time_range(start, end)?;
    let station_list = parse_station_list(stations);

    println!("  归档类型: {}", archive_type);
    println!("  归档周期: {}", period);
    println!("  时间范围: {} ~ {}",
        start_time.format("%Y-%m-%d"),
        end_time.format("%Y-%m-%d"));
    println!("  输出目录: {}", output.display());
    println!();

    if dry_run {
        println!("{}", "  [预览模式] 未实际生成文件".yellow());
        return Ok(());
    }

    let results = archive::archive_period(
        conn,
        config,
        &start_time,
        &end_time,
        atype,
        output,
        aperiod,
        station_list.as_deref(),
    )?;

    let total_records: usize = results.iter().map(|r| r.record_count).sum();
    let total_size: u64 = results.iter().map(|r| r.file_size).sum();

    println!("  生成文件数: {}", results.len());
    println!("  总记录数: {}", total_records);
    println!("  总大小: {:.2} KB", total_size as f64 / 1024.0);

    if !results.is_empty() {
        println!();
        println!("  文件列表:");
        for r in results.iter().take(10) {
            let fname = r.file_path.file_name().and_then(|f| f.to_str()).unwrap_or("");
            println!("    {} - {} 条, MD5: {}",
                fname,
                r.record_count,
                &r.md5_checksum[..8]);
        }
        if results.len() > 10 {
            println!("    ... 还有 {} 个文件", results.len() - 10);
        }
    }

    Ok(())
}

fn handle_query(
    conn: &rusqlite::Connection,
    stations: Option<&str>,
    start: Option<&str>,
    end: Option<&str>,
    elements: Option<&str>,
    qc_status: Option<&str>,
    format: &str,
    limit: i64,
    stats_mode: Option<&str>,
) -> Result<()> {
    let station_ids = parse_station_list(stations).unwrap_or_default();
    let (start_time, end_time) = parse_time_range(start, end)?;

    let element_list: Vec<String> = elements
        .map(|s| {
            s.split(',')
                .map(|e| e.trim().trim_start_matches('_').to_string())
                .filter(|e| !e.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let filter = query::QueryFilter {
        station_ids,
        start_time: Some(start_time),
        end_time: Some(end_time),
        elements: element_list,
        qc_status: qc_status.map(|s| s.to_string()),
        limit: Some(limit),
        offset: None,
    };

    match stats_mode {
        Some("daily") => {
            let stats = query::compute_daily_stats(conn, &filter)?;
            let output = query::format_stats_table(&stats)?;
            println!("{}", output);
        }
        Some(mode) => {
            anyhow::bail!("不支持的统计模式: {}", mode);
        }
        None => {
            let observations = query::query_observations(conn, &filter)?;
            let output_format = match format.to_lowercase().as_str() {
                "table" => query::OutputFormat::Table,
                "json" => query::OutputFormat::Json,
                "csv" => query::OutputFormat::Csv,
                _ => anyhow::bail!("不支持的输出格式: {}", format),
            };
            let output = query::format_output(&observations, output_format)?;
            println!("{}", output);
        }
    }

    Ok(())
}

fn handle_config(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    subcommand: &ConfigCommand,
    config_path: &std::path::Path,
) -> Result<()> {
    use rusqlite::params;
    match subcommand {
        ConfigCommand::Show => {
            println!("{}", "=== 当前配置 ===".bold());
            let json = serde_json::to_string_pretty(config)?;
            println!("{}", json);
        }
        ConfigCommand::AddStation {
            id,
            name,
            latitude,
            longitude,
            elevation,
            instrument,
        } => {
            let mut config = config.clone();
            let station = config::StationConfig {
                id: id.clone(),
                name: name.clone(),
                latitude: *latitude,
                longitude: *longitude,
                elevation: *elevation,
                instrument_model: instrument.clone(),
                timezone: "Asia/Shanghai".to_string(),
                csv_column_mapping: std::collections::HashMap::new(),
                unit_mapping: std::collections::HashMap::new(),
                neighbors: Vec::new(),
                qc_thresholds: std::collections::HashMap::new(),
            };
            config.add_station(station);
            config.save(config_path)?;
            println!("{}", format!("站点 {} 添加/更新成功", id).green());
        }
        ConfigCommand::RemoveStation { id } => {
            let mut config = config.clone();
            if config.remove_station(id) {
                config.save(config_path)?;
                println!("{}", format!("站点 {} 已删除", id).green());
            } else {
                println!("{}", format!("站点 {} 不存在", id).red());
            }
        }
        ConfigCommand::ListStations => {
            println!("{}", "=== 站点列表 ===".bold());
            if config.stations.is_empty() {
                println!("  暂无站点配置");
            } else {
                for s in &config.stations {
                    println!("  {} - {} (纬度:{:.4}, 经度:{:.4})",
                        s.id.bold(),
                        s.name,
                        s.latitude,
                        s.longitude);
                }
            }
        }
        ConfigCommand::Export { path } => {
            config.save(path)?;
            println!("{}", format!("配置已导出到 {}", path.display()).green());
        }
        ConfigCommand::Import { path } => {
            let imported = AppConfig::load(path)?;
            imported.save(config_path)?;
            println!("{}", format!("配置已从 {} 导入", path.display()).green());
        }
        ConfigCommand::AddNeighbor {
            station_id,
            neighbor_id,
            distance,
        } => {
            conn.execute(
                "INSERT OR REPLACE INTO neighbors (station_id, neighbor_id, distance_km) VALUES (?1, ?2, ?3)",
                params![station_id, neighbor_id, distance],
            )?;
            println!(
                "{}",
                format!("邻近关系 {} -> {} 已添加", station_id, neighbor_id).green()
            );
        }
        ConfigCommand::RemoveNeighbor {
            station_id,
            neighbor_id,
        } => {
            let count = conn.execute(
                "DELETE FROM neighbors WHERE station_id = ?1 AND neighbor_id = ?2",
                params![station_id, neighbor_id],
            )?;
            if count > 0 {
                println!(
                    "{}",
                    format!("邻近关系 {} -> {} 已删除", station_id, neighbor_id).green()
                );
            } else {
                println!(
                    "{}",
                    format!("邻近关系 {} -> {} 不存在", station_id, neighbor_id).red()
                );
            }
        }
        ConfigCommand::ListNeighbors { station_id } => {
            println!("{}", "=== 邻近站点列表 ===".bold());
            let mut stmt = conn.prepare(
                "SELECT neighbor_id, distance_km FROM neighbors WHERE station_id = ?1 ORDER BY neighbor_id",
            )?;
            let mut rows = stmt.query(params![station_id])?;

            let mut count = 0;
            while let Some(row) = rows.next()? {
                let neighbor_id: String = row.get(0)?;
                let distance: Option<f64> = row.get(1)?;
                let dist_str = distance
                    .map(|d| format!("{:.1} km", d))
                    .unwrap_or_else(|| "-".to_string());
                println!("  {} -> {} ({})", station_id.bold(), neighbor_id, dist_str);
                count += 1;
            }
            if count == 0 {
                println!("  暂无邻近站点配置");
            }
        }
    }
    Ok(())
}

fn handle_review(
    conn: &rusqlite::Connection,
    config: &AppConfig,
    subcommand: &ReviewCommand,
    dry_run: bool,
) -> Result<()> {
    match subcommand {
        ReviewCommand::Report { stations, start, end } => {
            let station_list = parse_station_list(stations.as_deref());
            let start_time = parse_datetime_opt(start.as_deref())?;
            let end_time = parse_datetime_opt(end.as_deref())?;

            let report = review::generate_qc_report(
                conn,
                station_list.as_deref(),
                start_time.as_ref(),
                end_time.as_ref(),
            )?;

            let output = review::format_qc_report(&report)?;
            println!("{}", output);
        }
        ReviewCommand::Override { id, status, reason, operator } => {
            let new_status = match status.as_str() {
                "passed" | "pass" => db::QcStatus::OverriddenPass,
                "failed" | "fail" => db::QcStatus::OverriddenFail,
                _ => anyhow::bail!("无效的状态值: {}", status),
            };

            review::override_qc_status(
                conn,
                *id,
                &new_status,
                reason.as_deref(),
                operator,
                dry_run,
            )?;

            let msg = if dry_run {
                format!("[预览] 记录 {} 状态将更新为 {}", id, status)
            } else {
                format!("记录 {} 状态已更新为 {}", id, status)
            };
            println!("{}", msg.green());
        }
        ReviewCommand::BatchOverride {
            station,
            start,
            end,
            from,
            to,
            reason,
            operator,
        } => {
            let from_status = match from.as_str() {
                "pending" => db::QcStatus::Pending,
                "passed" => db::QcStatus::Passed,
                "suspect" => db::QcStatus::Suspect,
                "failed" => db::QcStatus::Failed,
                _ => anyhow::bail!("无效的原状态: {}", from),
            };

            let to_status = match to.as_str() {
                "passed" => db::QcStatus::OverriddenPass,
                "failed" => db::QcStatus::OverriddenFail,
                _ => anyhow::bail!("无效的目标状态: {}", to),
            };

            let start_time = parse_datetime_opt(Some(start.as_str()))?.unwrap();
            let end_time = parse_datetime_opt(Some(end.as_str()))?.unwrap();

            let count = review::batch_override_by_range(
                conn,
                station.as_deref(),
                &start_time,
                &end_time,
                &from_status,
                &to_status,
                reason.as_deref(),
                operator,
                dry_run,
            )?;

            let msg = if dry_run {
                format!("[预览] 将更新 {} 条记录", count)
            } else {
                format!("已更新 {} 条记录", count)
            };
            println!("{}", msg.green());
        }
        ReviewCommand::Reaudit { station, start, end } => {
            let start_time = parse_datetime(start)?;
            let end_time = parse_datetime(end)?;

            println!("{}", "=== 重新审核 ===".bold());
            println!("  时间范围: {} ~ {}", start, end);
            println!();

            let diff = review::reaudit_range(
                conn,
                config,
                station.as_deref(),
                &start_time,
                &end_time,
                dry_run,
            )?;

            println!("  总审核数: {}", diff.total_checked);
            println!("  状态变更: {}", diff.status_changed);

            if dry_run {
                println!();
                println!("{}", "  [预览模式] 未实际更新".yellow());
            }
        }
    }
    Ok(())
}

fn parse_station_list(stations: Option<&str>) -> Option<Vec<String>> {
    stations.map(|s| {
        s.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    })
}

fn parse_time_range(
    start: Option<&str>,
    end: Option<&str>,
) -> Result<(DateTime<Utc>, DateTime<Utc>)> {
    let end_time = match end {
        Some(s) => parse_datetime(s)?,
        None => Utc::now(),
    };

    let start_time = match start {
        Some(s) => parse_datetime(s)?,
        None => end_time - Duration::days(1),
    };

    Ok((start_time, end_time))
}

fn parse_datetime(s: &str) -> Result<DateTime<Utc>> {
    let s = s.trim();

    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
    ];

    for fmt in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, fmt) {
            let local = chrono::FixedOffset::east_opt(8 * 3600)
                .unwrap()
                .from_local_datetime(&dt)
                .single()
                .ok_or_else(|| anyhow::anyhow!("无效的时间: {}", s))?;
            return Ok(local.with_timezone(&Utc));
        }
    }

    for fmt in &["%Y-%m-%d", "%Y/%m/%d"] {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(s, fmt) {
            let dt = d.and_hms_opt(0, 0, 0).unwrap();
            let local = chrono::FixedOffset::east_opt(8 * 3600)
                .unwrap()
                .from_local_datetime(&dt)
                .single()
                .ok_or_else(|| anyhow::anyhow!("无效的时间: {}", s))?;
            return Ok(local.with_timezone(&Utc));
        }
    }

    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Ok(dt.with_timezone(&Utc));
    }

    anyhow::bail!("无法解析时间: {}", s)
}

fn parse_datetime_opt(s: Option<&str>) -> Result<Option<DateTime<Utc>>> {
    match s {
        Some(s) => Ok(Some(parse_datetime(s)?)),
        None => Ok(None),
    }
}
