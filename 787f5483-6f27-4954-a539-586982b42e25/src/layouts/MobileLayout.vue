<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePWA } from '@/composables/usePWA'

const route = useRoute()
const router = useRouter()
const { isOnline, hasUpdate, offlineInfo, applyUpdate } = usePWA()

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
      <div class="header-status">
        <span v-if="!isOnline" class="offline-badge">离线</span>
      </div>
    </header>
    
    <div v-if="!isOnline" class="offline-banner">
      <el-icon><Warning /></el-icon>
      <span>当前处于离线模式，正在显示缓存内容</span>
    </div>
    
    <div v-if="hasUpdate" class="update-banner">
      <span>发现新版本，请刷新更新</span>
      <el-button type="primary" size="small" @click="applyUpdate">立即更新</el-button>
    </div>
    
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
        <el-badge
          v-if="item.path === '/mobile/notifications'"
          :value="5"
          :max="99"
        >
          <el-icon :size="24">
            <component :is="item.icon" />
          </el-icon>
        </el-badge>
        <el-badge
          v-else-if="item.path === '/mobile/upload' && offlineInfo.pendingUploads > 0"
          :value="offlineInfo.pendingUploads"
          :max="99"
        >
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
  position: relative;
}

.header-status {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.offline-badge {
  padding: 2px 8px;
  font-size: 12px;
  color: #fff;
  background-color: #f56c6c;
  border-radius: 4px;
}

.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #fef0f0;
  color: #f56c6c;
  font-size: 13px;
  border-bottom: 1px solid #fde2e2;
  flex-shrink: 0;
}

.update-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: #ecf5ff;
  color: #409eff;
  font-size: 13px;
  border-bottom: 1px solid #d9ecff;
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
