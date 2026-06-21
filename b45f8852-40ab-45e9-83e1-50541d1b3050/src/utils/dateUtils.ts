import dayjs from 'dayjs';
import type { VoltageLevel } from '@/types';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export function formatDate(timestamp: number, format: string = 'YYYY-MM-DD'): string {
  return dayjs(timestamp).format(format);
}

export function formatDateTime(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm');
}

export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}分钟`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}小时`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = Math.round(hours % 24);
  return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
}

export function calculateDurationH(startTime: number, endTime: number): number {
  return Math.max(0, Math.round(((endTime - startTime) / HOUR_MS) * 10) / 10);
}

export function isOverlapping(
  rangeA: [number, number],
  rangeB: [number, number]
): boolean {
  return rangeA[0] < rangeB[1] && rangeB[0] < rangeA[1];
}

export function getOverlapRange(
  rangeA: [number, number],
  rangeB: [number, number]
): [number, number] | null {
  const start = Math.max(rangeA[0], rangeB[0]);
  const end = Math.min(rangeA[1], rangeB[1]);
  return start < end ? [start, end] : null;
}

export function getOverlapDurationH(
  rangeA: [number, number],
  rangeB: [number, number]
): number {
  const overlap = getOverlapRange(rangeA, rangeB);
  if (!overlap) return 0;
  return calculateDurationH(overlap[0], overlap[1]);
}

export function getTimeRangeByZoom(
  baseTime: number,
  zoom: 'day' | 'week' | 'month'
): [number, number] {
  const start = dayjs(baseTime).startOf(zoom === 'day' ? 'day' : zoom === 'week' ? 'week' : 'month').valueOf();
  const end = dayjs(baseTime).endOf(zoom === 'day' ? 'day' : zoom === 'week' ? 'week' : 'month').valueOf();
  return [start, end];
}

export function generateTimeTicks(
  start: number,
  end: number,
  zoom: 'day' | 'week' | 'month'
): number[] {
  const ticks: number[] = [];
  const unit = zoom === 'day' ? 'hour' : zoom === 'week' ? 'day' : 'day';
  const step = zoom === 'day' ? 2 : zoom === 'week' ? 1 : 2;

  let current = dayjs(start);
  const endDay = dayjs(end);

  while (current.isBefore(endDay) || current.isSame(endDay)) {
    ticks.push(current.valueOf());
    current = current.add(step, unit as dayjs.ManipulateType);
  }

  return ticks;
}

export function voltageLevelToNumber(level: VoltageLevel): number {
  switch (level) {
    case '500kV':
      return 500;
    case '220kV':
      return 220;
    case '110kV':
      return 110;
  }
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
