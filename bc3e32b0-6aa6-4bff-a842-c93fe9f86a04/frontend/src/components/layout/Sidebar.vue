<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

interface MenuItem {
  path: string
  title: string
  icon: string
  roles?: string[]
}

const props = defineProps<{
  collapsed: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuItems: MenuItem[] = [
  { path: '/dashboard', title: '工作台', icon: 'Odometer' },
  { path: '/members', title: '会员管理', icon: 'User', roles: ['admin', 'instructor'] },
  { path: '/kiln', title: '窑炉排程', icon: 'Flame' },
  { path: '/glaze-recipes', title: '釉料配方', icon: 'MagicStick' },
  { path: '/pieces', title: '作品档案', icon: 'Picture' },
  { path: '/courses', title: '课程中心', icon: 'Reading' },
  { path: '/studio', title: '自由创作', icon: 'Tickets' },
  { path: '/sales', title: '作品销售', icon: 'ShoppingBag', roles: ['admin', 'instructor'] },
  { path: '/inventory', title: '原料库存', icon: 'Box', roles: ['admin'] },
  { path: '/profile', title: '个人中心', icon: 'UserFilled' }
]

const visibleMenuItems = computed(() => {
  return menuItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(authStore.userRole)
  })
})

const isActive = (path: string) => {
  return route.path.startsWith(path)
}

const handleMenuClick = (item: MenuItem) => {
  router.push(item.path)
  if (props.isMobile) {
    emit('toggle')
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed, mobile: isMobile }">
    <div class="sidebar-header">
      <div class="logo-wrapper" @click="() => router.push('/dashboard')">
        <div class="logo-icon">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="26" rx="10" ry="3" fill="#c85a32" opacity="0.3"/>
            <path d="M8 26C8 20 11 14 16 14C21 14 24 20 24 26" stroke="#c85a32" stroke-width="2" fill="none"/>
            <ellipse cx="16" cy="14" rx="5" ry="2.5" fill="#d4a574"/>
            <rect x="14.5" y="6" width="3" height="8" rx="1" fill="#c85a32"/>
            <ellipse cx="16" cy="6" rx="2" ry="1" fill="#e07a52"/>
          </svg>
        </div>
        <span v-if="!collapsed" class="logo-text">陶艺工坊</span>
      </div>
      <button 
        v-if="!isMobile" 
        class="collapse-btn" 
        @click="emit('toggle')"
      >
        <el-icon><ArrowLeft v-if="!collapsed" /><ArrowRight v-else /></el-icon>
      </button>
    </div>
    
    <nav class="sidebar-menu">
      <div 
        v-for="item in visibleMenuItems"
        :key="item.path"
        class="menu-item"
        :class="{ active: isActive(item.path) }"
        @click="handleMenuClick(item)"
      >
        <el-icon class="menu-icon">
          <component :is="item.icon" />
        </el-icon>
        <span v-if="!collapsed" class="menu-text">{{ item.title }}</span>
      </div>
    </nav>
    
    <div class="sidebar-footer">
      <div class="user-info" v-if="!collapsed && authStore.user">
        <el-avatar :size="40" :src="authStore.user.avatar">
          {{ authStore.user.username?.charAt(0) || 'U' }}
        </el-avatar>
        <div class="user-detail">
          <div class="user-name">{{ authStore.user.username }}</div>
          <div class="user-role">
            <el-tag size="small" type="warning" effect="plain">
              {{ authStore.user.memberTier === 'yearly' ? '年卡会员' : 
                 authStore.user.memberTier === 'quarterly' ? '季卡会员' :
                 authStore.user.memberTier === 'monthly' ? '月卡会员' : '体验卡' }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: $sidebar-width;
  background: white;
  border-right: 1px solid $color-border;
  display: flex;
  flex-direction: column;
  z-index: 999;
  transition: width $transition-normal;
  overflow: hidden;

  &.collapsed {
    width: $sidebar-width-collapsed;
  }

  &.mobile {
    width: $sidebar-width;
    transform: translateX(-100%);
    transition: transform $transition-normal;

    &.collapsed {
      transform: translateX(0);
      width: $sidebar-width;
    }
  }
}

.sidebar-header {
  height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid $color-border;
}

.logo-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  flex: 1;
  overflow: hidden;
}

.logo-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: $color-text-primary;
  white-space: nowrap;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  border-radius: $border-radius-sm;
  transition: all $transition-fast;

  &:hover {
    background: $color-bg;
    color: $color-primary;
  }
}

.sidebar-menu {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 4px;
  border-radius: $border-radius-md;
  cursor: pointer;
  color: $color-text-secondary;
  transition: all $transition-fast;
  white-space: nowrap;

  &:hover {
    background: $color-bg;
    color: $color-primary;
  }

  &.active {
    background: linear-gradient(90deg, rgba($color-primary, 0.1) 0%, rgba($color-primary, 0.05) 100%);
    color: $color-primary;
    font-weight: 500;
  }
}

.menu-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.menu-text {
  font-size: 14px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid $color-border;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-detail {
  flex: 1;
  overflow: hidden;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  margin-top: 4px;
}
</style>
