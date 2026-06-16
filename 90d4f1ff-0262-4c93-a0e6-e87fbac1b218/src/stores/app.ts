import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
  const loadingCount = ref(0)

  const isLoading = ref(() => loadingCount.value > 0)

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    sidebarCollapsed.value = collapsed
  }

  const setDevice = (d: 'desktop' | 'tablet' | 'mobile') => {
    device.value = d
  }

  const startLoading = () => {
    loadingCount.value++
  }

  const stopLoading = () => {
    if (loadingCount.value > 0) {
      loadingCount.value--
    }
  }

  return {
    sidebarCollapsed,
    device,
    loadingCount,
    isLoading,
    toggleSidebar,
    setSidebarCollapsed,
    setDevice,
    startLoading,
    stopLoading
  }
}, {
  persist: {
    key: 'smart-parking-app',
    paths: ['sidebarCollapsed']
  }
})
