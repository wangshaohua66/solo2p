using ColdChainMonitor.Domain.Interfaces;
using ColdChainMonitor.Domain.Models;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Application.Services;

public class TransportService
{
    private readonly ITransportTaskRepository _taskRepository;
    private readonly IAuditLogRepository _auditLogRepository;

    public TransportService(
        ITransportTaskRepository taskRepository,
        IAuditLogRepository auditLogRepository)
    {
        _taskRepository = taskRepository;
        _auditLogRepository = auditLogRepository;
    }

    public async Task<TransportTaskDto?> GetByIdAsync(string id)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        return task == null ? null : MapToDto(task);
    }

    public async Task<TransportTaskDto?> GetByTaskNoAsync(string taskNo)
    {
        var task = await _taskRepository.GetByTaskNoAsync(taskNo);
        return task == null ? null : MapToDto(task);
    }

    public async Task<CursorPagedResult<TransportTaskDto>> GetPagedAsync(TransportTaskQueryRequest request)
    {
        var result = await _taskRepository.GetPagedAsync(
            request.Status,
            request.Keyword,
            request.VehicleId,
            request.DriverId,
            request.StartTime,
            request.EndTime,
            request.Cursor,
            request.Limit,
            request.SortDesc);

        return new CursorPagedResult<TransportTaskDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            NextCursor = result.NextCursor,
            HasMore = result.HasMore,
            Limit = result.Limit,
            TotalCount = result.TotalCount
        };
    }

    public async Task<TransportTaskDto> CreateAsync(CreateTransportTaskRequest request, string operatorId, string operatorName)
    {
        var taskNo = GenerateTaskNo();

        var task = new TransportTask
        {
            TaskNo = taskNo,
            Status = TransportStatus.Pending,
            DrugBatch = new DrugBatchInfo
            {
                BatchNo = request.DrugBatchNo,
                DrugName = request.DrugName,
                DrugType = request.DrugType,
                Quantity = request.Quantity,
                Unit = request.Unit,
                Manufacturer = request.Manufacturer,
                ProductionDate = request.ProductionDate,
                ExpiryDate = request.ExpiryDate
            },
            Vehicle = new VehicleInfo
            {
                VehicleId = request.VehicleId,
                PlateNumber = request.PlateNumber,
                VehicleType = request.VehicleType
            },
            Driver = new DriverInfo
            {
                DriverId = request.DriverId,
                DriverName = request.DriverName,
                Phone = request.DriverPhone
            },
            Origin = new LocationInfo
            {
                Name = request.OriginName,
                Address = request.OriginAddress,
                Contact = request.OriginContact,
                Phone = request.OriginPhone
            },
            Destination = new LocationInfo
            {
                Name = request.DestinationName,
                Address = request.DestinationAddress,
                Contact = request.DestinationContact,
                Phone = request.DestinationPhone
            },
            DeviceIds = request.DeviceIds,
            TemperatureRange = new TemperatureRange
            {
                MinTemp = request.MinTemp,
                MaxTemp = request.MaxTemp,
                MinHumidity = request.MinHumidity,
                MaxHumidity = request.MaxHumidity
            },
            PlannedDepartureAt = request.PlannedDepartureAt,
            PlannedArrivalAt = request.PlannedArrivalAt,
            CreatedBy = operatorId,
            CreatedByName = operatorName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            StatusHistory = new List<StatusChangeRecord>
            {
                new()
                {
                    FromStatus = TransportStatus.Pending,
                    ToStatus = TransportStatus.Pending,
                    OperatorId = operatorId,
                    OperatorName = operatorName,
                    Timestamp = DateTime.UtcNow,
                    Remarks = "创建任务"
                }
            }
        };

        await _taskRepository.AddAsync(task);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Create,
            ActionName = "创建运输任务",
            Module = "Transport",
            EntityType = "TransportTask",
            EntityId = task.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(task);
    }

    public async Task<TransportTaskDto?> UpdateAsync(string id, UpdateTransportTaskRequest request, string operatorId, string operatorName)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null) return null;

        var oldValue = System.Text.Json.JsonSerializer.Serialize(task);

        if (!string.IsNullOrEmpty(request.VehicleId))
            task.Vehicle.VehicleId = request.VehicleId;
        if (!string.IsNullOrEmpty(request.PlateNumber))
            task.Vehicle.PlateNumber = request.PlateNumber;
        if (!string.IsNullOrEmpty(request.DriverId))
            task.Driver.DriverId = request.DriverId;
        if (!string.IsNullOrEmpty(request.DriverName))
            task.Driver.DriverName = request.DriverName;
        if (request.DeviceIds != null)
            task.DeviceIds = request.DeviceIds;
        if (request.PlannedDepartureAt.HasValue)
            task.PlannedDepartureAt = request.PlannedDepartureAt.Value;
        if (request.PlannedArrivalAt.HasValue)
            task.PlannedArrivalAt = request.PlannedArrivalAt.Value;
        if (request.MinTemp.HasValue)
            task.TemperatureRange.MinTemp = request.MinTemp.Value;
        if (request.MaxTemp.HasValue)
            task.TemperatureRange.MaxTemp = request.MaxTemp.Value;

        task.UpdatedAt = DateTime.UtcNow;
        await _taskRepository.UpdateAsync(id, task);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.Update,
            ActionName = "更新运输任务",
            Module = "Transport",
            EntityType = "TransportTask",
            EntityId = task.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OldValue = oldValue,
            NewValue = System.Text.Json.JsonSerializer.Serialize(task),
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        return MapToDto(task);
    }

    public async Task<TransportTaskDto?> StartTaskAsync(string id, string operatorId, string operatorName, string remarks = "")
    {
        return await ChangeStatusAsync(id, TransportStatus.InTransit, operatorId, operatorName, remarks);
    }

    public async Task<TransportTaskDto?> ArriveTaskAsync(string id, string operatorId, string operatorName, string remarks = "")
    {
        return await ChangeStatusAsync(id, TransportStatus.Arrived, operatorId, operatorName, remarks);
    }

    public async Task<TransportTaskDto?> StartQualityCheckAsync(string id, string operatorId, string operatorName, string remarks = "")
    {
        return await ChangeStatusAsync(id, TransportStatus.QualityChecking, operatorId, operatorName, remarks);
    }

    public async Task<TransportTaskDto?> CompleteTaskAsync(string id, string operatorId, string operatorName, string remarks = "")
    {
        return await ChangeStatusAsync(id, TransportStatus.Completed, operatorId, operatorName, remarks);
    }

    public async Task<TransportTaskDto?> CancelTaskAsync(string id, string operatorId, string operatorName, string remarks = "")
    {
        return await ChangeStatusAsync(id, TransportStatus.Cancelled, operatorId, operatorName, remarks);
    }

    private async Task<TransportTaskDto?> ChangeStatusAsync(string id, TransportStatus newStatus, string operatorId, string operatorName, string remarks)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null) return null;

        var fromStatus = task.Status;
        var statusRecord = new StatusChangeRecord
        {
            FromStatus = fromStatus,
            ToStatus = newStatus,
            OperatorId = operatorId,
            OperatorName = operatorName,
            Timestamp = DateTime.UtcNow,
            Remarks = remarks
        };

        await _taskRepository.UpdateStatusAsync(id, newStatus, statusRecord);

        await _auditLogRepository.AddAsync(new AuditLog
        {
            ActionType = AuditActionType.StatusChange,
            ActionName = $"任务状态变更: {fromStatus} -> {newStatus}",
            Module = "Transport",
            EntityType = "TransportTask",
            EntityId = task.Id,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OldValue = fromStatus.ToString(),
            NewValue = newStatus.ToString(),
            Status = true,
            Timestamp = DateTime.UtcNow
        });

        task = await _taskRepository.GetByIdAsync(id);
        return task == null ? null : MapToDto(task);
    }

    public async Task<bool> ConfirmLoadingAsync(string taskId, LoadingOperationRequest request)
    {
        var task = await _taskRepository.GetByIdAsync(taskId);
        if (task == null) return false;

        var record = new LoadingRecord
        {
            OperationType = request.OperationType,
            OperatorId = request.OperatorId,
            OperatorName = request.OperatorName,
            Timestamp = DateTime.UtcNow,
            Remarks = request.Remarks
        };

        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            record.Location = new GpsLocation
            {
                Latitude = request.Latitude.Value,
                Longitude = request.Longitude.Value,
                Accuracy = request.Accuracy,
                Timestamp = DateTime.UtcNow
            };
        }

        if (request.TemperatureSnapshots != null)
        {
            record.TemperatureSnapshots = request.TemperatureSnapshots.Select(s => new TemperatureSnapshot
            {
                DeviceId = s.DeviceId,
                Temperature = s.Temperature,
                Humidity = s.Humidity
            }).ToList();
        }

        if (request.OperationType == OperationType.Loading)
        {
            await _taskRepository.SetLoadingRecordAsync(taskId, record);
        }
        else
        {
            await _taskRepository.SetUnloadingRecordAsync(taskId, record);
        }

        return true;
    }

    private static string GenerateTaskNo()
    {
        return $"TT{DateTime.UtcNow:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
    }

    private static TransportTaskDto MapToDto(TransportTask task)
    {
        return new TransportTaskDto
        {
            Id = task.Id,
            TaskNo = task.TaskNo,
            Status = task.Status,
            StatusText = GetStatusText(task.Status),
            DrugBatch = new DrugBatchDto
            {
                BatchNo = task.DrugBatch.BatchNo,
                DrugName = task.DrugBatch.DrugName,
                DrugType = task.DrugBatch.DrugType,
                Quantity = task.DrugBatch.Quantity,
                Unit = task.DrugBatch.Unit,
                Manufacturer = task.DrugBatch.Manufacturer,
                ProductionDate = task.DrugBatch.ProductionDate,
                ExpiryDate = task.DrugBatch.ExpiryDate
            },
            Vehicle = new VehicleDto
            {
                VehicleId = task.Vehicle.VehicleId,
                PlateNumber = task.Vehicle.PlateNumber,
                VehicleType = task.Vehicle.VehicleType
            },
            Driver = new DriverDto
            {
                DriverId = task.Driver.DriverId,
                DriverName = task.Driver.DriverName,
                Phone = task.Driver.Phone
            },
            Origin = new LocationDto
            {
                Name = task.Origin.Name,
                Address = task.Origin.Address,
                Contact = task.Origin.Contact,
                Phone = task.Origin.Phone
            },
            Destination = new LocationDto
            {
                Name = task.Destination.Name,
                Address = task.Destination.Address,
                Contact = task.Destination.Contact,
                Phone = task.Destination.Phone
            },
            DeviceIds = task.DeviceIds,
            TemperatureRange = new TemperatureRangeDto
            {
                MinTemp = task.TemperatureRange.MinTemp,
                MaxTemp = task.TemperatureRange.MaxTemp,
                MinHumidity = task.TemperatureRange.MinHumidity,
                MaxHumidity = task.TemperatureRange.MaxHumidity
            },
            PlannedDepartureAt = task.PlannedDepartureAt,
            PlannedArrivalAt = task.PlannedArrivalAt,
            ActualDepartureAt = task.ActualDepartureAt,
            ActualArrivalAt = task.ActualArrivalAt,
            AlertCount = task.AlertCount,
            CriticalAlertCount = task.CriticalAlertCount,
            CreatedBy = task.CreatedBy,
            CreatedByName = task.CreatedByName,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };
    }

    private static string GetStatusText(TransportStatus status)
    {
        return status switch
        {
            TransportStatus.Pending => "待发车",
            TransportStatus.InTransit => "运输中",
            TransportStatus.Arrived => "已到达",
            TransportStatus.QualityChecking => "质检中",
            TransportStatus.Completed => "已完成",
            TransportStatus.Cancelled => "已取消",
            _ => "未知"
        };
    }
}
