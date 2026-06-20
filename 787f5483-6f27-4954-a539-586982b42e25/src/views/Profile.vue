<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { formatDate } from '@/utils'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('info')
const formRef = ref<FormInstance>()

const form = reactive({
  name: userStore.userInfo?.name || '',
  phone: userStore.userInfo?.phone || '',
  email: userStore.userInfo?.email || '',
  department: userStore.userInfo?.department || ''
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ]
}

const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

async function handleSave() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      userStore.updateUserInfo(form)
      ElMessage.success('信息更新成功')
    }
  })
}

async function handleChangePassword() {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      ElMessage.success('密码修改成功')
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    }
  })
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

const stats = [
  { label: '创建选题', value: 128 },
  { label: '上传素材', value: 456 },
  { label: '审核通过', value: 89 },
  { label: '制作节目', value: 32 }
]
</script>

<template>
  <div class="page-container profile">
    <div class="page-header">
      <div class="page-header__title">个人中心</div>
    </div>
    
    <el-row :gutter="24">
      <el-col :lg="8" :md="24">
        <div class="card profile-card">
          <div class="avatar-section">
            <el-avatar :size="100" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
            <h2 class="user-name">{{ userStore.userInfo?.name }}</h2>
            <p class="user-role">{{ userStore.userInfo?.role === 'admin' ? '系统管理员' : '记者' }}</p>
            <p class="user-dept">{{ userStore.userInfo?.department }}</p>
          </div>
          
          <el-divider />
          
          <div class="stats-grid">
            <div v-for="stat in stats" :key="stat.label" class="stat-item">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="info-list">
            <div class="info-item">
              <el-icon><Phone /></el-icon>
              <span>{{ userStore.userInfo?.phone || '未设置' }}</span>
            </div>
            <div class="info-item">
              <el-icon><Message /></el-icon>
              <span>{{ userStore.userInfo?.email || '未设置' }}</span>
            </div>
            <div class="info-item">
              <el-icon><Clock /></el-icon>
              <span>入职时间：2022-01-01</span>
            </div>
          </div>
          
          <el-button 
            type="danger" 
            style="width: 100%; margin-top: 16px"
            @click="handleLogout"
          >
            <el-icon><SwitchButton /></el-icon>退出登录
          </el-button>
        </div>
      </el-col>
      
      <el-col :lg="16" :md="24">
        <el-tabs v-model="activeTab" class="profile-tabs">
          <el-tab-pane label="基本信息" name="info">
            <div class="card">
              <el-form
                ref="formRef"
                :model="form"
                :rules="rules"
                label-width="100px"
              >
                <el-form-item label="用户名">
                  <el-input :model-value="userStore.userInfo?.username" disabled />
                </el-form-item>
                
                <el-form-item label="姓名" prop="name">
                  <el-input v-model="form.name" placeholder="请输入姓名" />
                </el-form-item>
                
                <el-form-item label="手机号" prop="phone">
                  <el-input v-model="form.phone" placeholder="请输入手机号" />
                </el-form-item>
                
                <el-form-item label="邮箱" prop="email">
                  <el-input v-model="form.email" placeholder="请输入邮箱" />
                </el-form-item>
                
                <el-form-item label="所属部门" prop="department">
                  <el-input v-model="form.department" disabled />
                </el-form-item>
                
                <el-form-item label="角色">
                  <el-input :model-value="userStore.userInfo?.role === 'admin' ? '管理员' : '普通用户'" disabled />
                </el-form-item>
                
                <el-form-item>
                  <el-button type="primary" @click="handleSave">
                    <el-icon><Check /></el-icon>保存修改
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="修改密码" name="password">
            <div class="card">
              <el-form
                ref="passwordFormRef"
                :model="passwordForm"
                :rules="passwordRules"
                label-width="120px"
              >
                <el-form-item label="当前密码" prop="oldPassword">
                  <el-input
                    v-model="passwordForm.oldPassword"
                    type="password"
                    placeholder="请输入当前密码"
                    show-password
                  />
                </el-form-item>
                
                <el-form-item label="新密码" prop="newPassword">
                  <el-input
                    v-model="passwordForm.newPassword"
                    type="password"
                    placeholder="请输入新密码（6-20位）"
                    show-password
                  />
                </el-form-item>
                
                <el-form-item label="确认新密码" prop="confirmPassword">
                  <el-input
                    v-model="passwordForm.confirmPassword"
                    type="password"
                    placeholder="请再次输入新密码"
                    show-password
                  />
                </el-form-item>
                
                <el-form-item>
                  <el-button type="primary" @click="handleChangePassword">
                    <el-icon><Lock /></el-icon>修改密码
                  </el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="操作日志" name="logs">
            <div class="card">
              <el-table
                :data="[
                  { time: '2024-01-15 14:30:25', action: '创建选题', detail: '《城市轨道交通建设进展》' },
                  { time: '2024-01-15 10:15:32', action: '上传素材', detail: 'video_20240115_001.mp4' },
                  { time: '2024-01-14 16:45:12', action: '提交审核', detail: '选题《春节特别报道》' },
                  { time: '2024-01-14 09:20:45', action: '编辑素材', detail: '对素材进行剪辑处理' },
                  { time: '2024-01-13 15:10:22', action: '登录系统', detail: 'IP: 192.168.1.100' }
                ]"
                stripe
              >
                <el-table-column prop="time" label="时间" width="180" />
                <el-table-column prop="action" label="操作类型" width="120">
                  <template #default="{ row }">
                    <el-tag size="small">{{ row.action }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="detail" label="详情" />
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.profile {
  .profile-card {
    text-align: center;
  }
  
  .avatar-section {
    padding: 20px 0;
  }
  
  .user-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-primary);
    margin: 16px 0 4px;
  }
  
  .user-role {
    font-size: 13px;
    color: var(--primary-color);
    margin: 0 0 4px;
  }
  
  .user-dept {
    font-size: 12px;
    color: var(--text-color-tertiary);
    margin: 0;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  
  .stat-item {
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--primary-color);
    }
    
    .stat-label {
      font-size: 12px;
      color: var(--text-color-secondary);
      margin-top: 4px;
    }
  }
  
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
    
    .info-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--text-color-secondary);
      
      .el-icon {
        color: var(--primary-color);
      }
    }
  }
  
  .profile-tabs {
    :deep(.el-tabs__header) {
      background-color: var(--bg-color-card);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
      padding: 0 20px;
      margin: 0;
    }
    
    :deep(.el-tabs__item) {
      height: 48px;
      line-height: 48px;
    }
    
    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }
  }
}
</style>
