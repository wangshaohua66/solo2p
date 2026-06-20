namespace FireIoTPlatform.Services;

public interface IThirdPartyIntegrationService
{
    Task PushSupervisionDataAsync(object data);
    Task SyncAlarmToCommandCenterAsync(object alarmData);
    Task SyncDispatchToCommandCenterAsync(object dispatchData);
    Task PullCommandCenterAlarmsAsync();
}

public class ThirdPartyIntegrationService : IThirdPartyIntegrationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<ThirdPartyIntegrationService> _logger;

    public ThirdPartyIntegrationService(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<ThirdPartyIntegrationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task PushSupervisionDataAsync(object data)
    {
        var baseUrl = _config["ApiSettings:GovernmentApiBaseUrl"];
        var apiKey = _config["ApiSettings:GovernmentApiKey"];
        if (string.IsNullOrEmpty(baseUrl))
        {
            _logger.LogWarning("政务网API地址未配置，跳过推送");
            return;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(data);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/api/supervision/push", content);
            response.EnsureSuccessStatusCode();
            _logger.LogInformation("政务网监管数据推送成功");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "政务网监管数据推送失败");
        }
    }

    public async Task SyncAlarmToCommandCenterAsync(object alarmData)
    {
        var baseUrl = _config["ApiSettings:FireCommandCenterBaseUrl"];
        var apiKey = _config["ApiSettings:FireCommandCenterApiKey"];
        if (string.IsNullOrEmpty(baseUrl))
        {
            _logger.LogWarning("119指挥中心API地址未配置，跳过同步");
            return;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(alarmData);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/api/alarm/sync", content);
            response.EnsureSuccessStatusCode();
            _logger.LogInformation("告警信息同步至119指挥中心成功");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "告警信息同步至119指挥中心失败");
        }
    }

    public async Task SyncDispatchToCommandCenterAsync(object dispatchData)
    {
        var baseUrl = _config["ApiSettings:FireCommandCenterBaseUrl"];
        var apiKey = _config["ApiSettings:FireCommandCenterApiKey"];
        if (string.IsNullOrEmpty(baseUrl)) return;

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
            var json = Newtonsoft.Json.JsonConvert.SerializeObject(dispatchData);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/api/dispatch/sync", content);
            response.EnsureSuccessStatusCode();
            _logger.LogInformation("调度信息同步至119指挥中心成功");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "调度信息同步至119指挥中心失败");
        }
    }

    public async Task PullCommandCenterAlarmsAsync()
    {
        var baseUrl = _config["ApiSettings:FireCommandCenterBaseUrl"];
        var apiKey = _config["ApiSettings:FireCommandCenterApiKey"];
        if (string.IsNullOrEmpty(baseUrl)) return;

        try
        {
            using var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
            var response = await client.GetAsync($"{baseUrl}/api/alarm/pull?since=" + DateTime.Now.AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss"));
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("从119指挥中心拉取警情信息成功");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "从119指挥中心拉取警情信息失败");
        }
    }
}
