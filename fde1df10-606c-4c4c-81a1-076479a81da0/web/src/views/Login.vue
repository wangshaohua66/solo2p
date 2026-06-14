<template>
  <div class="login-container">
    <div class="login-bg-decoration">
      <div class="bg-circle bg-circle-1" />
      <div class="bg-circle bg-circle-2" />
      <div class="bg-circle bg-circle-3" />
    </div>

    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <el-icon :size="48" color="#409EFF"><Building /></el-icon>
        <h1 class="login-title">演艺集团场馆资源调度系统</h1>
        <p class="login-subtitle">Venue Resource Scheduling System</p>
      </div>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            size="large"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <div class="role-selector">
          <span class="role-label">快速选择角色：</span>
          <el-radio-group v-model="selectedRole" size="small" @change="handleRoleChange">
            <el-radio-button value="venue_manager">场馆经理</el-radio-button>
            <el-radio-button value="producer">演出制作人</el-radio-button>
            <el-radio-button value="tech_director">技术总监</el-radio-button>
            <el-radio-button value="finance">财务专员</el-radio-button>
            <el-radio-button value="troupe_admin">院团管理员</el-radio-button>
          </el-radio-group>
        </div>

        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          {{ loading ? '登录中...' : '登 录' }}
        </el-button>
      </el-form>

      <div class="login-footer">
        <span>© 2024 演艺集团 · 技术部</span>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Building } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import type { UserRole } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loginFormRef = ref<FormInstance>()
const loading = ref(false)
const selectedRole = ref<UserRole | ''>('')

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ]
}

const demoAccounts: Record<UserRole, { username: string; password: string }> = {
  venue_manager: { username: 'venue_manager', password: '123456' },
  producer: { username: 'producer', password: '123456' },
  tech_director: { username: 'tech_director', password: '123456' },
  finance: { username: 'finance', password: '123456' },
  troupe_admin: { username: 'troupe_admin', password: '123456' }
}

const handleRoleChange = (role: UserRole) => {
  const account = demoAccounts[role]
  if (account) {
    loginForm.username = account.username
    loginForm.password = account.password
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await userStore.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/schedule'
    router.push(redirect)
  } catch (err: any) {
    ElMessage.error(err?.message || '登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #4e8cff 100%);
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.login-bg-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;

  .bg-circle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.1;
    background: #fff;
  }

  .bg-circle-1 {
    width: 400px;
    height: 400px;
    top: -100px;
    left: -100px;
    animation: float 8s ease-in-out infinite;
  }

  .bg-circle-2 {
    width: 300px;
    height: 300px;
    bottom: -80px;
    right: -80px;
    animation: float 10s ease-in-out infinite reverse;
  }

  .bg-circle-3 {
    width: 200px;
    height: 200px;
    top: 50%;
    right: 10%;
    animation: float 12s ease-in-out infinite;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-30px) scale(1.05);
  }
}

.login-card {
  width: 400px;
  max-width: 100%;
  border-radius: 12px;
  border: none;
  position: relative;
  z-index: 1;

  :deep(.el-card__body) {
    padding: 40px 36px 24px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  .login-title {
    font-size: 22px;
    font-weight: 600;
    color: #303133;
    margin: 12px 0 4px;
  }

  .login-subtitle {
    font-size: 12px;
    color: #909399;
    margin: 0;
    letter-spacing: 1px;
  }
}

.login-form {
  .role-selector {
    margin-bottom: 24px;

    .role-label {
      display: block;
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
    }

    :deep(.el-radio-group) {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }

  .login-btn {
    width: 100%;
    height: 44px;
    font-size: 16px;
    letter-spacing: 4px;
    border-radius: 6px;
  }
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #c0c4cc;
}

@media (max-width: 480px) {
  .login-card {
    :deep(.el-card__body) {
      padding: 28px 20px 16px;
    }
  }

  .login-header {
    .login-title {
      font-size: 18px;
    }
  }
}
</style>
