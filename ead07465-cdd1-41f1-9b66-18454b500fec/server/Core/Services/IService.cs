using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WaterDispatch.Core.Entities;

namespace WaterDispatch.Core.Services;

public record LeakLocationResult(
    double Longitude,
    double Latitude,
    double Confidence,
    double EstimatedRadius,
    List<LeakCandidatePoint> CandidatePoints,
    Guid? NearestNodeId,
    double? DistanceToNearestNode);

public record AnomalyPressureData(
    Guid NodeId,
    double Pressure,
    double NormalPressureMin,
    double NormalPressureMax,
    double DeviationPercent,
    double Longitude,
    double Latitude,
    DateTime ReadingTime);

public interface ILeakDetectService
{
    Task<bool> IsPressureAnomalyAsync(Guid nodeId, double pressure, CancellationToken ct = default);
    Task<List<AnomalyPressureData>> DetectAbnormalNodesAsync(CancellationToken ct = default);
    Task<LeakLocationResult> LocateLeakAsync(List<Guid> abnormalNodeIds, CancellationToken ct = default);
    Task<LeakEvent> CreateLeakEventAsync(List<Guid> abnormalNodeIds, CancellationToken ct = default);
    Task<List<LeakCandidatePoint>> GenerateProbabilityHeatmapAsync(double centerLng, double centerLat, double radius, CancellationToken ct = default);
    Task<double> CalculatePipeHealthScoreAsync(Pipe pipe, CancellationToken ct = default);
    Task<List<Pipe>> GeneratePreventiveMaintenanceListAsync(int topN = 50, CancellationToken ct = default);
}

public interface IOutagePredictService
{
    Task<OutageZone> PredictOutageZoneAsync(List<Guid> valveIds, CancellationToken ct = default);
    Task<List<GeoPoint>> BuildOutagePolygonAsync(List<Guid> affectedPipeIds, CancellationToken ct = default);
    Task<int> EstimateAffectedUsersAsync(OutageZone zone, CancellationToken ct = default);
    Task<string> GenerateNotificationDraftAsync(OutageZone zone, CancellationToken ct = default);
}

public interface IRepairDispatchService
{
    Task<RepairWorkOrder> CreateWorkOrderFromLeakAsync(Guid leakEventId, string title, string? description, CancellationToken ct = default);
    Task<bool> DispatchWorkOrderAsync(Guid workOrderId, Guid teamId, CancellationToken ct = default);
    Task<bool> UpdateWorkOrderStatusAsync(Guid workOrderId, WorkOrderStatus newStatus, Guid? operatorId, string? remark = null, CancellationToken ct = default);
    Task CheckAndEscalateTimeoutOrdersAsync(CancellationToken ct = default);
    Task<RepairTeam?> FindNearestIdleTeamAsync(double longitude, double latitude, string? district = null, CancellationToken ct = default);
    Task<bool> UpdateTeamPositionAsync(Guid teamId, double longitude, double latitude, CancellationToken ct = default);
}
