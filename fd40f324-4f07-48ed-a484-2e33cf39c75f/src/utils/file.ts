import type { Snippet, ValidationResult } from '@/types'

const STORAGE_PREFIX = 'codestage_'
const SNIPPET_KEY = STORAGE_PREFIX + 'snippets'
const CATEGORY_KEY = STORAGE_PREFIX + 'categories'
const THEME_KEY = STORAGE_PREFIX + 'theme'
const FILES_KEY = STORAGE_PREFIX + 'files'
const ANNOTATION_PRESETS_KEY = STORAGE_PREFIX + 'annotation_presets'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMPORT_EXT = '.json'
const TAG_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5-]{1,20}$/

export function getLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch (e) {
    console.warn(`Failed to read storage: ${key}`, e)
    return defaultValue
  }
}

export function setLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Failed to write storage: ${key}`, e)
  }
}

export function removeLocalStorage(key: string): void {
  localStorage.removeItem(key)
}

export const storage = {
  get snippets() { return getLocalStorage(SNIPPET_KEY, '[]') },
  set snippets(v) { setLocalStorage(SNIPPET_KEY, v) },
  get categories() { return getLocalStorage(CATEGORY_KEY, '[]') },
  set categories(v) { setLocalStorage(CATEGORY_KEY, v) },
  get theme() { return getLocalStorage(THEME_KEY, 'dark') },
  set theme(v) { setLocalStorage(THEME_KEY, v) },
  get files() { return getLocalStorage(FILES_KEY, '[]') },
  set files(v) { setLocalStorage(FILES_KEY, v) },
  get annotationPresets() { return getLocalStorage(ANNOTATION_PRESETS_KEY, '[]') },
  set annotationPresets(v) { setLocalStorage(ANNOTATION_PRESETS_KEY, v) }
}

export function validateSnippet(snippet: Partial<Snippet>, existingNames: string[] = [] ): ValidationResult {
  const errors: string[] = []
  if (!snippet.name || !snippet.name.trim()) {
    errors.push('代码片段名称不能为空')
  } else if (snippet.name.length > 100) {
    errors.push('代码片段名称不能超过100个字符')
  } else if (existingNames.includes(snippet.name.trim())) {
    errors.push('代码片段名称已存在')
  }
  if (snippet.tags && snippet.tags.length > 0) {
    const invalidTags = snippet.tags.filter(t => !TAG_REGEX.test(t))
    if (invalidTags.length > 0) {
      errors.push(`标签格式无效: ${invalidTags.join(', ')}（仅支持字母、数字、中文、下划线、短横线，1-20字符）`)
    }
    const dupTags = snippet.tags.filter((t, i) => snippet.tags!.indexOf(t) !== i)
    if (dupTags.length > 0) {
      errors.push(`存在重复标签: ${dupTags.join(', ')}`)
    }
  }
  if (!snippet.code || !snippet.code.trim()) {
    errors.push('代码内容不能为空')
  }
  if (!snippet.language) {
    errors.push('请选择编程语言')
  }
  if (snippet.description && snippet.description.length > 500) {
    errors.push('描述不能超过500个字符')
  }
  return {
    valid: errors.length === 0,
    errors
  }
}

export function validateImportFile(file: File): ValidationResult {
  const errors: string[] = []
  if (!file.name.toLowerCase().endsWith(ALLOWED_IMPORT_EXT)) {
    errors.push(`仅支持导入 ${ALLOWED_IMPORT_EXT} 格式文件`)
  }
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
  if (file.size === 0) {
    errors.push('文件不能为空')
  }
  return {
    valid: errors.length === 0,
    errors
  }
}

export function validateTags(tags: string[]): ValidationResult {
  const errors: string[] = []
  const invalidTags = tags.filter(t => !TAG_REGEX.test(t))
  if (invalidTags.length > 0) {
    errors.push(`标签格式无效: ${invalidTags.join(', ')}`)
  }
  return {
    valid: errors.length === 0,
    errors
  }
}
