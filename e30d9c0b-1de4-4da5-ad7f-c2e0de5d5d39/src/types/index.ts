export type HeritageCategory = 'traditional_skill' | 'traditional_music' | 'traditional_dance' | 'traditional_drama' | 'folk_custom'

export type RelationType = 'material_supply' | 'skill_derived' | 'cultural_homology' | 'regional_relation'

export type EdgeType = 'sequential' | 'parallel' | 'branch' | 'loop'

export interface Inheritor {
  id: string
  name: string
  gender: 'male' | 'female'
  age: number
  title: string
  avatar?: string
}

export interface MediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  name: string
  size: number
  thumbnail?: string
  videoStart?: number
  videoEnd?: number
  annotations?: MediaAnnotation[]
  uploadedAt: number
}

export interface MediaAnnotation {
  id: string
  x: number
  y: number
  text: string
  arrowDirection: 'top' | 'bottom' | 'left' | 'right'
}

export interface StepNode {
  id: string
  name: string
  description: string
  duration: number
  keyTechniques: string[]
  mediaIds: string[]
  position: { x: number; y: number }
  type: 'normal' | 'branch' | 'loop' | 'start' | 'end'
  notes?: string
}

export interface StepEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  label?: string
  condition?: string
}

export interface StepFlow {
  nodes: StepNode[]
  edges: StepEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export interface ProjectRelation {
  id: string
  sourceId: string
  targetId: string
  type: RelationType
  strength: number
  description: string
}

export interface HeritageProject {
  id: string
  name: string
  category: HeritageCategory
  batch: number
  region: string
  description: string
  inheritors: Inheritor[]
  protectionUnit: string
  stepFlow: StepFlow
  mediaLib: MediaItem[]
  relations: ProjectRelation[]
  createdAt: number
  updatedAt: number
}

export interface ProjectFilters {
  category?: HeritageCategory | ''
  batch?: number | ''
  region?: string
  keyword?: string
  inheritorName?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export const HERITAGE_CATEGORY_LABELS: Record<HeritageCategory, string> = {
  traditional_skill: '传统技艺',
  traditional_music: '传统音乐',
  traditional_dance: '传统舞蹈',
  traditional_drama: '传统戏剧',
  folk_custom: '民俗'
}

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  material_supply: '原料供给',
  skill_derived: '技艺衍生',
  cultural_homology: '文化同源',
  regional_relation: '地域关联'
}

export const RELATION_TYPE_COLORS: Record<RelationType, string> = {
  material_supply: '#67C23A',
  skill_derived: '#409EFF',
  cultural_homology: '#E6A23C',
  regional_relation: '#F56C6C'
}

export const HERITAGE_BATCHES = [1, 2, 3, 4, 5]

export const CATEGORY_BATCH_MAP: Record<HeritageCategory, number[]> = {
  traditional_skill: [1, 2, 3, 4, 5],
  traditional_music: [1, 2, 3, 4],
  traditional_dance: [1, 2, 3],
  traditional_drama: [1, 2, 3, 4],
  folk_custom: [1, 2, 3, 4, 5]
}

export const BATCH_CATEGORY_MAP: Record<number, HeritageCategory[]> = {
  1: ['traditional_skill', 'traditional_music', 'traditional_dance', 'traditional_drama', 'folk_custom'],
  2: ['traditional_skill', 'traditional_music', 'traditional_dance', 'traditional_drama', 'folk_custom'],
  3: ['traditional_skill', 'traditional_music', 'traditional_dance', 'traditional_drama', 'folk_custom'],
  4: ['traditional_skill', 'traditional_music', 'traditional_drama', 'folk_custom'],
  5: ['traditional_skill', 'folk_custom']
}

export const REGIONS = ['北京', '上海', '广东', '江苏', '浙江', '四川', '陕西', '山东', '河南', '湖南', '湖北', '安徽', '福建', '江西', '山西', '河北', '辽宁', '吉林', '黑龙江', '云南', '贵州', '广西', '西藏', '内蒙古', '新疆', '甘肃', '青海', '宁夏', '海南', '天津', '重庆']
