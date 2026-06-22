use chrono::{DateTime, Datelike, Utc};
use colored::Colorize;
use serde::Serialize;
use std::collections::HashMap;

pub fn format_currency(amount: f64, symbol: &str, decimals: u32) -> String {
    let rounded = format!("{:.1$}", amount, decimals as usize);
    let parts: Vec<&str> = rounded.split('.').collect();
    let integer_part = parts[0];
    let decimal_part = if parts.len() > 1 { parts[1] } else { "" };

    let negative = integer_part.starts_with('-');
    let digits: String = if negative {
        integer_part[1..].to_string()
    } else {
        integer_part.to_string()
    };

    let mut result = String::new();
    let chars: Vec<char> = digits.chars().collect();
    let len = chars.len();

    for (i, c) in chars.iter().enumerate() {
        result.push(*c);
        let remaining = len - i - 1;
        if remaining > 0 && remaining % 3 == 0 {
            result.push(',');
        }
    }

    if !decimal_part.is_empty() {
        result.push('.');
        result.push_str(decimal_part);
    }

    if negative {
        format!("-{}{}", symbol, result)
    } else {
        format!("{}{}", symbol, result)
    }
}

pub fn format_number(num: f64, decimals: u32) -> String {
    let rounded = format!("{:.1$}", num, decimals as usize);
    let parts: Vec<&str> = rounded.split('.').collect();
    let integer_part = parts[0];
    let decimal_part = if parts.len() > 1 { parts[1] } else { "" };

    let negative = integer_part.starts_with('-');
    let digits: String = if negative {
        integer_part[1..].to_string()
    } else {
        integer_part.to_string()
    };

    let mut result = String::new();
    let chars: Vec<char> = digits.chars().collect();
    let len = chars.len();

    for (i, c) in chars.iter().enumerate() {
        result.push(*c);
        let remaining = len - i - 1;
        if remaining > 0 && remaining % 3 == 0 {
            result.push(',');
        }
    }

    if !decimal_part.is_empty() {
        result.push('.');
        result.push_str(decimal_part);
    }

    if negative {
        format!("-{}", result)
    } else {
        result
    }
}

pub fn format_datetime(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn format_date(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d").to_string()
}

pub fn format_duration_hours(hours: f64) -> String {
    if hours < 24.0 {
        format!("{:.1}小时", hours)
    } else {
        let days = hours / 24.0;
        format!("{:.1}天 ({:.0}小时)", days, hours)
    }
}

pub fn success(msg: &str) {
    println!("{} {}", "✓".green().bold(), msg.green().bold());
}

pub fn warn(msg: &str) {
    println!("{} {}", "⚠".yellow().bold(), msg.yellow());
}

pub fn error(msg: &str) {
    eprintln!("{} {}", "✗".red().bold(), msg.red().bold());
}

pub fn info(msg: &str) {
    println!("{} {}", "ℹ".blue().bold(), msg.blue());
}

pub fn header(title: &str) {
    let separator = "═".repeat(60);
    println!("\n{}", separator.cyan().bold());
    println!("{}", format!("  {}  ", title).cyan().bold().center(60));
    println!("{}", separator.cyan().bold());
}

pub fn section_title(title: &str) {
    println!("\n{} {}", "▶".magenta().bold(), title.magenta().bold());
    println!("{}", "─".repeat(50).magenta());
}

pub fn print_bold_header(columns: &[&str], widths: &[usize]) {
    let header: Vec<String> = columns
        .iter()
        .enumerate()
        .map(|(i, c)| format!("{:>width$}", c.bold(), width = widths.get(i).copied().unwrap_or(12)))
        .collect();
    println!("{}", header.join("  ").white().bold());
    println!("{}", widths.iter().map(|w| "─".repeat(*w)).collect::<Vec<_>>().join("  ").dimmed());
}

pub fn truncate(s: &str, max_len: usize) -> String {
    if s.chars().count() <= max_len {
        s.to_string()
    } else {
        let mut result: String = s.chars().take(max_len.saturating_sub(1)).collect();
        result.push('…');
        result
    }
}

pub fn pad_right(s: &str, width: usize) -> String {
    let len = s.chars().count();
    if len >= width {
        s.to_string()
    } else {
        format!("{}{}", s, " ".repeat(width - len))
    }
}

pub fn pad_left(s: &str, width: usize) -> String {
    let len = s.chars().count();
    if len >= width {
        s.to_string()
    } else {
        format!("{}{}", " ".repeat(width - len), s)
    }
}

pub fn render_ascii_line_chart(
    data: &[(String, f64)],
    height: usize,
    title: &str,
) -> String {
    if data.is_empty() {
        return String::from("无数据可显示");
    }

    let max_val = data.iter().map(|(_, v)| *v).fold(0.0_f64, f64::max);
    let max_val = if max_val == 0.0 { 1.0 } else { max_val };

    let mut chart = String::new();
    chart.push_str(&format!("\n  {}\n", title.bold()));
    chart.push_str(&format!("  {}\n", "─".repeat(data.len() * 4 + 10)));

    for row in 0..height {
        let threshold = max_val * (1.0 - row as f64 / (height - 1).max(1) as f64);
        let label = if row == 0 {
            format!("{:>8.0} |", max_val)
        } else if row == height - 1 {
            format!("{:>8} |", "0")
        } else {
            format!("{:>8} |", "")
        };
        chart.push_str(&format!("  {}", label.dimmed()));

        for (_, value) in data {
            let ch = if *value >= threshold { "█" } else { " " };
            chart.push_str(&format!("{} ", ch));
        }
        chart.push('\n');
    }

    chart.push_str(&format!("  {}{}\n", "─".repeat(10), "─".repeat(data.len() * 4).dimmed()));

    let mut labels_line = format!("  {:>10}", "");
    let max_label_chars = 4;
    for (label, _) in data {
        let truncated: String = label.chars().take(max_label_chars).collect();
        labels_line.push_str(&format!("{:<4}", truncated.dimmed()));
    }
    chart.push_str(&labels_line);
    chart.push('\n');

    chart
}

pub fn render_bar(value: f64, max: f64, width: usize) -> String {
    if max <= 0.0 {
        return " ".repeat(width);
    }
    let pct = (value / max).clamp(0.0, 1.0);
    let filled = (pct * width as f64).round() as usize;
    let bar: String = "█".repeat(filled) + &"░".repeat(width - filled);
    if pct >= 0.9 {
        bar.green().to_string()
    } else if pct >= 0.6 {
        bar.yellow().to_string()
    } else if pct >= 0.3 {
        bar.cyan().to_string()
    } else {
        bar.red().to_string()
    }
}

pub fn parse_date_range(range: &str) -> Result<(DateTime<Utc>, DateTime<Utc>), String> {
    let parts: Vec<&str> = range.split(':').collect();
    if parts.len() != 2 {
        return Err("日期范围格式应为 YYYY-MM-DD:YYYY-MM-DD".to_string());
    }

    let start = chrono::NaiveDate::parse_from_str(parts[0], "%Y-%m-%d")
        .map_err(|e| format!("起始日期格式错误: {}", e))?;
    let end = chrono::NaiveDate::parse_from_str(parts[1], "%Y-%m-%d")
        .map_err(|e| format!("结束日期格式错误: {}", e))?;

    if start > end {
        return Err("起始日期必须早于或等于结束日期".to_string());
    }

    Ok((
        start.and_hms_opt(0, 0, 0).unwrap().and_utc(),
        end.and_hms_opt(23, 59, 59).unwrap().and_utc(),
    ))
}

pub fn parse_month(month: &str) -> Result<(i32, u32), String> {
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err("月份格式应为 YYYY-MM".to_string());
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| "年份无效".to_string())?;
    let m: u32 = parts[1]
        .parse()
        .map_err(|_| "月份无效".to_string())?;
    if !(1..=12).contains(&m) {
        return Err("月份应在1-12之间".to_string());
    }
    Ok((year, m))
}

pub fn month_name(month: u32) -> &'static str {
    match month {
        1 => "一月",
        2 => "二月",
        3 => "三月",
        4 => "四月",
        5 => "五月",
        6 => "六月",
        7 => "七月",
        8 => "八月",
        9 => "九月",
        10 => "十月",
        11 => "十一月",
        12 => "十二月",
        _ => "未知",
    }
}

pub fn format_json<T: Serialize>(data: &T, pretty: bool) -> Result<String, String> {
    if pretty {
        serde_json::to_string_pretty(data).map_err(|e| e.to_string())
    } else {
        serde_json::to_string(data).map_err(|e| e.to_string())
    }
}

pub fn group_by_month<T, F>(items: &[T], f: F) -> HashMap<String, Vec<&T>>
where
    F: Fn(&T) -> DateTime<Utc>,
{
    let mut map: HashMap<String, Vec<&T>> = HashMap::new();
    for item in items {
        let dt = f(item);
        let key = format!("{:04}-{:02}", dt.year(), dt.month());
        map.entry(key).or_default().push(item);
    }
    map
}

pub fn terminal_width() -> usize {
    crossterm_workaround()
}

fn crossterm_workaround() -> usize {
    match std::env::var("COLUMNS") {
        Ok(s) => s.parse().unwrap_or(120),
        Err(_) => 120,
    }
}
