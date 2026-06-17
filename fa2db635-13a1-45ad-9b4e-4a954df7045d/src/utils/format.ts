export const yuan = (n: number): string => {
  if (n == null || Number.isNaN(n)) return '¥0'
  return '¥' + Math.round(n).toLocaleString('zh-CN')
}

export const wan = (n: number): string => {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return Math.round(n).toLocaleString('zh-CN')
}

export const pct = (n: number, digits = 1): string => `${(n * 100).toFixed(digits)}%`

export const formatDate = (s: string): string => {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const formatDateTime = (s: string): string => {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(s)} ${hh}:${mm}`
}

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === 'string' ? new Date(from) : from
  const b = typeof to === 'string' ? new Date(to) : to
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

export function countdown(target: string): number {
  return daysBetween(new Date(), target)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function monthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}
