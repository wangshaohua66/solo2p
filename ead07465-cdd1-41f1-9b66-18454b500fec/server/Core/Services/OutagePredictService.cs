using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Entities;
using WaterDispatch.Core.Interfaces;

namespace WaterDispatch.Core.Services;

public class OutagePredictService : IOutagePredictService
{
    private readonly IUnitOfWork _unitOfWork;

    public OutagePredictService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<OutageZone> PredictOutageZoneAsync(List<Guid> valveIds, CancellationToken ct = default)
    {
        var valves = await _unitOfWork.Valves
            .Query()
            .Where(v => valveIds.Contains(v.Id))
            .ToListAsync(ct);

        if (valves.Count == 0)
            throw new ArgumentException("No valid valves found");

        var affectedPipeIds = new HashSet<Guid>();
        foreach (var valve in valves)
        {
            foreach (var pipeId in valve.AffectedPipeIds)
            {
                affectedPipeIds.Add(pipeId);
            }
        }

        var allPipes = await _unitOfWork.Pipes.GetAllAsync(ct);
        var queue = new Queue<Guid>(affectedPipeIds);
        var visited = new HashSet<Guid>(affectedPipeIds);

        while (queue.Count > 0)
        {
            var currentPipeId = queue.Dequeue();
            var currentPipe = allPipes.FirstOrDefault(p => p.Id == currentPipeId);
            if (currentPipe == null) continue;

            var connectedPipes = allPipes.Where(p =>
                (p.StartNodeId == currentPipe.StartNodeId || p.StartNodeId == currentPipe.EndNodeId ||
                 p.EndNodeId == currentPipe.StartNodeId || p.EndNodeId == currentPipe.EndNodeId)
                && !visited.Contains(p.Id)
                && !IsConnectedToSource(p, allPipes, valves));

            foreach (var connected in connectedPipes)
            {
                if (visited.Add(connected.Id))
                {
                    affectedPipeIds.Add(connected.Id);
                    queue.Enqueue(connected.Id);
                }
            }
        }

        var affectedPipeList = affectedPipeIds.ToList();
        var polygon = await BuildOutagePolygonAsync(affectedPipeList, ct);
        var zone = new OutageZone
        {
            Id = Guid.NewGuid(),
            ZoneName = $"停水区域_{DateTime.Now:yyyyMMddHHmm}",
            AffectedPipeIds = affectedPipeList,
            AffectedValveIds = valveIds,
            Polygon = polygon,
            IsApproved = false,
            CreatedAt = DateTime.UtcNow
        };

        zone.EstimatedUserCount = await EstimateAffectedUsersAsync(zone, ct);
        zone.NotificationText = await GenerateNotificationDraftAsync(zone, ct);

        return zone;
    }

    public async Task<List<GeoPoint>> BuildOutagePolygonAsync(List<Guid> affectedPipeIds, CancellationToken ct = default)
    {
        var pipes = await _unitOfWork.Pipes
            .Query()
            .Where(p => affectedPipeIds.Contains(p.Id))
            .ToListAsync(ct);

        if (pipes.Count == 0) return new List<GeoPoint>();

        var allPoints = new List<GeoPoint>();
        foreach (var pipe in pipes)
        {
            allPoints.AddRange(pipe.Geometry);
        }

        if (allPoints.Count < 3)
        {
            var centerLng = allPoints.Count > 0 ? allPoints.Average(p => p.Longitude) : 116.40;
            var centerLat = allPoints.Count > 0 ? allPoints.Average(p => p.Latitude) : 39.90;
            var r = 0.003;
            return new List<GeoPoint>
            {
                new() { Longitude = centerLng - r, Latitude = centerLat - r },
                new() { Longitude = centerLng + r, Latitude = centerLat - r },
                new() { Longitude = centerLng + r, Latitude = centerLat + r },
                new() { Longitude = centerLng - r, Latitude = centerLat + r }
            };
        }

        return BuildConvexHull(allPoints);
    }

    public Task<int> EstimateAffectedUsersAsync(OutageZone zone, CancellationToken ct = default)
    {
        var pipes = zone.AffectedPipeIds.Count;
        var avgUsersPerKm = 120;
        var totalLength = pipes * 0.15;
        var estimated = (int)(totalLength * avgUsersPerKm);
        return Task.FromResult(Math.Max(50, estimated));
    }

    public Task<string> GenerateNotificationDraftAsync(OutageZone zone, CancellationToken ct = default)
    {
        var startTime = zone.PlannedStartTime ?? DateTime.Now.AddHours(1);
        var endTime = zone.PlannedEndTime ?? startTime.AddHours(4);
        var text = $"【停水通知】因管网维修施工，预计 {startTime:yyyy年MM月dd日 HH:mm} 至 {endTime:HH:mm}，" +
                   $"{zone.ZoneName} 周边区域将暂停供水，预计影响约 {zone.EstimatedUserCount} 户用户。" +
                   "请提前做好储水准备，恢复供水时间可能因施工进度提前或延迟，敬请谅解。如有疑问请拨打客服热线：96XXXX。";
        return Task.FromResult(text);
    }

    private static bool IsConnectedToSource(Pipe pipe, List<Pipe> allPipes, List<Valve> closedValves)
    {
        var visited = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(pipe.Id);

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            if (!visited.Add(currentId)) continue;

            var current = allPipes.FirstOrDefault(p => p.Id == currentId);
            if (current == null) continue;

            foreach (var valve in closedValves)
            {
                if (valve.DownstreamPipeId == currentId)
                    return false;
            }

            var connected = allPipes.Where(p =>
                p.Id != currentId && !visited.Contains(p.Id) &&
                (p.StartNodeId == current.StartNodeId || p.StartNodeId == current.EndNodeId ||
                 p.EndNodeId == current.StartNodeId || p.EndNodeId == current.EndNodeId));

            foreach (var conn in connected)
            {
                queue.Enqueue(conn.Id);
            }
        }

        return true;
    }

    private static List<GeoPoint> BuildConvexHull(List<GeoPoint> points)
    {
        var ordered = points
            .OrderBy(p => p.Longitude)
            .ThenBy(p => p.Latitude)
            .ToList();

        var lower = new List<GeoPoint>();
        foreach (var p in ordered)
        {
            while (lower.Count >= 2 && Cross(lower[^2], lower[^1], p) <= 0)
                lower.RemoveAt(lower.Count - 1);
            lower.Add(p);
        }

        var upper = new List<GeoPoint>();
        for (var i = ordered.Count - 1; i >= 0; i--)
        {
            var p = ordered[i];
            while (upper.Count >= 2 && Cross(upper[^2], upper[^1], p) <= 0)
                upper.RemoveAt(upper.Count - 1);
            upper.Add(p);
        }

        lower.RemoveAt(lower.Count - 1);
        upper.RemoveAt(upper.Count - 1);
        lower.AddRange(upper);
        return lower;
    }

    private static double Cross(GeoPoint O, GeoPoint A, GeoPoint B)
    {
        return (A.Longitude - O.Longitude) * (B.Latitude - O.Latitude) -
               (A.Latitude - O.Latitude) * (B.Longitude - O.Longitude);
    }
}
