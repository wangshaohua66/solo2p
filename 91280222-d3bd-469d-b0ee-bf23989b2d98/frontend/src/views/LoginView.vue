<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import { UserRole } from '@/types/user'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: ''
})
const loading = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  if (!form.email || !form.password) {
    ElMessage.warning('请输入邮箱和密码')
    return
  }
  loading.value = true
  try {
    await authStore.login({ email: form.email, password: form.password })
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch {
    ElMessage.error('登录失败，请检查账号密码')
  } finally {
    loading.value = false
  }
}

function quickLogin(role: UserRole) {
  const accounts: Record<UserRole, { email: string; password: string }> = {
    [UserRole.PROJECT_MANAGER]: { email: 'pm@demo.com', password: '123456' },
    [UserRole.DESIGNER]: { email: 'designer@demo.com', password: '123456' },
    [UserRole.REVIEWER]: { email: 'reviewer@demo.com', password: '123456' }
  }
  form.email = accounts[role].email
  form.password = accounts[role].password
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg"></div>
    <div class="login-container">
      <div class="login-card">
        <div class="brand-section">
          <el-icon :size="48" color="#1d4ed8"><OfficeBuilding /></el-icon>
          <h1 class="brand-title">建筑图纸协同审阅平台</h1>
          <p class="brand-subtitle">多专业团队在线审阅 · 批注标注 · 版本对比 · 审批流转</p>
        </div>

        <el-form :model="form" class="login-form" @keyup.enter="handleLogin">
          <el-form-item>
            <el-input
              v-model="form.email"
              size="large"
              placeholder="请输入邮箱地址"
              :prefix-icon="User"
              autocomplete="email"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="form.password"
              size="large"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              autocomplete="current-password"
            >
              <template #suffix>
                <el-icon class="password-toggle" @click="showPassword = !showPassword">
                  <View v-if="!showPassword" />
                  <Hide v-else />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              style="width: 100%"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form-item>
        </el-form>

        <div class="quick-login">
          <div class="quick-label">快速体验：</div>
          <div class="quick-buttons">
            <el-button size="small" @click="quickLogin(UserRole.PROJECT_MANAGER)">项目经理</el-button>
            <el-button size="small" @click="quickLogin(UserRole.DESIGNER)">设计师</el-button>
            <el-button size="small" @click="quickLogin(UserRole.REVIEWER)">审阅者</el-button>
          </div>
        </div>
      </div>

      <div class="footer-tip">
        © 2026 Blueprint Review Platform · 专业建筑协同设计解决方案
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at top left, rgba(29, 78, 216, 0.15), transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(6, 182, 212, 0.15), transparent 50%),
    linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0369a1 100%);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }
}

.login-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.login-card {
  width: 420px;
  padding: 40px;
  background: $bg-base;
  border-radius: $radius-lg;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

.brand-section {
  text-align: center;
  margin-bottom: 32px;

  .brand-title {
    font-size: 22px;
    font-weight: 700;
    margin: 16px 0 8px;
    color: $text-primary;
  }

  .brand-subtitle {
    font-size: 13px;
    color: $text-secondary;
    margin: 0;
  }
}

.login-form {
  margin-bottom: 20px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }
}

.password-toggle {
  cursor: pointer;
  color: $text-placeholder;

  &:hover {
    color: $primary-color;
  }
}

.quick-login {
  padding-top: 20px;
  border-top: 1px solid $border-color;

  .quick-label {
    font-size: 12px;
    color: $text-placeholder;
    margin-bottom: 10px;
    text-align: center;
  }

  .quick-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
}

.footer-tip {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

@media (max-width: 480px) {
  .login-card {
    width: 100%;
    max-width: 340px;
    padding: 32px 24px;
  }
}
</style>
