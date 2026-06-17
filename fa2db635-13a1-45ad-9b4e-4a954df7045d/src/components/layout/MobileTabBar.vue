<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { MENU_GROUPS } from '@/constants'
import DynamicIcon from '@/components/ui/DynamicIcon.vue'

const route = useRoute()
const router = useRouter()

const tabs = MENU_GROUPS.flatMap((g) => g.items).slice(0, 5)
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-wine-100 flex">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      @click="router.push(tab.path)"
      class="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition"
      :class="route.path.startsWith(tab.path) ? 'text-wine-700' : 'text-wine-300'"
    >
      <DynamicIcon :name="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>
