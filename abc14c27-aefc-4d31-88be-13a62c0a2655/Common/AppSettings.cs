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
    public PdfSettings Pdf { get; set; } = new();
    public OcrSettings Ocr { get; set; } = new();
    public NotificationSettings Notification { get; set; } = new();
}

public class PdfSettings
{
    public string FontPath { get; set; } = "/usr/share/fonts";
    public bool EnableCompression { get; set; } = true;
    public int Dpi { get; set; } = 300;
    public bool GeneratePdfA { get; set; } = false;
}

public class OcrSettings
{
    public string Provider { get; set; } = "tesseract"; // tesseract, baidu, aliyun
    public string TesseractDataPath { get; set; } = "./tessdata";
    public string DefaultLanguage { get; set; } = "chi_sim+eng";
    public BaiduOcrSettings Baidu { get; set; } = new();
    public AliyunOcrSettings Aliyun { get; set; } = new();
}

public class BaiduOcrSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string TokenUrl { get; set; } = "https://aip.baidubce.com/oauth/2.0/token";
    public string OcrUrl { get; set; } = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";
    public int TimeoutMs { get; set; } = 10000;
}

public class AliyunOcrSettings
{
    public string AppCode { get; set; } = string.Empty;
    public string Endpoint { get; set; } = "ocr.cn-shanghai.aliyuncs.com";
    public string RegionId { get; set; } = "cn-shanghai";
    public string AccessKeyId { get; set; } = string.Empty;
    public string AccessKeySecret { get; set; } = string.Empty;
}

public class NotificationSettings
{
    public EmailSettings Email { get; set; } = new();
    public SmsSettings Sms { get; set; } = new();
    public InAppSettings InApp { get; set; } = new();
    public string DefaultChannels { get; set; } = "email,sms,inapp";
    public int RetryCount { get; set; } = 3;
    public int RetryIntervalMs { get; set; } = 1000;
}

public class EmailSettings
{
    public bool Enabled { get; set; } = true;
    public string SmtpServer { get; set; } = "smtp.exmail.qq.com";
    public int SmtpPort { get; set; } = 465;
    public bool UseSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "二手车交易服务中心";
    public int TimeoutMs { get; set; } = 10000;
}

public class SmsSettings
{
    public bool Enabled { get; set; } = true;
    public string Provider { get; set; } = "aliyun"; // aliyun, tencent
    public AliyunSmsSettings Aliyun { get; set; } = new();
    public TencentSmsSettings Tencent { get; set; } = new();
    public string TimeoutTemplateCode { get; set; } = "SMS_294140001";
    public string ReminderTemplateCode { get; set; } = "SMS_294140002";
    public string SignName { get; set; } = "二手车交易中心";
    public int TimeoutMs { get; set; } = 10000;
}

public class AliyunSmsSettings
{
    public string AccessKeyId { get; set; } = string.Empty;
    public string AccessKeySecret { get; set; } = string.Empty;
    public string Endpoint { get; set; } = "dysmsapi.aliyuncs.com";
    public string RegionId { get; set; } = "cn-hangzhou";
}

public class TencentSmsSettings
{
    public string SecretId { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string SdkAppId { get; set; } = string.Empty;
    public string Endpoint { get; set; } = "sms.tencentcloudapi.com";
    public string Region { get; set; } = "ap-guangzhou";
}

public class InAppSettings
{
    public bool Enabled { get; set; } = true;
    public int ExpireHours { get; set; } = 72;
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
