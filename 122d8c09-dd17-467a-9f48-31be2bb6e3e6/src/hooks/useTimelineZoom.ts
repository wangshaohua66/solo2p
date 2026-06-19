import { useState, useCallback, useMemo } from 'react';
import type { TimelineGranularity } from '@/types';
import { DAY_MS, WEEK_MS, addDays, today } from '@/utils/dateUtils';

const GRANULARITY_CONFIG: Record<TimelineGranularity, { pxPerUnit: number; unitMs: number; label: string }> = {
  day: { pxPerUnit: 40, unitMs: DAY_MS, label: '日' },
  week: { pxPerUnit: 80, unitMs: WEEK_MS, label: '周' },
  month: { pxPerUnit: 140, unitMs: DAY_MS * 30, label: '月' },
  quarter: { pxPerUnit: 220, unitMs: DAY_MS * 90, label: '季' },
};

export function useTimelineZoom(initialGranularity: TimelineGranularity = 'week') {
  const [granularity, setGranularity] = useState<TimelineGranularity>(initialGranularity);
  const [viewStart, setViewStart] = useState<number>(() => addDays(today(), -14));
  const [viewEnd, setViewEnd] = useState<number>(() => addDays(today(), 90));
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  const config = GRANULARITY_CONFIG[granularity];

  const dateToPixel = useCallback(
    (date: number): number => {
      return Math.round(((date - viewStart) / config.unitMs) * config.pxPerUnit);
    },
    [viewStart, config]
  );

  const pixelToDate = useCallback(
    (pixel: number): number => {
      return viewStart + Math.round((pixel / config.pxPerUnit) * config.unitMs);
    },
    [viewStart, config]
  );

  const totalWidth = useMemo(() => {
    return Math.round(((viewEnd - viewStart) / config.unitMs) * config.pxPerUnit);
  }, [viewStart, viewEnd, config]);

  const zoomIn = useCallback(() => {
    setGranularity(prev => {
      if (prev === 'day') return prev;
      if (prev === 'week') return 'day';
      if (prev === 'month') return 'week';
      return 'month';
    });
  }, []);

  const zoomOut = useCallback(() => {
    setGranularity(prev => {
      if (prev === 'quarter') return prev;
      if (prev === 'month') return 'quarter';
      if (prev === 'week') return 'month';
      return 'week';
    });
  }, []);

  const setGranularitySafe = useCallback((g: TimelineGranularity) => {
    setGranularity(g);
  }, []);

  const scrollToToday = useCallback(() => {
    const todayPx = dateToPixel(today());
    setScrollX(Math.max(0, todayPx - 400));
  }, [dateToPixel]);

  const pan = useCallback((deltaX: number, deltaY: number) => {
    setScrollX(prev => Math.max(0, prev + deltaX));
    setScrollY(prev => Math.max(0, prev + deltaY));
  }, []);

  return {
    granularity,
    setGranularity: setGranularitySafe,
    viewStart,
    viewEnd,
    setViewStart,
    setViewEnd,
    scrollX,
    scrollY,
    setScrollX,
    setScrollY,
    dateToPixel,
    pixelToDate,
    totalWidth,
    pxPerUnit: config.pxPerUnit,
    unitMs: config.unitMs,
    granularityLabel: config.label,
    zoomIn,
    zoomOut,
    scrollToToday,
    pan,
  };
}
