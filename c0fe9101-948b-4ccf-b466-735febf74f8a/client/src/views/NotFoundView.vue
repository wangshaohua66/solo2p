<template>
  <div class="not-found">
    <div class="code">404</div>
    <div class="title">页面不存在</div>
    <div class="desc">您访问的页面可能已被删除或从未存在</div>
    <el-button type="primary" size="large" @click="router.replace('/')">返回首页</el-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped lang="scss">
.not-found {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  .code {
    font-size: 180px;
    font-weight: 800;
    background: linear-gradient(135deg, #409EFF, #F56C6C);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    line-height: 1;
    @include respond-to(mobile) { font-size: 100px; }
  }
  .title {
    font-size: 24px;
    font-weight: 600;
    margin: 20px 0 12px;
    color: var(--text-primary);
  }
  .desc {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 32px;
  }
}
</style>
