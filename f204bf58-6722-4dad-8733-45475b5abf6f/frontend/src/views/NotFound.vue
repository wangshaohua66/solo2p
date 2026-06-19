<template>
  <div class="not-found">
    <div class="nf-box">
      <div class="nf-code">404</div>
      <div class="nf-msg">页面走丢了</div>
      <div class="nf-desc">您访问的页面不存在或已被删除</div>
      <el-button type="primary" size="large" @click="$router.push('/')">
        <el-icon><House /></el-icon> 返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { House } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.not-found {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f4f8 0%, #ebf8ff 100%);
  .nf-box { text-align: center; padding: 60px 80px; background: #fff; border-radius: 20px; box-shadow: 0 10px 40px rgba(30,58,95,0.08); }
  .nf-code {
    font-size: 100px;
    font-weight: 800;
    background: linear-gradient(135deg, #1e3a5f, #4299e1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1;
    letter-spacing: -4px;
  }
  .nf-msg { font-size: 24px; color: #2d3748; margin: 16px 0 8px; font-weight: 600; }
  .nf-desc { color: #718096; margin-bottom: 28px; }
}
</style>
