import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Tilemap, TileLayer, TriggerZone, ToolType, ZoneType } from '@/types';
import { useProjectStore } from './project';
import { genId, clamp } from '@/utils/id';
import { deepClone } from '@/utils/diff';

function emptyCells(cols: number, rows: number): (string | null)[][] {
  const arr: (string | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < cols; c++) row.push(null);
    arr.push(row);
  }
  return arr;
}

export const useTilemapStore = defineStore('tilemap', () => {
  const projectStore = useProjectStore();
  const selectedMapId = ref<string | null>(null);
  const selectedLayerId = ref<string | null>(null);
  const selectedTileFrameId = ref<string | null>(null);
  const selectedZoneId = ref<string | null>(null);
  const tool = ref<ToolType>('brush');
  const zoom = ref(1);
  const panOffset = ref({ x: 0, y: 0 });
  const showCollision = ref(true);

  const clipboard = ref<{
    cells: (string | null)[][];
    cols: number;
    rows: number;
  } | null>(null);

  const selectedMap = computed<Tilemap | null>(() =>
    projectStore.tilemaps.find(t => t.id === selectedMapId.value) || null
  );

  const selectedLayer = computed<TileLayer | null>(() => {
    const m = selectedMap.value;
    if (!m || !selectedLayerId.value) return null;
    return m.layers.find(l => l.id === selectedLayerId.value) || null;
  });

  const availableTileFrames = computed(() => {
    const frames: { id: string; name: string; sheetId: string; sheetName: string; x: number; y: number; w: number; h: number; }[] = [];
    for (const ss of projectStore.spriteSheets) {
      for (const f of ss.frames) {
        frames.push({
          id: f.id, name: f.name, sheetId: ss.id, sheetName: ss.name,
          x: f.x, y: f.y, w: f.width, h: f.height
        });
      }
    }
    return frames;
  });

  function createMap(name: string, cols = 64, rows = 64, tileW = 32, tileH = 32): Tilemap | null {
    if (!projectStore.currentProjectId) return null;
    cols = clamp(cols, 1, 256); rows = clamp(rows, 1, 256);
    const layers: TileLayer[] = [];
    for (let i = 0; i < 8; i++) {
      layers.push({
        id: genId('lyr'), tilemapId: '',
        name: `图层 ${i + 1}`, zIndex: i, visible: true,
        cells: emptyCells(cols, rows)
      });
    }
    const tm: Tilemap = {
      id: genId('tm'), projectId: projectStore.currentProjectId,
      name, cols, rows, tileWidth: tileW, tileHeight: tileH,
      layers, triggerZones: []
    };
    tm.layers.forEach(l => l.tilemapId = tm.id);
    projectStore.tilemaps.push(tm);
    selectedMapId.value = tm.id;
    selectedLayerId.value = tm.layers[0].id;
    projectStore.persistCurrent();
    return tm;
  }

  function paintCell(layerId: string, col: number, row: number, frameId: string | null) {
    const l = findLayer(layerId);
    if (!l) return;
    if (row < 0 || row >= l.cells.length || col < 0 || col >= l.cells[0].length) return;
    const before = l.cells[row][col];
    if (before === frameId) return;
    l.cells[row][col] = frameId;
    projectStore.persistCurrent();
  }

  function floodFill(layerId: string, col: number, row: number, frameId: string | null) {
    const l = findLayer(layerId);
    if (!l) return;
    const target = l.cells[row]?.[col];
    if (target === frameId) return;
    const beforeCells = deepClone(l.cells);
    const stack: [number, number][] = [[col, row]];
    const visited = new Set<string>();
    while (stack.length) {
      const [c, r] = stack.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= l.cells.length || c < 0 || c >= l.cells[0].length) continue;
      if (l.cells[r][c] !== target) continue;
      visited.add(key);
      l.cells[r][c] = frameId;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    projectStore.pushHistory({
      type: 'tilemap-layer-cells', targetId: layerId,
      before: beforeCells, after: deepClone(l.cells),
      label: `填充 ${l.name}`
    });
    projectStore.persistCurrent();
  }

  function clearLayer(layerId: string) {
    const l = findLayer(layerId);
    if (!l) return;
    const beforeCells = deepClone(l.cells);
    const rows = l.cells.length, cols = l.cells[0].length;
    l.cells = emptyCells(cols, rows);
    projectStore.pushHistory({
      type: 'tilemap-layer-cells', targetId: layerId,
      before: beforeCells, after: deepClone(l.cells),
      label: `清空 ${l.name}`
    });
    projectStore.persistCurrent();
  }

  function findLayer(id: string): TileLayer | null {
    for (const tm of projectStore.tilemaps) {
      const l = tm.layers.find(x => x.id === id);
      if (l) return l;
    }
    return null;
  }

  function updateLayer(layerId: string, patch: Partial<TileLayer>) {
    const l = findLayer(layerId);
    if (l) { Object.assign(l, patch); projectStore.persistCurrent(); }
  }

  function addZone(mapId: string, type: ZoneType, x: number, y: number, w: number, h: number): TriggerZone | null {
    const m = projectStore.tilemaps.find(t => t.id === mapId);
    if (!m) return null;
    const z: TriggerZone = {
      id: genId('zn'), tilemapId: mapId, type, x, y, w, h, audioClipId: null
    };
    m.triggerZones.push(z);
    projectStore.persistCurrent();
    return z;
  }

  function updateZone(zoneId: string, patch: Partial<TriggerZone>) {
    for (const tm of projectStore.tilemaps) {
      const z = tm.triggerZones.find(x => x.id === zoneId);
      if (z) { Object.assign(z, patch); projectStore.persistCurrent(); return; }
    }
  }

  function deleteZone(zoneId: string) {
    for (const tm of projectStore.tilemaps) {
      const len = tm.triggerZones.length;
      tm.triggerZones = tm.triggerZones.filter(z => z.id !== zoneId);
      if (tm.triggerZones.length !== len) {
        if (selectedZoneId.value === zoneId) selectedZoneId.value = null;
        projectStore.persistCurrent(); return;
      }
    }
  }

  function updateMap(mapId: string, patch: Partial<Tilemap>) {
    const m = projectStore.tilemaps.find(t => t.id === mapId);
    if (m) { Object.assign(m, patch); projectStore.persistCurrent(); }
  }

  function deleteMap(id: string) {
    projectStore.tilemaps = projectStore.tilemaps.filter(t => t.id !== id);
    if (selectedMapId.value === id) {
      selectedMapId.value = null; selectedLayerId.value = null; selectedZoneId.value = null;
    }
    projectStore.persistCurrent();
  }

  function selectMap(id: string | null) {
    selectedMapId.value = id;
    selectedLayerId.value = null;
    selectedZoneId.value = null;
  }

  function moveLayer(mapId: string, layerId: string, direction: 'up' | 'down') {
    const m = projectStore.tilemaps.find(t => t.id === mapId);
    if (!m) return;
    m.layers.sort((a, b) => a.zIndex - b.zIndex);
    const idx = m.layers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= m.layers.length) return;
    const tmp = m.layers[idx].zIndex;
    m.layers[idx].zIndex = m.layers[targetIdx].zIndex;
    m.layers[targetIdx].zIndex = tmp;
    projectStore.persistCurrent();
  }

  function copySelection(
    layerId: string,
    startCol: number, startRow: number,
    endCol: number, endRow: number
  ) {
    const l = findLayer(layerId);
    if (!l) return;
    const c1 = Math.min(startCol, endCol), c2 = Math.max(startCol, endCol);
    const r1 = Math.min(startRow, endRow), r2 = Math.max(startRow, endRow);
    const cols = c2 - c1 + 1, rows = r2 - r1 + 1;
    const cells: (string | null)[][] = [];
    for (let r = r1; r <= r2; r++) {
      const row: (string | null)[] = [];
      for (let c = c1; c <= c2; c++) {
        row.push(l.cells[r]?.[c] ?? null);
      }
      cells.push(row);
    }
    clipboard.value = { cells, cols, rows };
  }

  function moveSelection(
    layerId: string,
    startCol: number, startRow: number,
    endCol: number, endRow: number,
    destCol: number, destRow: number
  ) {
    const l = findLayer(layerId);
    if (!l) return;
    const beforeCells = deepClone(l.cells);
    const c1 = Math.min(startCol, endCol), c2 = Math.max(startCol, endCol);
    const r1 = Math.min(startRow, endRow), r2 = Math.max(startRow, endRow);
    const w = c2 - c1 + 1, h = r2 - r1 + 1;

    const temp: (string | null)[][] = [];
    for (let r = r1; r <= r2; r++) {
      const row: (string | null)[] = [];
      for (let c = c1; c <= c2; c++) {
        row.push(l.cells[r]?.[c] ?? null);
        l.cells[r][c] = null;
      }
      temp.push(row);
    }

    for (let dr = 0; dr < h; dr++) {
      for (let dc = 0; dc < w; dc++) {
        const tr = destRow + dr, tc = destCol + dc;
        if (tr >= 0 && tr < l.cells.length && tc >= 0 && tc < l.cells[0].length) {
          l.cells[tr][tc] = temp[dr][dc];
        }
      }
    }

    projectStore.pushHistory({
      type: 'tilemap-layer-cells', targetId: layerId,
      before: beforeCells, after: deepClone(l.cells),
      label: `移动选区 ${l.name}`
    });
    projectStore.persistCurrent();
  }

  function pasteFromClipboard(layerId: string, destCol: number, destRow: number) {
    const l = findLayer(layerId);
    if (!l || !clipboard.value) return;
    const beforeCells = deepClone(l.cells);
    const { cells, cols, rows } = clipboard.value;
    for (let dr = 0; dr < rows; dr++) {
      for (let dc = 0; dc < cols; dc++) {
        const tr = destRow + dr, tc = destCol + dc;
        if (tr >= 0 && tr < l.cells.length && tc >= 0 && tc < l.cells[0].length) {
          if (cells[dr]?.[dc] !== undefined) l.cells[tr][tc] = cells[dr][dc];
        }
      }
    }
    projectStore.pushHistory({
      type: 'tilemap-layer-cells', targetId: layerId,
      before: beforeCells, after: deepClone(l.cells),
      label: `粘贴选区 ${l.name}`
    });
    projectStore.persistCurrent();
  }

  function hasClipboard(): boolean { return !!clipboard.value; }

  return {
    selectedMapId, selectedLayerId, selectedTileFrameId, selectedZoneId,
    tool, zoom, panOffset, showCollision, clipboard,
    selectedMap, selectedLayer, availableTileFrames,
    createMap, paintCell, floodFill, clearLayer,
    updateLayer, addZone, updateZone, deleteZone,
    updateMap, deleteMap, selectMap, moveLayer,
    copySelection, moveSelection, pasteFromClipboard, hasClipboard
  };
});
