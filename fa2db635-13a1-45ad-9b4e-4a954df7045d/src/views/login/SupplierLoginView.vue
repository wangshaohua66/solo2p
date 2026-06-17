<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Sparkles, ArrowRight, Phone, KeyRound } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const phone = ref('13800138001')
const code = ref('888888')
const loading = ref(false)

async function submit() {
  loading.value = true
  try {
    await auth.supplierLogin(phone.value, code.value)
    router.push('/portal/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-cream relative overflow-hidden">
    <div class="absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(rgba(91,42,78,0.6) 1px, transparent 1px); background-size: 18px 18px"></div>
    <div class="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold-100/40 blur-3xl"></div>

    <div class="relative w-full max-w-md card p-8 shadow-lift animate-rise">
      <div class="flex items-center gap-2.5 mb-6">
        <div class="w-11 h-11 rounded-xl bg-wine-grad flex items-center justify-center">
          <Sparkles :size="20" class="text-gold-300" />
        </div>
        <div>
          <p class="font-display text-2xl font-semibold text-wine-800">锦时 · 供应商</p>
          <p class="text-[11px] text-wine-400">摄影师 / 化妆师 / 主持人 / 花艺师</p>
        </div>
      </div>

      <h2 class="font-display text-2xl font-semibold text-wine-800">服务档期门户</h2>
      <p class="text-sm text-wine-400 mt-1">输入手机号与验证码，查看档期与接单</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label class="field-label">手机号</label>
          <div class="relative">
            <Phone :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
            <input v-model="phone" class="field-input pl-9" placeholder="请输入手机号" />
          </div>
        </div>
        <div>
          <label class="field-label">验证码</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <KeyRound :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-wine-300" />
              <input v-model="code" class="field-input pl-9" placeholder="验证码" />
            </div>
            <button type="button" class="btn-ghost w-28 shrink-0">获取验证码</button>
          </div>
        </div>
        <button type="submit" class="btn-primary w-full h-11" :disabled="loading">
          {{ loading ? '登录中…' : '进入门户' }} <ArrowRight :size="16" />
        </button>
      </form>

      <p class="mt-5 text-center text-xs text-wine-300">演示账号已预填，直接登录即可</p>
      <div class="mt-4 pt-4 border-t border-wine-100 text-center">
        <button class="text-sm text-wine-400 hover:text-wine-700 transition" @click="router.push('/login')">
          ← 返回主系统登录
        </button>
      </div>
    </div>
  </div>
</template>
