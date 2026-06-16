import type { Layer, KonvaNode } from '@/types';
import { generateId } from './idGenerator';
import { MAX_LAYERS } from '@/types';

export const createDefaultLayers = (): Layer[] => {
  return [
    {
      id: generateId(),
      name: '图层 1',
      orderIndex: 0,
      visible: true,
      locked: false,
      nodes: [],
    },
  ];
};

export const addNewLayer = (layers: Layer[]): Layer[] => {
  if (layers.length >= MAX_LAYERS) return layers;
  const newLayer: Layer = {
    id: generateId(),
    name: `图层 ${layers.length + 1}`,
    orderIndex: layers.length,
    visible: true,
    locked: false,
    nodes: [],
  };
  return [...layers, newLayer];
};

export const deleteLayer = (layers: Layer[], layerId: string): Layer[] => {
  if (layers.length <= 1) return layers;
  return layers.filter((l) => l.id !== layerId).map((l, i) => ({ ...l, orderIndex: i }));
};

export const reorderLayer = (layers: Layer[], layerId: string, direction: 'up' | 'down'): Layer[] => {
  const idx = layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return layers;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= layers.length) return layers;
  const result = [...layers];
  [result[idx], result[newIdx]] = [result[newIdx], result[idx]];
  return result.map((l, i) => ({ ...l, orderIndex: i }));
};

export const toggleLayerVisible = (layers: Layer[], layerId: string): Layer[] => {
  return layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l));
};

export const toggleLayerLocked = (layers: Layer[], layerId: string): Layer[] => {
  return layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l));
};

export const addNodeToLayer = (layers: Layer[], layerId: string, node: KonvaNode): Layer[] => {
  return layers.map((l) =>
    l.id === layerId ? { ...l, nodes: [...l.nodes, node] } : l
  );
};

export const removeNodeFromLayer = (
  layers: Layer[],
  layerId: string,
  nodeId: string
): Layer[] => {
  return layers.map((l) =>
    l.id === layerId ? { ...l, nodes: l.nodes.filter((n) => n.id !== nodeId) } : l
  );
};

export const serializeLayers = (layers: Layer[]): string => {
  return JSON.stringify(layers);
};

export const deserializeLayers = (data: string | null | undefined): Layer[] => {
  if (!data) return createDefaultLayers();
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Layer[];
    return createDefaultLayers();
  } catch {
    return createDefaultLayers();
  }
};

export const getNodesByEraserPoint = (
  layers: Layer[],
  activeLayerId: string,
  x: number,
  y: number,
  brushSize: number
): { layerId: string; nodeId: string }[] => {
  const results: { layerId: string; nodeId: string }[] = [];
  const half = brushSize / 2;

  for (const layer of layers) {
    if (layer.id !== activeLayerId) continue;
    if (!layer.visible || layer.locked) continue;

    for (const node of layer.nodes) {
      let hit = false;
      if (node.type === 'line' || node.type === 'arrow') {
        for (let i = 0; i < node.points.length; i += 2) {
          const px = node.points[i];
          const py = node.points[i + 1];
          if (Math.abs(px - x) <= half && Math.abs(py - y) <= half) {
            hit = true;
            break;
          }
        }
      } else if (node.type === 'rect') {
        if (
          x >= node.x - half &&
          x <= node.x + node.width + half &&
          y >= node.y - half &&
          y <= node.y + node.height + half
        ) {
          hit = true;
        }
      } else if (node.type === 'ellipse') {
        const dx = (x - node.x) / Math.max(node.radiusX, 1);
        const dy = (y - node.y) / Math.max(node.radiusY, 1);
        if (dx * dx + dy * dy <= 1.5) hit = true;
      }
      if (hit) results.push({ layerId: layer.id, nodeId: node.id });
    }
  }
  return results;
};
