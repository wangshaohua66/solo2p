<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SideBar from './SideBar.vue'
import TopBar from './TopBar.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const route = useRoute()

const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)

function handleToggleSidebar() {
  appStore.toggleSidebar()
}

function updateBreadcrumb() {
  const meta = route.meta as { breadcrumb?: { title: string; path?: string }[] }
  if (meta?.breadcrumb && meta.breadcrumb.length > 0) {
    appStore.setBreadcrumb(meta.breadcrumb)
  }
}

onMounted(() => {
  updateBreadcrumb()
})

watch(
  () => route.fullPath,
  () => {
    updateBreadcrumb()
  }
)
</script>

<template>
  <div class="main-layout">
    <SideBar :collapsed="sidebarCollapsed" />
    <div class="main-content-wrapper">
      <TopBar @toggle-sidebar="handleToggleSidebar" />
      <main class="main-content">
        <router-view v-slot="{ Component, route: routeData }">
          <transition name="slide-fade" mode="out-in">
            <component :is="Component" :key="routeData.fullPath" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #1A1A1F;
}

.main-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
  background: #1A1A1F;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #3A3A44;
    border-radius: 4px;
    &:hover {
      background: #8B7355;
    }
  }
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.25s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
