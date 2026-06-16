using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Interfaces;

public interface ISensorRepository : IPagedRepository<Sensor>
{
    Task<Sensor?> GetByDeviceIdAsync(string deviceId);
    Task<Sensor?> GetBySensorCodeAsync(string sensorCode);
    Task<List<Sensor>> GetByVehicleIdAsync(long vehicleId);
    Task<List<Sensor>> GetByWarehouseIdAsync(long warehouseId);
    Task<List<Sensor>> GetActiveSensorsAsync();
    Task UpdateLastReportTimeAsync(long sensorId, DateTime reportTime, double? temperature, double? humidity);
}

public interface IVehicleRepository : IPagedRepository<Vehicle>
{
    Task<Vehicle?> GetByVehicleNumberAsync(string vehicleNumber);
    Task<Vehicle?> GetByPlateNumberAsync(string plateNumber);
    Task<List<Vehicle>> GetActiveVehiclesAsync();
}

public interface IWarehouseRepository : IPagedRepository<Warehouse>
{
    Task<Warehouse?> GetByWarehouseCodeAsync(string warehouseCode);
    Task<List<Warehouse>> GetActiveWarehousesAsync();
}

public interface ICustomerRepository : IPagedRepository<Customer>
{
    Task<Customer?> GetByCustomerCodeAsync(string customerCode);
    Task<List<Customer>> GetActiveCustomersAsync();
}

public interface IShipmentRepository : IPagedRepository<Shipment>
{
    Task<Shipment?> GetByShipmentNumberAsync(string shipmentNumber);
    Task<List<Shipment>> GetByCustomerIdAsync(long customerId, int pageIndex, int pageSize);
    Task<List<Shipment>> GetActiveShipmentsByVehicleIdAsync(long vehicleId);
    Task<Shipment?> GetCurrentShipmentByVehicleIdAsync(long vehicleId);
    Task<Shipment?> GetWithDetailsAsync(long id);
}

public interface IShipmentBatchRepository : IPagedRepository<ShipmentBatch>
{
    Task<ShipmentBatch?> GetByBatchNumberAsync(string batchNumber);
    Task<List<ShipmentBatch>> GetByShipmentIdAsync(long shipmentId);
}

public interface ISensorDataRepository
{
    Task BulkInsertAsync(List<SensorData> data);
    Task<List<SensorData>> GetBySensorIdAsync(long sensorId, DateTime startTime, DateTime endTime);
    Task<List<SensorData>> GetByVehicleIdAsync(long vehicleId, DateTime startTime, DateTime endTime);
    Task<List<SensorData>> GetByShipmentIdAsync(long shipmentId, DateTime startTime, DateTime endTime);
    Task<int> GetCountBySensorIdAsync(long sensorId, DateTime startTime, DateTime endTime);
}

public interface IAlertRuleRepository : IPagedRepository<AlertRule>
{
    Task<List<AlertRule>> GetActiveRulesAsync(long? customerId = null);
    Task<List<AlertRule>> GetRulesWithConditionsAsync(long? customerId = null);
    Task<AlertRule?> GetWithConditionsAsync(long id);
}

public interface IAlertRepository : IPagedRepository<Alert>
{
    Task<Alert?> GetByAlertCodeAsync(string alertCode);
    Task<List<Alert>> GetActiveAlertsAsync(long? customerId = null, long? vehicleId = null);
    Task<List<Alert>> GetAlertsForEscalationAsync(DateTime beforeTime);
    Task<int> GetActiveAlertCountBySensorIdAsync(long sensorId, long alertRuleId);
    Task<int> GetActiveOfflineAlertCountBySensorIdAsync(long sensorId);
    Task<Alert?> GetActiveAlertByRuleAndSensorAsync(long alertRuleId, long sensorId);
}

public interface INotificationRecordRepository : IRepository<NotificationRecord>
{
    Task<List<NotificationRecord>> GetByAlertIdAsync(long alertId);
    Task<List<NotificationRecord>> GetPendingNotificationsAsync();
}

public interface ITraceabilityRepository : IRepository<TraceabilityRecord>
{
    Task<List<TraceabilityRecord>> GetByBatchNumberAsync(string batchNumber);
    Task<List<TraceabilityRecord>> GetByShipmentIdAsync(long shipmentId);
    Task<TraceabilityRecord?> GetByTraceIdAsync(string traceId);
}

public interface IReportRecordRepository : IPagedRepository<ReportRecord>
{
    Task<ReportRecord?> GetByReportNumberAsync(string reportNumber);
    Task<List<ReportRecord>> GetByCustomerIdAsync(long customerId, int pageIndex, int pageSize);
}

public interface IDeviceMaintenanceWindowRepository : IRepository<DeviceMaintenanceWindow>
{
    Task<List<DeviceMaintenanceWindow>> GetBySensorIdAsync(long sensorId);
    Task<List<DeviceMaintenanceWindow>> GetActiveWindowsAsync(DateTime time);
}

public interface INotificationPreferenceRepository : IRepository<NotificationPreference>
{
    Task<List<NotificationPreference>> GetByCustomerIdAsync(long customerId);
    Task<List<NotificationPreference>> GetByCustomerAndSeverityAsync(long customerId, AlertSeverity severity);
}

public interface IAlertRuleAuditLogRepository
{
    Task AddAuditLogAsync(AlertRuleAuditLog auditLog);
    Task<List<AlertRuleAuditLog>> GetAuditLogsByRuleIdAsync(long ruleId);
}
