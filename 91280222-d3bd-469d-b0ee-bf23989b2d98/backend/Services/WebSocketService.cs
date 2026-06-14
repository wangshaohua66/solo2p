using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using BlueprintReview.DTOs;

namespace BlueprintReview.Services;

public interface IWebSocketService
{
    Task HandleWebSocketAsync(HttpContext context, string token, string? documentId);
    Task BroadcastToDocumentAsync<T>(string documentId, string type, T data, string userId, string userName);
    Task SendToUserAsync<T>(string userId, string type, T data, string fromUserId, string fromUserName);
    Task<bool> IsUserConnected(string userId);
    IEnumerable<string> GetConnectedUserIds();
}

public class WsMessage<T>
{
    public string Type { get; set; } = string.Empty;
    public T Data { get; set; } = default!;
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");
    public string? DocumentId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
}

public class WebSocketConnection
{
    public required WebSocket Socket { get; set; }
    public required string UserId { get; set; }
    public required string UserName { get; set; }
    public string? DocumentId { get; set; }
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
}

public class WebSocketService : IWebSocketService
{
    private static readonly ConcurrentDictionary<string, WebSocketConnection> _connections = new();
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly IAuthService _authService;
    private readonly ILogger<WebSocketService> _logger;

    public WebSocketService(IAuthService authService, ILogger<WebSocketService> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    public async Task HandleWebSocketAsync(HttpContext context, string token, string? documentId)
    {
        if (string.IsNullOrEmpty(token))
        {
            context.Response.StatusCode = 401;
            return;
        }

        var user = ValidateToken(token);
        if (user == null)
        {
            context.Response.StatusCode = 401;
            return;
        }

        if (!context.WebSockets.IsWebSocketRequest)
        {
            context.Response.StatusCode = 400;
            return;
        }

        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var connectionId = Guid.NewGuid().ToString();

        var connection = new WebSocketConnection
        {
            Socket = webSocket,
            UserId = user.Id,
            UserName = user.Name,
            DocumentId = documentId,
            ConnectedAt = DateTime.UtcNow
        };

        _connections.TryAdd(connectionId, connection);
        _logger.LogInformation($"WebSocket connected: {connectionId}, User: {user.Name}, Doc: {documentId}");

        await BroadcastToDocumentAsync(documentId, "user.join", new
        {
            UserId = user.Id,
            UserName = user.Name
        }, user.Id, user.Name);

        try
        {
            await ReceiveLoopAsync(connectionId, connection);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"WebSocket error for connection {connectionId}");
        }
        finally
        {
            _connections.TryRemove(connectionId, out _);

            await BroadcastToDocumentAsync(documentId, "user.leave", new
            {
                UserId = user.Id,
                UserName = user.Name
            }, user.Id, user.Name);

            _logger.LogInformation($"WebSocket disconnected: {connectionId}");
        }
    }

    public async Task BroadcastToDocumentAsync<T>(string? documentId, string type, T data, string userId, string userName)
    {
        if (string.IsNullOrEmpty(documentId)) return;

        var message = JsonSerializer.Serialize(new WsMessage<T>
        {
            Type = type,
            Data = data,
            Timestamp = DateTime.UtcNow.ToString("o"),
            DocumentId = documentId,
            UserId = userId,
            UserName = userName
        }, _jsonOptions);

        var buffer = Encoding.UTF8.GetBytes(message);
        var segment = new ArraySegment<byte>(buffer);

        var targets = _connections.Values
            .Where(c => c.DocumentId == documentId && c.Socket.State == WebSocketState.Open)
            .ToList();

        foreach (var conn in targets)
        {
            try
            {
                await conn.Socket.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                _logger.LogWarning($"Failed to send message to user {conn.UserId}");
            }
        }
    }

    public async Task SendToUserAsync<T>(string userId, string type, T data, string fromUserId, string fromUserName)
    {
        var message = JsonSerializer.Serialize(new WsMessage<T>
        {
            Type = type,
            Data = data,
            Timestamp = DateTime.UtcNow.ToString("o"),
            UserId = fromUserId,
            UserName = fromUserName
        }, _jsonOptions);

        var buffer = Encoding.UTF8.GetBytes(message);
        var segment = new ArraySegment<byte>(buffer);

        var targets = _connections.Values
            .Where(c => c.UserId == userId && c.Socket.State == WebSocketState.Open)
            .ToList();

        foreach (var conn in targets)
        {
            try
            {
                await conn.Socket.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                _logger.LogWarning($"Failed to send direct message to user {userId}");
            }
        }
    }

    public bool IsUserConnected(string userId)
    {
        return _connections.Values.Any(c => c.UserId == userId && c.Socket.State == WebSocketState.Open);
    }

    public IEnumerable<string> GetConnectedUserIds()
    {
        return _connections.Values
            .Where(c => c.Socket.State == WebSocketState.Open)
            .Select(c => c.UserId)
            .Distinct()
            .ToList();
    }

    private async Task ReceiveLoopAsync(string connectionId, WebSocketConnection connection)
    {
        var buffer = new byte[4096];

        while (connection.Socket.State == WebSocketState.Open)
        {
            var result = await connection.Socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

            if (result.MessageType == WebSocketMessageType.Close)
            {
                await connection.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                break;
            }

            if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
            {
                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await HandleIncomingMessageAsync(connection, message);
            }
        }
    }

    private async Task HandleIncomingMessageAsync(WebSocketConnection connection, string rawMessage)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawMessage);
            var type = doc.RootElement.GetProperty("type").GetString() ?? string.Empty;

            switch (type)
            {
                case "heartbeat":
                    break;

                case "annotation.created":
                case "annotation.updated":
                case "annotation.deleted":
                case "annotation.reply":
                    if (connection.DocumentId != null)
                    {
                        var data = doc.RootElement.GetProperty("data").GetRawText();
                        await BroadcastToDocumentAsync(connection.DocumentId, type, data, connection.UserId, connection.UserName);
                    }
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to handle incoming WebSocket message");
        }
    }

    private dynamic? ValidateToken(string token)
    {
        try
        {
            var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(token);

            var userIdClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier);
            var nameClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Name);

            if (userIdClaim == null || nameClaim == null) return null;

            return new
            {
                Id = userIdClaim.Value,
                Name = nameClaim.Value
            };
        }
        catch
        {
            return null;
        }
    }
}
