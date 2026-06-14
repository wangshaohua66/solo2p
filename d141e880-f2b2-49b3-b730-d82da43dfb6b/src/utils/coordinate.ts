import { Grid } from '@/types';

export const GRID_SIZE = 5;

export const gridToWorld = (
  gridRow: number,
  gridCol: number,
  cellSize: number = GRID_SIZE
): { x: number; y: number } => {
  return {
    x: gridCol * cellSize,
    y: gridRow * cellSize,
  };
};

export const worldToGrid = (
  worldX: number,
  worldY: number,
  cellSize: number = GRID_SIZE
): { row: number; col: number } => {
  return {
    row: Math.floor(worldY / cellSize),
    col: Math.floor(worldX / cellSize),
  };
};

export const calculateGridArea = (width: number, height: number): number => {
  return width * height;
};

export const calculateOffset = (
  gridX: number,
  gridY: number,
  clickX: number,
  clickY: number,
  scale: number
): { offsetX: number; offsetY: number } => {
  return {
    offsetX: (clickX - gridX) / scale,
    offsetY: (clickY - gridY) / scale,
  };
};

export const generateGridId = (siteId: string, row: number, col: number): string => {
  return `${siteId}_grid_${row}_${col}`;
};

export const generateGridsForSite = (
  siteId: string,
  rows: number,
  cols: number,
  recorderId: string = '',
  cellSize: number = GRID_SIZE
): Grid[] => {
  const grids: Grid[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = gridToWorld(row, col, cellSize);
      grids.push({
        id: generateGridId(siteId, row, col),
        siteId,
        row,
        col,
        x,
        y,
        width: cellSize,
        height: cellSize,
        status: 'unexcavated',
        recorderId,
        artifactCount: 0,
      });
    }
  }
  
  return grids;
};

export const splitGrid = (grid: Grid, splitCount: number = 2): Grid[] => {
  const newWidth = grid.width / splitCount;
  const newHeight = grid.height / splitCount;
  const newGrids: Grid[] = [];
  
  for (let i = 0; i < splitCount; i++) {
    for (let j = 0; j < splitCount; j++) {
      newGrids.push({
        ...grid,
        id: `${grid.id}_split_${i}_${j}`,
        x: grid.x + j * newWidth,
        y: grid.y + i * newHeight,
        width: newWidth,
        height: newHeight,
        col: grid.col * splitCount + j,
        row: grid.row * splitCount + i,
      });
    }
  }
  
  return newGrids;
};

export const mergeGrids = (grids: Grid[]): Grid | null => {
  if (grids.length === 0) return null;
  
  const siteId = grids[0].siteId;
  const minX = Math.min(...grids.map(g => g.x));
  const minY = Math.min(...grids.map(g => g.y));
  const maxX = Math.max(...grids.map(g => g.x + g.width));
  const maxY = Math.max(...grids.map(g => g.y + g.height));
  
  const merged: Grid = {
    id: `${siteId}_grid_merged_${Date.now()}`,
    siteId,
    row: Math.min(...grids.map(g => g.row)),
    col: Math.min(...grids.map(g => g.col)),
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    status: grids[0].status,
    recorderId: grids[0].recorderId,
    artifactCount: grids.reduce((sum, g) => sum + g.artifactCount, 0),
  };
  
  return merged;
};

export const getGridCenter = (grid: Grid): { x: number; y: number } => {
  return {
    x: grid.x + grid.width / 2,
    y: grid.y + grid.height / 2,
  };
};

export const isValidOffset = (offsetX: number, offsetY: number, grid: Grid): boolean => {
  return offsetX >= 0 && offsetX <= grid.width && offsetY >= 0 && offsetY <= grid.height;
};
