using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;

namespace UsedVehicleTransaction.Services;

public class ExternalApiService : IExternalApiService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ExternalApiSettings _apiSettings;
    private readonly ILogger<ExternalApiService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ExternalApiService(
        IHttpClientFactory httpClientFactory,
        IOptions<ExternalApiSettings> apiSettings,
        ILogger<ExternalApiService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _apiSettings = apiSettings.Value;
        _logger = logger;
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckEnvProtectionAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("EnvProtectionApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.EnvProtectionApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.EnvProtectionApi.ApiKey);

            var url = $"{_apiSettings.EnvProtectionApi.BaseUrl}/v1/vehicle/{vin}/environmental-standard";
            var response = await client.GetFromJsonAsync<EnvProtectionResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true)
            {
                var isCompliant = response.Data?.IsStandardCompliant == true;
                var message = isCompliant ? "环保达标" : $"环保不达标：{response.Data?.StandardDescription}";
                var details = new Dictionary<string, object>
                {
                    ["standard"] = response.Data?.EmissionStandard ?? string.Empty,
                    ["registerDate"] = response.Data?.FirstRegisterDate,
                    ["isStandardCompliant"] = response.Data.IsStandardCompliant
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "环保查询接口调用失败";
            _logger.LogWarning("Env protection check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Env protection check timeout for VIN {Vin}", vin);
            return (false, "环保查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Env protection check exception for VIN {Vin}", vin);
            return (false, $"环保查询异常: {ex.Message}", null);
        }
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckAccidentRecordAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("AccidentRecordApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.AccidentRecordApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.AccidentRecordApi.ApiKey);

            var url = $"{_apiSettings.AccidentRecordApi.BaseUrl}/v1/vehicle/{vin}/accident-records";
            var response = await client.GetFromJsonAsync<AccidentRecordResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true)
            {
                var hasMajorAccident = response.Data?.HasMajorAccident == true;
                var accidentCount = response.Data?.Records?.Count ?? 0;
                var isCompliant = !hasMajorAccident;
                var message = isCompliant
                    ? (accidentCount > 0 ? $"有{accidentCount}次一般事故记录" : "无事故记录")
                    : $"存在重大事故记录（{response.Data?.MajorAccidentDescription}）";
                var details = new Dictionary<string, object>
                {
                    ["totalAccidents"] = accidentCount,
                    ["hasMajorAccident"] = hasMajorAccident,
                    ["majorDescription"] = response.Data?.MajorAccidentDescription ?? string.Empty
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "事故记录查询接口调用失败";
            _logger.LogWarning("Accident record check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Accident record check timeout for VIN {Vin}", vin);
            return (false, "事故记录查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Accident record check exception for VIN {Vin}", vin);
            return (false, $"事故记录查询异常: {ex.Message}", null);
        }
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckMortgageAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("MortgageApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.MortgageApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.MortgageApi.ApiKey);

            var url = $"{_apiSettings.MortgageApi.BaseUrl}/v1/vehicle/{vin}/mortgage-status";
            var response = await client.GetFromJsonAsync<MortgageResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true)
            {
                var hasMortgage = response.Data?.HasMortgage == true;
                var isCompliant = !hasMortgage;
                var message = isCompliant
                    ? "无抵押登记"
                    : $"存在抵押登记：抵押权人{response.Data?.Mortgagee}，金额{response.Data?.MortgageAmount:C}";
                var details = new Dictionary<string, object>
                {
                    ["hasMortgage"] = hasMortgage,
                    ["mortgagee"] = response.Data?.Mortgagee ?? string.Empty,
                    ["amount"] = response.Data?.MortgageAmount ?? 0,
                    ["registerDate"] = response.Data?.RegisterDate
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "抵押查询接口调用失败";
            _logger.LogWarning("Mortgage check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Mortgage check timeout for VIN {Vin}", vin);
            return (false, "抵押查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mortgage check exception for VIN {Vin}", vin);
            return (false, $"抵押查询异常: {ex.Message}", null);
        }
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckSeizureAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("SeizureApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.SeizureApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.SeizureApi.ApiKey);

            var url = $"{_apiSettings.SeizureApi.BaseUrl}/v1/vehicle/{vin}/seizure-status";
            var response = await client.GetFromJsonAsync<SeizureResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true)
            {
                var isSeized = response.Data?.IsSeized == true;
                var isCompliant = !isSeized;
                var message = isCompliant
                    ? "无查封记录"
                    : $"存在查封记录：{response.Data?.SeizureReason ?? "-"}";
                var details = new Dictionary<string, object>
                {
                    ["isSeized"] = isSeized,
                    ["seizureReason"] = response.Data?.SeizureReason ?? string.Empty,
                    ["seizureCourt"] = response.Data?.SeizureCourt ?? string.Empty,
                    ["seizureDate"] = response.Data?.SeizureDate
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "查封查询接口调用失败";
            _logger.LogWarning("Seizure check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Seizure check timeout for VIN {Vin}", vin);
            return (false, "查封查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Seizure check exception for VIN {Vin}", vin);
            return (false, $"查封查询异常: {ex.Message}", null);
        }
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckVehicleInfoAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("VehicleInfoApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.VehicleInfoApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.VehicleInfoApi.ApiKey);

            var url = $"{_apiSettings.VehicleInfoApi.BaseUrl}/v1/vehicle/{vin}/info";
            var response = await client.GetFromJsonAsync<VehicleInfoResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true && response.Data != null)
            {
                var engineMatch = response.Data.EngineNumberMatch == true;
                var frameMatch = response.Data.FrameNumberMatch == true;
                var isCompliant = engineMatch && frameMatch;
                var messages = new List<string>();
                if (!engineMatch) messages.Add("发动机号码不匹配");
                if (!frameMatch) messages.Add("车架号码不匹配");

                var message = isCompliant
                    ? "车辆信息验证通过"
                    : string.Join("；", messages);

                var details = new Dictionary<string, object>
                {
                    ["engineNumberMatch"] = engineMatch,
                    ["frameNumberMatch"] = frameMatch,
                    ["registeredEngineNo"] = response.Data.RegisteredEngineNumber ?? string.Empty,
                    ["registeredFrameNo"] = response.Data.RegisteredFrameNumber ?? string.Empty
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "车辆信息查询接口调用失败";
            _logger.LogWarning("Vehicle info check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Vehicle info check timeout for VIN {Vin}", vin);
            return (false, "车辆信息查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Vehicle info check exception for VIN {Vin}", vin);
            return (false, $"车辆信息查询异常: {ex.Message}", null);
        }
    }

    public async Task<(bool IsCompliant, string Message, Dictionary<string, object>? Details)> CheckTaxStatusAsync(
        string vin, CancellationToken cancellationToken)
    {
        try
        {
            using var client = _httpClientFactory.CreateClient("TaxApi");
            client.Timeout = TimeSpan.FromMilliseconds(_apiSettings.TaxApi.TimeoutMs);
            client.DefaultRequestHeaders.Add("X-API-Key", _apiSettings.TaxApi.ApiKey);

            var url = $"{_apiSettings.TaxApi.BaseUrl}/v1/vehicle/{vin}/tax-status";
            var response = await client.GetFromJsonAsync<TaxStatusResponse>(url, _jsonOptions, cancellationToken);

            if (response?.Success == true)
            {
                var hasArrears = response.Data?.HasArrears == true;
                var isAnnualInspected = response.Data?.AnnualInspectionValid == true;
                var isInsuranceValid = response.Data?.InsuranceValid == true;

                var isCompliant = !hasArrears && isAnnualInspected && isInsuranceValid;
                var messages = new List<string>();
                if (hasArrears) messages.Add($"存在税费拖欠{response.Data?.ArrearsAmount:C}");
                if (!isAnnualInspected) messages.Add("年检已过期");
                if (!isInsuranceValid) messages.Add("交强险已过期");

                var message = isCompliant
                    ? "税费、年检、保险均有效"
                    : string.Join("；", messages);

                var details = new Dictionary<string, object>
                {
                    ["hasArrears"] = hasArrears,
                    ["arrearsAmount"] = response.Data?.ArrearsAmount ?? 0,
                    ["annualInspectionValid"] = isAnnualInspected,
                    ["annualInspectionExpiry"] = response.Data?.AnnualInspectionExpiry,
                    ["insuranceValid"] = isInsuranceValid,
                    ["insuranceExpiry"] = response.Data?.InsuranceExpiry
                };
                return (isCompliant, message, details);
            }

            var errorMsg = response?.Message ?? "税费保险查询接口调用失败";
            _logger.LogWarning("Tax status check failed for VIN {Vin}: {Error}", vin, errorMsg);
            return (false, errorMsg, null);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Tax status check timeout for VIN {Vin}", vin);
            return (false, "税费保险查询超时", null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Tax status check exception for VIN {Vin}", vin);
            return (false, $"税费保险查询异常: {ex.Message}", null);
        }
    }

    private class BaseApiResponse
    {
        public bool Success { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    private class EnvProtectionResponse : BaseApiResponse
    {
        public EnvProtectionData? Data { get; set; }
    }

    private class EnvProtectionData
    {
        public string EmissionStandard { get; set; } = string.Empty;
        public string StandardDescription { get; set; } = string.Empty;
        public bool IsStandardCompliant { get; set; }
        public DateTime? FirstRegisterDate { get; set; }
    }

    private class AccidentRecordResponse : BaseApiResponse
    {
        public AccidentRecordData? Data { get; set; }
    }

    private class AccidentRecordData
    {
        public int TotalCount { get; set; }
        public bool HasMajorAccident { get; set; }
        public string MajorAccidentDescription { get; set; } = string.Empty;
        public List<AccidentRecordItem>? Records { get; set; }
    }

    private class AccidentRecordItem
    {
        public DateTime AccidentDate { get; set; }
        public string Description { get; set; } = string.Empty;
        public bool IsMajor { get; set; }
    }

    private class MortgageResponse : BaseApiResponse
    {
        public MortgageData? Data { get; set; }
    }

    private class MortgageData
    {
        public bool HasMortgage { get; set; }
        public string Mortgagee { get; set; } = string.Empty;
        public decimal MortgageAmount { get; set; }
        public DateTime? RegisterDate { get; set; }
    }

    private class SeizureResponse : BaseApiResponse
    {
        public SeizureData? Data { get; set; }
    }

    private class SeizureData
    {
        public bool IsSeized { get; set; }
        public string SeizureReason { get; set; } = string.Empty;
        public string SeizureCourt { get; set; } = string.Empty;
        public DateTime? SeizureDate { get; set; }
    }

    private class VehicleInfoResponse : BaseApiResponse
    {
        public VehicleInfoData? Data { get; set; }
    }

    private class VehicleInfoData
    {
        public bool EngineNumberMatch { get; set; }
        public bool FrameNumberMatch { get; set; }
        public string RegisteredEngineNumber { get; set; } = string.Empty;
        public string RegisteredFrameNumber { get; set; } = string.Empty;
    }

    private class TaxStatusResponse : BaseApiResponse
    {
        public TaxStatusData? Data { get; set; }
    }

    private class TaxStatusData
    {
        public bool HasArrears { get; set; }
        public decimal ArrearsAmount { get; set; }
        public bool AnnualInspectionValid { get; set; }
        public DateTime? AnnualInspectionExpiry { get; set; }
        public bool InsuranceValid { get; set; }
        public DateTime? InsuranceExpiry { get; set; }
    }
}
