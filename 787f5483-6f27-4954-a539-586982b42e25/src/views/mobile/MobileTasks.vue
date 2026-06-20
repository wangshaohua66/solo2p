<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('all')

const tabs = [
  { name: 'all', label: '全部' },
  { name: 'pending', label: '待处理' },
  { name: 'in_progress', label: '进行中' },
  { name: 'completed', label: '已完成' }
]

const tasks = ref([
  { id: 1, title: '采访城市建设局相关负责人', type: '素材采集', status: 'in_progress', priority: 'high', deadline: '2024-01-15 18:00' },
  { id: 2, title: '撰写春节特别报道脚本', type: '脚本撰写', status: 'pending', priority: 'high', deadline: '2024-01-16 12:00' },
  { id: 3, title: '审核《都市前沿》第45期成片', type: '审核', status: 'pending', priority: 'medium', deadline: '2024-01-15 20:00' },
  { id: 4, title: '剪辑乡村振兴系列报道', type: '后期编辑', status: 'completed', priority: 'medium', deadline: '2024-01-14 18:00' },
  { id: 5, title: '拍摄工业园区专题素材', type: '素材采集', status: 'pending', priority: 'low', deadline: '2024-01-18 17:00' }
])

const statusMap: Record<string, { text: string; class: string }> = {
  pending: { text: '待处理', class: 'tag--info' },
  in_progress: { text: '进行中', class: 'tag--warning' },
  completed: { text: '已完成', class: 'tag--success' }
}

const priorityMap: Record<string, { text: string; color: string }> = {
  high: { text: '高', color: '#f56c6c' },
  medium: { text: '中', color: '#e6a23c' },
  low: { text: '低', color: '#909399' }
}

const filteredTasks = ref(tabs)

function handleStatusChange(task: any, status: string) {
  task.status = status
  ElMessage.success(`任务已更新为"${statusMap[status].text}"`)
}

function handleTaskClick(task: any) {
  ElMessage.info(`任务详情: ${task.title}`)
}
</script>

<template>
  <div class="mobile-tasks">
    <div class="tabs-wrapper">
      <el-tabs v-model="activeTab" class="task-tabs">
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>
    </div>
    
    <div class="task-list">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="task-card"
        @click="handleTaskClick(task)"
      >
        <div class="task-header">
          <span class="task-type">{{ task.type }}</span>
          <span 
            class="priority-badge"
            :style="{ backgroundColor: priorityMap[task.priority].color + '20', color: priorityMap[task.priority].color }"
          >
            {{ priorityMap[task.priority].text }}优先级
          </span>
        </div>
        
        <div class="task-title">{{ task.title }}</div>
        
        <div class="task-footer">
          <div class="deadline">
            <el-icon><Timer /></el-icon>
            <span>{{ task.deadline }}</span>
          </div>
          
          <el-dropdown
            v-if="task.status !== 'completed'"
            @command="(status) => handleStatusChange(task, status)"
          >
            <span class="tag" :class="statusMap[task.status].class">
              {{ statusMap[task.status].text }}
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pending">标记待处理</el-dropdown-item>
                <el-dropdown-item command="in_progress">标记进行中</el-dropdown-item>
                <el-dropdown-item command="completed">标记完成</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <span v-else class="tag" :class="statusMap[task.status].class">
            {{ statusMap[task.status].text }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-tasks {
  padding: 16px;
  padding-bottom: 20px;
}

.tabs-wrapper {
  margin: -16px -16px 16px;
  padding: 0 16px;
  background-color: var(--bg-color-card);
  border-bottom: 1px solid var(--border-color);
  
  :deep(.el-tabs__header) {
    margin: 0;
  }
  
  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  padding: 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  
  &:active {
    transform: scale(0.98);
  }
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.task-type {
  font-size: 11px;
  padding: 2px 8px;
  background-color: rgba(64, 158, 255, 0.1);
  color: var(--primary-color);
  border-radius: 4px;
}

.priority-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.task-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-primary);
  margin-bottom: 12px;
  line-height: 1.4;
}

.task-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deadline {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-tertiary);
}
</style>
