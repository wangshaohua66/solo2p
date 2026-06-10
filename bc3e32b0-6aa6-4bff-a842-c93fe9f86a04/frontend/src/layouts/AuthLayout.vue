<script setup lang="ts">
</script>

<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-left">
        <div class="brand">
          <div class="logo">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="32" cy="52" rx="20" ry="6" fill="#c85a32" opacity="0.3"/>
              <path d="M16 52C16 40 22 28 32 28C42 28 48 40 48 52" stroke="#c85a32" stroke-width="3" fill="none"/>
              <ellipse cx="32" cy="28" rx="10" ry="5" fill="#d4a574"/>
              <rect x="29" y="12" width="6" height="16" rx="2" fill="#c85a32"/>
              <ellipse cx="32" cy="12" rx="4" ry="2" fill="#e07a52"/>
            </svg>
          </div>
          <h1 class="brand-title">陶艺工坊</h1>
          <p class="brand-subtitle">Pottery Studio Management</p>
        </div>
        <div class="decoration">
          <div class="circle circle-1"></div>
          <div class="circle circle-2"></div>
          <div class="circle circle-3"></div>
        </div>
        <div class="features">
          <div class="feature-item">
            <span class="feature-icon">🔥</span>
            <span>智能窑炉排程</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <span>釉料配方管理</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🏺</span>
            <span>作品电子档案</span>
          </div>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-form-wrapper">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #faf8f5 0%, #f0e6dc 100%);
  padding: 20px;
}

.auth-container {
  display: flex;
  width: 100%;
  max-width: 1200px;
  min-height: 600px;
  background: white;
  border-radius: $border-radius-lg;
  box-shadow: $shadow-lg;
  overflow: hidden;
}

.auth-left {
  flex: 1;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;

  @media (max-width: 900px) {
    display: none;
  }
}

.brand {
  position: relative;
  z-index: 2;
}

.logo {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  
  svg {
    width: 100%;
    height: 100%;
  }
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  color: white;
  margin-bottom: 8px;
}

.brand-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
}

.decoration {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);

  &.circle-1 {
    width: 300px;
    height: 300px;
    top: -100px;
    right: -100px;
  }

  &.circle-2 {
    width: 200px;
    height: 200px;
    bottom: 50px;
    left: -50px;
  }

  &.circle-3 {
    width: 100px;
    height: 100px;
    top: 50%;
    left: 30%;
  }
}

.features {
  position: relative;
  z-index: 2;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-size: 16px;
  margin-bottom: 16px;
}

.feature-icon {
  font-size: 24px;
}

.auth-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.auth-form-wrapper {
  width: 100%;
  max-width: 400px;
}
</style>
