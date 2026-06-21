<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { WarningFilled, ArrowLeft } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/dashboard')
  }
}

function goLogin() {
  userStore.logout()
  router.push({ name: 'Login', query: { redirect: route.fullPath } })
}
</script>

<template>
  <div class="forbidden-page">
    <div class="forbidden-container">
      <el-icon class="forbidden-icon" :size="120" color="#f56c6c">
        <WarningFilled />
      </el-icon>
      <h1 class="forbidden-code">403</h1>
      <p class="forbidden-title">无权限访问</p>
      <p class="forbidden-desc">
        抱歉，您没有权限访问该页面。<br />
        请联系管理员获取相应权限，或使用其他账号登录。
      </p>
      <div class="forbidden-actions">
        <el-button type="primary" @click="goBack">
          <el-icon style="margin-right: 6px"><ArrowLeft /></el-icon>
          返回上一页
        </el-button>
        <el-button @click="goLogin">切换账号登录</el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.forbidden-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8edf5 100%);
}

.forbidden-container {
  text-align: center;
  padding: 60px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);

  .forbidden-icon {
    margin-bottom: 20px;
  }

  .forbidden-code {
    font-size: 72px;
    font-weight: 700;
    color: #f56c6c;
    margin: 0 0 10px;
    line-height: 1;
  }

  .forbidden-title {
    font-size: 24px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 12px;
  }

  .forbidden-desc {
    font-size: 14px;
    color: $text-secondary;
    line-height: 1.8;
    margin: 0 0 30px;
  }

  .forbidden-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}
</style>
