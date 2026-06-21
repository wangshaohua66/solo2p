import request from '@/utils/request'
import type { HSCode, HSChapter } from '@/types'

export function searchHSCodes(keyword: string, page = 1, pageSize = 20) {
  return request.get<{ list: HSCode[]; total: number }>('/hscodes/search', {
    params: { keyword, page, pageSize }
  })
}

export function getHSCodeDetail(code: string) {
  return request.get<HSCode>(`/hscodes/${code}`)
}

export function getHSChapterTree() {
  return request.get<HSChapter[]>('/hscodes/chapters')
}

export function getHSByChapter(chapterCode: string) {
  return request.get<HSCode[]>(`/hscodes/chapter/${chapterCode}`)
}

export function getHSRecommendations(code: string) {
  return request.get<HSCode[]>(`/hscodes/${code}/recommendations`)
}

export function getSearchHistory() {
  return request.get<string[]>('/hscodes/history')
}

export function getFavorites() {
  return request.get<HSCode[]>('/hscodes/favorites')
}

export function toggleFavorite(code: string, favorite: boolean) {
  return request.post(`/hscodes/favorites/${code}`, { favorite })
}
