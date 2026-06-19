pub mod alert;
pub mod analyzer;
pub mod config;
pub mod decoder;
pub mod error;
pub mod fusion;
pub mod io;
pub mod types;

use clap::{Arg, ArgAction, Command};
use config::{validate_file_exists, validate_time_range, AppConfig, LogLevel};
use error::{AtcError, AtcResult};
use io::{
    create_input_stream, create_output_stream, BinaryReader, InputStream,
    ResultWriter,
};
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{error, info, warn};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use types::{OutputFormat, SafetyThresholds, StatsMode};

fn build_cli() -> Command {
    Command::new("atc-analyzer")
        .version("1.0.0")
        .about("民航空管多雷达数据融合与分析系统")
        .long_about(
            "ASTerix Cat048 多雷达数据融合、冲突检测与流量统计分析工具\n\
             \n\
             功能特性:\n\
             • ASTerix Cat048 二进制报文解码\n\
             • 多雷达站轨迹加权融合\n\
             • 飞行冲突检测与预警\n\
             • 流量统计与报表生成\n\
             • 轨迹查询与筛选\n\
             • 流式处理支持大文件",
        )
        .arg_required_else_help(true)
        .arg(
            Arg::new("config")
                .short('c')
                .long("config")
                .value_name("FILE")
                .help("配置文件路径 (TOML格式)")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("log-level")
                .long("log-level")
                .value_name("LEVEL")
                .help("日志级别")
                .value_parser(clap::value_parser!(LogLevel))
                .default_value("info")
                .env("ATC_LOG_LEVEL"),
        )
        .arg(
            Arg::new("quiet")
                .short('q')
                .long("quiet")
                .help("静默模式, 不输出进度信息")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("json")
                .long("json")
                .help("以JSON格式输出结果")
                .action(ArgAction::SetTrue),
        )
        .subcommand(build_decode_command())
        .subcommand(build_fuse_command())
        .subcommand(build_alert_command())
        .subcommand(build_stats_command())
        .subcommand(build_query_command())
}

fn build_decode_command() -> Command {
    Command::new("decode")
        .about("解码ASTerix Cat048二进制报文")
        .long_about(
            "从文件或标准输入读取ASTerix Cat048二进制数据, \n\
             解析为结构化轨迹点并输出.\n\n\
             示例:\n\
             atc-analyzer decode -i radar_data.bin -o output.json\n\
             cat radar_data.bin | atc-analyzer decode --json",
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("输入二进制文件路径, 省略则从标准输入读取")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("输出文件路径, 省略则输出到标准输出")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("输出格式: json, csv, text")
                .value_parser(["json", "csv", "text"])
                .default_value("text"),
        )
        .arg(
            Arg::new("no-checksum")
                .long("no-checksum")
                .help("跳过校验和验证")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("radar-id")
                .long("radar-id")
                .value_name("ID")
                .help("指定雷达站ID, 覆盖解码结果"),
        )
}

fn build_fuse_command() -> Command {
    Command::new("fuse")
        .about("多雷达轨迹数据融合")
        .long_about(
            "接收多雷达站的轨迹数据, 进行时空对齐和加权融合,\n\
             输出平滑的融合轨迹序列.\n\n\
             示例:\n\
             atc-analyzer fuse -i radar1.bin -i radar2.bin -o fused.json",
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("输入文件路径, 可重复指定多个雷达数据源")
                .action(ArgAction::Append)
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("输出文件路径")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("输出格式: json, csv, text")
                .value_parser(["json", "csv", "text"])
                .default_value("text"),
        )
        .arg(
            Arg::new("batch-size")
                .long("batch-size")
                .value_name("SIZE")
                .help("批处理大小")
                .value_parser(clap::value_parser!(usize))
                .default_value("1000"),
        )
}

fn build_alert_command() -> Command {
    Command::new("alert")
        .about("飞行冲突检测与告警")
        .long_about(
            "基于融合轨迹计算最近点相遇时间和距离,\n\
             当预测间距小于安全阈值时生成告警.\n\n\
             支持三种冲突模式:\n\
             • 水平冲突 - 仅水平距离小于阈值\n\
             • 垂直冲突 - 仅垂直距离小于阈值\n\
             • 三维冲突 - 水平和垂直距离同时小于阈值\n\n\
             示例:\n\
             atc-analyzer alert -i fused_tracks.json --horizontal 5000 --vertical 300",
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("融合轨迹数据文件 (JSON格式)")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("告警输出文件路径")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("输出格式: json, csv, text")
                .value_parser(["json", "csv", "text"])
                .default_value("text"),
        )
        .arg(
            Arg::new("horizontal")
                .long("horizontal")
                .value_name("METERS")
                .help("水平安全间隔 (米)")
                .value_parser(clap::value_parser!(f64))
                .default_value("5000"),
        )
        .arg(
            Arg::new("vertical")
                .long("vertical")
                .value_name("METERS")
                .help("垂直安全间隔 (米)")
                .value_parser(clap::value_parser!(f64))
                .default_value("300"),
        )
        .arg(
            Arg::new("lookahead")
                .long("lookahead")
                .value_name("SECONDS")
                .help("预测时间窗口 (秒)")
                .value_parser(clap::value_parser!(i64))
                .default_value("120"),
        )
        .arg(
            Arg::new("warning-factor")
                .long("warning-factor")
                .value_name("FACTOR")
                .help("警告阈值因子")
                .value_parser(clap::value_parser!(f64))
                .default_value("1.5"),
        )
}

fn build_stats_command() -> Command {
    Command::new("stats")
        .about("流量统计与报表生成")
        .long_about(
            "统计指定时段内的架次峰值、平均飞行高度分布、\n\
             扇区流量热力数据.\n\n\
             支持两种统计模式:\n\
             • cumulative - 累积统计整个时间段\n\
             • sliding - 滑动窗口统计\n\n\
             示例:\n\
             atc-analyzer stats -i fused_tracks.json --mode sliding --window 15m",
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("融合轨迹数据文件 (JSON格式)")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("统计报表输出路径")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("输出格式: json, csv, text")
                .value_parser(["json", "csv", "text"])
                .default_value("text"),
        )
        .arg(
            Arg::new("mode")
                .long("mode")
                .value_name("MODE")
                .help("统计模式: cumulative, sliding")
                .value_parser(["cumulative", "sliding"])
                .default_value("cumulative"),
        )
        .arg(
            Arg::new("time-start")
                .long("time-start")
                .value_name("DATETIME")
                .help("统计开始时间 (RFC3339格式)"),
        )
        .arg(
            Arg::new("time-end")
                .long("time-end")
                .value_name("DATETIME")
                .help("统计结束时间 (RFC3339格式)"),
        )
        .arg(
            Arg::new("window")
                .long("window")
                .value_name("DURATION")
                .help("滑动窗口大小 (如: 15m, 1h)")
                .default_value("15m"),
        )
        .arg(
            Arg::new("slide")
                .long("slide")
                .value_name("DURATION")
                .help("滑动间隔 (如: 5m, 30s)")
                .default_value("5m"),
        )
}

fn build_query_command() -> Command {
    Command::new("query")
        .about("轨迹数据查询与筛选")
        .long_about(
            "按时间范围、目标呼号、扇区编号筛选轨迹数据.\n\
             支持正则匹配与ICAO地址模糊查询.\n\n\
             示例:\n\
             atc-analyzer query -i fused_tracks.json --callsign '^CA.*'\n\
             atc-analyzer query -i fused_tracks.json --icao 'A000[0-9A-F]{2}'",
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .value_name("FILE")
                .help("融合轨迹数据文件 (JSON格式)")
                .value_parser(clap::value_parser!(PathBuf))
                .required(true),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("查询结果输出路径")
                .value_parser(clap::value_parser!(PathBuf)),
        )
        .arg(
            Arg::new("format")
                .short('f')
                .long("format")
                .value_name("FORMAT")
                .help("输出格式: json, csv, text")
                .value_parser(["json", "csv", "text"])
                .default_value("text"),
        )
        .arg(
            Arg::new("time-start")
                .long("time-start")
                .value_name("DATETIME")
                .help("开始时间 (RFC3339格式)"),
        )
        .arg(
            Arg::new("time-end")
                .long("time-end")
                .value_name("DATETIME")
                .help("结束时间 (RFC3339格式)"),
        )
        .arg(
            Arg::new("callsign")
                .long("callsign")
                .value_name("PATTERN")
                .help("呼号正则匹配模式"),
        )
        .arg(
            Arg::new("icao")
                .long("icao")
                .value_name("PATTERN")
                .help("ICAO地址正则匹配模式"),
        )
        .arg(
            Arg::new("sector")
                .long("sector")
                .value_name("ID")
                .help("扇区编号"),
        )
}

fn init_logging(level: &LogLevel, quiet: bool) {
    if quiet {
        return;
    }

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(level.as_str()));

    tracing_subscriber::registry()
        .with(filter)
        .with(
            fmt::layer()
                .with_target(false)
                .with_level(true)
                .with_ansi(true)
                .with_level(true),
        )
        .try_init()
        .ok();
}

fn load_config(path: Option<&PathBuf>) -> AtcResult<AppConfig> {
    let config_path = path.map(|p| p.as_path());
    AppConfig::load_or_default(config_path)
}

fn parse_output_format(format: &str) -> OutputFormat {
    match format.to_lowercase().as_str() {
        "json" => OutputFormat::Json,
        "csv" => OutputFormat::Csv,
        _ => OutputFormat::Text,
    }
}

fn parse_datetime(s: &str) -> AtcResult<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|e| AtcError::ValidationError(format!("无效的时间格式 {}: {}", s, e)))
}

fn parse_duration(s: &str) -> AtcResult<chrono::Duration> {
    let s_lower = s.to_lowercase();
    let num_part: String = s_lower.chars().take_while(|c| c.is_ascii_digit()).collect();
    let unit_part: String = s_lower.chars().skip_while(|c| c.is_ascii_digit()).collect();

    let value: i64 = num_part
        .parse()
        .map_err(|_| AtcError::ValidationError(format!("无效的持续时间格式: {}", s)))?;

    match unit_part.as_str() {
        "s" | "sec" | "secs" | "second" | "seconds" => Ok(chrono::Duration::seconds(value)),
        "m" | "min" | "mins" | "minute" | "minutes" => Ok(chrono::Duration::minutes(value)),
        "h" | "hr" | "hrs" | "hour" | "hours" => Ok(chrono::Duration::hours(value)),
        "d" | "day" | "days" => Ok(chrono::Duration::days(value)),
        _ => Err(AtcError::ValidationError(format!(
            "无效的时间单位: {}, 支持: s, m, h, d",
            unit_part
        ))),
    }
}

async fn run_decode(matches: &clap::ArgMatches, _config: Arc<AppConfig>, quiet: bool) -> AtcResult<()> {
    let input_path = matches.get_one::<PathBuf>("input");
    let output_path = matches.get_one::<PathBuf>("output");
    let format = matches.get_one::<String>("format").unwrap();
    let no_checksum = matches.get_flag("no-checksum");
    let radar_id_override = matches.get_one::<String>("radar-id");

    if let Some(path) = input_path {
        validate_file_exists(path, "输入文件")?;
    }

    let output_format = parse_output_format(format);
    let input_stream = create_input_stream(input_path.map(|p| p.as_path()));
    let output_stream = create_output_stream(output_path.map(|p| p.as_path()));

    info!("开始解码ASTerix数据...");

    let mut reader = BinaryReader::new(input_stream, !quiet)?;
    let mut writer = ResultWriter::new(output_stream, output_format, true)?;

    let decoder = decoder::AsterixDecoder::new()
        .with_checksum_verification(!no_checksum)
        .with_skip_unknown(true);

    let mut total_records = 0;
    let mut error_count = 0;

    loop {
        let header = reader.read_bytes(3)?;
        if header.len() < 3 {
            break;
        }

        let length = u16::from_be_bytes([header[1], header[2]]) as usize;
        if length < 3 {
            return Err(AtcError::ParseError {
                message: format!("无效的消息长度: {}", length),
                offset: 0,
            });
        }

        let remaining = reader.read_bytes(length - 3)?;
        let mut full_message = Vec::with_capacity(length);
        full_message.extend(header);
        full_message.extend(remaining);

        match decoder.decode_message(&full_message) {
            Ok(message) => match decoder.parse_cat048(&message) {
                Ok(record) => {
                    let radar_id = radar_id_override
                        .cloned()
                        .unwrap_or_else(|| record.radar_id.clone());
                    match decoder.to_track_point(&record, &radar_id) {
                        Ok(point) => {
                            writer.write_track_point(&point)?;
                            total_records += 1;
                        }
                        Err(e) => {
                            error!("轨迹点转换失败: {}", e);
                            error_count += 1;
                        }
                    }
                }
                Err(e) => {
                    error!("Cat048解析失败: {}", e);
                    error_count += 1;
                }
            },
            Err(AtcError::UnsupportedCategory(cat)) => {
                warn!("跳过不支持的类别: {:#x}", cat);
            }
            Err(e) => {
                error!("消息解码失败: {}", e);
                error_count += 1;
            }
        }
    }

    reader.finish();
    writer.flush()?;

    info!(
        "解码完成: 成功 {} 条, 失败 {} 条",
        total_records, error_count
    );

    Ok(())
}

async fn run_fuse(matches: &clap::ArgMatches, config: Arc<AppConfig>, quiet: bool) -> AtcResult<()> {
    let input_paths = matches.get_many::<PathBuf>("input").unwrap_or_default();
    let output_path = matches.get_one::<PathBuf>("output");
    let format = matches.get_one::<String>("format").unwrap();
    let batch_size = *matches.get_one::<usize>("batch-size").unwrap();

    let output_format = parse_output_format(format);
    let output_stream = create_output_stream(output_path.map(|p| p.as_path()));
    let mut writer = ResultWriter::new(output_stream, output_format, true)?;

    let tracker = Arc::new(fusion::MultiRadarTracker::new(&config));
    let decoder = decoder::AsterixDecoder::new().with_skip_unknown(true);

    info!("开始融合 {} 个数据源...", input_paths.len());

    let input_paths: Vec<_> = input_paths.cloned().collect();
    let mut all_points = Vec::new();

    for (idx, path) in input_paths.iter().enumerate() {
        validate_file_exists(path, "输入文件")?;
        info!("处理数据源 {}/{}: {}", idx + 1, input_paths.len(), path.display());

        let input_stream = InputStream::File(path.clone());
        let mut reader = BinaryReader::new(input_stream, !quiet)?;

        let mut batch = Vec::with_capacity(batch_size);

        loop {
            let header = reader.read_bytes(3)?;
            if header.len() < 3 {
                break;
            }

            let length = u16::from_be_bytes([header[1], header[2]]) as usize;
            if length < 3 {
                break;
            }

            let remaining = reader.read_bytes(length - 3)?;
            let mut full_message = Vec::with_capacity(length);
            full_message.extend(header);
            full_message.extend(remaining);

            if let Ok(message) = decoder.decode_message(&full_message) {
                if let Ok(record) = decoder.parse_cat048(&message) {
                    if let Ok(point) = decoder.to_track_point(&record, &record.radar_id.clone()) {
                        batch.push(point);
                        if batch.len() >= batch_size {
                            let points = std::mem::take(&mut batch);
                            all_points.extend(points);
                        }
                    }
                }
            }
        }

        if !batch.is_empty() {
            all_points.extend(batch);
        }

        reader.finish();
    }

    info!("共读取 {} 条轨迹点, 开始融合...", all_points.len());
    tracker.add_points_parallel(all_points);

    let fused_tracks = tracker.get_all_tracks();
    info!("融合完成, 生成 {} 条轨迹", fused_tracks.len());

    for track in &fused_tracks {
        writer.write_fused_track(track)?;
    }

    writer.flush()?;

    let stats = tracker.get_statistics();
    info!("融合统计: {}", stats);

    Ok(())
}

async fn run_alert(matches: &clap::ArgMatches, _config: Arc<AppConfig>, _quiet: bool) -> AtcResult<()> {
    let input_path = matches.get_one::<PathBuf>("input");
    let output_path = matches.get_one::<PathBuf>("output");
    let format = matches.get_one::<String>("format").unwrap();
    let horizontal = *matches.get_one::<f64>("horizontal").unwrap();
    let vertical = *matches.get_one::<f64>("vertical").unwrap();
    let lookahead = *matches.get_one::<i64>("lookahead").unwrap();
    let warning_factor = *matches.get_one::<f64>("warning-factor").unwrap();

    if let Some(path) = input_path {
        validate_file_exists(path, "输入文件")?;
    }

    config::validate_threshold(horizontal, 100.0, 100000.0, "水平间隔")?;
    config::validate_threshold(vertical, 10.0, 10000.0, "垂直间隔")?;
    config::validate_threshold(lookahead as f64, 1.0, 3600.0, "预测窗口")?;
    config::validate_threshold(warning_factor, 1.0, 10.0, "警告因子")?;

    let thresholds = SafetyThresholds {
        horizontal_separation: horizontal,
        vertical_separation: vertical,
        lookahead_seconds: lookahead,
        warning_factor,
    };

    let output_format = parse_output_format(format);
    let output_stream = create_output_stream(output_path.map(|p| p.as_path()));
    let mut writer = ResultWriter::new(output_stream, output_format, true)?;

    info!("加载轨迹数据...");
    let input_data = std::fs::read_to_string(input_path.unwrap())?;
    let tracks: Vec<types::FusedTrack> = serde_json::from_str(&input_data)?;

    info!("检测冲突, 轨迹数量: {}", tracks.len());

    let mut detector = alert::ConflictDetector::new(thresholds);
    let alerts = detector.detect_and_dedupe(&tracks);

    info!("检测到 {} 条冲突告警", alerts.len());

    for alert in &alerts {
        writer.write_alert(alert)?;
    }

    writer.flush()?;

    let summary = alert::generate_conflict_summary(&alerts);
    info!("冲突摘要: {}", summary);

    Ok(())
}

async fn run_stats(matches: &clap::ArgMatches, _config: Arc<AppConfig>, _quiet: bool) -> AtcResult<()> {
    let input_path = matches.get_one::<PathBuf>("input");
    let output_path = matches.get_one::<PathBuf>("output");
    let format = matches.get_one::<String>("format").unwrap();
    let mode_str = matches.get_one::<String>("mode").unwrap();
    let time_start_str = matches.get_one::<String>("time-start");
    let time_end_str = matches.get_one::<String>("time-end");
    let window_str = matches.get_one::<String>("window").unwrap();
    let slide_str = matches.get_one::<String>("slide").unwrap();

    if let Some(path) = input_path {
        validate_file_exists(path, "输入文件")?;
    }

    let time_start = time_start_str
        .map(|s| parse_datetime(s))
        .transpose()?;
    let time_end = time_end_str.map(|s| parse_datetime(s)).transpose()?;

    validate_time_range(&time_start, &time_end)?;

    let mode = match mode_str.as_str() {
        "sliding" => StatsMode::SlidingWindow,
        _ => StatsMode::Cumulative,
    };

    let window = parse_duration(window_str)?;
    let slide = parse_duration(slide_str)?;

    let output_format = parse_output_format(format);

    info!("加载轨迹数据...");
    let input_data = std::fs::read_to_string(input_path.unwrap())?;
    let tracks: Vec<types::FusedTrack> = serde_json::from_str(&input_data)?;

    info!("统计分析, 轨迹数量: {}", tracks.len());

    let analyzer = analyzer::TrafficAnalyzer::new()
        .with_window_size(window)
        .with_slide_interval(slide);

    let stats = analyzer.analyze(&tracks, mode, time_start, time_end)?;

    let output_stream = create_output_stream(output_path.map(|p| p.as_path()));
    let mut writer = ResultWriter::new(output_stream, output_format, true)?;

    writer.write_stats(&stats)?;
    writer.flush()?;

    if output_format == OutputFormat::Text {
        let report = analyzer::format_stats_report(&stats);
        println!("{}", report);
    }

    Ok(())
}

async fn run_query(matches: &clap::ArgMatches, config: Arc<AppConfig>, _quiet: bool) -> AtcResult<()> {
    let input_path = matches.get_one::<PathBuf>("input").unwrap();
    let output_path = matches.get_one::<PathBuf>("output");
    let format = matches.get_one::<String>("format").unwrap();
    let time_start_str = matches.get_one::<String>("time-start");
    let time_end_str = matches.get_one::<String>("time-end");
    let callsign_pattern = matches.get_one::<String>("callsign");
    let icao_pattern = matches.get_one::<String>("icao");
    let _sector_id = matches.get_one::<String>("sector");

    validate_file_exists(input_path, "输入文件")?;

    let time_start = time_start_str
        .map(|s| parse_datetime(s))
        .transpose()?;
    let time_end = time_end_str.map(|s| parse_datetime(s)).transpose()?;

    validate_time_range(&time_start, &time_end)?;

    let output_format = parse_output_format(format);

    info!("加载轨迹数据...");
    let input_data = std::fs::read_to_string(input_path)?;
    let tracks: Vec<types::FusedTrack> = serde_json::from_str(&input_data)?;

    let tracker = Arc::new(fusion::MultiRadarTracker::new(&config));

    for track in &tracks {
        for point in &track.points {
            tracker.add_point(point.clone());
        }
    }

    info!("执行查询...");

    let results = tracker.query_tracks(
        time_start,
        time_end,
        callsign_pattern.map(|s| s.as_str()),
        icao_pattern.map(|s| s.as_str()),
    )?;

    info!("查询到 {} 条匹配轨迹", results.len());

    let output_stream = create_output_stream(output_path.map(|p| p.as_path()));
    let mut writer = ResultWriter::new(output_stream, output_format, true)?;

    for track in &results {
        writer.write_fused_track(track)?;
    }

    writer.flush()?;

    Ok(())
}

#[tokio::main]
async fn main() -> AtcResult<()> {
    let cli = build_cli();
    let matches = cli.get_matches();

    let log_level = matches.get_one::<LogLevel>("log-level").unwrap();
    let quiet = matches.get_flag("quiet");

    init_logging(log_level, quiet);

    let config_path = matches.get_one::<PathBuf>("config");
    let config = Arc::new(load_config(config_path)?);

    let result = match matches.subcommand() {
        Some(("decode", sub_matches)) => {
            run_decode(sub_matches, config.clone(), quiet).await
        }
        Some(("fuse", sub_matches)) => run_fuse(sub_matches, config.clone(), quiet).await,
        Some(("alert", sub_matches)) => run_alert(sub_matches, config.clone(), quiet).await,
        Some(("stats", sub_matches)) => run_stats(sub_matches, config.clone(), quiet).await,
        Some(("query", sub_matches)) => run_query(sub_matches, config.clone(), quiet).await,
        Some((name, _)) => Err(AtcError::Other(format!("未知子命令: {}", name))),
        None => Err(AtcError::Other("未指定子命令".to_string())),
    };

    if let Err(ref e) = result {
        error!("执行失败: {}", e);
        if !quiet {
            eprintln!("\x1b[31mERROR: {}\x1b[0m", e);
        }
        std::process::exit(1);
    }

    Ok(())
}
