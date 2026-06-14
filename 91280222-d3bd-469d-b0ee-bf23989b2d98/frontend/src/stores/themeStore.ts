import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark'

export const useThemeStore = defineStore(
  'theme',
  () => {
    const mode = ref<ThemeMode>('light')
    const sidebarCollapsed = ref(false)
    const annotationPanelCollapsed = ref(false)

    function toggleTheme() {
      mode.value = mode.value === 'light' ? 'dark' : 'light'
    }

    function setTheme(newMode: ThemeMode) {
      mode.value = newMode
    }

    function toggleSidebar() {
      sidebarCollapsed.value = !sidebarCollapsed.value
    }

    function toggleAnnotationPanel() {
      annotationPanelCollapsed.value = !annotationPanelCollapsed.value
    }

    function applyTheme() {
      const html = document.documentElement
      if (mode.value === 'dark') {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }

    watch(mode, applyTheme, { immediate: true })

    return {
      mode,
      sidebarCollapsed,
      annotationPanelCollapsed,
      toggleTheme,
      setTheme,
      toggleSidebar,
      toggleAnnotationPanel,
      applyTheme
    }
  },
  {
    persist: {
      key: 'blueprint_theme',
      paths: ['mode', 'sidebarCollapsed', 'annotationPanelCollapsed']
    }
  }
)
