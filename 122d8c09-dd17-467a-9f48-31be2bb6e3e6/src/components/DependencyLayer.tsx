import React, { memo, useMemo } from 'react';
import type { Dependency, TaskNode } from '@/types';
import { useGanttStore } from '@/store/useGanttStore';
import { cubicBezierPath } from '@/utils/bezierUtils';

interface DependencyLayerProps {
  tasks: Record<string, TaskNode>;
  dateToPixel: (d: number) => number;
  rowHeight: number;
  getTaskTop: (taskId: string) => number;
  totalWidth: number;
  totalHeight: number;
}

type DepPoint = { x: number; y: number };

function getDepEndpoints(
  dep: Dependency,
  tasks: Record<string, TaskNode>,
  dateToPixel: (d: number) => number,
  getTaskTop: (taskId: string) => number,
  rowHeight: number
): { from: DepPoint; to: DepPoint } | null {
  const from = tasks[dep.fromTaskId];
  const to = tasks[dep.toTaskId];
  if (!from || !to || from.level !== 3 || to.level !== 3) return null;

  const fromLeft = dateToPixel(from.startDate);
  const fromRight = dateToPixel(from.endDate);
  const toLeft = dateToPixel(to.startDate);
  const toRight = dateToPixel(to.endDate);
  const fromTop = getTaskTop(from.id) + rowHeight / 2;
  const toTop = getTaskTop(to.id) + rowHeight / 2;

  let fx: number, fy: number, tx: number, ty: number;
  switch (dep.type) {
    case 'FS':
      fx = fromRight; fy = fromTop;
      tx = toLeft; ty = toTop;
      break;
    case 'SS':
      fx = fromLeft; fy = fromTop;
      tx = toLeft; ty = toTop;
      break;
    case 'FF':
      fx = fromRight; fy = fromTop;
      tx = toRight; ty = toTop;
      break;
    case 'SF':
      fx = fromLeft; fy = fromTop;
      tx = toRight; ty = toTop;
      break;
  }
  return { from: { x: fx, y: fy }, to: { x: tx, y: ty } };
}

export const DependencyLayer = memo(function DependencyLayer({
  tasks,
  dateToPixel,
  rowHeight,
  getTaskTop,
  totalWidth,
  totalHeight,
}: DependencyLayerProps) {
  const theme = useGanttStore(s => s.ui.theme);
  const dependencies = useGanttStore(s => s.dependencies);
  const criticalPathIds = useGanttStore(s => s.ui.criticalPathIds);
  const selectedTaskId = useGanttStore(s => s.ui.selectedTaskId);

  const lines = useMemo(() => {
    return dependencies
      .map(dep => {
        const pts = getDepEndpoints(dep, tasks, dateToPixel, getTaskTop, rowHeight);
        if (!pts) return null;
        const isCritical = criticalPathIds.includes(dep.fromTaskId) && criticalPathIds.includes(dep.toTaskId);
        const isHighlighted = selectedTaskId === dep.fromTaskId || selectedTaskId === dep.toTaskId;
        return {
          id: dep.id,
          path: cubicBezierPath(pts.from, pts.to, dep.type),
          to: pts.to,
          isCritical,
          isHighlighted,
          type: dep.type,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      path: string;
      to: DepPoint;
      isCritical: boolean;
      isHighlighted: boolean;
      type: Dependency['type'];
    }>;
  }, [dependencies, tasks, dateToPixel, getTaskTop, rowHeight, criticalPathIds, selectedTaskId]);

  const baseColor = theme === 'dark' ? '#475569' : '#94A3B8';
  const highlightColor = theme === 'dark' ? '#3B82F6' : '#2563EB';
  const criticalColor = '#F43F5E';

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-5"
      width={totalWidth}
      height={totalHeight}
    >
      <defs>
        <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={baseColor} />
        </marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={highlightColor} />
        </marker>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={criticalColor} />
        </marker>
        {criticalPathIds.length > 0 && (
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {lines.map(l => {
        const color = l.isCritical ? criticalColor : l.isHighlighted ? highlightColor : baseColor;
        const strokeW = l.isCritical ? 3 : l.isHighlighted ? 2.5 : 1.5;
        const marker = l.isCritical ? 'arrow-red' : l.isHighlighted ? 'arrow-blue' : 'arrow-gray';
        return (
          <g key={l.id}>
            <path
              d={l.path}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              markerEnd={`url(#${marker})`}
              filter={l.isCritical ? 'url(#glow)' : undefined}
              opacity={l.isCritical || l.isHighlighted ? 1 : 0.55}
            />
            {l.isCritical && (
              <path
                d={l.path}
                fill="none"
                stroke={criticalColor}
                strokeWidth={1}
                strokeLinecap="round"
                strokeDasharray="0 8"
                opacity={0.8}
              >
                <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1.2s" repeatCount="indefinite" />
              </path>
            )}
          </g>
        );
      })}
    </svg>
  );
});
