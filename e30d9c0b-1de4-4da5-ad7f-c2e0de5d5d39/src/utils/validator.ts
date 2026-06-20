import type { HeritageProject, ValidationResult, StepNode, StepEdge, MediaItem } from '@/types'

export const required = (value: string | undefined | null, fieldName: string): string | undefined => {
  if (value === undefined || value === null || value.trim() === '') {
    return `${fieldName}不能为空`
  }
  return undefined
}

export const minLength = (value: string, min: number, fieldName: string): string | undefined => {
  if (value && value.length < min) {
    return `${fieldName}至少需要${min}个字符`
  }
  return undefined
}

export const maxLength = (value: string, max: number, fieldName: string): string | undefined => {
  if (value && value.length > max) {
    return `${fieldName}不能超过${max}个字符`
  }
  return undefined
}

export const numberRange = (value: number | undefined, min: number, max: number, fieldName: string): string | undefined => {
  if (value !== undefined && (value < min || value > max)) {
    return `${fieldName}必须在${min}到${max}之间`
  }
  return undefined
}

export const validateProject = (project: Partial<HeritageProject>): ValidationResult => {
  const errors: string[] = []

  const nameError = required(project.name, '项目名称')
  if (nameError) errors.push(nameError)
  if (project.name) {
    const lenError = maxLength(project.name, 100, '项目名称')
    if (lenError) errors.push(lenError)
  }

  if (!project.category) {
    errors.push('请选择项目类别')
  }

  if (!project.batch) {
    errors.push('请选择批次')
  }

  const regionError = required(project.region, '申报地区')
  if (regionError) errors.push(regionError)

  const descError = required(project.description, '项目描述')
  if (descError) errors.push(descError)
  if (project.description) {
    const lenError = minLength(project.description, 10, '项目描述')
    if (lenError) errors.push(lenError)
  }

  const unitError = required(project.protectionUnit, '保护单位')
  if (unitError) errors.push(unitError)

  if (!project.inheritors || project.inheritors.length === 0) {
    errors.push('至少添加一位传承人')
  } else {
    project.inheritors.forEach((inheritor, index) => {
      const nameError = required(inheritor.name, `传承人${index + 1}姓名`)
      if (nameError) errors.push(nameError)
      if (inheritor.age) {
        const ageError = numberRange(inheritor.age, 1, 150, `传承人${index + 1}年龄`)
        if (ageError) errors.push(ageError)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}

export const validateStepNode = (node: Partial<StepNode>): ValidationResult => {
  const errors: string[] = []

  const nameError = required(node.name, '步骤名称')
  if (nameError) errors.push(nameError)
  if (node.name) {
    const lenError = maxLength(node.name, 50, '步骤名称')
    if (lenError) errors.push(lenError)
  }

  if (node.description) {
    const lenError = maxLength(node.description, 500, '步骤描述')
    if (lenError) errors.push(lenError)
  }

  if (node.duration !== undefined) {
    const durError = numberRange(node.duration, 0, 86400, '步骤时长')
    if (durError) errors.push(durError)
  }

  return { valid: errors.length === 0, errors }
}

export const validateImportData = (data: unknown): ValidationResult => {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['数据格式错误，必须为JSON对象'] }
  }

  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.projects)) {
    errors.push('缺少projects数组')
    return { valid: false, errors }
  }

  const projects = obj.projects as HeritageProject[]

  projects.forEach((project, index) => {
    const prefix = `项目${index + 1}`
    if (!project.id) errors.push(`${prefix}缺少id字段`)
    if (!project.name) errors.push(`${prefix}缺少name字段`)
    if (!project.category) errors.push(`${prefix}缺少category字段`)
    if (!project.batch) errors.push(`${prefix}缺少batch字段`)
    if (!project.region) errors.push(`${prefix}缺少region字段`)
    if (!project.description) errors.push(`${prefix}缺少description字段`)
    if (!Array.isArray(project.inheritors)) errors.push(`${prefix}缺少inheritors数组`)
    if (!project.protectionUnit) errors.push(`${prefix}缺少protectionUnit字段`)
    if (!project.stepFlow || !Array.isArray(project.stepFlow.nodes) || !Array.isArray(project.stepFlow.edges)) {
      errors.push(`${prefix}stepFlow格式错误`)
    }
    if (!Array.isArray(project.mediaLib)) errors.push(`${prefix}缺少mediaLib数组`)
    if (!Array.isArray(project.relations)) errors.push(`${prefix}缺少relations数组`)
  })

  return { valid: errors.length === 0, errors }
}

export const validateMediaFile = (file: File): ValidationResult => {
  const errors: string[] = []
  const maxSize = 50 * 1024 * 1024

  if (!file) {
    return { valid: false, errors: ['请选择文件'] }
  }

  if (file.size > maxSize) {
    errors.push(`文件大小不能超过50MB，当前文件大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg']
  const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

  if (!allAllowedTypes.includes(file.type)) {
    errors.push(`不支持的文件格式: ${file.type}，支持的格式: JPEG, PNG, GIF, WebP, MP4, WebM, OGG`)
  }

  return { valid: errors.length === 0, errors }
}
