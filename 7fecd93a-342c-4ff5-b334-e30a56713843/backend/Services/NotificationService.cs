using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Services;

public interface INotificationService
{
    Task<NotifyResult> SendBatchNotificationAsync(NotifyRequestDto request);
    Task UpdateNotificationStatusAsync(string notificationId, NotificationStatus status, string? remark = null);
    Task<List<NotificationLogDto>> GetNotificationLogsAsync(string? batchId = null, string? recipientId = null, NotificationStatus? status = null);
    Task<NotificationLogDto?> GetNotificationLogAsync(string id);
}

public class NotificationService : INotificationService
{
    private readonly IMongoDbContext _db;

    public NotificationService(IMongoDbContext db)
    {
        _db = db;
    }

    public async Task<NotifyResult> SendBatchNotificationAsync(NotifyRequestDto request)
    {
        var batchId = Guid.NewGuid().ToString("N");
        var result = new NotifyResult { BatchId = batchId, TotalCount = request.ContactIds.Count };
        var logs = new List<NotificationLog>();

        foreach (var contactId in request.ContactIds.Distinct())
        {
            var contact = await _db.Contacts
                .Find(c => c.Id == contactId)
                .FirstOrDefaultAsync();

            if (contact == null)
            {
                result.FailedCount++;
                continue;
            }

            var log = new NotificationLog
            {
                BatchId = batchId,
                Title = request.Title,
                Content = request.Message,
                Channel = request.Channel,
                SenderName = request.SenderName ?? "系统",
                RecipientId = contact.Id,
                RecipientName = contact.Name,
                RecipientPhone = contact.Phone,
                Priority = request.Priority,
                RelatedType = request.RelatedType,
                RelatedId = request.RelatedId,
                Status = NotificationStatus.Sent,
                SentAt = DateTime.UtcNow
            };

            log.StatusHistory.Add(new NotificationStatusEntry
            {
                Status = NotificationStatus.Sent,
                Timestamp = DateTime.UtcNow,
                Remark = "已发送"
            });

            if (contact.IsOnDuty && !string.IsNullOrEmpty(contact.Phone))
            {
                log.Status = NotificationStatus.Delivered;
                log.DeliveredAt = DateTime.UtcNow;
                log.StatusHistory.Add(new NotificationStatusEntry
                {
                    Status = NotificationStatus.Delivered,
                    Timestamp = DateTime.UtcNow,
                    Remark = "已送达"
                });
                result.SuccessCount++;
            }
            else
            {
                log.Status = NotificationStatus.Failed;
                log.ErrorMessage = "联系人不在值班或无有效联系方式";
                log.StatusHistory.Add(new NotificationStatusEntry
                {
                    Status = NotificationStatus.Failed,
                    Timestamp = DateTime.UtcNow,
                    Remark = "发送失败：联系人不在值班或无有效联系方式"
                });
                result.FailedCount++;
            }

            logs.Add(log);
        }

        if (logs.Count > 0)
            await _db.NotificationLogs.InsertManyAsync(logs);

        return result;
    }

    public async Task UpdateNotificationStatusAsync(string notificationId, NotificationStatus status, string? remark = null)
    {
        var update = Builders<NotificationLog>.Update
            .Set(n => n.Status, status)
            .Set(n => n.UpdatedAt, DateTime.UtcNow)
            .Push(n => n.StatusHistory, new NotificationStatusEntry
            {
                Status = status,
                Timestamp = DateTime.UtcNow,
                Remark = remark
            });

        if (status == NotificationStatus.Delivered)
            update = update.Set(n => n.DeliveredAt, DateTime.UtcNow);
        if (status == NotificationStatus.Read)
            update = update.Set(n => n.ReadAt, DateTime.UtcNow);

        await _db.NotificationLogs.UpdateOneAsync(
            n => n.Id == notificationId,
            update);
    }

    public async Task<List<NotificationLogDto>> GetNotificationLogsAsync(
        string? batchId = null,
        string? recipientId = null,
        NotificationStatus? status = null)
    {
        var filter = Builders<NotificationLog>.Filter.Empty;

        if (!string.IsNullOrEmpty(batchId))
            filter &= Builders<NotificationLog>.Filter.Eq(n => n.BatchId, batchId);
        if (!string.IsNullOrEmpty(recipientId))
            filter &= Builders<NotificationLog>.Filter.Eq(n => n.RecipientId, recipientId);
        if (status.HasValue)
            filter &= Builders<NotificationLog>.Filter.Eq(n => n.Status, status.Value);

        var logs = await _db.NotificationLogs
            .Find(filter)
            .SortByDescending(n => n.CreatedAt)
            .Limit(200)
            .ToListAsync();

        return logs.Select(MapToDto).ToList();
    }

    public async Task<NotificationLogDto?> GetNotificationLogAsync(string id)
    {
        var log = await _db.NotificationLogs
            .Find(n => n.Id == id)
            .FirstOrDefaultAsync();

        return log != null ? MapToDto(log) : null;
    }

    private static NotificationLogDto MapToDto(NotificationLog log)
    {
        return new NotificationLogDto
        {
            Id = log.Id,
            BatchId = log.BatchId,
            Title = log.Title,
            Content = log.Content,
            Channel = log.Channel,
            SenderName = log.SenderName,
            RecipientName = log.RecipientName,
            RecipientPhone = log.RecipientPhone,
            Status = log.Status,
            StatusName = GetStatusName(log.Status),
            SentAt = log.SentAt,
            DeliveredAt = log.DeliveredAt,
            ReadAt = log.ReadAt,
            CreatedAt = log.CreatedAt,
            StatusHistory = log.StatusHistory
        };
    }

    private static string GetStatusName(NotificationStatus status) => status switch
    {
        NotificationStatus.Pending => "待发送",
        NotificationStatus.Sent => "已发送",
        NotificationStatus.Delivered => "已送达",
        NotificationStatus.Read => "已读",
        NotificationStatus.Failed => "失败",
        _ => "未知"
    };
}
