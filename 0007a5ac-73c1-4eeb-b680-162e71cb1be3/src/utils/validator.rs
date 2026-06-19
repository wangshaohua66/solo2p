use std::path::Path;
use std::net::IpAddr;
use chrono::{DateTime, Utc, NaiveDate, NaiveDateTime};
use regex::Regex;
use anyhow::{Result, anyhow, bail};

pub fn validate_domain(domain: &str) -> Result<()> {
    if domain.is_empty() {
        bail!("域名不能为空");
    }
    if domain.len() > 253 {
        bail!("域名长度不能超过253字符");
    }
    let re = Regex::new(
        r"^(?i)([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?$"
    ).unwrap();
    if !re.is_match(domain) {
        bail!("无效的域名格式: {}", domain);
    }
    Ok(())
}

pub fn validate_ip(ip: &str) -> Result<()> {
    ip.parse::<IpAddr>()
        .map_err(|e| anyhow!("无效的IP地址格式 {}: {}", ip, e))?;
    Ok(())
}

pub fn validate_file_path(path: &str) -> Result<()> {
    let p = Path::new(path);
    if !p.exists() {
        bail!("文件不存在: {}", path);
    }
    if !p.is_file() {
        bail!("路径不是文件: {}", path);
    }
    Ok(())
}

pub fn validate_directory(path: &str) -> Result<()> {
    let p = Path::new(path);
    if !p.exists() {
        bail!("目录不存在: {}", path);
    }
    if !p.is_dir() {
        bail!("路径不是目录: {}", path);
    }
    Ok(())
}

pub fn validate_date_range(start: &str, end: &str) -> Result<(DateTime<Utc>, DateTime<Utc>)> {
    let start_dt = parse_datetime(start)?;
    let end_dt = parse_datetime(end)?;
    if start_dt >= end_dt {
        bail!("开始时间必须早于结束时间");
    }
    Ok((start_dt, end_dt))
}

pub fn parse_datetime(s: &str) -> Result<DateTime<Utc>> {
    let formats = &[
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ];

    for fmt in formats {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return Ok(DateTime::from_naive_utc_and_offset(naive, Utc));
        }
        if let Ok(naive_date) = NaiveDate::parse_from_str(s, fmt) {
            let naive_dt = naive_date.and_hms_opt(0, 0, 0).unwrap();
            return Ok(DateTime::from_naive_utc_and_offset(naive_dt, Utc));
        }
    }

    bail!("无法解析日期时间: {}, 支持的格式: YYYY-MM-DD HH:MM:SS, YYYY-MM-DD", s)
}

pub fn validate_positive_number(n: u64, name: &str) -> Result<()> {
    if n == 0 {
        bail!("{}必须为正整数", name);
    }
    Ok(())
}

pub fn validate_score_range(score: u8) -> Result<()> {
    if score > 100 {
        bail!("风险评分必须在0-100之间");
    }
    Ok(())
}

pub fn validate_threshold_range(value: f64, min: f64, max: f64, name: &str) -> Result<()> {
    if value < min || value > max {
        bail!("{}必须在{}到{}之间", name, min, max);
    }
    Ok(())
}

pub fn validate_concurrency(n: usize) -> Result<()> {
    if n == 0 || n > 1000 {
        bail!("并发数必须在1-1000之间");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_domain() {
        assert!(validate_domain("example.com").is_ok());
        assert!(validate_domain("sub.example.com").is_ok());
        assert!(validate_domain("test-domain.co.uk").is_ok());
        assert!(validate_domain("").is_err());
        assert!(validate_domain("-invalid.com").is_err());
    }

    #[test]
    fn test_validate_ip() {
        assert!(validate_ip("192.168.1.1").is_ok());
        assert!(validate_ip("::1").is_ok());
        assert!(validate_ip("invalid").is_err());
    }

    #[test]
    fn test_parse_datetime() {
        assert!(parse_datetime("2024-01-01 12:00:00").is_ok());
        assert!(parse_datetime("2024-01-01").is_ok());
        assert!(parse_datetime("invalid").is_err());
    }
}
