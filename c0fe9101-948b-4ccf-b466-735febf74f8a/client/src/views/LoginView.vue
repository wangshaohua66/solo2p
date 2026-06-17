<template>
  <div class="login-container">
    <div class="login-bg">
      <div class="bg-circle c1"></div>
      <div class="bg-circle c2"></div>
      <div class="bg-circle c3"></div>
    </div>
    <div class="login-box">
      <div class="login-header">
        <div class="logo">
          <el-icon :size="40" color="#409EFF"><PawPrint /></el-icon>
        </div>
        <h1 class="title">{{ import.meta.env.VITE_APP_TITLE }}</h1>
        <p class="subtitle">Pet Medical Chain Management System</p>
      </div>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            size="large"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.remember">记住账号</el-checkbox>
          <span style="flex:1"></span>
          <el-button type="text" @click="showDemoHint">演示账号说明</el-button>
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
      <div class="demo-accounts" v-if="showDemo">
        <el-divider content-position="left">快速登录</el-divider>
        <div class="demo-grid">
          <el-tag
            v-for="acc in demoAccounts"
            :key="acc.username"
            class="demo-tag"
            effect="plain"
            round
            @click="fillDemo(acc)"
          >
            {{ acc.label }}
          </el-tag>
        </div>
      </div>
    </div>
    <div class="login-footer">
      © 2024 Pet Medical Chain Management System · 技术支持：Vue3 + Flask + MySQL
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, PawPrint } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const showDemo = ref(false)

const demoAccounts = [
  { label: '系统管理员', username: 'admin', password: 'admin123' },
  { label: '医疗总监', username: 'director01', password: '123456' },
  { label: '院长', username: 'manager01', password: '123456' },
  { label: '医生', username: 'doctor01', password: '123456' },
  { label: '检验技师', username: 'lab_tech01', password: '123456' },
  { label: '药房管理员', username: 'pharmacist01', password: '123456' },
  { label: '护理员', username: 'nurse01', password: '123456' }
]

const form = reactive({
  username: localStorage.getItem('petmed_username') || '',
  password: '',
  remember: !!localStorage.getItem('petmed_username')
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(() => {
  const savedUser = localStorage.getItem('petmed_username')
  if (savedUser) form.username = savedUser
})

function fillDemo(acc: any) {
  form.username = acc.username
  form.password = acc.password
}

function showDemoHint() {
  showDemo.value = !showDemo.value
}

async function handleLogin() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const ok = await userStore.login(form.username, form.password)
      if (ok) {
        if (form.remember) localStorage.setItem('petmed_username', form.username)
        else localStorage.removeItem('petmed_username')
        ElMessage.success('登录成功')
        const redirect = (route.query.redirect as string) || '/dashboard'
        router.replace(redirect)
      }
    } catch (e) {
      // handled by interceptor
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
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.login-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  .bg-circle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    &.c1 { width: 400px; height: 400px; top: -100px; left: -100px; animation: float 15s ease-in-out infinite; }
    &.c2 { width: 300px; height: 300px; bottom: -50px; right: -50px; animation: float 18s ease-in-out infinite reverse; }
    &.c3 { width: 200px; height: 200px; top: 50%; right: 20%; animation: float 20s ease-in-out infinite; }
  }
}
@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, 40px); }
}

.login-box {
  position: relative;
  z-index: 1;
  width: 440px;
  max-width: calc(100% - 32px);
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  @include respond-to(mobile) {
    padding: 28px 20px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
  .logo {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 50%;
    background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
    @include flex-center;
  }
  .title {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    letter-spacing: 1px;
  }
}

.login-form {
  :deep(.el-form-item) { margin-bottom: 20px; }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 8px;
  letter-spacing: 4px;
  margin-top: 8px;
}

.demo-accounts {
  margin-top: 24px;
  .demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
  .demo-tag {
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    padding: 6px 8px;
    &:hover { transform: translateY(-2px); }
  }
}

.login-footer {
  position: absolute;
  bottom: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  text-align: center;
  z-index: 1;
}
</style>
