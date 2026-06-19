use thiserror::Error;

#[derive(Debug, Error)]
pub enum AtcError {
    #[error("二进制解析失败: {message} at offset {offset}")]
    ParseError { message: String, offset: usize },

    #[error("校验和验证失败: expected {expected}, got {got}")]
    ChecksumError { expected: u16, got: u16 },

    #[error("不支持的ASTerix类别: {0}")]
    UnsupportedCategory(u8),

    #[error("数据项长度无效: {message}")]
    InvalidDataItem { message: String },

    #[error("IO错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("参数校验失败: {0}")]
    ValidationError(String),

    #[error("时间范围无效: {0}")]
    InvalidTimeRange(String),

    #[error("文件不存在: {0}")]
    FileNotFound(String),

    #[error("雷达站未找到: {0}")]
    RadarNotFound(String),

    #[error("序列化错误: {0}")]
    SerializationError(String),

    #[error("反序列化错误: {0}")]
    DeserializationError(String),

    #[error("通道错误: {0}")]
    ChannelError(String),

    #[error("正则表达式错误: {0}")]
    RegexError(#[from] regex::Error),

    #[error("十六进制解析错误: {0}")]
    HexError(#[from] hex::FromHexError),

    #[error("JSON错误: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("CSV错误: {0}")]
    CsvError(#[from] csv::Error),

    #[error("TOML错误: {0}")]
    TomlError(#[from] toml::de::Error),

    #[error("其他错误: {0}")]
    Other(String),
}

pub type AtcResult<T> = Result<T, AtcError>;

impl From<toml::ser::Error> for AtcError {
    fn from(err: toml::ser::Error) -> Self {
        AtcError::ConfigError(err.to_string())
    }
}

impl<T> From<crossbeam_channel::SendError<T>> for AtcError {
    fn from(err: crossbeam_channel::SendError<T>) -> Self {
        AtcError::ChannelError(err.to_string())
    }
}

impl From<crossbeam_channel::RecvError> for AtcError {
    fn from(err: crossbeam_channel::RecvError) -> Self {
        AtcError::ChannelError(err.to_string())
    }
}

impl<W: std::fmt::Debug> From<csv::IntoInnerError<W>> for AtcError {
    fn from(err: csv::IntoInnerError<W>) -> Self {
        AtcError::IoError(err.into_error())
    }
}
