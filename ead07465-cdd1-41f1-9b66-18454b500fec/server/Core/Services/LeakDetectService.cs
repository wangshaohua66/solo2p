using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WaterDispatch.Core.Entities;
using WaterDispatch.Core.Interfaces;

namespace WaterDispatch.Core.Services;

public class LeakDetectService : ILeakDetectService
{
    private readonly IUnitOfWork _unitOfWork;

    public LeakDetectService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> IsPressureAnomalyAsync(Guid nodeId, double pressure, CancellationToken ct = default)
    {
        var node = await _unitOfWork.MonitorNodes.GetByIdAsync(nodeId, ct);
        if (node == null) return false;

        var deviation = pressure < node.NormalPressureMin
            ? (node.NormalPressureMin - pressure) / node.NormalPressureMin
            : pressure > node.NormalPressureMax
                ? (pressure - node.NormalPressureMax) / node.NormalPressureMax
                : 0;

        return deviation > 0.15;
    }

    public async Task<List<AnomalyPressureData>> DetectAbnormalNodesAsync(CancellationToken ct = default)
    {
        var nodes = await _unitOfWork.MonitorNodes
            .Query()
            .Where(n => n.IsOnline && n.CurrentPressure.HasValue)
            .ToListAsync(ct);

        var result = new List<AnomalyPressureData>();
        foreach (var node in nodes)
        {
            if (!node.CurrentPressure.HasValue) continue;

            var pressure = node.CurrentPressure.Value;
            double deviationPercent = 0;

            if (pressure < node.NormalPressureMin)
                deviationPercent = (node.NormalPressureMin - pressure) / node.NormalPressureMin * 100;
            else if (pressure > node.NormalPressureMax)
                deviationPercent = (pressure - node.NormalPressureMax) / node.NormalPressureMax * 100;

            if (deviationPercent > 15)
            {
                result.Add(new AnomalyPressureData(
                    node.Id,
                    pressure,
                    node.NormalPressureMin,
                    node.NormalPressureMax,
                    deviationPercent,
                    node.Longitude,
                    node.Latitude,
                    node.LastReadingTime ?? DateTime.UtcNow));
            }
        }

        return result.OrderByDescending(a => a.DeviationPercent).ToList();
    }

    public async Task<LeakLocationResult> LocateLeakAsync(List<Guid> abnormalNodeIds, CancellationToken ct = default)
    {
        var abnormalNodes = await _unitOfWork.MonitorNodes
            .Query()
            .Where(n => abnormalNodeIds.Contains(n.Id))
            .ToListAsync(ct);

        if (abnormalNodes.Count == 0)
        {
            throw new ArgumentException("No valid abnormal nodes found");
        }

        var weightedLng = 0.0;
        var weightedLat = 0.0;
        var totalWeight = 0.0;
        var maxDeviation = 0.0;

        foreach (var node in abnormalNodes)
        {
            if (!node.CurrentPressure.HasValue) continue;

            var deviation = node.CurrentPressure.Value < node.NormalPressureMin
                ? (node.NormalPressureMin - node.CurrentPressure.Value) / node.NormalPressureMin
                : 0.05;

            var weight = 1.0 / (deviation + 0.01);
            weightedLng += node.Longitude * weight;
            weightedLat += node.Latitude * weight;
            totalWeight += weight;
            maxDeviation = Math.Max(maxDeviation, deviation);
        }

        var centerLng = totalWeight > 0 ? weightedLng / totalWeight : abnormalNodes.Average(n => n.Longitude);
        var centerLat = totalWeight > 0 ? weightedLat / totalWeight : abnormalNodes.Average(n => n.Latitude);

        var candidates = await GenerateProbabilityHeatmapAsync(centerLng, centerLat, 0.005, ct);

        MonitorNode? nearestNode = null;
        double minDistance = double.MaxValue;
        foreach (var node in abnormalNodes)
        {
            var dist = CalculateDistance(centerLng, centerLat, node.Longitude, node.Latitude);
            if (dist < minDistance)
            {
                minDistance = dist;
                nearestNode = node;
            }
        }

        var allNodes = await _unitOfWork.MonitorNodes.GetAllAsync(ct);
        foreach (var node in allNodes)
        {
            var dist = CalculateDistance(centerLng, centerLat, node.Longitude, node.Latitude);
            if (dist < minDistance)
            {
                minDistance = dist;
                nearestNode = node;
            }
        }

        var confidence = Math.Min(0.95, 0.5 + maxDeviation * 2 + abnormalNodes.Count * 0.05);
        var estimatedRadius = Math.Max(50, 200 - abnormalNodes.Count * 20);

        return new LeakLocationResult(
            centerLng,
            centerLat,
            confidence,
            estimatedRadius,
            candidates,
            nearestNode?.Id,
            minDistance * 111000);
    }

    public async Task<LeakEvent> CreateLeakEventAsync(List<Guid> abnormalNodeIds, CancellationToken ct = default)
    {
        var location = await LocateLeakAsync(abnormalNodeIds, ct);

        var severity = location.Confidence switch
        {
            >= 0.85 => LeakSeverity.Critical,
            >= 0.70 => LeakSeverity.High,
            >= 0.55 => LeakSeverity.Medium,
            _ => LeakSeverity.Low
        };

        var leakEvent = new LeakEvent
        {
            Id = Guid.NewGuid(),
            EventNo = $"LK{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(100, 999)}",
            Status = LeakEventStatus.Detected,
            Severity = severity,
            Longitude = location.Longitude,
            Latitude = location.Latitude,
            Confidence = location.Confidence,
            EstimatedRadius = location.EstimatedRadius,
            Source = "AutoDetect",
            AbnormalNodeIds = abnormalNodeIds,
            CandidatePoints = location.CandidatePoints,
            NearestNodeId = location.NearestNodeId,
            DistanceToNearestNode = location.DistanceToNearestNode,
            DetectedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Description = $"系统自动检测到疑似漏损，置信度 {location.Confidence:P0}"
        };

        await _unitOfWork.LeakEvents.AddAsync(leakEvent, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return leakEvent;
    }

    public async Task<List<LeakCandidatePoint>> GenerateProbabilityHeatmapAsync(double centerLng, double centerLat, double radius, CancellationToken ct = default)
    {
        var candidates = new List<LeakCandidatePoint>();
        var random = new Random(42);
        var gridSize = 15;

        for (var i = 0; i < gridSize; i++)
        {
            for (var j = 0; j < gridSize; j++)
            {
                var offsetX = (i - gridSize / 2.0) * radius / gridSize * 2;
                var offsetY = (j - gridSize / 2.0) * radius / gridSize * 2;
                var distance = Math.Sqrt(offsetX * offsetX + offsetY * offsetY);

                if (distance > radius) continue;

                var baseProbability = 1.0 - distance / radius;
                var noise = (random.NextDouble() - 0.5) * 0.15;
                var probability = Math.Max(0, Math.Min(1, baseProbability + noise));

                if (probability > 0.15)
                {
                    candidates.Add(new LeakCandidatePoint
                    {
                        Longitude = centerLng + offsetX,
                        Latitude = centerLat + offsetY,
                        Probability = probability
                    });
                }
            }
        }

        return candidates.OrderByDescending(c => c.Probability).ToList();
    }

    public async Task<double> CalculatePipeHealthScoreAsync(Pipe pipe, CancellationToken ct = default)
    {
        await Task.CompletedTask;

        double ageScore = pipe.InstallYear > 0
            ? Math.Max(0, 100 - (DateTime.Now.Year - pipe.InstallYear) * 1.5)
            : 70;

        var materialScores = new Dictionary<string, double>
        {
            ["球墨铸铁"] = 90, ["铸铁"] = 65, ["钢管"] = 85,
            ["PE"] = 95, ["PVC"] = 88, ["混凝土"] = 70
        };
        double materialScore = materialScores.TryGetValue(pipe.Material, out var ms) ? ms : 70;

        double depthScore = pipe.BuriedDepth switch
        {
            < 0.8 => 70,
            < 1.5 => 90,
            _ => 85
        };

        double repairScore = Math.Max(0, 100 - pipe.RepairCount * 15);

        double diameterScore = pipe.Diameter switch
        {
            < 100 => 85,
            < 300 => 90,
            < 600 => 92,
            _ => 95
        };

        var score = ageScore * 0.30 + materialScore * 0.25 + depthScore * 0.10
                    + repairScore * 0.20 + diameterScore * 0.15;

        return Math.Round(score, 1);
    }

    public async Task<List<Pipe>> GeneratePreventiveMaintenanceListAsync(int topN = 50, CancellationToken ct = default)
    {
        var pipes = await _unitOfWork.Pipes.GetAllAsync(ct);
        var scoredPipes = new List<(Pipe Pipe, double Score)>();

        foreach (var pipe in pipes)
        {
            var score = await CalculatePipeHealthScoreAsync(pipe, ct);
            pipe.HealthScore = score;
            pipe.RiskLevel = score switch
            {
                >= 80 => 1,
                >= 60 => 2,
                >= 40 => 3,
                _ => 4
            };
            scoredPipes.Add((pipe, score));
        }

        return scoredPipes
            .OrderBy(p => p.Score)
            .Take(topN)
            .Select(p => p.Pipe)
            .ToList();
    }

    private static double CalculateDistance(double lng1, double lat1, double lng2, double lat2)
    {
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return c * 6371;
    }
}
