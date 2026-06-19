<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive, WholeWord, Regex } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  matchCount?: number
  currentMatch?: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  search: [query: string, options: { caseSensitive: boolean; wholeWord: boolean; regex: boolean }]
  replace: [query: string, replaceValue: string]
  replaceAll: [query: string, replaceValue: string]
  next: []
  prev: []
}>()

const findValue = ref('')
const replaceValue = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)
const findInputRef = ref<HTMLInputElement | null>(null)
const replaceMode = ref(false)

const hasQuery = computed(() => findValue.value.length > 0)

watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => findInputRef.value?.focus())
  }
})

function doSearch() {
  if (!hasQuery.value) return
  emit('search', findValue.value, {
    caseSensitive: caseSensitive.value,
    wholeWord: wholeWord.value,
    regex: useRegex.value
  })
}

function doNext() {
  emit('next')
}

function doPrev() {
  emit('prev')
}

function doReplace() {
  if (!hasQuery.value) return
  emit('replace', findValue.value, replaceValue.value)
}

function doReplaceAll() {
  if (!hasQuery.value) return
  emit('replaceAll', findValue.value, replaceValue.value)
}

function close() {
  emit('update:visible', false)
}

function toggleReplaceMode() {
  replaceMode.value = !replaceMode.value
}

function onFindKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (e.shiftKey) doPrev()
    else doNext()
  } else if (e.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="find-replace-panel absolute top-2 right-3 z-30 w-[360px] max-w-[90%] card p-2 shadow-lg animate-fade-in-up"
    @click.stop
  >
    <div class="flex items-center gap-1 mb-1.5">
      <button class="btn-icon" :class="{ 'text-brand-400': replaceMode }" title="切换替换模式" @click="toggleReplaceMode">
        <component :is="replaceMode ? Replace : Search" class="w-3.5 h-3.5" />
      </button>
      <span class="text-xs font-medium flex-1" style="color: var(--text-primary);">查找{{ replaceMode ? '与替换' : '' }}</span>
      <span v-if="hasQuery" class="text-[10px] px-1.5 py-0.5 rounded" style="background: var(--bg-tertiary); color: var(--text-secondary);">
        {{ currentMatch || 0 }} / {{ matchCount || 0 }}
      </span>
      <button class="btn-icon" title="关闭" @click="close">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex items-center gap-1 mb-1">
      <input
        ref="findInputRef"
        v-model="findValue"
        class="input-field text-xs flex-1 font-mono"
        placeholder="查找内容..."
        @input="doSearch"
        @keydown="onFindKeydown"
      />
      <button
        class="btn-icon"
        :class="{ 'text-brand-400': caseSensitive }"
        title="区分大小写"
        @click="caseSensitive = !caseSensitive; doSearch()"
      >
        <CaseSensitive class="w-3.5 h-3.5" />
      </button>
      <button
        class="btn-icon"
        :class="{ 'text-brand-400': wholeWord }"
        title="全字匹配"
        @click="wholeWord = !wholeWord; doSearch()"
      >
        <WholeWord class="w-3.5 h-3.5" />
      </button>
      <button
        class="btn-icon"
        :class="{ 'text-brand-400': useRegex }"
        title="正则表达式"
        @click="useRegex = !useRegex; doSearch()"
      >
        <Regex class="w-3.5 h-3.5" />
      </button>
    </div>

    <div v-if="replaceMode" class="flex items-center gap-1 mb-1.5">
      <input
        v-model="replaceValue"
        class="input-field text-xs flex-1 font-mono"
        placeholder="替换为..."
      />
    </div>

    <div class="flex items-center justify-between gap-1">
      <div class="flex items-center gap-1">
        <button class="btn-icon" :disabled="!hasQuery" title="上一处 (Shift+Enter)" @click="doPrev">
          <ChevronUp class="w-3.5 h-3.5" />
        </button>
        <button class="btn-icon" :disabled="!hasQuery" title="下一处 (Enter)" @click="doNext">
          <ChevronDown class="w-3.5 h-3.5" />
        </button>
      </div>
      <div v-if="replaceMode" class="flex items-center gap-1">
        <button
          class="px-2 py-1 text-[11px] rounded hover:bg-slate-700/40 transition-colors"
          style="color: var(--text-primary);"
          :disabled="!hasQuery"
          @click="doReplace"
        >
          替换
        </button>
        <button
          class="px-2 py-1 text-[11px] rounded transition-colors"
          style="background: var(--accent-color); color: white;"
          :disabled="!hasQuery"
          @click="doReplaceAll"
        >
          全部替换
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.find-replace-panel {
  backdrop-filter: blur(12px);
}
</style>
