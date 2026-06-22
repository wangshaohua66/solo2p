use structopt::StructOpt;
use chrono::NaiveDate;

#[derive(StructOpt, Debug, Clone)]
#[structopt(
    name = "ship-agent",
    about = "船舶代理港口使费管理系统 | Port Agency Fee Management System",
    version = "1.0.0",
    author = "Ship Agent System"
)]
pub enum Cli {
    #[structopt(
        name = "add",
        about = "录入船舶申报信息",
        long_about = "船舶申报命令：录入船舶IMO号、船名、船型、净吨位、抵港时间、离港时间、作业港口代码，自动校验IMO号校验位与船舶类型有效性。"
    )]
    Add(AddArgs),

    #[structopt(
        name = "compute",
        about = "计算港口使费",
        long_about = "费用计算命令：根据船舶净吨位、停泊时长、作业类型匹配港口收费规则，支持批量计算，输出12项费用明细与合计金额。"
    )]
    Compute(ComputeArgs),

    #[structopt(
        name = "rate",
        about = "费率管理（增/改/查/删）",
        long_about = "费率管理命令：支持add/update/list/delete操作，可配置阶梯费率，设置生效日期实现费率版本管理。"
    )]
    Rate(RateArgs),

    #[structopt(
        name = "dispute",
        about = "费用争议处理",
        long_about = "争议处理命令：针对费用争议场景，支持调整单项费用、记录争议原因、审批流转，自动生成调整前后对比明细。"
    )]
    Dispute(DisputeArgs),

    #[structopt(
        name = "report",
        about = "生成结算报表",
        long_about = "结算报表命令：生成月度港口使费汇总报表，支持按港口/船型分组，多种输出格式，包含应收、已收、待收账龄分析。"
    )]
    Report(ReportArgs),

    #[structopt(
        name = "import",
        about = "批量导入CSV数据",
        long_about = "数据导入命令：从CSV文件批量导入船舶申报数据，支持dry-run预览、跳过错误行，自动识别重复IMO号与时间冲突。"
    )]
    Import(ImportArgs),

    #[structopt(
        name = "history",
        about = "查询历史费用记录",
        long_about = "费用追溯命令：按IMO号或船名查询历史费用记录，支持年份与港口筛选，输出费用趋势折线图ASCII字符。"
    )]
    History(HistoryArgs),

    #[structopt(
        name = "config",
        about = "系统配置管理",
        long_about = "配置管理命令：设置默认港口代码、输出格式、小数位数、货币符号等参数，配置持久化至~/.ship_agent/config.toml。"
    )]
    Config(ConfigArgs),
}

#[derive(StructOpt, Debug, Clone)]
pub struct AddArgs {
    #[structopt(short = "i", long = "imo", help = "船舶IMO号（7位数字）")]
    pub imo: String,

    #[structopt(short = "n", long = "name", help = "船名")]
    pub vessel_name: String,

    #[structopt(
        short = "t",
        long = "type",
        help = "船型: container/bulk/oil/lpg/ro-ro"
    )]
    pub vessel_type: String,

    #[structopt(short = "N", long = "net-tonnage", help = "净吨位（NT）")]
    pub net_tonnage: f64,

    #[structopt(short = "a", long = "arrival", help = "抵港时间 (YYYY-MM-DD HH:MM)")]
    pub arrival_time: String,

    #[structopt(short = "d", long = "departure", help = "离港时间 (YYYY-MM-DD HH:MM)")]
    pub departure_time: String,

    #[structopt(short = "p", long = "port", help = "作业港口代码")]
    pub port_code: String,

    #[structopt(long = "cargo-tonnage", help = "货物吨数（装卸作业用）", default_value = "0")]
    pub cargo_tonnage: f64,

    #[structopt(long = "pilot-hours", help = "引航时长（小时）", default_value = "4")]
    pub pilot_hours: f64,

    #[structopt(long = "tug-count", help = "拖轮使用艘次", default_value = "2")]
    pub tug_count: u32,

    #[structopt(long = "tug-hours", help = "拖轮作业时长（小时）", default_value = "3")]
    pub tug_hours: f64,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ComputeArgs {
    #[structopt(short = "p", long = "port", help = "指定港口代码")]
    pub port: Option<String>,

    #[structopt(short = "v", long = "vessel", help = "指定船舶IMO号或船名")]
    pub vessel: Option<String>,

    #[structopt(
        short = "r",
        long = "date-range",
        help = "日期范围: YYYY-MM-DD:YYYY-MM-DD"
    )]
    pub date_range: Option<String>,

    #[structopt(short = "s", long = "save", help = "保存计算结果到数据库")]
    pub save: bool,

    #[structopt(long = "verbose", help = "显示详细计算过程")]
    pub verbose: bool,
}

#[derive(StructOpt, Debug, Clone)]
pub struct RateArgs {
    #[structopt(subcommand)]
    pub action: RateAction,
}

#[derive(StructOpt, Debug, Clone)]
pub enum RateAction {
    #[structopt(name = "add", about = "新增费率规则")]
    Add(RateAddArgs),

    #[structopt(name = "update", about = "更新费率规则")]
    Update(RateUpdateArgs),

    #[structopt(name = "list", about = "列出费率规则")]
    List(RateListArgs),

    #[structopt(name = "delete", about = "删除费率规则")]
    Delete(RateDeleteArgs),
}

#[derive(StructOpt, Debug, Clone)]
pub struct RateAddArgs {
    #[structopt(short = "p", long = "port", help = "港口代码")]
    pub port_code: String,

    #[structopt(
        short = "c",
        long = "category",
        help = "费用类别: pilot/tug/berth/port/tally/agent/... 共12项"
    )]
    pub fee_category: String,

    #[structopt(short = "f", long = "from", help = "阶梯起始值（净吨位）")]
    pub tier_from: f64,

    #[structopt(short = "t", long = "to", help = "阶梯结束值（净吨位），0表示无上限")]
    pub tier_to: f64,

    #[structopt(short = "r", long = "rate", help = "费率（元/单位）")]
    pub unit_rate: f64,

    #[structopt(short = "b", long = "base", help = "基础费用（元）", default_value = "0")]
    pub base_fee: f64,

    #[structopt(
        short = "e",
        long = "effective-date",
        help = "生效日期 YYYY-MM-DD",
        default_value = "2024-01-01"
    )]
    pub effective_date: String,
}

#[derive(StructOpt, Debug, Clone)]
pub struct RateUpdateArgs {
    #[structopt(short = "i", long = "id", help = "费率规则ID")]
    pub rule_id: i64,

    #[structopt(short = "r", long = "rate", help = "新费率（元/单位）")]
    pub unit_rate: Option<f64>,

    #[structopt(short = "b", long = "base", help = "新基础费用（元）")]
    pub base_fee: Option<f64>,

    #[structopt(short = "e", long = "effective-date", help = "新生效日期 YYYY-MM-DD")]
    pub effective_date: Option<String>,
}

#[derive(StructOpt, Debug, Clone)]
pub struct RateListArgs {
    #[structopt(short = "p", long = "port", help = "按港口代码筛选")]
    pub port_code: Option<String>,

    #[structopt(short = "c", long = "category", help = "按费用类别筛选")]
    pub fee_category: Option<String>,

    #[structopt(long = "active", help = "仅显示当前生效费率")]
    pub active_only: bool,
}

#[derive(StructOpt, Debug, Clone)]
pub struct RateDeleteArgs {
    #[structopt(short = "i", long = "id", help = "费率规则ID")]
    pub rule_id: i64,
}

#[derive(StructOpt, Debug, Clone)]
pub struct DisputeArgs {
    #[structopt(short = "f", long = "fee-id", help = "费用记录ID")]
    pub fee_record_id: i64,

    #[structopt(
        short = "a",
        long = "adjust",
        help = "调整单项费用: category=amount（正数增加，负数减少）"
    )]
    pub adjustments: Vec<String>,

    #[structopt(short = "r", long = "reason", help = "争议原因")]
    pub reason: String,

    #[structopt(short = "e", long = "requester", help = "申请人", default_value = "system")]
    pub requester: String,

    #[structopt(short = "s", long = "submit", help = "提交审批")]
    pub submit: bool,

    #[structopt(short = "A", long = "approve", help = "审批通过（需审批人权限）")]
    pub approve: bool,

    #[structopt(short = "p", long = "approver", help = "审批人", default_value = "admin")]
    pub approver: String,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ReportArgs {
    #[structopt(short = "m", long = "month", help = "报表月份 YYYY-MM", default_value = "2024-01")]
    pub month: String,

    #[structopt(long = "by-port", help = "按港口分组汇总")]
    pub by_port: bool,

    #[structopt(long = "by-vessel-type", help = "按船型分组汇总")]
    pub by_vessel_type: bool,

    #[structopt(
        short = "f",
        long = "format",
        help = "输出格式: table/csv/json",
        default_value = "table"
    )]
    pub format: String,

    #[structopt(short = "o", long = "output", help = "输出文件路径（不指定则打印到终端）")]
    pub output: Option<String>,

    #[structopt(long = "aging", help = "包含账龄分析")]
    pub include_aging: bool,

    #[structopt(long = "verbose", help = "显示完整明细")]
    pub verbose: bool,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ImportArgs {
    #[structopt(short = "f", long = "file", help = "CSV文件路径，可多次指定")]
    pub files: Vec<String>,

    #[structopt(long = "dry-run", help = "预览模式，不写入数据库")]
    pub dry_run: bool,

    #[structopt(long = "skip-errors", help = "跳过错误行继续导入")]
    pub skip_errors: bool,

    #[structopt(short = "j", long = "jobs", help = "并行处理文件数", default_value = "4")]
    pub jobs: usize,
}

#[derive(StructOpt, Debug, Clone)]
pub struct HistoryArgs {
    #[structopt(short = "i", long = "imo", help = "按IMO号查询")]
    pub imo: Option<String>,

    #[structopt(short = "n", long = "name", help = "按船名查询（支持模糊匹配）")]
    pub vessel_name: Option<String>,

    #[structopt(short = "y", long = "year", help = "指定年份")]
    pub year: Option<i32>,

    #[structopt(short = "p", long = "port", help = "指定港口代码")]
    pub port: Option<String>,

    #[structopt(long = "chart", help = "显示费用趋势ASCII图")]
    pub show_chart: bool,

    #[structopt(long = "verbose", help = "显示详细费用明细")]
    pub verbose: bool,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ConfigArgs {
    #[structopt(subcommand)]
    pub action: ConfigAction,
}

#[derive(StructOpt, Debug, Clone)]
pub enum ConfigAction {
    #[structopt(name = "set", about = "设置配置项")]
    Set(ConfigSetArgs),

    #[structopt(name = "get", about = "查看配置项")]
    Get(ConfigGetArgs),

    #[structopt(name = "list", about = "查看所有配置")]
    List,

    #[structopt(name = "reset", about = "重置为默认配置")]
    Reset,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ConfigSetArgs {
    #[structopt(long = "default-port", help = "设置默认港口代码")]
    pub default_port: Option<String>,

    #[structopt(long = "output-format", help = "设置默认输出格式: table/csv/json")]
    pub output_format: Option<String>,

    #[structopt(long = "decimals", help = "设置金额小数位数 (0-6)")]
    pub decimals: Option<u32>,

    #[structopt(long = "currency", help = "设置货币符号")]
    pub currency_symbol: Option<String>,

    #[structopt(long = "page-size", help = "设置分页大小")]
    pub page_size: Option<usize>,

    #[structopt(long = "color", help = "是否启用彩色输出 (auto/always/never)")]
    pub color_mode: Option<String>,
}

#[derive(StructOpt, Debug, Clone)]
pub struct ConfigGetArgs {
    #[structopt(help = "配置项名称")]
    pub key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    pub default_port: String,
    pub output_format: String,
    pub decimals: u32,
    pub currency_symbol: String,
    pub page_size: usize,
    pub color_mode: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            default_port: "SHA".to_string(),
            output_format: "table".to_string(),
            decimals: 2,
            currency_symbol: "¥".to_string(),
            page_size: 50,
            color_mode: "auto".to_string(),
        }
    }
}
