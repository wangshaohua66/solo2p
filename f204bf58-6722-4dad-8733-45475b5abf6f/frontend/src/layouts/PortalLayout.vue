<template>
  <div class="portal-layout" v-if="!userStore.isLoading">
    <template v-if="!userStore.isLoggedIn">
      <div class="portal-login">
        <div class="login-box">
          <div class="brand">
            <h1>客户自助服务平台</h1>
            <p>{{ agencyName }}</p>
          </div>
          <el-form :model="loginForm" ref="formRef" :rules="rules" size="large" @submit.prevent="submitLogin">
            <el-form-item prop="username">
              <el-input v-model="loginForm.username" placeholder="请输入客户账号" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" :prefix-icon="Lock" show-password />
            </el-form-item>
            <el-button type="primary" :loading="loading" style="width:100%" @click="submitLogin">
              登录
            </el-button>
          </el-form>
          <div style="margin-top:16px;text-align:center;color:#718096;font-size:13px">
            如有疑问请致电：{{ supportPhone }}
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="portal-header">
        <div class="h-inner">
          <div class="h-left">
            <span class="brand-name">{{ agencyName }} · 客户门户</span>
            <el-menu mode="horizontal" :default-active="activeMenu" @select="onMenu" background-color="transparent" text-color="#cbd5e0" active-text-color="#fff">
              <el-menu-item index="home"><el-icon><House /></el-icon> 工作台</el-menu-item>
              <el-menu-item index="cases"><el-icon><DocumentCopy /></el-icon> 我的案件</el-menu-item>
              <el-menu-item index="docs"><el-icon><Files /></el-icon> 法律文书</el-menu-item>
            </el-menu>
          </div>
          <div class="h-right">
            <span style="margin-right:16px;color:#e2e8f0">欢迎，{{ userStore.user?.client_info?.client_name || userStore.user?.full_name }}</span>
            <el-button link @click="userStore.logout()" style="color:#fff">
              <el-icon><SwitchButton /></el-icon> 退出
            </el-button>
          </div>
        </div>
      </div>
      <div class="portal-content">
        <router-view />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  House, DocumentCopy, Files, Lock, User, SwitchButton
} from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { siteConfig } from '@/config'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const agencyName = siteConfig.agency_name
const supportPhone = siteConfig.support_phone

const loginForm = reactive({ username: '', password: '' })
const rules: FormRules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [{ required: true, message: '请输入密码' }],
}

const activeMenu = computed(() => {
  const name = route.name as string
  if (name === 'portal-home') return 'home'
  if (name === 'portal-cases') return 'cases'
  if (name === 'portal-docs') return 'docs'
  return 'home'
})

function onMenu(idx: string) {
  if (idx === 'home') router.push('/portal')
  else if (idx === 'cases') router.push('/portal/cases')
  else router.push('/portal/documents')
}

async function submitLogin() {
  if (!formRef.value) return
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.login({ username: loginForm.username, password: loginForm.password, as_client: true })
    ElMessage.success('登录成功')
    router.push('/portal')
  } catch (e: any) { ElMessage.error(e.message || '登录失败') }
  finally { loading.value = false }
}

onMounted(() => {
  if (!userStore.isLoggedIn && route.path !== '/portal/login') {
    // keep on this layout, will render login form
  }
})
</script>

<style lang="scss" scoped>
.portal-layout {
  background: #f0f4f8;
  min-height: 100vh;
}
.portal-login {
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #2b6cb0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  .login-box {
    width: 440px;
    background: #fff;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }
  .brand {
    text-align: center;
    margin-bottom: 28px;
    h1 {
      margin: 0;
      font-size: 24px;
      color: #1e3a5f;
      font-weight: 700;
    }
    p { margin: 6px 0 0; color: #718096; font-size: 13px; }
  }
}
.portal-header {
  background: linear-gradient(90deg, #1e3a5f 0%, #2c5282 100%);
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 10;
  .h-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .h-left { display: flex; align-items: center; gap: 24px; }
  .brand-name {
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 1px;
  }
  :deep(.el-menu--horizontal) {
    border: none;
  }
  .h-right { display: flex; align-items: center; }
}
.portal-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}
</style>
