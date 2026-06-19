<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSnippetStore } from '@/stores/snippets'
import { Search, Code2, Star, StarOff } from 'lucide-vue-next'
import { ANNOTATION_COLORS, type Snippet } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  insert: [snippet: Snippet]
}>()

const snippetStore = useSnippetStore()
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)

const filtered = computed<Snippet[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let result = [...snippetStore.snippets].sort((a, b) => Number(b.favorite) - Number(a.favorite))
  if (q) {
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return result.slice(0, 20)
})

watch(() => props.visible, (v) => {
  if (v) {
    searchQuery.value = ''
    selectedIndex.value = 0
    nextTick(() => searchInputRef.value?.focus())
  }
})

watch(filtered, () => {
  selectedIndex.value = 0
})

function selectSnippet(s: Snippet) {
  emit('insert', s)
  emit('update:visible', false)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const s = filtered.value[selectedIndex.value]
    if (s) selectSnippet(s)
  } else if (e.key === 'Escape') {
    emit('update:visible', false)
  }
}

const tagColors = ANNOTATION_COLORS
function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = ((hash << 5) - hash) + tag.charCodeAt(i)
  return tagColors[Math.abs(hash) % tagColors.length]
}
</script>

<template>
  <BaseDialog
    :model-value="visible"
    title="插入代码片段"
    width="520px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="space-y-3">
      <div class="relative">
        <Search class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style="color: var(--text-secondary);" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="input-field text-sm pl-8"
          placeholder="搜索片段名称、标签、内容..."
          @keydown="onKeydown"
        />
      </div>

      <div class="max-h-[320px] overflow-y-auto scrollbar-thin space-y-1">
        <button
          v-for="(s, i) in filtered"
          :key="s.id"
          class="w-full text-left p-2 rounded-md transition-colors group"
          :class="i === selectedIndex ? '' : 'hover:bg-slate-700/30'"
          :style="i === selectedIndex ? { background: 'var(--bg-tertiary)', border: '1px solid var(--accent-color)' } : { border: '1px solid transparent' }"
          @click="selectSnippet(s)"
          @mouseenter="selectedIndex = i"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5">
                <Code2 class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span class="text-sm font-medium truncate" style="color: var(--text-primary);">{{ s.name }}</span>
                <Star v-if="s.favorite" class="w-3 h-3 text-warning fill-warning flex-shrink-0" />
                <StarOff v-else-if="false" class="w-3 h-3" />
              </div>
              <div v-if="s.description" class="text-[11px] truncate mb-1" style="color: var(--text-secondary);">
                {{ s.description }}
              </div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="t in s.tags.slice(0, 3)"
                  :key="t"
                  class="text-[9px] px-1 py-0.5 rounded"
                  :style="{ background: tagColor(t) + '20', color: tagColor(t) }"
                >{{ t }}</span>
                <span
                  class="text-[9px] px-1 py-0.5 rounded uppercase font-medium"
                  style="background: var(--bg-tertiary); color: var(--text-secondary);"
                >{{ s.language }}</span>
              </div>
            </div>
          </div>
        </button>

        <div
          v-if="filtered.length === 0"
          class="text-center py-8 text-sm"
          style="color: var(--text-secondary);"
        >
          <Code2 class="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>未找到匹配的代码片段</p>
        </div>
      </div>

      <div class="text-[10px] flex items-center gap-3 pt-1" style="color: var(--text-secondary);">
        <span>↑↓ 选择</span>
        <span>Enter 插入</span>
        <span>Esc 取消</span>
        <span class="ml-auto">{{ filtered.length }} 个结果</span>
      </div>
    </div>
  </BaseDialog>
</template>
