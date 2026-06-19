<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useHighlight } from '@/composables/useHighlight'
import { useThemeStore } from '@/stores/theme'
import type { LanguageId } from '@/types'
import { Copy, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  code: string
  language?: LanguageId
  showLineNumbers?: boolean
  maxHeight?: string
  copyable?: boolean
}>(), {
  language: 'javascript',
  showLineNumbers: false,
  maxHeight: '400px',
  copyable: true
})

const { highlight } = useHighlight()
const themeStore = useThemeStore()
const codeRef = ref<HTMLElement | null>(null)
const copied = ref(false)

const highlightedHtml = computed(() => {
  return highlight(props.code, props.language)
})

const lines = computed(() => props.code.split('\n'))

function copyCode() {
  navigator.clipboard.writeText(props.code).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }).catch(() => { /* ignore */ })
}

watch(() => themeStore.currentTheme, () => {
  nextTick(() => {
    if (codeRef.value) codeRef.value.innerHTML = highlightedHtml.value
  })
})

onMounted(() => {
  nextTick(() => {
    if (codeRef.value) codeRef.value.innerHTML = highlightedHtml.value
  })
})

watch(highlightedHtml, () => {
  if (codeRef.value) codeRef.value.innerHTML = highlightedHtml.value
})
</script>

<template>
  <div
    class="code-block-wrapper relative overflow-auto scrollbar-thin"
    :style="{ maxHeight }"
  >
    <div class="flex">
      <div
        v-if="showLineNumbers"
        class="flex-shrink-0 text-right pr-3 py-2 pl-3 select-none font-mono text-[11px] leading-relaxed"
        style="background: var(--bg-tertiary); color: var(--text-secondary);"
      >
        <div
          v-for="(_, i) in lines"
          :key="i"
          class="leading-relaxed"
        >{{ i + 1 }}</div>
      </div>
      <pre class="flex-1 overflow-auto p-2 m-0 font-mono text-[11.5px] leading-relaxed"><code
        ref="codeRef"
        class="hljs"
      /></pre>
    </div>
    <button
      v-if="copyable"
      class="absolute top-1 right-1 btn-icon opacity-0 hover:opacity-100 transition-opacity"
      :class="{ 'opacity-100': copied }"
      title="复制代码"
      @click="copyCode"
    >
      <component :is="copied ? Check : Copy" class="w-3 h-3" :class="{ 'text-success': copied }" />
    </button>
  </div>
</template>

<style>
.code-block-wrapper {
  background: #0B1120;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}
.code-block-wrapper:hover button {
  opacity: 0.7;
}
</style>
