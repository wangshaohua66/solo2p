import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatDate(date: string | Date | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export function formatRelative(date: string | Date): string {
  return dayjs(date).fromNow()
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes < 0) return '0分钟'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}分钟`
  if (mins === 0) return `${hours}小时`
  return `${hours}小时${mins}分钟`
}

export function formatCurrency(amount: number, decimals: number = 2): string {
  return `¥${amount.toFixed(decimals)}`
}

export function formatKwh(kwh: number, decimals: number = 2): string {
  return `${kwh.toFixed(decimals)} kWh`
}

export function generateOrderNo(prefix: string = 'ORD'): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

export function validatePlateNumber(plate: string): boolean {
  const regex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,6}[A-HJ-NP-Z0-9挂学警港澳]$/
  return regex.test(plate)
}

export function validatePhone(phone: string): boolean {
  const regex = /^1[3-9]\d{9}$/
  return regex.test(phone)
}

export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function downloadFile(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(fn: T, delay: number = 300): (...args: Parameters<T>) => void {
  let last = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export default dayjs
