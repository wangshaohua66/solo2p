<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { MENU_GROUPS } from '@/constants'
import DynamicIcon from '@/components/ui/DynamicIcon.vue'
import { Sparkles } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-wine-grad text-white/90">
    <div class="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
      <div class="w-9 h-9 rounded-xl bg-gold-grad flex items-center justify-center shadow-soft">
        <Sparkles :size="18" class="text-wine-800" />
      </div>
      <div>
        <p class="font-display text-xl font-semibold leading-none text-white">锦时</p>
        <p class="text-[10px] tracking-[0.2em] text-gold-200 mt-1">WEDDING SUITE</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      <div v-for="group in MENU_GROUPS" :key="group.group">
        <p class="px-3 mb-1.5 text-[10px] tracking-widest text-white/40 uppercase">{{ group.group }}</p>
        <button
          v-for="item in group.items"
          :key="item.key"
          @click="go(item.path)"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200"
          :class="route.path.startsWith(item.path) ? 'bg-white/15 text-white shadow-soft' : 'text-white/70 hover:bg-white/8 hover:text-white'"
        >
          <DynamicIcon :name="item.icon" :size="17" />
          <span>{{ item.label }}</span>
          <span v-if="route.path.startsWith(item.path)" class="ml-auto w-1 h-4 rounded-full bg-gold-grad"></span>
        </button>
      </div>
    </nav>

    <div class="px-4 py-4 border-t border-white/10 text-[11px] text-white/40">
      <p>锦时婚礼管家 v1.0</p>
      <p class="mt-0.5">© 2026 锦时集团</p>
    </div>
  </aside>
</template>
