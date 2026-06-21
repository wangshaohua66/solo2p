use anyhow::anyhow;

#[derive(Debug, Clone, Copy)]
pub enum ErrorCode {
    DatabaseOpen,
    DatabaseInit,
    InvalidFormat,
    UnsupportedFormat,
    FileNotFound,
    InvalidTimestamp,
    InvalidValue,
    InvalidDate,
    ValueOutOfRange,
    InvalidPeriod,
    InvalidDimension,
    InvalidLevel,
    InvalidQueryType,
    InvalidReportType,
    PermitNotFound,
    PermitStatusError,
    DoseLimitExceeded,
    ValidationFailed,
    OutputFailed,
    UnsupportedExt,
}

impl ErrorCode {
    pub fn code(&self) -> &'static str {
        match self {
            ErrorCode::DatabaseOpen => "E001",
            ErrorCode::DatabaseInit => "E002",
            ErrorCode::FileNotFound => "E003",
            ErrorCode::InvalidFormat => "E004",
            ErrorCode::UnsupportedFormat => "E005",
            ErrorCode::InvalidTimestamp => "E006",
            ErrorCode::InvalidValue => "E007",
            ErrorCode::InvalidDate => "E008",
            ErrorCode::ValueOutOfRange => "E009",
            ErrorCode::InvalidPeriod => "E010",
            ErrorCode::InvalidDimension => "E011",
            ErrorCode::InvalidLevel => "E012",
            ErrorCode::InvalidQueryType => "E013",
            ErrorCode::InvalidReportType => "E014",
            ErrorCode::PermitNotFound => "E015",
            ErrorCode::PermitStatusError => "E016",
            ErrorCode::DoseLimitExceeded => "E017",
            ErrorCode::ValidationFailed => "E018",
            ErrorCode::OutputFailed => "E019",
            ErrorCode::UnsupportedExt => "E020",
        }
    }
}

pub fn err(code: ErrorCode, msg: impl Into<String>) -> anyhow::Error {
    anyhow!("{}: {}", code.code(), msg.into())
}

pub fn err_with(code: ErrorCode, msg: impl std::fmt::Display) -> anyhow::Error {
    anyhow!("{}: {}", code.code(), msg)
}
