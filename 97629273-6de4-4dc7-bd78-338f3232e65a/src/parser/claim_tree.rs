use std::collections::{HashMap, HashSet};

use crate::models::{Claim, ClaimType, DiagnosticSeverity, ParseDiagnostic, Patent};

/// 权利要求树节点
#[derive(Debug, Clone)]
pub struct ClaimNode {
    pub number: String,
    pub claim_type: ClaimType,
    pub depends_on: Vec<String>,
    pub children: Vec<String>,
    pub depth: usize,
}

/// 权利要求从属树：含循环引用与断链检测结果
#[derive(Debug, Clone)]
pub struct ClaimTree {
    pub root_numbers: Vec<String>,
    pub nodes: HashMap<String, ClaimNode>,
    pub cycles: Vec<Vec<String>>,
    pub broken_links: Vec<(String, String)>,
}

impl ClaimTree {
    /// 由专利的权利要求列表构建从属树
    pub fn build(patent: &Patent) -> Self {
        Self::from_claims(&patent.claims)
    }

    pub fn from_claims(claims: &[Claim]) -> Self {
        let mut nodes: HashMap<String, ClaimNode> = HashMap::new();
        let mut existing: HashSet<String> = HashSet::new();
        for c in claims {
            existing.insert(c.number.clone());
            nodes.insert(
                c.number.clone(),
                ClaimNode {
                    number: c.number.clone(),
                    claim_type: c.claim_type,
                    depends_on: c.depends_on.clone(),
                    children: Vec::new(),
                    depth: 0,
                },
            );
        }

        // 计算 children 与断链
        let mut broken_links = Vec::new();
        for c in claims {
            for dep in &c.depends_on {
                if existing.contains(dep) {
                    if let Some(parent) = nodes.get_mut(dep) {
                        if !parent.children.contains(&c.number) {
                            parent.children.push(c.number.clone());
                        }
                    }
                } else {
                    broken_links.push((c.number.clone(), dep.clone()));
                }
            }
        }

        // 计算深度（自顶向下 BFS，遇环中断）
        let roots: Vec<String> = nodes
            .values()
            .filter(|n| n.depends_on.is_empty() || n.claim_type == ClaimType::Independent)
            .map(|n| n.number.clone())
            .collect();
        for r in &roots {
            assign_depth(&mut nodes, r, 0);
        }
        // 对未赋深度（仅作为从属但无独立根可达）的节点补深度
        for n in nodes.values_mut() {
            if n.depth == 0 && !roots.contains(&n.number) {
                n.depth = 1;
            }
        }

        // 循环检测
        let cycles = detect_cycles(&nodes);

        ClaimTree {
            root_numbers: roots,
            nodes,
            cycles,
            broken_links,
        }
    }

    /// 递归展开某条权利要求的有效全文（沿 depends_on 链合并父权要求文本）
    pub fn effective_text(&self, patent: &Patent, number: &str) -> String {
        let mut visited = HashSet::new();
        let mut chain: Vec<&Claim> = Vec::new();
        self.collect_ancestors(patent, number, &mut visited, &mut chain);
        // 链为「根 → ... → 当前」顺序
        chain
            .iter()
            .map(|c| c.text.trim().to_string())
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn collect_ancestors<'a>(
        &self,
        patent: &'a Patent,
        number: &str,
        visited: &mut HashSet<String>,
        chain: &mut Vec<&'a Claim>,
    ) {
        if visited.contains(number) {
            return;
        }
        visited.insert(number.to_string());
        let Some(claim) = patent.claim_by_number(number) else {
            return;
        };
        // 先递归父节点，保证链顺序为根→叶
        for dep in &claim.depends_on {
            self.collect_ancestors(patent, dep, visited, chain);
        }
        chain.push(claim);
    }

    /// 渲染整棵树为缩进文本
    pub fn render(&self, patent: &Patent, expand_text: bool) -> String {
        let mut out = String::new();
        let mut printed = HashSet::new();
        let mut sorted_roots = self.root_numbers.clone();
        sorted_roots.sort_by_key(|n| n.parse::<u64>().unwrap_or(u64::MAX));
        for root in &sorted_roots {
            self.render_node(patent, root, 0, &mut printed, &mut out, expand_text);
        }
        // 孤立从属节点（既非根也无父可达）也要输出
        for n in self.nodes.values() {
            if !printed.contains(&n.number) {
                self.render_node(patent, &n.number, 0, &mut printed, &mut out, expand_text);
            }
        }
        out
    }

    fn render_node(
        &self,
        patent: &Patent,
        number: &str,
        depth: usize,
        printed: &mut HashSet<String>,
        out: &mut String,
        expand_text: bool,
    ) {
        if printed.contains(number) {
            return;
        }
        printed.insert(number.to_string());
        let node = match self.nodes.get(number) {
            Some(n) => n,
            None => return,
        };
        let indent = "  ".repeat(depth);
        let marker = if node.claim_type == ClaimType::Independent {
            "[独]"
        } else {
            "[从]"
        };
        let deps = if node.depends_on.is_empty() {
            String::new()
        } else {
            format!(" → 引用 {}", node.depends_on.join(","))
        };
        out.push_str(&format!("{}{} 权利要求{}{}\n", indent, marker, number, deps));
        if expand_text {
            if let Some(c) = patent.claim_by_number(number) {
                let body = c.text.trim();
                let body: String = if body.chars().count() > 80 {
                    let truncated: String = body.chars().take(80).collect();
                    format!("{}…", truncated)
                } else {
                    body.to_string()
                };
                out.push_str(&format!("{}    {}\n", indent, body));
            }
        }
        let mut children = node.children.clone();
        children.sort_by_key(|n| n.parse::<u64>().unwrap_or(u64::MAX));
        for child in &children {
            self.render_node(patent, child, depth + 1, printed, out, expand_text);
        }
    }

    /// 将循环引用与断链转为诊断信息
    pub fn diagnostics(&self) -> Vec<ParseDiagnostic> {
        let mut diags = Vec::new();
        for cycle in &self.cycles {
            diags.push(ParseDiagnostic {
                file: None,
                line: 0,
                column: 0,
                severity: DiagnosticSeverity::Error,
                message: format!("检测到权利要求循环引用: {}", cycle.join(" → ")),
            });
        }
        for (claim, missing) in &self.broken_links {
            diags.push(ParseDiagnostic {
                file: None,
                line: 0,
                column: 0,
                severity: DiagnosticSeverity::Warning,
                message: format!("权利要求{}引用了不存在的权利要求{}", claim, missing),
            });
        }
        diags
    }

    pub fn is_healthy(&self) -> bool {
        self.cycles.is_empty() && self.broken_links.is_empty()
    }
}

fn assign_depth(nodes: &mut HashMap<String, ClaimNode>, number: &str, depth: usize) {
    let Some(n) = nodes.get_mut(number) else {
        return;
    };
    n.depth = n.depth.max(depth);
    let children = n.children.clone();
    for child in &children {
        assign_depth(nodes, child, depth + 1);
    }
}

/// 三色 DFS 检测有向环
fn detect_cycles(nodes: &HashMap<String, ClaimNode>) -> Vec<Vec<String>> {
    let mut white: HashSet<String> = nodes.keys().cloned().collect();
    let mut gray: HashSet<String> = HashSet::new();
    let mut cycles: Vec<Vec<String>> = Vec::new();
    let keys: Vec<String> = nodes.keys().cloned().collect();
    for k in keys {
        if white.contains(&k) {
            let mut path = Vec::new();
            dfs_visit(&k, nodes, &mut white, &mut gray, &mut path, &mut cycles);
        }
    }
    cycles
}

fn dfs_visit(
    node: &str,
    nodes: &HashMap<String, ClaimNode>,
    white: &mut HashSet<String>,
    gray: &mut HashSet<String>,
    path: &mut Vec<String>,
    cycles: &mut Vec<Vec<String>>,
) {
    white.remove(node);
    gray.insert(node.to_string());
    path.push(node.to_string());
    if let Some(n) = nodes.get(node) {
        for child in &n.children {
            if gray.contains(child) {
                // 发现环：截取 path 中从 child 到当前的序列
                if let Some(start) = path.iter().position(|x| x == child) {
                    let cycle: Vec<String> = path[start..].to_vec();
                    cycles.push(cycle);
                }
            } else if white.contains(child) {
                dfs_visit(child, nodes, white, gray, path, cycles);
            }
        }
    }
    gray.remove(node);
    path.pop();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SourceFormat;

    fn patent_with(claims: Vec<Claim>) -> Patent {
        let mut p = Patent::new("T", SourceFormat::Unknown);
        p.claims = claims;
        p
    }

    #[test]
    fn builds_simple_tree() {
        let p = patent_with(vec![
            Claim::new("1", "一种装置，包括底座和杠杆", ClaimType::Independent),
            Claim::new("2", "如1所述", ClaimType::Dependent),
            Claim::new("3", "如2所述", ClaimType::Dependent),
        ]);
        let p = {
            let mut tmp = p;
            tmp.claims[1].depends_on = vec!["1".into()];
            tmp.claims[2].depends_on = vec!["2".into()];
            tmp
        };
        let tree = ClaimTree::build(&p);
        assert_eq!(tree.root_numbers, vec!["1".to_string()]);
        assert!(tree.is_healthy());
        let node1 = tree.nodes.get("1").unwrap();
        assert_eq!(node1.children, vec!["2".to_string()]);
        assert_eq!(tree.nodes.get("2").unwrap().depth, 1);
    }

    #[test]
    fn detects_broken_link() {
        let mut p = patent_with(vec![Claim::new("1", "一种装置", ClaimType::Independent)]);
        p.claims[0].depends_on = vec!["9".into()];
        let tree = ClaimTree::build(&p);
        assert!(tree.broken_links.contains(&("1".to_string(), "9".to_string())));
    }

    #[test]
    fn detects_cycle() {
        let mut p = patent_with(vec![
            Claim::new("1", "如2所述", ClaimType::Dependent),
            Claim::new("2", "如1所述", ClaimType::Dependent),
        ]);
        p.claims[0].depends_on = vec!["2".into()];
        p.claims[1].depends_on = vec!["1".into()];
        let tree = ClaimTree::build(&p);
        assert!(!tree.cycles.is_empty());
        assert!(!tree.is_healthy());
    }

    #[test]
    fn effective_text_merges_chain() {
        let mut p = patent_with(vec![
            Claim::new("1", "一种装置，包括底座", ClaimType::Independent),
            Claim::new("2", "如1所述，包括杠杆", ClaimType::Dependent),
        ]);
        p.claims[1].depends_on = vec!["1".into()];
        let tree = ClaimTree::build(&p);
        let eff = tree.effective_text(&p, "2");
        assert!(eff.contains("底座"));
        assert!(eff.contains("杠杆"));
    }

    #[test]
    fn render_outputs_tree() {
        let mut p = patent_with(vec![
            Claim::new("1", "一种装置", ClaimType::Independent),
            Claim::new("2", "如1所述", ClaimType::Dependent),
        ]);
        p.claims[1].depends_on = vec!["1".into()];
        let tree = ClaimTree::build(&p);
        let rendered = tree.render(&p, false);
        assert!(rendered.contains("权利要求1"));
        assert!(rendered.contains("权利要求2"));
    }
}
