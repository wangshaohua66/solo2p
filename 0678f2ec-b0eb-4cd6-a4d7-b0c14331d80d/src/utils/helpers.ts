import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { Position, VehicleType } from '@/types/apron';
import { VEHICLE_TYPE_COLORS } from './constants';

dayjs.extend(utc);
dayjs.extend(timezone);

export const formatDateTime = (timestamp: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(timestamp).format(format);
};

export const formatUTCTime = (timestamp: number, format: string = 'HH:mm:ss'): string => {
  return dayjs(timestamp).utc().format(format);
};

export const formatBeijingTime = (timestamp: number, format: string = 'HH:mm:ss'): string => {
  return dayjs(timestamp).tz('Asia/Shanghai').format(format);
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}min`;
};

export const formatTime = (timestamp: number): string => {
  return dayjs(timestamp).format('HH:mm');
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const lerp = (start: number, end: number, t: number): number => {
  return start + (end - start) * t;
};

export const lerpPosition = (start: Position, end: Position, t: number): Position => {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
  };
};

export const distance = (a: Position, b: Position): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const headingTo = (from: Position, to: Position): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

export const randomRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(randomRange(min, max + 1));
};

export const randomPick = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

export const getVehicleColor = (type: VehicleType): string => {
  return VEHICLE_TYPE_COLORS[type];
};

export const getWindDirectionLabel = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
};

export const getCrosswindComponent = (windSpeed: number, windDirection: number, runwayHeading: number = 0): number => {
  const angleDiff = Math.abs(windDirection - runwayHeading);
  const crosswindAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
  return Math.abs(windSpeed * Math.sin((crosswindAngle * Math.PI) / 180));
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const padZero = (num: number, length: number = 2): string => {
  return num.toString().padStart(length, '0');
};
