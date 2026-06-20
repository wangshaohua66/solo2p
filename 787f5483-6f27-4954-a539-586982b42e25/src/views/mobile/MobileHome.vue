<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils'

const router = useRouter()
const userStore = useUserStore()

const quickStats = ref([
  { label: '待处理任务', value: 5, type: 'warning' },
  { label: '今日选题', value: 3, type: 'primary' },
  { label: '待审核', value: 2, type: 'danger' },
  { label: '已完成', value: 8, type: 'success' }
])

const recentTasks = ref([
  { id: 1, title: '采集新闻素材', status: 'in_progress', deadline: '2024-01-15 18:00' },
  { id: 2, title: '撰写专题脚本', status: 'pending', deadline: '2024-01-16 12:00' },
  { id: 3, title: '审核节目成片', status: 'pending', deadline: '2024-01-15 20:00' },
  { id: 4, title: '剪辑采访视频', status: 'completed', deadline: '2024-01-14 18:00' }
])

const statusMap: Record<string, { text: string; class: string }> = {
  pending: { text: '待处理', class: 'tag--info' },
  in_progress: { text: '进行中', class: 'tag--warning' },
  completed: { text: '已完成', class: 'tag--success' }
}

function handleNavigate(path: string) {
  router.push(path)
}

onMounted(() => {
  // 检查登录状态
  if (!userStore.isLoggedIn) {
    router.push('/login')
  }
})
</script>

<template>
  <div class="mobile-home">
    <div class="welcome-section">
      <div class="welcome-header">
        <div class="user-info">
          <el-avatar :size="48" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
          <div class="user-text">
            <h3>{{ userStore.userInfo?.name }}</h3>
            <p>{{ formatDate(new Date(), 'MM月DD日 dddd') }}</p>
          </div>
        </div>
        <el-badge :value="3" class="notification-badge">
          <el-icon :size="24" color="#8b949e"><Bell /></el-icon>
        </el-badge>
      </div>
      
      <div class="search-bar" @click="handleNavigate('/materials')">
        <el-icon><Search /></el-icon>
        <span>搜索素材、选题...</span>
      </div>
    </div>
    
    <div class="quick-stats">
      <div
        v-for="stat in quickStats"
        :key="stat.label"
        class="stat-item"
        :class="stat.type"
      >
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
    
    <div class="quick-actions">
      <div class="section-title">快捷操作</div>
      <div class="action-grid">
        <div class="action-item" @click="handleNavigate('/topics?action=create')">
          <div class="action-icon icon-blue">
            <el-icon :size="28"><EditPen /></el-icon>
          </div>
          <span>新建选题</span>
        </div>
        <div class="action-item" @click="handleNavigate('/mobile/upload')">
          <div class="action-icon icon-green">
            <el-icon :size="28"><Upload /></el-icon>
          </div>
          <span>上传素材</span>
        </div>
        <div class="action-item" @click="handleNavigate('/workflow')">
          <div class="action-icon icon-orange">
            <el-icon :size="28"><CircleCheck /></el-icon>
          </div>
          <span>审核处理</span>
        </div>
        <div class="action-item" @click="handleNavigate('/schedule')">
          <div class="action-icon icon-purple">
            <el-icon :size="28"><Calendar /></el-icon>
          </div>
          <span>查看排期</span>
        </div>
      </div>
    </div>
    
    <div class="recent-tasks">
      <div class="section-header">
        <span class="section-title">最近任务</span>
        <el-button type="primary" link @click="handleNavigate('/mobile/tasks')">
          查看全部
        </el-button>
      </div>
      
      <div class="task-list">
        <div
          v-for="task in recentTasks"
          :key="task.id"
          class="task-item"
        >
          <div class="task-info">
            <div class="task-title">{{ task.title }}</div>
            <div class="task-meta">
              <el-icon><Timer /></el-icon>
              <span>截止：{{ task.deadline }}</span>
            </div>
          </div>
          <span class="tag" :class="statusMap[task.status].class">
            {{ statusMap[task.status].text }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-home {
  padding: 16px;
  padding-bottom: 20px;
}

.welcome-section {
  margin-bottom: 20px;
}

.welcome-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-text {
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin: 0 0 2px;
  }
  
  p {
    font-size: 12px;
    color: var(--text-color-tertiary);
    margin: 0;
  }
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  color: var(--text-color-tertiary);
  font-size: 14px;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  padding: 16px;
  background-color: var(--bg-color-card);
  border-radius: var(--border-radius-md);
  border-left: 3px solid var(--primary-color);
  
  &.warning {
    border-left-color: var(--warning-color);
    
    .stat-value {
      color: var(--warning-color);
    }
  }
  
  &.success {
    border-left-color: var(--success-color);
    
    .stat-value {
      color: var(--success-color);
    }
  }
  
  &.danger {
    border-left-color: var(--danger-color);
    
    .stat-value {
      color: var(--danger-color);
    }
  }
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-color);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-primary);
  margin-bottom: 12px;
}

.quick-actions {
  margin-bottom: 20px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background-color: var(--bg-color-card);
  border-radius: var(--border-radius-md);
  font-size: 12px;
  color: var(--text-color-secondary);
  
  &:active {
    transform: scale(0.95);
  }
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  color: #fff;
  
  &.icon-blue {
    background: linear-gradient(135deg, #667eea 0%, #409eff 100%);
  }
  
  &.icon-green {
    background: linear-gradient(135deg, #43e97b 0%, #67c23a 100%);
  }
  
  &.icon-orange {
    background: linear-gradient(135deg, #f093fb 0%, #e6a23c 100%);
  }
  
  &.icon-purple {
    background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 6px;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-tertiary);
}
</style>
