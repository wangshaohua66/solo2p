using Microsoft.Extensions.Options;
using MongoDB.Driver;
using ColdChainMonitor.Domain.Models;

namespace ColdChainMonitor.Infrastructure.Data;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);

        TemperatureReadings = _database.GetCollection<TemperatureReading>(
            settings.Value.TemperatureReadingsCollection);
        TransportTasks = _database.GetCollection<TransportTask>(
            settings.Value.TransportTasksCollection);
        Devices = _database.GetCollection<Device>(
            settings.Value.DevicesCollection);
        Alerts = _database.GetCollection<Alert>(
            settings.Value.AlertsCollection);
        AlertRules = _database.GetCollection<AlertRule>(
            settings.Value.AlertRulesCollection);
        QualityReports = _database.GetCollection<QualityReport>(
            settings.Value.QualityReportsCollection);
        AuditLogs = _database.GetCollection<AuditLog>(
            settings.Value.AuditLogsCollection);
        Users = _database.GetCollection<User>(
            settings.Value.UsersCollection);
        RefreshTokens = _database.GetCollection<RefreshToken>(
            settings.Value.RefreshTokensCollection);

        CreateIndexes();
    }

    public IMongoCollection<TemperatureReading> TemperatureReadings { get; }
    public IMongoCollection<TransportTask> TransportTasks { get; }
    public IMongoCollection<Device> Devices { get; }
    public IMongoCollection<Alert> Alerts { get; }
    public IMongoCollection<AlertRule> AlertRules { get; }
    public IMongoCollection<QualityReport> QualityReports { get; }
    public IMongoCollection<AuditLog> AuditLogs { get; }
    public IMongoCollection<User> Users { get; }
    public IMongoCollection<RefreshToken> RefreshTokens { get; }

    private void CreateIndexes()
    {
        var temperatureIndexModel = new CreateIndexModel<TemperatureReading>(
            Builders<TemperatureReading>.IndexKeys
                .Ascending(r => r.DeviceId)
                .Descending(r => r.Timestamp),
            new CreateIndexOptions { Unique = false, Background = true });
        TemperatureReadings.Indexes.CreateOne(temperatureIndexModel);

        var transportTaskIndexModel = new CreateIndexModel<TransportTask>(
            Builders<TransportTask>.IndexKeys
                .Ascending(t => t.TaskNo),
            new CreateIndexOptions { Unique = true, Background = true });
        TransportTasks.Indexes.CreateOne(transportTaskIndexModel);

        var deviceIndexModel = new CreateIndexModel<Device>(
            Builders<Device>.IndexKeys
                .Ascending(d => d.DeviceId),
            new CreateIndexOptions { Unique = true, Background = true });
        Devices.Indexes.CreateOne(deviceIndexModel);

        var alertIndexModel = new CreateIndexModel<Alert>(
            Builders<Alert>.IndexKeys
                .Ascending(a => a.DeviceId)
                .Descending(a => a.CreatedAt),
            new CreateIndexOptions { Unique = false, Background = true });
        Alerts.Indexes.CreateOne(alertIndexModel);

        var userIndexModel = new CreateIndexModel<User>(
            Builders<User>.IndexKeys
                .Ascending(u => u.Username),
            new CreateIndexOptions { Unique = true, Background = true });
        Users.Indexes.CreateOne(userIndexModel);

        var auditLogIndexModel = new CreateIndexModel<AuditLog>(
            Builders<AuditLog>.IndexKeys
                .Descending(a => a.Timestamp)
                .Ascending(a => a.Module)
                .Ascending(a => a.OperatorId),
            new CreateIndexOptions { Unique = false, Background = true });
        AuditLogs.Indexes.CreateOne(auditLogIndexModel);
    }
}
