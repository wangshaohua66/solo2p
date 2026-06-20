<template>
  <div class="search-bar">
    <div class="search-input-wrapper">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索笔录、标注、证据..."
        @input="handleSearch"
        @keyup.enter="handleSearch"
      />
      <button
        v-if="searchQuery"
        class="clear-btn"
        @click="clearSearch"
        title="清除搜索"
      >
        ✕
      </button>
    </div>

    <div class="search-filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        class="filter-btn"
        :class="{ active: activeFilters.includes(filter.value) }"
        @click="toggleFilter(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <transition name="slide">
      <div v-if="searchResults.length > 0" class="search-results">
        <div class="results-header">
          <span>找到 {{ searchResults.length }} 条结果</span>
          <button class="close-btn" @click="clearSearch">关闭</button>
        </div>
        <div class="results-list">
          <div
            v-for="(result, index) in searchResults.slice(0, 50)"
            :key="`${result.transcriptId}-${result.annotationId || ''}-${index}`"
            class="result-item"
            @click="handleResultClick(result)"
          >
            <div class="result-header">
              <span class="result-type" :class="result.annotationId ? 'annotation' : 'transcript'">
                {{ result.annotationId ? '标注' : '笔录' }}
              </span>
              <span v-if="result.role" class="result-role" :style="{ color: getRoleColor(result.role) }">
                {{ getRoleName(result.role) }}
              </span>
              <span class="result-time">{{ formatTime(result.timestamp) }}</span>
            </div>
            <div class="result-content" v-html="highlightText(result.content, result.highlight)"></div>
          </div>
        </div>
        <div v-if="searchResults.length > 50" class="results-more">
          仅显示前50条结果，请缩小搜索范围
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTranscriptStore } from '@/stores/transcriptStore'
import { formatTime, getRoleColor, getRoleName } from '@/utils/storage'
import type { SearchResult } from '@/types'

const emit = defineEmits<{
  (e: 'result', result: SearchResult): void
}>()

const transcriptStore = useTranscriptStore()

const searchQuery = ref('')
const activeFilters = ref<string[]>([])

const filters = [
  { value: 'transcript', label: '笔录' },
  { value: 'annotation', label: '标注' },
  { value: 'judge', label: '审判长' },
  { value: 'clerk', label: '书记员' },
  { value: 'prosecutor', label: '公诉人' },
  { value: 'defender', label: '辩护人' }
]

const searchResults = computed(() => {
  let results = transcriptStore.searchResults

  if (activeFilters.value.length > 0) {
    results = results.filter(r => {
      if (activeFilters.value.includes('transcript') && !r.annotationId) return true
      if (activeFilters.value.includes('annotation') && r.annotationId) return true
      if (r.role && activeFilters.value.includes(r.role)) return true
      return false
    })
  }

  return results
})

const handleSearch = () => {
  transcriptStore.searchTranscripts(searchQuery.value)
}

const clearSearch = () => {
  searchQuery.value = ''
  transcriptStore.searchTranscripts('')
  activeFilters.value = []
}

const toggleFilter = (filter: string) => {
  const index = activeFilters.value.indexOf(filter)
  if (index === -1) {
    activeFilters.value.push(filter)
  } else {
    activeFilters.value.splice(index, 1)
  }
}

const handleResultClick = (result: SearchResult) => {
  emit('result', result)
  if (result.transcriptId) {
    transcriptStore.jumpToTranscript(result.transcriptId)
  }
}

const highlightText = (text: string, highlights: [number, number][]) => {
  if (!highlights || highlights.length === 0) return text

  let result = ''
  let lastIndex = 0

  const sortedHighlights = [...highlights].sort((a, b) => a[0] - b[0])

  for (const [start, end] of sortedHighlights) {
    if (start >= lastIndex) {
      result += text.slice(lastIndex, start)
      result += `<span class="highlight">${text.slice(start, end)}</span>`
      lastIndex = end
    }
  }

  if (lastIndex < text.length) {
    result += text.slice(lastIndex)
  }

  return result
}
</script>

<style lang="scss" scoped>
.search-bar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    font-size: 14px;
    opacity: 0.6;
  }

  .search-input {
    width: 100%;
    padding: 10px 36px 10px 36px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 14px;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
    }
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: var(--hover-bg);
      color: var(--text-primary);
    }
  }
}

.search-filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  z-index: 100;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);

  .close-btn {
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;

    &:hover {
      background: var(--hover-bg);
    }
  }
}

.results-list {
  flex: 1;
  overflow-y: auto;
}

.result-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--hover-bg);
  }
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.result-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;

  &.transcript {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
  }

  &.annotation {
    background: rgba(155, 89, 182, 0.2);
    color: #9b59b6;
  }
}

.result-role {
  font-size: 12px;
  font-weight: 500;
}

.result-time {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
}

.result-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;

  :deep(.highlight) {
    background: rgba(241, 196, 15, 0.3);
    padding: 0 2px;
    border-radius: 2px;
  }
}

.results-more {
  padding: 10px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
