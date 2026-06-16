using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class ShipmentService : IShipmentService
{
    private readonly IShipmentRepository _shipmentRepository;
    private readonly IShipmentBatchRepository _batchRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IWarehouseRepository _warehouseRepository;
    private readonly ITraceabilityService _traceabilityService;

    public ShipmentService(
        IShipmentRepository shipmentRepository,
        IShipmentBatchRepository batchRepository,
        IVehicleRepository vehicleRepository,
        ICustomerRepository customerRepository,
        IWarehouseRepository warehouseRepository,
        ITraceabilityService traceabilityService)
    {
        _shipmentRepository = shipmentRepository;
        _batchRepository = batchRepository;
        _vehicleRepository = vehicleRepository;
        _customerRepository = customerRepository;
        _warehouseRepository = warehouseRepository;
        _traceabilityService = traceabilityService;
    }

    public async Task<ShipmentDto> CreateAsync(ShipmentCreateRequest request)
    {
        var customer = await _customerRepository.GetByIdAsync(request.CustomerId);
        if (customer == null)
            throw new KeyNotFoundException($"客户 {request.CustomerId} 不存在");

        var vehicle = await _vehicleRepository.GetByIdAsync(request.VehicleId);
        if (vehicle == null)
            throw new KeyNotFoundException($"车辆 {request.VehicleId} 不存在");

        var warehouse = await _warehouseRepository.GetByIdAsync(request.OriginWarehouseId);
        if (warehouse == null)
            throw new KeyNotFoundException($"仓库 {request.OriginWarehouseId} 不存在");

        var shipmentNumber = GenerateShipmentNumber();
        var shipment = new Shipment
        {
            ShipmentNumber = shipmentNumber,
            CustomerId = request.CustomerId,
            VehicleId = request.VehicleId,
            OriginWarehouseId = request.OriginWarehouseId,
            Destination = request.Destination,
            RouteCode = request.RouteCode,
            DriverName = request.DriverName,
            DriverPhone = request.DriverPhone,
            Remarks = request.Remarks,
            TemperatureMin = request.TemperatureMin,
            TemperatureMax = request.TemperatureMax,
            HumidityMin = request.HumidityMin,
            HumidityMax = request.HumidityMax,
            Status = ShipmentStatus.Created
        };

        await _shipmentRepository.AddAsync(shipment);
        await _shipmentRepository.SaveChangesAsync();

        if (request.Batches != null && request.Batches.Count > 0)
        {
            foreach (var batchDto in request.Batches)
            {
                var batch = new ShipmentBatch
                {
                    ShipmentId = shipment.Id,
                    WarehouseId = request.OriginWarehouseId,
                    BatchNumber = batchDto.BatchNumber,
                    ProductName = batchDto.ProductName,
                    ProductCategory = batchDto.ProductCategory,
                    Quantity = batchDto.Quantity,
                    Unit = batchDto.Unit,
                    ProductionDate = batchDto.ProductionDate,
                    ExpiryDate = batchDto.ExpiryDate,
                    InboundTime = DateTime.UtcNow,
                    StorageCondition = batchDto.StorageCondition,
                    TemperatureRequirementMin = batchDto.TemperatureRequirementMin,
                    TemperatureRequirementMax = batchDto.TemperatureRequirementMax
                };
                await _batchRepository.AddAsync(batch);
            }
            await _batchRepository.SaveChangesAsync();
        }

        await _traceabilityService.BuildTraceabilityChainAsync(shipment.Id);

        return await GetByIdAsync(shipment.Id) ?? throw new InvalidOperationException("创建运输单失败");
    }

    public async Task<ShipmentDto?> UpdateAsync(ShipmentUpdateRequest request)
    {
        var shipment = await _shipmentRepository.GetByIdAsync(request.Id);
        if (shipment == null)
            return null;

        shipment.Destination = request.Destination ?? shipment.Destination;
        shipment.RouteCode = request.RouteCode ?? shipment.RouteCode;
        shipment.DriverName = request.DriverName ?? shipment.DriverName;
        shipment.DriverPhone = request.DriverPhone ?? shipment.DriverPhone;
        shipment.Remarks = request.Remarks ?? shipment.Remarks;
        shipment.TemperatureMin = request.TemperatureMin ?? shipment.TemperatureMin;
        shipment.TemperatureMax = request.TemperatureMax ?? shipment.TemperatureMax;

        _shipmentRepository.Update(shipment);
        await _shipmentRepository.SaveChangesAsync();

        return await GetByIdAsync(shipment.Id);
    }

    public async Task<ShipmentDto?> UpdateStatusAsync(ShipmentStatusUpdateRequest request)
    {
        var shipment = await _shipmentRepository.GetByIdAsync(request.Id);
        if (shipment == null)
            return null;

        var newStatus = (ShipmentStatus)request.Status;
        var now = DateTime.UtcNow;

        switch (newStatus)
        {
            case ShipmentStatus.Loading:
                break;
            case ShipmentStatus.InTransit:
                shipment.DepartureTime = now;
                await _traceabilityService.AddTraceabilityNodeAsync(
                    shipment.Id, "Departure", "发车节点", now,
                    operatorName: shipment.DriverName, remark: request.Remark);
                break;
            case ShipmentStatus.Arrived:
                shipment.ArrivalTime = now;
                await _traceabilityService.AddTraceabilityNodeAsync(
                    shipment.Id, "Arrival", "到达节点", now,
                    location: shipment.Destination, remark: request.Remark);
                break;
            case ShipmentStatus.Signed:
                shipment.SignTime = now;
                shipment.ArrivalTime ??= now;
                await _traceabilityService.AddTraceabilityNodeAsync(
                    shipment.Id, "Sign", "签收节点", now,
                    location: shipment.Destination, remark: request.Remark);
                break;
        }

        shipment.Status = newStatus;
        _shipmentRepository.Update(shipment);
        await _shipmentRepository.SaveChangesAsync();

        return await GetByIdAsync(shipment.Id);
    }

    public async Task<ShipmentDto?> GetByIdAsync(long id)
    {
        var shipment = await _shipmentRepository.GetWithDetailsAsync(id);
        if (shipment == null)
            return null;

        return await MapToDto(shipment);
    }

    public async Task<PagedResult<ShipmentDto>> GetPagedAsync(ShipmentQueryRequest request)
    {
        var (items, totalCount) = await _shipmentRepository.GetPagedAsync(
            request.PageIndex,
            request.PageSize,
            s => (!request.CustomerId.HasValue || s.CustomerId == request.CustomerId.Value)
              && (!request.VehicleId.HasValue || s.VehicleId == request.VehicleId.Value)
              && (!request.Status.HasValue || (int)s.Status == request.Status.Value)
              && (string.IsNullOrWhiteSpace(request.ShipmentNumber) || s.ShipmentNumber.Contains(request.ShipmentNumber))
              && (!request.StartTime.HasValue || s.CreatedAt >= request.StartTime.Value)
              && (!request.EndTime.HasValue || s.CreatedAt <= request.EndTime.Value),
            s => s.CreatedAt,
            true);

        var dtoList = new List<ShipmentDto>();
        foreach (var item in items)
        {
            dtoList.Add(await MapToDto(item));
        }

        return new PagedResult<ShipmentDto>
        {
            PageIndex = request.PageIndex,
            PageSize = request.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling((double)totalCount / request.PageSize),
            Items = dtoList
        };
    }

    private async Task<ShipmentDto> MapToDto(Shipment shipment)
    {
        var customer = shipment.Customer ?? await _customerRepository.GetByIdAsync(shipment.CustomerId);
        var vehicle = shipment.Vehicle ?? await _vehicleRepository.GetByIdAsync(shipment.VehicleId);
        var warehouse = shipment.OriginWarehouse ?? await _warehouseRepository.GetByIdAsync(shipment.OriginWarehouseId);
        var batches = shipment.Batches ?? await _batchRepository.GetByShipmentIdAsync(shipment.Id);

        return new ShipmentDto
        {
            Id = shipment.Id,
            ShipmentNumber = shipment.ShipmentNumber,
            CustomerId = shipment.CustomerId,
            CustomerName = customer?.Name ?? string.Empty,
            VehicleId = shipment.VehicleId,
            VehicleNumber = vehicle?.VehicleNumber ?? string.Empty,
            OriginWarehouseId = shipment.OriginWarehouseId,
            OriginWarehouseName = warehouse?.Name ?? string.Empty,
            Destination = shipment.Destination,
            RouteCode = shipment.RouteCode,
            Status = (int)shipment.Status,
            StatusText = shipment.Status.ToString(),
            DepartureTime = shipment.DepartureTime,
            ArrivalTime = shipment.ArrivalTime,
            SignTime = shipment.SignTime,
            DriverName = shipment.DriverName,
            DriverPhone = shipment.DriverPhone,
            Remarks = shipment.Remarks,
            TemperatureMin = shipment.TemperatureMin,
            TemperatureMax = shipment.TemperatureMax,
            HumidityMin = shipment.HumidityMin,
            HumidityMax = shipment.HumidityMax,
            CreatedAt = shipment.CreatedAt,
            Batches = batches.Select(b => new ShipmentBatchDto
            {
                Id = b.Id,
                BatchNumber = b.BatchNumber,
                ProductName = b.ProductName,
                ProductCategory = b.ProductCategory,
                Quantity = b.Quantity,
                Unit = b.Unit,
                ProductionDate = b.ProductionDate,
                ExpiryDate = b.ExpiryDate
            }).ToList()
        };
    }

    private string GenerateShipmentNumber()
    {
        return $"SHIP{DateTime.UtcNow:yyyyMMddHHmmssfff}{new Random().Next(1000, 9999)}";
    }
}
