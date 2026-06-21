namespace UsedVehicleTransaction.Common;

public class AppSettings
{
    public string DefaultCulture { get; set; } = "zh-CN";
    public List<string> SupportCultures { get; set; } = new() { "zh-CN", "en-US" };
    public string FileStoragePath { get; set; } = "/data/vehicle-archives";
    public int MaxFileSizeMB { get; set; } = 50;
    public List<string> AllowedFileExtensions { get; set; } = new();
    public int ComplianceCheckTimeoutMs { get; set; } = 2800;
    public int InspectionReportTimeoutMs { get; set; } = 4800;
    public int ArchiveSearchTimeoutMs { get; set; } = 1800;
    public string JwtSecret { get; set; } = string.Empty;
    public string JwtIssuer { get; set; } = string.Empty;
    public string JwtAudience { get; set; } = string.Empty;
}

public class ExternalApiConfig
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public int TimeoutMs { get; set; } = 1000;
}

public class ExternalApiSettings
{
    public ExternalApiConfig EnvProtectionApi { get; set; } = new();
    public ExternalApiConfig AccidentRecordApi { get; set; } = new();
    public ExternalApiConfig MortgageApi { get; set; } = new();
    public ExternalApiConfig SeizureApi { get; set; } = new();
    public ExternalApiConfig VehicleInfoApi { get; set; } = new();
    public ExternalApiConfig TaxApi { get; set; } = new();
}
