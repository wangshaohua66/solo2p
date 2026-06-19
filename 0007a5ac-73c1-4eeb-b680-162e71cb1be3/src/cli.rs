use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(
    name = "dns-sec",
    version = "1.0.0",
    about = "DNS安全监测与应急响应工具",
    long_about = "省级网络信息安全应急处置中心DNS安全监测工具\n\
                   支持DNS隧道检测、威胁情报聚合、批量溯源、历史回溯等功能",
    author = "DNS Security Team",
    help_template = "{before-help}{name} {version}\n\
                     {author-with-newline}{about-with-newline}\n\
                     {usage-heading} {usage}\n\
                     \n{all-args}{after-help}",
)]
pub struct Cli {
    #[arg(short, long, global = true, help = "配置文件路径")]
    pub config: Option<PathBuf>,

    #[arg(short, long, global = true, help = "详细输出模式", default_value_t = false)]
    pub verbose: bool,

    #[arg(short, long, global = true, help = "安静模式，只输出错误", default_value_t = false)]
    pub quiet: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    #[command(
        name = "import",
        about = "导入DNS日志文件",
        long_about = "支持BIND、Unbound、Windows Server DNS三种格式自动识别\n\
                      增量导入时记录偏移量避免重复\n\
                      大文件采用流式解析控制内存占用",
        after_help = "示例:\n  \
                      dns-sec import -f /var/log/named/query.log\n  \
                      dns-sec import -d /var/log/dns/ --format bind\n  \
                      dns-sec import -f query.log --incremental"
    )]
    Import {
        #[arg(short, long, help = "日志文件路径")]
        file: Option<PathBuf>,

        #[arg(short, long, help = "日志目录路径（批量导入）")]
        directory: Option<PathBuf>,

        #[arg(short, long, value_enum, help = "日志格式（默认自动识别）")]
        format: Option<LogFormat>,

        #[arg(short, long, help = "增量导入模式", default_value_t = false)]
        incremental: bool,

        #[arg(short, long, help = "批处理大小", default_value_t = 10000)]
        batch_size: usize,
    },

    #[command(
        name = "log-analyze",
        about = "分析DNS日志并检测隧道攻击",
        long_about = "实现三重检测算法：\n\
                      1. TXT记录载荷熵值分析\n\
                      2. 单域名查询频率统计\n\
                      3. 子域名长度与熵值分析\n\
                      输出0-100的风险评分",
        after_help = "示例:\n  \
                      dns-sec log-analyze -f query.log\n  \
                      dns-sec log-analyze --time-start 2024-01-01 --time-end 2024-01-02\n  \
                      dns-sec log-analyze --min-score 70 --output report.json"
    )]
    LogAnalyze {
        #[arg(short, long, help = "日志文件路径（不指定则分析数据库中所有记录）")]
        file: Option<PathBuf>,

        #[arg(long, help = "分析开始时间 (格式: YYYY-MM-DD HH:MM:SS)")]
        time_start: Option<String>,

        #[arg(long, help = "分析结束时间 (格式: YYYY-MM-DD HH:MM:SS)")]
        time_end: Option<String>,

        #[arg(short, long, help = "最低风险评分阈值 (0-100)", default_value_t = 30)]
        min_score: u8,

        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,

        #[arg(short = 't', long, value_enum, help = "输出格式", default_value = "table")]
        output_format: OutputFormat,

        #[arg(long, help = "启用威胁情报比对", default_value_t = false)]
        with_intel: bool,
    },

    #[command(
        name = "monitor",
        about = "实时监控DNS日志目录",
        long_about = "守护进程模式持续监控指定目录的新日志文件\n\
                      检测到可疑行为立即输出告警\n\
                      可选执行外部脚本进行联动处置",
        after_help = "示例:\n  \
                      dns-sec monitor -d /var/log/dns/\n  \
                      dns-sec monitor --alert-script /usr/local/bin/alert.sh\n  \
                      dns-sec monitor --daemon"
    )]
    Monitor {
        #[arg(short, long, help = "监控目录路径")]
        directory: Option<PathBuf>,

        #[arg(long, help = "告警脚本路径")]
        alert_script: Option<PathBuf>,

        #[arg(short, long, help = "后台守护进程模式", default_value_t = false)]
        daemon: bool,

        #[arg(short, long, help = "检查间隔（秒）", default_value_t = 10)]
        interval: u64,

        #[arg(long, help = "告警阈值 (风险评分)", default_value_t = 50)]
        alert_threshold: u8,
    },

    #[command(
        name = "report",
        about = "生成安全分析报告",
        long_about = "支持Markdown、HTML、JSON三种格式\n\
                      包含检测统计、风险域名列表、溯源结果、趋势图表数据",
        after_help = "示例:\n  \
                      dns-sec report -f markdown -o report.md\n  \
                      dns-sec report --format html --time-range 7d\n  \
                      dns-sec report --with-whois --top 50"
    )]
    Report {
        #[arg(short, long, value_enum, help = "报告格式", default_value = "markdown")]
        format: ReportFormat,

        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,

        #[arg(long, help = "报告时间范围 (如: 24h, 7d, 30d)", default_value = "24h")]
        time_range: String,

        #[arg(long, help = "包含WHOIS溯源信息", default_value_t = false)]
        with_whois: bool,

        #[arg(long, help = "Top N 风险域名", default_value_t = 20)]
        top: usize,

        #[arg(long, help = "包含威胁情报数据", default_value_t = false)]
        with_intel: bool,
    },

    #[command(
        name = "whois",
        about = "批量查询域名WHOIS信息",
        long_about = "并发查询WHOIS信息，提取注册人、注册商、注册时间、过期时间\n\
                      支持注册时间<30天的新域名高亮标记\n\
                      本地缓存提高查询效率",
        after_help = "示例:\n  \
                      dns-sec whois -d example.com\n  \
                      dns-sec whois -f domains.txt\n  \
                      dns-sec whois -f domains.txt -c 50 --highlight-new"
    )]
    Whois {
        #[arg(short, long, help = "单个域名查询")]
        domain: Option<String>,

        #[arg(short, long, help = "域名列表文件（每行一个域名）")]
        file: Option<PathBuf>,

        #[arg(short, long, help = "并发连接数", default_value_t = 50)]
        concurrency: usize,

        #[arg(long, help = "高亮标记注册时间<30天的新域名", default_value_t = false)]
        highlight_new: bool,

        #[arg(short, long, value_enum, help = "输出格式", default_value = "table")]
        output_format: OutputFormat,

        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,

        #[arg(long, help = "不使用缓存", default_value_t = false)]
        no_cache: bool,
    },

    #[command(
        name = "intel",
        about = "威胁情报查询与管理",
        long_about = "对接VirusTotal、AlienVault OTX、威胁猎人三个API\n\
                      统一转换为内部域名黑名单格式\n\
                      支持TTL过期自动刷新",
        after_help = "示例:\n  \
                      dns-sec intel -d malicious.com\n  \
                      dns-sec intel --refresh\n  \
                      dns-sec intel --list --source virustotal"
    )]
    Intel {
        #[arg(short, long, help = "查询单个域名的威胁情报")]
        domain: Option<String>,

        #[arg(short, long, help = "刷新所有威胁情报缓存", default_value_t = false)]
        refresh: bool,

        #[arg(long, help = "列出所有缓存的威胁情报", default_value_t = false)]
        list: bool,

        #[arg(long, value_enum, help = "指定情报来源")]
        source: Option<IntelSource>,

        #[arg(long, help = "统计信息", default_value_t = false)]
        stats: bool,
    },

    #[command(
        name = "lookup",
        about = "DNS解析查询",
        long_about = "递归DNS解析与记录类型扩展\n\
                      支持A、AAAA、CNAME、MX、TXT、NS、SOA等记录类型",
        after_help = "示例:\n  \
                      dns-sec lookup -d example.com -t A\n  \
                      dns-sec lookup -d example.com --all\n  \
                      dns-sec lookup -f domains.txt"
    )]
    Lookup {
        #[arg(short, long, help = "要查询的域名")]
        domain: Option<String>,

        #[arg(short, long, help = "域名列表文件")]
        file: Option<PathBuf>,

        #[arg(short = 't', long, value_enum, help = "记录类型", default_value = "a")]
        record_type: RecordType,

        #[arg(long, help = "查询所有记录类型", default_value_t = false)]
        all: bool,

        #[arg(short, long, value_enum, help = "输出格式", default_value = "table")]
        output_format: OutputFormat,

        #[arg(long, help = "递归深度", default_value_t = 5)]
        recursion_depth: u8,
    },

    #[command(
        name = "trace",
        about = "历史回溯与关联分析",
        long_about = "按域名/IP/时间范围组合查询历史DNS记录\n\
                      输出关联图谱展示域名解析链路\n\
                      支持导出CSV和JSON两种格式",
        after_help = "示例:\n  \
                      dns-sec trace -d example.com\n  \
                      dns-sec trace --ip 192.168.1.1 --time-start 2024-01-01\n  \
                      dns-sec trace -d example.com --graph -o graph.json"
    )]
    Trace {
        #[arg(short, long, help = "按域名查询")]
        domain: Option<String>,

        #[arg(long, help = "按IP地址查询")]
        ip: Option<String>,

        #[arg(long, help = "开始时间")]
        time_start: Option<String>,

        #[arg(long, help = "结束时间")]
        time_end: Option<String>,

        #[arg(short, long, help = "生成关联图谱", default_value_t = false)]
        graph: bool,

        #[arg(short, long, value_enum, help = "输出格式", default_value = "table")]
        output_format: OutputFormat,

        #[arg(short, long, help = "输出文件路径")]
        output: Option<PathBuf>,

        #[arg(long, help = "最大结果数", default_value_t = 1000)]
        limit: usize,
    },

    #[command(
        name = "config",
        about = "配置管理",
        long_about = "管理TOML配置文件\n\
                      支持设置威胁情报API密钥、检测阈值、白名单等参数",
        after_help = "示例:\n  \
                      dns-sec config --show\n  \
                      dns-sec config --init\n  \
                      dns-sec config --set virustotal_api_key=your_key"
    )]
    Config {
        #[arg(long, help = "初始化默认配置文件", default_value_t = false)]
        init: bool,

        #[arg(long, help = "显示当前配置", default_value_t = false)]
        show: bool,

        #[arg(long, help = "配置文件路径")]
        path: bool,

        #[arg(long, help = "设置配置项 (key=value格式)")]
        set: Option<String>,

        #[arg(long, help = "添加白名单域名")]
        add_whitelist: Option<String>,

        #[arg(long, help = "移除白名单域名")]
        remove_whitelist: Option<String>,

        #[arg(long, help = "列出示例配置", default_value_t = false)]
        example: bool,
    },
}

#[derive(ValueEnum, Debug, Clone, Copy)]
pub enum LogFormat {
    Bind,
    Unbound,
    Windows,
    Auto,
}

#[derive(ValueEnum, Debug, Clone, Copy)]
pub enum OutputFormat {
    Table,
    Json,
    Csv,
}

#[derive(ValueEnum, Debug, Clone, Copy)]
pub enum ReportFormat {
    Markdown,
    Html,
    Json,
}

#[derive(ValueEnum, Debug, Clone, Copy)]
pub enum IntelSource {
    Virustotal,
    Alienvault,
    Threatbook,
    All,
}

#[derive(ValueEnum, Debug, Clone, Copy)]
pub enum RecordType {
    A,
    Aaaa,
    Cname,
    Mx,
    Txt,
    Ns,
    Soa,
    Srv,
    All,
}
