namespace UsedVehicleTransaction.Enums;

public enum VehicleStatus
{
    PendingCompliance = 0,
    ComplianceFailed = 1,
    CompliancePassed = 2,
    UnderInspection = 3,
    InspectionCompleted = 4,
    AvailableForTransaction = 5,
    InTransaction = 6,
    TransactionCompleted = 7,
    ExceptionHandling = 8,
    Rejected = 99
}

public enum ComplianceCheckStatus
{
    Pending = 0,
    Running = 1,
    Passed = 2,
    Failed = 3,
    Timeout = 4,
    Exception = 5
}

public enum ComplianceItemType
{
    EnvironmentalStandard = 1,
    AccidentRecord = 2,
    MortgageStatus = 3,
    SeizureStatus = 4,
    AnnualInspection = 5,
    InsuranceValidity = 6,
    ModificationRecord = 7,
    TheftRecord = 8,
    TaxArrears = 9,
    ScrapRecord = 10,
    EngineNumberMatch = 11,
    FrameNumberMatch = 12
}

public enum InspectionStatus
{
    Created = 0,
    Assigned = 1,
    InProgress = 2,
    Completed = 3,
    Reviewed = 4,
    Rejected = 5,
    Cancelled = 6
}

public enum InspectionGrade
{
    Excellent = 4,
    Good = 3,
    Fair = 2,
    Poor = 1
}

public enum InspectionCategory
{
    Engine = 1,
    Chassis = 2,
    Body = 3,
    Electrical = 4,
    RoadTest = 5
}

public enum TransactionStatus
{
    Created = 0,
    PendingWorkflow = 1,
    InProgress = 2,
    Completed = 3,
    Suspended = 4,
    Cancelled = 5,
    Exception = 6
}

public enum WorkflowNodeType
{
    EnvironmentalReview = 1,
    SafetyInspection = 2,
    TaxCalculation = 3,
    RegistrationAcceptance = 4,
    DrivingLicenseChange = 5,
    PlateIssuance = 6,
    ArchiveStorage = 7,
    Notification = 8
}

public enum WorkflowNodeStatus
{
    Pending = 0,
    InProgress = 1,
    Completed = 2,
    Skipped = 3,
    TimedOut = 4,
    Failed = 5
}

public enum ArchiveType
{
    VehicleCertificate = 1,
    DrivingLicense = 2,
    IdentificationCard = 3,
    InspectionReport = 4,
    TransactionContract = 5,
    TaxReceipt = 6,
    InsuranceDocument = 7,
    OtherDocument = 99
}

public enum ExceptionCaseType
{
    MortgageRelease = 1,
    SeizurePending = 2,
    EnvironmentalExceed = 3,
    EngineMismatch = 4,
    FrameMismatch = 5,
    AccidentUnresolved = 6,
    MissingDocument = 7,
    IdentityVerification = 8,
    TaxArrears = 9,
    Other = 99
}

public enum ExceptionCaseStatus
{
    Created = 0,
    UnderInvestigation = 1,
    PendingApproval = 2,
    InProcess = 3,
    Resolved = 4,
    Closed = 5,
    Rejected = 6
}

public enum UserRole
{
    Admin = 1,
    ComplianceAuditor = 2,
    VehicleInspector = 3,
    RegistrationClerk = 4,
    ReportViewer = 5
}

public enum ReviewResult
{
    Approved = 1,
    Rejected = 2,
    PendingAdditionalInfo = 3
}
