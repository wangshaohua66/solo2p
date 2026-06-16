namespace ColdChainLogistics.Data;

public static class TableNameHelper
{
    public static string GetSensorDataTableName(DateTime dateTime)
    {
        return $"sensor_data_{dateTime:yyyyMM}";
    }

    public static string GetSensorDataTableNameByYearMonth(int year, int month)
    {
        return $"sensor_data_{year}{month:D2}";
    }

    public static List<string> GetSensorDataTableNames(DateTime startTime, DateTime endTime)
    {
        var tableNames = new List<string>();
        var current = new DateTime(startTime.Year, startTime.Month, 1);
        var endMonth = new DateTime(endTime.Year, endTime.Month, 1);

        while (current <= endMonth)
        {
            tableNames.Add(GetSensorDataTableName(current));
            current = current.AddMonths(1);
        }

        return tableNames;
    }

    public static string GetWarehouseEnvTableName(DateTime dateTime)
    {
        return $"warehouse_env_records_{dateTime:yyyyMM}";
    }

    public static List<string> GetWarehouseEnvTableNames(DateTime startTime, DateTime endTime)
    {
        var tableNames = new List<string>();
        var current = new DateTime(startTime.Year, startTime.Month, 1);
        var endMonth = new DateTime(endTime.Year, endTime.Month, 1);

        while (current <= endMonth)
        {
            tableNames.Add(GetWarehouseEnvTableName(current));
            current = current.AddMonths(1);
        }

        return tableNames;
    }
}
