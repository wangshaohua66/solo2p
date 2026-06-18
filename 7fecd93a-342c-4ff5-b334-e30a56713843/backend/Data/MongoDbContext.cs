using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Data;

public interface IMongoDbContext
{
    IMongoCollection<Reservoir> Reservoirs { get; }
    IMongoCollection<RainfallStation> RainfallStations { get; }
    IMongoCollection<WaterLevelReading> WaterLevelReadings { get; }
    IMongoCollection<Gate> Gates { get; }
    IMongoCollection<DispatchOrder> DispatchOrders { get; }
    IMongoCollection<InspectionTask> InspectionTasks { get; }
    IMongoCollection<EmergencyPlan> EmergencyPlans { get; }
    IMongoCollection<Contact> Contacts { get; }
    IMongoCollection<NotificationLog> NotificationLogs { get; }
    IMongoCollection<Levee> Levees { get; }
    Task CreateIndexesAsync(CancellationToken cancellationToken = default);
}

public class MongoDbContext : IMongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IConfiguration configuration)
    {
        var connectionString = configuration.GetSection("MongoDbSettings:ConnectionString").Value;
        var databaseName = configuration.GetSection("MongoDbSettings:DatabaseName").Value;

        var settings = MongoClientSettings.FromConnectionString(connectionString);
        settings.ConnectTimeout = TimeSpan.FromSeconds(10);
        settings.ServerSelectionTimeout = TimeSpan.FromSeconds(10);
        settings.RetryReads = true;
        settings.RetryWrites = true;

        var client = new MongoClient(settings);
        _database = client.GetDatabase(databaseName);
    }

    public IMongoCollection<Reservoir> Reservoirs => _database.GetCollection<Reservoir>("reservoirs");
    public IMongoCollection<RainfallStation> RainfallStations => _database.GetCollection<RainfallStation>("rainfallStations");
    public IMongoCollection<WaterLevelReading> WaterLevelReadings => _database.GetCollection<WaterLevelReading>("waterLevelReadings");
    public IMongoCollection<Gate> Gates => _database.GetCollection<Gate>("gates");
    public IMongoCollection<DispatchOrder> DispatchOrders => _database.GetCollection<DispatchOrder>("dispatchOrders");
    public IMongoCollection<InspectionTask> InspectionTasks => _database.GetCollection<InspectionTask>("inspectionTasks");
    public IMongoCollection<EmergencyPlan> EmergencyPlans => _database.GetCollection<EmergencyPlan>("emergencyPlans");
    public IMongoCollection<Contact> Contacts => _database.GetCollection<Contact>("contacts");
    public IMongoCollection<NotificationLog> NotificationLogs => _database.GetCollection<NotificationLog>("notificationLogs");
    public IMongoCollection<Levee> Levees => _database.GetCollection<Levee>("levees");

    public async Task CreateIndexesAsync(CancellationToken cancellationToken = default)
    {
        var indexModels = new List<CreateIndexModel<WaterLevelReading>>
        {
            new(Builders<WaterLevelReading>.IndexKeys.Ascending(r => r.StationId).Descending(r => r.Timestamp),
                new CreateIndexOptions { Name = "IX_StationId_Timestamp_Desc", Background = true }),
            new(Builders<WaterLevelReading>.IndexKeys.Ascending(r => r.StationType).Descending(r => r.Timestamp),
                new CreateIndexOptions { Name = "IX_StationType_Timestamp", Background = true }),
            new(Builders<WaterLevelReading>.IndexKeys.Ascending(r => r.Timestamp),
                new CreateIndexOptions { Name = "IX_Timestamp", Background = true, ExpireAfter = TimeSpan.FromDays(365 * 5) })
        };
        await WaterLevelReadings.Indexes.CreateManyAsync(indexModels, cancellationToken);

        var dispatchIndexModels = new List<CreateIndexModel<DispatchOrder>>
        {
            new(Builders<DispatchOrder>.IndexKeys.Ascending(o => o.Status),
                new CreateIndexOptions { Name = "IX_Status", Background = true }),
            new(Builders<DispatchOrder>.IndexKeys.Descending(o => o.CreatedAt),
                new CreateIndexOptions { Name = "IX_CreatedAt", Background = true }),
            new(Builders<DispatchOrder>.IndexKeys.Ascending(o => o.ReceiverId).Ascending(o => o.Status),
                new CreateIndexOptions { Name = "IX_ReceiverId_Status", Background = true })
        };
        await DispatchOrders.Indexes.CreateManyAsync(dispatchIndexModels, cancellationToken);

        var inspectionIndexModels = new List<CreateIndexModel<InspectionTask>>
        {
            new(Builders<InspectionTask>.IndexKeys.Ascending(t => t.Status),
                new CreateIndexOptions { Name = "IX_Inspection_Status", Background = true }),
            new(Builders<InspectionTask>.IndexKeys.Ascending(t => t.InspectorId).Ascending(t => t.Status),
                new CreateIndexOptions { Name = "IX_InspectorId_Status", Background = true })
        };
        await InspectionTasks.Indexes.CreateManyAsync(inspectionIndexModels, cancellationToken);

        var notificationIndexModels = new List<CreateIndexModel<NotificationLog>>
        {
            new(Builders<NotificationLog>.IndexKeys.Ascending(n => n.BatchId),
                new CreateIndexOptions { Name = "IX_BatchId", Background = true }),
            new(Builders<NotificationLog>.IndexKeys.Ascending(n => n.RecipientId).Descending(n => n.CreatedAt),
                new CreateIndexOptions { Name = "IX_RecipientId_CreatedAt", Background = true }),
            new(Builders<NotificationLog>.IndexKeys.Ascending(n => n.Status),
                new CreateIndexOptions { Name = "IX_Notification_Status", Background = true })
        };
        await NotificationLogs.Indexes.CreateManyAsync(notificationIndexModels, cancellationToken);

        var leveeIndexModels = new List<CreateIndexModel<Levee>>
        {
            new(Builders<Levee>.IndexKeys.Ascending(l => l.Code),
                new CreateIndexOptions { Name = "IX_Levee_Code_Unique", Unique = true, Background = true }),
            new(Builders<Levee>.IndexKeys.Ascending(l => l.Status),
                new CreateIndexOptions { Name = "IX_Levee_Status", Background = true })
        };
        await Levees.Indexes.CreateManyAsync(leveeIndexModels, cancellationToken);
    }
}
