using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class SensorDataRepository : ISensorDataRepository
{
    private readonly AppDbContext _context;
    private readonly ITableManagementService _tableManagementService;

    public SensorDataRepository(AppDbContext context, ITableManagementService tableManagementService)
    {
        _context = context;
        _tableManagementService = tableManagementService;
    }

    public async Task BulkInsertAsync(List<SensorData> data)
    {
        if (data == null || data.Count == 0)
            return;

        var groupedByMonth = data.GroupBy(d => new DateTime(d.Timestamp.Year, d.Timestamp.Month, 1));

        foreach (var group in groupedByMonth)
        {
            await _tableManagementService.EnsureSensorDataTableExistsAsync(group.Key);
            var tableName = TableNameHelper.GetSensorDataTableName(group.Key);
            var items = group.ToList();
            await BulkInsertIntoTableAsync(tableName, items);
        }
    }

    private async Task BulkInsertIntoTableAsync(string tableName, List<SensorData> data)
    {
        const int batchSize = 500;
        for (int i = 0; i < data.Count; i += batchSize)
        {
            var batch = data.Skip(i).Take(batchSize).ToList();
            var values = new List<string>();
            var parameters = new List<object>();
            var paramIndex = 0;

            foreach (var item in batch)
            {
                values.Add($"(@p{paramIndex}, @p{paramIndex + 1}, @p{paramIndex + 2}, @p{paramIndex + 3}, @p{paramIndex + 4}, @p{paramIndex + 5}, @p{paramIndex + 6}, @p{paramIndex + 7}, @p{paramIndex + 8}, @p{paramIndex + 9}, @p{paramIndex + 10})");
                parameters.Add(item.SensorId);
                parameters.Add(item.VehicleId.HasValue ? item.VehicleId.Value : DBNull.Value);
                parameters.Add(item.ShipmentId.HasValue ? item.ShipmentId.Value : DBNull.Value);
                parameters.Add(item.Timestamp);
                parameters.Add(item.Temperature);
                parameters.Add(item.Humidity);
                parameters.Add((int)item.Quality);
                parameters.Add(item.ValidationErrors ?? (object)DBNull.Value);
                parameters.Add(item.Latitude.HasValue ? item.Latitude.Value : DBNull.Value);
                parameters.Add(item.Longitude.HasValue ? item.Longitude.Value : DBNull.Value);
                parameters.Add(item.RawPayload ?? (object)DBNull.Value);
                paramIndex += 11;
            }

            var sql = $@"INSERT INTO `{tableName}` 
                (`SensorId`, `VehicleId`, `ShipmentId`, `Timestamp`, `Temperature`, `Humidity`, `Quality`, `ValidationErrors`, `Latitude`, `Longitude`, `RawPayload`)
                VALUES {string.Join(", ", values)}";

            await _context.Database.ExecuteSqlRawAsync(sql, parameters);
        }
    }

    public async Task<List<SensorData>> GetBySensorIdAsync(long sensorId, DateTime startTime, DateTime endTime)
    {
        var tableNames = TableNameHelper.GetSensorDataTableNames(startTime, endTime);
        var result = new List<SensorData>();

        foreach (var tableName in tableNames)
        {
            var sql = $@"
                SELECT * FROM `{tableName}`
                WHERE SensorId = @SensorId
                AND Timestamp >= @StartTime
                AND Timestamp <= @EndTime
                ORDER BY Timestamp ASC";

            await using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            AddParameter(command, "SensorId", sensorId);
            AddParameter(command, "StartTime", startTime);
            AddParameter(command, "EndTime", endTime);

            var data = await ExecuteQueryAsync(command);
            result.AddRange(data);
        }

        return result.OrderBy(d => d.Timestamp).ToList();
    }

    public async Task<List<SensorData>> GetByVehicleIdAsync(long vehicleId, DateTime startTime, DateTime endTime)
    {
        var tableNames = TableNameHelper.GetSensorDataTableNames(startTime, endTime);
        var result = new List<SensorData>();

        foreach (var tableName in tableNames)
        {
            var sql = $@"
                SELECT * FROM `{tableName}`
                WHERE VehicleId = @VehicleId
                AND Timestamp >= @StartTime
                AND Timestamp <= @EndTime
                ORDER BY Timestamp ASC";

            await using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            AddParameter(command, "VehicleId", vehicleId);
            AddParameter(command, "StartTime", startTime);
            AddParameter(command, "EndTime", endTime);

            var data = await ExecuteQueryAsync(command);
            result.AddRange(data);
        }

        return result.OrderBy(d => d.Timestamp).ToList();
    }

    public async Task<List<SensorData>> GetByShipmentIdAsync(long shipmentId, DateTime startTime, DateTime endTime)
    {
        var tableNames = TableNameHelper.GetSensorDataTableNames(startTime, endTime);
        var result = new List<SensorData>();

        foreach (var tableName in tableNames)
        {
            var sql = $@"
                SELECT * FROM `{tableName}`
                WHERE ShipmentId = @ShipmentId
                AND Timestamp >= @StartTime
                AND Timestamp <= @EndTime
                ORDER BY Timestamp ASC";

            await using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            AddParameter(command, "ShipmentId", shipmentId);
            AddParameter(command, "StartTime", startTime);
            AddParameter(command, "EndTime", endTime);

            var data = await ExecuteQueryAsync(command);
            result.AddRange(data);
        }

        return result.OrderBy(d => d.Timestamp).ToList();
    }

    public async Task<int> GetCountBySensorIdAsync(long sensorId, DateTime startTime, DateTime endTime)
    {
        var tableNames = TableNameHelper.GetSensorDataTableNames(startTime, endTime);
        var totalCount = 0;

        foreach (var tableName in tableNames)
        {
            var sql = $@"
                SELECT COUNT(*) FROM `{tableName}`
                WHERE SensorId = @SensorId
                AND Timestamp >= @StartTime
                AND Timestamp <= @EndTime";

            await using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            AddParameter(command, "SensorId", sensorId);
            AddParameter(command, "StartTime", startTime);
            AddParameter(command, "EndTime", endTime);

            await _context.Database.OpenConnectionAsync();
            var result = await command.ExecuteScalarAsync();
            totalCount += Convert.ToInt32(result);
        }

        return totalCount;
    }

    private async Task<List<SensorData>> ExecuteQueryAsync(DbCommand command)
    {
        var result = new List<SensorData>();

        await _context.Database.OpenConnectionAsync();
        await using var reader = await command.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var data = new SensorData
            {
                Id = reader.GetInt64(reader.GetOrdinal("Id")),
                SensorId = reader.GetInt64(reader.GetOrdinal("SensorId")),
                VehicleId = reader.IsDBNull(reader.GetOrdinal("VehicleId")) ? null : reader.GetInt64(reader.GetOrdinal("VehicleId")),
                ShipmentId = reader.IsDBNull(reader.GetOrdinal("ShipmentId")) ? null : reader.GetInt64(reader.GetOrdinal("ShipmentId")),
                Timestamp = reader.GetDateTime(reader.GetOrdinal("Timestamp")),
                Temperature = reader.GetDouble(reader.GetOrdinal("Temperature")),
                Humidity = reader.GetDouble(reader.GetOrdinal("Humidity")),
                Quality = (DataQuality)reader.GetInt32(reader.GetOrdinal("Quality")),
                ValidationErrors = reader.IsDBNull(reader.GetOrdinal("ValidationErrors")) ? null : reader.GetString(reader.GetOrdinal("ValidationErrors")),
                Latitude = reader.IsDBNull(reader.GetOrdinal("Latitude")) ? null : reader.GetDouble(reader.GetOrdinal("Latitude")),
                Longitude = reader.IsDBNull(reader.GetOrdinal("Longitude")) ? null : reader.GetDouble(reader.GetOrdinal("Longitude")),
                RawPayload = reader.IsDBNull(reader.GetOrdinal("RawPayload")) ? null : reader.GetString(reader.GetOrdinal("RawPayload"))
            };
            result.Add(data);
        }

        return result;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
