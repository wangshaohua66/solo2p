use chrono::Utc;
use colored::*;
use rayon::prelude::*;
use std::fs;
use std::path::PathBuf;
use structopt::StructOpt;

mod cli;
mod calculator {
    pub mod fee;
    pub mod dispute;
}
mod db {
    pub mod schema;
    pub mod operations;
}
mod export {
    pub mod report;
}
mod models {
    pub mod ship;
    pub mod port;
}
mod utils {
    pub mod formatter;
}

use cli::{AppConfig, Cli, Command, RateAction, ConfigAction, CompletionArgs};
use crate::calculator::dispute::DisputeRecord;
use crate::calculator::fee::{BatchComputeSummary, FeeCalculator, summarize_batch};
use crate::db::operations::{Database, compute_aging_analysis, compute_monthly_summary};
use crate::export::report::{
    generate_fee_category_summary, generate_fee_detail_table, generate_history_chart,
    generate_monthly_report,
};
use crate::models::port::{
    FeeCategory, RateRule, TierRate, default_rate_rules, parse_effective_date,
};
use crate::models::ship::{Ship, VesselType, validate_imo};
use crate::utils::formatter;

fn get_config_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".ship_agent").join("config.toml")
}

fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".ship_agent");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir.join("ship_agent.db")
}

fn load_config() -> AppConfig {
    let path = get_config_path();
    if let Ok(content) = fs::read_to_string(&path) {
        toml::from_str(&content).unwrap_or_default()
    } else {
        let default = AppConfig::default();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(toml_str) = toml::to_string_pretty(&default) {
            let _ = fs::write(&path, toml_str);
        }
        default
    }
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let toml_str = toml::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, toml_str).map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_default_rates(db: &Database) -> Result<(), String> {
    let ports = db.list_ports().map_err(|e| e.to_string())?;
    let existing = db.list_rate_rules(None, None, true).map_err(|e| e.to_string())?;
    
    if !existing.is_empty() {
        return Ok(());
    }

    for port in &ports {
        let rules = default_rate_rules(&port.code);
        for rule in rules {
            let _ = db.insert_rate_rule(&rule);
        }
    }
    Ok(())
}

fn cmd_add(args: &cli::AddArgs, db: &Database) -> Result<(), String> {
    let imo = args.imo.trim().to_string();
    validate_imo(&imo).map_err(|e| e.to_string())?;

    let vessel_type = VesselType::from_str(&args.vessel_type).map_err(|e| e.to_string())?;
    let arrival = Ship::parse_datetime(&args.arrival_time).map_err(|e| e.to_string())?;
    let departure = Ship::parse_datetime(&args.departure_time).map_err(|e| e.to_string())?;

    let ship = Ship::new(
        imo.clone(),
        args.vessel_name.clone(),
        vessel_type,
        args.net_tonnage,
        arrival,
        departure,
        args.port_code.to_uppercase(),
        args.cargo_tonnage,
        args.pilot_hours,
        args.tug_count,
        args.tug_hours,
    )
    .map_err(|e| e.to_string())?;

    let conflicts = db.find_conflicting_ships(&ship).map_err(|e| e.to_string())?;

    if !conflicts.is_empty() {
        formatter::warn(&format!(
            "检测到 {} 条冲突记录（IMO:{} 抵港时间:{}）",
            conflicts.len(),
            ship.imo,
            formatter::format_datetime(&ship.arrival_time)
        ));

        for (i, existing) in conflicts.iter().enumerate() {
            println!("\n  【冲突记录 #{}】", i + 1);
            println!("    船名: {} (原: {})", ship.vessel_name, existing.vessel_name);
            println!("    船型: {} (原: {})", vessel_type.display_name(), existing.vessel_type.display_name());
            println!("    净吨位: {} NT (原: {} NT)", ship.net_tonnage, existing.net_tonnage);
            println!("    抵港: {} (原: {})",
                formatter::format_datetime(&ship.arrival_time),
                formatter::format_datetime(&existing.arrival_time));
            println!("    离港: {} (原: {})",
                formatter::format_datetime(&ship.departure_time),
                formatter::format_datetime(&existing.departure_time));
            println!("    港口: {} (原: {})", ship.port_code, existing.port_code);
            println!("    货物吨数: {} (原: {})", ship.cargo_tonnage, existing.cargo_tonnage);
        }

        println!("\n请选择处理方式:");
        println!("  [O] 覆盖原有记录 (默认)");
        println!("  [S] 跳过不插入");
        println!("  [U] 仅更新变动字段");
        println!("  [C] 取消操作");
        print!("  请输入选择 [O/S/U/C]: ");
        use std::io::{self, Write};
        io::stdout().flush().unwrap();

        let mut choice = String::new();
        io::stdin().read_line(&mut choice).unwrap();
        let choice = choice.trim().to_uppercase();

        match choice.as_str() {
            "S" => {
                formatter::warn("已跳过，未插入新记录");
                return Ok(());
            }
            "C" => {
                formatter::warn("操作已取消");
                return Ok(());
            }
            "U" => {
                db.update_ship(&ship).map_err(|e| e.to_string())?;
                formatter::success("已更新变动字段");
            }
            _ => {
                let id = db.insert_ship(&ship).map_err(|e| e.to_string())?;
                formatter::success(&format!("已覆盖原有记录，新ID: {}", id));
            }
        }
    } else {
        let id = db.insert_ship(&ship).map_err(|e| e.to_string())?;

        formatter::success(&format!(
            "船舶信息录入成功 | ID: {} | IMO: {} | 船名: {} | 船型: {} | 港口: {}",
            id,
            ship.imo,
            ship.vessel_name,
            vessel_type.display_name(),
            ship.port_code
        ));

        formatter::info(&format!(
            "净吨位: {} NT | 抵港: {} | 离港: {} | 停泊: {:.1}小时",
            ship.net_tonnage,
            formatter::format_datetime(&ship.arrival_time),
            formatter::format_datetime(&ship.departure_time),
            ship.berthing_hours()
        ));
    }

    Ok(())
}

fn cmd_compute(
    args: &cli::ComputeArgs,
    db: &Database,
    config: &AppConfig,
) -> Result<(), String> {
    let date_range = args
        .date_range
        .as_ref()
        .map(|r| formatter::parse_date_range(r))
        .transpose()?;

    let (date_from, date_to) = match date_range {
        Some((f, t)) => (Some(f), Some(t)),
        None => (None, None),
    };

    let (imo, vessel_name) = match &args.vessel {
        Some(v) => {
            if v.chars().all(|c| c.is_ascii_digit()) && v.len() == 7 {
                (Some(v.as_str()), None)
            } else {
                (None, Some(v.as_str()))
            }
        }
        None => (None, None),
    };

    let ships = db
        .find_ships(imo, args.port.as_deref(), date_from, date_to, 10000)
        .map_err(|e| e.to_string())?;

    if ships.is_empty() {
        formatter::warn("未找到符合条件的船舶记录");
        return Ok(());
    }

    ensure_default_rates(db)?;
    let port_configs = db.load_port_rate_configs().map_err(|e| e.to_string())?;
    let calculator = FeeCalculator::new(&port_configs);

    formatter::info(&format!("开始计算 {} 艘船舶的港口使费...", ships.len()));
    let start = std::time::Instant::now();

    let results = calculator.calculate_batch(&ships);
    let summary = summarize_batch(&results);

    let elapsed = start.elapsed();
    formatter::success(&format!(
        "计算完成 | 成功: {} / 失败: {} | 用时: {:.2}ms | 单艘平均: {:.2}ms",
        summary.success_count,
        summary.failed_count,
        elapsed.as_secs_f64() * 1000.0,
        elapsed.as_secs_f64() * 1000.0 / summary.total_ships as f64
    ));

    let config_clone = config.clone();

    if args.save {
        let mut saved_count = 0;
        for (_, result) in &results {
            if let Ok(fee) = result {
                if db.insert_fee_result(fee).is_ok() {
                    saved_count += 1;
                }
            }
        }
        formatter::success(&format!("已保存 {} 条费用记录", saved_count));
    }

    for (_, result) in &results {
        match result {
            Ok(fee) => {
                println!("\n{}", "═".repeat(60).cyan().bold());
                let _ = generate_fee_detail_table(fee, &config_clone, args.verbose);
            }
            Err(e) => {
                formatter::error(&e.to_string());
            }
        }
    }

    print_batch_summary(&summary, &config_clone);
    Ok(())
}

fn print_batch_summary(summary: &BatchComputeSummary, config: &AppConfig) {
    formatter::section_title("批量计算汇总");

    let mut buf = Vec::new();
    {
        use tabwriter::TabWriter;
        use std::io::Write;
        let mut tw = TabWriter::new(&mut buf);

        writeln!(tw, "{}", "指标\t数值".white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(40).dimmed()).unwrap();
        writeln!(tw, "总船舶数\t{}", summary.total_ships).unwrap();
        writeln!(tw, "成功计算\t{}", summary.success_count).unwrap();
        writeln!(tw, "计算失败\t{}", summary.failed_count).unwrap();
        writeln!(
            tw,
            "总费用合计\t{}",
            formatter::format_currency(summary.total_grand_total, &config.currency_symbol, config.decimals)
                .bold()
        )
        .unwrap();
        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));

    if !summary.port_breakdown.is_empty() {
        formatter::section_title("港口分布");
        let mut port_buf = Vec::new();
        {
            use tabwriter::TabWriter;
            use std::io::Write;
            let mut tw = TabWriter::new(&mut port_buf);
            writeln!(tw, "{}", "港口\t艘次\t费用合计\t占比".white().bold()).unwrap();
            writeln!(tw, "{}", "─".repeat(60).dimmed()).unwrap();

            let max = summary
                .port_breakdown
                .values()
                .map(|(_, amt)| *amt)
                .fold(0.0_f64, f64::max);

            let mut sorted_ports: Vec<_> = summary.port_breakdown.iter().collect();
            sorted_ports.sort_by(|a, b| b.1 .1.partial_cmp(&a.1 .1).unwrap_or(std::cmp::Ordering::Equal));

            for (port, (cnt, amt)) in sorted_ports {
                let pct = if summary.total_grand_total > 0.0 {
                    amt / summary.total_grand_total * 100.0
                } else {
                    0.0
                };
                let bar = formatter::render_bar(*amt, max, 15);
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{:.1}% {}",
                    port,
                    cnt,
                    formatter::format_currency(*amt, &config.currency_symbol, config.decimals),
                    pct,
                    bar
                )
                .unwrap();
            }
            tw.flush().unwrap();
        }
        println!("{}", String::from_utf8_lossy(&port_buf));
    }

    if !summary.errors.is_empty() {
        formatter::warn(&format!("共 {} 条计算错误:", summary.errors.len()));
        for (idx, msg) in &summary.errors {
            eprintln!("  [{}] {}", idx + 1, msg.red());
        }
    }
}

fn cmd_rate(args: &cli::RateArgs, db: &Database, config: &AppConfig) -> Result<(), String> {
    match &args.action {
        RateAction::Add(add_args) => cmd_rate_add(add_args, db),
        RateAction::Update(update_args) => cmd_rate_update(update_args, db),
        RateAction::List(list_args) => cmd_rate_list(list_args, db, config),
        RateAction::Delete(delete_args) => cmd_rate_delete(delete_args, db),
    }
}

fn cmd_rate_add(args: &cli::RateAddArgs, db: &Database) -> Result<(), String> {
    let category = std::str::FromStr::from_str(&args.fee_category).map_err(|e| e.to_string())?;
    let tier = TierRate::new(
        args.tier_from,
        args.tier_to,
        args.unit_rate,
        args.base_fee,
    )
    .map_err(|e| e.to_string())?;
    let effective_date = parse_effective_date(&args.effective_date).map_err(|e| e.to_string())?;

    let rule = RateRule::new(
        args.port_code.to_uppercase(),
        category,
        tier,
        effective_date,
    )
    .map_err(|e| e.to_string())?;

    let id = db.insert_rate_rule(&rule).map_err(|e| e.to_string())?;

    formatter::success(&format!(
        "费率规则已新增 | ID: {} | 港口: {} | 类别: {} | 阶梯: {}-{} | 费率: {}元/单位",
        id,
        rule.port_code,
        category.display_name(),
        args.tier_from,
        if args.tier_to == 0.0 { "∞".to_string() } else { args.tier_to.to_string() },
        args.unit_rate
    ));
    Ok(())
}

fn cmd_rate_update(args: &cli::RateUpdateArgs, db: &Database) -> Result<(), String> {
    let effective = args
        .effective_date
        .as_ref()
        .map(|d| parse_effective_date(d))
        .transpose()
        .map_err(|e| e.to_string())?;

    db.update_rate_rule(args.rule_id, args.unit_rate, args.base_fee, effective)
        .map_err(|e| e.to_string())?;

    formatter::success(&format!("费率规则 ID:{} 已更新", args.rule_id));
    Ok(())
}

fn cmd_rate_list(
    args: &cli::RateListArgs,
    db: &Database,
    config: &AppConfig,
) -> Result<(), String> {
    let rules = db
        .list_rate_rules(args.port_code.as_deref(), args.fee_category.as_deref(), args.active_only)
        .map_err(|e| e.to_string())?;

    if rules.is_empty() {
        formatter::warn("未找到费率规则");
        return Ok(());
    }

    formatter::header(&format!("费率规则列表 (共{}条)", rules.len()));

    let mut buf = Vec::new();
    {
        use tabwriter::TabWriter;
        use std::io::Write;
        let mut tw = TabWriter::new(&mut buf);

        writeln!(
            tw,
            "{}",
            "ID\t港口\t费用类别\t阶梯区间\t基础费\t费率\t生效日期\t状态"
                .white()
                .bold()
        )
        .unwrap();
        writeln!(tw, "{}", "─".repeat(100).dimmed()).unwrap();

        for r in &rules {
            let tier_to = if r.tier.tier_to == 0.0 {
                "∞".to_string()
            } else {
                format!("{}", r.tier.tier_to)
            };
            let status = if r.is_active {
                "✓ 生效".green().to_string()
            } else {
                "✗ 停用".red().to_string()
            };

            writeln!(
                tw,
                "{}\t{}\t{}\t{}-{}\t{}\t{}\t{}\t{}",
                r.id.unwrap_or(0),
                r.port_code,
                r.fee_category.display_name(),
                r.tier.tier_from,
                tier_to,
                formatter::format_currency(r.tier.base_fee, &config.currency_symbol, config.decimals),
                format!("{}/单位", r.tier.unit_rate),
                formatter::format_date(&r.effective_date),
                status
            )
            .unwrap();
        }

        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));
    Ok(())
}

fn cmd_rate_delete(args: &cli::RateDeleteArgs, db: &Database) -> Result<(), String> {
    db.delete_rate_rule(args.rule_id).map_err(|e| e.to_string())?;
    formatter::success(&format!("费率规则 ID:{} 已停用", args.rule_id));
    Ok(())
}

fn cmd_dispute(
    args: &cli::DisputeArgs,
    db: &Database,
    config: &AppConfig,
) -> Result<(), String> {
    let mut fee_record = db
        .get_fee_record(args.fee_record_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("费用记录 ID:{} 不存在", args.fee_record_id))?;

    let mut dispute = DisputeRecord::new(
        args.fee_record_id,
        args.reason.clone(),
        args.requester.clone(),
        &fee_record,
        &args.adjustments,
    )
    .map_err(|e| e.to_string())?;

    if args.submit {
        dispute.submit().map_err(|e| e.to_string())?;
    }

    if args.approve {
        if args.submit {
            dispute.approve(args.approver.clone(), None).map_err(|e| e.to_string())?;
        } else {
            return Err("必须先使用--submit提交审批".to_string());
        }
    }

    let dispute_id = db.insert_dispute(&dispute).map_err(|e| e.to_string())?;
    dispute.id = Some(dispute_id);

    if args.approve {
        dispute.apply(&mut fee_record).map_err(|e| e.to_string())?;
        db.update_dispute_status(&dispute).map_err(|e| e.to_string())?;
    }

    formatter::header("费用争议处理");
    formatter::info(&format!(
        "争议ID: {} | 费用记录ID: {} | 原因: {}",
        dispute_id, args.fee_record_id, args.reason
    ));
    formatter::info(&format!(
        "申请人: {} | 状态: {}",
        args.requester,
        dispute.status.as_str()
    ));

    print_dispute_comparison(&dispute, config);

    if args.approve {
        formatter::success("争议已审批通过并执行调整");
        let _ = generate_fee_detail_table(&fee_record, config, true);
    } else if args.submit {
        formatter::warn("争议已提交审批，请审批人使用 --approve 参数完成审批");
    } else {
        formatter::info("争议已创建（草稿状态），使用 --submit 提交审批");
    }

    Ok(())
}

fn print_dispute_comparison(dispute: &DisputeRecord, config: &AppConfig) {
    use tabwriter::TabWriter;
    use std::io::Write;

    formatter::section_title("调整明细对比");

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        writeln!(
            tw,
            "{}",
            "费用类别\t调整前\t调整额\t调整后"
                .white()
                .bold()
        )
        .unwrap();
        writeln!(tw, "{}", "─".repeat(70).dimmed()).unwrap();

        for adj in &dispute.adjustments {
            let delta = if adj.adjust_amount > 0.0 {
                format!("+{}", formatter::format_currency(adj.adjust_amount, &config.currency_symbol, config.decimals))
                    .red()
                    .to_string()
            } else if adj.adjust_amount < 0.0 {
                formatter::format_currency(adj.adjust_amount, &config.currency_symbol, config.decimals)
                    .green()
                    .to_string()
            } else {
                formatter::format_currency(0.0, &config.currency_symbol, config.decimals).dimmed().to_string()
            };

            writeln!(
                tw,
                "{}\t{}\t{}\t{}",
                adj.category.display_name(),
                formatter::format_currency(adj.original_amount, &config.currency_symbol, config.decimals),
                delta,
                formatter::format_currency(adj.final_amount, &config.currency_symbol, config.decimals)
                    .bold()
            )
            .unwrap();
        }

        writeln!(tw, "{}", "─".repeat(70).dimmed()).unwrap();

        let delta_total = if dispute.delta_total > 0.0 {
            format!("+{}", formatter::format_currency(dispute.delta_total, &config.currency_symbol, config.decimals))
                .red()
                .bold()
                .to_string()
        } else if dispute.delta_total < 0.0 {
            formatter::format_currency(dispute.delta_total, &config.currency_symbol, config.decimals)
                .green()
                .bold()
                .to_string()
        } else {
            formatter::format_currency(0.0, &config.currency_symbol, config.decimals).to_string()
        };

        writeln!(
            tw,
            "{}\t{}\t{}\t{}",
            "合计".bold(),
            formatter::format_currency(dispute.original_total, &config.currency_symbol, config.decimals)
                .bold(),
            delta_total,
            formatter::format_currency(dispute.adjusted_total, &config.currency_symbol, config.decimals)
                .magenta()
                .bold()
        )
        .unwrap();

        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));
}

fn cmd_report(
    args: &cli::ReportArgs,
    db: &Database,
    config: &AppConfig,
) -> Result<(), String> {
    let (year, month) = formatter::parse_month(&args.month)?;
    let summaries = compute_monthly_summary(db, year, month, args.by_port, args.by_vessel_type)
        .map_err(|e| e.to_string())?;

    let aging = if args.include_aging {
        compute_aging_analysis(db).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    generate_monthly_report(
        &summaries,
        &aging,
        year,
        month,
        config,
        &args.format,
        args.output.as_deref(),
        args.include_aging,
        args.verbose,
    )
    .map_err(|e| e.to_string())
}

fn cmd_import(args: &cli::ImportArgs, db: &Database, _config: &AppConfig) -> Result<(), String> {
    if args.files.is_empty() {
        return Err("请指定至少一个CSV文件路径".to_string());
    }

    formatter::info(&format!(
        "开始导入 {} 个文件，并行度: {}",
        args.files.len(),
        args.jobs
    ));

    let all_results: Vec<_> = args
        .files
        .par_iter()
        .map(|file_path| process_import_file(file_path, args.skip_errors))
        .collect();

    let mut total_success = 0;
    let mut total_failed = 0;
    let mut total_skipped = 0;
    let mut all_errors: Vec<(String, usize, String)> = Vec::new();

    for (file, result) in args.files.iter().zip(all_results.iter()) {
        match result {
            Ok((success, skipped, errors)) => {
                if !args.dry_run {
                    total_success += success;
                    total_failed += errors.len();
                    total_skipped += skipped;
                }
                formatter::info(&format!(
                    "文件: {} | 成功: {} | 跳过: {} | 错误: {}",
                    file,
                    success,
                    skipped,
                    errors.len()
                ));
                for (line, msg) in errors {
                    all_errors.push((file.clone(), *line, msg.clone()));
                }
            }
            Err(e) => {
                formatter::error(&format!("文件: {} | 致命错误: {}", file, e));
            }
        }
    }

    if args.dry_run {
        formatter::warn("DRY-RUN 模式：以上为预览结果，未实际写入数据库");
    } else {
        formatter::success(&format!(
            "导入完成 | 成功: {} | 跳过: {} | 失败: {}",
            total_success, total_skipped, total_failed
        ));

        if !args.skip_errors && !all_errors.is_empty() {
            formatter::error(&format!("共 {} 条错误:", all_errors.len()));
            for (file, line, msg) in all_errors.iter().take(10) {
                eprintln!("  {}:{} - {}", file, line, msg);
            }
            if all_errors.len() > 10 {
                eprintln!("  ... 还有 {} 条错误", all_errors.len() - 10);
            }
        }
    }

    Ok(())
}

fn process_import_file(
    file_path: &str,
    skip_errors: bool,
) -> Result<(usize, usize, Vec<(usize, String)>), String> {
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(content.as_bytes());

    let mut success = 0;
    let mut skipped = 0;
    let mut errors = Vec::new();

    let headers = reader
        .headers()
        .map_err(|e| e.to_string())?
        .clone();

    for (line_num, result) in reader.records().enumerate() {
        let line = line_num + 2;
        match result {
            Ok(record) => {
                match parse_csv_row(&record, &headers) {
                    Ok(ship) => {
                        if let Err(e) = validate_imo(&ship.imo) {
                            errors.push((line, format!("IMO校验失败: {}", e)));
                            if !skip_errors {
                                continue;
                            }
                            skipped += 1;
                            continue;
                        }
                        match Database::open(get_db_path())
                            .and_then(|db| db.insert_ship(&ship).map(|_| ()))
                        {
                            Ok(_) => success += 1,
                            Err(e) => {
                                errors.push((line, format!("数据库插入失败: {}", e)));
                                if !skip_errors {
                                    continue;
                                }
                                skipped += 1;
                            }
                        }
                    }
                    Err(e) => {
                        errors.push((line, e));
                        if !skip_errors {
                            continue;
                        }
                        skipped += 1;
                    }
                }
            }
            Err(e) => {
                errors.push((line, format!("CSV解析错误: {}", e)));
                if !skip_errors {
                    continue;
                }
                skipped += 1;
            }
        }
    }

    Ok((success, skipped, errors))
}

fn parse_csv_row(
    record: &csv::StringRecord,
    headers: &csv::StringRecord,
) -> Result<Ship, String> {
    let get_field = |name: &str| -> Result<String, String> {
        let idx = headers
            .iter()
            .position(|h| h.trim().eq_ignore_ascii_case(name))
            .ok_or_else(|| format!("缺少列: {}", name))?;
        Ok(record.get(idx).unwrap_or("").trim().to_string())
    };

    let get_opt = |name: &str| -> Option<String> {
        headers
            .iter()
            .position(|h| h.trim().eq_ignore_ascii_case(name))
            .and_then(|idx| record.get(idx))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };

    let imo = get_field("imo")?;
    let vessel_name = get_field("vessel_name").or_else(|_| get_field("name"))?;
    let vessel_type_str = get_field("vessel_type").or_else(|_| get_field("type"))?;
    let net_tonnage: f64 = get_field("net_tonnage")?
        .parse()
        .map_err(|_| "净吨位格式错误".to_string())?;
    let arrival_str = get_field("arrival_time").or_else(|_| get_field("arrival"))?;
    let departure_str = get_field("departure_time").or_else(|_| get_field("departure"))?;
    let port_code = get_field("port_code").or_else(|_| get_field("port"))?;

    let vessel_type = VesselType::from_str(&vessel_type_str).map_err(|e| e.to_string())?;
    let arrival = Ship::parse_datetime(&arrival_str).map_err(|e| e.to_string())?;
    let departure = Ship::parse_datetime(&departure_str).map_err(|e| e.to_string())?;

    let cargo_tonnage: f64 = get_opt("cargo_tonnage")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let pilot_hours: f64 = get_opt("pilot_hours")
        .and_then(|s| s.parse().ok())
        .unwrap_or(4.0);
    let tug_count: u32 = get_opt("tug_count")
        .and_then(|s| s.parse().ok())
        .unwrap_or(2);
    let tug_hours: f64 = get_opt("tug_hours")
        .and_then(|s| s.parse().ok())
        .unwrap_or(3.0);

    Ship::new(
        imo,
        vessel_name,
        vessel_type,
        net_tonnage,
        arrival,
        departure,
        port_code.to_uppercase(),
        cargo_tonnage,
        pilot_hours,
        tug_count,
        tug_hours,
    )
    .map_err(|e| e.to_string())
}

fn cmd_history(
    args: &cli::HistoryArgs,
    db: &Database,
    config: &AppConfig,
) -> Result<(), String> {
    let (imo, vessel_name) = if args.imo.is_some() && args.vessel_name.is_none() {
        (args.imo.as_deref(), None)
    } else if args.vessel_name.is_some() && args.imo.is_none() {
        (None, args.vessel_name.as_deref())
    } else if args.imo.is_some() && args.vessel_name.is_some() {
        (args.imo.as_deref(), args.vessel_name.as_deref())
    } else {
        return Err("请指定 --imo 或 --vessel-name 至少一项".to_string());
    };

    let records = db
        .find_fee_records(imo, vessel_name, args.port.as_deref(), None, None, args.year)
        .map_err(|e| e.to_string())?;

    if records.is_empty() {
        formatter::warn("未找到历史费用记录");
        return Ok(());
    }

    formatter::header(&format!(
        "历史费用查询 | 共 {} 条记录",
        records.len()
    ));

    if let Some(y) = args.year {
        formatter::info(&format!("指定年份: {}", y));
    }
    if let Some(p) = &args.port {
        formatter::info(&format!("指定港口: {}", p));
    }

    let total: f64 = records.iter().map(|r| r.grand_total).sum();
    let avg: f64 = if records.is_empty() {
        0.0
    } else {
        total / records.len() as f64
    };

    formatter::info(&format!(
        "费用总计: {} | 单次平均: {}",
        formatter::format_currency(total, &config.currency_symbol, config.decimals).bold(),
        formatter::format_currency(avg, &config.currency_symbol, config.decimals)
    ));

    if args.show_chart {
        println!("{}", generate_history_chart(&records, config));
    }

    if args.verbose {
        formatter::section_title("费用类别汇总");
        println!("{}", generate_fee_category_summary(&records, config));
    }

    formatter::section_title("记录明细");

    use tabwriter::TabWriter;
    use std::io::Write;

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        let header = if args.verbose {
            "ID\tIMO\t船名\t港口\t抵港日期\t价税合计\t已收\t争议\t状态"
        } else {
            "IMO\t船名\t港口\t抵港日期\t价税合计\t状态"
        };
        writeln!(tw, "{}", header.white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(if args.verbose { 100 } else { 70 }).dimmed()).unwrap();

        for fee in &records {
            let status = if fee.is_settled {
                "已结算".green().to_string()
            } else {
                "待结算".yellow().to_string()
            };
            let dispute = if fee.has_dispute {
                "⚠有调整".yellow().to_string()
            } else {
                "-".to_string()
            };

            if args.verbose {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
                    fee.id.unwrap_or(0),
                    fee.imo,
                    fee.vessel_name,
                    fee.port_code,
                    formatter::format_date(&fee.arrival_time),
                    formatter::format_currency(fee.grand_total, &config.currency_symbol, config.decimals),
                    formatter::format_currency(fee.settled_amount, &config.currency_symbol, config.decimals),
                    dispute,
                    status
                )
                .unwrap();
            } else {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}\t{}",
                    fee.imo,
                    fee.vessel_name,
                    fee.port_code,
                    formatter::format_date(&fee.arrival_time),
                    formatter::format_currency(fee.grand_total, &config.currency_symbol, config.decimals).bold(),
                    status
                )
                .unwrap();
            }
        }
        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));

    Ok(())
}

fn cmd_config(args: &cli::ConfigArgs) -> Result<(), String> {
    match &args.action {
        ConfigAction::Set(set_args) => cmd_config_set(set_args),
        ConfigAction::Get(get_args) => cmd_config_get(&get_args.key),
        ConfigAction::List => cmd_config_list(),
        ConfigAction::Reset => cmd_config_reset(),
    }
}

fn cmd_config_set(args: &cli::ConfigSetArgs) -> Result<(), String> {
    let mut config = load_config();
    let mut changed = false;

    if let Some(v) = &args.default_port {
        config.default_port = v.to_uppercase();
        changed = true;
    }
    if let Some(v) = &args.output_format {
        match v.as_str() {
            "table" | "csv" | "json" => {
                config.output_format = v.clone();
                changed = true;
            }
            _ => return Err("output_format 必须是 table/csv/json".to_string()),
        }
    }
    if let Some(v) = args.decimals {
        if v > 6 {
            return Err("decimals 必须在 0-6 之间".to_string());
        }
        config.decimals = v;
        changed = true;
    }
    if let Some(v) = &args.currency_symbol {
        config.currency_symbol = v.clone();
        changed = true;
    }
    if let Some(v) = args.page_size {
        if v == 0 {
            return Err("page_size 必须大于0".to_string());
        }
        config.page_size = v;
        changed = true;
    }
    if let Some(v) = &args.color_mode {
        match v.as_str() {
            "auto" | "always" | "never" => {
                config.color_mode = v.clone();
                changed = true;
            }
            _ => return Err("color_mode 必须是 auto/always/never".to_string()),
        }
    }

    if !changed {
        formatter::warn("未指定任何配置项");
        return Ok(());
    }

    save_config(&config)?;
    formatter::success("配置已保存");
    cmd_config_list()
}

fn cmd_config_get(key: &str) -> Result<(), String> {
    let config = load_config();
    let value = match key {
        "default_port" => config.default_port,
        "output_format" => config.output_format,
        "decimals" => config.decimals.to_string(),
        "currency_symbol" => config.currency_symbol,
        "page_size" => config.page_size.to_string(),
        "color_mode" => config.color_mode,
        _ => return Err(format!("未知配置项: {}", key)),
    };
    println!("{} = {}", key.bold(), value);
    Ok(())
}

fn cmd_config_list() -> Result<(), String> {
    let config = load_config();
    let path = get_config_path();

    formatter::header("系统配置");
    formatter::info(&format!("配置文件路径: {}", path.display()));

    use tabwriter::TabWriter;
    use std::io::Write;

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        writeln!(tw, "{}", "配置项\t值\t说明".white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(70).dimmed()).unwrap();

        writeln!(tw, "default_port\t{}\t默认港口代码", config.default_port).unwrap();
        writeln!(tw, "output_format\t{}\t默认输出格式", config.output_format).unwrap();
        writeln!(tw, "decimals\t{}\t金额小数位数", config.decimals).unwrap();
        writeln!(tw, "currency_symbol\t{}\t货币符号", config.currency_symbol).unwrap();
        writeln!(tw, "page_size\t{}\t分页大小", config.page_size).unwrap();
        writeln!(tw, "color_mode\t{}\t彩色输出模式", config.color_mode).unwrap();

        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));
    Ok(())
}

fn cmd_config_reset() -> Result<(), String> {
    let config = AppConfig::default();
    save_config(&config)?;
    formatter::success("配置已重置为默认值");
    cmd_config_list()
}

fn print_man_page() {
    use std::io::{self, Write};

    let man = vec![
        ("SHIP-AGENT(1)", "用户命令手册".to_string()),
        ("", "".to_string()),
        ("名称", "ship-agent - 船舶代理港口使费管理系统".to_string()),
        ("", "".to_string()),
        ("用法", "ship-agent [--man] [--examples] [--no-color] <子命令> [选项...]".to_string()),
        ("", "".to_string()),
        ("描述", "本系统为区域船舶代理公司提供船舶进出港申报、12项港口使费阶梯计费、费率版本管理、".to_string()),
        ("     ", "费用争议审批流转、月度结算报表、历史数据追溯等全流程功能。支持年均8000+艘次处理量，".to_string()),
        ("     ", "覆盖35个港口码头、集装箱/散货/油轮/液化气/滚装五大船型。".to_string()),
        ("", "".to_string()),
        ("子命令概览", "".to_string()),
        ("  add         ", "录入船舶申报信息（IMO+船名+船型+净吨位+抵离港时间+港口）".to_string()),
        ("  compute     ", "批量计算港口使费（按港口/船舶/日期范围筛选）".to_string()),
        ("  rate        ", "费率管理（add/update/list/delete，支持生效日期版本）".to_string()),
        ("  dispute     ", "费用争议处理（分项调整+审批流转+前后对比）".to_string()),
        ("  report      ", "月度结算报表（按港口/船型分组+账龄分析+3种输出格式）".to_string()),
        ("  import      ", "CSV批量导入（并行处理+dry-run+错误跳过）".to_string()),
        ("  history     ", "历史费用追溯（按IMO/船名+ASCII趋势图+费用类别汇总）".to_string()),
        ("  config      ", "系统配置（默认港口/输出格式/小数位/货币符号）".to_string()),
        ("  completion  ", "生成Shell自动补全脚本（bash/zsh/fish/powershell/elvish）".to_string()),
        ("", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("第一节：费率配置规则说明", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("", "".to_string()),
        ("12项费用类别", "".to_string()),
        ("  编号  代码         名称     计费依据                  典型阶梯(元/单位)   基础费(元)".to_string()),
        ("  ───── ──────────── ──────── ───────────────────────── ───────────────── ─────────".to_string()),
        ("  01    pilot        引航费   引航时长(小时)              0.4-0.8/小时      500".to_string()),
        ("  02    tug          拖轮费   拖轮艘次×作业时长(艘·小时)   0.4-0.8/艘·小时    800".to_string()),
        ("  03    berth        停泊费   净吨位×停泊天数(吨·天)      0.4-0.8/吨·天      0".to_string()),
        ("  04    port         港务费   净吨位(NT)                0.4-0.8/净吨        0".to_string()),
        ("  05    tally        理货费   货物吨数(取max(货量, 0.5NT))0.4-0.8/吨         100".to_string()),
        ("  06    agent        代理费   净吨位(NT)                0.4-0.8/净吨        200".to_string()),
        ("  07    pilotage     领航费   引航时长×0.5(小时)         0.4-0.8/小时      50".to_string()),
        ("  08    mooring      系解缆费 停泊天数×2(次)             0.4-0.8/次          50".to_string()),
        ("  09    anchorage    锚泊费   净吨位×停泊小时×0.1(吨·小时) 0.4-0.8/吨·小时    50".to_string()),
        ("  10    quarantine  检疫费   每次申报                   0.4-0.8/次          50".to_string()),
        ("  11    customs      报关费   每次申报                   0.4-0.8/次          50".to_string()),
        ("  12    other        其他费用 净吨位×0.05(NT)            0.4-0.8/净吨        50".to_string()),
        ("", "".to_string()),
        ("阶梯费率配置规则", "".to_string()),
        ("  • 阶梯区间按船舶净吨位(NT)划分，常用区间：".to_string()),
        ("    0-5000NT | 5001-10000NT | 10001-30000NT | 30001-50000NT | 50001NT以上".to_string()),
        ("  • 同一港口同一费用类别可配置多套阶梯区间，系统自动匹配".to_string()),
        ("  • 费率版本通过 --effective-date YYYY-MM-DD 控制生效时间，历史版本保留".to_string()),
        ("  • 总费用 = 金额小计 × 1.06（增值税率6%），金额小计为12项之和".to_string()),
        ("", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("第二节：争议处理流程图", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("", "".to_string()),
        ("    发现费用异常".to_string()),
        ("        │".to_string()),
        ("        ▼".to_string()),
        ("    创建争议单 (dispute --adjust cat=amount --reason \"原因\")".to_string()),
        ("        │  状态: 待提交(Pending)".to_string()),
        ("        ▼".to_string()),
        ("    提交审批 (--submit)".to_string()),
        ("        │  状态: 待审批(Submitted)".to_string()),
        ("        ▼".to_string()),
        ("  ┌───────────────────────────────────┐".to_string()),
        ("  │         审批人审核 (--approve)     │".to_string()),
        ("  └──────────────┬────────────────────┘".to_string()),
        ("         ┌──────┴──────┐".to_string()),
        ("         ▼             ▼".to_string()),
        ("     批准(Approved)  拒绝(Rejected)".to_string()),
        ("         │             │ 流程结束".to_string()),
        ("         ▼".to_string()),
        ("    自动执行调整 状态: 已执行(Applied)".to_string()),
        ("    • 12项费用按category更新".to_string()),
        ("    • 生成调整前后对比明细".to_string()),
        ("    • 标记has_dispute=true".to_string()),
        ("        │".to_string()),
        ("        ▼".to_string()),
        ("    流程完成，进入结算环节".to_string()),
        ("", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("第三节：报表字段解释", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("", "".to_string()),
        ("港口使费明细单(Invoice)", "".to_string()),
        ("  ──────────────────────────────────────────────────────────".to_string()),
        ("  字段名          类型      说明".to_string()),
        ("  ──────────────────────────────────────────────────────────".to_string()),
        ("  fee_record_id   整数      费用记录主键ID".to_string()),
        ("  imo             字符串(7) 船舶IMO编号，全球唯一".to_string()),
        ("  vessel_name     字符串    船名".to_string()),
        ("  vessel_type     枚举      船型: container/bulk/oil/lpg/ro-ro".to_string()),
        ("  port_code       字符串(3) 港口代码，如SHA=上海、NGB=宁波".to_string()),
        ("  arrival_time    时间戳    抵港时间(UTC)".to_string()),
        ("  departure_time  时间戳    离港时间(UTC)".to_string()),
        ("  base_fee        货币      阶梯基础费(元)".to_string()),
        ("  unit_rate       货币      阶梯单位费率(元/单位)".to_string()),
        ("  quantity        浮点数    计费数量(视类别而定)".to_string()),
        ("  unit_label      字符串    计费单位标签".to_string()),
        ("  amount          货币      单项费用 = base_fee + unit_rate × quantity".to_string()),
        ("  total_amount    货币      12项金额小计(不含税)".to_string()),
        ("  tax_amount      货币      增值税 = total_amount × 6%".to_string()),
        ("  grand_total     货币      价税合计 = total_amount + tax_amount".to_string()),
        ("  has_dispute     布尔      是否存在争议调整".to_string()),
        ("  is_settled      布尔      是否已结算".to_string()),
        ("  settled_amount  货币      已收金额".to_string()),
        ("  ──────────────────────────────────────────────────────────".to_string()),
        ("", "".to_string()),
        ("月度汇总报表(Monthly Report)", "".to_string()),
        ("  账龄分析区间: 0-30天│31-60天│61-90天│90天以上，统计未结算应收款".to_string()),
        ("  分组维度: --by-port按港口 | --by-vessel-type按船型 | 两者可组合".to_string()),
        ("  输出格式: table(终端表格)│csv(电子表格)│json(API对接)".to_string()),
        ("", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("第四节：系统配置与数据存储", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("", "".to_string()),
        ("配置文件路径: ~/.ship_agent/config.toml".to_string()),
        ("数据库路径:   ~/.ship_agent/ship_agent.db (SQLite WAL模式)".to_string()),
        ("数据库表: ships(船舶)│rate_rules(费率)│fee_records(费用)│fee_details(明细)│".to_string()),
        ("           disputes(争议)│adjustments(调整项)│ports(港口)│app_config(键值)".to_string()),
        ("索引优化: 14个复合索引，覆盖IMO/港口/时间/状态等常用查询维度".to_string()),
        ("", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("作者与版本", "".to_string()),
        ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(), "".to_string()),
        ("  版本:  v1.0.0 (Rust 2021 Edition)".to_string()),
        ("  技术:  StructOpt 0.3 + Rusqlite 0.30 + Rayon 1.8 + Tabwriter 1.4".to_string()),
        ("  代码:  单线程<50ms/船 | 8000艘批量<30s | 百万记录<10ms索引查询".to_string()),
    ];

    let tw = formatter::terminal_width();
    let page_size = std::env::var("MANPAGER").ok().and_then(|_| None).unwrap_or(25);

    println!();
    for (i, (title, content)) in man.iter().enumerate() {
        if i > 0 && i % page_size == 0 {
            print!("\n{} -- 按Enter继续(退出输入q) --", "分页".yellow().bold());
            io::stdout().flush().unwrap();
            let mut input = String::new();
            if io::stdin().read_line(&mut input).is_ok() {
                if input.trim().to_lowercase() == "q" {
                    return;
                }
            }
            println!();
        }

        if title.is_empty() {
            println!("{}", content);
        } else if title.starts_with("━━━") {
            println!("\n{}", title.as_str().cyan().bold());
        } else if content.is_empty() {
            println!("\n{}", title.bold().underline());
        } else if title.contains("(1)") || title == "名称" || title == "用法" || title == "描述" {
            println!("  {:<14} {}", title.bold().magenta(), content);
        } else {
            let title_fmt = if title.len() <= 14 {
                format!("  {:<14}", title.bold().yellow())
            } else {
                format!("  {}", title.bold().yellow())
            };
            println!("{}{}", title_fmt, content);
        }
    }
    println!();
}

fn print_examples_page() {
    use std::io::{self, Write};

    let examples = vec![
        ("场景一：新船首航全流程（录入→计费→结算）", vec![
            "# 1. 录入船舶申报 (IMO 9632091, 24万吨级集装箱船)",
            "$ ship-agent add \\\n    -i 9632091 -n \"COSCO SHIPPING UNIVERSE\" -t container \\\n    -N 241880 -p SHA \\\n    -a \"2024-06-22 08:00\" -d \"2024-06-24 14:30\" \\\n    --cargo-tonnage 50000 --pilot-hours 4 --tug-count 3 --tug-hours 4",
            "",
            "# 2. 计算港口使费并保存",
            "$ ship-agent compute --port SHA --vessel 9632091 --save",
            "",
            "# 3. 查看费用明细(12项+小计+税额+合计)",
            "# (已保存则会自动显示12项费用明细)",
            "",
            "# 4. 生成6月份结算报表(按港口分组)",
            "$ ship-agent report -m 2024-06 --by-port --format table",
            "",
        ]),
        ("场景二：费率调整与版本管理", vec![
            "# 1. 查看上海港现有引航费费率",
            "$ ship-agent rate list -p SHA -c pilot --active",
            "",
            "# 2. 新增50001NT以上高费率档(2024-07-01起生效)",
            "$ ship-agent rate add \\\n    -p SHA -c pilot -f 50001 -t 0 -r 1.2 -b 800 \\\n    --effective-date 2024-07-01",
            "",
            "# 3. 更新已有费率ID#42的基础费",
            "$ ship-agent rate update -i 42 --base 1000",
            "",
            "# 4. 停用过期旧费率ID#15",
            "$ ship-agent rate delete -i 15",
            "",
        ]),
        ("场景三：费用争议处理（发现多收停泊费）", vec![
            "# 前提：compute时已保存，假设费用记录ID=128",
            "",
            "# 1. 审核发现停泊费多收1500元，创建争议单",
            "$ ship-agent dispute \\\n    -f 128 \\\n    --adjust berth=-1500 \\\n    --reason \"系统误判停泊天数(2.5天实际应为1.8天)\" \\\n    --requester \"操作员-张三\"",
            "",
            "# 2. 提交进入审批流程",
            "$ ship-agent dispute -f 128 --adjust berth=-1500 --reason \"...\" --submit",
            "",
            "# 3. 审批人审批通过",
            "$ ship-agent dispute -f 128 --adjust berth=-1500 --reason \"...\" --submit --approve -p \"主管-李四\"",
            "# (系统自动显示调整前后对比明细，并更新费用记录)",
            "",
        ]),
        ("场景四：批量导入与历史追溯", vec![
            "# 1. Dry-run预览模式检查10000条数据",
            "$ ship-agent import -f 202405_ships.csv --dry-run --skip-errors -j 8",
            "",
            "# 2. 并行8个文件正式导入，跳过错误行",
            "$ ship-agent import -f *.csv --skip-errors -j 8",
            "",
            "# 3. 查看某船近3年费用趋势图",
            "$ ship-agent history -i 9632091 --chart --verbose",
            "",
            "# 4. 查看2024年上海港所有集装箱船费用(带趋势图)",
            "$ ship-agent history -n \"COSCO\" -y 2024 -p SHA --chart",
            "",
        ]),
        ("场景五：报表多样化输出", vec![
            "# 1. 按月+按港口+账龄分析 → 终端表格",
            "$ ship-agent report -m 2024-06 --by-port --aging --verbose",
            "",
            "# 2. 按船型分组 → CSV格式给财务",
            "$ ship-agent report -m 2024-06 --by-vessel-type -f csv -o 202406_vessel.csv",
            "",
            "# 3. 港口+船型交叉分组 → JSON对接ERP",
            "$ ship-agent report -m 2024-06 --by-port --by-vessel-type -f json -o report.json",
            "",
            "# 4. 查看系统配置",
            "$ ship-agent config list",
            "",
        ]),
        ("场景六：Shell补全安装", vec![
            "# bash用户",
            "$ ship-agent completion bash > /etc/bash_completion.d/ship-agent\n$ source /etc/bash_completion.d/ship-agent",
            "",
            "# zsh用户",
            "$ ship-agent completion zsh > ~/.zsh/completions/_ship-agent\n$ echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc\n$ compinit",
            "",
            "# fish用户",
            "$ ship-agent completion fish > ~/.config/fish/completions/ship-agent.fish",
            "",
        ]),
    ];

    let tw = formatter::terminal_width();

    formatter::header("典型场景命令示例 (共6大场景)");
    println!();

    for (idx, (scene, cmds)) in examples.iter().enumerate() {
        println!("  {}{}{}", "━━━ ".magenta(), format!("场景{}: {}", idx + 1, scene).bold().white(), " ━━━".magenta());
        for (i, line) in cmds.iter().enumerate() {
            if line.is_empty() {
                println!();
            } else if line.starts_with('#') {
                println!("  {} {}", "ℹ".blue().bold(), line[2..].dimmed());
            } else {
                println!("    $ {}", line.green());
            }
        }
        println!();
    }

    println!("  {} 详细命令参数请使用: {} 或 {}",
        "提示:".yellow().bold(),
        "ship-agent <子命令> --help".cyan(),
        "ship-agent --man".cyan());
    println!();
}

fn cmd_completion(args: &CompletionArgs) -> Result<(), String> {
    use structopt::clap::Shell;
    use structopt::StructOpt;

    let script = {
        let mut buf: Vec<u8> = Vec::new();
        Cli::clap().gen_completions_to("ship-agent", args.shell, &mut buf);
        String::from_utf8(buf).map_err(|e| e.to_string())?
    };

    if let Some(output) = &args.output {
        fs::write(output, &script).map_err(|e| e.to_string())?;
        formatter::success(&format!("补全脚本已写入: {}", output));
        formatter::info(&match args.shell {
            Shell::Bash => "安装: source /etc/bash_completion.d/ship-agent 或放入系统补全目录",
            Shell::Zsh => "安装: 放入 $fpath 目录并执行 compinit",
            Shell::Fish => "安装: source ~/.config/fish/completions/ship-agent.fish",
            Shell::PowerShell => "安装: .\\ship-agent.ps1",
            Shell::Elvish => "安装: 放入 elvish 脚本目录",
            _ => "参考对应Shell文档安装补全脚本",
        });
    } else {
        println!("{}", script);
    }

    Ok(())
}

fn paginate_output(lines: &[String], page_size: usize) {
    use std::io::{self, Write};

    for (i, chunk) in lines.chunks(page_size).enumerate() {
        for line in chunk {
            println!("{}", line);
        }
        if i * page_size + chunk.len() < lines.len() {
            print!("\n{} -- 第{}页，按Enter继续 (q退出) --",
                "分页".yellow().bold(),
                i + 1);
            io::stdout().flush().unwrap();
            let mut input = String::new();
            if io::stdin().read_line(&mut input).is_ok() {
                if input.trim().to_lowercase() == "q" {
                    return;
                }
            }
            println!();
        }
    }
}

fn truncate_long_report<T: std::fmt::Display>(
    items: &[T],
    limit: usize,
    render: impl Fn(&T) -> String,
) -> Vec<String> {
    let mut output = Vec::new();
    if items.len() <= limit {
        for item in items {
            output.push(render(item));
        }
    } else {
        for item in items.iter().take(limit) {
            output.push(render(item));
        }
        output.push(String::new());
        output.push(format!(
            "{} 已截断: 显示前{}条 / 共{}条，使用 {} 显示完整内容",
            "⚠".yellow().bold(),
            limit,
            items.len(),
            "--verbose".cyan().bold()
        ));
    }
    output
}

fn print_banner() {
    let banner = r#"
   _____ _     _                      _                        _
  / ____| |   (_)         /\         | |                      (_)
 | (___ | |__  _ _ __    /  \   _ __ | |__   ___ _ __ ___  ___ _  ___  _ __   ___
  \___ \| '_ \| | '_ \  / /\ \ | '_ \| '_ \ / _ \ '_ ` _ \/ __| |/ _ \| '_ \ / _ \
  ____) | | | | | |_) |/ ____ \| | | | | | |  __/ | | | | \__ \ | (_) | | | |  __/
 |_____/|_| |_|_| .__//_/    \_\_| |_|_| |_|\___|_| |_| |_|___/_|\___/|_| |_|\___|
                | |
                |_|
    "#;

    println!("{}", banner.cyan());
    println!(
        "{} {}",
        "  Port Agency Fee Management System".bold().cyan(),
        "v1.0.0".dimmed()
    );
    println!(
        "  {}",
        "船舶代理港口使费管理系统 | 年均处理8000+ 艘次".dimmed()
    );
    println!("{}", "─".repeat(80).dimmed());
}

fn main() {
    print_banner();

    let cli = Cli::from_args();

    if cli.global_flags.no_color {
        colored::control::set_override(false);
    }

    if cli.global_flags.man {
        print_man_page();
        return;
    }

    if cli.global_flags.examples {
        print_examples_page();
        return;
    }

    let command = match &cli.command {
        Some(cmd) => cmd,
        None => {
            formatter::info("未指定子命令。使用 --help 查看命令列表，--examples 查看典型场景，--man 查看完整手册。");
            return;
        }
    };

    let config = load_config();

    let db_path = get_db_path();
    let db = match Database::open(&db_path) {
        Ok(db) => db,
        Err(e) => {
            formatter::error(&format!("数据库初始化失败: {}", e));
            std::process::exit(1);
        }
    };

    let result = match command {
        Command::Completion(args) => cmd_completion(args),
        Command::Add(args) => cmd_add(args, &db),
        Command::Compute(args) => cmd_compute(args, &db, &config),
        Command::Rate(args) => cmd_rate(args, &db, &config),
        Command::Dispute(args) => cmd_dispute(args, &db, &config),
        Command::Report(args) => cmd_report(args, &db, &config),
        Command::Import(args) => cmd_import(args, &db, &config),
        Command::History(args) => cmd_history(args, &db, &config),
        Command::Config(args) => cmd_config(args),
    };

    if let Err(e) = result {
        formatter::error(&e);
        std::process::exit(1);
    }
}
