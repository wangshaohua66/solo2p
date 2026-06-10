<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import dayjs from 'dayjs'
import { Menu, Bell, CaretBottom, User, SwitchButton } from '@element-plus/icons-vue'

const props = defineProps<{
  title: string
  collapsed: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  'toggle-sidebar': []
  'logout': []
}>()

const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const userMenuVisible = ref(false)

const memberTierLabel = computed(() => {
  const tier = authStore.user?.memberTier
  switch (tier) {
    case 'yearly': return '年卡会员'
    case 'quarterly': return '季卡会员'
    case 'monthly': return '月卡会员'
    default: return '体验卡'
  }
})

const memberExpireText = computed(() => {
  if (!authStore.user?.memberExpireDate) return ''
  const expireDate = dayjs(authStore.user.memberExpireDate)
  const days = expireDate.diff(dayjs(), 'day')
  if (days < 0) return '已过期'
  if (days <= 14) return `剩余 ${days} 天到期`
  return expireDate.format('YYYY-MM-DD 到期')
})

const handleProfileClick = () => {
  router.push('/profile')
  userMenuVisible.value = false
}

const handleNotificationClick = () => {
  notificationStore.fetchUnreadCount()
}
</script>

<template>
  <header class="header">
    <div class="header-left">
      <button 
        class="menu-toggle" 
        @click="emit('toggle-sidebar')"
      >
        <el-icon :size="20"><Menu /></el-icon>
      </button>
      <h1 class="page-title">{{ title }}</h1>
    </div>
    
    <div class="header-right">
      <div class="header-actions">
        <el-badge :value="notificationStore.unreadCount" :max="99" class="notification-badge">
          <el-button circle :icon="Bell" @click="handleNotificationClick" />
        </el-badge>
      </div>
      
      <el-dropdown 
        v-model:visible="userMenuVisible"
        trigger="click" 
        @command="(cmd: string) => { if (cmd === 'logout') emit('logout') }"
      >
        <div class="user-dropdown">
          <div class="user-avatar">
            <el-avatar :size="36" :src="authStore.user?.avatar">
              {{ authStore.user?.username?.charAt(0) || 'U' }}
            </el-avatar>
          </div>
          <div class="user-info-mini">
            <span class="username">{{ authStore.user?.username }}</span>
            <span class="tier-tag">{{ memberTierLabel }}</span>
          </div>
          <el-icon class="dropdown-icon"><CaretBottom /></el-icon>
        </div>
        
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <div class="dropdown-user-info">
                <div class="dropdown-username">{{ authStore.user?.username }}</div>
                <div class="dropdown-email">{{ authStore.user?.email }}</div>
                <div class="dropdown-tier" v-if="memberExpireText">
                  <el-tag size="small" :type="authStore.user?.memberExpireDate && dayjs(authStore.user.memberExpireDate).diff(dayjs(), 'day') <= 14 ? 'danger' : 'success'" effect="plain">
                    {{ memberTierLabel }} · {{ memberExpireText }}
                  </el-tag>
                </div>
              </div>
            </el-dropdown-item>
            <el-dropdown-item divided command="profile" @click="handleProfileClick">
              <el-icon><User /></el-icon>
              <span>个人中心</span>
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon>
              <span>退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  height: $header-height;
  background: white;
  border-bottom: 1px solid $color-border;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 100;

  @media (max-width: $breakpoint-mobile) {
    padding: 0 12px;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.menu-toggle {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $border-radius-md;
  color: $color-text-secondary;
  transition: all $transition-fast;

  &:hover {
    background: $color-bg;
    color: $color-primary;
  }

  @media (min-width: 1281px) {
    display: none;
  }
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0;

  @media (max-width: $breakpoint-mobile) {
    font-size: 16px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-badge {
  :deep(.el-badge__content) {
    background-color: $color-primary;
  }
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: $border-radius-md;
  transition: background $transition-fast;

  &:hover {
    background: $color-bg;
  }
}

.user-info-mini {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;

  @media (max-width: $breakpoint-mobile) {
    display: none;
  }
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.tier-tag {
  font-size: 12px;
  color: $color-primary;
}

.dropdown-icon {
  color: $color-text-placeholder;
  font-size: 12px;
}

.dropdown-user-info {
  padding: 8px 0;
  min-width: 200px;
}

.dropdown-username {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
}

.dropdown-email {
  font-size: 13px;
  color: $color-text-secondary;
  margin-top: 4px;
}

.dropdown-tier {
  margin-top: 8px;
}
</style>
