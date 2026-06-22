use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::calculator::fee::{FeeDetail, FeeResult};
use crate::models::port::FeeCategory;

#[derive(Debug, Error)]
pub enum DisputeError {
    #[error("无效的调整项格式: {0}, 应为 category=amount")]
    InvalidAdjustmentFormat(String),
    #[error("费用类别不存在: {0}")]
    InvalidCategory(String),
    #[error("费用记录不存在: id={0}")]
    FeeRecordNotFound(i64),
    #[error("调整后金额不能为负数: {0}")]
    NegativeAmount(String),
    #[error("审批状态错误: {0}")]
    InvalidApprovalState(String),
    #[error("未指定任何调整项")]
    NoAdjustmentsSpecified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DisputeStatus {
    Pending,
    Submitted,
    Approved,
    Rejected,
    Applied,
}

impl DisputeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            DisputeStatus::Pending => "待提交",
            DisputeStatus::Submitted => "待审批",
            DisputeStatus::Approved => "已批准",
            DisputeStatus::Rejected => "已拒绝",
            DisputeStatus::Applied => "已执行",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdjustmentItem {
    pub category: FeeCategory,
    pub original_amount: f64,
    pub adjust_amount: f64,
    pub final_amount: f64,
}

impl AdjustmentItem {
    pub fn new(category: FeeCategory, original: f64, adjust: f64) -> Result<Self, DisputeError> {
        let final_amt = original + adjust;
        if final_amt < 0.0 {
            return Err(DisputeError::NegativeAmount(category.display_name().to_string()));
        }
        Ok(AdjustmentItem {
            category,
            original_amount: original,
            adjust_amount: adjust,
            final_amount: final_amt,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeRecord {
    pub id: Option<i64>,
    pub fee_record_id: i64,
    pub reason: String,
    pub requester: String,
    pub approver: Option<String>,
    pub adjustments: Vec<AdjustmentItem>,
    pub original_total: f64,
    pub adjusted_total: f64,
    pub delta_total: f64,
    pub status: DisputeStatus,
    pub submitted_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
    pub approval_comments: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl DisputeRecord {
    pub fn new(
        fee_record_id: i64,
        reason: String,
        requester: String,
        fee_result: &FeeResult,
        raw_adjustments: &[String],
    ) -> Result<Self, DisputeError> {
        if raw_adjustments.is_empty() {
            return Err(DisputeError::NoAdjustmentsSpecified);
        }

        let adjustments = parse_adjustments(raw_adjustments, fee_result)?;

        let adjusted_total: f64 = adjustments.iter().map(|a| a.final_amount).sum();
        let original_total: f64 = adjustments.iter().map(|a| a.original_amount).sum();
        let delta_total = adjusted_total - original_total;

        Ok(DisputeRecord {
            id: None,
            fee_record_id,
            reason,
            requester,
            approver: None,
            adjustments,
            original_total,
            adjusted_total,
            delta_total,
            status: DisputeStatus::Pending,
            submitted_at: None,
            approved_at: None,
            applied_at: None,
            approval_comments: None,
            created_at: Utc::now(),
        })
    }

    pub fn submit(&mut self) -> Result<(), DisputeError> {
        if self.status != DisputeStatus::Pending {
            return Err(DisputeError::InvalidApprovalState(format!(
                "当前状态为{}，无法提交",
                self.status.as_str()
            )));
        }
        self.status = DisputeStatus::Submitted;
        self.submitted_at = Some(Utc::now());
        Ok(())
    }

    pub fn approve(&mut self, approver: String, comments: Option<String>) -> Result<(), DisputeError> {
        if self.status != DisputeStatus::Submitted {
            return Err(DisputeError::InvalidApprovalState(format!(
                "当前状态为{}，无法审批",
                self.status.as_str()
            )));
        }
        self.status = DisputeStatus::Approved;
        self.approver = Some(approver);
        self.approved_at = Some(Utc::now());
        self.approval_comments = comments;
        Ok(())
    }

    pub fn apply(&mut self, fee_result: &mut FeeResult) -> Result<(), DisputeError> {
        if self.status != DisputeStatus::Approved {
            return Err(DisputeError::InvalidApprovalState(format!(
                "当前状态为{}，无法执行调整",
                self.status.as_str()
            )));
        }

        for adj in &self.adjustments {
            if let Some(detail) = fee_result
                .details
                .iter_mut()
                .find(|d| d.category == adj.category)
            {
                detail.amount = adj.final_amount;
                detail.remarks = format!("争议调整: {}", self.reason);
            }
        }

        fee_result.total_amount = fee_result.details.iter().map(|d| d.amount).sum();
        fee_result.tax_amount = fee_result.total_amount * 0.06;
        fee_result.grand_total = fee_result.total_amount + fee_result.tax_amount;
        fee_result.has_dispute = true;

        self.status = DisputeStatus::Applied;
        self.applied_at = Some(Utc::now());
        Ok(())
    }
}

fn parse_adjustments(
    raw: &[String],
    fee_result: &FeeResult,
) -> Result<Vec<AdjustmentItem>, DisputeError> {
    let mut result = Vec::new();

    for adj_str in raw {
        let parts: Vec<&str> = adj_str.splitn(2, '=').collect();
        if parts.len() != 2 {
            return Err(DisputeError::InvalidAdjustmentFormat(adj_str.clone()));
        }

        let category_str = parts[0].trim();
        let amount_str = parts[1].trim();

        let category = std::str::FromStr::from_str(category_str)
            .map_err(|_| DisputeError::InvalidCategory(category_str.to_string()))?;

        let adjust_amount: f64 = amount_str
            .parse()
            .map_err(|_| DisputeError::InvalidAdjustmentFormat(adj_str.clone()))?;

        let original_amount = fee_result
            .details
            .iter()
            .find(|d| d.category == category)
            .map(|d| d.amount)
            .ok_or_else(|| DisputeError::InvalidCategory(category_str.to_string()))?;

        result.push(AdjustmentItem::new(category, original_amount, adjust_amount)?);
    }

    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisputeComparison {
    pub category_name: String,
    pub original: f64,
    pub adjusted: f64,
    pub delta: f64,
}

pub fn generate_comparison(dispute: &DisputeRecord) -> Vec<DisputeComparison> {
    dispute
        .adjustments
        .iter()
        .map(|a| DisputeComparison {
            category_name: a.category.display_name().to_string(),
            original: a.original_amount,
            adjusted: a.final_amount,
            delta: a.adjust_amount,
        })
        .collect()
}

pub fn apply_dispute_to_details(
    details: &mut [FeeDetail],
    dispute: &DisputeRecord,
) -> Result<(), DisputeError> {
    if dispute.status != DisputeStatus::Approved && dispute.status != DisputeStatus::Applied {
        return Err(DisputeError::InvalidApprovalState(
            "争议未经审批通过".to_string(),
        ));
    }

    for adj in &dispute.adjustments {
        if let Some(detail) = details.iter_mut().find(|d| d.category == adj.category) {
            detail.amount = adj.final_amount;
            detail.remarks = format!("争议调整: {}", dispute.reason);
        }
    }

    Ok(())
}
