import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SpriteSheet, SpriteFrame, CutMode } from '@/types';
import { useProjectStore } from './project';
import { gridCut, contourCut, batchRename } from '@/utils/packer';
import { loadImage, genId } from '@/utils/id';
import { deepClone } from '@/utils/diff';

export const useSpriteStore = defineStore('sprite', () => {
  const projectStore = useProjectStore();
  const selectedSheetId = ref<string | null>(null);
  const selectedFrameId = ref<string | null>(null);
  const zoom = ref(1);
  const panOffset = ref({ x: 0, y: 0 });
  const editMode = ref<'cut' | 'anchor' | 'hitbox' | 'trigger'>('cut');

  const selectedSheet = computed<SpriteSheet | null>(() =>
    projectStore.spriteSheets.find(s => s.id === selectedSheetId.value) || null
  );

  const selectedFrame = computed<SpriteFrame | null>(() => {
    const sheet = selectedSheet.value;
    if (!sheet || !selectedFrameId.value) return null;
    return sheet.frames.find(f => f.id === selectedFrameId.value) || null;
  });

  async function addSpriteSheet(file: File): Promise<SpriteSheet | null> {
    if (!projectStore.currentProjectId) return null;
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((res, rej) => {
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    const img = await loadImage(dataUrl);
    if (img.width > 4096 || img.height > 4096) {
      alert('图片尺寸超出4096x4096限制');
      return null;
    }
    const sheet: SpriteSheet = {
      id: genId('ss'), projectId: projectStore.currentProjectId,
      name: file.name.replace(/\.[^.]+$/, ''),
      imageDataUrl: dataUrl, width: img.width, height: img.height,
      cutMode: 'grid', gridConfig: { cols: 4, rows: 4, padding: 0 },
      contourThreshold: 12, frames: []
    };
    projectStore.spriteSheets.push(sheet);
    selectedSheetId.value = sheet.id;
    await runCut(sheet, img);
    projectStore.persistCurrent();
    return sheet;
  }

  async function runCut(sheet: SpriteSheet, customImg?: HTMLImageElement) {
    const before = deepClone(sheet.frames);
    const img = customImg || await loadImage(sheet.imageDataUrl);
    if (sheet.cutMode === 'grid') {
      sheet.frames = gridCut(img, sheet.gridConfig.cols, sheet.gridConfig.rows, sheet.gridConfig.padding, sheet.id);
    } else {
      sheet.frames = contourCut(img, sheet.contourThreshold, 2, sheet.id);
    }
    projectStore.pushHistory({
      type: 'spritesheet-frames', targetId: sheet.id,
      before, after: deepClone(sheet.frames),
      label: `切割精灵表 ${sheet.name}`
    });
  }

  function selectSheet(id: string | null) {
    selectedSheetId.value = id;
    selectedFrameId.value = null;
  }

  function selectFrame(id: string | null) {
    selectedFrameId.value = id;
  }

  function setCutMode(sheetId: string, mode: CutMode) {
    const sheet = projectStore.spriteSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    sheet.cutMode = mode;
    runCut(sheet);
    projectStore.persistCurrent();
  }

  function updateGridConfig(sheetId: string, cols: number, rows: number, padding: number) {
    const sheet = projectStore.spriteSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    sheet.gridConfig = { cols, rows, padding };
    if (sheet.cutMode === 'grid') runCut(sheet);
    projectStore.persistCurrent();
  }

  function updateContourThreshold(sheetId: string, threshold: number) {
    const sheet = projectStore.spriteSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    sheet.contourThreshold = threshold;
    if (sheet.cutMode === 'contour') runCut(sheet);
    projectStore.persistCurrent();
  }

  function updateFrame(fid: string, patch: Partial<SpriteFrame>) {
    const sheet = selectedSheet.value;
    if (!sheet) return;
    const f = sheet.frames.find(x => x.id === fid);
    if (!f) return;
    const before = deepClone(f);
    Object.assign(f, patch);
    projectStore.pushHistory({
      type: 'frame', targetId: fid,
      before, after: deepClone(f),
      label: `更新帧 ${f.name}`
    });
    projectStore.persistCurrent();
  }

  function deleteSheet(id: string) {
    const sheet = projectStore.spriteSheets.find(s => s.id === id);
    if (sheet) {
      projectStore.pushHistory({
        type: 'spritesheet', targetId: id,
        before: deepClone(sheet), after: null as any,
        label: `删除精灵表 ${sheet.name}`
      });
    }
    projectStore.spriteSheets = projectStore.spriteSheets.filter(s => s.id !== id);
    if (selectedSheetId.value === id) selectSheet(null);
    projectStore.persistCurrent();
  }

  function renameFrames(sheetId: string, prefix: string) {
    const sheet = projectStore.spriteSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const before = deepClone(sheet.frames);
    sheet.frames = batchRename(sheet.frames, prefix);
    projectStore.pushHistory({
      type: 'spritesheet-frames', targetId: sheetId,
      before, after: deepClone(sheet.frames),
      label: `批量改名 ${sheet.name}`
    });
    projectStore.persistCurrent();
  }

  return {
    selectedSheetId, selectedFrameId, zoom, panOffset, editMode,
    selectedSheet, selectedFrame,
    addSpriteSheet, selectSheet, selectFrame,
    setCutMode, updateGridConfig, updateContourThreshold,
    updateFrame, deleteSheet, renameFrames
  };
});
