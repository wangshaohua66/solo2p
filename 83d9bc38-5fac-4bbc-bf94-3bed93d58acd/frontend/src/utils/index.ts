import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export const formatDate = (
  date: string | number | Date | undefined | null,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string => {
  if (!date) return ''
  return dayjs(date).format(format)
}

export const formatDateSimple = (date: string | number | Date | undefined | null): string => {
  return formatDate(date, 'YYYY-MM-DD')
}

export const formatDateTime = (date: string | number | Date | undefined | null): string => {
  return formatDate(date, 'YYYY-MM-DD HH:mm')
}

export const relativeTime = (date: string | number | Date | undefined | null): string => {
  if (!date) return ''
  return dayjs(date).fromNow()
}

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const downloadByUrl = (url: string, filename?: string): void => {
  const link = document.createElement('a')
  link.href = url
  if (filename) {
    link.download = filename
  }
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const formatMoney = (
  amount: number | string | undefined | null,
  decimals: number = 2,
  symbol: string = '¥'
): string => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return `${symbol}0.00`
  const num = Number(amount)
  return `${symbol}${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export const formatNumber = (num: number | string | undefined | null, decimals: number = 0): string => {
  if (num === undefined || num === null || isNaN(Number(num))) return '0'
  return Number(num).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let lastTime = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

export interface StatusOption {
  value: string | number
  label: string
  type?: 'success' | 'warning' | 'info' | 'danger' | 'primary'
  color?: string
}

export const getStatusLabel = (value: string | number | undefined, options: StatusOption[]): string => {
  if (value === undefined || value === null) return ''
  const option = options.find((item) => item.value === value)
  return option?.label || String(value)
}

export const getStatusType = (
  value: string | number | undefined,
  options: StatusOption[]
): 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined => {
  if (value === undefined || value === null) return undefined
  const option = options.find((item) => item.value === value)
  return option?.type
}

export const getStatusColor = (value: string | number | undefined, options: StatusOption[]): string | undefined => {
  if (value === undefined || value === null) return undefined
  const option = options.find((item) => item.value === value)
  return option?.color
}

export const mapToOptions = (
  data: Record<string, any>[],
  valueKey: string = 'value',
  labelKey: string = 'label'
): StatusOption[] => {
  return data.map((item) => ({
    value: item[valueKey],
    label: item[labelKey],
    type: item.type,
    color: item.color
  }))
}

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
