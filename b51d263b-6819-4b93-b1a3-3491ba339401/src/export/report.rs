use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use tabwriter::TabWriter;
use thiserror::Error;

use crate::calculator::fee::FeeResult;
use crate::cli::AppConfig;
use crate::db::operations::{AgingBucket, MonthlySummary};
use crate::models::port::FeeCategory;
use crate::utils::formatter;

#[derive(Debug, Error)]
pub enum ReportError {
    #[error("输出格式错误: {0}")]
    InvalidFormat(String),
    #[error("文件写入失败: {0}")]
    IoError(#[from] std::io::Error),
    #[error("CSV写入失败: {0}")]
    CsvError(#[from] csv::Error),
    #[error("JSON序列化失败: {0}")]
    JsonError(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeReportData {
    pub period: String,
    pub generated_at: DateTime<Utc>,
    pub summaries: Vec<MonthlySummary>,
    pub aging: Vec<AgingBucket>,
    pub total_vessels: usize,
    pub total_grand_total: f64,
    pub total_settled: f64,
    pub total_unsettled: f64,
    pub settlement_rate: f64,
    pub include_aging: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeDetailReportRow {
    pub fee_id: i64,
    pub imo: String,
    pub vessel_name: String,
    pub port_code: String,
    pub arrival_time: String,
    pub category: String,
    pub quantity: f64,
    pub unit_label: String,
    pub unit_rate: f64,
    pub amount: f64,
    pub has_dispute: bool,
    pub is_settled: bool,
}

pub fn generate_monthly_report(
    summaries: &[MonthlySummary],
    aging: &[AgingBucket],
    year: i32,
    month: u32,
    config: &AppConfig,
    format: &str,
    output: Option<&str>,
    include_aging: bool,
    verbose: bool,
) -> Result<(), ReportError> {
    let total_vessels: usize = summaries.iter().map(|s| s.vessel_count).sum();
    let total_grand_total: f64 = summaries.iter().map(|s| s.grand_total).sum();
    let total_settled: f64 = summaries.iter().map(|s| s.settled_amount).sum();
    let total_unsettled: f64 = summaries.iter().map(|s| s.unsettled_amount).sum();
    let settlement_rate = if total_grand_total > 0.0 {
        total_settled / total_grand_total * 100.0
    } else {
        0.0
    };

    let report_data = FeeReportData {
        period: format!("{}年{}月", year, formatter::month_name(month)),
        generated_at: Utc::now(),
        summaries: summaries.to_vec(),
        aging: aging.to_vec(),
        total_vessels,
        total_grand_total,
        total_settled,
        total_unsettled,
        settlement_rate,
        include_aging,
    };

    let content = match format.to_lowercase().as_str() {
        "table" => render_table_report(&report_data, config, verbose)?,
        "csv" => render_csv_report(&report_data, config)?,
        "json" => render_json_report(&report_data)?,
        other => return Err(ReportError::InvalidFormat(other.to_string())),
    };

    if let Some(path) = output {
        let mut file = File::create(path)?;
        file.write_all(content.as_bytes())?;
        formatter::success(&format!("报表已保存至: {}", path));
    } else {
        println!("{}", content);
    }

    Ok(())
}

fn render_table_report(
    data: &FeeReportData,
    config: &AppConfig,
    verbose: bool,
) -> Result<String, ReportError> {
    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);

        formatter::header(&format!("港口使费月度结算报表 - {}", data.period));

        writeln!(
            tw,
            "报表生成时间\t{}",
            formatter::format_datetime(&data.generated_at)
        )?;
        writeln!(tw, "统计周期\t{}", data.period)?;
        writeln!(tw, "代理艘次\t{}艘", data.total_vessels)?;
        writeln!(
            tw,
            "应收总额\t{}",
            formatter::format_currency(data.total_grand_total, &config.currency_symbol, config.decimals)
        )?;
        writeln!(
            tw,
            "已收金额\t{}",
            formatter::format_currency(data.total_settled, &config.currency_symbol, config.decimals)
        )?;
        writeln!(
            tw,
            "待收金额\t{}",
            formatter::format_currency(data.total_unsettled, &config.currency_symbol, config.decimals)
        )?;
        writeln!(tw, "结算率\t{:.2}%", data.settlement_rate)?;

        tw.flush()?;
    }
    let summary = String::from_utf8_lossy(&buf).to_string();
    println!("{}", summary);

    formatter::section_title("分组明细");

    let mut detail_buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut detail_buf);

        let header = if verbose {
            "港口代码\t港口名称\t艘次\t金额小计\t税额\t价税合计\t已收金额\t待收金额"
        } else {
            "港口代码\t港口名称\t艘次\t价税合计\t已收金额\t待收金额"
        };
        writeln!(tw, "{}", header.white().bold())?;
        writeln!(
            tw,
            "{}",
            "─".repeat(if verbose { 110 } else { 75 }).dimmed()
        )?;

        for s in &data.summaries {
            if verbose {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
                    s.port_code,
                    s.port_name,
                    s.vessel_count,
                    formatter::format_currency(s.total_amount, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.tax_amount, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.grand_total, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.settled_amount, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.unsettled_amount, &config.currency_symbol, config.decimals),
                )?;
            } else {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}\t{}",
                    s.port_code,
                    s.port_name,
                    s.vessel_count,
                    formatter::format_currency(s.grand_total, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.settled_amount, &config.currency_symbol, config.decimals),
                    formatter::format_currency(s.unsettled_amount, &config.currency_symbol, config.decimals),
                )?;
            }
        }

        writeln!(
            tw,
            "{}",
            "─".repeat(if verbose { 110 } else { 75 }).dimmed()
        )?;
        writeln!(
            tw,
            "{}\t{}\t{}\t{}\t{}\t{}",
            "合计",
            "",
            data.total_vessels,
            formatter::format_currency(data.total_grand_total, &config.currency_symbol, config.decimals),
            formatter::format_currency(data.total_settled, &config.currency_symbol, config.decimals),
            formatter::format_currency(data.total_unsettled, &config.currency_symbol, config.decimals),
        )?;

        tw.flush()?;
    }
    println!("{}", String::from_utf8_lossy(&detail_buf));

    if data.include_aging {
        render_aging_table(&data.aging, config);
    }

    Ok(String::new())
}

fn render_aging_table(aging: &[AgingBucket], config: &AppConfig) {
    formatter::section_title("账龄分析");

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        writeln!(tw, "{}", "账龄区间\t笔数\t金额\t占比\t进度条".white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(85).dimmed()).unwrap();

        let total_amount: f64 = aging.iter().map(|a| a.amount).sum();
        let total_count: usize = aging.iter().map(|a| a.count).sum();

        for bucket in aging {
            let pct = if total_amount > 0.0 {
                bucket.amount / total_amount * 100.0
            } else {
                0.0
            };
            let bar = formatter::render_bar(bucket.amount, total_amount, 25);
            writeln!(
                tw,
                "{}\t{}\t{}\t{:.2}%\t{}",
                bucket.range,
                bucket.count,
                formatter::format_currency(bucket.amount, &config.currency_symbol, config.decimals),
                pct,
                bar
            )
            .unwrap();
        }

        writeln!(tw, "{}", "─".repeat(85).dimmed()).unwrap();
        writeln!(
            tw,
            "{}\t{}\t{}\t{}%\t{}",
            "合计",
            total_count,
            formatter::format_currency(total_amount, &config.currency_symbol, config.decimals),
            "100.00",
            ""
        )
        .unwrap();
        tw.flush().unwrap();
    }
    println!("{}", String::from_utf8_lossy(&buf));
}

fn render_csv_report(data: &FeeReportData, config: &AppConfig) -> Result<String, ReportError> {
    let mut wtr = csv::Writer::from_writer(Vec::new());

    wtr.write_record(["# 港口使费月度结算报表"])?;
    wtr.write_record(["统计周期", &data.period])?;
    wtr.write_record(["生成时间", &formatter::format_datetime(&data.generated_at)])?;
    wtr.write_record(["代理艘次", &data.total_vessels.to_string()])?;
    wtr.write_record([
        "应收总额",
        &formatter::format_currency(data.total_grand_total, &config.currency_symbol, config.decimals),
    ])?;
    wtr.write_record([])?;

    wtr.write_record([
        "港口代码",
        "港口名称",
        "艘次",
        "金额小计",
        "税额",
        "价税合计",
        "已收金额",
        "待收金额",
    ])?;

    for s in &data.summaries {
        wtr.write_record(&[
            s.port_code.clone(),
            s.port_name.clone(),
            s.vessel_count.to_string(),
            format!("{:.2}", s.total_amount),
            format!("{:.2}", s.tax_amount),
            format!("{:.2}", s.grand_total),
            format!("{:.2}", s.settled_amount),
            format!("{:.2}", s.unsettled_amount),
        ])?;
    }
    wtr.write_record([])?;

    if data.include_aging {
        wtr.write_record(["# 账龄分析"])?;
        wtr.write_record(["账龄区间", "笔数", "金额"])?;
        for bucket in &data.aging {
            wtr.write_record(&[
                bucket.range.clone(),
                bucket.count.to_string(),
                format!("{:.2}", bucket.amount),
            ])?;
        }
    }

    wtr.flush()?;
    let bytes = wtr.into_inner().map_err(|e| csv::Error::from(e))?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

fn render_json_report(data: &FeeReportData) -> Result<String, ReportError> {
    Ok(serde_json::to_string_pretty(data)?)
}

pub fn generate_fee_detail_table(
    fee: &FeeResult,
    config: &AppConfig,
    verbose: bool,
) -> String {
    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);

        formatter::header(&format!(
            "费用明细 | {} ({}) | {}",
            fee.vessel_name,
            fee.imo,
            fee.port_code
        ));

        writeln!(
            tw,
            "抵港时间\t{}",
            formatter::format_datetime(&fee.arrival_time)
        )
        .unwrap();
        writeln!(
            tw,
            "离港时间\t{}",
            formatter::format_datetime(&fee.departure_time)
        )
        .unwrap();
        writeln!(
            tw,
            "停泊时长\t{}",
            formatter::format_duration_hours(
                (fee.departure_time - fee.arrival_time).num_minutes() as f64 / 60.0
            )
        )
        .unwrap();
        writeln!(
            tw,
            "计算时间\t{}",
            formatter::format_datetime(&fee.compute_time)
        )
        .unwrap();
        if fee.has_dispute {
            writeln!(tw, "争议标记\t{}", "⚠ 存在费用调整".yellow()).unwrap();
        }
        if fee.is_settled {
            writeln!(tw, "结算状态\t{} 已结算".green().bold()).unwrap();
            writeln!(
                tw,
                "已收金额\t{}",
                formatter::format_currency(fee.settled_amount, &config.currency_symbol, config.decimals)
            )
            .unwrap();
        } else {
            writeln!(tw, "结算状态\t{} 待结算".yellow()).unwrap();
        }
        tw.flush().unwrap();
    }
    let header = String::from_utf8_lossy(&buf).to_string();
    println!("{}", header);

    formatter::section_title("12项费用明细");

    let mut detail_buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut detail_buf);

        let hdr = if verbose {
            "序号\t费用项目\t基础费\t费率\t数量\t单位\t金额\t备注"
        } else {
            "序号\t费用项目\t数量\t单位\t金额"
        };
        writeln!(tw, "{}", hdr.white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(if verbose { 95 } else { 60 }).dimmed()).unwrap();

        for (i, d) in fee.details.iter().enumerate() {
            let remarks = if d.remarks.is_empty() {
                String::new()
            } else {
                d.remarks.clone().yellow().to_string()
            };

            if verbose {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
                    i + 1,
                    d.category_name,
                    formatter::format_currency(d.base_fee, &config.currency_symbol, config.decimals),
                    format!("{}/单位", d.unit_rate),
                    formatter::format_number(d.quantity, 2),
                    d.unit_label,
                    formatter::format_currency(d.amount, &config.currency_symbol, config.decimals).bold().to_string(),
                    remarks
                )
                .unwrap();
            } else {
                writeln!(
                    tw,
                    "{}\t{}\t{}\t{}\t{}",
                    i + 1,
                    d.category_name,
                    formatter::format_number(d.quantity, 2),
                    d.unit_label,
                    formatter::format_currency(d.amount, &config.currency_symbol, config.decimals).bold().to_string()
                )
                .unwrap();
            }
        }

        writeln!(tw, "{}", "─".repeat(if verbose { 95 } else { 60 }).dimmed()).unwrap();
        writeln!(
            tw,
            "{}\t{}\t\t\t\t\t{}\t",
            "",
            "金额小计".bold(),
            formatter::format_currency(fee.total_amount, &config.currency_symbol, config.decimals)
                .bold()
        )
        .unwrap();
        writeln!(
            tw,
            "{}\t{}\t\t\t\t\t{}\t",
            "",
            "增值税(6%)".dimmed(),
            formatter::format_currency(fee.tax_amount, &config.currency_symbol, config.decimals)
        )
        .unwrap();
        writeln!(
            tw,
            "{}\t{}\t\t\t\t\t{}\t",
            "",
            "价税合计".magenta().bold(),
            formatter::format_currency(fee.grand_total, &config.currency_symbol, config.decimals)
                .magenta()
                .bold()
        )
        .unwrap();

        tw.flush().unwrap();
    }
    String::from_utf8_lossy(&detail_buf).to_string()
}

pub fn generate_history_chart(
    records: &[FeeResult],
    config: &AppConfig,
) -> String {
    let mut monthly: HashMap<String, (f64, usize)> = HashMap::new();

    for fee in records {
        let key = format!("{:04}-{:02}", fee.compute_time.year(), fee.compute_time.month());
        let entry = monthly.entry(key).or_insert((0.0, 0));
        entry.0 += fee.grand_total;
        entry.1 += 1;
    }

    let mut months: Vec<String> = monthly.keys().cloned().collect();
    months.sort();

    let chart_data: Vec<(String, f64)> = months
        .iter()
        .map(|m| {
            let (amt, _) = monthly.get(m).unwrap();
            (m[5..].to_string() + "月", *amt)
        })
        .collect();

    if chart_data.is_empty() {
        return String::from("无历史费用数据");
    }

    let chart = formatter::render_ascii_line_chart(&chart_data, 8, "月度费用趋势图");

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        writeln!(tw, "{}", "月份\t艘次\t费用合计".white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(45).dimmed()).unwrap();

        let mut total = 0.0;
        let mut count = 0;
        for m in &months {
            let (amt, cnt) = monthly.get(m).unwrap();
            total += amt;
            count += cnt;
            writeln!(
                tw,
                "{}\t{}\t{}",
                m,
                cnt,
                formatter::format_currency(*amt, &config.currency_symbol, config.decimals)
            )
            .unwrap();
        }

        writeln!(tw, "{}", "─".repeat(45).dimmed()).unwrap();
        writeln!(
            tw,
            "{}\t{}\t{}",
            "合计",
            count,
            formatter::format_currency(total, &config.currency_symbol, config.decimals)
                .bold()
        )
        .unwrap();
        tw.flush().unwrap();
    }

    let table = String::from_utf8_lossy(&buf).to_string();
    format!("{}\n{}", chart, table)
}

pub fn generate_fee_category_summary(
    records: &[FeeResult],
    config: &AppConfig,
) -> String {
    let mut category_totals: HashMap<FeeCategory, f64> = HashMap::new();

    for fee in records {
        for d in &fee.details {
            *category_totals.entry(d.category).or_insert(0.0) += d.amount;
        }
    }

    let all_categories = FeeCategory::all();
    let total_all: f64 = category_totals.values().sum();

    let mut buf = Vec::new();
    {
        let mut tw = TabWriter::new(&mut buf);
        writeln!(tw, "{}", "费用类别\t金额\t占比\t进度条".white().bold()).unwrap();
        writeln!(tw, "{}", "─".repeat(75).dimmed()).unwrap();

        let max = category_totals.values().cloned().fold(0.0_f64, f64::max);

        for cat in &all_categories {
            let amt = *category_totals.get(cat).unwrap_or(&0.0);
            let pct = if total_all > 0.0 {
                amt / total_all * 100.0
            } else {
                0.0
            };
            let bar = formatter::render_bar(amt, max, 20);
            writeln!(
                tw,
                "{}\t{}\t{:.2}%\t{}",
                cat.display_name(),
                formatter::format_currency(amt, &config.currency_symbol, config.decimals),
                pct,
                bar
            )
            .unwrap();
        }

        writeln!(tw, "{}", "─".repeat(75).dimmed()).unwrap();
        writeln!(
            tw,
            "{}\t{}\t{}%\t{}",
            "合计",
            formatter::format_currency(total_all, &config.currency_symbol, config.decimals)
                .bold(),
            "100.00",
            ""
        )
        .unwrap();
        tw.flush().unwrap();
    }

    String::from_utf8_lossy(&buf).to_string()
}
