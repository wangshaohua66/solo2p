using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using FireIoTPlatform.Models.DTOs.Device;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Services;
using Newtonsoft.Json;

namespace FireIoTPlatform.BackgroundServices;

public class MqttMessageHandlerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MqttMessageHandlerService> _logger;
    private readonly IConfiguration _config;
    private IMqttClient? _mqttClient;

    public MqttMessageHandlerService(IServiceProvider serviceProvider,
        ILogger<MqttMessageHandlerService> logger, IConfiguration config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MQTT消息处理服务正在启动...");
        try
        {
            await ConnectMqttClientAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MQTT客户端连接失败，将定期重试");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_mqttClient == null || !_mqttClient.IsConnected)
                {
                    await ConnectMqttClientAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MQTT客户端重连失败");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }

        if (_mqttClient != null && _mqttClient.IsConnected)
        {
            await _mqttClient.DisconnectAsync();
        }
        _logger.LogInformation("MQTT消息处理服务已停止");
    }

    private async Task ConnectMqttClientAsync(CancellationToken stoppingToken)
    {
        var host = _config["MqttSettings:Host"] ?? "localhost";
        var port = int.TryParse(_config["MqttSettings:Port"], out var p) ? p : 1883;
        var clientId = _config["MqttSettings:ClientId"] ?? "FireIoTPlatform";
        var userName = _config["MqttSettings:UserName"];
        var password = _config["MqttSettings:Password"];
        var topicPrefix = _config["MqttSettings:TopicPrefix"] ?? "fire/device/";

        var factory = new MqttFactory();
        _mqttClient = factory.CreateMqttClient();

        _mqttClient.ApplicationMessageReceivedAsync += async e =>
        {
            try
            {
                await HandleMessageAsync(e);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "处理MQTT消息异常: Topic={Topic}", e.ApplicationMessage.Topic);
            }
        };

        _mqttClient.DisconnectedAsync += async e =>
        {
            _logger.LogWarning("MQTT客户端断开连接，将尝试重连");
            await Task.Delay(5000, stoppingToken);
            if (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await _mqttClient.ConnectAsync(CreateOptions(host, port, clientId, userName, password), stoppingToken);
                    await SubscribeTopicsAsync(topicPrefix);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "MQTT客户端重连失败");
                }
            }
        };

        await _mqttClient.ConnectAsync(CreateOptions(host, port, clientId, userName, password), stoppingToken);
        await SubscribeTopicsAsync(topicPrefix);
        _logger.LogInformation($"MQTT客户端已连接: Host={host}:{port}");
    }

    private static MqttClientOptions CreateOptions(string host, int port, string clientId, string? userName, string? password)
    {
        var builder = new MqttClientOptionsBuilder()
            .WithClientId(clientId)
            .WithTcpServer(host, port)
            .WithCleanSession()
            .WithTimeout(TimeSpan.FromSeconds(30));

        if (!string.IsNullOrEmpty(userName))
        {
            builder.WithCredentials(userName, password);
        }

        return builder.Build();
    }

    private async Task SubscribeTopicsAsync(string topicPrefix)
    {
        if (_mqttClient == null) return;

        var topics = new[]
        {
            $"{topicPrefix}+/data",
            $"{topicPrefix}+/heartbeat",
            $"{topicPrefix}+/alarm",
            $"{topicPrefix}+/status"
        };

        foreach (var topic in topics)
        {
            await _mqttClient.SubscribeAsync(topic, MqttQualityOfServiceLevel.AtLeastOnce);
            _logger.LogInformation($"订阅MQTT主题: {topic}");
        }
    }

    private async Task HandleMessageAsync(MqttApplicationMessageReceivedEventArgs e)
    {
        var topic = e.ApplicationMessage.Topic;
        var payload = e.ApplicationMessage.PayloadSegment.Count > 0
            ? System.Text.Encoding.UTF8.GetString(e.ApplicationMessage.PayloadSegment)
            : string.Empty;

        _logger.LogDebug($"收到MQTT消息: Topic={topic}, Payload={payload}");

        var segments = topic.Split('/');
        if (segments.Length < 4) return;

        var deviceCode = segments[2];
        var messageType = segments[3];

        using var scope = _serviceProvider.CreateScope();
        var deviceService = scope.ServiceProvider.GetRequiredService<IDeviceService>();
        var alarmService = scope.ServiceProvider.GetRequiredService<IAlarmService>();

        switch (messageType)
        {
            case "data":
                await HandleDeviceData(deviceCode, payload, deviceService);
                break;
            case "heartbeat":
                await HandleHeartbeat(deviceCode, payload, deviceService);
                break;
            case "alarm":
                await HandleDeviceAlarm(deviceCode, payload, deviceService, alarmService);
                break;
            case "status":
                await HandleDeviceStatus(deviceCode, payload, deviceService);
                break;
        }
    }

    private async Task HandleDeviceData(string deviceCode, string payload, IDeviceService deviceService)
    {
        try
        {
            var dto = JsonConvert.DeserializeObject<DeviceDataReportDto>(payload) ?? new DeviceDataReportDto();
            dto.DeviceCode = deviceCode;
            await deviceService.ReportDataAsync(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "处理设备数据上报失败: DeviceCode={DeviceCode}", deviceCode);
        }
    }

    private async Task HandleHeartbeat(string deviceCode, string payload, IDeviceService deviceService)
    {
        try
        {
            var dto = JsonConvert.DeserializeObject<DeviceHeartbeatDto>(payload) ?? new DeviceHeartbeatDto();
            dto.DeviceCode = deviceCode;
            await deviceService.ReportHeartbeatAsync(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "处理设备心跳失败: DeviceCode={DeviceCode}", deviceCode);
        }
    }

    private async Task HandleDeviceAlarm(string deviceCode, string payload, IDeviceService deviceService, IAlarmService alarmService)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<FireIoTPlatform.Repositories.IUnitOfWork>();
            var device = await unitOfWork.Devices.FirstOrDefaultAsync(d => d.DeviceCode == deviceCode && !d.IsDeleted);
            if (device != null)
            {
                await alarmService.ProcessDeviceAlarmAsync(device.Id);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "处理设备告警失败: DeviceCode={DeviceCode}", deviceCode);
        }
    }

    private async Task HandleDeviceStatus(string deviceCode, string payload, IDeviceService deviceService)
    {
        try
        {
            var dto = JsonConvert.DeserializeObject<DeviceHeartbeatDto>(payload) ?? new DeviceHeartbeatDto();
            dto.DeviceCode = deviceCode;
            await deviceService.ReportHeartbeatAsync(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "处理设备状态更新失败: DeviceCode={DeviceCode}", deviceCode);
        }
    }
}
