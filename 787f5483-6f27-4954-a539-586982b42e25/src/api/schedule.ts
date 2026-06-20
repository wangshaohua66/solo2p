import { get, post, put, del } from '@/utils/request'
import type { ScheduleItem, Channel, PageResult } from '@/types'

export const channels: Channel[] = [
  { id: 'news', name: '新闻综合频道', description: '新闻资讯、时事热点' },
  { id: 'city', name: '都市生活频道', description: '生活服务、娱乐综艺' },
  { id: 'public', name: '公共频道', description: '公共服务、专题纪录片' }
]

export function getSchedule(params: {
  channelId: string
  date: string
}) {
  return get<ScheduleItem[]>(`/schedule`, { params })
}

export function getScheduleList(params: {
  page: number
  pageSize: number
  channelId?: string
  startDate?: string
  endDate?: string
}) {
  return get<PageResult<ScheduleItem>>('/schedule/list', { params })
}

export function createScheduleItem(data: Partial<ScheduleItem>) {
  return post<ScheduleItem>('/schedule', data)
}

export function updateScheduleItem(id: number, data: Partial<ScheduleItem>) {
  return put<ScheduleItem>(`/schedule/${id}`, data)
}

export function deleteScheduleItem(id: number) {
  return del(`/schedule/${id}`)
}

export function reorderSchedule(channelId: string, date: string, items: { id: number; order: number }[]) {
  return put('/schedule/reorder', { channelId, date, items })
}

export function exportSchedule(params: {
  channelId: string
  startDate: string
  endDate: string
  format: 'excel' | 'xml'
}) {
  return get('/schedule/export', {
    params,
    responseType: 'blob'
  })
}

export function importSchedule(file: File, channelId: string, date: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('channelId', channelId)
  formData.append('date', date)
  return post('/schedule/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function syncWithBroadcastSystem(scheduleIds: number[]) {
  return post('/schedule/sync-broadcast', { scheduleIds })
}
