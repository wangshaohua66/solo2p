<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Fold,
  Expand,
  Bell,
  Search as SearchIcon,
  User,
  Setting,
  SwitchButton,
  CaretBottom,
  Close,
  View
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useNotificationStore } from '@/stores/notificationStore'
import { useWebSocket } from '@/utils/websocket'
import { ElMessage } from 'element-plus'

interface Props {
  collapsed: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const { connect, disconnect } = useWebSocket()

const currentTime = ref(dayjs().format('YYYY-MM-DD HH:mm'))
const userDropdownVisible = ref(false)
const notificationVisible = ref(false)
const activeTab = ref('all')

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
  '/settings': '系统设置',
  '/user-management': '用户管理'
}

const currentBreadcrumb = breadcrumbMap[route.path] || '首页'

const notificationTabs = [
  { label: '全部', value: 'all' },
  { label: '异常预警', value: 'exception' },
  { label: '政策更新', value: 'policy' },
  { label: '审核通知', value: 'review' },
  { label: '系统消息', value: 'system' }
]

const filteredMessages = computed(() => {
  if (activeTab.value === 'all') return notificationStore.messages
  return notificationStore.messages.filter(m => m.type === activeTab.value)
})

function handleNotificationClick(msg: any) {
  notificationStore.markAsRead(msg.id)
  if (msg.link) {
    router.push(msg.link)
  }
  notificationVisible.value = false
}

function markAllRead() {
  notificationStore.markAllAsRead()
  ElMessage.success('已全部标记为已读')
}

function clearAll() {
  notificationStore.clearMessages()
  ElMessage.success('已清空所有消息')
}

function getTypeIcon(type: string) {
  const iconMap: Record<string, string> = {
    exception: '🔴',
    policy: '📢',
    review: '✅',
    system: '🔔'
  }
  return iconMap[type] || '📬'
}

function getTypeColor(type: string) {
  const colorMap: Record<string, string> = {
    exception: '#f56c6c',
    policy: '#409eff',
    review: '#67c23a',
    system: '#909399'
  }
  return colorMap[type] || '#909399'
}

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
})
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

      <el-popover
        v-model:visible="notificationVisible"
        placement="bottom-end"
        trigger="click"
        :width="380"
        popper-class="notification-popover"
      >
        <template #reference>
          <div class="notification-icon-wrapper">
            <el-badge :value="notificationStore.unreadCount" :hidden="notificationStore.unreadCount === 0" class="notification-badge">
              <el-button :icon="Bell" text circle size="large" />
            </el-badge>
          </div>
        </template>

        <div class="notification-panel">
          <div class="notification-header">
            <span class="notification-title">消息中心</span>
            <div class="notification-actions">
              <el-button text size="small" @click="markAllRead">全部已读</el-button>
              <el-button text size="small" @click="clearAll">清空</el-button>
            </div>
          </div>

          <el-tabs v-model="activeTab" class="notification-tabs" size="small">
            <el-tab-pane v-for="tab in notificationTabs" :key="tab.value" :label="tab.label" :name="tab.value" />
          </el-tabs>

          <div class="notification-list">
            <div v-if="filteredMessages.length === 0" class="notification-empty">
              <el-empty description="暂无消息" :image-size="60" />
            </div>
            <div
              v-for="msg in filteredMessages"
              :key="msg.id"
              class="notification-item"
              :class="{ unread: !msg.read }"
              @click="handleNotificationClick(msg)"
            >
              <div class="msg-icon" :style="{ color: getTypeColor(msg.type) }">
                {{ getTypeIcon(msg.type) }}
              </div>
              <div class="msg-content">
                <div class="msg-title">{{ msg.title }}</div>
                <div class="msg-desc">{{ msg.content }}</div>
                <div class="msg-time">{{ msg.time }}</div>
              </div>
              <div class="msg-actions">
                <el-icon v-if="!msg.read" class="unread-dot" />
                <el-button
                  v-if="msg.link"
                  text
                  size="small"
                  @click.stop="handleNotificationClick(msg)"
                >
                  <el-icon><View /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-popover>

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

.notification-icon-wrapper {
  cursor: pointer;
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

<style lang="scss">
.notification-popover {
  padding: 0 !important;

  .notification-panel {
    display: flex;
    flex-direction: column;
    max-height: 480px;
  }

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid $border-light;

    .notification-title {
      font-weight: 600;
      font-size: 14px;
      color: $text-primary;
    }

    .notification-actions {
      display: flex;
      gap: 8px;
    }
  }

  .notification-tabs {
    padding: 0 16px;

    :deep(.el-tabs__header) {
      margin-bottom: 8px;
    }

    :deep(.el-tabs__item) {
      font-size: 12px;
      height: 32px;
    }
  }

  .notification-list {
    max-height: 360px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 16px;
    cursor: pointer;
    transition: background-color 0.2s;
    border-bottom: 1px solid #f5f5f5;

    &:hover {
      background-color: #f5f7fa;
    }

    &.unread {
      background-color: #f0f9ff;
    }

    .msg-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .msg-content {
      flex: 1;
      min-width: 0;

      .msg-title {
        font-size: 13px;
        font-weight: 500;
        color: $text-primary;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .msg-desc {
        font-size: 12px;
        color: $text-regular;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .msg-time {
        font-size: 11px;
        color: $text-secondary;
        margin-top: 6px;
      }
    }

    .msg-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      .unread-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: $primary-color;
      }
    }
  }

  .notification-empty {
    padding: 40px 0;
  }
}
</style>
