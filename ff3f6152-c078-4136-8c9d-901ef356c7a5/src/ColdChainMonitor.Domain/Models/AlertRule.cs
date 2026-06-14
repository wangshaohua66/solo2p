using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Domain.Models;

public class AlertRule
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonElement("ruleName")]
    public string RuleName { get; set; } = string.Empty;

    [BsonElement("ruleCode")]
    public string RuleCode { get; set; } = string.Empty;

    [BsonElement("alertType")]
    public AlertType AlertType { get; set; }

    [BsonElement("alertLevel")]
    public AlertLevel AlertLevel { get; set; }

    [BsonElement("metricType")]
    public MetricType MetricType { get; set; }

    [BsonElement("operator")]
    public ComparisonOperator Operator { get; set; }

    [BsonElement("threshold")]
    public double Threshold { get; set; }

    [BsonElement("durationSeconds")]
    public int DurationSeconds { get; set; } = 0;

    [BsonElement("scope")]
    public RuleScope Scope { get; set; } = RuleScope.Global;

    [BsonElement("targetDeviceIds")]
    public List<string>? TargetDeviceIds { get; set; }

    [BsonElement("targetVehicleIds")]
    public List<string>? TargetVehicleIds { get; set; }

    [BsonElement("isEnabled")]
    public bool IsEnabled { get; set; } = true;

    [BsonElement("notificationChannels")]
    public List<NotificationChannel> NotificationChannels { get; set; } = new();

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("priority")]
    public int Priority { get; set; } = 100;

    [BsonElement("createdBy")]
    public string? CreatedBy { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedBy")]
    public string? UpdatedBy { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum MetricType
{
    Temperature = 0,
    Humidity = 1,
    Battery = 2,
    Signal = 3,
    OnlineStatus = 4
}

public enum ComparisonOperator
{
    GreaterThan = 0,
    LessThan = 1,
    GreaterThanOrEqual = 2,
    LessThanOrEqual = 3,
    Equal = 4,
    NotEqual = 5
}

public enum RuleScope
{
    Global = 0,
    DeviceGroup = 1,
    SpecificDevices = 2
}

public class NotificationChannel
{
    [BsonElement("channelType")]
    public NotificationChannelType ChannelType { get; set; }

    [BsonElement("target")]
    public string Target { get; set; } = string.Empty;

    [BsonElement("isEnabled")]
    public bool IsEnabled { get; set; } = true;
}

public enum NotificationChannelType
{
    SystemMessage = 0,
    Sms = 1,
    Email = 2,
    Wechat = 3,
    AppPush = 4
}
