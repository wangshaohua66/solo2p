<script setup lang="ts">
withDefaults(defineProps<{ title?: string; subtitle?: string; padding?: boolean }>(), { padding: true })
</script>

<template>
  <section class="card" :class="padding ? 'p-5' : ''">
    <header v-if="title || $slots.header" class="mb-4 flex items-center justify-between">
      <div v-if="title">
        <h3 class="font-serif text-lg text-wine-800 font-semibold">{{ title }}</h3>
        <p v-if="subtitle" class="text-xs text-wine-300 mt-0.5">{{ subtitle }}</p>
      </div>
      <slot name="header" />
    </header>
    <slot />
    <slot name="footer" />
  </section>
</template>
