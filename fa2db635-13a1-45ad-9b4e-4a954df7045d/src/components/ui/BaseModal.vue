<script setup lang="ts">
import { X } from 'lucide-vue-next'
defineProps<{ show: boolean; title?: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-wine-900/40 backdrop-blur-sm" @click="emit('close')"></div>
        <div class="relative card w-full shadow-lift animate-rise" :style="{ maxWidth: width || '520px' }">
          <header v-if="title" class="flex items-center justify-between px-5 py-4 border-b border-wine-100">
            <h3 class="font-serif text-lg text-wine-800 font-semibold">{{ title }}</h3>
            <button class="text-wine-300 hover:text-wine-700 transition" @click="emit('close')">
              <X :size="18" />
            </button>
          </header>
          <div class="p-5 max-h-[70vh] overflow-y-auto">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="px-5 py-4 border-t border-wine-100 flex justify-end gap-2">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
