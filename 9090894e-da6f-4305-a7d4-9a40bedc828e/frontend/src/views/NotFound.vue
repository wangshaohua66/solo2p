<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="notfound-page">
    <div class="notfound-box">
      <div class="code">404</div>
      <h2 class="title">页面未找到</h2>
      <p class="desc">您访问的页面不存在或已被移除</p>
      <el-button type="primary" size="large" @click="router.push('/dashboard')">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.notfound-page {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-color;
}

.notfound-box {
  text-align: center;

  .code {
    font-size: 120px;
    font-weight: 800;
    background: linear-gradient(135deg, $primary-color, $primary-light);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
    margin-bottom: 16px;
  }

  .title {
    font-size: 24px;
    color: $text-primary;
    margin-bottom: 8px;
  }

  .desc {
    color: $text-secondary;
    margin-bottom: 32px;
  }
}
</style>
