<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  collapsed: boolean
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/remains')) return 'remains'
  if (path.startsWith('/hall') || path.startsWith('/vehicle') || path.startsWith('/dispatch')) return 'dispatch'
  if (path.startsWith('/cemetery')) return 'cemetery'
  if (path.startsWith('/statistics')) return 'statistics'
  if (path.startsWith('/settings')) return 'settings'
  if (path.startsWith('/dashboard')) return 'dashboard'
  return 'dashboard'
})

const openSubMenu = computed(() => {
  const path = route.path
  const opens: string[] = []
  if (path.startsWith('/remains')) opens.push('remains')
  if (path.startsWith('/hall') || path.startsWith('/vehicle') || path.startsWith('/dispatch')) opens.push('dispatch')
  if (path.startsWith('/cemetery')) opens.push('cemetery')
  return opens
})

function handleMenuSelect(index: string) {
  const routes: Record<string, string> = {
    dashboard: '/dashboard',
    'remains-list': '/remains/list',
    'remains-register': '/remains/register',
    'remains-settlement': '/remains/settlement',
    'hall-booking': '/hall/booking',
    'vehicle-dispatch': '/vehicle/dispatch',
    'cemetery-map': '/cemetery/map',
    'cemetery-memorial': '/cemetery/memorial',
    statistics: '/statistics',
    settings: '/settings'
  }
  const target = routes[index]
  if (target) {
    router.push(target)
  }
}

const userName = computed(() => authStore.userInfo?.name || '用户')
const userDept = computed(() => authStore.userInfo?.department || '')
const userInitial = computed(() => userName.value.charAt(0))
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="logo-area">
      <div class="logo-icon">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M24 4C24 4 16 12 16 24C16 32 20 38 24 40C28 38 32 32 32 24C32 12 24 4 24 4Z"
            stroke="#C9A86C"
            stroke-width="2"
            fill="none"
          />
          <path
            d="M24 12C24 12 20 18 20 24C20 28 22 32 24 33C26 32 28 28 28 24C28 18 24 12 24 12Z"
            fill="#C9A86C"
            opacity="0.6"
          />
          <circle cx="24" cy="24" r="2" fill="#C9A86C" />
          <path d="M10 28L18 24" stroke="#C9A86C" stroke-width="1.5" opacity="0.7" />
          <path d="M38 28L30 24" stroke="#C9A86C" stroke-width="1.5" opacity="0.7" />
          <path d="M12 38L18 34" stroke="#C9A86C" stroke-width="1.5" opacity="0.5" />
          <path d="M36 38L30 34" stroke="#C9A86C" stroke-width="1.5" opacity="0.5" />
        </svg>
      </div>
      <span v-if="!collapsed" class="logo-text">殡葬管理综合服务平台</span>
    </div>

    <el-menu
      :default-active="activeMenu"
      :default-openeds="openSubMenu"
      :collapse="collapsed"
      :collapse-transition="false"
      class="sidebar-menu"
      background-color="#24242B"
      text-color="#B0B0B8"
      active-text-color="#C9A86C"
      router
      @select="handleMenuSelect"
    >
      <el-menu-item index="dashboard">
        <el-icon><Odometer /></el-icon>
        <template #title>工作台</template>
      </el-menu-item>

      <el-sub-menu index="remains">
        <template #title>
          <el-icon><Briefcase /></el-icon>
          <span>业务办理</span>
        </template>
        <el-menu-item index="remains-list">
          <el-icon><Document /></el-icon>
          <template #title>遗体档案</template>
        </el-menu-item>
        <el-menu-item index="remains-register">
          <el-icon><EditPen /></el-icon>
          <template #title>遗体登记</template>
        </el-menu-item>
        <el-menu-item index="remains-settlement">
          <el-icon><Wallet /></el-icon>
          <template #title>费用结算</template>
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="dispatch">
        <template #title>
          <el-icon><Van /></el-icon>
          <span>资源调度</span>
        </template>
        <el-menu-item index="hall-booking">
          <el-icon><Calendar /></el-icon>
          <template #title>告别厅预约</template>
        </el-menu-item>
        <el-menu-item index="vehicle-dispatch">
          <el-icon><Operation /></el-icon>
          <template #title>车辆调度</template>
        </el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="cemetery">
        <template #title>
          <el-icon><LocationFilled /></el-icon>
          <span>墓园管理</span>
        </template>
        <el-menu-item index="cemetery-map">
          <el-icon><MapLocation /></el-icon>
          <template #title>园区管理</template>
        </el-menu-item>
        <el-menu-item index="cemetery-memorial">
          <el-icon><Clock /></el-icon>
          <template #title>祭扫预约</template>
        </el-menu-item>
      </el-sub-menu>

      <el-menu-item index="statistics">
        <el-icon><DataAnalysis /></el-icon>
        <template #title>统计报表</template>
      </el-menu-item>

      <el-menu-item index="settings">
        <el-icon><Setting /></el-icon>
        <template #title>系统设置</template>
      </el-menu-item>
    </el-menu>

    <div class="user-area">
      <div class="user-avatar">
        {{ userInitial }}
      </div>
      <div v-if="!collapsed" class="user-info">
        <div class="user-name">{{ userName }}</div>
        <div class="user-dept">{{ userDept }}</div>
      </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background: #24242B;
  border-right: 1px solid #3A3A44;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;

  &.collapsed {
    width: 80px;
  }
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid #3A3A44;
  flex-shrink: 0;

  .logo-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;

    svg {
      width: 36px !important;
      height: 36px !important;
      max-width: 36px !important;
      max-height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      display: block;
    }
  }

  .logo-text {
    font-size: 15px;
    font-weight: 600;
    color: #C9A86C;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #3A3A44;
    border-radius: 2px;
    &:hover {
      background: #8B7355;
    }
  }

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    .el-icon {
      width: 18px !important;
      height: 18px !important;
      min-width: 18px !important;
      min-height: 18px !important;
      max-width: 18px !important;
      max-height: 18px !important;
      font-size: 18px !important;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
    }
  }

  :deep(.el-menu-item) {
    height: 48px;
    line-height: 48px;
    margin: 2px 8px;
    border-radius: 6px;
    width: calc(100% - 16px);

    &:hover {
      background-color: rgba(201, 168, 108, 0.08) !important;
      color: #C9A86C !important;
    }

    &.is-active {
      background-color: rgba(201, 168, 108, 0.15) !important;
      color: #C9A86C !important;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 12px;
        bottom: 12px;
        width: 3px;
        background: #C9A86C;
        border-radius: 0 2px 2px 0;
      }
    }
  }

  :deep(.el-sub-menu__title) {
    height: 48px;
    line-height: 48px;
    margin: 2px 8px;
    border-radius: 6px;
    width: calc(100% - 16px);

    &:hover {
      background-color: rgba(201, 168, 108, 0.08) !important;
      color: #C9A86C !important;
    }
  }

  :deep(.el-menu--collapse) {
    .el-sub-menu__title {
      justify-content: center;
      padding: 0 !important;
    }
    .el-menu-item {
      justify-content: center;
      padding: 0 !important;
    }
  }

  :deep(.el-menu--popup) {
    background-color: #24242B !important;
    border: 1px solid #3A3A44;

    .el-menu-item {
      color: #B0B0B8 !important;

      &:hover {
        background-color: rgba(201, 168, 108, 0.1) !important;
      }
    }
  }
}

.user-area {
  padding: 16px;
  border-top: 1px solid #3A3A44;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1A1A1F;
    font-weight: 600;
    font-size: 16px;
    flex-shrink: 0;
  }

  .user-info {
    min-width: 0;

    .user-name {
      font-size: 14px;
      color: #FFFFFF;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-dept {
      font-size: 12px;
      color: #6B6B74;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}
</style>
