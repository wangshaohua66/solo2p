<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loginTab = ref<'staff' | 'family'>('staff')
const loading = ref(false)
const loginFormRef = ref<FormInstance>()
const familyFormRef = ref<FormInstance>()

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const familyForm = reactive({
  orderNo: '',
  phone: '',
  verifyCode: ''
})

const countdown = ref(0)
const countdownTimer = ref<number | null>(null)

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const familyRules: FormRules = {
  orderNo: [{ required: true, message: '请输入业务单号', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号码', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }
  ],
  verifyCode: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
}

async function handleStaffLogin() {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await authStore.login(loginForm.username, loginForm.password)
      ElMessage.success('登录成功')
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
    } catch (error) {
      ElMessage.error('登录失败，请重试')
    } finally {
      loading.value = false
    }
  })
}

function handleFamilyQuery() {
  if (!familyFormRef.value) return
  familyFormRef.value.validate((valid) => {
    if (!valid) return
    ElMessage.info('家属查询功能开发中...')
  })
}

function sendVerifyCode() {
  if (countdown.value > 0) return
  if (!familyForm.phone || !/^1[3-9]\d{9}$/.test(familyForm.phone)) {
    ElMessage.warning('请输入正确的手机号码')
    return
  }
  countdown.value = 60
  countdownTimer.value = window.setInterval(() => {
    countdown.value--
    if (countdown.value <= 0 && countdownTimer.value) {
      clearInterval(countdownTimer.value)
      countdownTimer.value = null
    }
  }, 1000)
  ElMessage.success('验证码已发送')
}

onMounted(() => {
  document.body.classList.add('login-page')
})
</script>

<template>
  <div class="login-container">
    <div class="bg-decoration">
      <div class="golden-line line-1"></div>
      <div class="golden-line line-2"></div>
      <div class="golden-line line-3"></div>
      <div class="golden-line line-4"></div>
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>
      <div class="particles">
        <div v-for="i in 30" :key="i" class="particle" :style="{
          left: Math.random() * 100 + '%',
          top: Math.random() * 100 + '%',
          animationDelay: Math.random() * 8 + 's',
          animationDuration: 8 + Math.random() * 6 + 's'
        }"></div>
      </div>
    </div>

    <div class="login-header">
      <div class="system-logo">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M32 6C32 6 20 18 20 34C20 46 26 54 32 58C38 54 44 46 44 34C44 18 32 6 32 6Z"
            stroke="#C9A86C"
            stroke-width="2.5"
            fill="none"
          />
          <path
            d="M32 18C32 18 26 28 26 34C26 40 29 46 32 48C35 46 38 40 38 34C38 28 32 18 32 18Z"
            fill="#C9A86C"
            opacity="0.5"
          />
          <circle cx="32" cy="34" r="3" fill="#C9A86C" />
          <path d="M12 42L24 36" stroke="#C9A86C" stroke-width="2" opacity="0.6" />
          <path d="M52 42L40 36" stroke="#C9A86C" stroke-width="2" opacity="0.6" />
          <path d="M16 56L24 50" stroke="#C9A86C" stroke-width="2" opacity="0.4" />
          <path d="M48 56L40 50" stroke="#C9A86C" stroke-width="2" opacity="0.4" />
        </svg>
      </div>
      <div class="system-titles">
        <h1 class="system-name">殡葬管理综合服务平台</h1>
        <p class="system-subtitle">Funeral Management Integrated Service Platform</p>
      </div>
    </div>

    <div class="login-card">
      <div class="card-glow"></div>
      <div class="card-inner">
        <el-tabs v-model="loginTab" class="login-tabs" stretch>
          <el-tab-pane label="工作人员登录" name="staff">
            <el-form
              ref="loginFormRef"
              :model="loginForm"
              :rules="loginRules"
              class="login-form"
              @keyup.enter="handleStaffLogin"
            >
              <div class="form-title">欢迎登录</div>
              <div class="form-subtitle">请输入您的账号信息</div>

              <el-form-item prop="username">
                <el-input
                  v-model="loginForm.username"
                  placeholder="账号 / 用户名"
                  size="large"
                  class="login-input"
                >
                  <template #prefix>
                    <el-icon><User /></el-icon>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="密码"
                  size="large"
                  show-password
                  class="login-input"
                >
                  <template #prefix>
                    <el-icon><Lock /></el-icon>
                  </template>
                </el-input>
              </el-form-item>

              <div class="form-options">
                <el-checkbox v-model="loginForm.remember" class="remember-me">
                  记住账号
                </el-checkbox>
                <span class="forgot-pwd">忘记密码？</span>
              </div>

              <el-button
                type="primary"
                size="large"
                class="login-btn"
                :loading="loading"
                @click="handleStaffLogin"
              >
                <span v-if="!loading">登 录</span>
              </el-button>

              <div class="account-hints">
                <div class="hint-title">演示账号</div>
                <div class="hint-row">
                  <span class="hint-label">管理员：</span>
                  <span class="hint-value">admin</span>
                  <span class="hint-split"> / </span>
                  <span class="hint-label">任意密码</span>
                </div>
                <div class="hint-row">
                  <span class="hint-label">殡仪员：</span>
                  <span class="hint-value">staff</span>
                  <span class="hint-split"> / </span>
                  <span class="hint-label">任意密码</span>
                </div>
              </div>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="家属查询入口" name="family">
            <el-form
              ref="familyFormRef"
              :model="familyForm"
              :rules="familyRules"
              class="login-form"
              @keyup.enter="handleFamilyQuery"
            >
              <div class="form-title">业务查询</div>
              <div class="form-subtitle">请输入业务信息进行查询</div>

              <el-form-item prop="orderNo">
                <el-input
                  v-model="familyForm.orderNo"
                  placeholder="业务单号 / 登记编号"
                  size="large"
                  class="login-input"
                >
                  <template #prefix>
                    <el-icon><Document /></el-icon>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item prop="phone">
                <el-input
                  v-model="familyForm.phone"
                  placeholder="联系手机号"
                  size="large"
                  class="login-input"
                  maxlength="11"
                >
                  <template #prefix>
                    <el-icon><Phone /></el-icon>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item prop="verifyCode">
                <div class="verify-code-wrapper">
                  <el-input
                    v-model="familyForm.verifyCode"
                    placeholder="短信验证码"
                    size="large"
                    class="login-input verify-input"
                    maxlength="6"
                  >
                    <template #prefix>
                      <el-icon><Key /></el-icon>
                    </template>
                  </el-input>
                  <button
                    type="button"
                    class="send-code-btn"
                    :class="{ disabled: countdown > 0 }"
                    @click="sendVerifyCode"
                  >
                    {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                  </button>
                </div>
              </el-form-item>

              <el-button
                type="primary"
                size="large"
                class="login-btn"
                @click="handleFamilyQuery"
              >
                查 询
              </el-button>

              <div class="account-hints">
                <div class="hint-title">温馨提示</div>
                <div class="hint-text">如需帮助，请联系殡仪馆服务热线：</div>
                <div class="hint-phone">400-888-9999</div>
              </div>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <div class="login-footer">
      <span>© 2024 殡葬管理综合服务平台</span>
      <span class="footer-split">|</span>
      <span>技术支持：信息科技部</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1A1A1F 0%, #24242B 40%, #1A1A1F 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.golden-line {
  position: absolute;
  background: linear-gradient(90deg, transparent, rgba(201, 168, 108, 0.3), transparent);
  border-radius: 2px;

  &.line-1 {
    width: 400px;
    height: 1px;
    top: 20%;
    left: -200px;
    animation: slideRight 15s linear infinite;
  }

  &.line-2 {
    width: 300px;
    height: 1px;
    top: 50%;
    right: -150px;
    animation: slideLeft 12s linear infinite;
    animation-delay: 3s;
  }

  &.line-3 {
    width: 500px;
    height: 1px;
    top: 75%;
    left: -250px;
    animation: slideRight 18s linear infinite;
    animation-delay: 6s;
  }

  &.line-4 {
    width: 250px;
    height: 1px;
    top: 35%;
    right: -125px;
    animation: slideLeft 10s linear infinite;
    animation-delay: 1s;
  }
}

@keyframes slideRight {
  0% { transform: translateX(0); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(calc(100vw + 400px)); opacity: 0; }
}

@keyframes slideLeft {
  0% { transform: translateX(0); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(calc(-100vw - 300px)); opacity: 0; }
}

.corner {
  position: absolute;
  width: 80px;
  height: 80px;
  border: 1px solid rgba(201, 168, 108, 0.2);

  &.corner-tl {
    top: 40px;
    left: 40px;
    border-right: none;
    border-bottom: none;
  }

  &.corner-tr {
    top: 40px;
    right: 40px;
    border-left: none;
    border-bottom: none;
  }

  &.corner-bl {
    bottom: 40px;
    left: 40px;
    border-right: none;
    border-top: none;
  }

  &.corner-br {
    bottom: 40px;
    right: 40px;
    border-left: none;
    border-top: none;
  }
}

.particles {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: #C9A86C;
  border-radius: 50%;
  opacity: 0;
  animation: particleFloat 14s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    background: #C9A86C;
    border-radius: 50%;
    opacity: 0.3;
    filter: blur(4px);
  }
}

@keyframes particleFloat {
  0%, 100% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  15% {
    opacity: 0.8;
  }
  50% {
    opacity: 0.4;
    transform: translateY(-60px) scale(1);
  }
  85% {
    opacity: 0.8;
  }
}

.login-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 48px;
  z-index: 2;

  .system-logo {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 64px;
      height: 64px;
      filter: drop-shadow(0 0 20px rgba(201, 168, 108, 0.3));
    }
  }

  .system-titles {
    .system-name {
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0;
      letter-spacing: 2px;
      background: linear-gradient(135deg, #FFFFFF 0%, #C9A86C 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .system-subtitle {
      font-size: 13px;
      color: #6B6B74;
      margin: 8px 0 0 0;
      letter-spacing: 1px;
    }
  }
}

.login-card {
  position: relative;
  width: 440px;
  z-index: 2;
}

.card-glow {
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  background: linear-gradient(135deg, #C9A86C 0%, #8B7355 50%, #C9A86C 100%);
  padding: 2px;
  opacity: 0.6;
  filter: blur(2px);
  animation: glowPulse 4s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.card-inner {
  position: relative;
  background: linear-gradient(145deg, #2E2E36 0%, #24242B 100%);
  border-radius: 14px;
  border: 1px solid rgba(201, 168, 108, 0.3);
  padding: 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.login-tabs {
  :deep(.el-tabs__header) {
    margin: 0 0 28px 0;
    border-bottom: 1px solid #3A3A44;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    color: #6B6B74;
    font-size: 15px;
    font-weight: 500;
    height: 44px;
    line-height: 44px;
    transition: color 0.2s;

    &:hover {
      color: #B0B0B8;
    }

    &.is-active {
      color: #C9A86C;
    }
  }

  :deep(.el-tabs__active-bar) {
    background: linear-gradient(90deg, #C9A86C, #8B7355);
    height: 2px;
    border-radius: 1px;
  }
}

.login-form {
  .form-title {
    font-size: 22px;
    font-weight: 600;
    color: #FFFFFF;
    margin-bottom: 6px;
  }

  .form-subtitle {
    font-size: 13px;
    color: #6B6B74;
    margin-bottom: 28px;
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  .login-input {
    :deep(.el-input__wrapper) {
      background: #1A1A1F;
      border: 1px solid #3A3A44;
      border-radius: 8px;
      box-shadow: none;
      padding: 6px 14px;
      transition: all 0.2s;

      &:hover {
        border-color: #8B7355;
      }

      &.is-focus {
        border-color: #C9A86C;
        box-shadow: 0 0 0 3px rgba(201, 168, 108, 0.15);
      }
    }

    :deep(.el-input__inner) {
      color: #FFFFFF;
      font-size: 14px;

      &::placeholder {
        color: #6B6B74;
      }
    }

    :deep(.el-input__prefix-inner) {
      color: #6B6B74;
      margin-right: 4px;
    }
  }

  .form-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;

    :deep(.remember-me .el-checkbox__label) {
      color: #B0B0B8;
      font-size: 13px;
    }

    :deep(.remember-me .el-checkbox__inner) {
      background: #1A1A1F;
      border-color: #3A3A44;

      &:hover {
        border-color: #C9A86C;
      }
    }

    :deep(.remember-me.is-checked .el-checkbox__inner) {
      background: #C9A86C;
      border-color: #C9A86C;
    }

    .forgot-pwd {
      font-size: 13px;
      color: #C9A86C;
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.8;
      }
    }
  }

  .login-btn {
    width: 100%;
    height: 46px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 4px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #C9A86C 0%, #8B7355 100%);
    color: #1A1A1F;
    box-shadow: 0 4px 20px rgba(201, 168, 108, 0.3);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 28px rgba(201, 168, 108, 0.4);
      filter: brightness(1.08);
    }

    &:active {
      transform: translateY(0);
    }

    &.is-loading {
      background: linear-gradient(135deg, #8B7355 0%, #6B5545 100%);
    }
  }

  .verify-code-wrapper {
    display: flex;
    gap: 12px;
    width: 100%;

    .verify-input {
      flex: 1;
    }

    .send-code-btn {
      height: 40px;
      padding: 0 16px;
      border: 1px solid #3A3A44;
      border-radius: 8px;
      background: #1A1A1F;
      color: #C9A86C;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;

      &:hover {
        border-color: #C9A86C;
        background: rgba(201, 168, 108, 0.08);
      }

      &.disabled {
        color: #6B6B74;
        border-color: #3A3A44;
        background: #1A1A1F;
        cursor: not-allowed;
      }
    }
  }

  .account-hints {
    margin-top: 24px;
    padding: 16px;
    background: rgba(201, 168, 108, 0.05);
    border: 1px solid rgba(201, 168, 108, 0.15);
    border-radius: 8px;

    .hint-title {
      font-size: 12px;
      font-weight: 600;
      color: #C9A86C;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: '';
        width: 3px;
        height: 12px;
        background: #C9A86C;
        border-radius: 2px;
      }
    }

    .hint-row {
      font-size: 12px;
      color: #B0B0B8;
      line-height: 1.8;
    }

    .hint-label {
      color: #6B6B74;
    }

    .hint-value {
      color: #C9A86C;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .hint-split {
      color: #3A3A44;
    }

    .hint-text {
      font-size: 12px;
      color: #B0B0B8;
      line-height: 1.8;
    }

    .hint-phone {
      font-size: 16px;
      font-weight: 600;
      color: #C9A86C;
      margin-top: 6px;
      letter-spacing: 1px;
    }
  }
}

.login-footer {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #6B6B74;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 2;

  .footer-split {
    opacity: 0.5;
  }
}
</style>
