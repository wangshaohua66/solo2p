using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Services;

public class SupervisionPlatformOptions
{
    public string BaseUrl { get; set; } = "https://supervision.example.cn/api/v1";
    public string ApiKey { get; set; } = string.Empty;
    public string OrgCode { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
    public bool Enabled { get; set; } = true;
}

public class ProvincialSupervisionPayload
{
    public string OrgCode { get; set; } = string.Empty;
    public string ReportCode { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    public DateTime ReportTime { get; set; }
    public SupervisionDeviceInfo Device { get; set; } = new();
    public SupervisionInspectionData Inspection { get; set; } = new();
    public SupervisionRectificationData? Rectification { get; set; }
}

public class SupervisionDeviceInfo
{
    public string DeviceCode { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public int DeviceType { get; set; }
    public string DeviceTypeName { get; set; } = string.Empty;
    public string RegistrationCode { get; set; } = string.Empty;
    public string UserUnit { get; set; } = string.Empty;
    public string UserUnitCode { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public DateTime? ManufacturingDate { get; set; }
    public DateTime? InstallationDate { get; set; }
    public DateTime? LastInspectionDate { get; set; }
    public DateTime? NextInspectionDate { get; set; }
}

public class SupervisionInspectionData
{
    public string InspectionCode { get; set; } = string.Empty;
    public DateTime InspectionDate { get; set; }
    public string InspectionOrg { get; set; } = string.Empty;
    public string Inspector { get; set; } = string.Empty;
    public int Result { get; set; }
    public string ResultName { get; set; } = string.Empty;
    public string Conclusion { get; set; } = string.Empty;
    public string Basis { get; set; } = string.Empty;
    public int ItemTotal { get; set; }
    public int ItemPass { get; set; }
    public int ItemFail { get; set; }
    public string? Findings { get; set; }
    public DateTime? NextInspectionDate { get; set; }
    public string? ReportNo { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedDate { get; set; }
}

public class SupervisionRectificationData
{
    public string RectificationCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Deadline { get; set; }
    public DateTime? CompletedDate { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public string? Feedback { get; set; }
}

public interface ISupervisionPlatformClient
{
    Task<(bool Success, string? Response, string? Error)> SubmitReportAsync(ProvincialSupervisionPayload payload);
    Task<(bool Success, string? Response, string? Error)> QueryStatusAsync(string reportCode);
}

public class SupervisionPlatformClient : ISupervisionPlatformClient
{
    private readonly HttpClient _http;
    private readonly SupervisionPlatformOptions _options;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public SupervisionPlatformClient(HttpClient http, IOptions<SupervisionPlatformOptions> options)
    {
        _http = http;
        _options = options.Value;
        _http.BaseAddress = new Uri(_options.BaseUrl);
        _http.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    public async Task<(bool Success, string? Response, string? Error)> SubmitReportAsync(ProvincialSupervisionPayload payload)
    {
        try
        {
            var json = JsonSerializer.Serialize(payload, JsonOpts);
            var signature = ComputeHmacSignature(json, _options.ApiKey);
            var request = new HttpRequestMessage(HttpMethod.Post, "/inspection/report");
            request.Headers.Add("X-API-Key", _options.ApiKey);
            request.Headers.Add("X-Signature", signature);
            request.Headers.Add("X-Org-Code", _options.OrgCode);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _http.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
                return (true, content, null);

            return (false, content, $"HTTP {response.StatusCode}: {content}");
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? Response, string? Error)> QueryStatusAsync(string reportCode)
    {
        try
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var signString = $"{reportCode}{timestamp}{_options.ApiKey}";
            var signature = ComputeHmacSignature(signString, _options.ApiKey);

            var url = $"/inspection/report/{reportCode}?ts={timestamp}&sign={signature}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("X-API-Key", _options.ApiKey);
            request.Headers.Add("X-Org-Code", _options.OrgCode);

            var response = await _http.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
                return (true, content, null);

            return (false, content, $"HTTP {response.StatusCode}: {content}");
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }

    private static string ComputeHmacSignature(string data, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToBase64String(hash);
    }
}
