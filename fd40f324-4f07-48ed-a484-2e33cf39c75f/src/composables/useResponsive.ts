import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export type Breakpoint = 'notebook' | 'projector'

interface BreakpointConfig {
  notebook: number
  projector: number
}

const DEFAULT_CONFIG: BreakpointConfig = {
  notebook: 1366,
  projector: 1920
}

export function useResponsive(config: Partial<BreakpointConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)

  const breakpoint = computed<Breakpoint>(() => {
    if (width.value >= cfg.projector) return 'projector'
    return 'notebook'
  })

  const isNotebook = computed(() => breakpoint.value === 'notebook')
  const isProjector = computed(() => breakpoint.value === 'projector')
  const isBelowProjector = computed(() => width.value < cfg.projector)
  const isAboveNotebook = computed(() => width.value >= cfg.notebook)

  const sidebarCollapsible = computed(() => isNotebook.value)
  const showCompactToolbar = computed(() => isNotebook.value && width.value < 1024)

  const editorFontSize = computed(() => {
    if (isProjector.value) return 16
    return 14
  })

  const containerPadding = computed(() => {
    if (isProjector.value) return 24
    return 16
  })

  function update() {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  function onResize() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(update, 80)
  }

  onMounted(() => {
    window.addEventListener('resize', onResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  return {
    width,
    height,
    breakpoint,
    isNotebook,
    isProjector,
    isBelowProjector,
    isAboveNotebook,
    sidebarCollapsible,
    showCompactToolbar,
    editorFontSize,
    containerPadding
  }
}

export type ResponsiveAPI = ReturnType<typeof useResponsive>
