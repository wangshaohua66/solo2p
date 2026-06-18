import crypto from 'crypto';
import dayjs from 'dayjs';

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function md5(str: string): string {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function sha256(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

export function formatDate(date: Date | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format);
}

export function now(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function nowIso(): string {
  return dayjs().toISOString();
}

export function parseDate(dateStr: string): Date | null {
  const d = dayjs(dateStr);
  return d.isValid() ? d.toDate() : null;
}

export function exponentialBackoff(attempt: number, baseDelay = 1000): number {
  return baseDelay * Math.pow(2, attempt);
}

export function truncate(str: string, maxLen: number, suffix = '...'): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - suffix.length) + suffix;
}

export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u00A0\u2000-\u200B\u2028\u2029\uFEFF]/g, ' ')
    .trim();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDates(text: string): string[] {
  const patterns = [
    /\d{4}年\d{1,2}月\d{1,2}日/g,
    /\d{4}-\d{2}-\d{2}/g,
    /\d{4}\/\d{2}\/\d{2}/g,
    /\d{4}\.\d{2}\.\d{2}/g
  ];

  const dates: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  }
  return [...new Set(dates)];
}

export function extractDocNumber(text: string): string | null {
  const patterns = [
    /[〔\[【](\d{4})[〕\]】]\s*\w+发\s*\d+号/,
    /\w+发〔\d{4}〕\d+号/,
    /\w+规〔\d{4}〕\d+号/,
    /\w+政发〔\d{4}〕\d+号/,
    /人社部发〔\d{4}〕\d+号/,
    /医保发〔\d{4}〕\d+号/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
