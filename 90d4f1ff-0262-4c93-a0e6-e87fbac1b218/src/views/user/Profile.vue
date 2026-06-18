<template>
  <div class="page-container">
    <div class="content-row">
      <div class="card profile-card">
        <el-avatar :size="96" :src="authStore.user?.avatar">
          {{ authStore.user?.nickname?.charAt(0) || 'U' }}
        </el-avatar>
        <h2 class="username">{{ authStore.user?.nickname }}</h2>
        <el-tag :type="roleTagType(authStore.user?.role || 'CarOwner')" effect="light">
          {{ roleLabel(authStore.user?.role || 'CarOwner') }}
        </el-tag>
        <div class="member-info" v-if="authStore.user?.memberLevel">
          <el-tag type="warning" effect="dark">
              <el-icon><Star /></el-icon>
              会员 Lv.{{ authStore.user.memberLevel }}
            </el-tag>
        </div>
      </div>

      <div class="info-section">
        <div class="card">
          <div class="card-title">
            <el-icon><User /></el-icon>
            基本信息
          </div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="用户名">{{ authStore.user?.username }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ authStore.user?.nickname }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ authStore.user?.phone }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ authStore.user?.email }}</el-descriptions-item>
            <el-descriptions-item label="账户余额" :span="2">
              <span style="color: #f56c6c; font-size: 18px; font-weight: 700;">
                ¥{{ (authStore.user?.balance || 0).toFixed(2) }}
              </span>
              <el-button type="primary" size="small" style="margin-left: 12px;">
                <el-icon><Wallet /></el-icon>充值
              </el-button>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="card mt-4">
          <div class="card-title">
            <el-icon><Lock /></el-icon>
            安全设置
          </div>
          <el-form label-width="100px" style="max-width: 480px; margin-top: 12px;">
            <el-form-item label="修改密码">
              <el-button type="primary" plain>去修改</el-button>
            </el-form-item>
            <el-form-item label="绑定手机">
              <span>{{ authStore.user?.phone }}</span>
              <el-button type="primary" link style="margin-left: 12px;">更换</el-button>
            </el-form-item>
            <el-form-item label="绑定邮箱">
              <span>{{ authStore.user?.email }}</span>
              <el-button type="primary" link style="margin-left: 12px;">更换</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { User, Lock, Star, Wallet } from '@element-plus/icons-vue'
import type { UserRole } from '@/types'

const authStore = useAuthStore()

const roleLabel = (r: UserRole) => ({
  SuperAdmin: '超级管理员', ParkOperator: '园区运营', ParkingAdmin: '停车场管理员',
  ChargingOps: '充电桩运维', CarOwner: '车主'
}[r] || r)

const roleTagType = (r: UserRole) => ({
  SuperAdmin: 'danger', ParkOperator: 'warning', ParkingAdmin: 'primary',
  ChargingOps: 'success', CarOwner: 'info'
}[r] || 'info') as 'danger' | 'warning' | 'primary' | 'success' | 'info'
</script>

<style lang="scss" scoped>
.content-row {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.mt-4 { margin-top: 16px; }

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  gap: 12px;

  :deep(.el-avatar) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-size: 36px;
    font-weight: 600;
  }

  .username {
    margin: 0;
    font-size: 20px;
    color: #303133;
  }

  .member-info {
    margin-top: 8px;
  }
}
</style>
