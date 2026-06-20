<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { formatRelativeTime } from '@/utils'

const notifications = ref([
  { id: 1, type: 'review', title: '选题审核通知', content: '您提交的选题《城市轨道交通建设进展》已通过审核', time: new Date(Date.now() - 3600000).toISOString(), read: false, relatedId: 1 },
  { id: 2, type: 'task', title: '新任务分配', content: '您被分配到任务：采集春节特别报道素材', time: new Date(Date.now() - 7200000).toISOString(), read: false, relatedId: 2 },
  { id: 3, type: 'system', title: '版权到期提醒', content: '《城市宣传片素材包》将在7天后到期，请及时处理', time: new Date(Date.now() - 86400000).toISOString(), read: false, relatedId: 3 },
  { id: 4, type: 'review', title: '审核退回通知', content: '您提交的素材video_001.mp4审核未通过，请重新上传', time: new Date(Date.now() - 172800000).toISOString(), read: true, relatedId: 4 },
  { id: 5, type: 'schedule', title: '节目排期更新', content: '《都市前沿》播出时间调整为20:00播出', time: new Date(Date.now() - 259200000).toISOString(), read: true, relatedId: 5 }
])

const filterType = ref('all')

const filterOptions = [
  { value: 'all', label: '全部' },
  { value: 'review', label: '审核' },
  { value: 'task', label: '任务' },
  { value: 'system', label: '系统' }
]

const typeIcon: Record<string, string> = {
  review: 'CircleCheck',
  task: 'List',
  system: 'Bell',
  schedule: 'Calendar'
}

const typeColor: Record<string, string> = {
  review: '#67c23a',
  task: '#409eff',
  system: '#e6a23c',
  schedule: '#909399'
}

const filteredNotifications = ref('all')

function handleNotificationClick(notification: any) {
  notification.read = true
  ElMessage.info(`查看详情: ${notification.title}`)
}

function markAllRead() {
  notifications.value.forEach(n => n.read = true)
  ElMessage.success('已全部标记为已读')
}

function clearAll() {
  notifications.value = []
  ElMessage.success('已清空所有通知')
}
</script>

<template>
  <div class="mobile-notifications">
    <div class="filter-bar">
      <div class="filter-tabs">
        <span
          v-for="option in filterOptions"
          :key="option.value"
          class="filter-tab"
          :class="{ active: filterType === option.value }"
          @click="filterType = option.value"
        >
          {{ option.label }}
        </span>
      </div>
      
      <el-dropdown>
        <el-button type="primary" link>
          管理<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="markAllRead">
              <el-icon><Read /></el-icon>全部已读
            </el-dropdown-item>
            <el-dropdown-item @click="clearAll">
              <el-icon><Delete /></el-icon>清空通知
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    
    <div class="notification-list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item"
        :class="{ unread: !notification.read }"
        @click="handleNotificationClick(notification)"
      >
        <div
          class="notification-icon"
          :style="{ backgroundColor: typeColor[notification.type] + '20', color: typeColor[notification.type] }"
        >
          <el-icon :size="20">
            <component :is="typeIcon[notification.type]" />
          </el-icon>
        </div>
        
        <div class="notification-content">
          <div class="notification-header">
            <span class="notification-title">{{ notification.title }}</span>
            <span class="notification-time">{{ formatRelativeTime(notification.time) }}</span>
          </div>
          <p class="notification-text">{{ notification.content }}</p>
        </div>
        
        <div v-if="!notification.read" class="unread-dot"></div>
      </div>
      
      <el-empty v-if="notifications.length === 0" description="暂无通知" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-notifications {
  padding-bottom: 20px;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  background-color: var(--bg-color);
  z-index: 10;
  padding-top: 12px;
}

.filter-tabs {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filter-tab {
  font-size: 14px;
  color: var(--text-color-secondary);
  padding-bottom: 8px;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    font-weight: 500;
  }
}

.notification-list {
  padding: 0 16px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color-light);
  position: relative;
  
  &.unread {
    background-color: rgba(64, 158, 255, 0.02);
  }
  
  &:active {
    opacity: 0.7;
  }
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.notification-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
}

.notification-time {
  font-size: 11px;
  color: var(--text-color-tertiary);
  flex-shrink: 0;
  margin-left: 8px;
}

.notification-text {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.5;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.unread-dot {
  position: absolute;
  top: 18px;
  right: 0;
  width: 8px;
  height: 8px;
  background-color: var(--danger-color);
  border-radius: 50%;
}
</style>
