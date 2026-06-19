use std::sync::Arc;
use std::time::Duration;
use anyhow::{Result, Context, anyhow};
use chrono::{DateTime, Utc, NaiveDate};
use serde::{Deserialize, Serialize};
use regex::Regex;
use futures::stream::{self, StreamExt};

use crate::storage::sqlite::{DnsDatabase, WhoisRecord};

pub struct WhoisLookup {
    db: Option<Arc<DnsDatabase>>,
    cache_ttl: Duration,
    concurrency: usize,
    use_cache: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhoisResult {
    pub domain: String,
    pub registrar: Option<String>,
    pub registrant: Option<String>,
    pub registrant_email: Option<String>,
    pub creation_date: Option<DateTime<Utc>>,
    pub expiration_date: Option<DateTime<Utc>>,
    pub updated_date: Option<DateTime<Utc>>,
    pub name_servers: Vec<String>,
    pub status: Vec<String>,
    pub is_new_domain: bool,
    pub age_days: Option<i64>,
}

impl WhoisLookup {
    pub fn new(db: Option<Arc<DnsDatabase>>) -> Self {
        WhoisLookup {
            db,
            cache_ttl: Duration::from_secs(86400),
            concurrency: 50,
            use_cache: true,
        }
    }

    pub fn with_concurrency(mut self, concurrency: usize) -> Self {
        self.concurrency = concurrency.max(1).min(1000);
        self
    }

    pub fn with_cache_ttl(mut self, ttl: Duration) -> Self {
        self.cache_ttl = ttl;
        self
    }

    pub fn with_cache(mut self, use_cache: bool) -> Self {
        self.use_cache = use_cache;
        self
    }

    pub async fn lookup(&self, domain: &str) -> Result<WhoisResult> {
        let domain_lower = domain.to_lowercase();

        if self.use_cache {
            if let Some(ref db) = self.db {
                if let Ok(Some(cached)) = db.get_whois_cache(&domain_lower, self.cache_ttl) {
                    return Ok(Self::convert_to_result(cached, &domain_lower));
                }
            }
        }

        let result = self.query_whois(&domain_lower).await?;

        if self.use_cache {
            if let Some(ref db) = self.db {
                let record = WhoisRecord {
                    domain: domain_lower.clone(),
                    registrar: result.registrar.clone(),
                    registrant: result.registrant.clone(),
                    creation_date: result.creation_date,
                    expiration_date: result.expiration_date,
                };
                let _ = db.save_whois_cache(&domain_lower, &record);
            }
        }

        Ok(result)
    }

    pub async fn lookup_batch(&self, domains: &[String]) -> Vec<(String, Result<WhoisResult>)> {
        let owned_domains: Vec<String> = domains.iter().cloned().collect();
        let concurrency = self.concurrency;

        stream::iter(owned_domains)
            .map(|domain| async move {
                let result = self.lookup(&domain).await;
                (domain, result)
            })
            .buffer_unordered(concurrency)
            .collect()
            .await
    }

    async fn query_whois(&self, domain: &str) -> Result<WhoisResult> {
        let whois_server = Self::find_whois_server(domain)?;

        let query = format!("{}\r\n", domain);
        let addr = format!("{}:43", whois_server);

        let result = tokio::time::timeout(
            Duration::from_secs(30),
            Self::whois_query(&addr, &query),
        ).await;

        let response = result
            .map_err(|e| anyhow!("WHOIS查询超时: {}", e))?
            .map_err(|e| anyhow!("WHOIS查询失败: {}", e))?;

        let whois_result = Self::parse_whois_response(domain, &response)?;

        Ok(whois_result)
    }

    async fn whois_query(server: &str, query: &str) -> Result<String> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpStream;

        let mut stream = TcpStream::connect(server)
            .await
            .with_context(|| format!("无法连接到WHOIS服务器: {}", server))?;

        stream.write_all(query.as_bytes())
            .await
            .context("发送WHOIS查询失败")?;

        let mut response = String::new();
        stream.read_to_string(&mut response)
            .await
            .context("读取WHOIS响应失败")?;

        Ok(response)
    }

    fn find_whois_server(domain: &str) -> Result<String> {
        let tld = domain.split('.').last().unwrap_or("com");

        let tld_servers = [
            ("com", "whois.verisign-grs.com"),
            ("net", "whois.verisign-grs.com"),
            ("org", "whois.pir.org"),
            ("cn", "whois.cnnic.cn"),
            ("com.cn", "whois.cnnic.cn"),
            ("net.cn", "whois.cnnic.cn"),
            ("org.cn", "whois.cnnic.cn"),
            ("io", "whois.nic.io"),
            ("cc", "whois.nic.cc"),
            ("info", "whois.afilias.net"),
            ("biz", "whois.biz"),
            ("tv", "whois.nic.tv"),
            ("name", "whois.nic.name"),
        ];

        let best_match = tld_servers
            .iter()
            .filter(|(t, _)| domain.ends_with(t) && (domain.len() > t.len() + 1 || domain == *t))
            .max_by_key(|(t, _)| t.len());

        if let Some((_, server)) = best_match {
            Ok(server.to_string())
        } else {
            Ok(format!("whois.nic.{}", tld))
        }
    }

    fn parse_whois_response(domain: &str, response: &str) -> Result<WhoisResult> {
        let mut result = WhoisResult {
            domain: domain.to_string(),
            registrar: None,
            registrant: None,
            registrant_email: None,
            creation_date: None,
            expiration_date: None,
            updated_date: None,
            name_servers: Vec::new(),
            status: Vec::new(),
            is_new_domain: false,
            age_days: None,
        };

        for line in response.lines() {
            let line_lower = line.to_lowercase();

            if line_lower.contains("registrar:") && result.registrar.is_none() {
                if let Some(val) = Self::extract_value(line, "Registrar:") {
                    if !val.is_empty() && !val.contains("---") {
                        result.registrar = Some(val);
                    }
                }
            }

            if line_lower.contains("registrant name:") || line_lower.contains("registrant organization:") {
                if let Some(val) = Self::extract_value(line, ":") {
                    if !val.is_empty() && !val.contains("---") && result.registrant.is_none() {
                        result.registrant = Some(val);
                    }
                }
            }

            if line_lower.contains("registrant email:") || line_lower.contains("registrant e-mail:") {
                if let Some(val) = Self::extract_value(line, ":") {
                    if !val.is_empty() && !val.contains("---") {
                        result.registrant_email = Some(val);
                    }
                }
            }

            if (line_lower.contains("creation date:") || line_lower.contains("created:")) 
                && result.creation_date.is_none() 
            {
                if let Some(val) = Self::extract_value(line, ":") {
                    if let Ok(dt) = Self::parse_date(&val) {
                        result.creation_date = Some(dt);
                    }
                }
            }

            if (line_lower.contains("expiration date:") || line_lower.contains("expiry date:") || line_lower.contains("registrar registration expiration date:"))
                && result.expiration_date.is_none()
            {
                if let Some(val) = Self::extract_value(line, ":") {
                    if let Ok(dt) = Self::parse_date(&val) {
                        result.expiration_date = Some(dt);
                    }
                }
            }

            if (line_lower.contains("updated date:") || line_lower.contains("last updated:"))
                && result.updated_date.is_none()
            {
                if let Some(val) = Self::extract_value(line, ":") {
                    if let Ok(dt) = Self::parse_date(&val) {
                        result.updated_date = Some(dt);
                    }
                }
            }

            if line_lower.contains("name server:") || line_lower.contains("nameserver:") {
                if let Some(val) = Self::extract_value(line, ":") {
                    if !val.is_empty() && !val.contains("---") {
                        result.name_servers.push(val.trim().to_lowercase());
                    }
                }
            }

            if line_lower.contains("domain status:") || line_lower.contains("status:") {
                if let Some(val) = Self::extract_value(line, ":") {
                    if !val.is_empty() && !val.contains("---") {
                        result.status.push(val.trim().to_string());
                    }
                }
            }
        }

        if let Some(creation) = result.creation_date {
            let age = Utc::now() - creation;
            result.age_days = Some(age.num_days());
            result.is_new_domain = age.num_days() < 30;
        }

        Ok(result)
    }

    fn extract_value(line: &str, separator: &str) -> Option<String> {
        let idx = line.find(separator)?;
        let value = &line[idx + separator.len()..];
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    }

    fn parse_date(s: &str) -> Result<DateTime<Utc>> {
        let s = s.trim();
        let formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%d-%b-%Y",
            "%d-%b-%Y %H:%M:%S",
            "%B %d, %Y",
        ];

        for fmt in &formats {
            if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, fmt) {
                return Ok(DateTime::from_naive_utc_and_offset(naive, Utc));
            }
            if let Ok(date) = NaiveDate::parse_from_str(s, fmt) {
                let dt = date.and_hms_opt(0, 0, 0).unwrap();
                return Ok(DateTime::from_naive_utc_and_offset(dt, Utc));
            }
        }

        let re = Regex::new(r"(\d{4}-\d{2}-\d{2})").unwrap();
        if let Some(caps) = re.captures(s) {
            if let Ok(date) = NaiveDate::parse_from_str(&caps[1], "%Y-%m-%d") {
                let dt = date.and_hms_opt(0, 0, 0).unwrap();
                return Ok(DateTime::from_naive_utc_and_offset(dt, Utc));
            }
        }

        Err(anyhow!("无法解析日期: {}", s))
    }

    fn convert_to_result(record: WhoisRecord, domain: &str) -> WhoisResult {
        let age_days = record.age_days();
        WhoisResult {
            domain: domain.to_string(),
            registrar: record.registrar.clone(),
            registrant: record.registrant.clone(),
            registrant_email: None,
            creation_date: record.creation_date,
            expiration_date: record.expiration_date,
            updated_date: None,
            name_servers: Vec::new(),
            status: Vec::new(),
            is_new_domain: record.is_new_domain(30),
            age_days,
        }
    }
}

pub fn read_domain_list(path: &std::path::Path) -> Result<Vec<String>> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("无法读取域名列表文件: {}", path.display()))?;

    let domains: Vec<String> = content
        .lines()
        .map(|l| l.trim().to_lowercase())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .collect();

    if domains.is_empty() {
        return Err(anyhow!("域名列表文件为空"));
    }

    Ok(domains)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_date() {
        assert!(WhoisLookup::parse_date("2024-01-15").is_ok());
        assert!(WhoisLookup::parse_date("2024-01-15T10:30:00").is_ok());
        assert!(WhoisLookup::parse_date("invalid").is_err());
    }

    #[test]
    fn test_extract_value() {
        assert_eq!(
            WhoisLookup::extract_value("Registrar: Example Inc.", "Registrar:"),
            Some("Example Inc.".to_string())
        );
    }
}
