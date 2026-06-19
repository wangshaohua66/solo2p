use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use reqwest::Client;
use lru::LruCache;
use std::num::NonZeroUsize;

use crate::config::ThreatIntelConfig;
use crate::storage::sqlite::DnsDatabase;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIntelResult {
    pub domain: String,
    pub is_malicious: bool,
    pub sources: Vec<IntelSourceInfo>,
    pub risk_score: u8,
    pub first_seen: Option<DateTime<Utc>>,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelSourceInfo {
    pub source: String,
    pub malicious: bool,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntelSource {
    VirusTotal,
    AlienVault,
    ThreatBook,
}

impl IntelSource {
    pub fn name(&self) -> &str {
        match self {
            IntelSource::VirusTotal => "virustotal",
            IntelSource::AlienVault => "alienvault",
            IntelSource::ThreatBook => "threatbook",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            IntelSource::VirusTotal => "VirusTotal",
            IntelSource::AlienVault => "AlienVault OTX",
            IntelSource::ThreatBook => "威胁猎人",
        }
    }
}

pub struct ThreatIntelAggregator {
    config: ThreatIntelConfig,
    client: Client,
    db: Option<Arc<DnsDatabase>>,
    memory_cache: Arc<RwLock<LruCache<String, ThreatIntelResult>>>,
}

impl ThreatIntelAggregator {
    pub fn new(config: ThreatIntelConfig, db: Option<Arc<DnsDatabase>>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        let cache_size = NonZeroUsize::new(10000).unwrap();
        let memory_cache = Arc::new(RwLock::new(LruCache::new(cache_size)));

        ThreatIntelAggregator {
            config,
            client,
            db,
            memory_cache,
        }
    }

    pub async fn lookup_domain(&self, domain: &str) -> Result<ThreatIntelResult> {
        {
            let cache = self.memory_cache.read().await;
            if let Some(cached) = cache.peek(domain) {
                let age = Utc::now() - cached.last_updated;
                if age.num_seconds() < self.config.cache_ttl_seconds as i64 {
                    return Ok(cached.clone());
                }
            }
        }

        let result = self.query_all_sources(domain).await?;

        {
            let mut cache = self.memory_cache.write().await;
            cache.put(domain.to_string(), result.clone());
        }

        Ok(result)
    }

    pub async fn lookup_domains(&self, domains: &[String]) -> HashMap<String, ThreatIntelResult> {
        let mut results = HashMap::new();
        let mut to_query = Vec::new();

        {
            let cache = self.memory_cache.read().await;
            for domain in domains {
                if let Some(cached) = cache.peek(domain) {
                    let age = Utc::now() - cached.last_updated;
                    if age.num_seconds() < self.config.cache_ttl_seconds as i64 {
                        results.insert(domain.clone(), cached.clone());
                        continue;
                    }
                }
                to_query.push(domain.clone());
            }
        }

        for domain in to_query {
            if let Ok(result) = self.lookup_domain(&domain).await {
                results.insert(domain, result);
            }
        }

        results
    }

    async fn query_all_sources(&self, domain: &str) -> Result<ThreatIntelResult> {
        let mut sources = Vec::new();
        let mut total_score = 0u8;
        let mut source_count = 0u8;

        if self.config.virustotal_api_key.is_some() {
            match self.query_virustotal(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(35);
                    }
                    source_count += 1;
                    sources.push(info);
                }
                Err(e) => {
                    tracing::warn!("VirusTotal query failed for {}: {}", domain, e);
                }
            }
        }

        if self.config.alienvault_api_key.is_some() {
            match self.query_alienvault(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(30);
                    }
                    source_count += 1;
                    sources.push(info);
                }
                Err(e) => {
                    tracing::warn!("AlienVault query failed for {}: {}", domain, e);
                }
            }
        }

        if self.config.threatbook_api_key.is_some() {
            match self.query_threatbook(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(35);
                    }
                    source_count += 1;
                    sources.push(info);
                }
                Err(e) => {
                    tracing::warn!("ThreatBook query failed for {}: {}", domain, e);
                }
            }
        }

        let is_malicious = sources.iter().any(|s| s.malicious);

        Ok(ThreatIntelResult {
            domain: domain.to_string(),
            is_malicious,
            sources,
            risk_score: total_score.min(100),
            first_seen: None,
            last_updated: Utc::now(),
        })
    }

    async fn query_virustotal(&self, domain: &str) -> Result<IntelSourceInfo> {
        let api_key = self.config
            .virustotal_api_key
            .as_ref()
            .ok_or_else(|| anyhow!("VirusTotal API key not configured"))?;

        let url = format!("https://www.virustotal.com/api/v3/domains/{}", domain);

        let response = self.client
            .get(&url)
            .header("x-apikey", api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(IntelSourceInfo {
                source: IntelSource::VirusTotal.name().to_string(),
                malicious: false,
                details: Some(format!("API返回状态: {}", response.status())),
            });
        }

        let body: serde_json::Value = response.json().await?;
        let malicious = body
            .pointer("/data/attributes/last_analysis_stats/malicious")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) > 0;

        let positives = body
            .pointer("/data/attributes/last_analysis_stats/malicious")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let total = body
            .pointer("/data/attributes/last_analysis_stats")
            .and_then(|v| v.as_object())
            .map(|o| o.values().filter_map(|v| v.as_i64()).sum::<i64>())
            .unwrap_or(0);

        Ok(IntelSourceInfo {
            source: IntelSource::VirusTotal.name().to_string(),
            malicious,
            details: Some(format!("{}/{} 引擎检测为恶意", positives, total)),
        })
    }

    async fn query_alienvault(&self, domain: &str) -> Result<IntelSourceInfo> {
        let api_key = self.config
            .alienvault_api_key
            .as_ref()
            .ok_or_else(|| anyhow!("AlienVault API key not configured"))?;

        let url = format!(
            "https://otx.alienvault.com/api/v1/indicators/domain/{}/general",
            domain
        );

        let response = self.client
            .get(&url)
            .header("X-OTX-API-KEY", api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(IntelSourceInfo {
                source: IntelSource::AlienVault.name().to_string(),
                malicious: false,
                details: Some(format!("API返回状态: {}", response.status())),
            });
        }

        let body: serde_json::Value = response.json().await?;
        let pulse_count = body
            .pointer("/pulse_info/count")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let malicious = pulse_count > 0;

        Ok(IntelSourceInfo {
            source: IntelSource::AlienVault.name().to_string(),
            malicious,
            details: Some(format!("关联 {} 个威胁情报", pulse_count)),
        })
    }

    async fn query_threatbook(&self, domain: &str) -> Result<IntelSourceInfo> {
        let api_key = self.config
            .threatbook_api_key
            .as_ref()
            .ok_or_else(|| anyhow!("ThreatBook API key not configured"))?;

        let url = "https://api.threatbook.cn/v3/domain/query";

        let response = self.client
            .get(url)
            .query(&[("apikey", api_key.as_str()), ("resource", domain)])
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(IntelSourceInfo {
                source: IntelSource::ThreatBook.name().to_string(),
                malicious: false,
                details: Some(format!("API返回状态: {}", response.status())),
            });
        }

        let body: serde_json::Value = response.json().await?;
        let is_malicious = body
            .pointer("/data/judgments")
            .and_then(|v| v.as_array())
            .map(|arr| !arr.is_empty())
            .unwrap_or(false);

        let judgments = body
            .pointer("/data/judgments")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_else(|| "无".to_string());

        Ok(IntelSourceInfo {
            source: IntelSource::ThreatBook.name().to_string(),
            malicious: is_malicious,
            details: Some(format!("判定: {}", judgments)),
        })
    }

    pub fn cache_stats(&self) -> usize {
        0
    }

    pub fn get_sources(&self) -> Vec<IntelSource> {
        let mut sources = Vec::new();
        if self.config.virustotal_api_key.is_some() {
            sources.push(IntelSource::VirusTotal);
        }
        if self.config.alienvault_api_key.is_some() {
            sources.push(IntelSource::AlienVault);
        }
        if self.config.threatbook_api_key.is_some() {
            sources.push(IntelSource::ThreatBook);
        }
        sources
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intel_source_names() {
        assert_eq!(IntelSource::VirusTotal.name(), "virustotal");
        assert_eq!(IntelSource::AlienVault.name(), "alienvault");
        assert_eq!(IntelSource::ThreatBook.name(), "threatbook");
    }
}
