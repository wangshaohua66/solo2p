using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HazChemSupervision.Services;

public sealed class RoadNetworkPathFinder
{
    private sealed class RoadNode
    {
        public int Id { get; init; }
        public decimal Lat { get; init; }
        public decimal Lon { get; init; }
        public string? Name { get; init; }
        public bool IsHighway { get; init; }
        public List<Edge> Edges { get; } = new();
    }

    private sealed record Edge(int NeighborId, double Weight, double Distance, bool IsHighway);

    private sealed class AStarNode : IComparable<AStarNode>
    {
        public int NodeId { get; init; }
        public double GScore { get; init; }
        public double FScore { get; init; }
        public int? CameFrom { get; init; }

        public int CompareTo(AStarNode? other)
        {
            if (other == null) return 1;
            var c = FScore.CompareTo(other.FScore);
            return c == 0 ? NodeId.CompareTo(other.NodeId) : c;
        }
    }

    private sealed class RoadNetworkGraph
    {
        public required string NetworkId { get; init; }
        public required List<RoadNode> Nodes { get; init; }
        public required Dictionary<int, RoadNode> NodeLookup { get; init; }
        public DateTime LoadedAt { get; init; }
        public string? FilePath { get; init; }
    }

    private sealed class RoadNetworkJson
    {
        [JsonPropertyName("networkId")]
        public string NetworkId { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("nodes")]
        public List<RoadNodeJson> Nodes { get; set; } = new();

        [JsonPropertyName("edges")]
        public List<RoadEdgeJson> Edges { get; set; } = new();
    }

    private sealed class RoadNodeJson
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("lat")]
        public decimal Lat { get; set; }

        [JsonPropertyName("lon")]
        public decimal Lon { get; set; }

        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("isHighway")]
        public bool IsHighway { get; set; }
    }

    private sealed class RoadEdgeJson
    {
        [JsonPropertyName("from")]
        public int From { get; set; }

        [JsonPropertyName("to")]
        public int To { get; set; }

        [JsonPropertyName("distance")]
        public double Distance { get; set; }

        [JsonPropertyName("isHighway")]
        public bool IsHighway { get; set; }

        [JsonPropertyName("roadClass")]
        public string? RoadClass { get; set; }

        [JsonPropertyName("speedLimit")]
        public int SpeedLimit { get; set; }

        [JsonPropertyName("lanes")]
        public int Lanes { get; set; }
    }

    public delegate double DistanceDelegate(decimal lat1, decimal lon1, decimal lat2, decimal lon2);

    private static readonly ConcurrentDictionary<string, RoadNetworkGraph> _graphCache = new();
    private static readonly string _defaultDataPath = Path.Combine("Data", "road-network.json");

    private static readonly object _loadLock = new();

    public static List<(decimal Lat, decimal Lon)> FindPath(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc,
        string? networkId = null)
    {
        var graph = GetRoadNetwork(networkId, startLat, startLon, endLat, endLon, distanceFunc);

        if (graph.Nodes.Count == 0)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var startNodeId = FindNearestNode(graph, startLat, startLon, distanceFunc);
        var endNodeId = FindNearestNode(graph, endLat, endLon, distanceFunc);

        if (startNodeId == endNodeId)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var pathNodeIds = AStarSearch(graph, startNodeId, endNodeId, distanceFunc);

        if (pathNodeIds == null || pathNodeIds.Count < 2)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var result = new List<(decimal Lat, decimal Lon)> { (startLat, startLon) };

        foreach (var nodeId in pathNodeIds)
        {
            if (graph.NodeLookup.TryGetValue(nodeId, out var node))
            {
                result.Add((node.Lat, node.Lon));
            }
        }

        result.Add((endLat, endLon));
        return result;
    }

    public static List<(decimal Lat, decimal Lon)> FindPathWithNodes(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc,
        out int nodeCount,
        string? networkId = null)
    {
        var graph = GetRoadNetwork(networkId, startLat, startLon, endLat, endLon, distanceFunc);
        nodeCount = graph.Nodes.Count;
        return FindPath(startLat, startLon, endLat, endLon, distanceFunc, networkId);
    }

    public static RoadNetworkStats GetNetworkStats(string? networkId = null)
    {
        var effectiveId = networkId ?? "default";
        if (_graphCache.TryGetValue(effectiveId, out var cached))
        {
            return new RoadNetworkStats
            {
                NetworkId = cached.NetworkId,
                NodeCount = cached.Nodes.Count,
                EdgeCount = cached.Nodes.Sum(n => n.Edges.Count) / 2,
                LoadedAt = cached.LoadedAt,
                Source = "cache"
            };
        }

        return new RoadNetworkStats { NetworkId = effectiveId, Source = "not_loaded" };
    }

    public static void ClearCache()
    {
        _graphCache.Clear();
    }

    public static bool RemoveFromCache(string networkId)
    {
        return _graphCache.TryRemove(networkId, out _);
    }

    private static RoadNetworkGraph GetRoadNetwork(
        string? networkId,
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc)
    {
        var effectiveId = networkId ?? "default";

        if (_graphCache.TryGetValue(effectiveId, out var cached))
            return cached;

        lock (_loadLock)
        {
            if (_graphCache.TryGetValue(effectiveId, out cached))
                return cached;

            RoadNetworkGraph graph;

            try
            {
                graph = LoadFromJsonFile(_defaultDataPath, effectiveId);
            }
            catch (Exception)
            {
                graph = BuildSyntheticGrid(startLat, startLon, endLat, endLon, distanceFunc, effectiveId);
            }

            if (graph.Nodes.Count == 0)
            {
                graph = BuildSyntheticGrid(startLat, startLon, endLat, endLon, distanceFunc, effectiveId);
            }

            graph = graph with { LoadedAt = DateTime.UtcNow, FilePath = _defaultDataPath };
            _graphCache[effectiveId] = graph;
            return graph;
        }
    }

    private static RoadNetworkGraph LoadFromJsonFile(string filePath, string networkId)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("路网数据文件不存在", filePath);

        using var stream = File.OpenRead(filePath);
        var data = JsonSerializer.Deserialize<RoadNetworkJson>(stream,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                AllowTrailingCommas = true
            });

        if (data == null || data.Nodes.Count == 0)
            throw new InvalidDataException("路网数据文件无效或为空");

        var nodes = new List<RoadNode>(data.Nodes.Count);
        var lookup = new Dictionary<int, RoadNode>(data.Nodes.Count);

        foreach (var n in data.Nodes)
        {
            var node = new RoadNode
            {
                Id = n.Id,
                Lat = n.Lat,
                Lon = n.Lon,
                Name = n.Name,
                IsHighway = n.IsHighway
            };
            nodes.Add(node);
            lookup[n.Id] = node;
        }

        foreach (var e in data.Edges)
        {
            if (!lookup.TryGetValue(e.From, out var fromNode) || !lookup.TryGetValue(e.To, out var toNode))
                continue;

            var weight = e.Distance > 0 ? e.Distance : HaversineDistance(fromNode.Lat, fromNode.Lon, toNode.Lat, toNode.Lon);
            var weightedDistance = weight * (e.IsHighway ? 0.8 : 1.0);

            fromNode.Edges.Add(new Edge(e.To, weightedDistance, weight, e.IsHighway));
            toNode.Edges.Add(new Edge(e.From, weightedDistance, weight, e.IsHighway));
        }

        return new RoadNetworkGraph
        {
            NetworkId = data.NetworkId ?? networkId,
            Nodes = nodes,
            NodeLookup = lookup,
            LoadedAt = DateTime.UtcNow,
            FilePath = filePath
        };
    }

    private static RoadNetworkGraph BuildSyntheticGrid(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc,
        string networkId)
    {
        var totalDistance = distanceFunc(startLat, startLon, endLat, endLon);

        if (totalDistance < 2000)
            return new RoadNetworkGraph
            {
                NetworkId = networkId,
                Nodes = new List<RoadNode>(),
                NodeLookup = new Dictionary<int, RoadNode>(),
                LoadedAt = DateTime.UtcNow
            };

        var gridSize = totalDistance switch
        {
            < 5000 => 5,
            < 15000 => 7,
            < 30000 => 9,
            < 60000 => 11,
            _ => 13
        };

        var padding = (decimal)0.15;
        var latSpan = Math.Abs(endLat - startLat);
        var lonSpan = Math.Abs(endLon - startLon);
        var minLat = Math.Min(startLat, endLat) - latSpan * padding;
        var maxLat = Math.Max(startLat, endLat) + latSpan * padding;
        var minLon = Math.Min(startLon, endLon) - lonSpan * padding;
        var maxLon = Math.Max(startLon, endLon) + lonSpan * padding;

        if (latSpan < 0.001m) { minLat -= 0.005m; maxLat += 0.005m; }
        if (lonSpan < 0.001m) { minLon -= 0.005m; maxLon += 0.005m; }

        var nodes = new List<RoadNode>(gridSize * gridSize);
        var lookup = new Dictionary<int, RoadNode>(gridSize * gridSize);
        var nodeGrid = new RoadNode[gridSize, gridSize];

        for (int row = 0; row < gridSize; row++)
        {
            for (int col = 0; col < gridSize; col++)
            {
                var id = row * gridSize + col;
                var node = new RoadNode
                {
                    Id = id,
                    Lat = minLat + (maxLat - minLat) * row / (gridSize - 1),
                    Lon = minLon + (maxLon - minLon) * col / (gridSize - 1),
                    IsHighway = row == 0 || col == 0 || row == gridSize - 1 || col == gridSize - 1
                };
                nodes.Add(node);
                lookup[id] = node;
                nodeGrid[row, col] = node;
            }
        }

        for (int row = 0; row < gridSize; row++)
        {
            for (int col = 0; col < gridSize; col++)
            {
                var node = nodeGrid[row, col];

                if (col + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row, col + 1], distanceFunc, row, col, gridSize, false);
                if (row + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row + 1, col], distanceFunc, row, col, gridSize, false);
                if (col + 1 < gridSize && row + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row + 1, col + 1], distanceFunc, row, col, gridSize, true);
                if (col + 1 < gridSize && row - 1 >= 0)
                    TryAddEdge(node, nodeGrid[row - 1, col + 1], distanceFunc, row, col, gridSize, true);
            }
        }

        return new RoadNetworkGraph
        {
            NetworkId = networkId,
            Nodes = nodes,
            NodeLookup = lookup,
            LoadedAt = DateTime.UtcNow
        };
    }

    private static void TryAddEdge(
        RoadNode from, RoadNode to,
        DistanceDelegate distanceFunc,
        int row, int col, int gridSize,
        bool isDiagonal)
    {
        var hash = (row * 73856093) ^ (col * 19349663) ^ (gridSize * 83492791);
        var normalized = (uint)hash % 1000;

        if ((!isDiagonal && normalized < 80) || (isDiagonal && normalized < 350))
            return;

        var distance = distanceFunc(from.Lat, from.Lon, to.Lat, to.Lon);
        if (distance < 1)
            return;

        var isHighway = !isDiagonal && (row == 0 || col == 0 || row == gridSize - 1 || col == gridSize - 1);
        var weight = distance * (isHighway ? 0.8 : 1.0) * (isDiagonal ? 1.414 : 1.0);

        from.Edges.Add(new Edge(to.Id, weight, distance, isHighway));
        to.Edges.Add(new Edge(from.Id, weight, distance, isHighway));
    }

    private static int FindNearestNode(
        RoadNetworkGraph graph,
        decimal lat, decimal lon,
        DistanceDelegate distanceFunc)
    {
        var bestId = graph.Nodes.First().Id;
        var bestDist = double.MaxValue;

        foreach (var node in graph.Nodes)
        {
            var dist = distanceFunc(node.Lat, node.Lon, lat, lon);
            if (dist < bestDist)
            {
                bestDist = dist;
                bestId = node.Id;
            }
        }

        return bestId;
    }

    private static List<int>? AStarSearch(
        RoadNetworkGraph graph,
        int startNodeId, int endNodeId,
        DistanceDelegate distanceFunc)
    {
        if (!graph.NodeLookup.TryGetValue(endNodeId, out var endNode))
            return null;

        double Heuristic(RoadNode node)
            => distanceFunc(node.Lat, node.Lon, endNode.Lat, endNode.Lon) * 0.9;

        var openSet = new PriorityQueue<int, double>();
        var gScores = new Dictionary<int, double>();
        var cameFrom = new Dictionary<int, int>();
        var closedSet = new HashSet<int>();

        if (!graph.NodeLookup.TryGetValue(startNodeId, out var startNodeObj))
            return null;

        gScores[startNodeId] = 0;
        openSet.Enqueue(startNodeId, Heuristic(startNodeObj));

        const int maxIterations = 5000;
        var iterations = 0;

        while (openSet.Count > 0 && iterations < maxIterations)
        {
            iterations++;
            var currentId = openSet.Dequeue();

            if (currentId == endNodeId)
                return ReconstructPath(cameFrom, currentId);

            if (closedSet.Contains(currentId))
                continue;
            closedSet.Add(currentId);

            if (!graph.NodeLookup.TryGetValue(currentId, out var currentNode))
                continue;

            var currentG = gScores[currentId];

            foreach (var edge in currentNode.Edges)
            {
                if (closedSet.Contains(edge.NeighborId))
                    continue;

                var tentativeG = currentG + edge.Weight;

                if (!gScores.TryGetValue(edge.NeighborId, out var neighborG) || tentativeG < neighborG)
                {
                    gScores[edge.NeighborId] = tentativeG;
                    cameFrom[edge.NeighborId] = currentId;

                    if (graph.NodeLookup.TryGetValue(edge.NeighborId, out var neighbor))
                    {
                        var fScore = tentativeG + Heuristic(neighbor);
                        openSet.Enqueue(edge.NeighborId, fScore);
                    }
                }
            }
        }

        return null;
    }

    private static List<int> ReconstructPath(Dictionary<int, int> cameFrom, int currentId)
    {
        var path = new List<int> { currentId };
        while (cameFrom.TryGetValue(currentId, out var prev))
        {
            path.Add(prev);
            currentId = prev;
        }
        path.Reverse();
        return path;
    }

    private static double HaversineDistance(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        var dLat = (double)(lat2 - lat1) * Math.PI / 180.0;
        var dLon = (double)(lon2 - lon1) * Math.PI / 180.0;

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos((double)lat1 * Math.PI / 180.0) * Math.Cos((double)lat2 * Math.PI / 180.0) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return 6371000 * c;
    }
}

public class RoadNetworkStats
{
    public string NetworkId { get; set; } = string.Empty;
    public int NodeCount { get; set; }
    public int EdgeCount { get; set; }
    public DateTime? LoadedAt { get; set; }
    public string Source { get; set; } = string.Empty;
}
