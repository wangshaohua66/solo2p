<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const userStore = useUserStore()

const form = ref({ username: '', password: '', role: 'declarant' })
const loading = ref(false)

const roles = [
  { label: '企业申报员', value: 'declarant' },
  { label: '运营中心审核员', value: 'reviewer' },
  { label: '中心管理员', value: 'admin' }
]

async function handleLogin() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  setTimeout(() => {
    userStore.mockLogin(form.value.role as any)
    loading.value = false
    ElMessage.success('登录成功')
    router.push('/dashboard')
  }, 800)
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg"></div>
    <div class="login-container">
      <div class="login-left">
        <div class="brand">
          <div class="brand-logo">CB</div>
          <div class="brand-text">
            <div class="brand-title">跨境电商综合试验区</div>
            <div class="brand-sub">运营服务中心</div>
          </div>
        </div>
        <div class="brand-desc">
          <h2>一站式跨境电商服务平台</h2>
          <p>集成通关申报、HS编码检索、出口退税计算、异常跟踪等服务</p>
          <ul>
            <li>✓ 智能HS编码检索，降低归类错误率</li>
            <li>✓ 实时退税计算，政策自动匹配</li>
            <li>✓ 通关异常实时预警，处理透明高效</li>
            <li>✓ 多维数据看板，掌握业务全貌</li>
          </ul>
        </div>
      </div>

      <div class="login-right">
        <div class="login-card">
          <h3 class="login-title">用户登录</h3>
          <el-form @submit.prevent="handleLogin">
            <el-form-item>
              <el-input
                v-model="form.username"
                placeholder="用户名"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="form.password"
                type="password"
                placeholder="密码"
                size="large"
                show-password
                :prefix-icon="Lock"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item label="登录角色" label-width="80px">
              <el-radio-group v-model="form.role">
                <el-radio-button v-for="r in roles" :key="r.value" :value="r.value">
                  {{ r.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              style="width: 100%"
              :loading="loading"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form>
          <div class="login-tip">
            提示：演示环境任意用户名密码即可登录
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #e0f0ff 0%, #f5f7fa 50%, #fff5e6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 15% 20%, rgba(30,111,255,0.15), transparent 40%),
    radial-gradient(circle at 85% 80%, rgba(250,173,20,0.12), transparent 40%);
}

.login-container {
  position: relative;
  width: 1000px;
  max-width: 90vw;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  display: flex;
  overflow: hidden;
}

.login-left {
  width: 55%;
  padding: 48px 40px;
  background: linear-gradient(135deg, $primary-color, $primary-light);
  color: #fff;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 48px;

  .brand-logo {
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .brand-title {
    font-size: 18px;
    font-weight: 600;
  }

  .brand-sub {
    font-size: 13px;
    opacity: 0.85;
  }
}

.brand-desc {
  h2 {
    font-size: 26px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  p {
    font-size: 14px;
    opacity: 0.9;
    line-height: 1.7;
    margin-bottom: 28px;
  }

  ul {
    li {
      font-size: 14px;
      line-height: 2.2;
      opacity: 0.95;
    }
  }
}

.login-right {
  width: 45%;
  padding: 48px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  max-width: 340px;
}

.login-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 28px;
  color: $text-primary;
  text-align: center;
}

.login-tip {
  margin-top: 16px;
  font-size: 12px;
  color: $text-secondary;
  text-align: center;
}
</style>
