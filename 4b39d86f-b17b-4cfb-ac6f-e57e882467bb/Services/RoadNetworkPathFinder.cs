using System.Collections;

namespace HazChemSupervision.Services;

public static class RoadNetworkPathFinder
{
    private sealed class RoadNode
    {
        public int Id { get; init; }
        public decimal Lat { get; init; }
        public decimal Lon { get; init; }
        public List<Edge> Edges { get; } = new();
    }

    private sealed record Edge(int NeighborId, double Distance, bool IsHighway);

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

    public delegate double DistanceDelegate(decimal lat1, decimal lon1, decimal lat2, decimal lon2);

    public static List<(decimal Lat, decimal Lon)> FindPath(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc)
    {
        var graph = BuildRoadNetworkGraph(startLat, startLon, endLat, endLon, distanceFunc);

        if (graph.Count == 0)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var startNodeId = FindNearestNode(graph, startLat, startLon, distanceFunc);
        var endNodeId = FindNearestNode(graph, endLat, endLon, distanceFunc);

        if (startNodeId == endNodeId)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var pathNodeIds = AStarSearch(graph, startNodeId, endNodeId, distanceFunc);

        if (pathNodeIds == null || pathNodeIds.Count == 0)
            return new List<(decimal Lat, decimal Lon)> { (startLat, startLon), (endLat, endLon) };

        var result = new List<(decimal Lat, decimal Lon)> { (startLat, startLon) };

        foreach (var nodeId in pathNodeIds)
        {
            var node = graph[nodeId];
            var distToStart = distanceFunc(node.Lat, node.Lon, startLat, startLon);
            var distToEnd = distanceFunc(node.Lat, node.Lon, endLat, endLon);

            if (distToStart > 80 && distToEnd > 80)
                result.Add((node.Lat, node.Lon));
        }

        result.Add((endLat, endLon));
        return result;
    }

    private static List<RoadNode> BuildRoadNetworkGraph(
        decimal startLat, decimal startLon,
        decimal endLat, decimal endLon,
        DistanceDelegate distanceFunc)
    {
        var totalDistance = distanceFunc(startLat, startLon, endLat, endLon);

        if (totalDistance < 2000)
            return new List<RoadNode>();

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
        var nodeGrid = new RoadNode[gridSize, gridSize];

        for (int row = 0; row < gridSize; row++)
        {
            for (int col = 0; col < gridSize; col++)
            {
                var lat = minLat + (maxLat - minLat) * row / (gridSize - 1);
                var lon = minLon + (maxLon - minLon) * col / (gridSize - 1);
                var node = new RoadNode
                {
                    Id = row * gridSize + col,
                    Lat = lat,
                    Lon = lon
                };
                nodes.Add(node);
                nodeGrid[row, col] = node;
            }
        }

        for (int row = 0; row < gridSize; row++)
        {
            for (int col = 0; col < gridSize; col++)
            {
                var node = nodeGrid[row, col];

                if (col + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row, col + 1], distanceFunc, row, col, gridSize);
                if (row + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row + 1, col], distanceFunc, row, col, gridSize);
                if (col + 1 < gridSize && row + 1 < gridSize)
                    TryAddEdge(node, nodeGrid[row + 1, col + 1], distanceFunc, row, col, gridSize, isDiagonal: true);
                if (col + 1 < gridSize && row - 1 >= 0)
                    TryAddEdge(node, nodeGrid[row - 1, col + 1], distanceFunc, row, col, gridSize, isDiagonal: true);
            }
        }

        return nodes;
    }

    private static void TryAddEdge(
        RoadNode from, RoadNode to,
        DistanceDelegate distanceFunc,
        int row, int col, int gridSize,
        bool isDiagonal = false)
    {
        if (IsEdgeBlocked(row, col, gridSize, isDiagonal))
            return;

        var distance = distanceFunc(from.Lat, from.Lon, to.Lat, to.Lon);
        if (distance < 1)
            return;

        var isHighway = !isDiagonal && IsHighwayEdge(row, col, gridSize);
        var edgeWeight = distance * (isHighway ? 0.8 : 1.0) * (isDiagonal ? 1.414 : 1.0);

        from.Edges.Add(new Edge(to.Id, edgeWeight, isHighway));
        to.Edges.Add(new Edge(from.Id, edgeWeight, isHighway));
    }

    private static bool IsEdgeBlocked(int row, int col, int gridSize, bool isDiagonal)
    {
        var hash = (row * 73856093) ^ (col * 19349663) ^ (gridSize * 83492791);
        var normalized = (uint)hash % 1000;

        if (!isDiagonal)
            return normalized < 80;

        return normalized < 350;
    }

    private static bool IsHighwayEdge(int row, int col, int gridSize)
    {
        var middle = gridSize / 2;
        return row == middle || col == middle || row == 0 || col == 0 || row == gridSize - 1 || col == gridSize - 1;
    }

    private static int FindNearestNode(
        List<RoadNode> graph,
        decimal lat, decimal lon,
        DistanceDelegate distanceFunc)
    {
        var bestId = 0;
        var bestDist = double.MaxValue;

        foreach (var node in graph)
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
        List<RoadNode> graph,
        int startNodeId, int endNodeId,
        DistanceDelegate distanceFunc)
    {
        var endNode = graph[endNodeId];

        double Heuristic(RoadNode node)
            => distanceFunc(node.Lat, node.Lon, endNode.Lat, endNode.Lon) * 0.9;

        var openSet = new PriorityQueue<int, double>();
        var gScores = new Dictionary<int, double>();
        var cameFrom = new Dictionary<int, int>();
        var closedSet = new HashSet<int>();

        gScores[startNodeId] = 0;
        openSet.Enqueue(startNodeId, Heuristic(graph[startNodeId]));

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

            var currentNode = graph[currentId];
            var currentG = gScores[currentId];

            foreach (var edge in currentNode.Edges)
            {
                if (closedSet.Contains(edge.NeighborId))
                    continue;

                var tentativeG = currentG + edge.Distance;

                if (!gScores.TryGetValue(edge.NeighborId, out var neighborG) || tentativeG < neighborG)
                {
                    gScores[edge.NeighborId] = tentativeG;
                    cameFrom[edge.NeighborId] = currentId;
                    var fScore = tentativeG + Heuristic(graph[edge.NeighborId]);
                    openSet.Enqueue(edge.NeighborId, fScore);
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
}
