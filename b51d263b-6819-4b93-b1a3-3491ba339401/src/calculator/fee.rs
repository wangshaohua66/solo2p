use chrono::{DateTime, Utc};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

use crate::models::port::{FeeCategory, PortRateConfig, PortError};
use crate::models::ship::Ship;

#[derive(Debug, Error)]
pub enum CalculatorError {
    #[error("费率配置错误: {0}")]
    RateConfigError(#[from] PortError),
    #[error("缺少港口 {0} 的费率配置")]
    MissingPortConfig(String),
    #[error("计算异常: {0}")]
    CalculationError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeDetail {
    pub category: FeeCategory,
    pub category_name: String,
    pub rule_id: Option<i64>,
    pub base_fee: f64,
    pub unit_rate: f64,
    pub quantity: f64,
    pub unit_label: String,
    pub amount: f64,
    pub remarks: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeResult {
    pub id: Option<i64>,
    pub ship_id: Option<i64>,
    pub imo: String,
    pub vessel_name: String,
    pub vessel_type: String,
    pub port_code: String,
    pub arrival_time: DateTime<Utc>,
    pub departure_time: DateTime<Utc>,
    pub compute_time: DateTime<Utc>,
    pub details: Vec<FeeDetail>,
    pub total_amount: f64,
    pub tax_amount: f64,
    pub grand_total: f64,
    pub has_dispute: bool,
    pub is_settled: bool,
    pub settled_amount: f64,
}

pub struct FeeCalculator<'a> {
    port_configs: &'a HashMap<String, PortRateConfig>,
}

impl<'a> FeeCalculator<'a> {
    pub fn new(port_configs: &'a HashMap<String, PortRateConfig>) -> Self {
        FeeCalculator { port_configs }
    }

    pub fn calculate(&self, ship: &Ship) -> Result<FeeResult, CalculatorError> {
        let config = self
            .port_configs
            .get(&ship.port_code)
            .ok_or_else(|| CalculatorError::MissingPortConfig(ship.port_code.clone()))?;

        let berthing_hours = ship.berthing_hours();
        let berthing_days = ship.berthing_days();
        let nt = ship.net_tonnage;
        let date = ship.arrival_time;

        let mut details = Vec::with_capacity(FeeCategory::count());

        let compute = |category: FeeCategory, quantity: f64, unit_label: &str| -> Result<FeeDetail, CalculatorError> {
            let rule = config.find_rate(category, nt, date)?;
            let amount = rule.calculate(quantity);
            Ok(FeeDetail {
                category,
                category_name: category.display_name().to_string(),
                rule_id: rule.id,
                base_fee: rule.tier.base_fee,
                unit_rate: rule.tier.unit_rate,
                quantity,
                unit_label: unit_label.to_string(),
                amount,
                remarks: String::new(),
            })
        };

        details.push(compute(FeeCategory::Pilot, ship.pilot_hours, "小时")?);
        details.push(compute(
            FeeCategory::Tug,
            ship.tug_count as f64 * ship.tug_hours,
            "艘·小时",
        )?);
        details.push(compute(FeeCategory::Berth, berthing_days * nt, "吨·天")?);
        details.push(compute(FeeCategory::Port, nt, "净吨")?);
        details.push(compute(FeeCategory::Tally, ship.cargo_tonnage.max(nt * 0.5), "吨")?);
        details.push(compute(FeeCategory::Agent, nt, "净吨")?);
        details.push(compute(FeeCategory::Pilotage, ship.pilot_hours * 0.5, "小时")?);
        details.push(compute(FeeCategory::Mooring, berthing_days * 2.0, "次")?);
        details.push(compute(FeeCategory::Anchorage, berthing_hours * 0.1 * nt, "吨·小时")?);
        details.push(compute(FeeCategory::Quarantine, 1.0, "次")?);
        details.push(compute(FeeCategory::Customs, 1.0, "次")?);
        details.push(compute(FeeCategory::Other, nt * 0.05, "净吨")?);

        let total_amount: f64 = details.iter().map(|d| d.amount).sum();
        let tax_amount = total_amount * 0.06;
        let grand_total = total_amount + tax_amount;

        Ok(FeeResult {
            id: None,
            ship_id: ship.id,
            imo: ship.imo.clone(),
            vessel_name: ship.vessel_name.clone(),
            vessel_type: ship.vessel_type.as_str().to_string(),
            port_code: ship.port_code.clone(),
            arrival_time: ship.arrival_time,
            departure_time: ship.departure_time,
            compute_time: Utc::now(),
            details,
            total_amount,
            tax_amount,
            grand_total,
            has_dispute: false,
            is_settled: false,
            settled_amount: 0.0,
        })
    }

    pub fn calculate_batch(&self, ships: &[Ship]) -> Vec<(usize, Result<FeeResult, CalculatorError>)> {
        ships
            .par_iter()
            .enumerate()
            .map(|(i, ship)| (i, self.calculate(ship)))
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchComputeSummary {
    pub total_ships: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub total_grand_total: f64,
    pub port_breakdown: HashMap<String, (usize, f64)>,
    pub errors: Vec<(usize, String)>,
}

pub fn summarize_batch(results: &[(usize, Result<FeeResult, CalculatorError>)]) -> BatchComputeSummary {
    let mut success_count = 0;
    let mut total_grand_total = 0.0;
    let mut port_breakdown: HashMap<String, (usize, f64)> = HashMap::new();
    let mut errors = Vec::new();

    for (idx, result) in results {
        match result {
            Ok(fee) => {
                success_count += 1;
                total_grand_total += fee.grand_total;
                let entry = port_breakdown.entry(fee.port_code.clone()).or_insert((0, 0.0));
                entry.0 += 1;
                entry.1 += fee.grand_total;
            }
            Err(e) => {
                errors.push((*idx, e.to_string()));
            }
        }
    }

    BatchComputeSummary {
        total_ships: results.len(),
        success_count,
        failed_count: results.len() - success_count,
        total_grand_total,
        port_breakdown,
        errors,
    }
}
