use std::collections::HashSet;

use crate::config::ComparisonSettings;
use crate::models::{
    Claim, ClaimInfringementResult, ClaimType, ComparisonReport, Feature, FeatureComparison,
    MatchStatus, OverallInfringement, Patent,
};

const ASCII_STOPWORDS: &[&str] = &[
    "the", "a", "an", "of", "with", "and", "to", "for", "in", "on", "by", "is", "are", "be",
    "as", "at", "or", "from", "that", "this", "said", "wherein", "comprising", "including",
    "consisting", "having", "which", "it", "its", "into",
];

/// 侵权比对分析器：全面覆盖 + 等同原则两级判定
pub struct InfringementAnalyzer {
    settings: ComparisonSettings,
}

impl InfringementAnalyzer {
    pub fn new(settings: ComparisonSettings) -> Self {
        Self { settings }
    }

    pub fn from_defaults() -> Self {
        Self::new(ComparisonSettings::default())
    }

    /// 将技术方案文本拆分为特征列表，prefix 控制编号前缀（"T" 或 "C"）
    pub fn split_features(&self, text: &str, prefix: &str) -> Vec<Feature> {
        let segments = split_claim_segments(text);
        let mut features = Vec::new();
        let mut idx = 1;
        for seg in segments {
            let seg = seg.trim();
            if seg.chars().count() < 2 {
                continue;
            }
            let mut f = Feature::new(format!("{}{}", prefix, idx), seg);
            f.keywords = keywords(seg);
            features.push(f);
            idx += 1;
            if features.len() >= self.settings.max_features_per_claim {
                break;
            }
        }
        features
    }

    /// 对单条权利要求执行特征比对
    pub fn compare_claim(
        &self,
        patent_id: &str,
        claim: &Claim,
        target_features: &[Feature],
    ) -> ClaimInfringementResult {
        let claim_features = self.split_features(&claim.text, "C");
        let mut comparisons = Vec::new();

        if target_features.is_empty() {
            for cf in &claim_features {
                comparisons.push(FeatureComparison {
                    claim_feature_id: cf.id.clone(),
                    claim_feature_text: cf.text.clone(),
                    target_feature_id: String::new(),
                    target_feature_text: String::new(),
                    status: MatchStatus::NotCovered,
                    reason: "目标技术方案未提供特征".to_string(),
                });
            }
            return self.finalize(patent_id, claim, comparisons);
        }

        for cf in &claim_features {
            let best = self.best_match(cf, target_features);
            comparisons.push(best);
        }
        self.finalize(patent_id, claim, comparisons)
    }

    /// 对一件专利的全部独立权利要求（或指定权利要求）执行比对
    pub fn compare_patent(
        &self,
        patent: &Patent,
        target_features: &[Feature],
        claim_filter: Option<&str>,
    ) -> Vec<ClaimInfringementResult> {
        let mut results = Vec::new();
        for claim in &patent.claims {
            let selected = match claim_filter {
                Some(n) => &claim.number == n,
                None => claim.claim_type == ClaimType::Independent,
            };
            if selected {
                results.push(self.compare_claim(&patent.id, claim, target_features));
            }
        }
        results
    }

    /// 对多件专利批量比对，生成完整报告
    pub fn compare_patents(
        &self,
        patents: &[Patent],
        target_description: &str,
        target_features: &[Feature],
        claim_filter: Option<&str>,
    ) -> ComparisonReport {
        self.compare_patents_cb(patents, target_description, target_features, claim_filter, |_| {})
    }

    /// 带进度回调的批量比对：每处理完一件专利调用一次 cb，回调参数为该专利引用
    pub fn compare_patents_cb<F>(
        &self,
        patents: &[Patent],
        target_description: &str,
        target_features: &[Feature],
        claim_filter: Option<&str>,
        mut cb: F,
    ) -> ComparisonReport
    where
        F: FnMut(&Patent),
    {
        let mut results = Vec::new();
        for p in patents {
            results.extend(self.compare_patent(p, target_features, claim_filter));
            cb(p);
        }
        ComparisonReport {
            target_description: target_description.to_string(),
            target_features: target_features.to_vec(),
            results,
        }
    }

    fn best_match(&self, claim_feat: &Feature, target_features: &[Feature]) -> FeatureComparison {
        let ck: HashSet<&String> = claim_feat.keywords.iter().collect();
        let mut best: Option<(&Feature, f64)> = None;
        for tf in target_features {
            let tk: HashSet<&String> = tf.keywords.iter().collect();
            let cov = coverage(&ck, &tk);
            match best {
                Some((_, b)) if cov <= b => {}
                _ => best = Some((tf, cov)),
            }
        }
        let (tf, cov) = best.unwrap_or((&target_features[0], 0.0));
        let pct = cov * 100.0;
        let (status, reason) = if ck.is_empty() {
            (MatchStatus::NoMatch, "权利要求特征无有效关键词".to_string())
        } else if cov >= 0.999 {
            (
                MatchStatus::ExactMatch,
                format!("目标特征覆盖权利要求特征全部关键词（重合度 {:.0}%）", pct),
            )
        } else if cov >= self.settings.equivalent_keyword_threshold {
            (
                MatchStatus::Equivalent,
                format!("关键词重合度 {:.0}%，达到等同阈值", pct),
            )
        } else {
            (
                MatchStatus::NoMatch,
                format!("关键词重合度 {:.0}%，低于等同阈值", pct),
            )
        };
        FeatureComparison {
            claim_feature_id: claim_feat.id.clone(),
            claim_feature_text: claim_feat.text.clone(),
            target_feature_id: tf.id.clone(),
            target_feature_text: tf.text.clone(),
            status,
            reason,
        }
    }

    fn finalize(
        &self,
        patent_id: &str,
        claim: &Claim,
        comparisons: Vec<FeatureComparison>,
    ) -> ClaimInfringementResult {
        let (overall, summary) = if comparisons.is_empty() {
            (OverallInfringement::Indeterminate, "权利要求未拆分出有效特征".to_string())
        } else {
            let all_covered = comparisons.iter().all(|c| c.status.is_covered());
            let any_equiv = comparisons.iter().any(|c| c.status == MatchStatus::Equivalent);
            if !all_covered {
                let uncovered = comparisons
                    .iter()
                    .filter(|c| !c.status.is_covered())
                    .map(|c| c.claim_feature_id.clone())
                    .collect::<Vec<_>>()
                    .join(", ");
                (
                    OverallInfringement::NoInfringement,
                    format!("未满足全面覆盖：特征 {} 未被目标方案覆盖", uncovered),
                )
            } else if any_equiv {
                (OverallInfringement::EquivalentInfringement, "全面覆盖成立且存在等同特征".to_string())
            } else {
                (OverallInfringement::LiteralInfringement, "全面覆盖成立，全部特征字面相同".to_string())
            }
        };
        ClaimInfringementResult {
            patent_id: patent_id.to_string(),
            claim_number: claim.number.clone(),
            claim_type: claim.claim_type,
            comparisons,
            overall,
            summary,
        }
    }
}

/// 关键词重合度：|claim ∩ target| / |claim|
fn coverage(claim_kw: &HashSet<&String>, target_kw: &HashSet<&String>) -> f64 {
    if claim_kw.is_empty() {
        return 0.0;
    }
    let inter = claim_kw.intersection(target_kw).count() as f64;
    inter / claim_kw.len() as f64
}

/// 关键词抽取：ASCII 词 + CJK 二元组
pub fn keywords(text: &str) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut kws: Vec<String> = Vec::new();
    for word in lower.split(|c: char| !c.is_alphanumeric()) {
        if word.chars().all(|c| c.is_ascii()) && word.len() >= 2 {
            if !ASCII_STOPWORDS.contains(&word) {
                kws.push(word.to_string());
            }
        }
    }
    let han: Vec<char> = lower.chars().filter(|&c| is_cjk(c)).collect();
    for w in han.windows(2) {
        kws.push(format!("{}{}", w[0], w[1]));
    }
    kws.sort();
    kws.dedup();
    kws
}

fn is_cjk(c: char) -> bool {
    ('\u{4E00}'..='\u{9FFF}').contains(&c)
}

/// 将权利要求/技术方案文本切分为特征片段
fn split_claim_segments(text: &str) -> Vec<String> {
    let normalized = text
        .replace("wherein", "；")
        .replace("Wherein", "；")
        .replace("其特征在于", "；")
        .replace("其特征是", "；")
        .replace("characterized in that", "；")
        .replace("characterized by", "；");
    let mut out = Vec::new();
    for seg in normalized.split(['；', '。', ';', '\n']) {
        let seg = seg.trim();
        if seg.is_empty() {
            continue;
        }
        // 进一步按顿号/逗号细分为子特征
        for sub in seg.split(['，', ',']) {
            let sub = sub.trim();
            if !sub.is_empty() {
                out.push(sub.to_string());
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SourceFormat;

    fn pat(id: &str, claim_text: &str) -> Patent {
        let mut p = Patent::new(id, SourceFormat::Unknown);
        p.claims.push(Claim::new("1", claim_text, ClaimType::Independent));
        p
    }

    #[test]
    fn splits_features_on_delimiters() {
        let a = InfringementAnalyzer::from_defaults();
        let feats = a.split_features("包括底座；包括杠杆，杠杆连接底座。", "T");
        assert!(feats.len() >= 2);
        assert!(feats.iter().all(|f| f.id.starts_with('T')));
    }

    #[test]
    fn literal_infringement_when_covered() {
        let a = InfringementAnalyzer::from_defaults();
        let target = a.split_features("一种装置，包括底座和杠杆，杠杆可转动地连接于底座", "T");
        let p = pat("P1", "一种装置，包括底座和杠杆，杠杆可转动地连接于底座");
        let res = a.compare_claim("P1", &p.claims[0], &target);
        assert_eq!(res.overall, OverallInfringement::LiteralInfringement);
    }

    #[test]
    fn no_infringement_when_feature_missing() {
        let a = InfringementAnalyzer::from_defaults();
        // 目标缺少「杠杆」
        let target = a.split_features("一种装置，包括底座", "T");
        let p = pat("P1", "一种装置，包括底座和杠杆，杠杆可转动地连接于底座");
        let res = a.compare_claim("P1", &p.claims[0], &target);
        assert_eq!(res.overall, OverallInfringement::NoInfringement);
    }

    #[test]
    fn equivalent_when_partial_overlap() {
        let mut settings = ComparisonSettings::default();
        settings.equivalent_keyword_threshold = 0.3;
        let a = InfringementAnalyzer::new(settings);
        // 目标用「金属杆」近似「杠杆」，关键词部分重合
        let target = a.split_features("一种装置，包括底座和金属杆，金属杆可转动连接底座", "T");
        let p = pat("P1", "一种装置，包括底座和杠杆，杠杆可转动地连接于底座");
        let res = a.compare_claim("P1", &p.claims[0], &target);
        assert!(
            matches!(
                res.overall,
                OverallInfringement::EquivalentInfringement | OverallInfringement::NoInfringement
            )
        );
    }

    #[test]
    fn keywords_extract_ascii_and_cjk() {
        let kw = keywords("A pivotable lever 可转动地连接");
        assert!(kw.iter().any(|k| k == "pivotable"));
        assert!(kw.iter().any(|k| k == "lever"));
        assert!(kw.iter().any(|k| k == "可转"));
    }
}
