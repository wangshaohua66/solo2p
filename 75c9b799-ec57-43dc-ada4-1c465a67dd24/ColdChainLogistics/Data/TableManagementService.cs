using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Models.Entities;

namespace ColdChainLogistics.Data;

public interface ITableManagementService
{
    Task EnsureSensorDataTableExistsAsync(DateTime forDate);
    Task EnsureWarehouseEnvTableExistsAsync(DateTime forDate);
    Task CreateNextMonthTablesAsync();
    Task EnsureCurrentMonthTablesExistAsync();
    Task<List<string>> GetExistingSensorDataTablesAsync();
}

public class TableManagementService : ITableManagementService
{
    private readonly AppDbContext _dbContext;

    public TableManagementService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task EnsureSensorDataTableExistsAsync(DateTime forDate)
    {
        var tableName = TableNameHelper.GetSensorDataTableName(forDate);
        if (!await TableExistsAsync(tableName))
        {
            await CreateSensorDataTableAsync(tableName);
        }
    }

    public async Task EnsureWarehouseEnvTableExistsAsync(DateTime forDate)
    {
        var tableName = TableNameHelper.GetWarehouseEnvTableName(forDate);
        if (!await TableExistsAsync(tableName))
        {
            await CreateWarehouseEnvTableAsync(tableName);
        }
    }

    public async Task CreateNextMonthTablesAsync()
    {
        var nextMonth = DateTime.Now.AddMonths(1);
        await EnsureSensorDataTableExistsAsync(nextMonth);
        await EnsureWarehouseEnvTableExistsAsync(nextMonth);
    }

    public async Task EnsureCurrentMonthTablesExistAsync()
    {
        var now = DateTime.Now;
        await EnsureSensorDataTableExistsAsync(now);
        await EnsureWarehouseEnvTableExistsAsync(now);
    }

    public async Task<List<string>> GetExistingSensorDataTablesAsync()
    {
        var sql = @"
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name LIKE 'sensor_data_%'
            ORDER BY table_name DESC";

        var tables = new List<string>();
        await using var command = _dbContext.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        await _dbContext.Database.OpenConnectionAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            tables.Add(reader.GetString(0));
        }
        return tables;
    }

    private async Task<bool> TableExistsAsync(string tableName)
    {
        var sql = @"
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = @tableName";

        await using var command = _dbContext.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        var param = command.CreateParameter();
        param.ParameterName = "@tableName";
        param.Value = tableName;
        command.Parameters.Add(param);

        await _dbContext.Database.OpenConnectionAsync();
        var result = await command.ExecuteScalarAsync();
        return Convert.ToInt32(result) > 0;
    }

    private async Task CreateSensorDataTableAsync(string tableName)
    {
        var sql = $@"
            CREATE TABLE IF NOT EXISTS `{tableName}` (
                `Id` BIGINT NOT NULL AUTO_INCREMENT,
                `SensorId` BIGINT NOT NULL,
                `VehicleId` BIGINT NULL,
                `ShipmentId` BIGINT NULL,
                `Timestamp` DATETIME NOT NULL,
                `Temperature` DOUBLE NOT NULL,
                `Humidity` DOUBLE NOT NULL,
                `Quality` INT NOT NULL DEFAULT 1,
                `ValidationErrors` VARCHAR(1000) NULL,
                `Latitude` DOUBLE NULL,
                `Longitude` DOUBLE NULL,
                `RawPayload` JSON NULL,
                PRIMARY KEY (`Id`),
                INDEX `IX_{tableName}_SensorId_Timestamp` (`SensorId` ASC, `Timestamp` ASC),
                INDEX `IX_{tableName}_VehicleId_Timestamp` (`VehicleId` ASC, `Timestamp` ASC),
                INDEX `IX_{tableName}_ShipmentId_Timestamp` (`ShipmentId` ASC, `Timestamp` ASC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

        await _dbContext.Database.ExecuteSqlRawAsync(sql);
    }

    private async Task CreateWarehouseEnvTableAsync(string tableName)
    {
        var sql = $@"
            CREATE TABLE IF NOT EXISTS `{tableName}` (
                `Id` BIGINT NOT NULL AUTO_INCREMENT,
                `WarehouseId` BIGINT NOT NULL,
                `SensorId` BIGINT NOT NULL,
                `RecordTime` DATETIME NOT NULL,
                `Temperature` DOUBLE NOT NULL,
                `Humidity` DOUBLE NOT NULL,
                `Quality` INT NOT NULL DEFAULT 1,
                `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `UpdatedAt` DATETIME NULL,
                `IsDeleted` TINYINT NOT NULL DEFAULT 0,
                PRIMARY KEY (`Id`),
                INDEX `IX_{tableName}_WarehouseId_RecordTime` (`WarehouseId` ASC, `RecordTime` ASC),
                INDEX `IX_{tableName}_SensorId_RecordTime` (`SensorId` ASC, `RecordTime` ASC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

        await _dbContext.Database.ExecuteSqlRawAsync(sql);
    }
}
