<template>
  <div class="sidebar-wrapper">
    <div class="sidebar-logo">
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%23409eff' width='32' height='32' rx='6'/%3E%3Cpath fill='white' d='M8 10h6v12H8zM16 10h2v6h6v-6h2v12h-2v-6h-6v6h-2z'/%3E%3C/svg%3E" alt="logo" class="logo-img" />
      <span v-if="!collapsed" class="logo-text">智慧停车管理</span>
    </div>
    <el-scrollbar class="menu-scroll">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        :unique-opened="true"
        background-color="var(--sidebar-bg)"
        text-color="var(--sidebar-text)"
        active-text-color="#ffffff"
        router
        class="sidebar-menu"
      >
        <template v-for="route in menuRoutes" :key="route.path">
          <el-sub-menu v-if="route.children && route.children.length > 0" :index="resolvePath(route.path)">
            <template #title>
              <el-icon v-if="route.meta?.icon"><component :is="route.meta.icon as string" /></el-icon>
              <span>{{ route.meta?.title }}</span>
            </template>
            <el-menu-item
              v-for="child in route.children"
              :key="resolvePath(route.path, child.path)"
              :index="resolvePath(route.path, child.path)"
            >
              <el-icon v-if="child.meta?.icon"><component :is="child.meta.icon as string" /></el-icon>
              <template #title>{{ child.meta?.title }}</template>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="resolvePath(route.path)">
            <el-icon v-if="route.meta?.icon"><component :is="route.meta.icon as string" /></el-icon>
            <template #title>{{ route.meta?.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { filterRoutesByRole } from '@/router'

const appStore = useAppStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const collapsed = computed(() => appStore.sidebarCollapsed)

const allRoutes = computed(() => {
  const layoutRoute = router.options.routes.find(r => r.path === '/')
  return layoutRoute?.children || []
})

const menuRoutes = computed(() => {
  if (!authStore.userRole) return []
  const children = allRoutes.value.filter(r => !r.meta?.hidden)
  return filterRoutesByRole(children, authStore.userRole)
})

const activeMenu = computed(() => route.path)

const resolvePath = (parentPath: string, childPath?: string): string => {
  if (!childPath) return parentPath.startsWith('/') ? parentPath : `/${parentPath}`
  if (childPath.startsWith('/')) return childPath
  return `${parentPath}/${childPath}`.replace(/\/+/g, '/')
}
</script>

<style lang="scss" scoped>
.sidebar-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  white-space: nowrap;

  .logo-img {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .logo-text {
    margin-left: 12px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }
}

.menu-scroll {
  flex: 1;
  overflow: hidden;
}

.sidebar-menu {
  border-right: none;
  min-height: calc(100vh - 60px);
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 48px;
  line-height: 48px;
}

:deep(.el-menu-item.is-active) {
  background-color: var(--sidebar-active-bg) !important;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}
</style>
