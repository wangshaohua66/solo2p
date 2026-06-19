export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  return ts + days * DAY_MS;
}

export function diffDays(a: number, b: number): number {
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);
}

export function formatDate(ts: number, fmt: 'short' | 'long' | 'month' | 'day' = 'short'): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  switch (fmt) {
    case 'long':
      return `${y}-${m}-${day}`;
    case 'month':
      return `${y}年${months[d.getMonth()]}`;
    case 'day':
      return `${day}`;
    default:
      return `${m}-${day}`;
  }
}

export function formatDateKey(ts: number): string {
  return formatDate(ts, 'long');
}

export function parseDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function isToday(ts: number): boolean {
  return formatDateKey(ts) === formatDateKey(Date.now());
}

export function today(): number {
  return startOfDay(Date.now());
}

export function getWeekNumber(ts: number): number {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / DAY_MS);
  return Math.ceil((days + start.getDay() + 1) / 7);
}

export function getQuarter(ts: number): number {
  return Math.floor(new Date(ts).getMonth() / 3) + 1;
}

export function eachDay(start: number, end: number): number[] {
  const result: number[] = [];
  let cur = startOfDay(start);
  const stop = startOfDay(end);
  while (cur <= stop) {
    result.push(cur);
    cur = addDays(cur, 1);
  }
  return result;
}

export function snapToDay(ts: number): number {
  return startOfDay(ts);
}
