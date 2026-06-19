pub mod patent;

pub use patent::{
    Citation, Claim, ClaimInfringementResult, ClaimType, ComparisonReport, DiagnosticSeverity,
    Feature, FeatureComparison, MatchStatus, OverallInfringement, ParseDiagnostic, Patent,
    SourceFormat,
};
