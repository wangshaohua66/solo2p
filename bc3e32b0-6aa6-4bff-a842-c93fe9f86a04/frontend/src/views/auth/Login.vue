<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest } from '@/types'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loginForm = reactive<LoginRequest>({
  username: '',
  password: ''
})

const loading = ref(false)
const rememberMe = ref(false)

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  
  loading.value = true
  try {
    await authStore.login(loginForm)
    ElMessage.success('登录成功')
    
    const redirect = route.query.redirect as string || '/dashboard'
    router.push(redirect)
  } catch (error: any) {
    console.error('Login failed:', error)
  } finally {
    loading.value = false
  }
}

const handleQuickLogin = (role: string) => {
  authStore.mockLogin(role as 'admin' | 'instructor' | 'member')
  ElMessage.success(`已以${role === 'admin' ? '管理员' : role === 'instructor' ? '陶艺师' : '会员'}身份登录（演示模式）`)
  const redirect = route.query.redirect as string || '/dashboard'
  router.push(redirect)
}
</script>

<template>
  <div class="login-page">
    <h2 class="login-title">欢迎回来</h2>
    <p class="login-subtitle">登录您的陶艺工坊账号</p>
    
    <el-form 
      ref="formRef"
      :model="loginForm" 
      class="login-form"
      @keyup.enter="handleLogin"
    >
      <el-form-item prop="username">
        <el-input 
          v-model="loginForm.username" 
          placeholder="用户名 / 邮箱"
          size="large"
          :prefix-icon="User"
          clearable
        />
      </el-form-item>
      
      <el-form-item prop="password">
        <el-input 
          v-model="loginForm.password" 
          type="password"
          placeholder="密码"
          size="large"
          :prefix-icon="Lock"
          show-password
        />
      </el-form-item>
      
      <div class="login-options">
        <el-checkbox v-model="rememberMe">记住我</el-checkbox>
        <a href="#" class="forgot-password">忘记密码？</a>
      </div>
      
      <el-button 
        type="primary" 
        size="large" 
        class="login-btn"
        :loading="loading"
        @click="handleLogin"
      >
        登录
      </el-button>
    </el-form>
    
    <div class="quick-login">
      <span class="quick-login-label">快速体验：</span>
      <div class="quick-login-buttons">
        <el-button size="small" @click="handleQuickLogin('admin')">管理员</el-button>
        <el-button size="small" @click="handleQuickLogin('instructor')">陶艺师</el-button>
        <el-button size="small" @click="handleQuickLogin('member')">会员</el-button>
      </div>
    </div>
    
    <div class="login-footer">
      <span>还没有账号？</span>
      <router-link to="/register" class="register-link">立即注册</router-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  width: 100%;
}

.login-title {
  font-size: 28px;
  font-weight: 700;
  color: $color-text-primary;
  margin-bottom: 8px;
}

.login-subtitle {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 32px;
}

.login-form {
  margin-bottom: 24px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.forgot-password {
  font-size: 13px;
  color: $color-primary;
  text-decoration: none;

  &:hover {
    color: $color-primary-light;
  }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  --el-button-bg-color: $color-primary;
  --el-button-border-color: $color-primary;
  --el-button-hover-bg-color: $color-primary-light;
  --el-button-hover-border-color: $color-primary-light;
  --el-button-active-bg-color: $color-primary-dark;
  --el-button-active-border-color: $color-primary-dark;
}

.quick-login {
  text-align: center;
  padding: 16px 0;
  border-top: 1px solid $color-border;

  &-label {
    font-size: 13px;
    color: $color-text-secondary;
    display: block;
    margin-bottom: 12px;
  }

  &-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: $color-text-secondary;
}

.register-link {
  color: $color-primary;
  font-weight: 500;
  margin-left: 4px;
}
</style>
