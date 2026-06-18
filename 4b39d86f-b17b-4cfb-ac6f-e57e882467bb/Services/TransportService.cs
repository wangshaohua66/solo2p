using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HazChemSupervision.Services;

public class TransportService : ITransportService
{
    private readonly IBaseRepository<TransportRecord> _transportRepo;
    private readonly IBaseRepository<TransportTrajectory> _trajectoryRepo;
    private readonly IBaseRepository<ChemicalBatch> _batchRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IAlertService _alertService;
    private readonly IMapper _mapper;
    private readonly IConfiguration _configuration;

    public TransportService(
        IBaseRepository<TransportRecord> transportRepo,
        IBaseRepository<TransportTrajectory> trajectoryRepo,
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IAlertService alertService,
        IMapper mapper,
        IConfiguration configuration)
    {
        _transportRepo = transportRepo;
        _trajectoryRepo = trajectoryRepo;
        _batchRepo = batchRepo;
        _enterpriseRepo = enterpriseRepo;
        _alertService = alertService;
        _mapper = mapper;
        _configuration = configuration;
    }

    public async Task<TransportRecordDto?> GetTransportByIdAsync(int id)
    {
        var transport = await _transportRepo.GetQueryable()
            .Include(t => t.Enterprise)
            .Include(t => t.ChemicalBatch)
                .ThenInclude(b => b.Chemical)
            .FirstOrDefaultAsync(t => t.Id == id);

        return transport != null ? _mapper.Map<TransportRecordDto>(transport) : null;
    }

    public async Task<PagedResult<TransportRecordDto>> GetTransportsAsync(TransportRecordQueryDto dto)
    {
        var predicate = PredicateBuilder.True<TransportRecord>();

        if (!string.IsNullOrEmpty(dto.TransportNo))
            predicate = predicate.And(t => t.TransportNo.Contains(dto.TransportNo));

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(t => t.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.ChemicalBatchId.HasValue)
            predicate = predicate.And(t => t.ChemicalBatchId == dto.ChemicalBatchId.Value);

        if (!string.IsNullOrEmpty(dto.VehiclePlateNo))
            predicate = predicate.And(t => t.VehiclePlateNo.Contains(dto.VehiclePlateNo));

        if (dto.Status.HasValue)
            predicate = predicate.And(t => t.Status == (TransportStatus)dto.Status.Value);

        if (dto.HasAnomaly.HasValue)
        {
            if (dto.HasAnomaly.Value)
                predicate = predicate.And(t => t.IsDeviating || t.IsOverspeeding || t.IsTemperatureAbnormal);
            else
                predicate = predicate.And(t => !t.IsDeviating && !t.IsOverspeeding && !t.IsTemperatureAbnormal);
        }

        if (dto.DepartureDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(t => t.PlannedDepartureTime >= dto.DepartureDateRange.StartDate.Value);

        if (dto.DepartureDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(t => t.PlannedDepartureTime < dto.DepartureDateRange.EndDate.Value.AddDays(1));

        var result = await _transportRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(t => t.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _transportRepo.GetQueryable()
            .Include(t => t.Enterprise)
            .Include(t => t.ChemicalBatch)
                .ThenInclude(b => b.Chemical)
            .Where(predicate)
            .OrderByDescending(t => t.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<TransportRecordDto>
        {
            Items = _mapper.Map<List<TransportRecordDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<TransportRecordDto> CreateTransportAsync(TransportRecordCreateDto dto)
    {
        var exists = await _transportRepo.ExistsAsync(t => t.TransportNo == dto.TransportNo);
        if (exists)
            throw new InvalidOperationException($"运输单号已存在: {dto.TransportNo}");

        var batch = await _batchRepo.GetByIdAsync(dto.ChemicalBatchId) ??
            throw new KeyNotFoundException($"批次不存在: {dto.ChemicalBatchId}");

        if (batch.Status != BatchStatus.InStorage)
            throw new InvalidOperationException("批次未入库，无法创建运输记录");

        var transport = _mapper.Map<TransportRecord>(dto);
        transport.Status = TransportStatus.Pending;
        transport.CreatedAt = DateTime.UtcNow;
        transport.UpdatedAt = DateTime.UtcNow;

        var result = await _transportRepo.AddAsync(transport);

        batch.Status = BatchStatus.OutForDelivery;
        batch.TransportRecordId = result.Id;
        batch.UpdatedAt = DateTime.UtcNow;
        await _batchRepo.UpdateAsync(batch);

        return _mapper.Map<TransportRecordDto>(result);
    }

    public async Task<TransportRecordDto> UpdateTransportAsync(int id, TransportRecordUpdateDto dto)
    {
        var transport = await _transportRepo.GetByIdAsync(id) ??
            throw new KeyNotFoundException($"运输记录不存在: {id}");

        transport.VehiclePlateNo = dto.VehiclePlateNo;
        transport.DriverName = dto.DriverName;
        transport.DriverLicenseNo = dto.DriverLicenseNo;
        transport.DriverPhone = dto.DriverPhone;
        transport.EscortName = dto.EscortName;
        transport.ActualDepartureTime = dto.ActualDepartureTime;
        transport.ActualArrivalTime = dto.ActualArrivalTime;
        transport.Status = (TransportStatus)dto.Status;
        transport.UpdatedAt = DateTime.UtcNow;

        await _transportRepo.UpdateAsync(transport);

        if (transport.Status == TransportStatus.Completed || transport.Status == TransportStatus.Delivered)
        {
            var batch = await _batchRepo.GetByIdAsync(transport.ChemicalBatchId);
            if (batch != null)
            {
                batch.Status = BatchStatus.Delivered;
                batch.UpdatedAt = DateTime.UtcNow;
                await _batchRepo.UpdateAsync(batch);
            }
        }

        return _mapper.Map<TransportRecordDto>(transport);
    }

    public async Task<TransportMonitoringDto> GetTransportMonitoringAsync(int id)
    {
        var transport = await _transportRepo.GetQueryable()
            .Include(t => t.ChemicalBatch)
                .ThenInclude(b => b.Chemical)
            .FirstOrDefaultAsync(t => t.Id == id) ??
            throw new KeyNotFoundException($"运输记录不存在: {id}");

        var recentTrajectories = await _trajectoryRepo.GetQueryable()
            .Where(t => t.TransportRecordId == id)
            .OrderByDescending(t => t.RecordTime)
            .Take(100)
            .OrderBy(t => t.RecordTime)
            .ToListAsync();

        var latestTrajectory = recentTrajectories.LastOrDefault();

        return new TransportMonitoringDto
        {
            TransportRecordId = id,
            TransportNo = transport.TransportNo,
            VehiclePlateNo = transport.VehiclePlateNo,
            DriverName = transport.DriverName,
            ChemicalName = transport.ChemicalBatch.Chemical.Name,
            Status = (int)transport.Status,
            StatusName = transport.Status.ToString(),
            CurrentLongitude = latestTrajectory?.Longitude ?? transport.StartLongitude,
            CurrentLatitude = latestTrajectory?.Latitude ?? transport.StartLatitude,
            CurrentSpeed = latestTrajectory?.Speed ?? 0,
            CurrentTemperature = latestTrajectory?.Temperature ?? 0,
            HasDeviation = transport.IsDeviating,
            HasOverspeeding = transport.IsOverspeeding,
            HasTemperatureAbnormal = transport.IsTemperatureAbnormal,
            RecentTrajectories = _mapper.Map<List<TransportTrajectoryDto>>(recentTrajectories)
        };
    }

    public async Task<TransportTrajectoryDto> UploadTrajectoryAsync(TransportTrajectoryCreateDto dto)
    {
        var transport = await _transportRepo.GetByIdAsync(dto.TransportRecordId) ??
            throw new KeyNotFoundException($"运输记录不存在: {dto.TransportRecordId}");

        var trajectory = _mapper.Map<TransportTrajectory>(dto);
        trajectory.IsDeviation = await CheckRouteDeviationAsync(dto.TransportRecordId, dto.Longitude, dto.Latitude);
        trajectory.IsOverspeeding = await CheckOverspeedingAsync(dto.TransportRecordId, dto.Speed);
        trajectory.IsTemperatureAbnormal = await CheckTemperatureAbnormalAsync(dto.TransportRecordId, dto.Temperature);
        trajectory.RecordTime = DateTime.UtcNow;

        var result = await _trajectoryRepo.AddAsync(trajectory);

        transport.CurrentSpeed = dto.Speed;
        transport.CurrentTemperature = dto.Temperature;
        transport.UpdatedAt = DateTime.UtcNow;

        var now = DateTime.UtcNow;
        var deviationThresholdSec = int.Parse(_configuration["Alert:TransportDeviationDurationSec"] ?? "180");
        var overspeedThresholdSec = int.Parse(_configuration["Alert:TransportOverspeedDurationSec"] ?? "180");

        if (trajectory.IsDeviation)
        {
            transport.DeviationStartTime ??= now;
            if ((now - transport.DeviationStartTime.Value).TotalSeconds >= deviationThresholdSec)
            {
                transport.IsDeviating = true;
                transport.Status = TransportStatus.Deviating;
            }
        }
        else
        {
            transport.DeviationStartTime = null;
            transport.IsDeviating = false;
            if (transport.Status == TransportStatus.Deviating)
                transport.Status = TransportStatus.InTransit;
        }

        if (trajectory.IsOverspeeding)
        {
            transport.OverspeedingStartTime ??= now;
            if ((now - transport.OverspeedingStartTime.Value).TotalSeconds >= overspeedThresholdSec)
            {
                transport.IsOverspeeding = true;
            }
        }
        else
        {
            transport.OverspeedingStartTime = null;
            transport.IsOverspeeding = false;
        }

        transport.IsTemperatureAbnormal = trajectory.IsTemperatureAbnormal;

        await _transportRepo.UpdateAsync(transport);
        await _alertService.CheckAndGenerateTransportAlertsAsync();

        return _mapper.Map<TransportTrajectoryDto>(result);
    }

    public async Task<List<TransportTrajectoryDto>> BatchUploadTrajectoriesAsync(GpsDataUploadDto dto)
    {
        var results = new List<TransportTrajectoryDto>();

        foreach (var trajectoryDto in dto.Trajectories)
        {
            var result = await UploadTrajectoryAsync(trajectoryDto);
            results.Add(result);
        }

        return results;
    }

    public async Task<List<TransportTrajectoryDto>> GetTrajectoriesAsync(int transportRecordId, int? limit = 100)
    {
        var query = _trajectoryRepo.GetQueryable()
            .Where(t => t.TransportRecordId == transportRecordId)
            .OrderByDescending(t => t.RecordTime);

        if (limit.HasValue)
            query = query.Take(limit.Value);

        var trajectories = await query.OrderBy(t => t.RecordTime).ToListAsync();
        return _mapper.Map<List<TransportTrajectoryDto>>(trajectories);
    }

    public async Task<bool> CheckRouteDeviationAsync(int transportRecordId, decimal longitude, decimal latitude)
    {
        var transport = await _transportRepo.GetQueryable()
            .Include(t => t.Trajectories)
            .FirstOrDefaultAsync(t => t.Id == transportRecordId);
        if (transport == null) return false;

        var distanceThreshold = decimal.Parse(_configuration["Alert:RouteDeviationMeters"] ?? "500");
        var routePoints = await BuildActualRoutePointsAsync(transport);

        var minDistanceToPath = CalculateConstrainedPathDistance(
            routePoints,
            transport.StartLatitude, transport.StartLongitude,
            transport.EndLatitude, transport.EndLongitude,
            latitude, longitude);

        return minDistanceToPath > distanceThreshold;
    }

    private async Task<List<(decimal Lat, decimal Lon)>> BuildActualRoutePointsAsync(TransportRecord transport)
    {
        var points = ParsePlannedRoute(transport);

        if (points.Count < 2 && transport.Trajectories != null && transport.Trajectories.Count >= 2)
        {
            points = transport.Trajectories
                .OrderBy(t => t.RecordTime)
                .Select(t => (t.Latitude, t.Longitude))
                .Distinct()
                .ToList();
        }

        if (points.Count < 2)
        {
            points = GenerateRoadNetworkRoute(
                transport.StartLatitude, transport.StartLongitude,
                transport.EndLatitude, transport.EndLongitude);
        }

        return SimplifyRoutePoints(points, maxPoints: 100);
    }

    private static List<(decimal Lat, decimal Lon)> GenerateRoadNetworkRoute(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon)
    {
        var path = RoadNetworkPathFinder.FindPath(
            startLat, startLon,
            endLat, endLon,
            CalculateDistance);

        if (path.Count < 2)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        return path;
    }

    private static List<(decimal Lat, decimal Lon)> SimplifyRoutePoints(List<(decimal Lat, decimal Lon)> points, int maxPoints)
    {
        if (points.Count <= maxPoints) return points;

        var step = (double)points.Count / maxPoints;
        var result = new List<(decimal Lat, decimal Lon)>();
        for (int i = 0; i < maxPoints - 1; i++)
        {
            var idx = (int)(i * step);
            if (idx < points.Count)
                result.Add(points[idx]);
        }
        result.Add(points[points.Count - 1]);
        return result;
    }

    private static decimal CalculateConstrainedPathDistance(
        List<(decimal Lat, decimal Lon)> pathPoints,
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        decimal pointLat, decimal pointLon)
    {
        if (pathPoints.Count == 0) return decimal.MaxValue;
        if (pathPoints.Count == 1)
            return CalculateDistance(pathPoints[0].Lat, pathPoints[0].Lon, pointLat, pointLon);

        var distFromStartToPoint = CalculateDistance(startLat, startLon, pointLat, pointLon);
        var totalPathLength = CalculatePathLength(pathPoints);
        var progressRatio = totalPathLength > 0 ? Math.Clamp((double)(distFromStartToPoint / totalPathLength), 0.0, 1.0) : 0.5;

        var validStartIdx = Math.Max(0, (int)(progressRatio * pathPoints.Count) - 3);
        var validEndIdx = Math.Min(pathPoints.Count - 1, (int)(progressRatio * pathPoints.Count) + 3);

        var minDistance = decimal.MaxValue;
        double accumulatedDistance = 0;

        for (int i = 0; i < pathPoints.Count - 1; i++)
        {
            var segStart = pathPoints[i];
            var segEnd = pathPoints[i + 1];
            var segLength = (double)CalculateDistance(segStart.Lat, segStart.Lon, segEnd.Lat, segEnd.Lon);
            var segStartRatio = totalPathLength > 0 ? accumulatedDistance / (double)totalPathLength : 0;
            var segEndRatio = totalPathLength > 0 ? (accumulatedDistance + segLength) / (double)totalPathLength : 1;

            if (segEndRatio < progressRatio - 0.15)
            {
                accumulatedDistance += segLength;
                continue;
            }
            if (segStartRatio > progressRatio + 0.30)
                break;

            var distance = CalculatePointToSegmentDistance(
                segStart.Lat, segStart.Lon,
                segEnd.Lat, segEnd.Lon,
                pointLat, pointLon);

            if (distance < minDistance)
                minDistance = distance;

            accumulatedDistance += segLength;
        }

        if (minDistance == decimal.MaxValue)
        {
            for (int i = validStartIdx; i < validEndIdx && i < pathPoints.Count - 1; i++)
            {
                var distance = CalculatePointToSegmentDistance(
                    pathPoints[i].Lat, pathPoints[i].Lon,
                    pathPoints[i + 1].Lat, pathPoints[i + 1].Lon,
                    pointLat, pointLon);
                if (distance < minDistance)
                    minDistance = distance;
            }
        }

        return minDistance == decimal.MaxValue
            ? CalculateDistance(startLat, startLon, pointLat, pointLon)
            : minDistance;
    }

    private static double CalculatePathLength(List<(decimal Lat, decimal Lon)> pathPoints)
    {
        double length = 0;
        for (int i = 0; i < pathPoints.Count - 1; i++)
        {
            length += (double)CalculateDistance(
                pathPoints[i].Lat, pathPoints[i].Lon,
                pathPoints[i + 1].Lat, pathPoints[i + 1].Lon);
        }
        return length;
    }

    private static List<(decimal Lat, decimal Lon)> ParsePlannedRoute(TransportRecord transport)
    {
        var points = new List<(decimal Lat, decimal Lon)>();

        if (string.IsNullOrWhiteSpace(transport.PlannedRoute))
            return points;

        try
        {
            var segments = transport.PlannedRoute.Split(new[] { ';', '|' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var segment in segments)
            {
                var parts = segment.Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2 &&
                    decimal.TryParse(parts[0], out var lon) &&
                    decimal.TryParse(parts[1], out var lat))
                {
                    points.Add((lat, lon));
                }
            }
        }
        catch
        {
        }

        if (points.Count == 0)
        {
            points.Add((transport.StartLatitude, transport.StartLongitude));
            points.Add((transport.EndLatitude, transport.EndLongitude));
        }

        return points;
    }

    private static decimal CalculatePointToSegmentDistance(
        decimal segStartLat, decimal segStartLon,
        decimal segEndLat, decimal segEndLon,
        decimal pointLat, decimal pointLon)
    {
        var segLength = CalculateDistance(segStartLat, segStartLon, segEndLat, segEndLon);
        if (segLength == 0)
            return CalculateDistance(segStartLat, segStartLon, pointLat, pointLon);

        var dStart = CalculateDistance(segStartLat, segStartLon, pointLat, pointLon);
        var dEnd = CalculateDistance(segEndLat, segEndLon, pointLat, pointLon);

        var a = (double)dStart;
        var b = (double)dEnd;
        var c = (double)segLength;

        if (a * a >= b * b + c * c)
            return dEnd;

        if (b * b >= a * a + c * c)
            return dStart;

        var s = (a + b + c) / 2.0;
        var area = Math.Sqrt(Math.Max(0, s * (s - a) * (s - b) * (s - c)));
        var height = 2.0 * area / c;

        return (decimal)height;
    }

    public async Task<bool> CheckOverspeedingAsync(int transportRecordId, decimal speed)
    {
        var speedLimit = decimal.Parse(_configuration["Alert:SpeedLimitKmh"] ?? "80");
        return speed > speedLimit;
    }

    public async Task<bool> CheckTemperatureAbnormalAsync(int transportRecordId, decimal temperature)
    {
        var transport = await _transportRepo.GetByIdAsync(transportRecordId);
        if (transport == null) return false;

        var batch = await _batchRepo.GetByIdAsync(transport.ChemicalBatchId);
        if (batch == null) return false;

        var minTemp = decimal.Parse(_configuration["Alert:TemperatureMinC"] ?? "-10");
        var maxTemp = decimal.Parse(_configuration["Alert:TemperatureMaxC"] ?? "40");

        return temperature < minTemp || temperature > maxTemp;
    }

    public async Task UpdateTransportStatusAsync(int transportRecordId)
    {
        var transport = await _transportRepo.GetByIdAsync(transportRecordId);
        if (transport == null) return;

        var now = DateTime.UtcNow;
        var deviationThresholdSec = int.Parse(_configuration["Alert:TransportDeviationDurationSec"] ?? "180");
        var overspeedThresholdSec = int.Parse(_configuration["Alert:TransportOverspeedDurationSec"] ?? "180");

        if (transport.IsDeviating && transport.DeviationStartTime.HasValue &&
            (now - transport.DeviationStartTime.Value).TotalSeconds < deviationThresholdSec)
        {
            transport.IsDeviating = false;
            transport.Status = TransportStatus.InTransit;
        }

        if (transport.IsOverspeeding && transport.OverspeedingStartTime.HasValue &&
            (now - transport.OverspeedingStartTime.Value).TotalSeconds < overspeedThresholdSec)
        {
            transport.IsOverspeeding = false;
        }

        transport.UpdatedAt = DateTime.UtcNow;
        await _transportRepo.UpdateAsync(transport);
    }

    private static decimal CalculateDistance(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        var dLat = (double)(lat2 - lat1) * Math.PI / 180.0;
        var dLon = (double)(lon2 - lon1) * Math.PI / 180.0;

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos((double)lat1 * Math.PI / 180.0) * Math.Cos((double)lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        var distance = 6371000 * c;

        return (decimal)distance;
    }
}
