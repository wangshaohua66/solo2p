<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">404</h1>
      <p class="error-title">页面不存在</p>
      <p class="error-desc">抱歉，您访问的页面不存在或已被移除</p>
      <el-button type="primary" @click="goBack">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
const goBack = () => router.push('/dashboard')
</script>

<style lang="scss" scoped>
.error-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.error-content {
  text-align: center;

  .error-code {
    font-size: 120px;
    font-weight: 700;
    color: var(--danger-color);
    line-height: 1;
    margin-bottom: 16px;
  }

  .error-title {
    font-size: 24px;
    color: #303133;
    margin-bottom: 8px;
  }

  .error-desc {
    font-size: 14px;
    color: #909399;
    margin-bottom: 32px;
  }
}
</style>
