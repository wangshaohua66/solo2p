import type {
  Substation,
  Equipment,
  TransmissionLine,
  AdjacencyMap,
  PowerSupplyPath,
  OutageScope,
  VoltageLevel,
  OutageLevel,
} from '@/types';

export function buildAdjacencyMap(
  substations: Substation[],
  lines: TransmissionLine[],
  equipments: Equipment[]
): AdjacencyMap {
  const adjacencyMap: AdjacencyMap = new Map();

  const ensureNode = (nodeId: string) => {
    if (!adjacencyMap.has(nodeId)) {
      adjacencyMap.set(nodeId, []);
    }
  };

  const addEdge = (from: string, to: string) => {
    ensureNode(from);
    ensureNode(to);
    const fromEdges = adjacencyMap.get(from)!;
    const toEdges = adjacencyMap.get(to)!;
    if (!fromEdges.includes(to)) fromEdges.push(to);
    if (!toEdges.includes(from)) toEdges.push(from);
  };

  substations.forEach((s) => ensureNode(s.id));
  lines.forEach((l) => ensureNode(l.id));
  equipments.forEach((e) => ensureNode(e.id));

  lines.forEach((line) => {
    addEdge(line.fromStationId, line.id);
    addEdge(line.id, line.toStationId);
  });

  const stationToEquipment: Map<string, string[]> = new Map();
  equipments.forEach((eq) => {
    if (!stationToEquipment.has(eq.substationId)) {
      stationToEquipment.set(eq.substationId, []);
    }
    stationToEquipment.get(eq.substationId)!.push(eq.id);

    if (eq.parentId) {
      addEdge(eq.parentId, eq.id);
    }
    if (eq.children) {
      eq.children.forEach((childId) => addEdge(eq.id, childId));
    }
  });

  stationToEquipment.forEach((eqIds, stationId) => {
    const topLevelEquipments = equipments.filter(
      (e) => e.substationId === stationId && !e.parentId
    );
    topLevelEquipments.forEach((eq) => {
      addEdge(stationId, eq.id);
    });
  });

  return adjacencyMap;
}

const pathCache = new Map<string, PowerSupplyPath[]>();

export function findPowerSupplyPaths(
  targetId: string,
  adjacencyMap: AdjacencyMap,
  substations: Substation[]
): PowerSupplyPath[] {
  const cacheKey = targetId;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }

  const sourceIds = substations
    .filter((s) => s.voltageLevel === '500kV')
    .map((s) => s.id);

  const paths: PowerSupplyPath[] = [];
  const visited = new Set<string>();
  const currentPath: string[] = [];

  const dfs = (nodeId: string) => {
    visited.add(nodeId);
    currentPath.push(nodeId);

    if (sourceIds.includes(nodeId)) {
      paths.push([...currentPath].reverse());
    }

    const neighbors = adjacencyMap.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }

    currentPath.pop();
    visited.delete(nodeId);
  };

  dfs(targetId);

  paths.sort((a, b) => a.length - b.length);
  pathCache.set(cacheKey, paths);
  return paths;
}

export function findAllPowerSupplyPaths(
  targetIds: string[],
  adjacencyMap: AdjacencyMap,
  substations: Substation[]
): PowerSupplyPath[] {
  const allPaths: PowerSupplyPath[] = [];
  const seenPaths = new Set<string>();

  targetIds.forEach((id) => {
    const paths = findPowerSupplyPaths(id, adjacencyMap, substations);
    paths.forEach((p) => {
      const key = p.join('->');
      if (!seenPaths.has(key)) {
        seenPaths.add(key);
        allPaths.push(p);
      }
    });
  });

  return allPaths;
}

export function calculateOutageScope(
  equipmentId: string,
  adjacencyMap: AdjacencyMap,
  substations: Substation[],
  equipments: Equipment[],
  lines: TransmissionLine[]
): OutageScope {
  const allPaths = findPowerSupplyPaths(equipmentId, adjacencyMap, substations);

  if (allPaths.length === 0) {
    return {
      outageNodes: new Set(),
      level1Nodes: new Set(),
      level2Nodes: new Set(),
      affectedStations: [],
      lostCapacity: 0,
      outageLevel: 'level3',
    };
  }

  const outageNodes = new Set<string>();
  const level1Nodes = new Set<string>();
  const level2Nodes = new Set<string>();
  const visited = new Set<string>();

  outageNodes.add(equipmentId);

  const downstreamDfs = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const neighbors = adjacencyMap.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (neighbor === equipmentId) continue;

      const neighborPaths = findPowerSupplyPaths(neighbor, adjacencyMap, substations);

      if (neighborPaths.length === 0) continue;

      const allPathsThroughCut = neighborPaths.every((path) =>
        path.includes(equipmentId)
      );
      const somePathsThroughCut = neighborPaths.some((path) =>
        path.includes(equipmentId)
      );

      if (allPathsThroughCut) {
        outageNodes.add(neighbor);
        level1Nodes.add(neighbor);
        downstreamDfs(neighbor);
      } else if (somePathsThroughCut) {
        level2Nodes.add(neighbor);
        outageNodes.add(neighbor);
      }
    }
  };

  downstreamDfs(equipmentId);

  const affectedStationsSet = new Set<string>();
  outageNodes.forEach((nodeId) => {
    const substation = substations.find((s) => s.id === nodeId);
    if (substation) {
      affectedStationsSet.add(substation.id);
      return;
    }
    const equipment = equipments.find((e) => e.id === nodeId);
    if (equipment) {
      affectedStationsSet.add(equipment.substationId);
    }
    const line = lines.find((l) => l.id === nodeId);
    if (line) {
      affectedStationsSet.add(line.fromStationId);
      affectedStationsSet.add(line.toStationId);
    }
  });

  let lostCapacity = 0;
  affectedStationsSet.forEach((stationId) => {
    const station = substations.find((s) => s.id === stationId);
    if (station) {
      if (level1Nodes.has(stationId)) {
        lostCapacity += station.capacity;
      } else {
        lostCapacity += station.capacity * 0.5;
      }
    }
  });

  equipments.forEach((eq) => {
    if (level1Nodes.has(eq.id) && eq.ratedCapacity) {
      lostCapacity += eq.ratedCapacity;
    }
  });

  let outageLevel: OutageLevel = 'level3';
  const level1Count = level1Nodes.size;
  if (level1Count > 5 || lostCapacity > 500) {
    outageLevel = 'level1';
  } else if (level1Count > 0 || lostCapacity > 100) {
    outageLevel = 'level2';
  }

  return {
    outageNodes,
    level1Nodes,
    level2Nodes,
    affectedStations: Array.from(affectedStationsSet),
    lostCapacity: Math.round(lostCapacity),
    outageLevel,
  };
}

export function getNodeVoltageLevel(
  nodeId: string,
  substations: Substation[],
  lines: TransmissionLine[]
): VoltageLevel | null {
  const station = substations.find((s) => s.id === nodeId);
  if (station) return station.voltageLevel;

  const line = lines.find((l) => l.id === nodeId);
  if (line) return line.voltageLevel;

  return null;
}

export function clearTopologyCache(): void {
  pathCache.clear();
}
