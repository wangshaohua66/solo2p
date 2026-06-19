use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};
use chrono::{DateTime, Utc};
use reqwest::Client;
use lru::LruCache;
use std::num::NonZeroUsize;
use futures::stream::{self, StreamExt};

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

    pub fn from_name(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "virustotal" | "vt" => Some(IntelSource::VirusTotal),
            "alienvault" | "otx" => Some(IntelSource::AlienVault),
            "threatbook" | "威胁猎人" => Some(IntelSource::ThreatBook),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_hit_rate: f64,
    pub cache_size: usize,
    pub cache_capacity: usize,
    pub api_calls_total: u64,
}

struct CacheCounters {
    total_requests: AtomicU64,
    cache_hits: AtomicU64,
    api_calls: AtomicU64,
}

impl CacheCounters {
    fn new() -> Self {
        CacheCounters {
            total_requests: AtomicU64::new(0),
            cache_hits: AtomicU64::new(0),
            api_calls: AtomicU64::new(0),
        }
    }

    fn record_hit(&self) {
        self.total_requests.fetch_add(1, Ordering::SeqCst);
        self.cache_hits.fetch_add(1, Ordering::SeqCst);
    }

    fn record_miss(&self) {
        self.total_requests.fetch_add(1, Ordering::SeqCst);
    }

    fn record_api_call(&self) {
        self.api_calls.fetch_add(1, Ordering::SeqCst);
    }

    fn stats(&self, cache_size: usize, cache_capacity: usize) -> CacheStats {
        let total = self.total_requests.load(Ordering::SeqCst);
        let hits = self.cache_hits.load(Ordering::SeqCst);
        let rate = if total > 0 {
            hits as f64 / total as f64 * 100.0
        } else {
            0.0
        };
        CacheStats {
            total_requests: total,
            cache_hits: hits,
            cache_misses: total - hits,
            cache_hit_rate: rate,
            cache_size,
            cache_capacity,
            api_calls_total: self.api_calls.load(Ordering::SeqCst),
        }
    }

    fn reset(&self) {
        self.total_requests.store(0, Ordering::SeqCst);
        self.cache_hits.store(0, Ordering::SeqCst);
        self.api_calls.store(0, Ordering::SeqCst);
    }
}

const CACHE_CAPACITY: usize = 10000;

pub struct ThreatIntelAggregator {
    config: ThreatIntelConfig,
    client: Client,
    db: Option<Arc<DnsDatabase>>,
    memory_cache: Arc<RwLock<LruCache<String, ThreatIntelResult>>>,
    counters: Arc<CacheCounters>,
}

impl ThreatIntelAggregator {
    pub fn new(config: ThreatIntelConfig, db: Option<Arc<DnsDatabase>>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        let cache_size = NonZeroUsize::new(CACHE_CAPACITY).unwrap();
        let memory_cache = Arc::new(RwLock::new(LruCache::new(cache_size)));

        ThreatIntelAggregator {
            config,
            client,
            db,
            memory_cache,
            counters: Arc::new(CacheCounters::new()),
        }
    }

    pub fn cache_stats(&self) -> CacheStats {
        let cache_guard = self.memory_cache.try_read();
        let cache_size = cache_guard.as_ref().map(|c| c.len()).unwrap_or(0);
        drop(cache_guard);
        self.counters.stats(cache_size, CACHE_CAPACITY)
    }

    pub fn reset_cache_stats(&self) {
        self.counters.reset();
    }

    pub async fn lookup_domain(&self, domain: &str) -> Result<ThreatIntelResult> {
        {
            let cache = self.memory_cache.read().await;
            if let Some(cached) = cache.peek(domain) {
                let age = Utc::now() - cached.last_updated;
                if age.num_seconds() < self.config.cache_ttl_seconds as i64 {
                    self.counters.record_hit();
                    return Ok(cached.clone());
                }
            }
        }

        self.counters.record_miss();
        let result = self.query_all_sources(domain).await?;

        {
            let mut cache = self.memory_cache.write().await;
            cache.put(domain.to_string(), result.clone());
        }

        Ok(result)
    }

    pub async fn lookup_domain_from_source(
        &self,
        domain: &str,
        source: IntelSource,
    ) -> Result<IntelSourceInfo> {
        self.counters.record_api_call();
        match source {
            IntelSource::VirusTotal => self.query_virustotal(domain).await,
            IntelSource::AlienVault => self.query_alienvault(domain).await,
            IntelSource::ThreatBook => self.query_threatbook(domain).await,
        }
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
                        self.counters.record_hit();
                        results.insert(domain.clone(), cached.clone());
                        continue;
                    }
                }
                self.counters.record_miss();
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

    pub async fn list_cached_intel(
        &self,
        filter_source: Option<IntelSource>,
        only_malicious: bool,
    ) -> Vec<ThreatIntelResult> {
        let cache = self.memory_cache.read().await;
        cache.iter()
            .filter_map(|(_, v)| {
                let mut result = v.clone();

                if let Some(src) = filter_source {
                    result.sources = result.sources
                        .into_iter()
                        .filter(|s| s.source == src.name())
                        .collect();
                    if result.sources.is_empty() {
                        return None;
                    }
                    result.is_malicious = result.sources.iter().any(|s| s.malicious);
                }

                if only_malicious && !result.is_malicious {
                    return None;
                }

                Some(result)
            })
            .collect()
    }

    pub async fn refresh_all(&self) -> Result<usize> {
        let domains: Vec<String> = {
            let cache = self.memory_cache.read().await;
            cache.iter().map(|(k, _)| k.clone()).collect()
        };

        if domains.is_empty() {
            return Ok(0);
        }

        let concurrency = 10;
        let refreshed_count = Arc::new(AtomicU64::new(0));
        let refreshed_count_clone = Arc::clone(&refreshed_count);
        let memory_cache = Arc::clone(&self.memory_cache);
        let client = self.client.clone();
        let config = self.config.clone();
        let counters = Arc::clone(&self.counters);

        stream::iter(domains)
            .map(|domain| {
                let domain = domain.clone();
                let memory_cache_clone = Arc::clone(&memory_cache);
                let client_clone = client.clone();
                let config_clone = config.clone();
                let counters_clone = Arc::clone(&counters);
                let refreshed = Arc::clone(&refreshed_count_clone);
                async move {
                    counters_clone.record_api_call();
                    if let Ok(result) = query_all_sources_static(
                        &client_clone,
                        &config_clone,
                        &domain,
                    ).await {
                        let mut cache = memory_cache_clone.write().await;
                        cache.put(domain.clone(), result);
                        refreshed.fetch_add(1, Ordering::SeqCst);
                    }
                }
            })
            .buffer_unordered(concurrency)
            .collect::<Vec<_>>()
            .await;

        Ok(refreshed_count.load(Ordering::SeqCst) as usize)
    }

    pub async fn refresh_domain(&self, domain: &str) -> Result<ThreatIntelResult> {
        self.counters.record_api_call();
        let result = self.query_all_sources(domain).await?;

        {
            let mut cache = self.memory_cache.write().await;
            cache.put(domain.to_string(), result.clone());
        }

        Ok(result)
    }

    pub async fn get_malicious_domains(&self) -> Vec<ThreatIntelResult> {
        let cache = self.memory_cache.read().await;
        cache.iter()
            .filter_map(|(_, v)| if v.is_malicious { Some(v.clone()) } else { None })
            .collect()
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

    async fn query_all_sources(&self, domain: &str) -> Result<ThreatIntelResult> {
        let mut sources = Vec::new();
        let mut total_score = 0u8;

        if self.config.virustotal_api_key.is_some() {
            self.counters.record_api_call();
            match self.query_virustotal(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(35);
                    }
                    sources.push(info);
                }
                Err(e) => {
                    eprintln!("[警告] VirusTotal查询失败 ({}): {}", domain, e);
                }
            }
        }

        if self.config.alienvault_api_key.is_some() {
            self.counters.record_api_call();
            match self.query_alienvault(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(30);
                    }
                    sources.push(info);
                }
                Err(e) => {
                    eprintln!("[警告] AlienVault查询失败 ({}): {}", domain, e);
                }
            }
        }

        if self.config.threatbook_api_key.is_some() {
            self.counters.record_api_call();
            match self.query_threatbook(domain).await {
                Ok(info) => {
                    if info.malicious {
                        total_score = total_score.saturating_add(35);
                    }
                    sources.push(info);
                }
                Err(e) => {
                    eprintln!("[警告] ThreatBook查询失败 ({}): {}", domain, e);
                }
            }
        }

        let is_malicious = sources.iter().any(|s| s.malicious);

        Ok(ThreatIntelResult {
            domain: domain.to_string(),
            is_malicious,
            sources,
            risk_score: total_score.min(100),
            first_seen: Some(Utc::now()),
            last_updated: Utc::now(),
        })
    }

    async fn query_virustotal(&self, domain: &str) -> Result<IntelSourceInfo> {
        query_virustotal_static(&self.client, &self.config, domain).await
    }

    async fn query_alienvault(&self, domain: &str) -> Result<IntelSourceInfo> {
        query_alienvault_static(&self.client, &self.config, domain).await
    }

    async fn query_threatbook(&self, domain: &str) -> Result<IntelSourceInfo> {
        query_threatbook_static(&self.client, &self.config, domain).await
    }
}

async fn query_all_sources_static(
    client: &Client,
    config: &ThreatIntelConfig,
    domain: &str,
) -> Result<ThreatIntelResult> {
    let mut sources = Vec::new();
    let mut total_score = 0u8;

    if config.virustotal_api_key.is_some() {
        if let Ok(info) = query_virustotal_static(client, config, domain).await {
            if info.malicious {
                total_score = total_score.saturating_add(35);
            }
            sources.push(info);
        }
    }

    if config.alienvault_api_key.is_some() {
        if let Ok(info) = query_alienvault_static(client, config, domain).await {
            if info.malicious {
                total_score = total_score.saturating_add(30);
            }
            sources.push(info);
        }
    }

    if config.threatbook_api_key.is_some() {
        if let Ok(info) = query_threatbook_static(client, config, domain).await {
            if info.malicious {
                total_score = total_score.saturating_add(35);
            }
            sources.push(info);
        }
    }

    let is_malicious = sources.iter().any(|s| s.malicious);

    Ok(ThreatIntelResult {
        domain: domain.to_string(),
        is_malicious,
        sources,
        risk_score: total_score.min(100),
        first_seen: Some(Utc::now()),
        last_updated: Utc::now(),
    })
}

async fn query_virustotal_static(
    client: &Client,
    config: &ThreatIntelConfig,
    domain: &str,
) -> Result<IntelSourceInfo> {
    let api_key = config
        .virustotal_api_key
        .as_ref()
        .ok_or_else(|| anyhow!("VirusTotal API key not configured"))?;

    let url = format!("https://www.virustotal.com/api/v3/domains/{}", domain);

    let response = client
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

async fn query_alienvault_static(
    client: &Client,
    config: &ThreatIntelConfig,
    domain: &str,
) -> Result<IntelSourceInfo> {
    let api_key = config
        .alienvault_api_key
        .as_ref()
        .ok_or_else(|| anyhow!("AlienVault API key not configured"))?;

    let url = format!(
        "https://otx.alienvault.com/api/v1/indicators/domain/{}/general",
        domain
    );

    let response = client
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

async fn query_threatbook_static(
    client: &Client,
    config: &ThreatIntelConfig,
    domain: &str,
) -> Result<IntelSourceInfo> {
    let api_key = config
        .threatbook_api_key
        .as_ref()
        .ok_or_else(|| anyhow!("ThreatBook API key not configured"))?;

    let url = "https://api.threatbook.cn/v3/domain/query";

    let response = client
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intel_source_names() {
        assert_eq!(IntelSource::VirusTotal.name(), "virustotal");
        assert_eq!(IntelSource::AlienVault.name(), "alienvault");
        assert_eq!(IntelSource::ThreatBook.name(), "threatbook");
    }

    #[test]
    fn test_intel_source_from_name() {
        assert_eq!(IntelSource::from_name("virustotal"), Some(IntelSource::VirusTotal));
        assert_eq!(IntelSource::from_name("otx"), Some(IntelSource::AlienVault));
        assert_eq!(IntelSource::from_name("unknown"), None);
    }

    #[test]
    fn test_cache_counters() {
        let counters = CacheCounters::new();
        counters.record_hit();
        counters.record_miss();
        counters.record_api_call();

        let stats = counters.stats(5, 100);
        assert_eq!(stats.total_requests, 2);
        assert_eq!(stats.cache_hits, 1);
        assert_eq!(stats.cache_misses, 1);
        assert_eq!(stats.cache_hit_rate, 50.0);
        assert_eq!(stats.api_calls_total, 1);
    }
}
