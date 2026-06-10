<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { ElMessage } from 'element-plus'
import type { RegisterRequest, MemberTier } from '@/types'

const router = useRouter()

const registerForm = reactive<RegisterRequest & { confirmPassword: string; agreeTerms: boolean }>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  tier: 'experience',
  agreeTerms: false
})

const loading = ref(false)

const tierOptions = [
  { value: 'experience', label: '体验卡', desc: '单次体验，适合新手尝试' },
  { value: 'monthly', label: '月卡', desc: '30天有效期，课程9折优惠' },
  { value: 'quarterly', label: '季卡', desc: '90天有效期，课程8折优惠' },
  { value: 'yearly', label: '年卡', desc: '365天有效期，课程7折优惠' }
]

const handleRegister = async () => {
  if (!registerForm.username || !registerForm.email || !registerForm.password) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  
  if (!registerForm.agreeTerms) {
    ElMessage.warning('请阅读并同意用户协议')
    return
  }
  
  loading.value = true
  try {
    await authApi.register({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      phone: registerForm.phone,
      tier: registerForm.tier as MemberTier
    })
    ElMessage.success('注册成功，请登录')
    router.push('/login')
  } catch (error) {
    console.error('Register failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <h2 class="register-title">创建账号</h2>
    <p class="register-subtitle">加入陶艺工坊，开启您的创作之旅</p>
    
    <el-form :model="registerForm" class="register-form">
      <el-form-item label="用户名" required>
        <el-input 
          v-model="registerForm.username" 
          placeholder="请输入用户名"
          :prefix-icon="User"
        />
      </el-form-item>
      
      <el-form-item label="邮箱" required>
        <el-input 
          v-model="registerForm.email" 
          type="email"
          placeholder="请输入邮箱地址"
          :prefix-icon="Message"
        />
      </el-form-item>
      
      <el-form-item label="手机号">
        <el-input 
          v-model="registerForm.phone" 
          placeholder="请输入手机号（选填）"
          :prefix-icon="Phone"
        />
      </el-form-item>
      
      <el-form-item label="密码" required>
        <el-input 
          v-model="registerForm.password" 
          type="password"
          placeholder="请设置密码（至少6位）"
          :prefix-icon="Lock"
          show-password
        />
      </el-form-item>
      
      <el-form-item label="确认密码" required>
        <el-input 
          v-model="registerForm.confirmPassword" 
          type="password"
          placeholder="请再次输入密码"
          :prefix-icon="Lock"
          show-password
        />
      </el-form-item>
      
      <el-form-item label="会员类型">
        <el-radio-group v-model="registerForm.tier" class="tier-radio-group">
          <div class="tier-options">
            <el-radio 
              v-for="tier in tierOptions" 
              :key="tier.value" 
              :label="tier.value"
              class="tier-radio"
            >
              <div class="tier-info">
                <span class="tier-name">{{ tier.label }}</span>
                <span class="tier-desc">{{ tier.desc }}</span>
              </div>
            </el-radio>
          </div>
        </el-radio-group>
      </el-form-item>
      
      <el-form-item>
        <el-checkbox v-model="registerForm.agreeTerms">
          我已阅读并同意《用户协议》和《隐私政策》
        </el-checkbox>
      </el-form-item>
      
      <el-button 
        type="primary" 
        size="large" 
        class="register-btn"
        :loading="loading"
        @click="handleRegister"
      >
        注册
      </el-button>
    </el-form>
    
    <div class="register-footer">
      <span>已有账号？</span>
      <router-link to="/login" class="login-link">立即登录</router-link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.register-page {
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.register-title {
  font-size: 28px;
  font-weight: 700;
  color: $color-text-primary;
  margin-bottom: 8px;
}

.register-subtitle {
  font-size: 14px;
  color: $color-text-secondary;
  margin-bottom: 24px;
}

.register-form {
  margin-bottom: 20px;
}

.tier-radio-group {
  width: 100%;
}

.tier-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tier-radio {
  :deep(.el-radio__input) {
    margin-right: 12px;
  }
  
  :deep(.el-radio__label) {
    flex: 1;
  }
}

.tier-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tier-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.tier-desc {
  font-size: 12px;
  color: $color-text-secondary;
}

.register-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 500;
  --el-button-bg-color: $color-primary;
  --el-button-border-color: $color-primary;
  --el-button-hover-bg-color: $color-primary-light;
  --el-button-hover-border-color: $color-primary-light;
  --el-button-active-bg-color: $color-primary-dark;
  --el-button-active-border-color: $color-primary-dark;
}

.register-footer {
  text-align: center;
  font-size: 14px;
  color: $color-text-secondary;
}

.login-link {
  color: $color-primary;
  font-weight: 500;
  margin-left: 4px;
}
</style>
