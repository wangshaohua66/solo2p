// 该二进制对外暴露的公共 API（解析器/分析器/模型）仅在测试或子命令中间使用，
// 关闭 dead_code 告警以保留完整可复用接口。
#![allow(dead_code)]

mod analyzer;
mod cli;
mod config;
mod models;
mod parser;
mod report;
mod util;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use indicatif::{ProgressBar, ProgressStyle};
use log::LevelFilter;
use serde_json::Value;
use structopt::StructOpt;

use crate::analyzer::{CitationGraph, InfringementAnalyzer};
use crate::cli::{Cli, Command, ConfigCmd, GraphCmd, ImportCmd, TreeCmd};
use crate::config::{CliOverrides, Settings};
use crate::models::{Feature, Patent};
use crate::parser::XmlParser;
use crate::report::ReportGenerator;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::from_args();
    let settings = load_settings(&cli)?;
    init_logger(&cli, &settings);

    match &cli.command {
        Command::Import(c) => run_import(c, &settings).await,
        Command::Tree(c) => run_tree(c, &settings, &cli),
        Command::Graph(c) => run_graph(c, &settings, &cli),
        Command::Compare(c) => run_compare(c, &settings, &cli).await,
        Command::Report(c) => run_report(c, &settings, &cli).await,
        Command::Config(c) => run_config(c, &cli),
    }
}

fn load_settings(cli: &Cli) -> Result<Settings> {
    let path = cli
        .config
        .clone()
        .or_else(|| PathBuf::from("config.toml").exists().then(|| PathBuf::from("config.toml")));
    let mut settings = match path {
        Some(p) => Settings::load_from_file(&p)?,
        None => Settings::default(),
    };
    let level = if cli.quiet {
        Some("error".to_string())
    } else {
        match cli.verbose {
            0 => None,
            1 => Some("info".into()),
            2 => Some("debug".into()),
            _ => Some("trace".into()),
        }
    };
    let overrides = CliOverrides {
        format: cli.format.clone(),
        color: if cli.no_color { Some(false) } else { None },
        log_level: level,
        strict: None,
        output_path: cli.output.clone(),
    };
    settings.apply_overrides(overrides);
    Ok(settings)
}

fn init_logger(cli: &Cli, settings: &Settings) {
    let level = if cli.quiet {
        LevelFilter::Error
    } else {
        match cli.verbose {
            0 => settings.log_level_filter(),
            1 => LevelFilter::Info,
            2 => LevelFilter::Debug,
            _ => LevelFilter::Trace,
        }
    };
    let mut builder = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(""));
    builder.filter_level(level);
    let _ = builder.try_init();
}

// ===== import =====

async fn run_import(cmd: &ImportCmd, settings: &Settings) -> Result<()> {
    let files = collect_xml_files(&cmd.input, cmd.recursive)?;
    if files.is_empty() {
        return Err(anyhow!("未找到任何 XML 文件: {}", cmd.input.display()));
    }
    log::info!("待导入文件 {} 个", files.len());

    let mut existing: Vec<Patent> = if cmd.merge {
        load_cache(&cmd.cache).unwrap_or_default()
    } else {
        Vec::new()
    };
    let by_id: std::collections::HashSet<String> =
        existing.iter().map(|p| p.id.clone()).collect();

    let parser = XmlParser::new(settings.parsing.strict);
    let total = files.len();

    let pb = make_progress_bar(total as u64, "导入专利 XML");
    let mut added = 0usize;
    let mut errors = 0usize;
    for file in &files {
        pb.set_message(file.display().to_string());
        match parser.parse_file(file) {
            Ok(outcome) => {
                let mut patent = outcome.patent;
                if patent.id.is_empty() {
                    patent.id = file
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("UNKNOWN")
                        .to_string();
                }
                if let Some(fmt) = &cmd.force_format {
                    patent.source_format = Cli::parse_source_format(fmt);
                }
                if !passes_filters(&patent, cmd) {
                    pb.inc(1);
                    continue;
                }
                for d in &outcome.diagnostics {
                    log::warn!("{}", d);
                }
                if !by_id.contains(&patent.id) {
                    existing.push(patent);
                    added += 1;
                } else {
                    log::info!("跳过已存在专利: {}", patent.id);
                }
            }
            Err(e) => {
                errors += 1;
                log::error!("解析失败 {}: {}", file.display(), e);
            }
        }
        pb.inc(1);
    }
    pb.finish_with_message(format!("完成：新增 {} 件，失败 {} 件", added, errors));

    save_cache(&cmd.cache, &existing)?;
    println!("缓存已写入: {}（共 {} 件专利）", cmd.cache.display(), existing.len());
    Ok(())
}

fn passes_filters(p: &Patent, cmd: &ImportCmd) -> bool {
    if let Some(cls) = &cmd.filter_class {
        if !p.classifications.iter().any(|c| c.starts_with(cls)) {
            return false;
        }
    }
    if let Some(app) = &cmd.filter_applicant {
        if !p.applicants.iter().any(|a| a.contains(app)) {
            return false;
        }
    }
    if let Some(from) = &cmd.filter_from {
        if p.filing_date.as_deref().map(|d| d < from.as_str()).unwrap_or(true) {
            return false;
        }
    }
    if let Some(to) = &cmd.filter_to {
        if p.filing_date.as_deref().map(|d| d > to.as_str()).unwrap_or(true) {
            return false;
        }
    }
    true
}

// ===== tree =====

fn run_tree(cmd: &TreeCmd, settings: &Settings, cli: &Cli) -> Result<()> {
    let patent = select_patent(cmd.cache.as_path(), cmd.patent_file.as_deref(), cmd.patent_id.as_deref())?;
    let generator = ReportGenerator::new(&settings.output);
    let text = generator.render_claim_tree(&patent, cmd.expand_text);
    write_output(&text, cli.output.as_deref())?;
    if let Some(claim_no) = &cmd.claim {
        if let Some(c) = patent.claim_by_number(claim_no) {
            let tree = parser::ClaimTree::build(&patent);
            let eff = tree.effective_text(&patent, claim_no);
            let block = format!("\n权利要求{} 有效全文:\n{}\n", c.number, eff);
            write_output(&block, None)?;
        } else {
            log::warn!("未找到权利要求 {}", claim_no);
        }
    }
    Ok(())
}

// ===== graph =====

fn run_graph(cmd: &GraphCmd, settings: &Settings, cli: &Cli) -> Result<()> {
    let patents = load_cache(&cmd.cache)?;
    let graph = CitationGraph::from_patents(&patents);
    let generator = ReportGenerator::new(&settings.output);

    if let Some(id) = &cmd.patent_id {
        let mut out = String::new();
        out.push_str(&format!("专利 {} 引用查询（深度 {}）:\n", id, cmd.depth));
        if cmd.direction == "backward" || cmd.direction == "both" {
            let bw = graph.backward(id);
            out.push_str(&format!("  后向引用（本专利引用他人）: {}\n", fmt_list(&bw)));
            let reachable = graph.reachable(id, cmd.depth, petgraph::Direction::Outgoing);
            out.push_str(&format!("  后向可达（深度{}）: {}\n", cmd.depth, fmt_list(&reachable)));
        }
        if cmd.direction == "forward" || cmd.direction == "both" {
            let fwd = graph.forward(id);
            out.push_str(&format!("  前向引用（被他人引用）: {}\n", fmt_list(&fwd)));
            let reachable = graph.reachable(id, cmd.depth, petgraph::Direction::Incoming);
            out.push_str(&format!("  前向可达（深度{}）: {}\n", cmd.depth, fmt_list(&reachable)));
        }
        write_output(&out, cli.output.as_deref())?;
        return Ok(());
    }

    let analysis = graph.analyze(
        settings.graph.damping,
        settings.graph.iterations,
        cmd.top,
    );
    let text = generator.render_graph(&analysis);
    write_output(&text, cli.output.as_deref())?;

    if let Some(adj_out) = &cmd.adjacency_out {
        let json = serde_json::to_string_pretty(&analysis.adjacency)?;
        fs::write(adj_out, json).with_context(|| format!("写入邻接表失败: {}", adj_out.display()))?;
        println!("邻接表已写入: {}", adj_out.display());
    }
    Ok(())
}

// ===== compare =====

async fn run_compare(cmd: &cli::CompareCmd, settings: &Settings, cli: &Cli) -> Result<()> {
    let patents = load_cache(&cmd.cache)?;
    let selected = select_patents(&patents, &cmd.patents);
    let (desc, target) = load_target(&cmd.target)?;
    let mut comp = settings.comparison.clone();
    if cmd.literal_only {
        comp.equivalence = false;
    }
    let analyzer = InfringementAnalyzer::new(comp);
    let features = match target {
        Target::Features(mut f) => {
            for feat in &mut f {
                if feat.keywords.is_empty() {
                    feat.keywords = crate::analyzer::keywords(&feat.text);
                }
            }
            f
        }
        Target::Text(t) => analyzer.split_features(&t, "T"),
    };
    let pb = make_progress_bar(selected.len() as u64, "侵权比对");
    let report = analyzer.compare_patents_cb(&selected, &desc, &features, cmd.claim.as_deref(), |p| {
        pb.set_message(p.id.clone());
        pb.inc(1);
    });
    pb.finish_and_clear();
    output_comparison(&report, settings, cli.output.as_deref(), cli.format.as_deref())
}

// ===== report =====

async fn run_report(cmd: &cli::ReportCmd, settings: &Settings, cli: &Cli) -> Result<()> {
    let patents = load_cache(&cmd.cache)?;
    let selected = select_patents(&patents, &cmd.patents);
    let (desc, target) = load_target(&cmd.target)?;
    let analyzer = InfringementAnalyzer::new(settings.comparison.clone());
    let features = match target {
        Target::Features(mut f) => {
            for feat in &mut f {
                if feat.keywords.is_empty() {
                    feat.keywords = crate::analyzer::keywords(&feat.text);
                }
            }
            f
        }
        Target::Text(t) => analyzer.split_features(&t, "T"),
    };
    let pb = make_progress_bar(selected.len() as u64, "生成比对报告");
    let report = analyzer.compare_patents_cb(&selected, &desc, &features, None, |p| {
        pb.set_message(p.id.clone());
        pb.inc(1);
    });
    pb.finish_and_clear();
    let generator = ReportGenerator::new(&settings.output);

    let graph = CitationGraph::from_patents(&selected);
    let analysis = graph.analyze(
        settings.graph.damping,
        settings.graph.iterations,
        settings.graph.top_n,
    );

    let fmt = cmd
        .report_format
        .clone()
        .or_else(|| cli.format.clone())
        .unwrap_or_else(|| settings.output.format.clone());

    let content = match fmt.as_str() {
        "json" => {
            let combined = serde_json::json!({
                "comparison": &report,
                "graph": {
                    "node_count": analysis.node_count,
                    "edge_count": analysis.edge_count,
                    "core_patents": analysis.core_patents,
                    "sources": analysis.sources,
                    "sinks": analysis.sinks,
                },
                "claim_trees": selected.iter().map(|p| {
                    let tree = parser::ClaimTree::build(p);
                    (p.id.clone(), tree.render(p, false))
                }).collect::<std::collections::BTreeMap<_, _>>(),
            });
            serde_json::to_string_pretty(&combined)?
        }
        _ => {
            let mut out = String::new();
            out.push_str(&generator.patent_summary(&selected));
            out.push('\n');
            for p in &selected {
                out.push_str(&generator.render_claim_tree(p, false));
            }
            out.push('\n');
            out.push_str(&generator.render_graph(&analysis));
            out.push('\n');
            out.push_str(&generator.render_comparison(&report));
            out
        }
    };
    write_output(&content, cmd.output.as_deref().or(cli.output.as_deref()))?;
    Ok(())
}

fn output_comparison(
    report: &crate::models::ComparisonReport,
    settings: &Settings,
    output: Option<&Path>,
    format: Option<&str>,
) -> Result<()> {
    let generator = ReportGenerator::new(&settings.output);
    let fmt = format.unwrap_or(&settings.output.format);
    let content = match fmt {
        "json" => generator.to_json(report),
        _ => generator.render_comparison(report),
    };
    write_output(&content, output)
}

// ===== config =====

fn run_config(cmd: &ConfigCmd, cli: &Cli) -> Result<()> {
    if cmd.init {
        let path = PathBuf::from("config.toml");
        fs::write(&path, Settings::default_toml())
            .with_context(|| format!("写入配置文件失败: {}", path.display()))?;
        println!("默认配置已写入: {}", path.display());
        return Ok(());
    }
    let settings = load_settings(cli)?;
    if cmd.path {
        match &settings.source {
            Some(p) => println!("配置文件: {}", p.display()),
            None => println!("配置文件: （使用默认配置，无文件）"),
        }
        return Ok(());
    }
    if cmd.show || true {
        println!("{}", toml::to_string_pretty(&settings).unwrap_or_default());
    }
    Ok(())
}

// ===== 辅助函数 =====

fn collect_xml_files(input: &Path, recursive: bool) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    if input.is_file() {
        out.push(input.to_path_buf());
        return Ok(out);
    }
    if !input.is_dir() {
        return Err(anyhow!("路径不存在或既非文件也非目录: {}", input.display()));
    }
    walk_dir(input, recursive, &mut out);
    out.sort();
    Ok(out)
}

fn walk_dir(dir: &Path, recursive: bool, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if recursive {
                walk_dir(&path, recursive, out);
            }
        } else if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("xml")).unwrap_or(false) {
            out.push(path);
        }
    }
}

fn load_cache(path: &Path) -> Result<Vec<Patent>> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("读取缓存失败: {}", path.display()))?;
    serde_json::from_str::<Vec<Patent>>(&content)
        .with_context(|| format!("解析缓存 JSON 失败: {}", path.display()))
}

fn save_cache(path: &Path, patents: &[Patent]) -> Result<()> {
    let json = serde_json::to_string_pretty(patents)?;
    fs::write(path, json).with_context(|| format!("写入缓存失败: {}", path.display()))
}

fn select_patents(all: &[Patent], ids: &[String]) -> Vec<Patent> {
    if ids.is_empty() {
        return all.to_vec();
    }
    let set: std::collections::HashSet<&String> = ids.iter().collect();
    all.iter().filter(|p| set.contains(&p.id)).cloned().collect()
}

fn select_patent(cache: &Path, file: Option<&Path>, id: Option<&str>) -> Result<Patent> {
    if let Some(f) = file {
        let parser = XmlParser::new(false);
        let outcome = parser.parse_file(f)?;
        return Ok(outcome.patent);
    }
    let patents = load_cache(cache)?;
    if patents.is_empty() {
        return Err(anyhow!("缓存为空: {}", cache.display()));
    }
    if let Some(id) = id {
        return patents
            .into_iter()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow!("缓存中未找到专利: {}", id));
    }
    Ok(patents.into_iter().next().unwrap())
}

enum Target {
    Text(String),
    Features(Vec<Feature>),
}

fn load_target(path: &Path) -> Result<(String, Target)> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("读取目标文件失败: {}", path.display()))?;
    let trimmed = content.trim();
    if trimmed.starts_with('[') {
        if let Ok(features) = serde_json::from_str::<Vec<Feature>>(trimmed) {
            return Ok((path.display().to_string(), Target::Features(features)));
        }
    }
    if trimmed.starts_with('{') {
        if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(trimmed) {
            let desc = map
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if let Some(arr) = map.get("features").and_then(|v| v.as_array()) {
                let mut feats = Vec::new();
                for (i, item) in arr.iter().enumerate() {
                    let text = item
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| {
                            item.get("text")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string())
                        })
                        .unwrap_or_default();
                    feats.push(Feature::new(format!("T{}", i + 1), text));
                }
                let desc = if desc.is_empty() {
                    path.display().to_string()
                } else {
                    desc
                };
                return Ok((desc, Target::Features(feats)));
            }
        }
    }
    Ok((path.display().to_string(), Target::Text(content)))
}

fn fmt_list(items: &[String]) -> String {
    if items.is_empty() {
        "（无）".to_string()
    } else {
        items.join(", ")
    }
}

fn write_output(content: &str, output: Option<&Path>) -> Result<()> {
    match output {
        Some(p) => {
            fs::write(p, content)
                .with_context(|| format!("写入输出文件失败: {}", p.display()))?;
            println!("输出已写入: {}", p.display());
        }
        None => print!("{}", content),
    }
    Ok(())
}

/// 构造带 ETA/百分比/计数的进度条
fn make_progress_bar(total: u64, msg: &str) -> ProgressBar {
    let pb = ProgressBar::new(total);
    let style = ProgressStyle::default_bar()
        .template("{prefix:.bold.dim} {spinner} [{elapsed_precise}] [{wide_bar:.cyan/blue}] {pos}/{len} ({eta}) {msg}")
        .unwrap_or_else(|_| ProgressStyle::default_bar())
        .progress_chars("#>-");
    pb.set_style(style);
    pb.set_prefix(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(120));
    pb
}
