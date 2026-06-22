use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PortError {
    #[error("无效的费用类别: {0}")]
    InvalidFeeCategory(String),
    #[error("阶梯区间错误: from({0}) 必须小于等于 to({1})")]
    InvalidTierRange(f64, f64),
    #[error("费率必须为非负数")]
    InvalidRate,
    #[error("港口代码不能为空")]
    EmptyPortCode,
    #[error("未找到生效的费率规则: 港口={0}, 类别={1}")]
    RateNotFound(String, String),
    #[error("费率匹配失败: 港口={port_code}, 类别={category}, 净吨位={net_tonnage}\n可用费率列表:\n{available}")]
    RateMatchFailed {
        port_code: String,
        category: String,
        net_tonnage: f64,
        available: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FeeCategory {
    Pilot,
    Tug,
    Berth,
    Port,
    Tally,
    Agent,
    Pilotage,
    Mooring,
    Anchorage,
    Quarantine,
    Customs,
    Other,
}

impl FeeCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            FeeCategory::Pilot => "pilot",
            FeeCategory::Tug => "tug",
            FeeCategory::Berth => "berth",
            FeeCategory::Port => "port",
            FeeCategory::Tally => "tally",
            FeeCategory::Agent => "agent",
            FeeCategory::Pilotage => "pilotage",
            FeeCategory::Mooring => "mooring",
            FeeCategory::Anchorage => "anchorage",
            FeeCategory::Quarantine => "quarantine",
            FeeCategory::Customs => "customs",
            FeeCategory::Other => "other",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            FeeCategory::Pilot => "引航费",
            FeeCategory::Tug => "拖轮费",
            FeeCategory::Berth => "停泊费",
            FeeCategory::Port => "港务费",
            FeeCategory::Tally => "理货费",
            FeeCategory::Agent => "代理费",
            FeeCategory::Pilotage => "领航费",
            FeeCategory::Mooring => "系解缆费",
            FeeCategory::Anchorage => "锚泊费",
            FeeCategory::Quarantine => "检疫费",
            FeeCategory::Customs => "报关费",
            FeeCategory::Other => "其他费用",
        }
    }

    pub fn all() -> Vec<FeeCategory> {
        vec![
            FeeCategory::Pilot,
            FeeCategory::Tug,
            FeeCategory::Berth,
            FeeCategory::Port,
            FeeCategory::Tally,
            FeeCategory::Agent,
            FeeCategory::Pilotage,
            FeeCategory::Mooring,
            FeeCategory::Anchorage,
            FeeCategory::Quarantine,
            FeeCategory::Customs,
            FeeCategory::Other,
        ]
    }

    pub fn count() -> usize {
        12
    }
}

impl std::str::FromStr for FeeCategory {
    type Err = PortError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pilot" | "引航费" => Ok(FeeCategory::Pilot),
            "tug" | "拖轮费" => Ok(FeeCategory::Tug),
            "berth" | "停泊费" => Ok(FeeCategory::Berth),
            "port" | "港务费" => Ok(FeeCategory::Port),
            "tally" | "理货费" => Ok(FeeCategory::Tally),
            "agent" | "代理费" => Ok(FeeCategory::Agent),
            "pilotage" | "领航费" => Ok(FeeCategory::Pilotage),
            "mooring" | "系解缆费" => Ok(FeeCategory::Mooring),
            "anchorage" | "锚泊费" => Ok(FeeCategory::Anchorage),
            "quarantine" | "检疫费" => Ok(FeeCategory::Quarantine),
            "customs" | "报关费" => Ok(FeeCategory::Customs),
            "other" | "其他费用" => Ok(FeeCategory::Other),
            other => Err(PortError::InvalidFeeCategory(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TierRate {
    pub tier_from: f64,
    pub tier_to: f64,
    pub unit_rate: f64,
    pub base_fee: f64,
}

impl TierRate {
    pub fn new(tier_from: f64, tier_to: f64, unit_rate: f64, base_fee: f64) -> Result<Self, PortError> {
        if tier_from < 0.0 || tier_to < 0.0 {
            return Err(PortError::InvalidTierRange(tier_from, tier_to));
        }
        if tier_to != 0.0 && tier_from > tier_to {
            return Err(PortError::InvalidTierRange(tier_from, tier_to));
        }
        if unit_rate < 0.0 || base_fee < 0.0 {
            return Err(PortError::InvalidRate);
        }

        Ok(TierRate {
            tier_from,
            tier_to,
            unit_rate,
            base_fee,
        })
    }

    pub fn contains(&self, value: f64) -> bool {
        if self.tier_to == 0.0 {
            value >= self.tier_from
        } else {
            value >= self.tier_from && value <= self.tier_to
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateRule {
    pub id: Option<i64>,
    pub port_code: String,
    pub fee_category: FeeCategory,
    pub tier: TierRate,
    pub effective_date: DateTime<Utc>,
    pub expiry_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
}

impl RateRule {
    pub fn new(
        port_code: String,
        fee_category: FeeCategory,
        tier: TierRate,
        effective_date: DateTime<Utc>,
    ) -> Result<Self, PortError> {
        if port_code.trim().is_empty() {
            return Err(PortError::EmptyPortCode);
        }

        Ok(RateRule {
            id: None,
            port_code: port_code.trim().to_uppercase(),
            fee_category,
            tier,
            effective_date,
            expiry_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_active: true,
        })
    }

    pub fn is_effective_on(&self, date: DateTime<Utc>) -> bool {
        if !self.is_active {
            return false;
        }
        if date < self.effective_date {
            return false;
        }
        if let Some(expiry) = self.expiry_date {
            if date > expiry {
                return false;
            }
        }
        true
    }

    pub fn calculate(&self, quantity: f64) -> f64 {
        self.tier.base_fee + self.tier.unit_rate * quantity
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub code: String,
    pub name: String,
    pub province: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortRateConfig {
    pub port_code: String,
    pub rate_rules: HashMap<FeeCategory, Vec<RateRule>>,
}

impl PortRateConfig {
    pub fn new(port_code: String) -> Self {
        let mut rate_rules = HashMap::new();
        for category in FeeCategory::all() {
            rate_rules.insert(category, Vec::new());
        }
        PortRateConfig {
            port_code,
            rate_rules,
        }
    }

    pub fn find_rate(
        &self,
        category: FeeCategory,
        net_tonnage: f64,
        date: DateTime<Utc>,
    ) -> Result<&RateRule, PortError> {
        let rules = self
            .rate_rules
            .get(&category)
            .ok_or_else(|| PortError::RateNotFound(self.port_code.clone(), category.as_str().to_string()))?;

        let active_rules: Vec<&RateRule> = rules.iter().filter(|r| r.is_effective_on(date)).collect();

        if active_rules.is_empty() {
            let all_rules = self
                .rate_rules
                .get(&category)
                .cloned()
                .unwrap_or_default();
            let mut fallback = String::from("  (无任何已定义费率)");
            if !all_rules.is_empty() {
                fallback = String::from("  (存在已停用或未生效费率:\n");
                for r in &all_rules {
                    let status = if r.is_active {
                        if date < r.effective_date {
                            format!("未生效({}起)", formatter_date(&r.effective_date))
                        } else {
                            r.expiry_date
                                .map(|d| format!("已过期({}止)", formatter_date(&d)))
                                .unwrap_or_else(|| "状态异常".to_string())
                        }
                    } else {
                        "已停用".to_string()
                    };
                    let tier_to = if r.tier.tier_to == 0.0 { "∞".to_string() } else { r.tier.tier_to.to_string() };
                    fallback.push_str(&format!("    阶梯{}-{} 费率{} 状态: {}\n",
                        r.tier.tier_from, tier_to, r.tier.unit_rate, status));
                }
                fallback.push_str("  )");
            }
            return Err(PortError::RateMatchFailed {
                port_code: self.port_code.clone(),
                category: category.as_str().to_string(),
                net_tonnage,
                available: fallback,
            });
        }

        for rule in &active_rules {
            if rule.tier.contains(net_tonnage) {
                return Ok(rule);
            }
        }

        let mut available = String::new();
        for (i, r) in active_rules.iter().enumerate() {
            let tier_to = if r.tier.tier_to == 0.0 { "∞".to_string() } else { r.tier.tier_to.to_string() };
            available.push_str(&format!(
                "  [{}] 净吨位区间 {}-{} : 基础费 {} + 费率 {} /单位{}",
                i + 1,
                r.tier.tier_from,
                tier_to,
                r.tier.base_fee,
                r.tier.unit_rate,
                if let Some(id) = r.id { format!(" (规则ID#{})", id) } else { String::new() }
            ));
            if i < active_rules.len() - 1 {
                available.push('\n');
            }
        }

        Err(PortError::RateMatchFailed {
            port_code: self.port_code.clone(),
            category: category.display_name().to_string(),
            net_tonnage,
            available,
        })
    }

    pub fn add_rule(&mut self, rule: RateRule) {
        self.rate_rules
            .entry(rule.fee_category)
            .or_insert_with(Vec::new)
            .push(rule);
    }
}

fn formatter_date(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d").to_string()
}

pub fn parse_effective_date(s: &str) -> Result<DateTime<Utc>, PortError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc())
        .map_err(|_| PortError::InvalidTierRange(0.0, 0.0))
}

pub fn default_rate_rules(port_code: &str) -> Vec<RateRule> {
    let effective_date = NaiveDate::from_ymd_opt(2024, 1, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();
    let mut rules = Vec::new();

    let tiers = vec![
        (0.0, 5000.0, 0.8),
        (5001.0, 10000.0, 0.7),
        (10001.0, 30000.0, 0.6),
        (30001.0, 50000.0, 0.5),
        (50001.0, 0.0, 0.4),
    ];

    for category in FeeCategory::all() {
        for (from, to, rate) in &tiers {
            let base = match category {
                FeeCategory::Pilot => 500.0,
                FeeCategory::Tug => 800.0,
                FeeCategory::Berth => 0.0,
                FeeCategory::Port => 0.0,
                FeeCategory::Tally => 100.0,
                FeeCategory::Agent => 200.0,
                _ => 50.0,
            };

            if let Ok(tier) = TierRate::new(*from, *to, *rate, base) {
                if let Ok(rule) = RateRule::new(
                    port_code.to_string(),
                    category,
                    tier,
                    effective_date,
                ) {
                    rules.push(rule);
                }
            }
        }
    }

    rules
}
