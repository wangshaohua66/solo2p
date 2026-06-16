using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class AlertService : IAlertService
{
    private readonly IAlertRepository _alertRepository;
    private readonly IAlertRuleRepository _alertRuleRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly ISensorRepository _sensorRepository;
    private readonly IShipmentRepository _shipmentRepository;
    private readonly ICustomerRepository _customerRepository;

    public AlertService(
        IAlertRepository alertRepository,
        IAlertRuleRepository alertRuleRepository,
        IVehicleRepository vehicleRepository,
        ISensorRepository sensorRepository,
        IShipmentRepository shipmentRepository,
        ICustomerRepository customerRepository)
    {
        _alertRepository = alertRepository;
        _alertRuleRepository = alertRuleRepository;
        _vehicleRepository = vehicleRepository;
        _sensorRepository = sensorRepository;
        _shipmentRepository = shipmentRepository;
        _customerRepository = customerRepository;
    }

    public async Task<PagedResult<AlertDto>> GetPagedAsync(AlertQueryRequest request)
    {
        var (items, totalCount) = await _alertRepository.GetPagedAsync(
            request.PageIndex,
            request.PageSize,
            a => (!request.CustomerId.HasValue || a.CustomerId == request.CustomerId.Value)
              && (!request.VehicleId.HasValue || a.VehicleId == request.VehicleId.Value)
              && (!request.SensorId.HasValue || a.SensorId == request.SensorId.Value)
              && (!request.ShipmentId.HasValue || a.ShipmentId == request.ShipmentId.Value)
              && (!request.Severity.HasValue || (int)a.Severity == request.Severity.Value)
              && (!request.Status.HasValue || (int)a.Status == request.Status.Value)
              && (!request.StartTime.HasValue || a.FirstTriggeredAt >= request.StartTime.Value)
              && (!request.EndTime.HasValue || a.FirstTriggeredAt <= request.EndTime.Value),
            a => a.FirstTriggeredAt,
            true);

        var dtoList = new List<AlertDto>();
        foreach (var item in items)
        {
            dtoList.Add(await MapToDto(item));
        }

        return new PagedResult<AlertDto>
        {
            PageIndex = request.PageIndex,
            PageSize = request.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling((double)totalCount / request.PageSize),
            Items = dtoList
        };
    }

    public async Task<AlertDto?> GetByIdAsync(long id)
    {
        var alert = await _alertRepository.GetByIdAsync(id);
        return alert != null ? await MapToDto(alert) : null;
    }

    public async Task<AlertDto?> AcknowledgeAsync(AlertAcknowledgeRequest request, string operatorName)
    {
        var alert = await _alertRepository.GetByIdAsync(request.Id);
        if (alert == null)
            return null;

        alert.Status = AlertStatus.Acknowledged;
        alert.AcknowledgedBy = operatorName;
        alert.AcknowledgedAt = DateTime.UtcNow;

        _alertRepository.Update(alert);
        await _alertRepository.SaveChangesAsync();

        return await MapToDto(alert);
    }

    public async Task<AlertDto?> ResolveAsync(AlertResolveRequest request, string operatorName)
    {
        var alert = await _alertRepository.GetByIdAsync(request.Id);
        if (alert == null)
            return null;

        alert.Status = AlertStatus.Resolved;
        alert.ResolvedBy = operatorName;
        alert.ResolvedAt = DateTime.UtcNow;
        alert.ResolutionNotes = request.ResolutionNotes;

        _alertRepository.Update(alert);
        await _alertRepository.SaveChangesAsync();

        return await MapToDto(alert);
    }

    private async Task<AlertDto> MapToDto(Alert alert)
    {
        var rule = alert.AlertRule ?? await _alertRuleRepository.GetByIdAsync(alert.AlertRuleId);
        var customer = alert.CustomerId.HasValue
            ? (alert.Customer ?? await _customerRepository.GetByIdAsync(alert.CustomerId.Value))
            : null;
        var vehicle = alert.VehicleId.HasValue
            ? (alert.Vehicle ?? await _vehicleRepository.GetByIdAsync(alert.VehicleId.Value))
            : null;
        var sensor = alert.SensorId.HasValue
            ? (alert.Sensor ?? await _sensorRepository.GetByIdAsync(alert.SensorId.Value))
            : null;
        var shipment = alert.ShipmentId.HasValue
            ? (alert.Shipment ?? await _shipmentRepository.GetByIdAsync(alert.ShipmentId.Value))
            : null;

        return new AlertDto
        {
            Id = alert.Id,
            AlertCode = alert.AlertCode,
            AlertRuleId = alert.AlertRuleId,
            RuleName = rule?.RuleName ?? string.Empty,
            CustomerId = alert.CustomerId,
            CustomerName = customer?.Name,
            VehicleId = alert.VehicleId,
            VehicleNumber = vehicle?.VehicleNumber,
            SensorId = alert.SensorId,
            SensorCode = sensor?.SensorCode,
            ShipmentId = alert.ShipmentId,
            ShipmentNumber = shipment?.ShipmentNumber,
            Severity = (int)alert.Severity,
            SeverityText = alert.Severity.ToString(),
            Status = (int)alert.Status,
            StatusText = alert.Status.ToString(),
            Title = alert.Title,
            Description = alert.Description,
            FirstTriggeredAt = alert.FirstTriggeredAt,
            LastTriggeredAt = alert.LastTriggeredAt,
            TriggerCount = alert.TriggerCount,
            TriggerValue = alert.TriggerValue,
            TriggerMetric = alert.TriggerMetric,
            EscalationLevel = alert.EscalationLevel
        };
    }
}
