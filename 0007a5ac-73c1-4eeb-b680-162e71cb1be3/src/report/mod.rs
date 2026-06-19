use std::path::Path;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

use crate::analyzer::tunnel::TunnelDetectionResult;
use crate::analyzer::reputation::ThreatIntelResult;
use crate::storage::sqlite::{DomainStats, DnsDatabase};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityReport {
    pub title: String,
    pub generated_at: DateTime<Utc>,
    pub time_range: String,
    pub summary: ReportSummary,
    pub top_risky_domains: Vec<RiskyDomain>,
    pub detection_stats: DetectionStats,
    pub intel_stats: Option<IntelStats>,
    pub whois_info: Option<Vec<WhoisInfo>>,
    pub trend_data: Vec<TrendDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    pub total_queries: u64,
    pub unique_domains: u64,
    pub unique_clients: u64,
    pub high_risk_domains: u64,
    pub medium_risk_domains: u64,
    pub low_risk_domains: u64,
    pub malicious_domains: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskyDomain {
    pub domain: String,
    pub risk_score: u8,
    pub risk_level: String,
    pub query_count: u64,
    pub detection_reasons: Vec<String>,
    pub threat_intel: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionStats {
    pub txt_entropy_alerts: u64,
    pub frequency_alerts: u64,
    pub subdomain_alerts: u64,
    pub total_alerts: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelStats {
    pub total_checked: u64,
    pub malicious_count: u64,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhoisInfo {
    pub domain: String,
    pub registrar: Option<String>,
    pub registrant: Option<String>,
    pub creation_date: Option<String>,
    pub age_days: Option<i64>,
    pub is_new: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendDataPoint {
    pub date: String,
    pub total_queries: u64,
    pub alerts: u64,
}

pub enum ReportFormat {
    Markdown,
    Html,
    Json,
}

pub struct ReportGenerator;

impl ReportGenerator {
    pub fn new() -> Self {
        ReportGenerator
    }

    pub fn generate(
        &self,
        db: &DnsDatabase,
        tunnel_results: &[TunnelDetectionResult],
        intel_results: Option<&[ThreatIntelResult]>,
        time_range: &str,
        top_n: usize,
        with_whois: bool,
    ) -> Result<SecurityReport> {
        let total_count = db.get_total_count().unwrap_or(0) as u64;
        let domain_stats = db.get_domain_stats(None, None, 100).unwrap_or_default();

        let (high, medium, low) = Self::count_by_risk_level(tunnel_results);

        let high_risk: Vec<RiskyDomain> = tunnel_results
            .iter()
            .filter(|r| r.risk_score >= 70)
            .take(top_n)
            .map(|r| RiskyDomain {
                domain: r.domain.clone(),
                risk_score: r.risk_score,
                risk_level: r.risk_level.to_string().to_string(),
                query_count: r.query_count,
                detection_reasons: r.detection_reasons.clone(),
                threat_intel: None,
            })
            .collect();

        let detection_stats = Self::calculate_detection_stats(tunnel_results);

        let intel_stats = intel_results.map(|results| IntelStats {
            total_checked: results.len() as u64,
            malicious_count: results.iter().filter(|r| r.is_malicious).count() as u64,
            sources: Vec::new(),
        });

        let whois_info = if with_whois {
            Some(Self::get_top_whois(db, &high_risk))
        } else {
            None
        };

        let trend_data = Self::generate_trend_data(db);

        Ok(SecurityReport {
            title: "DNS安全监测报告".to_string(),
            generated_at: Utc::now(),
            time_range: time_range.to_string(),
            summary: ReportSummary {
                total_queries: total_count,
                unique_domains: domain_stats.len() as u64,
                unique_clients: 0,
                high_risk_domains: high,
                medium_risk_domains: medium,
                low_risk_domains: low,
                malicious_domains: intel_stats.as_ref().map(|s| s.malicious_count).unwrap_or(0),
            },
            top_risky_domains: high_risk,
            detection_stats,
            intel_stats,
            whois_info,
            trend_data,
        })
    }

    fn count_by_risk_level(results: &[TunnelDetectionResult]) -> (u64, u64, u64) {
        let mut high = 0u64;
        let mut medium = 0u64;
        let mut low = 0u64;

        for r in results {
            match r.risk_level {
                crate::analyzer::tunnel::RiskLevel::High => high += 1,
                crate::analyzer::tunnel::RiskLevel::Medium => medium += 1,
                crate::analyzer::tunnel::RiskLevel::Low => low += 1,
                _ => {}
            }
        }

        (high, medium, low)
    }

    fn calculate_detection_stats(results: &[TunnelDetectionResult]) -> DetectionStats {
        let mut txt_alerts = 0u64;
        let mut freq_alerts = 0u64;
        let mut subdomain_alerts = 0u64;

        for r in results {
            if r.txt_entropy.is_some() {
                txt_alerts += 1;
            }
            if r.query_frequency.is_some() {
                freq_alerts += 1;
            }
            if r.subdomain_avg_length.is_some() {
                subdomain_alerts += 1;
            }
        }

        let total = txt_alerts + freq_alerts + subdomain_alerts;

        DetectionStats {
            txt_entropy_alerts: txt_alerts,
            frequency_alerts: freq_alerts,
            subdomain_alerts: subdomain_alerts,
            total_alerts: total,
        }
    }

    fn get_top_whois(_db: &DnsDatabase, domains: &[RiskyDomain]) -> Vec<WhoisInfo> {
        domains
            .iter()
            .map(|d| WhoisInfo {
                domain: d.domain.clone(),
                registrar: None,
                registrant: None,
                creation_date: None,
                age_days: None,
                is_new: false,
            })
            .collect()
    }

    fn generate_trend_data(_db: &DnsDatabase) -> Vec<TrendDataPoint> {
        let mut data = Vec::new();
        let now = Utc::now();

        for i in (0..7).rev() {
            let date = now - chrono::Duration::days(i);
            data.push(TrendDataPoint {
                date: date.format("%Y-%m-%d").to_string(),
                total_queries: 0,
                alerts: 0,
            });
        }

        data
    }

    pub fn render_markdown(&self, report: &SecurityReport) -> String {
        let mut md = String::new();

        md.push_str(&format!("# {}\n\n", report.title));
        md.push_str(&format!("生成时间: {}\n\n", report.generated_at.format("%Y-%m-%d %H:%M:%S")));
        md.push_str(&format!("时间范围: {}\n\n", report.time_range));

        md.push_str("## 概览\n\n");
        md.push_str("| 指标 | 数值 |\n");
        md.push_str("|------|------|\n");
        md.push_str(&format!("| 总查询次数 | {} |\n", report.summary.total_queries));
        md.push_str(&format!("| 唯一域名数 | {} |\n", report.summary.unique_domains));
        md.push_str(&format!("| 高风险域名 | {} |\n", report.summary.high_risk_domains));
        md.push_str(&format!("| 中风险域名 | {} |\n", report.summary.medium_risk_domains));
        md.push_str(&format!("| 低风险域名 | {} |\n", report.summary.low_risk_domains));
        if let Some(ref intel) = report.intel_stats {
            md.push_str(&format!("| 恶意域名数 | {} |\n", intel.malicious_count));
        }
        md.push('\n');

        md.push_str("## 检测统计\n\n");
        md.push_str("| 检测类型 | 告警数 |\n");
        md.push_str("|----------|--------|\n");
        md.push_str(&format!("| TXT记录熵值异常 | {} |\n", report.detection_stats.txt_entropy_alerts));
        md.push_str(&format!("| 查询频率异常 | {} |\n", report.detection_stats.frequency_alerts));
        md.push_str(&format!("| 子域名异常 | {} |\n", report.detection_stats.subdomain_alerts));
        md.push_str(&format!("| **总计** | **{}** |\n", report.detection_stats.total_alerts));
        md.push('\n');

        md.push_str("## 高风险域名TOP榜\n\n");
        if report.top_risky_domains.is_empty() {
            md.push_str("暂无高风险域名\n\n");
        } else {
            md.push_str("| 排名 | 域名 | 风险评分 | 查询次数 | 风险原因 |\n");
            md.push_str("|------|------|----------|----------|----------|\n");
            for (i, d) in report.top_risky_domains.iter().enumerate() {
                let reasons = d.detection_reasons.join("; ");
                md.push_str(&format!(
                    "| {} | {} | {} | {} | {} |\n",
                    i + 1,
                    d.domain,
                    d.risk_score,
                    d.query_count,
                    reasons
                ));
            }
            md.push('\n');
        }

        if let Some(ref whois_list) = report.whois_info {
            md.push_str("## 域名溯源信息\n\n");
            md.push_str("| 域名 | 注册商 | 注册人 | 创建时间 | 域名年龄 | 新域名 |\n");
            md.push_str("|------|--------|--------|----------|----------|--------|\n");
            for w in whois_list {
                let age_str = w.age_days.map(|a| format!("{}天", a)).unwrap_or_else(|| "-".to_string());
                let is_new_str = if w.is_new { "是⚠️" } else { "否" };
                md.push_str(&format!(
                    "| {} | {} | {} | {} | {} | {} |\n",
                    w.domain,
                    w.registrar.as_deref().unwrap_or("-"),
                    w.registrant.as_deref().unwrap_or("-"),
                    w.creation_date.as_deref().unwrap_or("-"),
                    age_str,
                    is_new_str
                ));
            }
            md.push('\n');
        }

        md.push_str("## 趋势数据\n\n");
        md.push_str("| 日期 | 查询次数 | 告警数 |\n");
        md.push_str("|------|----------|--------|\n");
        for point in &report.trend_data {
            md.push_str(&format!(
                "| {} | {} | {} |\n",
                point.date, point.total_queries, point.alerts
            ));
        }
        md.push('\n');

        md
    }

    pub fn render_html(&self, report: &SecurityReport) -> String {
        let md = self.render_markdown(report);
        format!(
            r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }}
        h1, h2, h3 {{
            color: #2c3e50;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #3498db;
            color: white;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .high-risk {{ color: #e74c3c; font-weight: bold; }}
        .medium-risk {{ color: #f39c12; font-weight: bold; }}
        .low-risk {{ color: #f1c40f; }}
        .summary-box {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <p>生成时间: {generated_at}</p>
    <p>时间范围: {time_range}</p>
    {content}
</body>
</html>"#,
            title = report.title,
            generated_at = report.generated_at.format("%Y-%m-%d %H:%M:%S"),
            time_range = report.time_range,
            content = Self::markdown_to_html_simple(&md),
        )
    }

    fn markdown_to_html_simple(md: &str) -> String {
        let mut html = String::new();
        let mut in_table = false;
        let mut in_table_header = false;

        for line in md.lines() {
            let line = line.trim_end();

            if line.starts_with("## ") {
                html.push_str(&format!("<h2>{}</h2>\n", &line[3..]));
            } else if line.starts_with("# ") {
                html.push_str(&format!("<h1>{}</h1>\n", &line[2..]));
            } else if line.starts_with("|") {
                if !in_table {
                    html.push_str("<table>\n");
                    in_table = true;
                    in_table_header = true;
                }
                let cells: Vec<&str> = line.split('|').skip(1).filter(|c| !c.is_empty()).collect();
                if in_table_header && cells.iter().all(|c| c.trim().starts_with('-')) {
                    in_table_header = false;
                    continue;
                }
                let tag = if in_table_header { "th" } else { "td" };
                html.push_str("<tr>\n");
                for cell in cells {
                    html.push_str(&format!("<{}>{}</{}>\n", tag, cell.trim(), tag));
                }
                html.push_str("</tr>\n");
                if in_table_header {
                    in_table_header = false;
                }
            } else if line.is_empty() {
                if in_table {
                    html.push_str("</table>\n");
                    in_table = false;
                }
                html.push_str("<br/>\n");
            } else {
                html.push_str(&format!("<p>{}</p>\n", line));
            }
        }

        if in_table {
            html.push_str("</table>\n");
        }

        html
    }

    pub fn render_json(&self, report: &SecurityReport) -> Result<String> {
        serde_json::to_string_pretty(report)
            .map_err(|e| anyhow::anyhow!("JSON序列化失败: {}", e))
    }

    pub fn save_report(
        &self,
        report: &SecurityReport,
        format: ReportFormat,
        output_path: &Path,
    ) -> Result<()> {
        let content = match format {
            ReportFormat::Markdown => self.render_markdown(report),
            ReportFormat::Html => self.render_html(report),
            ReportFormat::Json => self.render_json(report)?,
        };

        if let Some(parent) = output_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("无法创建输出目录: {}", parent.display()))?;
        }

        std::fs::write(output_path, content)
            .with_context(|| format!("无法写入报告文件: {}", output_path.display()))?;

        Ok(())
    }
}

impl Default for ReportGenerator {
    fn default() -> Self {
        Self::new()
    }
}
