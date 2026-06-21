mod alert;
mod check;
mod db;
mod dose;
mod error_codes;
mod import_mod;
mod permit;
mod query;
mod report;

use anyhow::{anyhow, Result};
use chrono::{Datelike, NaiveDate, NaiveDateTime};
use clap::{Parser, Subcommand};
use colored::*;
use comfy_table::{Cell, Color, ContentArrangement, Table};
use std::path::PathBuf;

use crate::alert::{AlertLevel, AlertThresholds, check_all_dose_alerts, list_alerts};
use crate::db::Db;
use crate::dose::{get_area_dose, get_department_dose, get_period_stats, get_personal_dose, StatsPeriod};
use crate::error_codes::{err, ErrorCode};
use crate::import_mod::ImportResult;
use crate::permit::{approve_permit, create_permit, list_permits, reject_permit, CreatePermitRequest};
use crate::query::{QueryParams, export_dose_csv, export_survey_csv, query_dose_records, query_survey_records, render_dose_table, render_survey_table};
use crate::report::{generate_monthly_dose_report, generate_quarterly_dose_report, report_to_csv, report_to_text};

const MAIN_HELP_EXAMPLES: &str = "\n示例:\n  radmon import survey.csv            # 导入巡检CSV数据\n  radmon import dose.json              # 导入剂量JSON数据\n  radmon stats -d personal             # 按人员统计剂量\n  radmon stats -d department           # 按部门统计剂量\n  radmon stats -d area                # 按辐射区域统计剂量\n  radmon alert run                    # 执行超限预警检查\n  radmon permit create ...            # 创建辐射工作许可证\n  radmon report --type month          # 生成月度报告\n  radmon query -t dose -e E001        # 查询员工剂量记录\n  radmon check                        # 数据完整性校验";

#[derive(Parser)]
#[command(name = "radmon", version = "1.0.0", about = "辐射监测数据管理命令行工具", long_about = None, after_help = MAIN_HELP_EXAMPLES)]
struct Cli {
    #[arg(short, long, default_value = "radmon.db", help = "数据库文件路径")]
    db: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    #[command(about = "导入巡检或剂量数据", long_about = "支持巡检CSV和剂量JSON两种格式自动识别导入", after_help = "\n示例:\n  radmon import survey.csv              # 自动识别CSV格式导入\n  radmon import dose.json               # 自动识别JSON格式导入\n  radmon import data.csv --format csv   # 强制指定CSV格式\n  radmon import data.json --format json # 强制指定JSON格式")]
    Import {
        #[arg(help = "要导入的文件路径")]
        file: PathBuf,

        #[arg(short, long, help = "强制指定格式: csv, json")]
        format: Option<String>,
    },

    #[command(about = "剂量统计分析", long_about = "按人员、部门、区域、时间段多维度汇总累积剂量", after_help = "\n示例:\n  radmon stats -d personal                       # 个人剂量排名\n  radmon stats -d department                     # 部门剂量汇总\n  radmon stats -d area                           # 按辐射区域统计\n  radmon stats -d period -p month                # 月度周期统计\n  radmon stats -d period -p quarter              # 季度周期统计\n  radmon stats -d personal --from 2025-01-01    # 指定起始时间\n  radmon stats -d personal --format json         # JSON格式输出")]
    Stats {
        #[arg(short, long, help = "统计维度: personal, department, area, period")]
        dimension: Option<String>,

        #[arg(short, long, help = "统计周期: month, quarter, year")]
        period: Option<String>,

        #[arg(long, help = "员工工号 (个人统计时使用)")]
        employee: Option<String>,

        #[arg(long, help = "开始时间 (YYYY-MM-DD HH:MM:SS)")]
        from: Option<String>,

        #[arg(long, help = "结束时间 (YYYY-MM-DD HH:MM:SS)")]
        to: Option<String>,

        #[arg(short, long, default_value = "table", help = "输出格式: table, csv, json")]
        format: String,
    },

    #[command(about = "超限预警检查与管理", long_about = "内置GB18871标准剂量限值，支持黄/红两级预警", after_help = "\n示例:\n  radmon alert run                               # 使用默认限值检查\n  radmon alert run --annual-limit 40             # 自定义年限值40mSv\n  radmon alert run --monthly-limit 4              # 自定义月限值4mSv\n  radmon alert run --5year-limit 80              # 自定义5年限值80mSv\n  radmon alert run --log-file alerts.log         # 预警写入日志文件\n  radmon alert list                              # 查看所有预警记录\n  radmon alert list --level red                  # 仅查看红色预警\n  radmon alert list --level yellow -n 10         # 查看最近10条黄色预警")]
    Alert {
        #[command(subcommand)]
        action: AlertCommands,
    },

    #[command(about = "辐射工作许可证管理", long_about = "许可证创建、审批，自动校验累积剂量", after_help = "\n示例:\n  radmon permit create --employee-id E001 --employee-name 张三 --department 运行一部 --area-type 控制区 --area-name 1号反应堆厂房 --work-type 检修 --valid-from 2026-06-21 --valid-to 2026-07-21\n  radmon permit approve RP-20260621-1234 --approver 管理员\n  radmon permit reject RP-20260621-1234 --reason 超剂量限值\n  radmon permit list                             # 查看所有许可证\n  radmon permit list --status pending            # 查看待审批许可证\n  radmon permit list --employee E001 -n 5        # 查看员工最近5条")]
    Permit {
        #[command(subcommand)]
        action: PermitCommands,
    },

    #[command(about = "生成报告", long_about = "生成月度/季度剂量统计报告，支持文本与CSV输出", after_help = "\n示例:\n  radmon report --type month --year 2025 --month 6              # 生成2025年6月月度报告\n  radmon report --type quarter --year 2025 --month 4             # 生成2025年第2季度报告\n  radmon report --type survey                                     # 生成巡检异常报告\n  radmon report --type month --format csv --output ./reports      # CSV格式输出到目录")]
    Report {
        #[arg(short, long, default_value = "month", help = "报告类型: month, quarter, survey")]
        r#type: String,

        #[arg(long, help = "年份 (默认当年)")]
        year: Option<i32>,

        #[arg(long, help = "月份 (1-12，默认当月)")]
        month: Option<u32>,

        #[arg(short, long, default_value = "text", help = "输出格式: text, csv, json")]
        format: String,

        #[arg(short, long, help = "输出目录 (CSV格式时使用)")]
        output: Option<PathBuf>,
    },

    #[command(about = "历史数据查询", long_about = "按监测点、人员、时间范围组合查询历史记录", after_help = "\n示例:\n  radmon query -t survey -p U01-CONTROL-001                     # 按监测点查询巡检记录\n  radmon query -t dose -e E001                                   # 按工号查询剂量记录\n  radmon query -t dose --from 2025-06-01 --to 2025-06-30         # 按时间范围查询\n  radmon query -t survey --limit 100 --offset 50                # 分页查询\n  radmon query -t dose -e E001 -o export.csv                    # 导出为CSV文件")]
    Query {
        #[arg(short, long, default_value = "survey", help = "查询类型: survey, dose")]
        r#type: String,

        #[arg(short = 'p', long, help = "监测点编号")]
        point: Option<String>,

        #[arg(short = 'e', long, help = "员工工号")]
        employee: Option<String>,

        #[arg(long, help = "开始时间 (YYYY-MM-DD HH:MM:SS)")]
        from: Option<String>,

        #[arg(long, help = "结束时间 (YYYY-MM-DD HH:MM:SS)")]
        to: Option<String>,

        #[arg(short, long, default_value = "50", help = "返回数量限制")]
        limit: i64,

        #[arg(long, default_value = "0", help = "分页偏移")]
        offset: i64,

        #[arg(short, long, default_value = "table", help = "输出格式: table, csv, json")]
        format: String,

        #[arg(short = 'o', long, help = "导出CSV文件路径")]
        export: Option<PathBuf>,
    },

    #[command(about = "数据完整性校验", long_about = "检测缺失监测点、异常跳变值、时间间隔异常", after_help = "\n示例:\n  radmon check              # 文本格式校验报告\n  radmon check --format json # JSON格式校验报告")]
    Check {
        #[arg(short, long, default_value = "text", help = "输出格式: text, json")]
        format: String,
    },
}

#[derive(Subcommand)]
enum AlertCommands {
    #[command(about = "执行预警检查", after_help = "\n示例:\n  radmon alert run --annual-limit 40   # 自定义年限值40mSv\n  radmon alert run --5year-limit 80    # 自定义5年限值80mSv\n  radmon alert run --log-file a.log    # 预警写入日志")]
    Run {
        #[arg(long, help = "预警日志文件路径")]
        log_file: Option<PathBuf>,

        #[arg(long, help = "自定义年限值 (mSv)，覆盖默认50mSv")]
        annual_limit: Option<f64>,

        #[arg(long, help = "自定义月限值 (mSv)，覆盖默认5mSv")]
        monthly_limit: Option<f64>,

        #[arg(long = "5year-limit", help = "自定义5年限值 (mSv)，覆盖默认100mSv")]
        five_year_limit: Option<f64>,
    },
    #[command(about = "查看预警记录", after_help = "\n示例:\n  radmon alert list                    # 查看所有预警\n  radmon alert list --level red        # 仅红色预警\n  radmon alert list -n 20              # 最近20条")]
    List {
        #[arg(short, long, help = "预警级别: yellow, red")]
        level: Option<String>,

        #[arg(long, help = "开始时间")]
        from: Option<String>,

        #[arg(long, help = "结束时间")]
        to: Option<String>,

        #[arg(short = 'n', long, help = "返回数量限制")]
        limit: Option<i64>,
    },
}

#[derive(Subcommand)]
enum PermitCommands {
    #[command(about = "创建新许可证", after_help = "\n示例:\n  radmon permit create \\\n    --employee-id E001 --employee-name 张三 \\\n    --department 运行一部 \\\n    --area-type 控制区 --area-name 1号反应堆厂房 \\\n    --work-type 检修 \\\n    --valid-from 2026-06-21 --valid-to 2026-07-21")]
    Create {
        #[arg(long, help = "员工工号")]
        employee_id: String,

        #[arg(long, help = "员工姓名")]
        employee_name: String,

        #[arg(long, help = "部门")]
        department: String,

        #[arg(long, help = "区域类型: 控制区, 监督区, 非限制区")]
        area_type: String,

        #[arg(long, help = "区域名称")]
        area_name: String,

        #[arg(long, help = "工作类型")]
        work_type: String,

        #[arg(long, help = "有效期开始日期 (YYYY-MM-DD)")]
        valid_from: String,

        #[arg(long, help = "有效期结束日期 (YYYY-MM-DD)")]
        valid_to: String,
    },
    #[command(about = "审批许可证", after_help = "\n示例:\n  radmon permit approve RP-20260621-1234 --approver 管理员\n  radmon permit approve RP-20260621-5678 --approver 李四")]
    Approve {
        #[arg(help = "许可证编号")]
        permit_no: String,

        #[arg(long, help = "审批人")]
        approver: String,
    },
    #[command(about = "驳回许可证", after_help = "\n示例:\n  radmon permit reject RP-20260621-1234 --reason 超剂量限值\n  radmon permit reject RP-20260621-5678 --reason 资料不全")]
    Reject {
        #[arg(help = "许可证编号")]
        permit_no: String,

        #[arg(long, help = "驳回原因")]
        reason: String,
    },
    #[command(about = "查看许可证列表", after_help = "\n示例:\n  radmon permit list                    # 查看所有许可证\n  radmon permit list --status pending    # 查看待审批许可证\n  radmon permit list --status approved   # 查看已批准许可证\n  radmon permit list --employee E001     # 查看指定员工的许可证\n  radmon permit list -n 10               # 查看最近10条")]
    List {
        #[arg(short, long, help = "状态: pending, approved, rejected")]
        status: Option<String>,

        #[arg(short, long, help = "员工工号")]
        employee: Option<String>,

        #[arg(short = 'n', long, help = "返回数量限制")]
        limit: Option<i64>,
    },
}

fn main() {
    let cli = Cli::parse();
    if let Err(e) = run(cli) {
        let msg = format!("{}", e);
        if msg.starts_with("E") && msg.contains(": ") {
            eprintln!("{} {}", "[ERROR]".red().bold(), msg);
        } else {
            eprintln!("{} E999: {}", "[ERROR]".red().bold(), msg);
        }
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<()> {
    let db = Db::open(&cli.db).map_err(|e| err(ErrorCode::DatabaseOpen, format!("{}", e)))?;
    db.init_schema().map_err(|e| err(ErrorCode::DatabaseInit, format!("{}", e)))?;

    match cli.command {
        Commands::Import { file, format } => cmd_import(&db, &file, format.as_deref()),
        Commands::Stats {
            dimension,
            period,
            employee,
            from,
            to,
            format,
        } => cmd_stats(&db, dimension.as_deref(), period.as_deref(), employee.as_deref(), from.as_deref(), to.as_deref(), &format),
        Commands::Alert { action } => cmd_alert(&db, action),
        Commands::Permit { action } => cmd_permit(&db, action),
        Commands::Report { r#type, year, month, format, output } => cmd_report(&db, &r#type, year, month, &format, output.as_deref()),
        Commands::Query { r#type, point, employee, from, to, limit, offset, format, export } => {
            cmd_query(&db, &r#type, point.as_deref(), employee.as_deref(), from.as_deref(), to.as_deref(), limit, offset, &format, export.as_deref())
        }
        Commands::Check { format } => cmd_check(&db, &format),
    }
}

fn cmd_import(db: &Db, file: &std::path::Path, format: Option<&str>) -> Result<()> {
    let result: ImportResult = match format {
        Some("csv") => import_mod::import_survey_csv(db, file)?,
        Some("json") => import_mod::import_dose_json(db, file)?,
        Some(f) => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的格式: {}", f))),
        None => import_mod::auto_import(db, file)?,
    };

    println!("{}", "===== 导入结果 =====".green().bold());
    println!("文件: {:?}", file);
    println!("总记录数: {}", result.total);
    println!("成功插入: {}", result.inserted.to_string().green());
    println!("跳过(重复/错误): {}", result.skipped.to_string().yellow());
    println!("耗时: {} ms", result.duration_ms);

    if !result.errors.is_empty() {
        println!("\n{}", "错误详情:".red().bold());
        for e in &result.errors {
            println!("  - {}", e);
        }
    }
    Ok(())
}

fn cmd_stats(
    db: &Db,
    dimension: Option<&str>,
    period: Option<&str>,
    employee: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
    format: &str,
) -> Result<()> {
    let from_dt = parse_datetime_opt(from)?;
    let to_dt = parse_datetime_opt(to)?;

    let dim = dimension.unwrap_or("personal");

    match dim {
        "personal" | "p" => {
            let summaries = get_personal_dose(db, employee, from_dt, to_dt)?;
            match format {
                "table" => {
                    let mut table = Table::new();
                    table.set_header(vec!["排名", "工号", "姓名", "部门", "累积剂量", "单位", "记录数"])
                        .set_content_arrangement(ContentArrangement::Dynamic);
                    for (i, s) in summaries.iter().enumerate() {
                        table.add_row(vec![
                            Cell::new((i + 1).to_string()),
                            Cell::new(&s.employee_id),
                            Cell::new(&s.employee_name),
                            Cell::new(&s.department),
                            Cell::new(format!("{:.2}", s.total_dose)),
                            Cell::new(&s.unit),
                            Cell::new(s.record_count.to_string()),
                        ]);
                    }
                    println!("{}", table);
                    println!("共 {} 条记录", summaries.len());
                }
                "json" => {
                    println!("{}", serde_json::to_string_pretty(&summaries)?);
                }
                "csv" => {
                    let mut wtr = csv::Writer::from_writer(std::io::stdout());
                    wtr.write_record(&["employee_id", "employee_name", "department", "total_dose", "unit", "record_count"])?;
                    for s in &summaries {
                        wtr.write_record(&[
                            &s.employee_id, &s.employee_name, &s.department,
                            &format!("{:.2}", s.total_dose), &s.unit, &s.record_count.to_string(),
                        ])?;
                    }
                    wtr.flush()?;
                }
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "department" | "dept" | "d" => {
            let depts = get_department_dose(db, from_dt, to_dt)?;
            match format {
                "table" => {
                    let mut table = Table::new();
                    table.set_header(vec!["部门", "人数", "集体剂量", "人均剂量", "最大剂量", "单位"])
                        .set_content_arrangement(ContentArrangement::Dynamic);
                    for d in &depts {
                        table.add_row(vec![
                            Cell::new(&d.department),
                            Cell::new(d.worker_count.to_string()),
                            Cell::new(format!("{:.2}", d.collective_dose)),
                            Cell::new(format!("{:.2}", d.average_dose)),
                            Cell::new(format!("{:.2}", d.max_dose)),
                            Cell::new(&d.unit),
                        ]);
                    }
                    println!("{}", table);
                    println!("共 {} 个部门", depts.len());
                }
                "json" => println!("{}", serde_json::to_string_pretty(&depts)?),
                "csv" => {
                    let mut wtr = csv::Writer::from_writer(std::io::stdout());
                    wtr.write_record(&["department", "worker_count", "collective_dose", "average_dose", "max_dose", "unit"])?;
                    for d in &depts {
                        wtr.write_record(&[
                            &d.department, &d.worker_count.to_string(),
                            &format!("{:.2}", d.collective_dose),
                            &format!("{:.2}", d.average_dose),
                            &format!("{:.2}", d.max_dose),
                            &d.unit,
                        ])?;
                    }
                    wtr.flush()?;
                }
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "area" | "a" => {
            let areas = get_area_dose(db, from_dt, to_dt)?;
            match format {
                "table" => {
                    let mut table = Table::new();
                    table.set_header(vec!["区域类型", "区域名称", "人数", "集体剂量", "人均剂量", "最大剂量", "单位"])
                        .set_content_arrangement(ContentArrangement::Dynamic);
                    for a in &areas {
                        table.add_row(vec![
                            Cell::new(&a.area_type),
                            Cell::new(&a.area_name),
                            Cell::new(a.worker_count.to_string()),
                            Cell::new(format!("{:.2}", a.collective_dose)),
                            Cell::new(format!("{:.2}", a.average_dose)),
                            Cell::new(format!("{:.2}", a.max_dose)),
                            Cell::new(&a.unit),
                        ]);
                    }
                    println!("{}", table);
                    println!("共 {} 个区域", areas.len());
                }
                "json" => println!("{}", serde_json::to_string_pretty(&areas)?),
                "csv" => {
                    let mut wtr = csv::Writer::from_writer(std::io::stdout());
                    wtr.write_record(&["area_type", "area_name", "worker_count", "collective_dose", "average_dose", "max_dose", "unit"])?;
                    for a in &areas {
                        wtr.write_record(&[
                            &a.area_type, &a.area_name, &a.worker_count.to_string(),
                            &format!("{:.2}", a.collective_dose),
                            &format!("{:.2}", a.average_dose),
                            &format!("{:.2}", a.max_dose),
                            &a.unit,
                        ])?;
                    }
                    wtr.flush()?;
                }
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "period" | "t" => {
            let p = StatsPeriod::from_str(period.unwrap_or("month"))?;
            let stats = get_period_stats(db, p, from_dt, to_dt)?;
            match format {
                "table" => {
                    let mut table = Table::new();
                    table.set_header(vec!["周期", "人数", "集体剂量", "人均", "最大", "最小", "单位"])
                        .set_content_arrangement(ContentArrangement::Dynamic);
                    for s in &stats {
                        table.add_row(vec![
                            Cell::new(&s.period_label),
                            Cell::new(s.worker_count.to_string()),
                            Cell::new(format!("{:.2}", s.collective_dose)),
                            Cell::new(format!("{:.2}", s.average_dose)),
                            Cell::new(format!("{:.2}", s.max_dose)),
                            Cell::new(format!("{:.2}", s.min_dose)),
                            Cell::new(&s.unit),
                        ]);
                    }
                    println!("{}", table);
                }
                "json" => println!("{}", serde_json::to_string_pretty(&stats)?),
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        _ => return Err(err(ErrorCode::InvalidDimension, format!("不支持的统计维度: {}", dim))),
    }
    Ok(())
}

fn cmd_alert(db: &Db, action: AlertCommands) -> Result<()> {
    match action {
        AlertCommands::Run { log_file, annual_limit, monthly_limit, five_year_limit } => {
            let thresholds = AlertThresholds {
                annual_limit_msv: annual_limit,
                monthly_limit_msv: monthly_limit,
                five_year_limit_msv: five_year_limit,
            };
            let result = check_all_dose_alerts(db, log_file, &thresholds)?;
            println!("{}", "===== 预警检查结果 =====".green().bold());
            println!("检查人员数: {}", result.total_checked);
            println!("黄色预警: {} 条", result.yellow_alerts.to_string().yellow());
            println!("红色预警: {} 条", result.red_alerts.to_string().red());

            if !result.alerts.is_empty() {
                println!("\n预警详情:");
                for a in &result.alerts {
                    let level_str = if a.level == "red" {
                        "RED".red().bold().to_string()
                    } else {
                        "YELLOW".yellow().bold().to_string()
                    };
                    println!("  [{}] [{}] {}", a.alert_time.format("%Y-%m-%d %H:%M"), level_str, a.message);
                }
            }
        }
        AlertCommands::List { level, from, to, limit } => {
            let level_enum = match level.as_deref() {
                Some(s) => Some(AlertLevel::from_str(s)?),
                None => None,
            };
            let from_dt = parse_datetime_opt(from.as_deref())?;
            let to_dt = parse_datetime_opt(to.as_deref())?;
            let alerts = list_alerts(db, level_enum, from_dt, to_dt, limit)?;

            let mut table = Table::new();
            table.set_header(vec!["时间", "级别", "类型", "工号", "值", "阈值", "消息"])
                .set_content_arrangement(ContentArrangement::Dynamic);
            for a in &alerts {
                let level_cell = if a.level == "red" {
                    Cell::new("RED").fg(Color::Red)
                } else {
                    Cell::new("YELLOW").fg(Color::Yellow)
                };
                table.add_row(vec![
                    Cell::new(a.alert_time.format("%Y-%m-%d %H:%M").to_string()),
                    level_cell,
                    Cell::new(&a.alert_type),
                    Cell::new(a.employee_id.as_deref().unwrap_or("-")),
                    Cell::new(format!("{:.2}", a.value)),
                    Cell::new(format!("{:.2}", a.threshold)),
                    Cell::new(&a.message),
                ]);
            }
            println!("{}", table);
            println!("共 {} 条预警记录", alerts.len());
        }
    }
    Ok(())
}

fn cmd_permit(db: &Db, action: PermitCommands) -> Result<()> {
    match action {
        PermitCommands::Create {
            employee_id,
            employee_name,
            department,
            area_type,
            area_name,
            work_type,
            valid_from,
            valid_to,
        } => {
            let vf = NaiveDate::parse_from_str(&valid_from, "%Y-%m-%d")
                .map_err(|_| err(ErrorCode::InvalidDate, format!("有效期开始日期格式无效: {}", valid_from)))?;
            let vt = NaiveDate::parse_from_str(&valid_to, "%Y-%m-%d")
                .map_err(|_| err(ErrorCode::InvalidDate, format!("有效期结束日期格式无效: {}", valid_to)))?;

            let req = CreatePermitRequest {
                employee_id,
                employee_name,
                department,
                area_type,
                area_name,
                work_type,
                valid_from: vf,
                valid_to: vt,
            };
            let permit = create_permit(db, req)?;
            println!("{}", "许可证创建成功".green().bold());
            println!("许可证号: {}", permit.permit_no.bold());
            println!("员工: {} ({})", permit.employee_name, permit.employee_id);
            println!("区域: {} / {}", permit.area_type, permit.area_name);
            println!("有效期: {} 至 {}", permit.valid_from, permit.valid_to);
            println!("状态: {}", permit.status);
        }
        PermitCommands::Approve { permit_no, approver } => {
            let result = approve_permit(db, &permit_no, &approver)?;
            if result.approved {
                println!("{}", "审批通过".green().bold());
                println!("许可证号: {}", result.permit_no);
                println!("{}", result.reason);
            } else {
                println!("{}", "审批拒绝".red().bold());
                println!("许可证号: {}", result.permit_no);
                println!("原因: {}", result.reason);
            }
        }
        PermitCommands::Reject { permit_no, reason } => {
            reject_permit(db, &permit_no, &reason)?;
            println!("{}", "已驳回".yellow().bold());
            println!("许可证号: {}", permit_no);
            println!("原因: {}", reason);
        }
        PermitCommands::List { status, employee, limit } => {
            let permits = list_permits(db, status.as_deref(), employee.as_deref(), limit)?;
            let mut table = Table::new();
            table.set_header(vec!["许可证号", "工号", "姓名", "区域", "有效期", "状态"])
                .set_content_arrangement(ContentArrangement::Dynamic);
            for p in &permits {
                let status_cell = match p.status.as_str() {
                    "approved" => Cell::new("已批准").fg(Color::Green),
                    "rejected" => Cell::new("已驳回").fg(Color::Red),
                    _ => Cell::new("待审批").fg(Color::Yellow),
                };
                table.add_row(vec![
                    Cell::new(&p.permit_no),
                    Cell::new(&p.employee_id),
                    Cell::new(&p.employee_name),
                    Cell::new(format!("{} / {}", p.area_type, p.area_name)),
                    Cell::new(format!("{} ~ {}", p.valid_from, p.valid_to)),
                    status_cell,
                ]);
            }
            println!("{}", table);
            println!("共 {} 条许可证", permits.len());
        }
    }
    Ok(())
}

fn cmd_report(
    db: &Db,
    r#type: &str,
    year: Option<i32>,
    month: Option<u32>,
    format: &str,
    output: Option<&std::path::Path>,
) -> Result<()> {
    let now = chrono::Local::now();
    let y = year.unwrap_or_else(|| now.year());
    let m = month.unwrap_or_else(|| now.month());

    match r#type {
        "month" | "monthly" => {
            let report = generate_monthly_dose_report(db, y, m)?;
            match format {
                "text" => print!("{}", report_to_text(&report)),
                "csv" => {
                    let out_dir = output.unwrap_or_else(|| std::path::Path::new("."));
                    report_to_csv(&report, out_dir)?;
                    println!("{}", format!("CSV报告已生成到 {:?}", out_dir).green());
                }
                "json" => println!("{}", serde_json::to_string_pretty(&report)?),
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "quarter" | "quarterly" => {
            let quarter = if m >= 10 { 4 } else if m >= 7 { 3 } else if m >= 4 { 2 } else { 1 };
            let report = generate_quarterly_dose_report(db, y, quarter)?;
            match format {
                "text" => print!("{}", report_to_text(&report)),
                "csv" => {
                    let out_dir = output.unwrap_or_else(|| std::path::Path::new("."));
                    report_to_csv(&report, out_dir)?;
                    println!("{}", format!("CSV报告已生成到 {:?}", out_dir).green());
                }
                "json" => println!("{}", serde_json::to_string_pretty(&report)?),
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "survey" => {
            let to = now.naive_local();
            let from = to - chrono::Duration::days(30);
            let text = report::generate_survey_report(db, from, to)?;
            print!("{}", text);
        }
        _ => return Err(err(ErrorCode::InvalidReportType, format!("不支持的报告类型: {}", r#type))),
    }
    Ok(())
}

fn cmd_query(
    db: &Db,
    r#type: &str,
    point: Option<&str>,
    employee: Option<&str>,
    from: Option<&str>,
    to: Option<&str>,
    limit: i64,
    offset: i64,
    format: &str,
    export: Option<&std::path::Path>,
) -> Result<()> {
    let from_dt = parse_datetime_opt(from)?;
    let to_dt = parse_datetime_opt(to)?;

    let params = QueryParams {
        point_code: point.map(|s| s.to_string()),
        employee_id: employee.map(|s| s.to_string()),
        from: from_dt,
        to: to_dt,
        limit: Some(limit),
        offset: Some(offset),
    };

    match r#type {
        "survey" | "s" => {
            let records = query_survey_records(db, &params)?;
            match format {
                "table" => {
                    let table = render_survey_table(&records);
                    println!("{}", table);
                    println!("共 {} 条记录", records.len());
                }
                "csv" => {
                    if let Some(path) = export {
                        export_survey_csv(&records, path)?;
                        println!("{}", format!("已导出到 {:?}", path).green());
                    } else {
                        let mut wtr = csv::Writer::from_writer(std::io::stdout());
                        wtr.write_record(&["id", "point_code", "measure_time", "dose_rate", "unit", "surveyor", "instrument"])?;
                        for rec in &records {
                            wtr.write_record(&[
                                rec.id.to_string(),
                                rec.point_code.clone(),
                                rec.measure_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                                format!("{:.6}", rec.dose_rate),
                                rec.unit.clone(),
                                rec.surveyor.clone().unwrap_or_default(),
                                rec.instrument.clone().unwrap_or_default(),
                            ])?;
                        }
                        wtr.flush()?;
                    }
                }
                "json" => {
                    let json = serde_json::to_string_pretty(&records)?;
                    println!("{}", json);
                }
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        "dose" | "d" => {
            let records = query_dose_records(db, &params)?;
            match format {
                "table" => {
                    let table = render_dose_table(&records);
                    println!("{}", table);
                    println!("共 {} 条记录", records.len());
                }
                "csv" => {
                    if let Some(path) = export {
                        export_dose_csv(&records, path)?;
                        println!("{}", format!("已导出到 {:?}", path).green());
                    } else {
                        let mut wtr = csv::Writer::from_writer(std::io::stdout());
                        wtr.write_record(&["id", "employee_id", "employee_name", "department", "record_time", "cumulative_dose", "unit"])?;
                        for rec in &records {
                            wtr.write_record(&[
                                rec.id.to_string(),
                                rec.employee_id.clone(),
                                rec.employee_name.clone(),
                                rec.department.clone(),
                                rec.record_time.format("%Y-%m-%d %H:%M:%S").to_string(),
                                format!("{:.6}", rec.cumulative_dose),
                                rec.unit.clone(),
                            ])?;
                        }
                        wtr.flush()?;
                    }
                }
                "json" => {
                    let json = serde_json::to_string_pretty(&records)?;
                    println!("{}", json);
                }
                _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
            }
        }
        _ => return Err(err(ErrorCode::InvalidQueryType, format!("不支持的查询类型: {}", r#type))),
    }
    Ok(())
}

fn cmd_check(db: &Db, format: &str) -> Result<()> {
    let result = check::run_data_check(db)?;
    match format {
        "text" => print!("{}", check::format_check_report(&result)),
        "json" => println!("{}", serde_json::to_string_pretty(&result)?),
        _ => return Err(err(ErrorCode::UnsupportedFormat, format!("不支持的输出格式: {}", format))),
    }
    Ok(())
}

fn parse_datetime_opt(s: Option<&str>) -> Result<Option<NaiveDateTime>> {
    match s {
        None => Ok(None),
        Some(s) => {
            let dt = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                .or_else(|_| {
                    NaiveDate::parse_from_str(s, "%Y-%m-%d")
                        .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
                })
                .map_err(|_| err(ErrorCode::InvalidTimestamp, format!("时间格式无效: {}，请使用 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS", s)))?;
            Ok(Some(dt))
        }
    }
}
