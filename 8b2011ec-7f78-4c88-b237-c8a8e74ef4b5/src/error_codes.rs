use anyhow::anyhow;

#[derive(Debug, Clone, Copy)]
pub enum ErrorCode {
    DatabaseOpen,
    DatabaseInit,
    DatabaseQuery,
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
    PermitDateError,
    DoseLimitExceeded,
    ValidationFailed,
    OutputFailed,
    UnsupportedExt,
    EmptyValue,
}

impl ErrorCode {
    pub fn code(&self) -> &'static str {
        match self {
            ErrorCode::DatabaseOpen => "E001",
            ErrorCode::DatabaseInit => "E002",
            ErrorCode::DatabaseQuery => "E003",
            ErrorCode::FileNotFound => "E004",
            ErrorCode::InvalidFormat => "E005",
            ErrorCode::UnsupportedFormat => "E006",
            ErrorCode::InvalidTimestamp => "E007",
            ErrorCode::InvalidValue => "E008",
            ErrorCode::InvalidDate => "E009",
            ErrorCode::ValueOutOfRange => "E010",
            ErrorCode::InvalidPeriod => "E011",
            ErrorCode::InvalidDimension => "E012",
            ErrorCode::InvalidLevel => "E013",
            ErrorCode::InvalidQueryType => "E014",
            ErrorCode::InvalidReportType => "E015",
            ErrorCode::PermitNotFound => "E016",
            ErrorCode::PermitStatusError => "E017",
            ErrorCode::PermitDateError => "E018",
            ErrorCode::DoseLimitExceeded => "E019",
            ErrorCode::ValidationFailed => "E020",
            ErrorCode::OutputFailed => "E021",
            ErrorCode::UnsupportedExt => "E022",
            ErrorCode::EmptyValue => "E023",
        }
    }
}

pub fn err(code: ErrorCode, msg: impl Into<String>) -> anyhow::Error {
    anyhow!("{}: {}", code.code(), msg.into())
}

pub fn err_with(code: ErrorCode, msg: impl std::fmt::Display) -> anyhow::Error {
    anyhow!("{}: {}", code.code(), msg)
}
