import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getEventTypeColor(type: string): string {
  const colors: Record<string, string> = {
    football: '#00FF88',
    basketball: '#00D4FF',
    swimming: '#3B82F6',
    concert: '#FF6B35',
    business: '#A855F7',
    exhibition: '#F59E0B',
  };
  return colors[type] || '#6B7280';
}

export function getEventTypeGradient(type: string): string {
  const baseColor = getEventTypeColor(type);
  return `linear-gradient(135deg, ${baseColor}20 0%, ${baseColor}40 100%)`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: '#00FF88',
    occupied: '#FF6B35',
    maintenance: '#6B7280',
    transitioning: '#F59E0B',
    confirmed: '#00FF88',
    pending: '#F59E0B',
    locked: '#00D4FF',
    cancelled: '#EF4444',
  };
  return colors[status] || '#6B7280';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#00FF88',
  };
  return colors[severity] || '#6B7280';
}

export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
