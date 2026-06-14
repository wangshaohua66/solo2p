<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="content">
      <div class="code">404</div>
      <h1 class="title">页面不存在</h1>
      <p class="desc">您访问的页面可能已被移除或链接错误</p>
      <el-button type="primary" size="large" @click="router.push('/')">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-light;

  .content {
    text-align: center;

    .code {
      font-size: 120px;
      font-weight: 800;
      background: linear-gradient(135deg, $primary-color, #06b6d4);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      line-height: 1;
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      margin: 16px 0 8px;
    }

    .desc {
      color: $text-secondary;
      margin: 0 0 32px;
    }
  }
}
</style>
