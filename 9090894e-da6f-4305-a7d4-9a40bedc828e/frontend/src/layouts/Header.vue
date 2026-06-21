<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  Fold,
  Expand,
  Bell,
  Search as SearchIcon,
  User,
  Setting,
  SwitchButton,
  CaretBottom
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface Props {
  collapsed: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const route = useRoute()
const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm'))
const userDropdownVisible = ref(false)

setInterval(() => {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm')
}, 60000)

const breadcrumbMap: Record<string, string> = {
  '/dashboard': '数据看板',
  '/declarations': '申报清单',
  '/hs-search': 'HS编码检索',
  '/tax-calculator': '退税计算器',
  '/exceptions': '通关异常管理',
  '/policies': '政策法规库',
  '/settings': '系统设置'
}

const currentBreadcrumb = breadcrumbMap[route.path] || '首页'
</script>

<template>
  <header class="header">
    <div class="header-left">
      <div class="collapse-btn" @click="emit('toggle')" :title="collapsed ? '展开菜单' : '收起菜单'">
        <component :is="collapsed ? Expand : Fold" />
      </div>
      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentBreadcrumb !== '首页'">
          {{ currentBreadcrumb }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-right">
      <div class="header-time">{{ currentTime }}</div>

      <div class="header-search">
        <el-input
          placeholder="搜索..."
          :prefix-icon="SearchIcon"
          clearable
          size="small"
          style="width: 200px"
        />
      </div>

      <el-badge :value="3" :hidden="false" class="notification-badge">
        <el-button :icon="Bell" text circle size="large" />
      </el-badge>

      <el-dropdown trigger="click" v-model="userDropdownVisible">
        <div class="user-info">
          <el-avatar :size="32" icon="User" />
          <span class="user-name">张申报员</span>
          <el-icon class="caret"><CaretBottom /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>
              <el-icon style="margin-right: 8px"><User /></el-icon>个人中心
            </el-dropdown-item>
            <el-dropdown-item>
              <el-icon style="margin-right: 8px"><Setting /></el-icon>账号设置
            </el-dropdown-item>
            <el-dropdown-item divided>
              <el-icon style="margin-right: 8px"><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header {
  height: $header-height;
  background-color: $bg-header;
  border-bottom: 1px solid $border-light;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $border-radius-sm;
  cursor: pointer;
  color: $text-regular;
  transition: all 0.2s;
  font-size: 18px;

  &:hover {
    background-color: $bg-color;
    color: $primary-color;
  }
}

.breadcrumb {
  font-size: $font-size-sm;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-time {
  font-size: $font-size-sm;
  color: $text-secondary;
  min-width: 130px;
}

.notification-badge {
  :deep(.el-badge__content) {
    background-color: $danger-color;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: $border-radius-sm;
  transition: background-color 0.2s;

  &:hover {
    background-color: $bg-color;
  }

  .user-name {
    font-size: $font-size-sm;
    color: $text-regular;
  }

  .caret {
    font-size: 12px;
    color: $text-secondary;
  }
}
</style>
