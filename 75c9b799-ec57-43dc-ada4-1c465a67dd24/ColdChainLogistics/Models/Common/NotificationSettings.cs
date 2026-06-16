namespace ColdChainLogistics.Models.Common;

public class EmailSettings
{
    public string SmtpServer { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 465;
    public bool EnableSsl { get; set; } = true;
    public string SenderName { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

public class SmsSettings
{
    public string Provider { get; set; } = "Aliyun";
    public string AccessKeyId { get; set; } = string.Empty;
    public string AccessKeySecret { get; set; } = string.Empty;
    public string SignName { get; set; } = string.Empty;
    public string TemplateCode { get; set; } = string.Empty;
    public string Endpoint { get; set; } = "dysmsapi.aliyuncs.com";
    public int TimeoutSeconds { get; set; } = 15;
}
