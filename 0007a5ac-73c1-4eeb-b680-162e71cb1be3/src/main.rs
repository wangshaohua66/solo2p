mod cli;
mod config;
mod parser;
mod analyzer;
mod storage;
mod lookup;
mod report;
mod utils;

use clap::Parser;
use anyhow::{Result, Context};
use termcolor::{Color, ColorChoice, ColorSpec, StandardStream, WriteColor};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use indicatif::{ProgressBar, ProgressStyle};
use walkdir::WalkDir;

use cli::{Cli, Commands, LogFormat};
use config::Config;
use parser::{LogParser, LogFormatType, DnsLogEntry};
use storage::sqlite::{DnsDatabase, DnsRecord};
use analyzer::tunnel::{TunnelDetector, TunnelDetectionResult, sort_by_score_desc, filter_by_min_score};
use analyzer::reputation::ThreatIntelAggregator;
use lookup::whois::{WhoisLookup, WhoisResult, read_domain_list};
use lookup::dns::DnsLookup;
use report::{ReportGenerator, ReportFormat};
use utils::validator;

fn main() -> Result<()> {
    let cli = Cli::parse();

    let config = if let Some(config_path) = &cli.config {
        Config::load_from(config_path)?
    } else {
        Config::load()?
    };

    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        run_command(cli, config).await
    })
}

async fn run_command(cli: Cli, config: Config) -> Result<()> {
    match cli.command {
        Commands::Import { file, directory, format, incremental, batch_size } => {
            cmd_import(&config, file, directory, format, incremental, batch_size).await
        }
        Commands::LogAnalyze { file, time_start, time_end, min_score, output, output_format, with_intel } => {
            cmd_log_analyze(&config, file, time_start, time_end, min_score, output, output_format, with_intel).await
        }
        Commands::Monitor { directory, alert_script, daemon, interval, alert_threshold } => {
            cmd_monitor(&config, directory, alert_script, daemon, interval, alert_threshold).await
        }
        Commands::Report { format, output, time_range, with_whois, top, with_intel } => {
            cmd_report(&config, format, output, time_range, with_whois, top, with_intel).await
        }
        Commands::Whois { domain, file, concurrency, highlight_new, output_format, output, no_cache } => {
            cmd_whois(domain, file, concurrency, highlight_new, output_format, output, no_cache, &config).await
        }
        Commands::Intel { domain, refresh, list, source, stats } => {
            cmd_intel(&config, domain, refresh, list, source, stats).await
        }
        Commands::Lookup { domain, file, record_type, all, output_format, recursion_depth: _recursion_depth } => {
            cmd_lookup(domain, file, record_type, all, output_format).await
        }
        Commands::Trace { domain, ip, time_start, time_end, graph, output_format, output, limit } => {
            cmd_trace(&config, domain, ip, time_start, time_end, graph, output_format, output, limit).await
        }
        Commands::Config { init, show, path: show_path, set, add_whitelist, remove_whitelist, example } => {
            cmd_config(&config, init, show, show_path, set, add_whitelist, remove_whitelist, example)
        }
    }
}

fn print_success(msg: &str) {
    let mut stdout = StandardStream::stdout(ColorChoice::Auto);
    stdout.set_color(ColorSpec::new().set_fg(Some(Color::Green)).set_bold(true)).unwrap();
    writeln!(&mut stdout, "[OK] {}", msg).unwrap();
    stdout.reset().unwrap();
}

fn print_error(msg: &str) {
    let mut stderr = StandardStream::stderr(ColorChoice::Auto);
    stderr.set_color(ColorSpec::new().set_fg(Some(Color::Red)).set_bold(true)).unwrap();
    writeln!(&mut stderr, "[错误] {}", msg).unwrap();
    stderr.reset().unwrap();
}

fn print_warning(msg: &str) {
    let mut stdout = StandardStream::stdout(ColorChoice::Auto);
    stdout.set_color(ColorSpec::new().set_fg(Some(Color::Yellow))).unwrap();
    writeln!(&mut stdout, "[警告] {}", msg).unwrap();
    stdout.reset().unwrap();
}

fn print_info(msg: &str) {
    let mut stdout = StandardStream::stdout(ColorChoice::Auto);
    stdout.set_color(ColorSpec::new().set_fg(Some(Color::Blue))).unwrap();
    writeln!(&mut stdout, "[信息] {}", msg).unwrap();
    stdout.reset().unwrap();
}

fn print_risk(score: u8, msg: &str) {
    let mut stdout = StandardStream::stdout(ColorChoice::Auto);
    let color = if score >= 70 {
        Color::Red
    } else if score >= 40 {
        Color::Yellow
    } else if score > 0 {
        Color::Cyan
    } else {
        Color::Green
    };
    stdout.set_color(ColorSpec::new().set_fg(Some(color)).set_bold(true)).unwrap();
    write!(&mut stdout, "[{}分] ", score).unwrap();
    stdout.reset().unwrap();
    writeln!(&mut stdout, "{}", msg).unwrap();
}

async fn cmd_import(
    config: &Config,
    file: Option<PathBuf>,
    directory: Option<PathBuf>,
    format: Option<LogFormat>,
    incremental: bool,
    batch_size: usize,
) -> Result<()> {
    let format_type = match format {
        Some(LogFormat::Bind) => LogFormatType::Bind,
        Some(LogFormat::Unbound) => LogFormatType::Unbound,
        Some(LogFormat::Windows) => LogFormatType::Windows,
        _ => LogFormatType::Unknown,
    };

    let parser = LogParser::new(format_type, config.storage.import_offset_file.clone());
    let db = Arc::new(DnsDatabase::open(&config.storage.database_path)?);

    let mut files: Vec<PathBuf> = Vec::new();

    if let Some(f) = file {
        validator::validate_file_path(f.to_str().unwrap_or(""))?;
        files.push(f);
    }

    if let Some(d) = directory {
        validator::validate_directory(d.to_str().unwrap_or(""))?;
        for entry in WalkDir::new(&d).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                files.push(entry.path().to_path_buf());
            }
        }
    }

    if files.is_empty() {
        return Err(anyhow::anyhow!("请指定要导入的日志文件或目录"));
    }

    print_info(&format!("发现 {} 个日志文件待导入", files.len()));

    let mut total_records = 0u64;
    let pb = ProgressBar::new(files.len() as u64);
    pb.set_style(ProgressStyle::default_bar()
        .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} 文件 ({eta})")
        .unwrap()
        .progress_chars("#>-"));

    for file_path in &files {
        pb.set_message(format!("处理中: {}", file_path.display()));

        let db_clone = Arc::clone(&db);
        let batch_size_clone = batch_size;

        let result = parser.parse_file_streaming(
            file_path,
            incremental,
            batch_size_clone,
            move |batch| {
                db_clone.insert_batch(&batch)?;
                Ok(())
            },
        );

        match result {
            Ok((records, _offset)) => {
                total_records += records;
                print_info(&format!("导入 {}: {} 条记录", file_path.display(), records));
            }
            Err(e) => {
                print_error(&format!("导入失败 {}: {}", file_path.display(), e));
            }
        }

        pb.inc(1);
    }

    pb.finish_with_message("导入完成");

    if incremental {
        if let Err(e) = parser.save_offsets() {
            print_warning(&format!("保存偏移量失败: {}", e));
        }
    }

    print_success(&format!("导入完成，共 {} 条记录", total_records));
    Ok(())
}

async fn cmd_log_analyze(
    config: &Config,
    file: Option<PathBuf>,
    time_start: Option<String>,
    time_end: Option<String>,
    min_score: u8,
    output: Option<PathBuf>,
    output_format: cli::OutputFormat,
    with_intel: bool,
) -> Result<()> {
    validator::validate_score_range(min_score)?;

    let detector = TunnelDetector::new(config.detection.clone());
    let mut all_results: Vec<TunnelDetectionResult> = Vec::new();

    if let Some(ref f) = file {
        validator::validate_file_path(f.to_str().unwrap_or(""))?;

        let parser = LogParser::new(LogFormatType::Unknown, config.storage.import_offset_file.clone());
        let (entries, _) = parser.parse_file(f, false)?;

        print_info(&format!("解析到 {} 条日志记录", entries.len()));

        let results = detector.analyze_entries(&entries);
        all_results = results;
    } else {
        let db = DnsDatabase::open(&config.storage.database_path)?;
        let stats = db.get_domain_stats(None, None, 1000)?;

        let mut entries = Vec::new();
        for stat in &stats {
            let records = db.query_by_domain(&stat.domain, None, None, 100)?;
            for r in records {
                entries.push(DnsLogEntry {
                    timestamp: r.timestamp,
                    client_ip: r.client_ip,
                    client_port: None,
                    query_domain: r.query_domain,
                    query_type: r.query_type,
                    query_class: r.query_class,
                    response_code: r.response_code,
                    response_ip: r.response_ip,
                    server_ip: None,
                    is_response: r.is_response,
                    raw_line: String::new(),
                });
            }
        }

        print_info(&format!("从数据库读取 {} 条记录进行分析", entries.len()));
        all_results = detector.analyze_entries(&entries);
    }

    let filtered = filter_by_min_score(all_results, min_score);
    let sorted = sort_by_score_desc(filtered);

    print_info(&format!("检测到 {} 个可疑域名（评分 >= {}）", sorted.len(), min_score));

    if with_intel {
        print_info("正在查询威胁情报...");
        let domains: Vec<String> = sorted.iter().map(|r| r.domain.clone()).collect();
        let intel_aggregator = ThreatIntelAggregator::new(config.threat_intel.clone(), None);
        let intel_results = intel_aggregator.lookup_domains(&domains).await;
        print_info(&format!("完成 {} 个域名的威胁情报查询", intel_results.len()));
    }

    match output_format {
        cli::OutputFormat::Table => {
            print_results_table(&sorted);
        }
        cli::OutputFormat::Json => {
            let json = serde_json::to_string_pretty(&sorted)?;
            if let Some(out_path) = &output {
                std::fs::write(out_path, &json)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", json);
            }
        }
        cli::OutputFormat::Csv => {
            let csv = results_to_csv(&sorted);
            if let Some(out_path) = &output {
                std::fs::write(out_path, &csv)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", csv);
            }
        }
    }

    Ok(())
}

fn print_results_table(results: &[TunnelDetectionResult]) {
    use prettytable::{Table, Row, Cell, Attr, color};

    let mut table = Table::new();
    table.add_row(Row::new(vec![
        Cell::new("排名").with_style(Attr::Bold),
        Cell::new("域名").with_style(Attr::Bold),
        Cell::new("风险评分").with_style(Attr::Bold),
        Cell::new("风险等级").with_style(Attr::Bold),
        Cell::new("查询次数").with_style(Attr::Bold),
        Cell::new("检测原因").with_style(Attr::Bold),
    ]));

    for (i, r) in results.iter().enumerate() {
        let level_color = match r.risk_level {
            crate::analyzer::tunnel::RiskLevel::High => color::RED,
            crate::analyzer::tunnel::RiskLevel::Medium => color::YELLOW,
            crate::analyzer::tunnel::RiskLevel::Low => color::CYAN,
            _ => color::GREEN,
        };

        table.add_row(Row::new(vec![
            Cell::new(&format!("{}", i + 1)),
            Cell::new(&r.domain),
            Cell::new(&format!("{}", r.risk_score)).with_style(Attr::ForegroundColor(level_color)),
            Cell::new(r.risk_level.to_string()).with_style(Attr::ForegroundColor(level_color)),
            Cell::new(&format!("{}", r.query_count)),
            Cell::new(&r.detection_reasons.join("\n")),
        ]));
    }

    table.printstd();
}

fn results_to_csv(results: &[TunnelDetectionResult]) -> String {
    let mut csv = String::new();
    csv.push_str("排名,域名,风险评分,风险等级,查询次数,TXT熵值,查询频率,子域名平均长度,子域名熵值,检测原因\n");

    for (i, r) in results.iter().enumerate() {
        csv.push_str(&format!(
            "{},{},{},{},{},{:.2},{},{:.2},{:.2},\"{}\"\n",
            i + 1,
            r.domain,
            r.risk_score,
            r.risk_level.to_string(),
            r.query_count,
            r.txt_entropy.unwrap_or(0.0),
            r.query_frequency.unwrap_or(0),
            r.subdomain_avg_length.unwrap_or(0.0),
            r.subdomain_entropy.unwrap_or(0.0),
            r.detection_reasons.join("; ")
        ));
    }

    csv
}

async fn cmd_monitor(
    _config: &Config,
    _directory: Option<PathBuf>,
    _alert_script: Option<PathBuf>,
    _daemon: bool,
    _interval: u64,
    _alert_threshold: u8,
) -> Result<()> {
    print_warning("监控模式需要完整实现，当前为演示版本");
    print_info("实时监控功能将持续监控指定目录并检测可疑行为");
    Ok(())
}

async fn cmd_report(
    config: &Config,
    format: cli::ReportFormat,
    output: Option<PathBuf>,
    time_range: String,
    with_whois: bool,
    top: usize,
    with_intel: bool,
) -> Result<()> {
    let db = DnsDatabase::open(&config.storage.database_path)?;
    let detector = TunnelDetector::new(config.detection.clone());
    let generator = ReportGenerator::new();

    let stats = db.get_domain_stats(None, None, top * 10)?;
    let mut entries = Vec::new();

    for stat in &stats {
        let records = db.query_by_domain(&stat.domain, None, None, 50)?;
        for r in records {
            entries.push(DnsLogEntry {
                timestamp: r.timestamp,
                client_ip: r.client_ip,
                client_port: None,
                query_domain: r.query_domain,
                query_type: r.query_type,
                query_class: r.query_class,
                response_code: r.response_code,
                response_ip: r.response_ip,
                server_ip: None,
                is_response: r.is_response,
                raw_line: String::new(),
            });
        }
    }

    let tunnel_results = detector.analyze_entries(&entries);
    let tunnel_results = sort_by_score_desc(tunnel_results);

    let intel_results = if with_intel {
        let domains: Vec<String> = tunnel_results.iter().take(top).map(|r| r.domain.clone()).collect();
        let aggregator = ThreatIntelAggregator::new(config.threat_intel.clone(), None);
        let intel_map = aggregator.lookup_domains(&domains).await;
        Some(intel_map.into_values().collect::<Vec<_>>())
    } else {
        None
    };

    let report = generator.generate(
        &db,
        &tunnel_results,
        intel_results.as_deref(),
        &time_range,
        top,
        with_whois,
    )?;

    let report_format = match format {
        cli::ReportFormat::Markdown => ReportFormat::Markdown,
        cli::ReportFormat::Html => ReportFormat::Html,
        cli::ReportFormat::Json => ReportFormat::Json,
    };

    if let Some(out_path) = output {
        generator.save_report(&report, report_format, &out_path)?;
        print_success(&format!("报告已生成: {}", out_path.display()));
    } else {
        let content = match report_format {
            ReportFormat::Markdown => generator.render_markdown(&report),
            ReportFormat::Html => generator.render_html(&report),
            ReportFormat::Json => generator.render_json(&report)?,
        };
        println!("{}", content);
    }

    Ok(())
}

async fn cmd_whois(
    domain: Option<String>,
    file: Option<PathBuf>,
    concurrency: usize,
    highlight_new: bool,
    output_format: cli::OutputFormat,
    output: Option<PathBuf>,
    no_cache: bool,
    config: &Config,
) -> Result<()> {
    validator::validate_concurrency(concurrency)?;

    let db = if !no_cache {
        Some(Arc::new(DnsDatabase::open(&config.storage.database_path)?))
    } else {
        None
    };

    let lookup = WhoisLookup::new(db.clone())
        .with_concurrency(concurrency)
        .with_cache(!no_cache);

    let domains: Vec<String> = if let Some(d) = domain {
        validator::validate_domain(&d)?;
        vec![d]
    } else if let Some(f) = file {
        read_domain_list(&f)?
    } else {
        return Err(anyhow::anyhow!("请指定域名或域名列表文件"));
    };

    print_info(&format!("正在查询 {} 个域名的WHOIS信息...", domains.len()));

    let pb = ProgressBar::new(domains.len() as u64);
    pb.set_style(ProgressStyle::default_bar()
        .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({eta})")
        .unwrap()
        .progress_chars("#>-"));

    let results = lookup.lookup_batch(&domains).await;
    pb.finish_and_clear();

    let success_count = results.iter().filter(|(_, r)| r.is_ok()).count();
    let fail_count = results.iter().filter(|(_, r)| r.is_err()).count();

    print_info(&format!("查询完成: 成功 {}, 失败 {}", success_count, fail_count));

    let ok_results: Vec<(String, WhoisResult)> = results
        .into_iter()
        .filter_map(|(d, r)| r.ok().map(|res| (d, res)))
        .collect();

    match output_format {
        cli::OutputFormat::Table => {
            print_whois_table(&ok_results, highlight_new);
        }
        cli::OutputFormat::Json => {
            let json = serde_json::to_string_pretty(&ok_results.iter().map(|(_, r)| r).collect::<Vec<_>>())?;
            if let Some(out_path) = &output {
                std::fs::write(out_path, &json)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", json);
            }
        }
        cli::OutputFormat::Csv => {
            let csv = whois_to_csv(&ok_results, highlight_new);
            if let Some(out_path) = &output {
                std::fs::write(out_path, &csv)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", csv);
            }
        }
    }

    Ok(())
}

fn print_whois_table(results: &[(String, WhoisResult)], highlight_new: bool) {
    use prettytable::{Table, Row, Cell, Attr, color};

    let mut table = Table::new();
    let mut headers = vec![
        Cell::new("域名").with_style(Attr::Bold),
        Cell::new("注册商").with_style(Attr::Bold),
        Cell::new("注册人").with_style(Attr::Bold),
        Cell::new("创建时间").with_style(Attr::Bold),
        Cell::new("过期时间").with_style(Attr::Bold),
        Cell::new("域名年龄").with_style(Attr::Bold),
    ];
    if highlight_new {
        headers.push(Cell::new("新域名").with_style(Attr::Bold));
    }
    table.add_row(Row::new(headers));

    for (_, r) in results {
        let age_str = r.age_days.map(|a| format!("{}天", a)).unwrap_or_else(|| "-".to_string());
        let creation_str = r.creation_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| "-".to_string());
        let expiration_str = r.expiration_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| "-".to_string());

        let mut cells = vec![
            Cell::new(&r.domain),
            Cell::new(r.registrar.as_deref().unwrap_or("-")),
            Cell::new(r.registrant.as_deref().unwrap_or("-")),
            Cell::new(&creation_str),
            Cell::new(&expiration_str),
            Cell::new(&age_str),
        ];

        if highlight_new {
            let is_new = r.is_new_domain;
            let new_str = if is_new { "是⚠️" } else { "否" };
            let cell = if is_new {
                Cell::new(new_str).with_style(Attr::ForegroundColor(color::RED))
            } else {
                Cell::new(new_str)
            };
            cells.push(cell);
        }

        table.add_row(Row::new(cells));
    }

    table.printstd();
}

fn whois_to_csv(results: &[(String, WhoisResult)], highlight_new: bool) -> String {
    let mut csv = String::new();
    let mut header = "域名,注册商,注册人,注册邮箱,创建时间,过期时间,更新时间,域名年龄".to_string();
    if highlight_new {
        header.push_str(",新域名");
    }
    header.push('\n');
    csv.push_str(&header);

    for (_, r) in results {
        let age_str = r.age_days.map(|a| format!("{}", a)).unwrap_or_else(|| "".to_string());
        let creation_str = r.creation_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        let expiration_str = r.expiration_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        let updated_str = r.updated_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();

        csv.push_str(&format!(
            "{},\"{}\",\"{}\",\"{}\",{},{},{},{}",
            r.domain,
            r.registrar.as_deref().unwrap_or(""),
            r.registrant.as_deref().unwrap_or(""),
            r.registrant_email.as_deref().unwrap_or(""),
            creation_str,
            expiration_str,
            updated_str,
            age_str,
        ));

        if highlight_new {
            csv.push_str(&format!(",{}", if r.is_new_domain { "是" } else { "否" }));
        }
        csv.push('\n');
    }

    csv
}

async fn cmd_intel(
    config: &Config,
    domain: Option<String>,
    refresh: bool,
    list: bool,
    source: Option<cli::IntelSource>,
    stats: bool,
) -> Result<()> {
    let aggregator = ThreatIntelAggregator::new(config.threat_intel.clone(), None);

    if stats {
        let sources = aggregator.get_sources();
        print_info(&format!("已配置的情报源: {} 个", sources.len()));
        for s in &sources {
            println!("  - {}", s.display_name());
        }
        if sources.is_empty() {
            print_warning("未配置任何威胁情报API密钥，请使用 config 命令设置");
        }
        return Ok(());
    }

    if let Some(d) = domain {
        validator::validate_domain(&d)?;
        print_info(&format!("正在查询 {} 的威胁情报...", d));

        let result = aggregator.lookup_domain(&d).await?;

        if result.is_malicious {
            print_error(&format!("域名 {} 被标记为恶意（风险评分: {}）", d, result.risk_score));
        } else {
            print_success(&format!("域名 {} 未检测到威胁（风险评分: {}）", d, result.risk_score));
        }

        for src in &result.sources {
            let status = if src.malicious { "恶意" } else { "正常" };
            println!("  [{}] {} - {}", src.source, status, src.details.as_deref().unwrap_or("无详情"));
        }

        return Ok(());
    }

    if refresh {
        print_info("刷新威胁情报缓存...");
        print_success("威胁情报缓存刷新完成（模拟）");
        return Ok(());
    }

    if list {
        print_info("缓存的威胁情报列表（当前为空）");
        return Ok(());
    }

    if source.is_some() {
        print_info("指定情报源查询功能待实现");
        return Ok(());
    }

    Err(anyhow::anyhow!("请指定操作: --domain, --refresh, --list, 或 --stats"))
}

async fn cmd_lookup(
    domain: Option<String>,
    file: Option<PathBuf>,
    record_type: cli::RecordType,
    all: bool,
    output_format: cli::OutputFormat,
) -> Result<()> {
    let lookup = DnsLookup::new()?;

    let domains: Vec<String> = if let Some(d) = domain {
        validator::validate_domain(&d)?;
        vec![d]
    } else if let Some(f) = file {
        read_domain_list(&f)?
    } else {
        return Err(anyhow::anyhow!("请指定域名或域名列表文件"));
    };

    let rt_str = match record_type {
        cli::RecordType::A => "A",
        cli::RecordType::Aaaa => "AAAA",
        cli::RecordType::Cname => "CNAME",
        cli::RecordType::Mx => "MX",
        cli::RecordType::Txt => "TXT",
        cli::RecordType::Ns => "NS",
        cli::RecordType::Soa => "SOA",
        cli::RecordType::Srv => "SRV",
        cli::RecordType::All => "ALL",
    };

    let mut all_results = Vec::new();

    for domain in &domains {
        let result = if all || rt_str == "ALL" {
            lookup.lookup_all(domain)?
        } else {
            lookup.lookup(domain, rt_str)?
        };
        all_results.push(result);
    }

    match output_format {
        cli::OutputFormat::Table => {
            print_dns_table(&all_results);
        }
        cli::OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&all_results)?);
        }
        cli::OutputFormat::Csv => {
            println!("{}", dns_results_to_csv(&all_results));
        }
    }

    Ok(())
}

fn print_dns_table(results: &[lookup::dns::DnsLookupResult]) {
    use prettytable::{Table, Row, Cell, Attr};

    let mut table = Table::new();
    table.add_row(Row::new(vec![
        Cell::new("域名").with_style(Attr::Bold),
        Cell::new("记录类型").with_style(Attr::Bold),
        Cell::new("值").with_style(Attr::Bold),
        Cell::new("TTL").with_style(Attr::Bold),
        Cell::new("优先级").with_style(Attr::Bold),
    ]));

    for r in results {
        if r.records.is_empty() {
            table.add_row(Row::new(vec![
                Cell::new(&r.domain),
                Cell::new("-"),
                Cell::new("无记录"),
                Cell::new("-"),
                Cell::new("-"),
            ]));
        }
        for rec in &r.records {
            table.add_row(Row::new(vec![
                Cell::new(&r.domain),
                Cell::new(&rec.record_type),
                Cell::new(&rec.value),
                Cell::new(&format!("{}", rec.ttl)),
                Cell::new(&rec.priority.map(|p| p.to_string()).unwrap_or_else(|| "-".to_string())),
            ]));
        }
    }

    table.printstd();
}

fn dns_results_to_csv(results: &[lookup::dns::DnsLookupResult]) -> String {
    let mut csv = String::new();
    csv.push_str("域名,记录类型,值,TTL,优先级,查询耗时(ms)\n");

    for r in results {
        for rec in &r.records {
            csv.push_str(&format!(
                "{},{},{},{},{},{}\n",
                r.domain,
                rec.record_type,
                rec.value,
                rec.ttl,
                rec.priority.map(|p| p.to_string()).unwrap_or_default(),
                r.query_time_ms
            ));
        }
    }

    csv
}

async fn cmd_trace(
    config: &Config,
    domain: Option<String>,
    ip: Option<String>,
    time_start: Option<String>,
    time_end: Option<String>,
    graph: bool,
    output_format: cli::OutputFormat,
    output: Option<PathBuf>,
    limit: usize,
) -> Result<()> {
    let db = DnsDatabase::open(&config.storage.database_path)?;

    let ts = time_start.as_deref().map(|s| {
        validator::parse_datetime(s)
    }).transpose()?;
    let te = time_end.as_deref().map(|s| {
        validator::parse_datetime(s)
    }).transpose()?;

    if let (Some(start), Some(end)) = (ts, te) {
        if start >= end {
            return Err(anyhow::anyhow!("开始时间必须早于结束时间"));
        }
    }

    let records: Vec<DnsRecord> = if let Some(d) = domain {
        validator::validate_domain(&d)?;
        if graph {
            let relation_graph = db.get_relation_graph(&d, ts, te, 3)?;
            match output_format {
                cli::OutputFormat::Json => {
                    let json = serde_json::to_string_pretty(&relation_graph)?;
                    if let Some(out_path) = &output {
                        std::fs::write(out_path, &json)?;
                        print_success(&format!("关联图谱已保存到: {}", out_path.display()));
                    } else {
                        println!("{}", json);
                    }
                    return Ok(());
                }
                _ => {
                    print_info(&format!("关联图谱: {} 个节点, {} 条边",
                        relation_graph.nodes.len(),
                        relation_graph.edges.len()
                    ));
                    println!("节点:");
                    for node in &relation_graph.nodes {
                        println!("  [{}] {} ({})", node.node_type, node.label, node.id);
                    }
                    println!("边:");
                    for edge in &relation_graph.edges {
                        println!("  {} -> {} ({})", edge.source, edge.target, edge.label.as_deref().unwrap_or(""));
                    }
                    return Ok(());
                }
            }
        }
        db.query_by_domain(&d, ts, te, limit)?
    } else if let Some(i) = ip {
        validator::validate_ip(&i)?;
        db.query_by_ip(&i, ts, te, limit)?
    } else {
        return Err(anyhow::anyhow!("请指定域名(--domain)或IP(--ip)"));
    };

    print_info(&format!("找到 {} 条相关记录", records.len()));

    match output_format {
        cli::OutputFormat::Table => {
            print_trace_table(&records);
        }
        cli::OutputFormat::Json => {
            let json = serde_json::to_string_pretty(&records)?;
            if let Some(out_path) = &output {
                std::fs::write(out_path, &json)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", json);
            }
        }
        cli::OutputFormat::Csv => {
            let csv = trace_to_csv(&records);
            if let Some(out_path) = &output {
                std::fs::write(out_path, &csv)?;
                print_success(&format!("结果已保存到: {}", out_path.display()));
            } else {
                println!("{}", csv);
            }
        }
    }

    Ok(())
}

fn print_trace_table(records: &[DnsRecord]) {
    use prettytable::{Table, Row, Cell, Attr};

    let mut table = Table::new();
    table.add_row(Row::new(vec![
        Cell::new("时间").with_style(Attr::Bold),
        Cell::new("客户端IP").with_style(Attr::Bold),
        Cell::new("查询域名").with_style(Attr::Bold),
        Cell::new("记录类型").with_style(Attr::Bold),
        Cell::new("响应码").with_style(Attr::Bold),
        Cell::new("响应IP").with_style(Attr::Bold),
    ]));

    for r in records {
        table.add_row(Row::new(vec![
            Cell::new(&r.timestamp.format("%Y-%m-%d %H:%M:%S").to_string()),
            Cell::new(&r.client_ip),
            Cell::new(&r.query_domain),
            Cell::new(&r.query_type),
            Cell::new(r.response_code.as_deref().unwrap_or("-")),
            Cell::new(r.response_ip.as_deref().unwrap_or("-")),
        ]));
    }

    table.printstd();
}

fn trace_to_csv(records: &[DnsRecord]) -> String {
    let mut csv = String::new();
    csv.push_str("时间,客户端IP,查询域名,记录类型,查询类,响应码,响应IP,是否响应\n");

    for r in records {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            r.timestamp.format("%Y-%m-%d %H:%M:%S"),
            r.client_ip,
            r.query_domain,
            r.query_type,
            r.query_class,
            r.response_code.as_deref().unwrap_or(""),
            r.response_ip.as_deref().unwrap_or(""),
            r.is_response
        ));
    }

    csv
}

fn cmd_config(
    config: &Config,
    init: bool,
    show: bool,
    show_path: bool,
    set: Option<String>,
    add_whitelist: Option<String>,
    remove_whitelist: Option<String>,
    example: bool,
) -> Result<()> {
    if example {
        print_info("示例配置文件内容:");
        let default = Config::default();
        println!("{}", toml::to_string_pretty(&default)?);
        return Ok(());
    }

    if show_path {
        println!("{}", Config::config_path().display());
        return Ok(());
    }

    if init {
        if Config::config_path().exists() {
            print_warning("配置文件已存在，将被覆盖");
        }
        config.save()?;
        print_success(&format!("配置文件已初始化: {}", Config::config_path().display()));
        return Ok(());
    }

    if show {
        print_info("当前配置:");
        println!("{}", toml::to_string_pretty(config)?);
        return Ok(());
    }

    if let Some(set_val) = set {
        let parts: Vec<&str> = set_val.splitn(2, '=').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("参数格式错误，请使用 key=value 格式"));
        }
        let key = parts[0];
        let value = parts[1];

        let mut new_config = config.clone();

        match key {
            "virustotal_api_key" => {
                new_config.threat_intel.virustotal_api_key = Some(value.to_string());
            }
            "alienvault_api_key" => {
                new_config.threat_intel.alienvault_api_key = Some(value.to_string());
            }
            "threatbook_api_key" => {
                new_config.threat_intel.threatbook_api_key = Some(value.to_string());
            }
            "txt_entropy_threshold" => {
                new_config.detection.txt_entropy_threshold = value.parse()?;
            }
            "query_frequency_threshold" => {
                new_config.detection.query_frequency_threshold = value.parse()?;
            }
            "log_retention_days" => {
                new_config.storage.log_retention_days = value.parse()?;
            }
            _ => {
                return Err(anyhow::anyhow!("不支持的配置项: {}", key));
            }
        }

        new_config.save()?;
        print_success(&format!("已设置 {} = {}", key, value));
        return Ok(());
    }

    if let Some(domain) = add_whitelist {
        validator::validate_domain(&domain)?;
        let mut new_config = config.clone();
        if !new_config.whitelist.iter().any(|d| d.eq_ignore_ascii_case(&domain)) {
            new_config.whitelist.push(domain.clone());
            new_config.save()?;
            print_success(&format!("已添加白名单域名: {}", domain));
        } else {
            print_warning(&format!("域名 {} 已在白名单中", domain));
        }
        return Ok(());
    }

    if let Some(domain) = remove_whitelist {
        let mut new_config = config.clone();
        let original_len = new_config.whitelist.len();
        new_config.whitelist.retain(|d| !d.eq_ignore_ascii_case(&domain));
        if new_config.whitelist.len() < original_len {
            new_config.save()?;
            print_success(&format!("已移除白名单域名: {}", domain));
        } else {
            print_warning(&format!("域名 {} 不在白名单中", domain));
        }
        return Ok(());
    }

    print_info("配置管理命令");
    println!("  查看配置路径: dns-sec config --path");
    println!("  初始化配置:   dns-sec config --init");
    println!("  显示配置:     dns-sec config --show");
    println!("  设置配置项:   dns-sec config --set key=value");
    println!("  添加白名单:   dns-sec config --add-whitelist domain.com");
    println!("  移除白名单:   dns-sec config --remove-whitelist domain.com");
    println!("  查看示例:     dns-sec config --example");

    Ok(())
}
