<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormRules } from 'element-plus'
import { User, Lock, KeyRound } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loading = ref(false)
const errorMessage = ref('')

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度在 6 到 32 个字符', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  errorMessage.value = ''
  loading.value = true
  try {
    await userStore.login({
      username: loginForm.username,
      password: loginForm.password
    })
    if (loginForm.remember) {
      localStorage.setItem('rememberedUsername', loginForm.username)
    } else {
      localStorage.removeItem('rememberedUsername')
    }
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '登录失败，请检查用户名和密码'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const remembered = localStorage.getItem('rememberedUsername')
  if (remembered) {
    loginForm.username = remembered
    loginForm.remember = true
  }
})
</script>

<template>
  <div class="login-container">
    <div class="bg-animation">
      <div class="bg-circle bg-circle-1"></div>
      <div class="bg-circle bg-circle-2"></div>
      <div class="bg-circle bg-circle-3"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="login-content">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">
            <KeyRound class="w-10 h-10 text-white" />
          </div>
          <h1 class="system-title">设备预约管理系统</h1>
          <p class="system-subtitle">Equipment Reservation Management System</p>
        </div>

        <div class="login-form-wrapper">
          <el-form
            ref="formRef"
            :model="loginForm"
            :rules="rules"
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <div class="input-wrapper">
                <User class="input-icon w-5 h-5" />
                <el-input
                  v-model="loginForm.username"
                  placeholder="请输入用户名"
                  size="large"
                  class="custom-input"
                  :prefix-icon="User"
                />
              </div>
            </el-form-item>

            <el-form-item prop="password">
              <div class="input-wrapper">
                <Lock class="input-icon w-5 h-5" />
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  size="large"
                  class="custom-input"
                  show-password
                  :prefix-icon="Lock"
                />
              </div>
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
              <a href="#" class="forgot-link">忘记密码?</a>
            </div>

            <div v-if="errorMessage" class="error-message">
              {{ errorMessage }}
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
        </div>

        <div class="login-footer">
          <p>© 2024 设备预约管理系统 · 科技蓝主题</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0c1929 0%, #1a365d 50%, #0c1929 100%);
  overflow: hidden;
}

.bg-animation {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  animation: float 8s ease-in-out infinite;
}

.bg-circle-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.bg-circle-2 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #8b5cf6, #3b82f6);
  bottom: -150px;
  right: -150px;
  animation-delay: -3s;
}

.bg-circle-3 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #06b6d4, #10b981);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: -5s;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: gridMove 20s linear infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}

@keyframes gridMove {
  0% { background-position: 0 0; }
  100% { background-position: 50px 50px; }
}

.login-content {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.login-card {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  padding: 40px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(59, 130, 246, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: cardAppear 0.6s ease-out;
}

@keyframes cardAppear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.logo-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 10px 30px -10px rgba(59, 130, 246, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: pulseGlow 2s ease-in-out infinite;
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow:
      0 10px 30px -10px rgba(59, 130, 246, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
      0 15px 40px -10px rgba(59, 130, 246, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

.system-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px 0;
  letter-spacing: 1px;
}

.system-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.login-form-wrapper {
  margin-bottom: 24px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  z-index: 1;
  pointer-events: none;
}

.custom-input :deep(.el-input__wrapper) {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  box-shadow: none;
  transition: all 0.3s ease;
}

.custom-input :deep(.el-input__wrapper:hover) {
  border-color: #888888;
}

.custom-input :deep(.el-input__wrapper.is-focus) {
  border-color: #888888;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.custom-input :deep(.el-input__inner) {
  color: #ffffff;
  height: 48px;
}

.custom-input :deep(.el-input__inner::placeholder) {
  color: #64748b;
}

.custom-input :deep(.el-input__prefix) {
  color: #94a3b8;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

:deep(.el-checkbox__label) {
  color: #94a3b8;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

.forgot-link {
  color: #888888;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s ease;
}

.forgot-link:hover {
  color: #888888;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.login-btn {
  width: 100%;
  height: 50px;
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 4px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #888888);
  border: none;
  box-shadow:
    0 10px 30px -10px rgba(59, 130, 246, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow:
    0 15px 40px -10px rgba(59, 130, 246, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.login-btn:active {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.login-footer p {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

@media (max-width: 640px) {
  .login-card {
    padding: 30px 24px;
  }

  .system-title {
    font-size: 20px;
  }

  .logo-icon {
    width: 64px;
    height: 64px;
  }

  .logo-icon :deep(svg) {
    width: 32px;
    height: 32px;
  }
}
</style>
