use std::net::IpAddr;
use std::time::Duration;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use trust_dns_resolver::Resolver;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::proto::rr::RecordType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsLookupResult {
    pub domain: String,
    pub records: Vec<DnsRecord>,
    pub query_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecord {
    pub record_type: String,
    pub value: String,
    pub ttl: u32,
    pub priority: Option<u16>,
}

pub struct DnsLookup {
    resolver: Resolver,
    timeout: Duration,
}

impl DnsLookup {
    pub fn new() -> Result<Self> {
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_secs(5);
        opts.attempts = 2;
        opts.cache_size = 1000;

        let resolver = Resolver::new(ResolverConfig::default(), opts)
            .map_err(|e| anyhow!("DNS解析器初始化失败: {}", e))?;

        Ok(DnsLookup {
            resolver,
            timeout: Duration::from_secs(10),
        })
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn lookup(&self, domain: &str, record_type: &str) -> Result<DnsLookupResult> {
        let start = std::time::Instant::now();
        let rt = Self::parse_record_type(record_type)?;

        let mut records = Vec::new();

        match rt {
            RecordType::A => {
                if let Ok(lookup) = self.resolver.ipv4_lookup(domain) {
                    for ip in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "A".to_string(),
                            value: ip.to_string(),
                            ttl: lookup.valid_until().duration_since(std::time::SystemTime::now())
                                .map(|d| d.as_secs() as u32)
                                .unwrap_or(0),
                            priority: None,
                        });
                    }
                }
            }
            RecordType::AAAA => {
                if let Ok(lookup) = self.resolver.ipv6_lookup(domain) {
                    for ip in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "AAAA".to_string(),
                            value: ip.to_string(),
                            ttl: lookup.valid_until().duration_since(std::time::SystemTime::now())
                                .map(|d| d.as_secs() as u32)
                                .unwrap_or(0),
                            priority: None,
                        });
                    }
                }
            }
            RecordType::CNAME => {
                if let Ok(lookup) = self.resolver.cname_lookup(domain) {
                    for cname in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "CNAME".to_string(),
                            value: cname.to_string(),
                            ttl: 0,
                            priority: None,
                        });
                    }
                }
            }
            RecordType::MX => {
                if let Ok(lookup) = self.resolver.mx_lookup(domain) {
                    for mx in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "MX".to_string(),
                            value: mx.exchange().to_string(),
                            ttl: 0,
                            priority: Some(mx.preference()),
                        });
                    }
                }
            }
            RecordType::TXT => {
                if let Ok(lookup) = self.resolver.txt_lookup(domain) {
                    for txt in lookup.iter() {
                        let value: String = txt.iter()
                            .map(|bytes| String::from_utf8_lossy(bytes).to_string())
                            .collect();
                        records.push(DnsRecord {
                            record_type: "TXT".to_string(),
                            value,
                            ttl: 0,
                            priority: None,
                        });
                    }
                }
            }
            RecordType::NS => {
                if let Ok(lookup) = self.resolver.ns_lookup(domain) {
                    for ns in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "NS".to_string(),
                            value: ns.to_string(),
                            ttl: 0,
                            priority: None,
                        });
                    }
                }
            }
            RecordType::SOA => {
                if let Ok(lookup) = self.resolver.soa_lookup(domain) {
                    for soa in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "SOA".to_string(),
                            value: format!(
                                "mname={} rname={} serial={} refresh={} retry={} expire={} minimum={}",
                                soa.mname(),
                                soa.rname(),
                                soa.serial(),
                                soa.refresh(),
                                soa.retry(),
                                soa.expire(),
                                soa.minimum(),
                            ),
                            ttl: 0,
                            priority: None,
                        });
                    }
                }
            }
            RecordType::SRV => {
                if let Ok(lookup) = self.resolver.srv_lookup(domain) {
                    for srv in lookup.iter() {
                        records.push(DnsRecord {
                            record_type: "SRV".to_string(),
                            value: format!("{}:{}", srv.target(), srv.port()),
                            ttl: 0,
                            priority: Some(srv.priority()),
                        });
                    }
                }
            }
            _ => {
                return Err(anyhow!("不支持的记录类型: {}", record_type));
            }
        }

        let query_time_ms = start.elapsed().as_millis() as u64;

        Ok(DnsLookupResult {
            domain: domain.to_string(),
            records,
            query_time_ms,
        })
    }

    pub fn lookup_all(&self, domain: &str) -> Result<DnsLookupResult> {
        let start = std::time::Instant::now();
        let mut all_records = Vec::new();

        let types = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA"];

        for rt in &types {
            if let Ok(result) = self.lookup(domain, rt) {
                all_records.extend(result.records);
            }
        }

        Ok(DnsLookupResult {
            domain: domain.to_string(),
            records: all_records,
            query_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    pub fn reverse_lookup(&self, ip: IpAddr) -> Result<Vec<String>> {
        match self.resolver.reverse_lookup(ip) {
            Ok(lookup) => {
                let names: Vec<String> = lookup.iter()
                    .map(|name| name.to_string())
                    .collect();
                Ok(names)
            }
            Err(e) => Err(anyhow!("反向解析失败: {}", e)),
        }
    }

    fn parse_record_type(s: &str) -> Result<RecordType> {
        match s.to_uppercase().as_str() {
            "A" => Ok(RecordType::A),
            "AAAA" => Ok(RecordType::AAAA),
            "CNAME" => Ok(RecordType::CNAME),
            "MX" => Ok(RecordType::MX),
            "TXT" => Ok(RecordType::TXT),
            "NS" => Ok(RecordType::NS),
            "SOA" => Ok(RecordType::SOA),
            "SRV" => Ok(RecordType::SRV),
            _ => Err(anyhow!("未知的记录类型: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_record_type() {
        assert_eq!(DnsLookup::parse_record_type("A").unwrap(), RecordType::A);
        assert_eq!(DnsLookup::parse_record_type("aaaa").unwrap(), RecordType::AAAA);
        assert!(DnsLookup::parse_record_type("INVALID").is_err());
    }
}
