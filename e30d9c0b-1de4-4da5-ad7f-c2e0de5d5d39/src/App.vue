<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <el-icon :size="32" color="#409EFF"><Cpu /></el-icon>
          <span v-if="!sidebarCollapsed" class="app-title">非遗数字化保护</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="active"
        >
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span v-if="!sidebarCollapsed" class="nav-text">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="toggle-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          <el-icon :size="18">
            <component :is="sidebarCollapsed ? 'ArrowRight' : 'ArrowLeft'" />
          </el-icon>
        </button>
      </div>
    </aside>
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/project'
import {
  List,
  Edit,
  Share,
  View,
  ArrowLeft,
  ArrowRight,
  Cpu
} from '@element-plus/icons-vue'

const route = useRoute()
const projectStore = useProjectStore()
const sidebarCollapsed = ref(false)

const firstProjectId = computed(() => {
  if (projectStore.projects.length > 0) {
    return projectStore.projects[0].id
  }
  return '0'
})

const menuItems = computed(() => [
  { path: '/projects', label: '项目列表', icon: List },
  { path: `/editor/${firstProjectId.value}`, label: '步骤编辑', icon: Edit },
  { path: '/relations', label: '关联图谱', icon: Share },
  { path: `/showcase/${firstProjectId.value}`, label: '公众展示', icon: View }
])
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 220px;
  background: linear-gradient(180deg, #001529 0%, #002140 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: #409EFF;
  color: #fff;
}

.nav-text {
  font-size: 14px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.toggle-btn {
  width: 100%;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.main-content {
  flex: 1;
  margin-left: 220px;
  transition: margin-left 0.3s ease;
  min-height: 100vh;
}

.sidebar.collapsed + .main-content {
  margin-left: 64px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1366px) {
  .sidebar {
    width: 64px;
  }
  
  .sidebar .app-title,
  .sidebar .nav-text {
    display: none;
  }
  
  .main-content {
    margin-left: 64px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    height: 56px;
    bottom: auto;
    flex-direction: row;
    align-items: center;
    padding: 0 8px;
  }
  
  .sidebar.collapsed {
    width: 100%;
  }
  
  .sidebar-header {
    padding: 0 12px;
    border-bottom: none;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .logo .app-title {
    display: none;
  }
  
  .sidebar-nav {
    flex: 1;
    flex-direction: row;
    padding: 0 8px;
    gap: 4px;
  }
  
  .nav-item {
    flex-direction: column;
    padding: 8px 12px;
    gap: 4px;
  }
  
  .nav-text {
    font-size: 11px;
  }
  
  .sidebar .nav-text {
    display: block;
  }
  
  .sidebar-footer {
    display: none;
  }
  
  .main-content {
    margin-left: 0;
    margin-top: 56px;
    padding-bottom: 70px;
  }
}
</style>
