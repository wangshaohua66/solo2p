import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatDate(date: string | Date | undefined | null, format = 'YYYY-MM-DD'): string {
  if (!date) return ''
  return dayjs(date).format(format)
}

export function formatDateTime(date: string | Date | undefined | null, format = 'YYYY-MM-DD HH:mm'): string {
  if (!date) return ''
  return dayjs(date).format(format)
}

export function formatTime(date: string | Date | undefined | null, format = 'HH:mm'): string {
  if (!date) return ''
  return dayjs(date).format(format)
}

export function fromNow(date: string | Date | undefined | null): string {
  if (!date) return ''
  return dayjs(date).fromNow()
}

export function formatCurrency(value: number | undefined | null, symbol = '¥'): string {
  if (value === undefined || value === null) return ''
  return `${symbol}${Number(value).toFixed(2)}`
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return ''
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercent(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null) return ''
  return `${Number(value).toFixed(decimals)}%`
}

export function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export function truncate(text: string | undefined | null, length = 50, suffix = '...'): string {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + suffix : text
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit = 300) {
  let inThrottle = false
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function uuid(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
}

export function getGenderLabel(gender?: string): string {
  const map: Record<string, string> = { male: '♂公', female: '♀母', unknown: '未知' }
  return map[gender || ''] || '未知'
}

export function getWeekdayLabel(date: string | Date): string {
  const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return map[dayjs(date).day()]
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
