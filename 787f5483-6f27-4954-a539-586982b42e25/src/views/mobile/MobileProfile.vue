<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const menuItems = [
  { icon: 'Setting', title: '账号设置', path: '/profile' },
  { icon: 'Folder', title: '我的素材', path: '/materials' },
  { icon: 'EditPen', title: '我的选题', path: '/topics' },
  { icon: 'DataLine', title: '工作量统计', path: '/statistics' },
  { icon: 'HelpFilled', title: '帮助与反馈' },
  { icon: 'InfoFilled', title: '关于系统' }
]

const quickStats = [
  { label: '我的选题', value: 28 },
  { label: '上传素材', value: 156 },
  { label: '审核通过', value: 45 },
  { label: '制作节目', value: 12 }
]

function handleMenuClick(item: any) {
  if (item.path) {
    router.push(item.path)
  } else {
    ElMessage.info(`${item.title}功能开发中`)
  }
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录吗？', '确认退出', {
      type: 'warning'
    })
    userStore.logout()
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="mobile-profile">
    <div class="profile-header">
      <div class="user-avatar">
        <el-avatar :size="72" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
        <div class="edit-icon">
          <el-icon :size="14"><Edit /></el-icon>
        </div>
      </div>
      
      <div class="user-info">
        <h2 class="user-name">{{ userStore.userInfo?.name }}</h2>
        <p class="user-department">{{ userStore.userInfo?.department }}</p>
        <p class="user-role">{{ userStore.userInfo?.role === 'admin' ? '系统管理员' : '记者' }}</p>
      </div>
    </div>
    
    <div class="stats-section">
      <div
        v-for="stat in quickStats"
        :key="stat.label"
        class="stat-item"
      >
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
    
    <div class="menu-section">
      <div
        v-for="item in menuItems"
        :key="item.title"
        class="menu-item"
        @click="handleMenuClick(item)"
      >
        <div class="menu-left">
          <el-icon :size="20" color="#8b949e">
            <component :is="item.icon" />
          </el-icon>
          <span class="menu-title">{{ item.title }}</span>
        </div>
        <el-icon :size="16" color="#484f58"><ArrowRight /></el-icon>
      </div>
    </div>
    
    <div class="logout-section">
      <el-button type="danger" style="width: 100%" @click="handleLogout">
        <el-icon><SwitchButton /></el-icon>退出登录
      </el-button>
    </div>
    
    <div class="app-info">
      <p>媒体内容生产管理系统 v1.0.0</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mobile-profile {
  padding-bottom: 20px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin-bottom: 20px;
}

.user-avatar {
  position: relative;
  margin-bottom: 16px;
}

.edit-icon {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: var(--primary-color);
  border: 2px solid #fff;
  border-radius: 50%;
  color: #fff;
}

.user-info {
  text-align: center;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 4px;
}

.user-department {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 2px;
}

.user-role {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 16px;
  margin: 0 16px 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
}

.stat-item {
  text-align: center;
  
  &:not(:last-child) {
    border-right: 1px solid var(--border-color-light);
  }
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}

.stat-label {
  font-size: 11px;
  color: var(--text-color-tertiary);
  margin-top: 4px;
}

.menu-section {
  margin: 0 16px;
  background-color: var(--bg-color-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color-light);
  
  &:last-child {
    border-bottom: none;
  }
  
  &:active {
    background-color: var(--bg-color-tertiary);
  }
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-title {
  font-size: 14px;
  color: var(--text-color-primary);
}

.logout-section {
  padding: 24px 16px;
}

.app-info {
  text-align: center;
  padding: 16px;
  
  p {
    font-size: 11px;
    color: var(--text-color-tertiary);
    margin: 0;
  }
}
</style>
