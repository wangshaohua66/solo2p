<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <el-icon :size="48" color="#1e3a5f"><OfficeBuilding /></el-icon>
        </div>
        <h1>律师事务所案件管理系统</h1>
        <p>Law Firm Case Management System</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" class="login-form" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.remember">记住我</el-checkbox>
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">登 录</el-button>
      </el-form>
      <div class="login-footer">
        <p>管理员: admin / Admin@123　　律师: lawyer01 / Law@1234</p>
        <p>© 2026 律师事务所管理系统</p>
      </div>
    </div>
    <div class="bg-decoration">
      <div class="circle c1"></div>
      <div class="circle c2"></div>
      <div class="circle c3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, OfficeBuilding } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: 'admin',
  password: 'Admin@123',
  remember: true
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
  } catch (e: any) {
    ElMessage.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #1a202c 100%);
  position: relative;
  overflow: hidden;
}
.login-card {
  width: 420px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 10;
}
.login-header {
  text-align: center;
  margin-bottom: 36px;
  .logo {
    width: 72px;
    height: 72px;
    margin: 0 auto 16px;
    background: linear-gradient(135deg, #1e3a5f, #4299e1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h1 {
    font-size: 22px;
    color: #1e3a5f;
    margin-bottom: 8px;
    font-weight: 600;
  }
  p {
    color: #718096;
    font-size: 13px;
    letter-spacing: 1px;
  }
}
.login-form {
  :deep(.el-form-item) { margin-bottom: 20px; }
}
.login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  letter-spacing: 4px;
  background: linear-gradient(90deg, #1e3a5f, #2c5282);
  border: none;
  &:hover { opacity: 0.9; }
}
.login-footer {
  margin-top: 32px;
  text-align: center;
  p {
    color: #a0aec0;
    font-size: 12px;
    margin: 6px 0;
  }
}
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  .circle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.08;
    background: #fff;
  }
  .c1 { width: 500px; height: 500px; top: -100px; left: -100px; }
  .c2 { width: 300px; height: 300px; bottom: 80px; right: 120px; }
  .c3 { width: 200px; height: 200px; top: 40%; right: 40%; }
}
</style>
