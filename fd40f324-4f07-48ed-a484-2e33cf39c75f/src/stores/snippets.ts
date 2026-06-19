import { defineStore } from 'pinia'
import { createId, deepClone } from '@/utils'
import type { Snippet, Category, LanguageId } from '@/types'
import { STORAGE_KEYS, getLocalStorage, setLocalStorage, validateSnippet, validateImportFile, readFileAsText, parseJsonSafe, downloadFile, stringifyPretty } from '@/utils/storage'

interface SnippetState {
  snippets: Snippet[]
  categories: Category[]
  searchQuery: string
  selectedTags: string[]
  selectedCategoryId: string | null
  favoriteOnly: boolean
  activePanelTab: 'snippets' | 'presets'
}

function createDefaultCategories(): Category[] {
  return [
    { id: createId('cat'), name: '默认分类', parentId: null, order: 0, expanded: true },
    { id: createId('cat'), name: '前端示例', parentId: null, order: 1, expanded: true },
    { id: createId('cat'), name: '算法模板', parentId: null, order: 2, expanded: false }
  ]
}

function createDefaultSnippets(categories: Category[]): Snippet[] {
  const defaultCat = categories[0]?.id || ''
  return [
    {
      id: createId('snip'),
      name: '斐波那契数列',
      code: 'function fibonacci(n) {\n  if (n <= 1) return n\n  return fibonacci(n - 1) + fibonacci(n - 2)\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(`fib(${i}) = ${fibonacci(i)}`)\n}',
      language: 'javascript',
      tags: ['算法', '递归'],
      categoryId: defaultCat,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: '经典递归实现斐波那契数列计算',
      favorite: true
    },
    {
      id: createId('snip'),
      name: '防抖与节流',
      code: 'function debounce(fn, delay) {\n  let timer = null\n  return function(...args) {\n    if (timer) clearTimeout(timer)\n    timer = setTimeout(() => fn.apply(this, args), delay)\n  }\n}\n\nfunction throttle(fn, limit) {\n  let inThrottle = false\n  return function(...args) {\n    if (!inThrottle) {\n      fn.apply(this, args)\n      inThrottle = true\n      setTimeout(() => inThrottle = false, limit)\n    }\n  }\n}',
      language: 'javascript',
      tags: ['性能优化', '工具函数'],
      categoryId: defaultCat,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
      description: '防抖和节流的标准实现',
      favorite: true
    }
  ]
}

function loadPersistedSnippets(categories: Category[]): Snippet[] {
  const persisted = getLocalStorage<Snippet[]>(STORAGE_KEYS.SNIPPETS, [])
  if (persisted.length > 0) return persisted
  return createDefaultSnippets(categories)
}

function loadPersistedCategories(): Category[] {
  const persisted = getLocalStorage<Category[]>(STORAGE_KEYS.CATEGORIES, [])
  if (persisted.length > 0) return persisted
  return createDefaultCategories()
}

export const useSnippetStore = defineStore('snippets', {
  state: (): SnippetState => {
    const categories = loadPersistedCategories()
    return {
      snippets: loadPersistedSnippets(categories),
      categories,
      searchQuery: '',
      selectedTags: [],
      selectedCategoryId: categories[0]?.id || null,
      favoriteOnly: false,
      activePanelTab: 'snippets'
    }
  },

  getters: {
    allTags: (state): string[] => {
      const tagSet = new Set<string>()
      state.snippets.forEach(s => s.tags.forEach(t => tagSet.add(t)))
      return Array.from(tagSet).sort()
    },

    filteredSnippets: (state): Snippet[] => {
      let result = [...state.snippets]
      if (state.selectedCategoryId) {
        result = result.filter(s => s.categoryId === state.selectedCategoryId)
      }
      if (state.favoriteOnly) {
        result = result.filter(s => s.favorite)
      }
      if (state.selectedTags.length > 0) {
        result = result.filter(s =>
          state.selectedTags.every(tag => s.tags.includes(tag))
        )
      }
      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase()
        result = result.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q))
        )
      }
      return result.sort((a, b) => b.updatedAt - a.updatedAt)
    },

    snippetsCount: (state) => state.snippets.length,
    categoriesById: (state) => {
      const map: Record<string, Category> = {}
      state.categories.forEach(c => { map[c.id] = c })
      return map
    },
    categoryNames: (state) => state.categories.map(c => c.name)
  },

  actions: {
    persist() {
      setLocalStorage(STORAGE_KEYS.SNIPPETS, this.snippets)
      setLocalStorage(STORAGE_KEYS.CATEGORIES, this.categories)
    },

    addSnippet(snippetData: Partial<Snippet>): { success: boolean; errors?: string[]; id?: string } {
      const existingNames = this.snippets
        .filter(s => s.id !== snippetData.id)
        .map(s => s.name.trim())
      const validation = validateSnippet(snippetData, existingNames)
      if (!validation.valid) {
        return { success: false, errors: validation.errors }
      }
      const snippet: Snippet = {
        id: createId('snip'),
        name: snippetData.name!.trim(),
        code: snippetData.code!,
        language: (snippetData.language || 'javascript') as LanguageId,
        tags: snippetData.tags || [],
        categoryId: snippetData.categoryId || (this.categories[0]?.id || ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        description: snippetData.description || '',
        favorite: snippetData.favorite || false
      }
      this.snippets.push(snippet)
      this.persist()
      return { success: true, id: snippet.id }
    },

    updateSnippet(id: string, updates: Partial<Snippet>): { success: boolean; errors?: string[] } {
      const idx = this.snippets.findIndex(s => s.id === id)
      if (idx === -1) return { success: false, errors: ['代码片段不存在'] }
      const merged = { ...this.snippets[idx], ...updates }
      const existingNames = this.snippets
        .filter(s => s.id !== id)
        .map(s => s.name.trim())
      const validation = validateSnippet(merged, existingNames)
      if (!validation.valid) {
        return { success: false, errors: validation.errors }
      }
      this.snippets[idx] = { ...merged, updatedAt: Date.now() }
      this.persist()
      return { success: true }
    },

    deleteSnippet(id: string) {
      const idx = this.snippets.findIndex(s => s.id === id)
      if (idx >= 0) {
        this.snippets.splice(idx, 1)
        this.persist()
      }
    },

    duplicateSnippet(id: string): string | null {
      const snippet = this.snippets.find(s => s.id === id)
      if (!snippet) return null
      const copy = deepClone(snippet)
      copy.id = createId('snip')
      copy.name = `${snippet.name} (副本)`
      copy.createdAt = Date.now()
      copy.updatedAt = Date.now()
      this.snippets.push(copy)
      this.persist()
      return copy.id
    },

    toggleFavorite(id: string) {
      const snippet = this.snippets.find(s => s.id === id)
      if (snippet) {
        snippet.favorite = !snippet.favorite
        snippet.updatedAt = Date.now()
        this.persist()
      }
    },

    addCategory(name: string, parentId: string | null = null): string {
      const category: Category = {
        id: createId('cat'),
        name: name.trim() || '新建分类',
        parentId,
        order: this.categories.filter(c => c.parentId === parentId).length,
        expanded: true
      }
      this.categories.push(category)
      this.persist()
      return category.id
    },

    renameCategory(id: string, name: string) {
      const cat = this.categories.find(c => c.id === id)
      if (cat) {
        cat.name = name.trim() || '未命名分类'
        this.persist()
      }
    },

    deleteCategory(id: string) {
      const toDelete = new Set<string>([id])
      const addChildren = (pid: string) => {
        this.categories.filter(c => c.parentId === pid).forEach(c => {
          toDelete.add(c.id)
          addChildren(c.id)
        })
      }
      addChildren(id)
      this.categories = this.categories.filter(c => !toDelete.has(c.id))
      this.snippets = this.snippets.map(s =>
        toDelete.has(s.categoryId)
          ? { ...s, categoryId: this.categories[0]?.id || '' }
          : s
      )
      if (toDelete.has(this.selectedCategoryId || '')) {
        this.selectedCategoryId = this.categories[0]?.id || null
      }
      this.persist()
    },

    toggleCategoryExpand(id: string) {
      const cat = this.categories.find(c => c.id === id)
      if (cat) cat.expanded = !cat.expanded
    },

    setSearchQuery(query: string) {
      this.searchQuery = query
    },

    toggleTag(tag: string) {
      const idx = this.selectedTags.indexOf(tag)
      if (idx >= 0) {
        this.selectedTags.splice(idx, 1)
      } else {
        this.selectedTags.push(tag)
      }
    },

    clearFilters() {
      this.searchQuery = ''
      this.selectedTags = []
      this.favoriteOnly = false
    },

    setActivePanelTab(tab: 'snippets' | 'presets') {
      this.activePanelTab = tab
    },

    async exportSnippets(ids?: string[]): Promise<void> {
      const data = ids
        ? this.snippets.filter(s => ids.includes(s.id))
        : this.snippets
      const exportData = {
        version: 1,
        exportedAt: Date.now(),
        categories: this.categories,
        snippets: data
      }
      downloadFile(stringifyPretty(exportData), `codestage-snippets-${Date.now()}.json`)
    },

    async importSnippets(file: File): Promise<{ success: boolean; errors?: string[]; imported?: number }> {
      const fileValidation = validateImportFile(file)
      if (!fileValidation.valid) {
        return { success: false, errors: fileValidation.errors }
      }
      try {
        const text = await readFileAsText(file)
        const data = parseJsonSafe<{ snippets?: Snippet[]; categories?: Category[] }>(text, undefined as any)
        if (!data || !Array.isArray(data.snippets)) {
          return { success: false, errors: ['文件格式无效，缺少 snippets 数据'] }
        }
        if (data.categories && Array.isArray(data.categories)) {
          const existingCatNames = new Set(this.categories.map(c => c.name))
          data.categories.forEach(cat => {
            if (!existingCatNames.has(cat.name)) {
              this.categories.push({ ...cat, id: createId('cat') })
            }
          })
        }
        let imported = 0
        const existingNames = new Set(this.snippets.map(s => s.name.trim()))
        data.snippets.forEach(s => {
          if (!s.name || !s.code) return
          let name = s.name.trim()
          if (existingNames.has(name)) {
            name = `${name} (导入)`
          }
          existingNames.add(name)
          this.snippets.push({
            id: createId('snip'),
            name,
            code: s.code,
            language: s.language || 'javascript',
            tags: s.tags || [],
            categoryId: this.categories[0]?.id || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            description: s.description || '',
            favorite: false
          })
          imported++
        })
        this.persist()
        return { success: true, imported }
      } catch (e: any) {
        return { success: false, errors: [`导入失败: ${e.message || '未知错误'}`] }
      }
    }
  }
})
