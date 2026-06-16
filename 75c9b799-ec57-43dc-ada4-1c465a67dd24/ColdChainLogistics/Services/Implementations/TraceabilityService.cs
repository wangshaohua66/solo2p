using System.Security.Cryptography;
using System.Text;
using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class TraceabilityService : ITraceabilityService
{
    private readonly ITraceabilityRepository _traceabilityRepository;
    private readonly IShipmentRepository _shipmentRepository;
    private readonly IShipmentBatchRepository _batchRepository;
    private readonly ISensorDataRepository _sensorDataRepository;
    private readonly IWarehouseRepository _warehouseRepository;

    public TraceabilityService(
        ITraceabilityRepository traceabilityRepository,
        IShipmentRepository shipmentRepository,
        IShipmentBatchRepository batchRepository,
        ISensorDataRepository sensorDataRepository,
        IWarehouseRepository warehouseRepository)
    {
        _traceabilityRepository = traceabilityRepository;
        _shipmentRepository = shipmentRepository;
        _batchRepository = batchRepository;
        _sensorDataRepository = sensorDataRepository;
        _warehouseRepository = warehouseRepository;
    }

    public async Task<TraceabilityResponse> GetTraceabilityAsync(TraceabilityQueryRequest request)
    {
        ShipmentBatch? batch = null;
        Shipment? shipment = null;

        if (!string.IsNullOrWhiteSpace(request.BatchNumber))
        {
            batch = await _batchRepository.GetByBatchNumberAsync(request.BatchNumber);
            if (batch != null)
            {
                shipment = await _shipmentRepository.GetByIdAsync(batch.ShipmentId);
            }
        }
        else if (request.ShipmentId.HasValue)
        {
            shipment = await _shipmentRepository.GetByIdAsync(request.ShipmentId.Value);
            if (shipment != null)
            {
                batch = (await _batchRepository.GetByShipmentIdAsync(shipment.Id)).FirstOrDefault();
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.ShipmentNumber))
        {
            shipment = await _shipmentRepository.GetByShipmentNumberAsync(request.ShipmentNumber);
            if (shipment != null)
            {
                batch = (await _batchRepository.GetByShipmentIdAsync(shipment.Id)).FirstOrDefault();
            }
        }

        if (shipment == null)
        {
            throw new KeyNotFoundException("未找到对应的运输记录");
        }

        batch ??= (await _batchRepository.GetByShipmentIdAsync(shipment.Id)).FirstOrDefault();

        var records = await _traceabilityRepository.GetByShipmentIdAsync(shipment.Id);

        var response = new TraceabilityResponse
        {
            BatchNumber = batch?.BatchNumber ?? string.Empty,
            ShipmentNumber = shipment.ShipmentNumber,
            ProductName = batch?.ProductName ?? string.Empty,
            Quantity = batch?.Quantity ?? 0,
            ProductionDate = batch?.ProductionDate,
            ExpiryDate = batch?.ExpiryDate,
            Nodes = records.Select(r => new TraceabilityNodeDto
            {
                Sequence = r.Sequence,
                NodeType = r.NodeType,
                NodeName = r.NodeName,
                Timestamp = r.Timestamp,
                Temperature = r.Temperature,
                Humidity = r.Humidity,
                Location = r.Location,
                OperatorName = r.OperatorName,
                Remark = r.Remark,
                DataHash = r.DataHash
            }).ToList()
        };

        var startTime = shipment.DepartureTime ?? shipment.CreatedAt;
        var endTime = shipment.SignTime ?? shipment.ArrivalTime ?? DateTime.UtcNow;

        var sensorData = await _sensorDataRepository.GetByShipmentIdAsync(shipment.Id, startTime, endTime);
        response.SensorDataTimeline = sensorData.Select(d => new TraceabilitySensorDataDto
        {
            Timestamp = d.Timestamp,
            Temperature = d.Temperature,
            Humidity = d.Humidity,
            Latitude = d.Latitude,
            Longitude = d.Longitude
        }).ToList();

        if (sensorData.Count > 0)
        {
            var temperatures = sensorData.Select(d => d.Temperature).ToList();
            var humidities = sensorData.Select(d => d.Humidity).ToList();
            var tempMin = shipment.TemperatureMin ?? 2;
            var tempMax = shipment.TemperatureMax ?? 8;

            var overLimitCount = sensorData.Count(d => d.Temperature < tempMin || d.Temperature > tempMax);
            double overLimitDuration = 0;

            response.Statistics = new TemperatureStatisticsDto
            {
                MinTemperature = temperatures.Min(),
                MaxTemperature = temperatures.Max(),
                AvgTemperature = temperatures.Average(),
                MinHumidity = humidities.Min(),
                MaxHumidity = humidities.Max(),
                AvgHumidity = humidities.Average(),
                OverLimitCount = overLimitCount,
                OverLimitDurationMinutes = overLimitDuration
            };
        }

        return response;
    }

    public async Task BuildTraceabilityChainAsync(long shipmentId)
    {
        var shipment = await _shipmentRepository.GetWithDetailsAsync(shipmentId);
        if (shipment == null)
        {
            throw new KeyNotFoundException($"运输单 {shipmentId} 不存在");
        }

        var existingRecords = await _traceabilityRepository.GetByShipmentIdAsync(shipmentId);
        if (existingRecords.Count > 0)
        {
            Log.Information("运输单 {ShipmentId} 已有溯源记录，跳过构建", shipmentId);
            return;
        }

        var sequence = 1;
        string? previousHash = null;

        var warehouse = await _warehouseRepository.GetByIdAsync(shipment.OriginWarehouseId);

        foreach (var batch in shipment.Batches)
        {
            var inboundNode = CreateTraceabilityRecord(
                shipment.Id, batch.Id, batch.BatchNumber, sequence++, "Inbound", "入库节点",
                batch.InboundTime ?? shipment.CreatedAt,
                null, null,
                warehouse?.Name,
                null, "药品入库");
            previousHash = UpdateHash(inboundNode, previousHash);
            await _traceabilityRepository.AddAsync(inboundNode);

            var outboundNode = CreateTraceabilityRecord(
                shipment.Id, batch.Id, batch.BatchNumber, sequence++, "Outbound", "出库节点",
                batch.OutboundTime ?? shipment.CreatedAt,
                null, null,
                warehouse?.Name,
                null, "药品出库装车");
            previousHash = UpdateHash(outboundNode, previousHash);
            await _traceabilityRepository.AddAsync(outboundNode);
        }

        var departureNode = CreateTraceabilityRecord(
            shipment.Id, null, string.Empty, sequence++, "Departure", "发车节点",
            shipment.DepartureTime ?? shipment.CreatedAt,
            null, null,
            warehouse?.Name,
            shipment.DriverName, "运输车辆出发");
        previousHash = UpdateHash(departureNode, previousHash);
        await _traceabilityRepository.AddAsync(departureNode);

        if (shipment.ArrivalTime.HasValue)
        {
            var arrivalNode = CreateTraceabilityRecord(
                shipment.Id, null, string.Empty, sequence++, "Arrival", "到达节点",
                shipment.ArrivalTime.Value,
                null, null,
                shipment.Destination,
                null, "运输车辆到达");
            previousHash = UpdateHash(arrivalNode, previousHash);
            await _traceabilityRepository.AddAsync(arrivalNode);
        }

        if (shipment.SignTime.HasValue)
        {
            var signNode = CreateTraceabilityRecord(
                shipment.Id, null, string.Empty, sequence++, "Sign", "签收节点",
                shipment.SignTime.Value,
                null, null,
                shipment.Destination,
                null, "客户签收确认");
            previousHash = UpdateHash(signNode, previousHash);
            await _traceabilityRepository.AddAsync(signNode);
        }

        await _traceabilityRepository.SaveChangesAsync();
        Log.Information("运输单 {ShipmentId} 溯源链构建完成，共 {Count} 个节点", shipmentId, sequence - 1);
    }

    public async Task AddTraceabilityNodeAsync(long shipmentId, string nodeType, string nodeName,
        DateTime timestamp, double? temperature = null, double? humidity = null,
        string? location = null, string? operatorName = null, string? remark = null)
    {
        var existingRecords = await _traceabilityRepository.GetByShipmentIdAsync(shipmentId);
        var maxSequence = existingRecords.Max(r => r.Sequence);
        var lastRecord = existingRecords.OrderByDescending(r => r.Sequence).FirstOrDefault();

        var node = CreateTraceabilityRecord(
            shipmentId, null, string.Empty,
            maxSequence + 1, nodeType, nodeName,
            timestamp, temperature, humidity,
            location, operatorName, remark);

        node.PreviousHash = lastRecord?.DataHash;
        node.DataHash = ComputeHash(node);

        await _traceabilityRepository.AddAsync(node);
        await _traceabilityRepository.SaveChangesAsync();
    }

    private TraceabilityRecord CreateTraceabilityRecord(long shipmentId, long? batchId, string batchNumber,
        int sequence, string nodeType, string nodeName, DateTime timestamp,
        double? temperature = null, double? humidity = null,
        string? location = null, string? operatorName = null, string? remark = null)
    {
        return new TraceabilityRecord
        {
            TraceId = GenerateTraceId(),
            ShipmentId = shipmentId,
            BatchId = batchId,
            BatchNumber = batchNumber,
            Sequence = sequence,
            NodeType = nodeType,
            NodeName = nodeName,
            Timestamp = timestamp,
            Temperature = temperature,
            Humidity = humidity,
            Location = location,
            OperatorName = operatorName,
            Remark = remark
        };
    }

    private string UpdateHash(TraceabilityRecord record, string? previousHash)
    {
        record.PreviousHash = previousHash;
        record.DataHash = ComputeHash(record);
        return record.DataHash;
    }

    private string ComputeHash(TraceabilityRecord record)
    {
        var input = $"{record.ShipmentId}|{record.BatchNumber}|{record.Sequence}|{record.NodeType}|{record.Timestamp:o}|{record.Temperature}|{record.Humidity}|{record.PreviousHash}";
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        return BitConverter.ToString(bytes).Replace("-", "").ToLower();
    }

    private string GenerateTraceId()
    {
        return $"TRACE{DateTime.UtcNow:yyyyMMddHHmmssfff}{new Random().Next(1000, 9999)}";
    }
}
