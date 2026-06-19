use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// 数据来源格式：CNIPA（中国国家知识产权局）或 WIPO（世界知识产权组织 ST.36）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SourceFormat {
    Cnipa,
    Wipo,
    Unknown,
}

impl std::fmt::Display for SourceFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SourceFormat::Cnipa => write!(f, "CNIPA"),
            SourceFormat::Wipo => write!(f, "WIPO"),
            SourceFormat::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

/// 权利要求类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClaimType {
    Independent,
    Dependent,
    Unknown,
}

impl std::fmt::Display for ClaimType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClaimType::Independent => write!(f, "独立权利要求"),
            ClaimType::Dependent => write!(f, "从属权利要求"),
            ClaimType::Unknown => write!(f, "未知"),
        }
    }
}

/// 技术特征：侵权比对的最小单元
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    /// 特征编号，例如 "F1"、"C2"
    pub id: String,
    /// 特征原文
    pub text: String,
    /// 抽取的关键词，用于等同比对
    pub keywords: Vec<String>,
}

impl Feature {
    pub fn new(id: impl Into<String>, text: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            text: text.into(),
            keywords: Vec::new(),
        }
    }
}

/// 引用文献条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    /// 被引用的专利/文献号
    pub cited_id: String,
    /// 被引用文献标题（可选）
    pub cited_title: Option<String>,
    /// 引用类别，如 WIPO 的 X / Y / A
    pub category: Option<String>,
    /// 是否为非专利文献（NPL）
    pub is_non_patent: bool,
}

impl Citation {
    pub fn patent(id: impl Into<String>) -> Self {
        Self {
            cited_id: id.into(),
            cited_title: None,
            category: None,
            is_non_patent: false,
        }
    }
}

/// 单条权利要求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    /// 权利要求编号，如 "1"、"2"
    pub number: String,
    /// 权利要求全文
    pub text: String,
    /// 权利要求类型
    pub claim_type: ClaimType,
    /// 引用的在先权利要求编号（从属权利要求）
    pub depends_on: Vec<String>,
    /// 拆分后的技术特征（惰性填充，比对时由分析器写入）
    #[serde(default)]
    pub features: Vec<Feature>,
}

impl Claim {
    pub fn new(number: impl Into<String>, text: impl Into<String>, claim_type: ClaimType) -> Self {
        Self {
            number: number.into(),
            text: text.into(),
            claim_type,
            depends_on: Vec::new(),
            features: Vec::new(),
        }
    }

    pub fn is_independent(&self) -> bool {
        self.claim_type == ClaimType::Independent
    }
}

/// 专利文献结构化模型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patent {
    /// 文献号 / 公开号
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub abstract_text: String,
    #[serde(default)]
    pub applicants: Vec<String>,
    #[serde(default)]
    pub inventors: Vec<String>,
    #[serde(default)]
    pub filing_date: Option<String>,
    #[serde(default)]
    pub publication_date: Option<String>,
    /// 分类号（IPC / CPC）
    #[serde(default)]
    pub classifications: Vec<String>,
    /// 引用文献列表（本专利引用的在先文献）
    #[serde(default)]
    pub citations: Vec<Citation>,
    #[serde(default)]
    pub claims: Vec<Claim>,
    pub source_format: SourceFormat,
    #[serde(skip)]
    pub source_file: Option<PathBuf>,
}

impl Patent {
    pub fn new(id: impl Into<String>, source_format: SourceFormat) -> Self {
        Self {
            id: id.into(),
            title: String::new(),
            abstract_text: String::new(),
            applicants: Vec::new(),
            inventors: Vec::new(),
            filing_date: None,
            publication_date: None,
            classifications: Vec::new(),
            citations: Vec::new(),
            claims: Vec::new(),
            source_format,
            source_file: None,
        }
    }

    pub fn independent_claims(&self) -> Vec<&Claim> {
        self.claims.iter().filter(|c| c.is_independent()).collect()
    }

    pub fn claim_by_number(&self, number: &str) -> Option<&Claim> {
        self.claims.iter().find(|c| c.number == number)
    }
}

// ===== 侵权比对结果类型 =====

/// 单对特征的匹配结论
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchStatus {
    /// 完全相同（字面落入）
    ExactMatch,
    /// 等同（等同侵权原则下落入）
    Equivalent,
    /// 不匹配
    NoMatch,
    /// 目标方案中缺失对应特征（全面覆盖原则不满足）
    NotCovered,
}

impl MatchStatus {
    pub fn is_covered(&self) -> bool {
        matches!(self, MatchStatus::ExactMatch | MatchStatus::Equivalent)
    }
}

impl std::fmt::Display for MatchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MatchStatus::ExactMatch => write!(f, "相同"),
            MatchStatus::Equivalent => write!(f, "等同"),
            MatchStatus::NoMatch => write!(f, "不同"),
            MatchStatus::NotCovered => write!(f, "缺失"),
        }
    }
}

/// 单条权利要求的整体侵权判定结论
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverallInfringement {
    /// 字面侵权（全面覆盖且全部字面相同）
    LiteralInfringement,
    /// 等同侵权（全面覆盖且存在等同特征）
    EquivalentInfringement,
    /// 不侵权
    NoInfringement,
    /// 无法判定（特征不足）
    Indeterminate,
}

impl std::fmt::Display for OverallInfringement {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OverallInfringement::LiteralInfringement => write!(f, "字面侵权"),
            OverallInfringement::EquivalentInfringement => write!(f, "等同侵权"),
            OverallInfringement::NoInfringement => write!(f, "不侵权"),
            OverallInfringement::Indeterminate => write!(f, "无法判定"),
        }
    }
}

/// 单对特征比对明细
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureComparison {
    pub claim_feature_id: String,
    pub claim_feature_text: String,
    pub target_feature_id: String,
    pub target_feature_text: String,
    pub status: MatchStatus,
    pub reason: String,
}

/// 单条权利要求的侵权比对结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimInfringementResult {
    pub patent_id: String,
    pub claim_number: String,
    pub claim_type: ClaimType,
    pub comparisons: Vec<FeatureComparison>,
    pub overall: OverallInfringement,
    pub summary: String,
}

/// 完整侵权比对报告
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonReport {
    pub target_description: String,
    pub target_features: Vec<Feature>,
    pub results: Vec<ClaimInfringementResult>,
}

// ===== 解析诊断信息 =====

/// 诊断级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
}

/// 单条解析诊断：含文件名、行号、列号与原因
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseDiagnostic {
    pub file: Option<PathBuf>,
    pub line: usize,
    pub column: usize,
    pub severity: DiagnosticSeverity,
    pub message: String,
}

impl std::fmt::Display for ParseDiagnostic {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let fname = self
            .file
            .as_ref()
            .and_then(|p| p.to_str())
            .unwrap_or("<memory>");
        write!(
            f,
            "[{:?}] {}:{}:{} {}",
            self.severity, fname, self.line, self.column, self.message
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn independent_claim_filter() {
        let mut p = Patent::new("CN100", SourceFormat::Cnipa);
        p.claims.push(Claim::new("1", "一种装置", ClaimType::Independent));
        p.claims.push(Claim::new("2", "如1所述", ClaimType::Dependent));
        assert_eq!(p.independent_claims().len(), 1);
        assert!(p.claim_by_number("2").is_some());
        assert!(p.claim_by_number("9").is_none());
    }

    #[test]
    fn match_status_covered() {
        assert!(MatchStatus::ExactMatch.is_covered());
        assert!(MatchStatus::Equivalent.is_covered());
        assert!(!MatchStatus::NoMatch.is_covered());
        assert!(!MatchStatus::NotCovered.is_covered());
    }
}
