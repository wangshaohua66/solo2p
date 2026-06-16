using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SmartParking.API.Models.DTOs;

namespace SmartParking.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier ?? Context.User?.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier ?? Context.User?.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user:{userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinParkingGroup(string parkingLotId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"parking:{parkingLotId}");
    }

    public async Task LeaveParkingGroup(string parkingLotId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"parking:{parkingLotId}");
    }

    public async Task JoinChargingGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "charging:all");
    }

    public async Task LeaveChargingGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "charging:all");
    }

    public async Task SendNotification(string message, string type = "info")
    {
        await Clients.All.SendAsync("Notification", message, type);
    }
}

public static class NotificationHubExtensions
{
    public static async Task PushParkingSpotUpdated(this IHubContext<NotificationHub> hub, ParkingSpotDto spot)
    {
        await hub.Clients.All.SendAsync("ParkingSpotUpdated", spot);
    }

    public static async Task PushParkingSpotsBatchUpdated(this IHubContext<NotificationHub> hub, IEnumerable<ParkingSpotDto> spots)
    {
        await hub.Clients.All.SendAsync("ParkingSpotsBatchUpdated", spots);
    }

    public static async Task PushChargingStationUpdated(this IHubContext<NotificationHub> hub, ChargingStationDto station)
    {
        await hub.Clients.Group("charging:all").SendAsync("ChargingStationUpdated", station);
    }

    public static async Task PushChargingStationsBatchUpdated(this IHubContext<NotificationHub> hub, IEnumerable<ChargingStationDto> stations)
    {
        await hub.Clients.Group("charging:all").SendAsync("ChargingStationsBatchUpdated", stations);
    }

    public static async Task PushReservationExpired(this IHubContext<NotificationHub> hub, string userId, string reservationId)
    {
        await hub.Clients.Group($"user:{userId}").SendAsync("ReservationExpired", reservationId);
    }

    public static async Task PushPaymentCompleted(this IHubContext<NotificationHub> hub, string userId, string orderId)
    {
        await hub.Clients.Group($"user:{userId}").SendAsync("PaymentCompleted", orderId);
    }

    public static async Task PushWorkOrderAssigned(this IHubContext<NotificationHub> hub, string assigneeId, string workOrderId)
    {
        await hub.Clients.Group($"user:{assigneeId}").SendAsync("WorkOrderAssigned", workOrderId);
    }

    public static async Task PushToUser(this IHubContext<NotificationHub> hub, string userId, string method, params object[] args)
    {
        await hub.Clients.Group($"user:{userId}").SendAsync(method, args);
    }
}
