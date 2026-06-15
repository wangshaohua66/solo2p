<template>
  <el-container class="main-layout">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <el-icon :size="28" color="#3b82f6"><FirstAidKit /></el-icon>
        <span v-if="!isCollapse" class="logo-text">急救指挥中心</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        background-color="#111827"
        text-color="#9ca3af"
        active-text-color="#3b82f6"
        router
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <el-button
          :icon="isCollapse ? Expand : Fold"
          text
          @click="isCollapse = !isCollapse"
          class="collapse-btn"
        />
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ currentRoute.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :icon="UserFilled" />
              <span class="username">{{ userStore.user?.realName }}</span>
              <el-icon><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人信息
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  Monitor,
  Document,
  Van,
  DataAnalysis,
  UserFilled,
  User,
  SwitchButton,
  CaretBottom,
  Fold,
  Expand,
  FirstAidKit
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)
const activeMenu = computed(() => route.path)
const currentRoute = computed(() => route)

const menuItems = computed(() => {
  const items = [
    { path: '/dispatch', title: '调度指挥', icon: Monitor, roles: ['DISPATCHER', 'ADMIN'] },
    { path: '/record', title: '病历管理', icon: Document, roles: ['DOCTOR', 'ADMIN', 'QC'] },
    { path: '/vehicle', title: '车辆管理', icon: Van, roles: ['VEHICLE_MANAGER', 'ADMIN'] },
    { path: '/quality', title: '质控报表', icon: DataAnalysis, roles: ['QC', 'ADMIN'] }
  ]
  return items.filter(item => item.roles.includes(userStore.user?.role || ''))
})

function handleCommand(command: string) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      router.push('/login')
    }).catch(() => {})
  } else if (command === 'profile') {
    ElMessage.info('个人信息功能开发中')
  }
}
</script>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  width: 100%;
}

.sidebar {
  background: #111827;
  border-right: 1px solid #374151;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-bottom: 1px solid #374151;

    .logo-text {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
    }
  }

  :deep(.el-menu) {
    border-right: none;
    flex: 1;

    .el-menu-item {
      height: 48px;
      line-height: 48px;
      margin: 4px 8px;
      border-radius: 4px;

      &:hover, &.is-active {
        background: rgba(59, 130, 246, 0.1) !important;
      }

      &.is-active {
        background: rgba(59, 130, 246, 0.15) !important;
      }
    }
  }

  .sidebar-footer {
    padding: 8px;
    border-top: 1px solid #374151;
    display: flex;
    justify-content: center;

    .collapse-btn {
      width: 100%;
      color: #9ca3af;
    }
  }
}

.header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    :deep(.el-breadcrumb__inner) {
      font-size: 16px;
      font-weight: 500;
      color: #111827;
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;

      &:hover {
        background: #f3f4f6;
      }

      .username {
        font-size: 14px;
        color: #374151;
      }
    }
  }
}

.main-content {
  background: #f3f4f6;
  padding: 0;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
