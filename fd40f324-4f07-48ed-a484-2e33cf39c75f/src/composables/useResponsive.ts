import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'

interface BreakpointConfig {
  mobile: number
  tablet: number
  desktop: number
  wide: number
}

const DEFAULT_CONFIG: BreakpointConfig = {
  mobile: 640,
  tablet: 768,
  desktop: 1366,
  wide: 1920
}

export function useResponsive(config: Partial<BreakpointConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)

  const breakpoint = computed<Breakpoint>(() => {
    if (width.value < cfg.mobile) return 'mobile'
    if (width.value < cfg.tablet) return 'mobile'
    if (width.value < cfg.desktop) return 'tablet'
    if (width.value < cfg.wide) return 'desktop'
    return 'wide'
  })

  const isMobile = computed(() => breakpoint.value === 'mobile')
  const isTablet = computed(() => breakpoint.value === 'tablet')
  const isDesktop = computed(() => breakpoint.value === 'desktop' || breakpoint.value === 'wide')
  const isWide = computed(() => breakpoint.value === 'wide')

  const sidebarCollapsible = computed(() => isMobile.value || isTablet.value)
  const showCompactToolbar = computed(() => isMobile.value)
  const editorFontSize = computed(() => {
    if (isMobile.value) return 12
    if (isTablet.value) return 13
    if (isDesktop.value) return 14
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
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    sidebarCollapsible,
    showCompactToolbar,
    editorFontSize
  }
}

export type ResponsiveAPI = ReturnType<typeof useResponsive>
