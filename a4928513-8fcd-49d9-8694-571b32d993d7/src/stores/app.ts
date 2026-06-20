import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { setSidebarCollapsed, getSidebarCollapsed } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref<boolean>(getSidebarCollapsed())
  const breadcrumb = ref<{ title: string; path?: string }[]>([])

  const sidebarWidth = computed(() => (sidebarCollapsed.value ? '80px' : '240px'))

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    setSidebarCollapsed(sidebarCollapsed.value)
  }

  function setBreadcrumb(items: { title: string; path?: string }[]) {
    breadcrumb.value = items
  }

  return {
    sidebarCollapsed,
    sidebarWidth,
    breadcrumb,
    toggleSidebar,
    setBreadcrumb
  }
})
