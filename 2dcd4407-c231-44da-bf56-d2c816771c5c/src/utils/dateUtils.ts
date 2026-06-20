import dayjs from 'dayjs';
import type { Schedule } from '../types';

export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const formatTime = (date: string | Date, format = 'HH:mm:ss'): string => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string => {
  return dayjs(date).format(format);
};

export const formatRelativeTime = (date: string | Date): string => {
  const now = dayjs();
  const target = dayjs(date);
  const diffDays = now.diff(target, 'day');
  
  if (diffDays === 0) {
    const diffHours = now.diff(target, 'hour');
    if (diffHours === 0) {
      const diffMinutes = now.diff(target, 'minute');
      return diffMinutes <= 1 ? '刚刚' : `${diffMinutes}分钟前`;
    }
    return `${diffHours}小时前`;
  }
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return formatDate(date);
};

export const getDateRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const startDate = dayjs(start);
  const endDate = dayjs(end);
  
  let current = startDate;
  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  
  return dates;
};

export const getDaysDiff = (start: string | Date, end: string | Date): number => {
  return dayjs(end).diff(dayjs(start), 'day');
};

export const isDateOverlap = (
  start1: string, end1: string,
  start2: string, end2: string
): boolean => {
  return !(dayjs(end1).isBefore(dayjs(start2)) || dayjs(start1).isAfter(dayjs(end2)));
};

export const checkScheduleConflict = (
  schedule: Schedule,
  existingSchedules: Schedule[]
): Schedule[] => {
  return existingSchedules.filter(existing => {
    if (existing.id === schedule.id) return false;
    
    const hasOverlapVenue = schedule.venueIds.some(v => 
      existing.venueIds.includes(v)
    );
    
    if (!hasOverlapVenue) return false;
    
    return isDateOverlap(
      schedule.startDate, schedule.endDate,
      existing.startDate, existing.endDate
    );
  });
};

export const getMonthDays = (year: number, month: number): number => {
  return dayjs(`${year}-${month}-01`).daysInMonth();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return dayjs(`${year}-${month}-01`).day();
};

export const getQuarter = (date: string | Date): number => {
  return Math.ceil((dayjs(date).month() + 1) / 3);
};

export const getYearQuarter = (date: string | Date): string => {
  const d = dayjs(date);
  return `${d.year()}Q${getQuarter(date)}`;
};

export const toISOString = (date: string | Date): string => {
  return dayjs(date).toISOString();
};

export const isToday = (date: string | Date): boolean => {
  return dayjs(date).isSame(dayjs(), 'day');
};

export const isPast = (date: string | Date): boolean => {
  return dayjs(date).isBefore(dayjs(), 'day');
};

export const isFuture = (date: string | Date): boolean => {
  return dayjs(date).isAfter(dayjs(), 'day');
};

export const isWithinDays = (date: string | Date, days: number): boolean => {
  const diff = dayjs(date).diff(dayjs(), 'day');
  return diff >= 0 && diff <= days;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分钟`;
  if (mins === 0) return `${hours}小时`;
  return `${hours}小时${mins}分钟`;
};
