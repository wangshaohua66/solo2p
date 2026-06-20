<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const collapsed = ref(false)
const showUserMenu = ref(false)

const menuItems = [
  { path: '/dashboard', title: '工作台', icon: 'DataLine' },
  { path: '/topics', title: '选题策划', icon: 'EditPen' },
  { path: '/materials', title: '素材资源库', icon: 'Folder' },
  { path: '/workflow', title: '审核流程', icon: 'CircleCheck' },
  { path: '/schedule', title: '播出排期', icon: 'Calendar' },
  { path: '/copyright', title: '版权管理', icon: 'Lock' },
  { path: '/statistics', title: '工作量统计', icon: 'Histogram' }
]

const sidebarWidth = computed(() => 
  collapsed.value ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'
)

const activeMenu = computed(() => route.path)

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

function handleMenuClick(path: string) {
  router.push(path)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

function handleProfile() {
  router.push('/profile')
  showUserMenu.value = false
}
</script>

<template>
  <div class="main-layout">
    <aside class="sidebar" :style="{ width: sidebarWidth }">
      <div class="logo">
        <el-icon :size="32" color="#409eff"><Promotion /></el-icon>
        <span v-if="!collapsed" class="logo-text">融媒体中心</span>
      </div>
      
      <nav class="menu">
        <div
          v-for="item in menuItems"
          :key="item.path"
          class="menu-item"
          :class="{ active: activeMenu.startsWith(item.path), collapsed }"
          @click="handleMenuClick(item.path)"
        >
          <el-icon :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span v-if="!collapsed" class="menu-text">{{ item.title }}</span>
        </div>
      </nav>
      
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon :size="18">
          <component :is="collapsed ? 'Expand' : 'Fold'" />
        </el-icon>
        <span v-if="!collapsed">收起菜单</span>
      </div>
    </aside>
    
    <div class="main-content">
      <header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <el-badge :value="3" class="notification-badge">
            <el-icon :size="20" class="header-icon"><Bell /></el-icon>
          </el-badge>
          
          <div class="user-info" @click="showUserMenu = !showUserMenu">
            <el-avatar :size="36" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
            <div class="user-detail" v-if="userStore.userInfo">
              <span class="user-name">{{ userStore.userInfo.name }}</span>
              <span class="user-role">{{ userStore.userInfo.department }}</span>
            </div>
            <el-icon :size="14"><ArrowDown /></el-icon>
          </div>
          
          <el-dropdown v-model:visible="showUserMenu" trigger="click" @click="showUserMenu = false">
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="handleProfile">
                  <el-icon><User /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="slide-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color-secondary);
  border-right: 1px solid var(--border-color);
  transition: width var(--transition-normal);
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--header-height);
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  
  &-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    white-space: nowrap;
  }
}

.menu {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  margin: 4px 12px;
  border-radius: var(--border-radius-sm);
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  
  &:hover {
    background-color: var(--bg-color-tertiary);
    color: var(--text-color-primary);
  }
  
  &.active {
    background-color: rgba(64, 158, 255, 0.1);
    color: var(--primary-color);
  }
  
  &.collapsed {
    justify-content: center;
    padding: 12px;
  }
}

.menu-text {
  font-size: 14px;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  border-top: 1px solid var(--border-color);
  color: var(--text-color-tertiary);
  cursor: pointer;
  font-size: 12px;
  transition: color var(--transition-fast);
  
  &:hover {
    color: var(--text-color-primary);
  }
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 24px;
  background-color: var(--bg-color-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-icon {
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: color var(--transition-fast);
  
  &:hover {
    color: var(--text-color-primary);
  }
}

.notification-badge {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  
  &:hover {
    background-color: var(--bg-color-tertiary);
  }
}

.user-detail {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.user-role {
  font-size: 12px;
  color: var(--text-color-tertiary);
}

.content {
  flex: 1;
  overflow: hidden;
  background-color: var(--bg-color);
}

.slide-fade-enter-active {
  transition: all var(--transition-normal);
}

.slide-fade-leave-active {
  transition: all var(--transition-fast);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  
  .header {
    padding: 0 16px;
  }
  
  .user-detail {
    display: none;
  }
}
</style>
