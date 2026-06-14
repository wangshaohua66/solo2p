<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <div class="error-code">404</div>
      <h1 class="error-title">页面走丢了</h1>
      <p class="error-desc">抱歉，您访问的页面不存在或已被移除</p>
      <div class="error-actions">
        <el-button type="primary" size="large" @click="goHome">
        <el-icon><House /></el-icon>
        <span>返回首页</span>
      </el-button>
        <el-button size="large" @click="goBack">
          <el-icon><Back /></el-icon>
          <span>返回上一页</span>
        </el-button>
      </div>
    </div>
    <div class="not-found-decoration">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="decoration-svg">
        <circle cx="100" cy="100" r="80" fill="none" stroke="#e4e7ed" stroke-width="2" />
        <circle cx="70" cy="85" r="8" fill="#909399" />
        <circle cx="130" cy="85" r="8" fill="#909399" />
        <path d="M 70 120 Q 100 140 130 120" fill="none" stroke="#909399" stroke-width="3" stroke-linecap="round" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { House, Back } from '@element-plus/icons-vue'

const router = useRouter()

const goHome = () => {
  router.push('/schedule')
}

const goBack = () => {
  router.back()
}
</script>

<style lang="scss" scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f5f7fa 0%, #e8ecf1 100%);
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.not-found-content {
  text-align: center;
  z-index: 1;

  .error-code {
    font-size: 160px;
    font-weight: 800;
    line-height: 1;
    background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -8px;
    margin-bottom: 20px;
    animation: bounce 2s ease-in-out infinite;
  }

  .error-title {
    font-size: 28px;
    color: #303133;
    margin: 0 0 12px;
  }

  .error-desc {
    font-size: 14px;
    color: #606266;
    margin: 0 0 36px;
  }

  .error-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;

    :deep(.el-button) {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

.not-found-decoration {
  position: absolute;
  bottom: -50px;
  right: -50px;
  opacity: 0.4;

  .decoration-svg {
    width: 300px;
    height: 300px;
    animation: spin 60s linear infinite;
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .not-found-content {
    .error-code {
      font-size: 100px;
      letter-spacing: -4px;
    }

    .error-title {
      font-size: 22px;
    }
  }
}
</style>
