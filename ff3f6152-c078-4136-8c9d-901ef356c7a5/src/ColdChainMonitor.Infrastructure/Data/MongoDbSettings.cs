namespace ColdChainMonitor.Infrastructure.Data;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "cold_chain_monitor";
    public string TemperatureReadingsCollection { get; set; } = "temperature_readings";
    public string TransportTasksCollection { get; set; } = "transport_tasks";
    public string DevicesCollection { get; set; } = "devices";
    public string AlertsCollection { get; set; } = "alerts";
    public string AlertRulesCollection { get; set; } = "alert_rules";
    public string QualityReportsCollection { get; set; } = "quality_reports";
    public string AuditLogsCollection { get; set; } = "audit_logs";
    public string UsersCollection { get; set; } = "users";
    public string RefreshTokensCollection { get; set; } = "refresh_tokens";
}
