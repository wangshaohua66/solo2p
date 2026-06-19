use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::parser::DnsLogEntry;
use crate::config::DetectionConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelDetectionResult {
    pub domain: String,
    pub risk_score: u8,
    pub risk_level: RiskLevel,
    pub txt_entropy: Option<f64>,
    pub query_frequency: Option<u64>,
    pub subdomain_avg_length: Option<f64>,
    pub subdomain_entropy: Option<f64>,
    pub detection_reasons: Vec<String>,
    pub query_count: u64,
    pub first_seen: chrono::DateTime<chrono::Utc>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    High,
    Medium,
    Low,
    None,
}

impl RiskLevel {
    pub fn to_string(&self) -> &str {
        match self {
            RiskLevel::High => "高",
            RiskLevel::Medium => "中",
            RiskLevel::Low => "低",
            RiskLevel::None => "无",
        }
    }
}

pub struct TunnelDetector {
    config: DetectionConfig,
}

impl TunnelDetector {
    pub fn new(config: DetectionConfig) -> Self {
        TunnelDetector { config }
    }

    pub fn analyze_entries(&self, entries: &[DnsLogEntry]) -> Vec<TunnelDetectionResult> {
        let mut domain_data: HashMap<String, DomainAnalysisData> = HashMap::new();

        for entry in entries {
            let data = domain_data
                .entry(entry.query_domain.clone())
                .or_insert_with(|| DomainAnalysisData {
                    query_count: 0,
                    first_seen: entry.timestamp,
                    last_seen: entry.timestamp,
                    txt_records: Vec::new(),
                    subdomains: Vec::new(),
                    query_times: Vec::new(),
                });

            data.query_count += 1;
            if entry.timestamp < data.first_seen {
                data.first_seen = entry.timestamp;
            }
            if entry.timestamp > data.last_seen {
                data.last_seen = entry.timestamp;
            }
            data.query_times.push(entry.timestamp);

            if entry.query_type.eq_ignore_ascii_case("TXT") {
                if let Some(ref ip) = entry.response_ip {
                    data.txt_records.push(ip.clone());
                }
            }

            if let Some(subdomain) = Self::extract_subdomain(&entry.query_domain) {
                data.subdomains.push(subdomain);
            }
        }

        domain_data
            .into_iter()
            .map(|(domain, data)| self.calculate_risk(domain, data))
            .collect()
    }

    fn calculate_risk(&self, domain: String, data: DomainAnalysisData) -> TunnelDetectionResult {
        let mut score = 0u8;
        let mut reasons = Vec::new();

        let txt_entropy = if !data.txt_records.is_empty() {
            let avg_len: f64 = data.txt_records.iter().map(|r| r.len() as f64).sum::<f64>()
                / data.txt_records.len() as f64;
            let entropy = calculate_entropy(&data.txt_records.join(""));
            if entropy > self.config.txt_entropy_threshold {
                let contribution = ((entropy - self.config.txt_entropy_threshold) * 10.0)
                    .min(25.0) as u8;
                score = score.saturating_add(contribution);
                reasons.push(format!(
                    "TXT记录熵值过高 ({:.2} > {:.1})",
                    entropy, self.config.txt_entropy_threshold
                ));
            }
            Some(entropy)
        } else {
            None
        };

        let query_freq = if data.query_count >= 10 {
            let time_span = (data.last_seen - data.first_seen).num_minutes().max(1) as u64;
            let freq = data.query_count / time_span.max(1);
            if freq > self.config.query_frequency_threshold {
                let ratio = freq as f64 / self.config.query_frequency_threshold as f64;
                let contribution = (ratio.log2() * 15.0).min(35.0) as u8;
                score = score.saturating_add(contribution);
                reasons.push(format!(
                    "查询频率异常 ({}次/分钟 > {})",
                    freq, self.config.query_frequency_threshold
                ));
            }
            Some(freq)
        } else {
            None
        };

        let (subdomain_avg_len, subdomain_entropy) = if !data.subdomains.is_empty() {
            let avg_len: f64 = data.subdomains.iter().map(|s| s.len() as f64).sum::<f64>()
                / data.subdomains.len() as f64;
            let all_subs: String = data.subdomains.join("");
            let entropy = calculate_entropy(&all_subs);

            if avg_len > self.config.subdomain_length_threshold as f64
                && entropy > self.config.subdomain_entropy_threshold
            {
                let len_factor = (avg_len / self.config.subdomain_length_threshold as f64).min(3.0);
                let entropy_factor = (entropy / self.config.subdomain_entropy_threshold).min(2.0);
                let contribution = ((len_factor + entropy_factor) * 10.0).min(30.0) as u8;
                score = score.saturating_add(contribution);
                reasons.push(format!(
                    "子域名异常 (平均长度{:.0} > {}, 熵值{:.2} > {:.1})",
                    avg_len, self.config.subdomain_length_threshold,
                    entropy, self.config.subdomain_entropy_threshold
                ));
            }

            (Some(avg_len), Some(entropy))
        } else {
            (None, None)
        };

        let risk_level = if score >= self.config.high_risk_score {
            RiskLevel::High
        } else if score >= self.config.medium_risk_score {
            RiskLevel::Medium
        } else if score > 0 {
            RiskLevel::Low
        } else {
            RiskLevel::None
        };

        TunnelDetectionResult {
            domain,
            risk_score: score.min(100),
            risk_level,
            txt_entropy,
            query_frequency: query_freq,
            subdomain_avg_length: subdomain_avg_len,
            subdomain_entropy,
            detection_reasons: reasons,
            query_count: data.query_count,
            first_seen: data.first_seen,
            last_seen: data.last_seen,
        }
    }

    fn extract_subdomain(domain: &str) -> Option<String> {
        let parts: Vec<&str> = domain.split('.').collect();
        if parts.len() > 2 {
            let subdomain_parts: Vec<&str> = parts[..parts.len() - 2].to_vec();
            Some(subdomain_parts.join("."))
        } else {
            None
        }
    }
}

struct DomainAnalysisData {
    query_count: u64,
    first_seen: chrono::DateTime<chrono::Utc>,
    last_seen: chrono::DateTime<chrono::Utc>,
    txt_records: Vec<String>,
    subdomains: Vec<String>,
    query_times: Vec<chrono::DateTime<chrono::Utc>>,
}

pub fn calculate_entropy(s: &str) -> f64 {
    if s.is_empty() {
        return 0.0;
    }

    let mut freq = HashMap::new();
    for c in s.chars() {
        *freq.entry(c).or_insert(0u32) += 1;
    }

    let len = s.len() as f64;
    let mut entropy = 0.0;

    for count in freq.values() {
        let p = *count as f64 / len;
        if p > 0.0 {
            entropy -= p * p.log2();
        }
    }

    entropy
}

pub fn filter_by_min_score(results: Vec<TunnelDetectionResult>, min_score: u8) -> Vec<TunnelDetectionResult> {
    results
        .into_iter()
        .filter(|r| r.risk_score >= min_score)
        .collect()
}

pub fn sort_by_score_desc(mut results: Vec<TunnelDetectionResult>) -> Vec<TunnelDetectionResult> {
    results.sort_by(|a, b| b.risk_score.cmp(&a.risk_score));
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_calculate_entropy() {
        assert_eq!(calculate_entropy(""), 0.0);
        assert_eq!(calculate_entropy("aaaa"), 0.0);
        assert!(calculate_entropy("abcd") > 0.0);
        assert!(calculate_entropy("a1b2c3d4") > calculate_entropy("aaaa"));
    }

    #[test]
    fn test_risk_level_ordering() {
        let config = DetectionConfig::default();
        let detector = TunnelDetector::new(config);

        let mut entries = Vec::new();
        let base_time = Utc::now();

        for i in 0..200 {
            let subdomain = format!(
                "a{}b{}c{}d{}e{}f{}g{}",
                i, i * 2, i * 3, i * 4, i * 5, i * 6, i * 7
            );
            entries.push(DnsLogEntry {
                timestamp: base_time + chrono::Duration::seconds(i as i64),
                client_ip: "192.168.1.1".to_string(),
                client_port: Some(5321),
                query_domain: format!("{}.tunnel.example.com", subdomain),
                query_type: "TXT".to_string(),
                query_class: "IN".to_string(),
                response_code: Some("NOERROR".to_string()),
                response_ip: Some("aGVsbG8td29ybGQtdGVzdC1kYXRh".repeat(5)),
                server_ip: None,
                is_response: true,
                raw_line: String::new(),
            });
        }

        let results = detector.analyze_entries(&entries);
        assert!(!results.is_empty());
    }
}
