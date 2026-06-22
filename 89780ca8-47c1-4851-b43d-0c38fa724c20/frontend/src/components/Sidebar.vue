<template>
  <aside
    class="fixed left-0 top-0 h-full z-50 transition-all duration-300 flex flex-col"
    :class="collapsed ? 'w-[72px]' : 'w-[240px]'"
    style="background: rgba(10, 14, 39, 0.95); border-right: 1px solid var(--border-color);"
  >
    <div class="flex items-center h-16 px-4 border-b" style="border-color: var(--border-color);">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, var(--gold), var(--gold-light));">
        <span class="text-lg font-bold" style="color: var(--bg-deep);">N</span>
      </div>
      <span v-if="!collapsed" class="ml-3 text-lg font-semibold" style="font-family: 'Playfair Display', serif; color: var(--gold);">NexusTrade</span>
    </div>

    <nav class="flex-1 py-4 px-2 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center px-3 py-3 rounded-lg transition-all duration-200 group"
        :class="isActive(item.path) ? 'bg-opacity-20' : 'hover:bg-opacity-10'"
        :style="isActive(item.path) ? 'background: rgba(212, 168, 83, 0.15); color: var(--gold);' : 'color: var(--text-secondary);'"
        @mouseenter="(e: MouseEvent) => { if (!isActive(item.path)) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }"
        @mouseleave="(e: MouseEvent) => { if (!isActive(item.path)) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }"
      >
        <component :is="item.icon" :size="20" />
        <span v-if="!collapsed" class="ml-3 text-sm font-medium">{{ item.label }}</span>
        <div
          v-if="isActive(item.path)"
          class="absolute left-0 w-1 h-6 rounded-r-full"
          style="background: var(--gold);"
        />
      </router-link>
    </nav>

    <div class="p-3 border-t" style="border-color: var(--border-color);">
      <button
        class="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
        style="color: var(--text-secondary);"
        @click="$emit('toggle')"
      >
        <ChevronLeft :size="18" :class="{ 'rotate-180': collapsed }" class="transition-transform" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ShoppingBag, Wallet, Palette, BarChart3, Shield, ChevronLeft } from 'lucide-vue-next'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()

const navItems = [
  { label: 'Market', path: '/', icon: ShoppingBag },
  { label: 'Assets', path: '/assets', icon: Wallet },
  { label: 'Creator', path: '/creator', icon: Palette },
  { label: 'Statistics', path: '/statistics', icon: BarChart3 },
  { label: 'Risk', path: '/risk', icon: Shield },
]

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>
