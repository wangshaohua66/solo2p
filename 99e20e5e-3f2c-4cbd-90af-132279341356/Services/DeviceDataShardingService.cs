using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public interface IDeviceDataShardingService
{
    string GetTableName(DateTime timestamp);
    Task EnsureTableExistsAsync(DateTime timestamp);
    Task EnsureTablesForRangeAsync(DateTime startDate, DateTime endDate);
    Task InsertDeviceDataAsync(DeviceData data);
    Task BatchInsertDeviceDataAsync(List<DeviceData> dataList);
    Task<List<DeviceData>> GetDeviceDataByDateRangeAsync(long deviceId, DateTime startTime, DateTime endTime);
    Task<List<DeviceData>> GetUnitDataByDateRangeAsync(long fireUnitId, DateTime startTime, DateTime endTime);
    Task<long> GetDeviceDataCountAsync(long deviceId, DateTime startTime, DateTime endTime);
    Task<Dictionary<DateTime, decimal?>> GetHourlyStatisticsAsync(long deviceId, DateTime date);
    Task<List<DeviceData>> GetLatestDataAsync(long deviceId, int count = 100);
    Task CleanupOldDataAsync(int retentionMonths);
}

public class DeviceDataShardingService : IDeviceDataShardingService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<DeviceDataShardingService> _logger;
    private readonly object _tableLock = new();
    private readonly HashSet<string> _existingTables = new();

    public DeviceDataShardingService(AppDbContext dbContext, ILogger<DeviceDataShardingService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public string GetTableName(DateTime timestamp)
    {
        return $"device_data_{timestamp:yyyyMM}";
    }

    public async Task EnsureTableExistsAsync(DateTime timestamp)
    {
        var tableName = GetTableName(timestamp);
        if (_existingTables.Contains(tableName)) return;

        lock (_tableLock)
        {
            if (_existingTables.Contains(tableName)) return;
        }

        var connection = _dbContext.Database.GetDbConnection();
        try
        {
            await connection.OpenAsync();

            var checkSql = $@"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = '{tableName}'";

            using var checkCommand = connection.CreateCommand();
            checkCommand.CommandText = checkSql;
            var result = await checkCommand.ExecuteScalarAsync();
            var exists = Convert.ToInt64(result) > 0;

            if (!exists)
            {
                var createSql = $@"
                    CREATE TABLE IF NOT EXISTS `{tableName}` (
                        `Id` BIGINT NOT NULL AUTO_INCREMENT,
                        `DeviceId` BIGINT NOT NULL,
                        `FireUnitId` BIGINT NOT NULL,
                        `DeviceType` INT NOT NULL,
                        `Value` DECIMAL(18,4) NULL,
                        `RawData` TEXT NULL,
                        `Status` INT NOT NULL,
                        `Timestamp` DATETIME NOT NULL,
                        `Year` INT NOT NULL,
                        `Month` INT NOT NULL,
                        `Day` INT NOT NULL,
                        `Hour` INT NOT NULL,
                        PRIMARY KEY (`Id`),
                        INDEX `idx_device_timestamp` (`DeviceId`, `Timestamp`),
                        INDEX `idx_unit_timestamp` (`FireUnitId`, `Timestamp`),
                        INDEX `idx_year_month_device` (`Year`, `Month`, `DeviceId`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备上报数据-按月分表';";

                using var createCommand = connection.CreateCommand();
                createCommand.CommandText = createSql;
                await createCommand.ExecuteNonQueryAsync();

                _logger.LogInformation($"已创建设备数据分表: {tableName}");
            }

            lock (_tableLock)
            {
                _existingTables.Add(tableName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"创建设备数据分表失败: {tableName}");
            throw;
        }
        finally
        {
            connection.Close();
        }
    }

    public async Task EnsureTablesForRangeAsync(DateTime startDate, DateTime endDate)
    {
        var current = new DateTime(startDate.Year, startDate.Month, 1);
        while (current <= endDate)
        {
            await EnsureTableExistsAsync(current);
            current = current.AddMonths(1);
        }
    }

    public async Task InsertDeviceDataAsync(DeviceData data)
    {
        var tableName = GetTableName(data.Timestamp);
        await EnsureTableExistsAsync(data.Timestamp);

        var sql = $@"
            INSERT INTO `{tableName}` 
            (`DeviceId`, `FireUnitId`, `DeviceType`, `Value`, `RawData`, `Status`, `Timestamp`, `Year`, `Month`, `Day`, `Hour`)
            VALUES (@DeviceId, @FireUnitId, @DeviceType, @Value, @RawData, @Status, @Timestamp, @Year, @Month, @Day, @Hour)";

        await _dbContext.Database.ExecuteSqlRawAsync(sql,
            new MySqlConnector.MySqlParameter("@DeviceId", data.DeviceId),
            new MySqlConnector.MySqlParameter("@FireUnitId", data.FireUnitId),
            new MySqlConnector.MySqlParameter("@DeviceType", (int)data.DeviceType),
            new MySqlConnector.MySqlParameter("@Value", data.Value.HasValue ? (object)data.Value.Value : DBNull.Value),
            new MySqlConnector.MySqlParameter("@RawData", data.RawData ?? (object)DBNull.Value),
            new MySqlConnector.MySqlParameter("@Status", (int)data.Status),
            new MySqlConnector.MySqlParameter("@Timestamp", data.Timestamp),
            new MySqlConnector.MySqlParameter("@Year", data.Year),
            new MySqlConnector.MySqlParameter("@Month", data.Month),
            new MySqlConnector.MySqlParameter("@Day", data.Day),
            new MySqlConnector.MySqlParameter("@Hour", data.Hour));
    }

    public async Task BatchInsertDeviceDataAsync(List<DeviceData> dataList)
    {
        if (dataList == null || !dataList.Any()) return;

        var groupedByMonth = dataList.GroupBy(d => new { d.Year, d.Month });

        foreach (var group in groupedByMonth)
        {
            var timestamp = new DateTime(group.Key.Year, group.Key.Month, 1);
            await EnsureTableExistsAsync(timestamp);
            var tableName = GetTableName(timestamp);

            var values = new List<string>();
            var parameters = new List<MySqlConnector.MySqlParameter>();
            var paramIndex = 0;

            foreach (var data in group.Take(1000))
            {
                var idx = paramIndex++;
                values.Add($"(@p{idx}_0, @p{idx}_1, @p{idx}_2, @p{idx}_3, @p{idx}_4, @p{idx}_5, @p{idx}_6, @p{idx}_7, @p{idx}_8, @p{idx}_9, @p{idx}_10)");
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_0", data.DeviceId));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_1", data.FireUnitId));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_2", (int)data.DeviceType));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_3", data.Value.HasValue ? (object)data.Value.Value : DBNull.Value));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_4", data.RawData ?? (object)DBNull.Value));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_5", (int)data.Status));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_6", data.Timestamp));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_7", data.Year));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_8", data.Month));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_9", data.Day));
                parameters.Add(new MySqlConnector.MySqlParameter($"@p{idx}_10", data.Hour));
            }

            if (values.Any())
            {
                var sql = $@"
                    INSERT INTO `{tableName}` 
                    (`DeviceId`, `FireUnitId`, `DeviceType`, `Value`, `RawData`, `Status`, `Timestamp`, `Year`, `Month`, `Day`, `Hour`)
                    VALUES {string.Join(", ", values)}";

                await _dbContext.Database.ExecuteSqlRawAsync(sql, parameters.ToArray());
            }
        }
    }

    public async Task<List<DeviceData>> GetDeviceDataByDateRangeAsync(long deviceId, DateTime startTime, DateTime endTime)
    {
        var result = new List<DeviceData>();
        var startMonth = new DateTime(startTime.Year, startTime.Month, 1);
        var endMonth = new DateTime(endTime.Year, endTime.Month, 1);

        var current = startMonth;
        while (current <= endMonth)
        {
            var tableName = GetTableName(current);
            try
            {
                var sql = $@"
                    SELECT * FROM `{tableName}`
                    WHERE DeviceId = @DeviceId
                    AND Timestamp >= @StartTime
                    AND Timestamp <= @EndTime
                    ORDER BY Timestamp ASC";

                var data = await _dbContext.DeviceDatas
                    .FromSqlRaw(sql,
                        new MySqlConnector.MySqlParameter("@DeviceId", deviceId),
                        new MySqlConnector.MySqlParameter("@StartTime", startTime),
                        new MySqlConnector.MySqlParameter("@EndTime", endTime))
                    .AsNoTracking()
                    .ToListAsync();

                result.AddRange(data);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"查询分表数据失败: {tableName}, DeviceId: {deviceId}");
            }
            current = current.AddMonths(1);
        }

        return result.OrderBy(d => d.Timestamp).ToList();
    }

    public async Task<List<DeviceData>> GetUnitDataByDateRangeAsync(long fireUnitId, DateTime startTime, DateTime endTime)
    {
        var result = new List<DeviceData>();
        var startMonth = new DateTime(startTime.Year, startTime.Month, 1);
        var endMonth = new DateTime(endTime.Year, endTime.Month, 1);

        var current = startMonth;
        while (current <= endMonth)
        {
            var tableName = GetTableName(current);
            try
            {
                var sql = $@"
                    SELECT * FROM `{tableName}`
                    WHERE FireUnitId = @FireUnitId
                    AND Timestamp >= @StartTime
                    AND Timestamp <= @EndTime
                    ORDER BY Timestamp ASC
                    LIMIT 10000";

                var data = await _dbContext.DeviceDatas
                    .FromSqlRaw(sql,
                        new MySqlConnector.MySqlParameter("@FireUnitId", fireUnitId),
                        new MySqlConnector.MySqlParameter("@StartTime", startTime),
                        new MySqlConnector.MySqlParameter("@EndTime", endTime))
                    .AsNoTracking()
                    .ToListAsync();

                result.AddRange(data);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"查询分表数据失败: {tableName}, FireUnitId: {fireUnitId}");
            }
            current = current.AddMonths(1);
        }

        return result.OrderBy(d => d.Timestamp).ToList();
    }

    public async Task<long> GetDeviceDataCountAsync(long deviceId, DateTime startTime, DateTime endTime)
    {
        long totalCount = 0;
        var startMonth = new DateTime(startTime.Year, startTime.Month, 1);
        var endMonth = new DateTime(endTime.Year, endTime.Month, 1);

        var current = startMonth;
        while (current <= endMonth)
        {
            var tableName = GetTableName(current);
            try
            {
                var sql = $@"
                    SELECT COUNT(*) FROM `{tableName}`
                    WHERE DeviceId = @DeviceId
                    AND Timestamp >= @StartTime
                    AND Timestamp <= @EndTime";

                var connection = _dbContext.Database.GetDbConnection();
                await connection.OpenAsync();
                using var command = connection.CreateCommand();
                command.CommandText = sql;
                command.Parameters.Add(new MySqlConnector.MySqlParameter("@DeviceId", deviceId));
                command.Parameters.Add(new MySqlConnector.MySqlParameter("@StartTime", startTime));
                command.Parameters.Add(new MySqlConnector.MySqlParameter("@EndTime", endTime));

                var result = await command.ExecuteScalarAsync();
                totalCount += Convert.ToInt64(result);
                connection.Close();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"统计分表数据失败: {tableName}");
            }
            current = current.AddMonths(1);
        }

        return totalCount;
    }

    public async Task<Dictionary<DateTime, decimal?>> GetHourlyStatisticsAsync(long deviceId, DateTime date)
    {
        var result = new Dictionary<DateTime, decimal?>();
        var tableName = GetTableName(date);
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1).AddSeconds(-1);

        try
        {
            var sql = $@"
                SELECT `Hour`, AVG(`Value`) as AvgValue, 
                       MIN(`Value`) as MinValue, 
                       MAX(`Value`) as MaxValue
                FROM `{tableName}`
                WHERE DeviceId = @DeviceId
                AND Timestamp >= @DayStart
                AND Timestamp <= @DayEnd
                GROUP BY `Hour`
                ORDER BY `Hour`";

            var connection = _dbContext.Database.GetDbConnection();
            await connection.OpenAsync();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.Parameters.Add(new MySqlConnector.MySqlParameter("@DeviceId", deviceId));
            command.Parameters.Add(new MySqlConnector.MySqlParameter("@DayStart", dayStart));
            command.Parameters.Add(new MySqlConnector.MySqlParameter("@DayEnd", dayEnd));

            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var hour = reader.GetInt32(reader.GetOrdinal("Hour"));
                var avgValue = reader.IsDBNull(reader.GetOrdinal("AvgValue"))
                    ? (decimal?)null
                    : reader.GetDecimal(reader.GetOrdinal("AvgValue"));
                result[dayStart.AddHours(hour)] = avgValue;
            }
            connection.Close();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, $"获取小时统计数据失败: {tableName}, DeviceId: {deviceId}");
        }

        return result;
    }

    public async Task<List<DeviceData>> GetLatestDataAsync(long deviceId, int count = 100)
    {
        var result = new List<DeviceData>();
        var current = DateTime.Now;

        for (int i = 0; i < 6; i++)
        {
            var tableName = GetTableName(current.AddMonths(-i));
            try
            {
                var sql = $@"
                    SELECT * FROM `{tableName}`
                    WHERE DeviceId = @DeviceId
                    ORDER BY Timestamp DESC
                    LIMIT @Count";

                var data = await _dbContext.DeviceDatas
                    .FromSqlRaw(sql,
                        new MySqlConnector.MySqlParameter("@DeviceId", deviceId),
                        new MySqlConnector.MySqlParameter("@Count", count))
                    .AsNoTracking()
                    .ToListAsync();

                result.AddRange(data);

                if (result.Count >= count) break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"查询最新数据失败: {tableName}, DeviceId: {deviceId}");
            }
        }

        return result.OrderByDescending(d => d.Timestamp).Take(count).ToList();
    }

    public async Task CleanupOldDataAsync(int retentionMonths)
    {
        var cutoffDate = DateTime.Now.AddMonths(-retentionMonths);
        var cutoffMonth = new DateTime(cutoffDate.Year, cutoffDate.Month, 1);

        var connection = _dbContext.Database.GetDbConnection();
        await connection.OpenAsync();

        try
        {
            var checkSql = @"
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name LIKE 'device_data_%'
                ORDER BY table_name";

            using var checkCommand = connection.CreateCommand();
            checkCommand.CommandText = checkSql;
            using var reader = await checkCommand.ExecuteReaderAsync();

            var tablesToDrop = new List<string>();
            while (await reader.ReadAsync())
            {
                var tableName = reader.GetString(0);
                var datePart = tableName.Replace("device_data_", "");
                if (DateTime.TryParseExact(datePart, "yyyyMM", null, System.Globalization.DateTimeStyles.None, out var tableDate))
                {
                    if (tableDate < cutoffMonth)
                    {
                        tablesToDrop.Add(tableName);
                    }
                }
            }
            reader.Close();

            foreach (var table in tablesToDrop)
            {
                var dropSql = $"DROP TABLE IF EXISTS `{table}`";
                using var dropCommand = connection.CreateCommand();
                dropCommand.CommandText = dropSql;
                await dropCommand.ExecuteNonQueryAsync();
                _logger.LogInformation($"已清理历史数据分表: {table}");

                lock (_tableLock)
                {
                    _existingTables.Remove(table);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "清理历史数据失败");
        }
        finally
        {
            connection.Close();
        }
    }
}
