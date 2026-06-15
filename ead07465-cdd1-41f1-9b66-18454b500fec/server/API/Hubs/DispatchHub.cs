using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace WaterDispatch.API.Hubs;

public class DispatchHub : Hub
{
    private static readonly Dictionary<string, string> _connections = new();

    public override async Task OnConnectedAsync()
    {
        var userId = Context.GetHttpContext()?.Request.Query["userId"].ToString();
        if (!string.IsNullOrEmpty(userId))
        {
            _connections[userId] = Context.ConnectionId;
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.GetHttpContext()?.Request.Query["userId"].ToString();
        if (!string.IsNullOrEmpty(userId))
        {
            _connections.Remove(userId);
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendToUser(string userId, string method, object data)
    {
        if (_connections.TryGetValue(userId, out var connectionId))
        {
            await Clients.Client(connectionId).SendAsync(method, data);
        }
    }

    public async Task Broadcast(string method, object data)
    {
        await Clients.All.SendAsync(method, data);
    }

    public int GetOnlineCount() => _connections.Count;

    public async Task UpdateTeamPosition(Guid teamId, double longitude, double latitude)
    {
        await Clients.All.SendAsync("TeamPositionUpdated", new
        {
            TeamId = teamId,
            Longitude = longitude,
            Latitude = latitude,
            UpdateTime = DateTime.UtcNow
        });
    }

    public async Task SubscribeToEvents(string[] eventTypes)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "events");
    }

    public async Task UnsubscribeFromEvents()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "events");
    }
}
