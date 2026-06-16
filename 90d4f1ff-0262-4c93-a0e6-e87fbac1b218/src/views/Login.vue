<template>
  <div class="login-container">
    <div class="login-bg"></div>
    <div class="login-box">
      <div class="login-header">
        <h1 class="title">智慧园区停车与充电管理系统</h1>
        <p class="subtitle">Smart Parking &amp; Charging Management Platform</p>
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
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <div class="flex-between">
            <el-checkbox v-model="rememberMe">记住密码</el-checkbox>
            <a href="javascript:void(0)" class="forgot-link">忘记密码？</a>
          </div>
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
        <div class="demo-accounts">
          <span class="demo-label">演示账号：</span>
          <el-tag size="small" v-for="acc in demoAccounts" :key="acc.username"
                  class="demo-tag" type="info" effect="plain"
                  @click="fillAccount(acc)">
            {{ acc.username }} / {{ acc.role }}
          </el-tag>
        </div>
      </el-form>
      <div class="login-footer">
        <p>© 2026 智慧园区管理平台 All Rights Reserved</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest, UserRole } from '@/types'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

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

interface DemoAccount {
  username: string
  password: string
  role: string
  userRole: UserRole
}

const demoAccounts: DemoAccount[] = [
  { username: 'admin', password: '123456', role: '超级管理员', userRole: 'SuperAdmin' },
  { username: 'operator', password: '123456', role: '园区运营', userRole: 'ParkOperator' },
  { username: 'parking', password: '123456', role: '停车管理员', userRole: 'ParkingAdmin' },
  { username: 'charging', password: '123456', role: '充电桩运维', userRole: 'ChargingOps' },
  { username: 'owner', password: '123456', role: '车主', userRole: 'CarOwner' }
]

const fillAccount = (acc: DemoAccount) => {
  loginForm.username = acc.username
  loginForm.password = acc.password
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await authStore.login(loginForm)
        ElMessage.success('登录成功')
        const redirect = (route.query.redirect as string) || '/dashboard'
        router.push(redirect)
      } catch (error: any) {
        ElMessage.error(error.message || '登录失败')
      } finally {
        loading.value = false
      }
    }
  })
}

onMounted(() => {
  const saved = localStorage.getItem('login_account')
  if (saved) {
    const { username, password } = JSON.parse(saved)
    loginForm.username = username
    loginForm.password = password
    rememberMe.value = true
  }
})
</script>

<style lang="scss" scoped>
.login-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%);
  opacity: 0.9;
  z-index: 0;

  &::before {
    content: '';
    position: absolute;
    top: 10%;
    left: 10%;
    width: 300px;
    height: 300px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    animation: float 8s ease-in-out infinite;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 10%;
    right: 15%;
    width: 400px;
    height: 400px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 50%;
    animation: float 10s ease-in-out infinite reverse;
  }
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, -30px); }
}

.login-box {
  position: relative;
  z-index: 1;
  width: 440px;
  max-width: 90%;
  padding: 40px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;

  .title {
    font-size: 22px;
    font-weight: 700;
    color: #1a2a6c;
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 13px;
    color: #909399;
    letter-spacing: 1px;
  }
}

.login-form {
  :deep(.el-input__wrapper) {
    padding: 0 15px;
    border-radius: 8px;
  }
}

.login-btn {
  width: 100%;
  border-radius: 8px;
  font-size: 16px;
  height: 44px;
  background: linear-gradient(135deg, #1a2a6c 0%, #409eff 100%);
  border: none;

  &:hover {
    opacity: 0.9;
  }
}

.forgot-link {
  font-size: 13px;
  color: var(--primary-color);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.demo-accounts {
  margin-top: 20px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 12px;

  .demo-label {
    color: #909399;
    margin-right: 8px;
  }

  .demo-tag {
    margin: 3px 4px 3px 0;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--primary-color);
      color: #fff;
      border-color: var(--primary-color);
    }
  }
}

.login-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: #c0c4cc;
}

@media (max-width: 480px) {
  .login-box {
    padding: 24px;
  }

  .login-header .title {
    font-size: 18px;
  }
}
</style>
