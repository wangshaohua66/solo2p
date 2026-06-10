<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const authStore = useAuthStore()

const activeTab = ref('profile')

const getTierLabel = (tier?: string) => {
  const map: Record<string, string> = {
    experience: '体验卡',
    monthly: '月卡',
    quarterly: '季卡',
    yearly: '年卡'
  }
  return map[tier || 'experience'] || '体验卡'
}

const getTierColor = (tier?: string) => {
  const map: Record<string, string> = {
    experience: '#909399',
    monthly: '#409eff',
    quarterly: '#67c23a',
    yearly: '#e6a23c'
  }
  return map[tier || 'experience'] || '#909399'
}

const handleSaveProfile = () => {
  ElMessage.success('个人信息已保存')
}

const handleChangePassword = () => {
  ElMessage.info('修改密码功能开发中...')
}

onMounted(() => {
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-header">
      <div class="user-info">
        <el-avatar :size="80">{{ authStore.user?.username?.charAt(0) || 'U' }}</el-avatar>
        <div class="info">
          <h2 class="username">{{ authStore.user?.username }}</h2>
          <div class="user-tags">
            <el-tag 
              size="large"
              :style="{ 
                backgroundColor: getTierColor(authStore.user?.memberTier) + '20', 
                color: getTierColor(authStore.user?.memberTier),
                border: 'none' 
              }"
            >
              {{ getTierLabel(authStore.user?.memberTier) }}
            </el-tag>
            <el-tag size="large" type="info" effect="plain">
              {{ authStore.user?.role === 'admin' ? '管理员' : authStore.user?.role === 'instructor' ? '陶艺师' : '会员' }}
            </el-tag>
          </div>
        </div>
      </div>
      
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">{{ authStore.user?.points || 0 }}</div>
          <div class="stat-label">积分</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">¥{{ authStore.user?.totalSpent?.toLocaleString() || 0 }}</div>
          <div class="stat-label">累计消费</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ authStore.user?.memberExpireDate || '无' }}</div>
          <div class="stat-label">会员到期</div>
        </div>
      </div>
    </div>

    <div class="profile-content">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="个人资料" name="profile">
          <div class="tab-panel">
            <el-form label-width="100px" class="profile-form">
              <el-form-item label="用户名">
                <el-input :value="authStore.user?.username" disabled />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input :value="authStore.user?.email" placeholder="未设置" />
              </el-form-item>
              <el-form-item label="手机号">
                <el-input :value="authStore.user?.phone" placeholder="未设置" />
              </el-form-item>
              <el-form-item label="会员等级">
                <el-tag 
                  :style="{ 
                    backgroundColor: getTierColor(authStore.user?.memberTier) + '20', 
                    color: getTierColor(authStore.user?.memberTier),
                    border: 'none' 
                  }"
                >
                  {{ getTierLabel(authStore.user?.memberTier) }}
                </el-tag>
                <el-button link type="primary" style="margin-left: 12px;">
                  升级会员
                </el-button>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleSaveProfile">保存修改</el-button>
                <el-button @click="handleChangePassword">修改密码</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="我的作品" name="pieces">
          <div class="tab-panel">
            <el-empty description="作品列表功能开发中..." />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="我的课程" name="courses">
          <div class="tab-panel">
            <el-empty description="课程列表功能开发中..." />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="我的预约" name="bookings">
          <div class="tab-panel">
            <el-empty description="预约列表功能开发中..." />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="积分记录" name="points">
          <div class="tab-panel">
            <el-empty description="积分记录功能开发中..." />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="消息通知" name="notifications">
          <div class="tab-panel">
            <el-empty description="暂无消息" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: white;
  border-radius: $border-radius-lg;
  box-shadow: $shadow-sm;
  flex-wrap: wrap;
  gap: 20px;

  @media (max-width: $breakpoint-mobile) {
    flex-direction: column;
    align-items: stretch;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.username {
  font-size: 22px;
  font-weight: 700;
  color: $color-text-primary;
  margin: 0;
}

.user-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats {
  display: flex;
  gap: 32px;

  @media (max-width: $breakpoint-mobile) {
    justify-content: space-around;
  }
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: $color-text-primary;
}

.stat-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.profile-content {
  background: white;
  border-radius: $border-radius-md;
  padding: 0 20px 20px;
  box-shadow: $shadow-sm;

  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.tab-panel {
  padding-top: 10px;
}

.profile-form {
  max-width: 500px;
}
</style>
