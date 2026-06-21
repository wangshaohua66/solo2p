import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const formatDate = (date: Date | string, pattern: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, pattern, { locale: zhCN });
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm', { locale: zhCN });
};

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm', { locale: zhCN });
};

export const formatMoney = (amount: number): string => {
  if (amount >= 100000000) {
    return `¥${(amount / 100000000).toFixed(2)}亿`;
  }
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`;
  }
  return `¥${amount.toLocaleString()}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString();
};

export const getMonthDays = (date: Date): Date[] => {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
};

export const getWeekDays = (date: Date): Date[] => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const isCurrentMonth = (day: Date, currentDate: Date): boolean => {
  return isSameMonth(day, currentDate);
};

export const isTodayDate = (day: Date): boolean => {
  return isToday(day);
};

export const getMonthName = (date: Date): string => {
  return format(date, 'yyyy年MM月', { locale: zhCN });
};

export const getWeekDayName = (date: Date): string => {
  return format(date, 'E', { locale: zhCN });
};

export const getNextMonth = (date: Date): Date => {
  return addMonths(date, 1);
};

export const getPrevMonth = (date: Date): Date => {
  return addMonths(date, -1);
};

export const calculateDuration = (start: Date | string, end: Date | string): string => {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  const diffMs = e.getTime() - s.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    return `${days}天${hours > 0 ? hours + '小时' : ''}`;
  }
  return `${diffHours}小时${diffMinutes}分钟`;
};

export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  
  if (diffSeconds < 60) return diffMs > 0 ? '刚刚' : '即将';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分钟${diffMs > 0 ? '前' : '后'}`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}小时${diffMs > 0 ? '前' : '后'}`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}天${diffMs > 0 ? '前' : '后'}`;
  
  return formatDate(d, 'MM-dd');
};
