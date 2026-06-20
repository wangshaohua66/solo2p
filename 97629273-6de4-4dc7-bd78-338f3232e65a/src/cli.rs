use std::path::PathBuf;

use structopt::StructOpt;

use crate::models::SourceFormat;

/// patent-analyzer：专利权利要求解析 / 引用图谱分析 / 侵权比对命令行工具
#[derive(Debug, StructOpt)]
#[structopt(
    name = "patent-analyzer",
    about = "专利权利要求解析 / 引用图谱分析 / 侵权比对命令行工具",
    author
)]
pub struct Cli {
    /// TOML 配置文件路径（命令行参数优先级高于配置文件）
    #[structopt(short = "c", long = "config", global = true)]
    pub config: Option<PathBuf>,

    /// 增加日志详细程度：-v=info, -vv=debug, -vvv=trace
    #[structopt(short = "v", long = "verbose", parse(from_occurrences), global = true)]
    pub verbose: u8,

    /// 静默模式：仅输出错误日志
    #[structopt(short = "q", long = "quiet", global = true)]
    pub quiet: bool,

    /// 输出格式：json 或 text
    #[structopt(long = "format", possible_values = &["json", "text"], global = true)]
    pub format: Option<String>,

    /// 禁用终端彩色输出
    #[structopt(long = "no-color", global = true)]
    pub no_color: bool,

    /// 输出路径（文件或目录），不指定则输出到 stdout
    #[structopt(short = "o", long = "output", global = true)]
    pub output: Option<PathBuf>,

    #[structopt(subcommand)]
    pub command: Command,
}

#[derive(Debug, StructOpt)]
pub enum Command {
    /// 专利导入与解析：批量导入 CNIPA / WIPO XML，输出解析缓存
    Import(ImportCmd),
    /// 权利要求树构建：解析从属引用，检测循环与断链
    Tree(TreeCmd),
    /// 引用图谱分析：PageRank 识别核心基础专利，双向引用查询
    Graph(GraphCmd),
    /// 特征比对与侵权判定：全面覆盖 + 等同原则两级判定
    Compare(CompareCmd),
    /// 比对报告生成：结构化报告与图谱可视化数据
    Report(ReportCmd),
    /// 配置管理：初始化、查看、校验配置
    Config(ConfigCmd),
}

#[derive(Debug, StructOpt)]
pub struct ImportCmd {
    /// 待导入的 XML 文件或目录
    #[structopt(value_name = "INPUT")]
    pub input: PathBuf,

    /// 递归扫描目录
    #[structopt(short = "r", long = "recursive")]
    pub recursive: bool,

    /// 解析缓存输出路径（JSON），默认 patents.json
    #[structopt(short = "p", long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 增量合并到已有缓存，避免全量重建
    #[structopt(short = "m", long = "merge")]
    pub merge: bool,

    /// 强制指定 XML 格式（默认自动识别）
    #[structopt(long = "force-format", possible_values = &["cnipa", "wipo"])]
    pub force_format: Option<String>,

    /// 按分类号前缀过滤（如 G06F）
    #[structopt(long = "filter-class")]
    pub filter_class: Option<String>,

    /// 按申请人包含字符串过滤
    #[structopt(long = "filter-applicant")]
    pub filter_applicant: Option<String>,

    /// 起始日期（YYYY-MM-DD），按申请日过滤
    #[structopt(long = "filter-from")]
    pub filter_from: Option<String>,

    /// 截止日期（YYYY-MM-DD）
    #[structopt(long = "filter-to")]
    pub filter_to: Option<String>,
}

#[derive(Debug, StructOpt)]
pub struct TreeCmd {
    /// 解析缓存文件路径
    #[structopt(short = "p", long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 直接解析单个 XML 文件（与 --cache 二选一）
    #[structopt(long = "patent-file")]
    pub patent_file: Option<PathBuf>,

    /// 指定专利号（缓存含多件专利时）
    #[structopt(long = "patent-id")]
    pub patent_id: Option<String>,

    /// 仅展开指定权利要求编号的子树
    #[structopt(long = "claim")]
    pub claim: Option<String>,

    /// 是否在树中递归展开从属权利要求全文
    #[structopt(long = "expand-text")]
    pub expand_text: bool,
}

#[derive(Debug, StructOpt)]
pub struct GraphCmd {
    /// 解析缓存文件路径
    #[structopt(short = "p", long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 聚焦专利号，查询其前向/后向引用
    #[structopt(long = "patent-id")]
    pub patent_id: Option<String>,

    /// 引用方向：forward（被引用）/ backward（引用他人）/ both
    #[structopt(long = "direction", possible_values = &["forward", "backward", "both"], default_value = "both")]
    pub direction: String,

    /// 双向查询遍历深度
    #[structopt(long = "depth", default_value = "2")]
    pub depth: usize,

    /// PageRank 核心 Top-N
    #[structopt(long = "top", default_value = "10")]
    pub top: usize,

    /// 输出邻接表到文件（可选）
    #[structopt(long = "adjacency-out")]
    pub adjacency_out: Option<PathBuf>,
}

#[derive(Debug, StructOpt)]
pub struct CompareCmd {
    /// 解析缓存文件路径
    #[structopt(short = "p", long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 目标技术方案文件（文本或 JSON 特征列表）
    #[structopt(long = "target")]
    pub target: PathBuf,

    /// 参与比对的专利号列表（不指定则使用缓存中全部独立权利要求）
    #[structopt(long = "patents", use_delimiter = true)]
    pub patents: Vec<String>,

    /// 仅比对指定权利要求编号（默认比对各件独立权利要求）
    #[structopt(long = "claim")]
    pub claim: Option<String>,

    /// 禁用等同原则，仅做字面全面覆盖判定
    #[structopt(long = "literal-only")]
    pub literal_only: bool,
}

#[derive(Debug, StructOpt)]
pub struct ReportCmd {
    /// 解析缓存文件路径
    #[structopt(short = "p", long = "cache", default_value = "patents.json")]
    pub cache: PathBuf,

    /// 目标技术方案文件
    #[structopt(long = "target")]
    pub target: PathBuf,

    /// 参与比对的专利号列表
    #[structopt(long = "patents", use_delimiter = true)]
    pub patents: Vec<String>,

    /// 报告输出路径（不指定则输出到 stdout）
    #[structopt(short = "o", long = "output")]
    pub output: Option<PathBuf>,

    /// 报告格式：json 或 text
    #[structopt(long = "report-format", possible_values = &["json", "text"])]
    pub report_format: Option<String>,
}

#[derive(Debug, StructOpt)]
pub struct ConfigCmd {
    /// 写入默认配置到 ./config.toml
    #[structopt(long = "init")]
    pub init: bool,

    /// 打印当前生效配置
    #[structopt(long = "show")]
    pub show: bool,

    /// 打印配置文件路径
    #[structopt(long = "path")]
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
