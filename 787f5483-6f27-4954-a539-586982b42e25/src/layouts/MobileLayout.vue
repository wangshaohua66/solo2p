<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const tabItems = [
  { path: '/mobile/home', title: '首页', icon: 'HomeFilled' },
  { path: '/mobile/tasks', title: '任务', icon: 'List' },
  { path: '/mobile/upload', title: '上传', icon: 'Upload' },
  { path: '/mobile/notifications', title: '通知', icon: 'Bell' },
  { path: '/mobile/profile', title: '我的', icon: 'User' }
]

const activeTab = computed(() => route.path)

function handleTabClick(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="mobile-layout">
    <header class="mobile-header">
      <div class="header-title">{{ route.meta.title }}</div>
    </header>
    
    <main class="mobile-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <nav class="bottom-nav">
      <div
        v-for="item in tabItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: activeTab === item.path }"
        @click="handleTabClick(item.path)"
      >
        <el-badge v-if="item.path === '/mobile/notifications'" :value="5" :max="99">
          <el-icon :size="24">
            <component :is="item.icon" />
          </el-icon>
        </el-badge>
        <el-icon v-else :size="24">
          <component :is="item.icon" />
        </el-icon>
        <span class="nav-text">{{ item.title }}</span>
      </div>
    </nav>
  </div>
</template>

<style lang="scss" scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  background-color: var(--bg-color-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-color-primary);
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: var(--bottom-nav-height);
  background-color: var(--bg-color-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: var(--text-color-tertiary);
  cursor: pointer;
  transition: color var(--transition-fast);
  
  &.active {
    color: var(--primary-color);
  }
}

.nav-text {
  font-size: 11px;
  margin-top: 2px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
