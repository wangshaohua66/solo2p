<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Document,
  Search,
  Calculator,
  DataAnalysis,
  Warning,
  Reading,
  Setting,
  Menu as MenuIcon,
  Fold,
  Expand
} from '@element-plus/icons-vue'
import type { UserRole } from '@/types'

interface Props {
  collapsed: boolean
  width: string
}

const props = defineProps<Props>()

const router = useRouter()
const route = useRoute()

const activeMenu = computed(() => route.path)

const menuItems = ref([
  {
    path: '/dashboard',
    title: '数据看板',
    icon: DataAnalysis,
    roles: ['declarant', 'reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/declarations',
    title: '申报清单',
    icon: Document,
    roles: ['declarant', 'reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/hs-search',
    title: 'HS编码检索',
    icon: Search,
    roles: ['declarant', 'reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/tax-calculator',
    title: '退税计算器',
    icon: Calculator,
    roles: ['declarant', 'reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/exceptions',
    title: '通关异常',
    icon: Warning,
    roles: ['reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/policies',
    title: '政策法规库',
    icon: Reading,
    roles: ['declarant', 'reviewer', 'admin'] as UserRole[]
  },
  {
    path: '/settings',
    title: '系统设置',
    icon: Setting,
    roles: ['admin'] as UserRole[]
  }
])

const currentUser = ref<{ role: UserRole }>({ role: 'declarant' })

const filteredMenu = computed(() => {
  return menuItems.value.filter(item =>
    item.roles.includes(currentUser.value.role)
  )
})

function handleMenuClick(path: string) {
  if (path !== route.path) {
    router.push(path)
  }
}
</script>

<template>
  <aside class="sidebar" :style="{ width }">
    <div class="logo" :class="{ collapsed }">
      <div class="logo-icon">
        <Fold v-if="!collapsed" />
      </div>
      <span v-if="!collapsed" class="logo-text">跨境电商综服中心</span>
    </div>

    <nav class="menu">
      <div
        v-for="item in filteredMenu"
        :key="item.path"
        class="menu-item"
        :class="{ active: activeMenu === item.path, collapsed }"
        @click="handleMenuClick(item.path)"
      >
        <el-tooltip
          v-if="collapsed"
          :content="item.title"
          placement="right"
          :show-after="300"
        >
          <component :is="item.icon" class="menu-icon" />
        </el-tooltip>
        <template v-else>
          <component :is="item.icon" class="menu-icon" />
          <span class="menu-text">{{ item.title }}</span>
        </template>
      </div>
    </nav>

    <div v-if="collapsed" class="collapse-toggle-bottom" title="展开菜单">
      <Expand />
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  background-color: $bg-sidebar;
  transition: width 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: $header-height;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 12px;

  &.collapsed {
    padding: 0;
    justify-content: center;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, $primary-color, $primary-light);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
    flex-shrink: 0;
  }

  .logo-text {
    color: #fff;
    font-size: $font-size-md;
    font-weight: 600;
    white-space: nowrap;
  }
}

.menu {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
  overflow-x: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: $border-radius-base;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
  position: relative;
  white-space: nowrap;

  &.collapsed {
    padding: 12px;
    justify-content: center;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  &.active {
    background-color: $primary-color;
    color: #fff;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
      background-color: #fff;
      border-radius: 0 2px 2px 0;
    }
  }

  .menu-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .menu-text {
    font-size: $font-size-base;
  }
}

.collapse-toggle-bottom {
  padding: 16px;
  display: flex;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;

  &:hover {
    color: #fff;
  }
}
</style>
