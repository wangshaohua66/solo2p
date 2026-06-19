use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::models::SourceFormat;

/// patent-analyzer：专利文献解析、引用图谱分析与侵权比对工具
#[derive(Debug, Parser)]
#[command(
    name = "patent-analyzer",
    about = "专利权利要求解析 / 引用图谱分析 / 侵权比对命令行工具",
    version,
    author
)]
pub struct Cli {
    /// TOML 配置文件路径（命令行参数优先级高于配置文件）
    #[arg(short = 'c', long = "config", global = true)]
    pub config: Option<PathBuf>,

    /// 增加日志详细程度：-v=info, -vv=debug, -vvv=trace
    #[arg(short = 'v', long = "verbose", action = clap::ArgAction::Count, global = true)]
    pub verbose: u8,

    /// 静默模式：仅输出错误日志
    #[arg(short = 'q', long = "quiet", global = true)]
    pub quiet: bool,

    /// 输出格式：json 或 text
    #[arg(long = "format", value_parser = ["json", "text"], global = true)]
    pub format: Option<String>,

    /// 禁用终端彩色输出
    #[arg(long = "no-color", global = true)]
    pub no_color: bool,

    /// 输出路径（文件或目录），不指定则输出到 stdout
    #[arg(short = 'o', long = "output", global = true)]
    pub output: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// 1) 专利导入与解析：批量导入 CNIPA / WIPO XML，输出解析缓存
    Import(ImportCmd),
    /// 2) 权利要求树构建：解析从属引用，检测循环与断链
    Tree(TreeCmd),
    /// 3) 引用图谱分析：PageRank 识别核心基础专利，双向引用查询
    Graph(GraphCmd),
    /// 4) 特征比对与侵权判定：全面覆盖 + 等同原则两级判定
    Compare(CompareCmd),
    /// 5) 比对报告生成：结构化报告与图谱可视化数据
    Report(ReportCmd),
    /// 6) 配置管理：初始化、查看、校验配置
    Config(ConfigCmd),
}

#[derive(Debug, Parser)]
pub struct ImportCmd {
    /// 待导入的 XML 文件或目录
    #[arg(value_name = "INPUT")]
    pub input: PathBuf,

    /// 递归扫描目录
    #[arg(short = 'r', long = "recursive")]
    pub recursive: bool,

    /// 解析缓存输出路径（JSON），默认 patents.json
    #[arg(short = 'p', long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 增量合并到已有缓存，避免全量重建
    #[arg(short = 'm', long = "merge")]
    pub merge: bool,

    /// 强制指定 XML 格式（默认自动识别）
    #[arg(long = "force-format", value_parser = ["cnipa", "wipo"])]
    pub force_format: Option<String>,

    /// 按分类号前缀过滤（如 G06F）
    #[arg(long = "filter-class")]
    pub filter_class: Option<String>,

    /// 按申请人包含字符串过滤
    #[arg(long = "filter-applicant")]
    pub filter_applicant: Option<String>,

    /// 起始日期（YYYY-MM-DD），按申请日过滤
    #[arg(long = "filter-from")]
    pub filter_from: Option<String>,

    /// 截止日期（YYYY-MM-DD）
    #[arg(long = "filter-to")]
    pub filter_to: Option<String>,
}

#[derive(Debug, Parser)]
pub struct TreeCmd {
    /// 解析缓存文件路径
    #[arg(short = 'p', long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 直接解析单个 XML 文件（与 --cache 二选一）
    #[arg(long = "patent-file")]
    pub patent_file: Option<PathBuf>,

    /// 指定专利号（缓存含多件专利时）
    #[arg(long = "patent-id")]
    pub patent_id: Option<String>,

    /// 仅展开指定权利要求编号的子树
    #[arg(long = "claim")]
    pub claim: Option<String>,

    /// 是否在树中递归展开从属权利要求全文
    #[arg(long = "expand-text")]
    pub expand_text: bool,
}

#[derive(Debug, Parser)]
pub struct GraphCmd {
    /// 解析缓存文件路径
    #[arg(short = 'p', long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 聚焦专利号，查询其前向/后向引用
    #[arg(long = "patent-id")]
    pub patent_id: Option<String>,

    /// 引用方向：forward（被引用）/ backward（引用他人）/ both
    #[arg(long = "direction", value_parser = ["forward", "backward", "both"], default_value = "both")]
    pub direction: String,

    /// 双向查询遍历深度
    #[arg(long = "depth", default_value = "2")]
    pub depth: usize,

    /// PageRank 核心 Top-N
    #[arg(long = "top", default_value = "10")]
    pub top: usize,

    /// 输出邻接表到文件（可选）
    #[arg(long = "adjacency-out")]
    pub adjacency_out: Option<PathBuf>,
}

#[derive(Debug, Parser)]
pub struct CompareCmd {
    /// 解析缓存文件路径
    #[arg(short = 'p', long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 目标技术方案文件（文本或 JSON 特征列表）
    #[arg(long = "target")]
    pub target: PathBuf,

    /// 参与比对的专利号列表（不指定则使用缓存中全部独立权利要求）
    #[arg(long = "patents")]
    pub patents: Vec<String>,

    /// 仅比对指定权利要求编号（默认比对各件独立权利要求）
    #[arg(long = "claim")]
    pub claim: Option<String>,

    /// 禁用等同原则，仅做字面全面覆盖判定
    #[arg(long = "literal-only")]
    pub literal_only: bool,
}

#[derive(Debug, Parser)]
pub struct ReportCmd {
    /// 解析缓存文件路径
    #[arg(short = 'p', long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 目标技术方案文件
    #[arg(long = "target")]
    pub target: PathBuf,

    /// 参与比对的专利号列表
    #[arg(long = "patents")]
    pub patents: Vec<String>,

    /// 报告输出路径（不指定则输出到 stdout）
    #[arg(short = 'o', long = "output")]
    pub output: Option<PathBuf>,

    /// 报告格式：json 或 text
    #[arg(long = "report-format", value_parser = ["json", "text"])]
    pub report_format: Option<String>,
}

#[derive(Debug, Parser)]
pub struct ConfigCmd {
    /// 写入默认配置到 ./config.toml
    #[arg(long = "init")]
    pub init: bool,

    /// 打印当前生效配置
    #[arg(long = "show")]
    pub show: bool,

    /// 打印配置文件路径
    #[arg(long = "path")]
    pub path: bool,
}

impl Cli {
    /// 解析 SourceFormat 字符串
    pub fn parse_source_format(s: &str) -> SourceFormat {
        match s.to_ascii_lowercase().as_str() {
            "cnipa" => SourceFormat::Cnipa,
            "wipo" => SourceFormat::Wipo,
            _ => SourceFormat::Unknown,
        }
    }
}
