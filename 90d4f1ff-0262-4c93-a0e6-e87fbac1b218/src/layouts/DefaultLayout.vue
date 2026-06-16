<template>
  <el-container class="layout-container">
    <el-aside :width="sidebarWidth" class="layout-aside">
      <Sidebar />
    </el-aside>
    <el-container>
      <el-header class="layout-header" height="60px">
        <HeaderBar />
      </el-header>
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Sidebar from './Sidebar.vue'
import HeaderBar from './HeaderBar.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const sidebarWidth = computed(() => (appStore.sidebarCollapsed ? '64px' : '220px'))
</script>

<style lang="scss" scoped>
.layout-container {
  height: 100vh;
  overflow: hidden;
}

.layout-aside {
  background-color: var(--sidebar-bg);
  transition: width 0.28s;
  overflow: hidden;
}

.layout-header {
  background-color: var(--header-bg);
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  padding: 0;
  z-index: 10;
}

.layout-main {
  background-color: var(--content-bg);
  overflow-y: auto;
  padding: 0;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
