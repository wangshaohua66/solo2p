<template>
  <el-container class="main-container">
    <el-header class="header">
      <div class="header-left">
        <el-button
          v-if="isMobile"
          class="hamburger-btn"
          text
          @click="mobileMenuVisible = !mobileMenuVisible"
        >
          <el-icon><Menu /></el-icon>
        </el-button>
        <div class="logo-section">
          <img src="/favicon.svg" alt="Logo" class="logo" />
          <span class="system-name" v-if="!isCollapsed || isMobile">设备预约管理系统</span>
        </div>
      </div>

      <div class="header-center">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item
            v-for="(item, index) in breadcrumbs"
            :key="index"
            :to="index < breadcrumbs.length - 1 ? item.path : undefined"
          >
            {{ item.title }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="header-right">
        <el-badge :value="notificationStore.unreadCount.unreadCount" :hidden="notificationStore.unreadCount.unreadCount === 0" class="notification-badge">
          <el-button text class="header-icon-btn" @click="handleNotificationClick">
            <el-icon :size="20"><Bell /></el-icon>
          </el-button>
        </el-badge>

        <el-dropdown trigger="click" @command="handleUserCommand">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">
              {{ userStore.userInfo?.name?.charAt(0) || 'U' }}
            </el-avatar>
            <span class="user-name" v-if="!isMobile">{{ userStore.userInfo?.name || '用户' }}</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <div class="user-profile">
                <el-avatar :size="48" class="profile-avatar">
                  {{ userStore.userInfo?.name?.charAt(0) || 'U' }}
                </el-avatar>
                <div class="profile-info">
                  <div class="profile-name">{{ userStore.userInfo?.name || '用户' }}</div>
                  <div class="profile-role">{{ getRoleName(userStore.userInfo?.role?.name) }}</div>
                </div>
              </div>
              <el-dropdown-item divided command="profile">
                <el-icon><User /></el-icon>
                <span>个人中心</span>
              </el-dropdown-item>
              <el-dropdown-item command="logout">
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
      <el-aside
        :width="sidebarWidth"
        class="sidebar"
        :class="{ 'sidebar-collapsed': isCollapsed && !isMobile, 'sidebar-mobile': isMobile, 'sidebar-mobile-visible': mobileMenuVisible }"
      >
        <div v-if="isMobile && mobileMenuVisible" class="mobile-overlay" @click="mobileMenuVisible = false"></div>
        <div class="sidebar-content">
          <el-menu
            :default-active="activeMenu"
            :collapse="isCollapsed && !isMobile"
            :collapse-transition="false"
            router
            class="sidebar-menu"
            background-color="#001529"
            text-color="#ffffffa6"
            active-text-color="#ffffff"
          >
            <template v-for="menu in filteredMenus" :key="menu.path">
              <el-sub-menu v-if="menu.children && menu.children.length > 0" :index="menu.path">
                <template #title>
                  <el-icon><component :is="menu.icon" /></el-icon>
                  <span>{{ menu.title }}</span>
                </template>
                <el-menu-item
                  v-for="child in getFilteredChildren(menu)"
                  :key="child.path"
                  :index="child.path"
                >
                  <el-icon><component :is="child.icon" /></el-icon>
                  <span>{{ child.title }}</span>
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="menu.path">
                <el-icon><component :is="menu.icon" /></el-icon>
                <template #title>{{ menu.title }}</template>
              </el-menu-item>
            </template>
          </el-menu>
        </div>
      </el-aside>

      <el-main class="main-content">
        <transition name="fade-transform" mode="out-in">
          <router-view v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </router-view>
        </transition>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Menu,
  Bell,
  ArrowDown,
  User,
  SwitchButton,
  DataAnalysis,
  Monitor,
  Calendar,
  List,
  Wallet,
  Tools,
  TrendCharts,
  Document,
  Setting
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'

interface MenuItem {
  path: string
  title: string
  icon: any
  permission?: string
  children?: MenuItem[]
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const isCollapsed = ref(false)
const mobileMenuVisible = ref(false)
const isMobile = ref(false)

const menuItems: MenuItem[] = [
  {
    path: '/dashboard',
    title: '仪表盘',
    icon: DataAnalysis,
    permission: 'dashboard:view'
  },
  {
    path: '/equipment',
    title: '设备管理',
    icon: Monitor,
    permission: 'equipment:view'
  },
  {
    path: '/booking',
    title: '预约管理',
    icon: Calendar,
    permission: 'booking:view',
    children: [
      {
        path: '/booking/calendar',
        title: '日历视图',
        icon: Calendar,
        permission: 'booking:view'
      },
      {
        path: '/booking/list',
        title: '预约列表',
        icon: List,
        permission: 'booking:view'
      }
    ]
  },
  {
    path: '/billing',
    title: '账单管理',
    icon: Wallet,
    permission: 'billing:view'
  },
  {
    path: '/maintenance',
    title: '维护管理',
    icon: Tools,
    permission: 'maintenance:view'
  },
  {
    path: '/statistics',
    title: '统计分析',
    icon: TrendCharts,
    permission: 'statistics:view'
  },
  {
    path: '/audit',
    title: '日志审计',
    icon: Document,
    permission: 'audit:view'
  },
  {
    path: '/users',
    title: '用户管理',
    icon: Setting,
    permission: 'user:manage'
  }
]

const sidebarWidth = computed(() => {
  if (isMobile.value) return mobileMenuVisible.value ? '240px' : '0px'
  return isCollapsed.value ? '64px' : '240px'
})

const activeMenu = computed(() => {
  return route.path
})

const breadcrumbs = computed(() => {
  const crumbs: { path: string; title: string }[] = [{ path: '/', title: '首页' }]
  const matched = route.matched.filter(item => item.meta?.title)
  matched.forEach(item => {
    crumbs.push({
      path: item.path,
      title: item.meta?.title as string
    })
  })
  return crumbs
})

const filteredMenus = computed(() => {
  return menuItems.filter(menu => {
    if (!menu.permission) return true
    return userStore.hasPermission(menu.permission)
  })
})

const getFilteredChildren = (menu: MenuItem) => {
  if (!menu.children) return []
  return menu.children.filter(child => {
    if (!child.permission) return true
    return userStore.hasPermission(child.permission)
  })
}

const getRoleName = (roleName?: string) => {
  const roleMap: Record<string, string> = {
    superadmin: '超级管理员',
    admin: '管理员',
    operator: '操作员',
    teacher: '教师',
    student: '学生'
  }
  return roleMap[roleName || ''] || '用户'
}

const handleResize = () => {
  isMobile.value = window.innerWidth < 768
  if (window.innerWidth >= 1200) {
    isCollapsed.value = false
  } else if (window.innerWidth >= 768 && window.innerWidth < 1200) {
    isCollapsed.value = true
  }
  if (isMobile.value) {
    mobileMenuVisible.value = false
  }
}

const handleNotificationClick = () => {
  router.push('/notifications')
}

const handleUserCommand = async (command: string) => {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await userStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch {
    }
  }
}

watch(() => route.path, () => {
  if (isMobile.value) {
    mobileMenuVisible.value = false
  }
})

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  notificationStore.fetchUnreadCount()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.main-container {
  height: 100vh;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  height: 60px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  position: relative;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 180px;
}

.hamburger-btn {
  display: none;
}

:deep(.hamburger-btn) {
  padding: 8px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  width: 32px;
  height: 32px;
}

.system-name {
  font-size: 18px;
  font-weight: 600;
  color: #001529;
  white-space: nowrap;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 24px;
  overflow: hidden;
}

:deep(.el-breadcrumb) {
  font-size: 14px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 180px;
  justify-content: flex-end;
}

.header-icon-btn {
  padding: 8px;
  color: #606266;
}

.notification-badge {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-name {
  font-size: 14px;
  color: #303133;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.profile-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.profile-info {
  flex: 1;
  overflow: hidden;
}

.profile-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.profile-role {
  font-size: 12px;
  color: #909399;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar {
  background: #001529;
  transition: width 0.3s ease;
  overflow: hidden;
  position: relative;
}

.sidebar-content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

:deep(.sidebar-menu) {
  border-right: none;
  height: 100%;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 50px;
  line-height: 50px;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}

:deep(.el-menu-item.is-active) {
  background-color: #409eff !important;
}

:deep(.el-sub-menu .el-menu-item) {
  background-color: #000c17 !important;
  min-width: 200px;
}

:deep(.el-sub-menu .el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}

:deep(.el-sub-menu .el-menu-item.is-active) {
  background-color: #409eff !important;
}

.sidebar-collapsed {
  width: 64px;
}

.sidebar-collapsed :deep(.el-menu--collapse) {
  width: 64px;
}

.sidebar-mobile {
  position: fixed;
  top: 60px;
  left: 0;
  height: calc(100vh - 60px);
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.sidebar-mobile-visible {
  transform: translateX(0);
}

.mobile-overlay {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: -1;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 1199px) {
  .header-center {
    padding: 0 16px;
  }

  .system-name {
    font-size: 16px;
  }

  .header-left {
    min-width: 140px;
  }

  .header-right {
    min-width: 140px;
  }
}

@media (max-width: 767px) {
  .hamburger-btn {
    display: block;
  }

  .header-center {
    display: none;
  }

  .user-name {
    display: none;
  }

  .system-name {
    font-size: 14px;
  }

  .header-left {
    min-width: auto;
  }

  .header-right {
    min-width: auto;
    gap: 8px;
  }

  .main-content {
    padding: 12px;
  }

  .logo {
    width: 28px;
    height: 28px;
  }
}
</style>
