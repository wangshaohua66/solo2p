use std::collections::{HashMap, HashSet};

use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::Direction;

use crate::models::Patent;

/// 引用图谱分析结果
#[derive(Debug, Clone)]
pub struct GraphAnalysis {
    pub node_count: usize,
    pub edge_count: usize,
    pub pagerank: Vec<(String, f64)>,
    pub core_patents: Vec<(String, f64)>,
    pub sources: Vec<String>,
    pub sinks: Vec<String>,
    pub adjacency: Vec<(String, Vec<String>)>,
}

/// 引用有向图：边 A → B 表示「A 引用了 B」
pub struct CitationGraph {
    graph: DiGraph<String, ()>,
    index: HashMap<String, NodeIndex>,
}

impl Default for CitationGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl CitationGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            index: HashMap::new(),
        }
    }

    /// 由专利集合增量构建图谱
    pub fn from_patents(patents: &[Patent]) -> Self {
        let mut g = Self::new();
        g.add_patents(patents);
        g
    }

    /// 增量合并专利，避免全量重建
    pub fn add_patents(&mut self, patents: &[Patent]) {
        for p in patents {
            let u = self.ensure(p.id.clone());
            for c in &p.citations {
                if c.is_non_patent {
                    continue;
                }
                let v = self.ensure(c.cited_id.clone());
                self.graph.update_edge(u, v, ());
            }
        }
    }

    fn ensure(&mut self, id: String) -> NodeIndex {
        if let Some(&i) = self.index.get(&id) {
            return i;
        }
        let i = self.graph.add_node(id.clone());
        self.index.insert(id, i);
        i
    }

    pub fn contains(&self, id: &str) -> bool {
        self.index.contains_key(id)
    }

    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }

    /// 后向引用：patent 引用了哪些文献（出边方向）
    pub fn backward(&self, id: &str) -> Vec<String> {
        let Some(&u) = self.index.get(id) else {
            return Vec::new();
        };
        self.graph
            .neighbors(u)
            .map(|n| self.graph[n].clone())
            .collect()
    }

    /// 前向引用：哪些专利引用了 patent（入边方向）
    pub fn forward(&self, id: &str) -> Vec<String> {
        let Some(&u) = self.index.get(id) else {
            return Vec::new();
        };
        self.graph
            .neighbors_directed(u, Direction::Incoming)
            .map(|n| self.graph[n].clone())
            .collect()
    }

    /// 双向 BFS：返回 depth 跳以内可达节点（不含自身）
    pub fn reachable(&self, id: &str, depth: usize, direction: Direction) -> Vec<String> {
        let Some(&start) = self.index.get(id) else {
            return Vec::new();
        };
        let mut visited: HashSet<NodeIndex> = HashSet::new();
        visited.insert(start);
        let mut frontier: Vec<NodeIndex> = vec![start];
        let mut result: Vec<String> = Vec::new();
        for _ in 0..depth {
            let mut next: Vec<NodeIndex> = Vec::new();
            for &u in &frontier {
                for v in self.graph.neighbors_directed(u, direction) {
                    if visited.insert(v) {
                        result.push(self.graph[v].clone());
                        next.push(v);
                    }
                }
            }
            if next.is_empty() {
                break;
            }
            frontier = next;
        }
        result
    }

    /// PageRank 计算（含悬空节点处理）
    pub fn pagerank(&self, damping: f64, iterations: usize) -> Vec<(String, f64)> {
        let n = self.graph.node_count();
        if n == 0 {
            return Vec::new();
        }
        let nf = n as f64;
        let indices: Vec<NodeIndex> = self.graph.node_indices().collect();
        let mut pr: HashMap<NodeIndex, f64> = indices.iter().map(|&i| (i, 1.0 / nf)).collect();

        for _ in 0..iterations {
            let mut new_pr: HashMap<NodeIndex, f64> =
                indices.iter().map(|&i| (i, (1.0 - damping) / nf)).collect();
            let mut dangling_sum = 0.0f64;
            for &u in &indices {
                let out: Vec<NodeIndex> = self.graph.neighbors(u).collect();
                if out.is_empty() {
                    dangling_sum += pr[&u];
                } else {
                    let share = pr[&u] / out.len() as f64;
                    for v in out {
                        *new_pr.get_mut(&v).unwrap() += damping * share;
                    }
                }
            }
            let dangling_share = damping * dangling_sum / nf;
            for &v in &indices {
                *new_pr.get_mut(&v).unwrap() += dangling_share;
            }
            pr = new_pr;
        }

        let mut ranked: Vec<(String, f64)> = indices
            .iter()
            .map(|&i| (self.graph[i].clone(), pr[&i]))
            .collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        ranked
    }

    /// 专利池边界：源点（无入边，最新专利）与汇点（无出边，基础专利）
    pub fn pool_boundary(&self) -> (Vec<String>, Vec<String>) {
        let mut sources = Vec::new();
        let mut sinks = Vec::new();
        for i in self.graph.node_indices() {
            let indeg = self.graph.neighbors_directed(i, Direction::Incoming).count();
            let outdeg = self.graph.neighbors(i).count();
            if indeg == 0 {
                sources.push(self.graph[i].clone());
            }
            if outdeg == 0 {
                sinks.push(self.graph[i].clone());
            }
        }
        sources.sort();
        sinks.sort();
        (sources, sinks)
    }

    /// 邻接表
    pub fn adjacency_list(&self) -> Vec<(String, Vec<String>)> {
        let mut out: Vec<(String, Vec<String>)> = Vec::new();
        for i in self.graph.node_indices() {
            let mut nbrs: Vec<String> = self
                .graph
                .neighbors(i)
                .map(|n| self.graph[n].clone())
                .collect();
            nbrs.sort();
            out.push((self.graph[i].clone(), nbrs));
        }
        out.sort_by(|a, b| a.0.cmp(&b.0));
        out
    }

    /// 综合分析
    pub fn analyze(&self, damping: f64, iterations: usize, top_n: usize) -> GraphAnalysis {
        let ranked = self.pagerank(damping, iterations);
        let core = ranked.iter().take(top_n).cloned().collect::<Vec<_>>();
        let (sources, sinks) = self.pool_boundary();
        GraphAnalysis {
            node_count: self.node_count(),
            edge_count: self.edge_count(),
            pagerank: ranked,
            core_patents: core,
            sources,
            sinks,
            adjacency: self.adjacency_list(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Citation, SourceFormat};

    fn patent(id: &str, cites: &[&str]) -> Patent {
        let mut p = Patent::new(id, SourceFormat::Unknown);
        p.citations = cites
            .iter()
            .map(|c| Citation::patent(*c))
            .collect();
        p
    }

    #[test]
    fn builds_edges_and_directions() {
        // P1 cites P2, P1 cites P3, P3 cites P2
        let patents = vec![
            patent("P1", &["P2", "P3"]),
            patent("P3", &["P2"]),
        ];
        let g = CitationGraph::from_patents(&patents);
        assert_eq!(g.node_count(), 3);
        assert_eq!(g.edge_count(), 3);
        // P2 is cited by P1 and P3 → forward(P2) = [P1, P3]
        let mut fwd = g.forward("P2");
        fwd.sort();
        assert_eq!(fwd, vec!["P1".to_string(), "P3".to_string()]);
        // backward(P1) = [P2, P3]
        let mut bw = g.backward("P1");
        bw.sort();
        assert_eq!(bw, vec!["P2".to_string(), "P3".to_string()]);
    }

    #[test]
    fn pagerank_ranks_highly_cited() {
        let patents = vec![
            patent("P1", &["P3"]),
            patent("P2", &["P3"]),
            patent("P3", &[]),
        ];
        let g = CitationGraph::from_patents(&patents);
        let ranked = g.pagerank(0.85, 100);
        // P3 被引最多，应排第一
        assert_eq!(ranked[0].0, "P3");
        assert!(ranked[0].1 > ranked[1].1);
    }

    #[test]
    fn pool_boundary_sources_sinks() {
        let patents = vec![
            patent("P1", &["P2"]),
            patent("P2", &["P3"]),
            patent("P3", &[]),
        ];
        let g = CitationGraph::from_patents(&patents);
        let (sources, sinks) = g.pool_boundary();
        assert_eq!(sources, vec!["P1".to_string()]);
        assert!(sinks.contains(&"P3".to_string()));
    }

    #[test]
    fn incremental_merge() {
        let mut g = CitationGraph::new();
        g.add_patents(&[patent("P1", &["P2"])]);
        g.add_patents(&[patent("P3", &["P2"])]);
        assert_eq!(g.node_count(), 3);
        let mut fwd = g.forward("P2");
        fwd.sort();
        assert_eq!(fwd, vec!["P1", "P3"]);
    }

    #[test]
    fn reachable_bidirectional() {
        let patents = vec![
            patent("P1", &["P2"]),
            patent("P2", &["P3"]),
            patent("P3", &["P4"]),
        ];
        let g = CitationGraph::from_patents(&patents);
        let fwd = g.reachable("P1", 2, Direction::Outgoing);
        assert!(fwd.contains(&"P2".to_string()));
        assert!(fwd.contains(&"P3".to_string()));
        assert!(!fwd.contains(&"P4".to_string()));
        let bwd = g.reachable("P4", 3, Direction::Incoming);
        assert!(bwd.contains(&"P1".to_string()));
    }
}
