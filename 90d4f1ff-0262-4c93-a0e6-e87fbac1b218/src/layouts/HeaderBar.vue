<template>
  <div class="header-wrapper">
    <div class="header-left">
      <el-icon class="collapse-btn" :size="20" @click="appStore.toggleSidebar()">
        <component :is="appStore.sidebarCollapsed ? 'Expand' : 'Fold'" />
      </el-icon>
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path" :to="item.path">
          {{ item.meta?.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="header-right">
      <el-tooltip content="全屏" placement="bottom">
        <el-icon class="header-icon" @click="toggleFullscreen">
          <FullScreen />
        </el-icon>
      </el-tooltip>
      <el-tooltip content="消息" placement="bottom">
        <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="badge-wrap">
          <el-icon class="header-icon" @click="showMessagePanel = !showMessagePanel">
            <Bell />
          </el-icon>
        </el-badge>
      </el-tooltip>
      <el-dropdown trigger="click" @command="handleUserCommand">
        <div class="user-info">
          <el-avatar :size="32" :src="authStore.user?.avatar">
            {{ authStore.user?.nickname?.charAt(0) || 'U' }}
          </el-avatar>
          <span class="username">{{ authStore.user?.nickname }}</span>
          <el-tag :type="roleTagType" size="small" effect="light" class="role-tag">
            {{ roleLabel }}
          </el-tag>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>个人中心
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon>账户设置
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types'

const appStore = useAppStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const showMessagePanel = ref(false)
const unreadCount = ref(3)

const breadcrumbs = computed(() => {
  return route.matched.filter(r => r.meta && r.meta.title)
})

const roleLabels: Record<UserRole, string> = {
  SuperAdmin: '超级管理员',
  ParkOperator: '园区运营',
  ParkingAdmin: '停车场管理员',
  ChargingOps: '充电桩运维',
  CarOwner: '车主'
}

const roleTagTypes: Record<UserRole, 'danger' | 'warning' | 'success' | 'info' | 'primary'> = {
  SuperAdmin: 'danger',
  ParkOperator: 'warning',
  ParkingAdmin: 'primary',
  ChargingOps: 'success',
  CarOwner: 'info'
}

const roleLabel = computed(() => authStore.user?.role ? roleLabels[authStore.user.role] : '')
const roleTagType = computed(() => authStore.user?.role ? roleTagTypes[authStore.user.role] : 'info')

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleUserCommand = async (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/profile')
      break
    case 'logout':
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      authStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
      break
  }
}
</script>

<style lang="scss" scoped>
.header-wrapper {
  width: 100%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  cursor: pointer;
  color: #606266;
  transition: color 0.2s;

  &:hover {
    color: var(--primary-color);
  }
}

.breadcrumb {
  font-size: 14px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  font-size: 20px;
  color: #606266;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background-color: #f5f7fa;
    color: var(--primary-color);
  }
}

.badge-wrap {
  :deep(.el-badge__content) {
    transform: translate(60%, -50%);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
  }

  .username {
    font-size: 14px;
    color: #303133;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-tag {
    margin-left: 4px;
  }
}

@media (max-width: 768px) {
  .breadcrumb {
    display: none;
  }

  .username,
  .role-tag {
    display: none;
  }
}
</style>
