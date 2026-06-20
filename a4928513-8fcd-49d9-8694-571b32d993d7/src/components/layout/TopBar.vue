<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
}>()

const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const currentTime = ref('')
const searchKeyword = ref('')
const timer = ref<number | null>(null)

const breadcrumb = computed(() => appStore.breadcrumb)
const userInfo = computed(() => authStore.userInfo)
const userInitial = computed(() => userInfo.value?.name?.charAt(0) || 'U')

function updateTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[now.getDay()]
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${year}-${month}-${day} ${weekDay} ${hours}:${minutes}:${seconds}`
}

function handleToggleSidebar() {
  emit('toggle-sidebar')
}

function handleSearch() {
  if (!searchKeyword.value.trim()) {
    ElMessage.info('请输入搜索关键词')
    return
  }
  ElMessage.info(`搜索: ${searchKeyword.value}`)
}

function handleProfile() {
  ElMessage.info('个人信息')
}

function handleSwitchRole() {
  ElMessage.info('切换角色')
}

async function handleLogout() {
  authStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}

onMounted(() => {
  updateTime()
  timer.value = window.setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value)
  }
})
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="toggle-btn" @click="handleToggleSidebar">
        <el-icon :size="20"><Fold v-if="!appStore.sidebarCollapsed" /><Expand v-else /></el-icon>
      </button>

      <el-breadcrumb separator="/" class="breadcrumb">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumb"
          :key="index"
          :to="item.path ? { path: item.path } : undefined"
        >
          <span :class="{ 'is-link': !!item.path }">{{ item.title }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="topbar-right">
      <div class="current-time">
        <el-icon><Clock /></el-icon>
        <span>{{ currentTime }}</span>
      </div>

      <div class="search-box">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索..."
          size="default"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-popover
        placement="bottom-end"
        :width="320"
        trigger="click"
        popper-class="notification-popover"
      >
        <template #reference>
          <button class="icon-btn notification-btn">
            <el-badge :value="5" :hidden="false" class="notification-badge">
              <el-icon :size="20"><Bell /></el-icon>
            </el-badge>
          </button>
        </template>
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-title">通知消息</span>
            <span class="notification-clear">全部已读</span>
          </div>
          <div class="notification-list">
            <div class="notification-item">
              <div class="notif-dot"></div>
              <div class="notif-content">
                <div class="notif-text">遗体登记 #R2024001 已提交审核</div>
                <div class="notif-time">5分钟前</div>
              </div>
            </div>
            <div class="notification-item">
              <div class="notif-dot"></div>
              <div class="notif-content">
                <div class="notif-text">告别厅 A101 明天上午预约提醒</div>
                <div class="notif-time">30分钟前</div>
              </div>
            </div>
            <div class="notification-item">
              <div class="notif-dot"></div>
              <div class="notif-content">
                <div class="notif-text">车辆调度任务已分配</div>
                <div class="notif-time">1小时前</div>
              </div>
            </div>
          </div>
        </div>
      </el-popover>

      <el-dropdown trigger="click" @command="(cmd: string) => {
        if (cmd === 'profile') handleProfile()
        else if (cmd === 'switch') handleSwitchRole()
        else if (cmd === 'logout') handleLogout()
      }">
        <button class="user-dropdown">
          <div class="user-avatar-sm">{{ userInitial }}</div>
          <div class="user-info-sm">
            <span class="user-name-sm">{{ userInfo?.name || '用户' }}</span>
            <span class="user-role-sm">{{ userInfo?.department || '' }}</span>
          </div>
          <el-icon><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu class="user-menu">
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>
              个人信息
            </el-dropdown-item>
            <el-dropdown-item command="switch">
              <el-icon><Switch /></el-icon>
              切换角色
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.topbar {
  height: 60px;
  background: #24242B;
  border-bottom: 1px solid #3A3A44;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  z-index: 100;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.toggle-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #B0B0B8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(201, 168, 108, 0.1);
    color: #C9A86C;
  }
}

.breadcrumb {
  min-width: 0;
  overflow: hidden;

  :deep(.el-breadcrumb__inner) {
    color: #6B6B74;

    &.is-link {
      color: #B0B0B8;
      cursor: pointer;

      &:hover {
        color: #C9A86C;
      }
    }
  }

  :deep(.el-breadcrumb__separator) {
    color: #3A3A44;
    margin: 0 8px;
  }
}

.is-link {
  cursor: pointer;
  color: #B0B0B8;

  &:hover {
    color: #C9A86C;
  }
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.current-time {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #B0B0B8;
  font-size: 13px;
  padding: 6px 12px;
  background: #1A1A1F;
  border-radius: 6px;
  border: 1px solid #3A3A44;

  .el-icon {
    color: #C9A86C;
  }
}

.search-box {
  width: 220px;

  :deep(.el-input__wrapper) {
    background: #1A1A1F;
    border: 1px solid #3A3A44;
    box-shadow: none;
    border-radius: 6px;

    &:hover {
      border-color: #8B7355;
    }

    &.is-focus {
      border-color: #C9A86C;
      box-shadow: 0 0 0 2px rgba(201, 168, 108, 0.15);
    }
  }

  :deep(.el-input__inner) {
    color: #FFFFFF;
    font-size: 13px;

    &::placeholder {
      color: #6B6B74;
    }
  }

  :deep(.el-input__prefix-inner) {
    color: #6B6B74;
  }
}

.icon-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #B0B0B8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    background: rgba(201, 168, 108, 0.1);
    color: #C9A86C;
  }
}

.notification-badge {
  :deep(.el-badge__content) {
    background: #FF4D4F;
    border: none;
    font-size: 10px;
  }
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(201, 168, 108, 0.1);
  }
}

.user-avatar-sm {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1A1A1F;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.user-info-sm {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
  text-align: left;
  min-width: 0;
  max-width: 140px;

  .user-name-sm {
    font-size: 13px;
    color: #FFFFFF;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-role-sm {
    font-size: 11px;
    color: #6B6B74;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.user-dropdown .el-icon {
  color: #6B6B74;
  font-size: 12px;
}

:global(.notification-popover) {
  background: #2E2E36 !important;
  border: 1px solid #3A3A44 !important;
  padding: 0 !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;

  .el-popper__arrow::before {
    background: #2E2E36 !important;
    border-color: #3A3A44 !important;
  }
}

:global(.user-menu) {
  background: #2E2E36 !important;
  border: 1px solid #3A3A44 !important;
  padding: 4px !important;
  border-radius: 8px !important;
  min-width: 160px !important;

  .el-dropdown-menu__item {
    color: #B0B0B8 !important;
    border-radius: 6px !important;
    padding: 10px 12px !important;
    font-size: 13px !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;

    &:hover {
      background: rgba(201, 168, 108, 0.1) !important;
      color: #C9A86C !important;
    }

    .el-icon {
      font-size: 15px;
    }
  }

  .el-dropdown-menu__item--divided {
    border-top: 1px solid #3A3A44 !important;
    margin: 4px 0 !important;
    padding-top: 10px !important;
  }
}
</style>

<style lang="scss">
.notification-content {
  background: #2E2E36;

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #3A3A44;

    .notification-title {
      font-size: 14px;
      font-weight: 600;
      color: #FFFFFF;
    }

    .notification-clear {
      font-size: 12px;
      color: #C9A86C;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .notification-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: #3A3A44;
      border-radius: 2px;
    }
  }

  .notification-item {
    display: flex;
    gap: 10px;
    padding: 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(201, 168, 108, 0.08);
    }

    .notif-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #C9A86C;
      margin-top: 6px;
      flex-shrink: 0;
    }

    .notif-content {
      flex: 1;
      min-width: 0;

      .notif-text {
        font-size: 13px;
        color: #B0B0B8;
        line-height: 1.5;
      }

      .notif-time {
        font-size: 11px;
        color: #6B6B74;
        margin-top: 4px;
      }
    }
  }
}
</style>
