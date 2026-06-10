<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { User } from '@/types'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const activeTab = ref('info')
const member = ref<User | null>(null)

const mockMember: User = {
  id: 'm1',
  username: '张小明',
  email: 'zhangxiaoming@example.com',
  phone: '13800138001',
  avatar: '',
  role: 'member',
  memberTier: 'yearly',
  memberExpireDate: '2024-12-31',
  totalSpent: 5680,
  points: 1250,
  createdAt: '2023-06-15T00:00:00Z'
}

member.value = mockMember

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

const daysUntilExpire = () => {
  if (!member.value?.memberExpireDate) return 0
  return dayjs(member.value.memberExpireDate).diff(dayjs(), 'day')
}

const handleBack = () => {
  router.push('/members')
}

const handleEdit = () => {
  ElMessage.info('编辑会员信息功能开发中...')
}

const handleUpgrade = () => {
  ElMessage.info('会员升级功能开发中...')
}

onMounted(() => {
  const id = route.params.id as string
  console.log('Loading member:', id)
})
</script>

<template>
  <div class="member-detail-page" v-if="member">
    <div class="page-header">
      <el-button :icon="ArrowLeft" text @click="handleBack">
        返回会员列表
      </el-button>
      <div class="header-actions">
        <el-button @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑资料
        </el-button>
        <el-button type="primary" @click="handleUpgrade">
          <el-icon><Crown /></el-icon>
          升级会员
        </el-button>
      </div>
    </div>

    <div class="member-profile-card">
      <div class="profile-left">
        <el-avatar :size="80">{{ member.username?.charAt(0) }}</el-avatar>
        <div class="profile-info">
          <h2 class="member-name">{{ member.username }}</h2>
          <div class="member-tags">
            <el-tag 
              size="large"
              :style="{ 
                backgroundColor: getTierColor(member.memberTier) + '20', 
                color: getTierColor(member.memberTier),
                border: 'none' 
              }"
            >
              {{ getTierLabel(member.memberTier) }}
            </el-tag>
            <el-tag 
              v-if="daysUntilExpire() <= 14 && daysUntilExpire() > 0"
              size="large"
              type="danger"
              effect="plain"
            >
              还有 {{ daysUntilExpire() }} 天到期
            </el-tag>
            <el-tag 
              v-else-if="daysUntilExpire() <= 0"
              size="large"
              type="info"
              effect="plain"
            >
              已过期
            </el-tag>
          </div>
        </div>
      </div>
      
      <div class="profile-stats">
        <div class="stat-item">
          <div class="stat-value">¥{{ member.totalSpent?.toLocaleString() }}</div>
          <div class="stat-label">累计消费</div>
        </div>
        <div class="stat-item">
          <div class="stat-value points">{{ member.points }}</div>
          <div class="stat-label">积分余额</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ member.memberExpireDate || '无' }}</div>
          <div class="stat-label">到期时间</div>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="基本信息" name="info">
        <div class="tab-content">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">邮箱</span>
              <span class="info-value">{{ member.email }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">手机号</span>
              <span class="info-value">{{ member.phone }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">注册时间</span>
              <span class="info-value">{{ dayjs(member.createdAt).format('YYYY-MM-DD') }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">会员等级</span>
              <span class="info-value">{{ getTierLabel(member.memberTier) }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="我的作品" name="pieces">
        <div class="tab-content">
          <el-empty description="作品列表功能开发中..." />
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="课程记录" name="courses">
        <div class="tab-content">
          <el-empty description="课程记录功能开发中..." />
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="消费记录" name="orders">
        <div class="tab-content">
          <el-empty description="消费记录功能开发中..." />
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="积分明细" name="points">
        <div class="tab-content">
          <el-empty description="积分明细功能开发中..." />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.member-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.member-profile-card {
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

.profile-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-name {
  font-size: 22px;
  font-weight: 700;
  color: $color-text-primary;
  margin: 0;
}

.member-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.profile-stats {
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

  &.points {
    color: $color-warning;
  }
}

.stat-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.detail-tabs {
  background: white;
  border-radius: $border-radius-md;
  padding: 0 20px;
  box-shadow: $shadow-sm;

  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.tab-content {
  padding: 10px 0 20px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 13px;
  color: $color-text-placeholder;
}

.info-value {
  font-size: 15px;
  color: $color-text-primary;
}
</style>
