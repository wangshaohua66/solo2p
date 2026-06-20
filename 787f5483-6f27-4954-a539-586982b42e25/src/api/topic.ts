import { get, post, put, del, upload } from '@/utils/request'
import type { Topic, TopicStatus, PageResult, TopicLog, Task } from '@/types'

export function getTopicList(params: {
  page: number
  pageSize: number
  status?: TopicStatus
  programType?: string
  channel?: string
  keyword?: string
}) {
  return get<PageResult<Topic>>('/topics', { params })
}

export function getTopicDetail(id: number) {
  return get<Topic>(`/topics/${id}`)
}

export function createTopic(data: Partial<Topic>) {
  return post<Topic>('/topics', data)
}

export function updateTopic(id: number, data: Partial<Topic>) {
  return put<Topic>(`/topics/${id}`, data)
}

export function deleteTopic(id: number) {
  return del(`/topics/${id}`)
}

export function submitTopic(id: number) {
  return post(`/topics/${id}/submit`)
}

export function reviewTopic(id: number, data: { status: 'approved' | 'rejected'; remark: string }) {
  return post(`/topics/${id}/review`, data)
}

export function getTopicLogs(id: number) {
  return get<TopicLog[]>(`/topics/${id}/logs`)
}

export function getTopicTasks(id: number) {
  return get<Task[]>(`/topics/${id}/tasks`)
}

export function updateTaskStatus(taskId: number, status: Task['status']) {
  return put(`/tasks/${taskId}/status`, { status })
}

export function assignTask(taskId: number, assigneeId: number) {
  return put(`/tasks/${taskId}/assign`, { assigneeId })
}
