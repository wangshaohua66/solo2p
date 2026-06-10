<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <div class="error-code">
        <span>4</span>
        <div class="pottery-icon">
          <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="110" rx="40" ry="6" fill="#c85a32" opacity="0.3"/>
            <path d="M15 110C15 70 25 40 50 40C75 40 85 70 85 110" 
              stroke="#c85a32" stroke-width="4" fill="none"/>
            <ellipse cx="50" cy="40" rx="25" ry="8" fill="#d4a574"/>
            <rect x="45" y="10" width="10" height="30" rx="3" fill="#c85a32"/>
            <ellipse cx="50" cy="10" rx="6" ry="3" fill="#e07a52"/>
          </svg>
        </div>
        <span>4</span>
      </div>
      <h1 class="error-title">页面不存在</h1>
      <p class="error-desc">抱歉，您访问的页面不存在或已被移除。</p>
      <el-button type="primary" size="large" @click="goHome">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: $color-bg;
  padding: 20px;
}

.not-found-content {
  text-align: center;
}

.error-code {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120px;
  font-weight: 700;
  color: $color-primary;
  line-height: 1;
  margin-bottom: 20px;

  span {
    display: inline-block;
  }

  @media (max-width: $breakpoint-mobile) {
    font-size: 80px;
  }
}

.pottery-icon {
  width: 100px;
  height: 120px;
  margin: 0 10px;
  animation: float 3s ease-in-out infinite;

  svg {
    width: 100%;
    height: 100%;
  }

  @media (max-width: $breakpoint-mobile) {
    width: 70px;
    height: 84px;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 12px 0;
}

.error-desc {
  font-size: 14px;
  color: $color-text-secondary;
  margin: 0 0 24px 0;
}
</style>
