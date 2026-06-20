using Microsoft.AspNetCore.SignalR;

namespace FireIoTPlatform.Hubs;

public class FireAlarmHub : Hub
{
    private readonly ILogger<FireAlarmHub> _logger;

    public FireAlarmHub(ILogger<FireAlarmHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var fireUnitId = httpContext?.Request.Query["fireUnitId"].ToString();
        var stationId = httpContext?.Request.Query["stationId"].ToString();
        var districtCode = httpContext?.Request.Query["districtCode"].ToString();

        if (!string.IsNullOrEmpty(fireUnitId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"unit_{fireUnitId}");
            _logger.LogInformation($"客户端 {Context.ConnectionId} 加入单位组 unit_{fireUnitId}");
        }

        if (!string.IsNullOrEmpty(stationId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"station_{stationId}");
            _logger.LogInformation($"客户端 {Context.ConnectionId} 加入消防站组 station_{stationId}");
        }

        if (!string.IsNullOrEmpty(districtCode))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"district_{districtCode}");
            _logger.LogInformation($"客户端 {Context.ConnectionId} 加入区域组 district_{districtCode}");
        }

        await Clients.Caller.SendAsync("Connected", new { ConnectionId = Context.ConnectionId, Message = "连接成功" });
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation($"客户端断开连接: {Context.ConnectionId}, 异常: {exception?.Message}");
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendHeartbeat(string deviceCode)
    {
        _logger.LogDebug($"收到设备心跳: {deviceCode}");
        await Clients.All.SendAsync("HeartbeatReceived", new { DeviceCode = deviceCode, Timestamp = DateTime.Now });
    }

    public async Task JoinUnitGroup(long fireUnitId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"unit_{fireUnitId}");
        await Clients.Caller.SendAsync("GroupJoined", $"unit_{fireUnitId}");
    }

    public async Task JoinStationGroup(long stationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"station_{stationId}");
        await Clients.Caller.SendAsync("GroupJoined", $"station_{stationId}");
    }

    public async Task JoinDistrictGroup(string districtCode)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"district_{districtCode}");
        await Clients.Caller.SendAsync("GroupJoined", $"district_{districtCode}");
    }
}
