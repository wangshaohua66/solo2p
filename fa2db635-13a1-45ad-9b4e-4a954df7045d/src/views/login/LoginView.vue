<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLE_OPTIONS } from '@/constants'
import { Sparkles, ArrowRight, User2, Lock } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const username = ref('林婉清')
const password = ref('123456')
const role = ref('OPERATOR')
const loading = ref(false)
const err = ref('')

async function submit() {
  err.value = ''
  loading.value = true
  try {
    await auth.login(username.value, password.value, role.value)
    router.push('/dashboard')
  } catch {
    err.value = '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

function toSupplier() {
  router.push('/supplier-login')
}
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-2">
    <!-- 视觉面板 -->
    <div class="relative hidden lg:flex flex-col justify-between p-12 bg-wine-grad text-white overflow-hidden">
      <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle at 20% 30%, rgba(201,168,106,0.5) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,168,106,0.3) 0, transparent 35%)"></div>
      <div class="absolute -right-20 top-20 w-80 h-80 rounded-full border border-gold-300/20"></div>
      <div class="absolute -right-10 top-40 w-60 h-60 rounded-full border border-gold-300/15"></div>

      <div class="relative flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gold-grad flex items-center justify-center">
          <Sparkles :size="20" class="text-wine-800" />
        </div>
        <div>
          <p class="font-display text-2xl font-semibold">锦时</p>
          <p class="text-[10px] tracking-[0.3em] text-gold-200">WEDDING SUITE</p>
        </div>
      </div>

      <div class="relative max-w-md">
        <p class="font-display italic text-gold-200 text-lg mb-3">Since 2018</p>
        <h1 class="font-display text-5xl font-semibold leading-tight">为每一场<br />仪式感<span class="text-gold-300">而生</span></h1>
        <p class="mt-6 text-white/70 leading-relaxed">
          覆盖档期避让、报价标准化、合同在线签署与财务自动核算的全流程数字化管理平台，让 8 家门店、年均 1200 场婚礼井然有序。
        </p>
        <div class="mt-8 flex gap-6">
          <div>
            <p class="num font-display text-3xl text-gold-300">1200<span class="text-sm text-white/50">+/年</span></p>
            <p class="text-xs text-white/50 mt-1">承接婚礼</p>
          </div>
          <div class="w-px bg-white/15"></div>
          <div>
            <p class="num font-display text-3xl text-gold-300">8</p>
            <p class="text-xs text-white/50 mt-1">连锁门店</p>
          </div>
          <div class="w-px bg-white/15"></div>
          <div>
            <p class="num font-display text-3xl text-gold-300">6<span class="text-sm text-white/50">阶段</span></p>
            <p class="text-xs text-white/50 mt-1">全流程</p>
          </div>
        </div>
      </div>

      <p class="relative text-xs text-white/40">© 2026 锦时婚礼管家 · 全流程数字化管理平台</p>
    </div>

    <!-- 表单面板 -->
    <div class="flex items-center justify-center p-6 sm:p-12 bg-cream">
      <div class="w-full max-w-sm">
        <div class="lg:hidden flex items-center gap-2.5 mb-8">
          <div class="w-10 h-10 rounded-xl bg-wine-grad flex items-center justify-center">
            <Sparkles :size="20" class="text-gold-300" />
          </div>
          <p class="font-display text-2xl font-semibold text-wine-800">锦时</p>
        </div>

        <h2 class="font-display text-3xl font-semibold text-wine-800">欢迎回来</h2>
        <p class="text-sm text-wine-400 mt-1.5">选择您的角色并登录工作台</p>

        <form class="mt-8 space-y-4" @submit.prevent="submit">
          <div>
            <label class="field-label">选择角色</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="r in ROLE_OPTIONS"
                :key="r.value"
                type="button"
                @click="role = r.value"
                class="h-10 rounded-[10px] text-sm border transition-all"
                :class="role === r.value ? 'border-wine-600 bg-wine-50 text-wine-700 font-medium shadow-soft' : 'border-wine-100 text-wine-400 hover:border-gold-300'"
              >
                {{ r.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="field-label">账号</label>
            <div class="relative">
              <User2 :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
              <input v-model="username" class="field-input pl-9" placeholder="请输入账号" />
            </div>
          </div>

          <div>
            <label class="field-label">密码</label>
            <div class="relative">
              <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
              <input v-model="password" type="password" class="field-input pl-9" placeholder="请输入密码" />
            </div>
          </div>

          <p v-if="err" class="text-xs text-rose-500">{{ err }}</p>

          <button type="submit" class="btn-primary w-full h-11" :disabled="loading">
            {{ loading ? '登录中…' : '进入工作台' }}
            <ArrowRight :size="16" />
          </button>
        </form>

        <div class="mt-6 pt-6 border-t border-wine-100 text-center">
          <button class="text-sm text-wine-400 hover:text-wine-700 transition" @click="toSupplier">
            我是供应商 · 进入供应商门户 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
