<template>
  <div class="login-container">
    <div class="login-bg">
      <div class="bg-overlay"></div>
      <div class="bg-grid"></div>
    </div>
    <div class="login-card">
      <div class="login-header">
        <div class="logo-icon">
          <el-icon :size="48" color="#3b82f6"><FirstAidKit /></el-icon>
        </div>
        <h1 class="title">急救调度指挥中心</h1>
        <p class="subtitle">Emergency Medical Services Dispatch System</p>
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

        <el-form-item>
          <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <p class="tip">演示账号: dispatcher / doctor / manager / qc / admin</p>
        <p class="tip">密码: 123456</p>
      </div>
    </div>

    <div class="footer-info">
      <p>© 2024 急救中心调度系统 v1.0.0</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { LoginRequest } from '@/types/auth'
import { User, Lock, FirstAidKit } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loginFormRef = ref<FormInstance>()
const loading = ref(false)
const rememberMe = ref(false)

const loginForm = reactive<LoginRequest>({
  username: '',
  password: ''
})

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(() => {
  const savedUsername = localStorage.getItem('rememberUsername')
  if (savedUsername) {
    loginForm.username = savedUsername
    rememberMe.value = true
  }
})

async function handleLogin() {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      await userStore.doLogin(loginForm)

      if (rememberMe.value) {
        localStorage.setItem('rememberUsername', loginForm.username)
      } else {
        localStorage.removeItem('rememberUsername')
      }

      ElMessage.success('登录成功')

      const redirect = route.query.redirect as string
      router.push(redirect || '/')
    } catch (error: any) {
      ElMessage.error(error.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.login-container {
  width: 100%;
  height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0e17;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;

  .bg-overlay {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
      linear-gradient(135deg, #0a0e17 0%, #111827 100%);
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
}

.login-card {
  position: relative;
  z-index: 1;
  width: 420px;
  padding: 48px 40px;
  background: rgba(17, 24, 39, 0.95);
  border-radius: 16px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(59, 130, 246, 0.1);
  backdrop-filter: blur(10px);

  .login-header {
    text-align: center;
    margin-bottom: 40px;

    .logo-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .title {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px;
    }

    .subtitle {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
  }

  .login-form {
    .login-btn {
      width: 100%;
      height: 44px;
      font-size: 16px;
      font-weight: 500;
      margin-top: 8px;
    }
  }

  .login-footer {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #374151;

    .tip {
      font-size: 12px;
      color: #6b7280;
      margin: 4px 0;
      text-align: center;
    }
  }
}

.footer-info {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  color: #6b7280;
  font-size: 12px;
}

:deep(.el-input__wrapper) {
  background: #1f2937;
  border: 1px solid #374151;
  box-shadow: none;

  &.is-focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
}

:deep(.el-input__inner) {
  color: #e5e7eb;
}

:deep(.el-input__prefix-inner) {
  color: #6b7280;
}

:deep(.el-checkbox__label) {
  color: #9ca3af;
}
</style>
