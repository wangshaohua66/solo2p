using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CampHub.Models;
using CampHub.Services;
using MongoDB.Driver;

namespace CampHub.Hubs;

[Authorize]
public class EventCollaborationHub : Hub
{
    private readonly MongoContext _db;

    public EventCollaborationHub(MongoContext db)
    {
        _db = db;
    }

    private string CurrentUserId =>
        Context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "";

    public async Task JoinEvent(string eventId)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, $"event_{eventId}");
        var user = GetCurrentUserSafe();
        await Clients.Group($"event_{eventId}").SendAsync("UserJoined", new
        {
            userId = CurrentUserId,
            nickname = user?.Nickname ?? "匿名",
            connectionId = Context.ConnectionId
        });
    }

    public async Task LeaveEvent(string eventId)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"event_{eventId}");
        var user = GetCurrentUserSafe();
        await Clients.Group($"event_{eventId}").SendAsync("UserLeft", new
        {
            userId = CurrentUserId,
            nickname = user?.Nickname ?? "匿名",
            connectionId = Context.ConnectionId
        });
    }

    public async Task UpdateGearItem(string eventId, string itemKey, object payload)
    {
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(itemKey)) return;

        var uid = CurrentUserId;
        var user = GetCurrentUserSafe();

        await Clients.Group($"event_{eventId}").SendAsync("GearItemUpdated", new
        {
            eventId,
            itemKey,
            payload,
            updatedBy = uid,
            updatedByName = user?.Nickname ?? "匿名",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    public async Task UpdatePurchaseItem(string eventId, string itemKey, object payload)
    {
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(itemKey)) return;

        var uid = CurrentUserId;
        var user = GetCurrentUserSafe();

        await Clients.Group($"event_{eventId}").SendAsync("PurchaseItemUpdated", new
        {
            eventId,
            itemKey,
            payload,
            updatedBy = uid,
            updatedByName = user?.Nickname ?? "匿名",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    public async Task SendCursor(string eventId, string field, string value)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return;
        var uid = CurrentUserId;
        var user = GetCurrentUserSafe();
        await Clients.OthersInGroup($"event_{eventId}").SendAsync("CursorMoved", new
        {
            userId = uid,
            nickname = user?.Nickname ?? "匿名",
            avatar = user?.AvatarUrl ?? "",
            field,
            value,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    public async Task SendMessage(string eventId, string message)
    {
        if (string.IsNullOrWhiteSpace(eventId) || string.IsNullOrWhiteSpace(message)) return;
        var uid = CurrentUserId;
        var user = GetCurrentUserSafe();
        await Clients.Group($"event_{eventId}").SendAsync("ChatMessage", new
        {
            userId = uid,
            nickname = user?.Nickname ?? "匿名",
            avatar = user?.AvatarUrl ?? "",
            message = message.Trim(),
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }

    private User? GetCurrentUserSafe()
    {
        try
        {
            var uid = CurrentUserId;
            if (string.IsNullOrEmpty(uid)) return null;
            return _db.Users.Find(u => u.Id == uid).FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }
}
