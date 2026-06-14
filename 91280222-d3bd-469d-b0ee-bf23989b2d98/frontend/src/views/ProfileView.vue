<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'

const authStore = useAuthStore()
const themeStore = useThemeStore()

const activeTab = ref('profile')

const roleLabels: Record<string, string> = {
  project_manager: '项目经理',
  designer: '设计师',
  reviewer: '审阅者'
}
</script>

<template>
  <div class="profile-view">
    <div class="profile-container">
      <div class="profile-header">
        <el-avatar :size="80" :src="authStore.user?.avatar">
          {{ authStore.user?.name?.[0] }}
        </el-avatar>
        <div class="user-info">
          <h2 class="user-name">{{ authStore.user?.name }}</h2>
          <p class="user-email">{{ authStore.user?.email }}</p>
          <el-tag size="large" :type="{ project_manager: 'danger', designer: 'primary', reviewer: 'success' }[authStore.user?.role || ''] as any">
            {{ roleLabels[authStore.user?.role || ''] }}
          </el-tag>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="个人信息" name="profile">
          <el-form label-width="100px" style="max-width: 500px">
            <el-form-item label="姓名">
              <el-input :model-value="authStore.user?.name" disabled />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input :model-value="authStore.user?.email" disabled />
            </el-form-item>
            <el-form-item label="部门">
              <el-input :model-value="authStore.user?.department || '-' " disabled />
            </el-form-item>
            <el-form-item label="角色">
              <el-tag>{{ roleLabels[authStore.user?.role || ''] }}</el-tag>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="偏好设置" name="preferences">
          <el-form label-width="140px" style="max-width: 500px">
            <el-form-item label="主题模式">
              <el-radio-group v-model="themeStore.mode">
                <el-radio-button value="light">
                  <el-icon style="margin-right:4px"><Sunny /></el-icon>
                  浅色模式
                </el-radio-button>
                <el-radio-button value="dark">
                  <el-icon style="margin-right:4px"><Moon /></el-icon>
                  深色模式
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="消息通知">
              <el-switch v-model="(() => true)()" />
            </el-form-item>
            <el-form-item label="邮件提醒">
              <el-switch v-model="(() => true)()" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="权限说明" name="permissions">
          <el-alert
            title="角色权限说明"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          />
          <el-descriptions :column="1" border>
            <el-descriptions-item label="项目经理">
              创建/编辑/删除项目、分配审阅任务、终审确认、管理成员权限、上传下载图纸
            </el-descriptions-item>
            <el-descriptions-item label="设计师">
              上传图纸、上传新版本、回复批注、下载图纸、查看审阅意见
            </el-descriptions-item>
            <el-descriptions-item label="审阅者">
              在线批注、标记问题、签署审批意见、下载图纸、查看批注历史
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-view {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  justify-content: center;
}

.profile-container {
  width: 100%;
  max-width: 900px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 32px;
  background: $bg-base;
  border-radius: $radius-lg;
  border: 1px solid $border-color;
  margin-bottom: 20px;

  .dark & {
    background: $dark-bg-light;
    border-color: $dark-border-color;
  }

  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .user-name {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }

    .user-email {
      margin: 0;
      font-size: 14px;
      color: $text-secondary;
    }
  }
}

.profile-tabs {
  background: $bg-base;
  border-radius: $radius-lg;
  border: 1px solid $border-color;
  padding: 20px 24px;

  .dark & {
    background: $dark-bg-light;
    border-color: $dark-border-color;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }
}
</style>
