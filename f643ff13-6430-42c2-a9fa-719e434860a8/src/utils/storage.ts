import localforage from 'localforage'

localforage.config({
  name: 'CourtTrialSystem',
  version: 1.0,
  storeName: 'courtTrialDB',
  description: '智慧法庭庭审系统本地存储'
})

export const storage = localforage

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

export const formatFullTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${formatTime(timestamp)}`
}

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    judge: '#e74c3c',
    clerk: '#3498db',
    prosecutor: '#f39c12',
    defender: '#2ecc71'
  }
  return colors[role] || '#95a5a6'
}

export const getRoleName = (role: string): string => {
  const names: Record<string, string> = {
    judge: '审判长',
    clerk: '书记员',
    prosecutor: '公诉人',
    defender: '辩护人'
  }
  return names[role] || role
}

export const getAnnotationColor = (type: string): string => {
  const colors: Record<string, string> = {
    dispute: '#e74c3c',
    proof: '#f39c12',
    defense: '#2ecc71',
    note: '#9b59b6'
  }
  return colors[type] || '#95a5a6'
}

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const fileToBlobUrl = (file: File): string => {
  return URL.createObjectURL(file)
}

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || ''
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
