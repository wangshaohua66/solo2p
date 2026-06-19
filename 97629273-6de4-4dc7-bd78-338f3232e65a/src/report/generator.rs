use serde::Serialize;

use crate::analyzer::GraphAnalysis;
use crate::config::OutputSettings;
use crate::models::{ClaimInfringementResult, ComparisonReport, OverallInfringement, Patent};
use crate::parser::ClaimTree;
use crate::util::{bold, cyan, dim, green, magenta, red, status_colored};

/// 报告生成器：聚合权利要求树、引用图谱与特征比对矩阵，输出 JSON / 纯文本
pub struct ReportGenerator {
    color: bool,
    indent: usize,
}

impl ReportGenerator {
    pub fn new(settings: &OutputSettings) -> Self {
        Self {
            color: settings.color,
            indent: settings.indent,
        }
    }

    pub fn from_color(color: bool) -> Self {
        Self {
            color,
            indent: 2,
        }
    }

    fn paint(&self, status: &str, s: &str) -> String {
        if self.color {
            status_colored(status, s)
        } else {
            s.to_string()
        }
    }
    fn maybe(&self, fn_: fn(&str) -> String, s: &str) -> String {
        if self.color {
            fn_(s)
        } else {
            s.to_string()
        }
    }

    /// JSON 序列化
    pub fn to_json<T: Serialize>(&self, value: &T) -> String {
        serde_json::to_string_pretty(value).unwrap_or_else(|e| format!("JSON 序列化失败: {}", e))
    }

    /// 专利摘要表
    pub fn patent_summary(&self, patents: &[Patent]) -> String {
        let mut out = String::new();
        out.push_str(&self.maybe(bold, "专利清单\n"));
        out.push_str(&self.maybe(dim, &format!("共 {} 件\n", patents.len())));
        out.push_str(&self.maybe(dim, "文献号        | 标题                          | 申请人        | 权利要求数 | 引用数\n"));
        out.push_str(&"-".repeat(90).to_string());
        out.push('\n');
        for p in patents {
            let title = truncate(p.title.as_str(), 28);
            let app = p.applicants.first().map(|s| s.as_str()).unwrap_or("-");
            let app = truncate(app, 12);
            out.push_str(&format!(
                "{:<13}| {:<30}| {:<14}| {:<10}| {}\n",
                p.id,
                title,
                app,
                p.claims.len(),
                p.citations.len()
            ));
        }
        out
    }

    /// 权利要求树文本
    pub fn render_claim_tree(&self, patent: &Patent, expand_text: bool) -> String {
        let tree = ClaimTree::build(patent);
        let mut out = String::new();
        out.push_str(&self.maybe(bold, &format!("权利要求树 - {}\n", patent.id)));
        out.push_str(&tree.render(patent, expand_text));
        if tree.is_healthy() {
            out.push_str(&self.maybe(green, "  ✓ 树结构健康，无循环引用与断链\n"));
        } else {
            for d in tree.diagnostics() {
                out.push_str(&self.maybe(red, &format!("  ⚠ {}\n", d.message)));
            }
        }
        out
    }

    /// 引用图谱分析文本
    pub fn render_graph(&self, analysis: &GraphAnalysis) -> String {
        let mut out = String::new();
        out.push_str(&self.maybe(bold, "引用图谱分析\n"));
        out.push_str(&format!(
            "  节点数: {}  边数: {}\n",
            analysis.node_count, analysis.edge_count
        ));
        out.push_str(&self.maybe(cyan, "  核心基础专利（PageRank Top-N）:\n"));
        if analysis.core_patents.is_empty() {
            out.push_str(&self.maybe(dim, "    （无）\n"));
        }
        for (i, (id, score)) in analysis.core_patents.iter().enumerate() {
            out.push_str(&format!("    {:>2}. {:<20} {:.6}\n", i + 1, id, score));
        }
        out.push_str(&self.maybe(magenta, "  专利池边界:\n"));
        out.push_str(&format!("    源点（最新/无入边）: {}\n", join_or_empty(&analysis.sources)));
        out.push_str(&format!("    汇点（基础/无出边）: {}\n", join_or_empty(&analysis.sinks)));
        out.push_str(&self.maybe(cyan, "  邻接表:\n"));
        for (node, nbrs) in &analysis.adjacency {
            if nbrs.is_empty() {
                out.push_str(&format!("    {} → （无）\n", node));
            } else {
                out.push_str(&format!("    {} → {}\n", node, nbrs.join(", ")));
            }
        }
        out
    }

    /// 特征比对矩阵文本
    pub fn render_comparison(&self, report: &ComparisonReport) -> String {
        let mut out = String::new();
        out.push_str(&self.maybe(bold, "侵权比对报告\n"));
        out.push_str(&format!("目标技术方案: {}\n", report.target_description));
        out.push_str(&self.maybe(dim, &format!(
            "目标特征列表 ({}):\n",
            report.target_features.len()
        )));
        for f in &report.target_features {
            out.push_str(&format!("  {} - {}\n", f.id, truncate(&f.text, 60)));
        }
        out.push('\n');
        for r in &report.results {
            out.push_str(&self.render_claim_result(r));
            out.push('\n');
        }
        out.push_str(&self.render_overall_summary(&report.results));
        out
    }

    fn render_claim_result(&self, r: &ClaimInfringementResult) -> String {
        let mut out = String::new();
        let overall_str = r.overall.to_string();
        out.push_str(&format!(
            "专利 {} 权利要求{}（{}）→ {}",
            r.patent_id,
            r.claim_number,
            r.claim_type,
            self.paint(overall_str.as_str(), overall_str.as_str())
        ));
        out.push('\n');
        out.push_str(&format!("  摘要: {}\n", r.summary));
        if r.comparisons.is_empty() {
            out.push_str(&self.maybe(dim, "  （未拆分出特征）\n"));
            return out;
        }
        // 比对矩阵表头
        out.push_str(&self.maybe(dim, "  权利要求特征        | 目标特征            | 状态  | 理由\n"));
        out.push_str(&self.maybe(dim, &format!("  {}\n", "-".repeat(70))));
        for c in &r.comparisons {
            let status = c.status.to_string();
            let status_cell = self.paint(status.as_str(), status.as_str());
            out.push_str(&format!(
                "  {:<19}| {:<19}| {:<5} | {}\n",
                truncate(&format!("{}: {}", c.claim_feature_id, c.claim_feature_text), 19),
                truncate(&format!("{}: {}", c.target_feature_id, c.target_feature_text), 19),
                status_cell,
                c.reason
            ));
        }
        out
    }

    fn render_overall_summary(&self, results: &[ClaimInfringementResult]) -> String {
        let mut out = String::new();
        out.push_str(&self.maybe(bold, "汇总判定\n"));
        let mut lit = 0;
        let mut equiv = 0;
        let mut none = 0;
        let mut indet = 0;
        for r in results {
            match r.overall {
                OverallInfringement::LiteralInfringement => lit += 1,
                OverallInfringement::EquivalentInfringement => equiv += 1,
                OverallInfringement::NoInfringement => none += 1,
                OverallInfringement::Indeterminate => indet += 1,
            }
        }
        out.push_str(&format!(
            "  {}: {}  {}: {}  {}: {}  {}: {}\n",
            self.paint("字面侵权", "字面侵权"),
            lit,
            self.paint("等同侵权", "等同侵权"),
            equiv,
            self.paint("不侵权", "不侵权"),
            none,
            self.paint("无法判定", "无法判定"),
            indet
        ));
        out
    }
}

fn join_or_empty(items: &[String]) -> String {
    if items.is_empty() {
        "（无）".to_string()
    } else {
        items.join(", ")
    }
}

fn truncate(s: &str, max: usize) -> String {
    let count = s.chars().count();
    if count <= max {
        s.to_string()
    } else {
        let t: String = s.chars().take(max).collect();
        format!("{}…", t)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analyzer::InfringementAnalyzer;
    use crate::models::{Claim, ClaimType, SourceFormat};

    #[test]
    fn json_serializes_report() {
        let g = ReportGenerator::from_color(false);
        let report = ComparisonReport {
            target_description: "测试".to_string(),
            target_features: vec![],
            results: vec![],
        };
        let json = g.to_json(&report);
        assert!(json.contains("target_description"));
    }

    #[test]
    fn comparison_text_contains_status() {
        let g = ReportGenerator::from_color(false);
        let mut patent = Patent::new("P1", SourceFormat::Unknown);
        patent.claims.push(Claim::new("1", "一种装置，包括底座", ClaimType::Independent));
        let analyzer = InfringementAnalyzer::from_defaults();
        let target = analyzer.split_features("一种装置，包括底座", "T");
        let report = analyzer.compare_patents(&[patent], "测试目标", &target, None);
        let text = g.render_comparison(&report);
        assert!(text.contains("侵权比对报告"));
        assert!(text.contains("汇总判定"));
    }

    #[test]
    fn graph_text_shows_nodes() {
        let g = ReportGenerator::from_color(false);
        let analysis = GraphAnalysis {
            node_count: 3,
            edge_count: 2,
            pagerank: vec![("P3".to_string(), 0.5)],
            core_patents: vec![("P3".to_string(), 0.5)],
            sources: vec!["P1".to_string()],
            sinks: vec!["P3".to_string()],
            adjacency: vec![("P1".to_string(), vec!["P3".to_string()])],
        };
        let text = g.render_graph(&analysis);
        assert!(text.contains("节点数: 3"));
        assert!(text.contains("PageRank"));
    }
}
