<template>
  <div class="glass p-5">
    <h3 class="text-base font-semibold mb-4" style="font-family: 'Playfair Display', serif; color: var(--text-primary);">Provenance Timeline</h3>

    <div class="relative pl-8">
      <div class="absolute left-3 top-2 bottom-2 w-0.5" style="background: var(--border-color);"></div>

      <div
        v-for="(event, i) in events"
        :key="i"
        class="relative mb-6 last:mb-0 fade-in-up"
        :style="`animation-delay: ${i * 0.1}s;`"
      >
        <div
          class="absolute -left-5 w-4 h-4 rounded-full border-2"
          style="border-color: var(--gold); background: var(--bg-deep);"
        >
          <div class="w-2 h-2 rounded-full m-auto mt-0.5" style="background: var(--gold);"></div>
        </div>

        <div class="ml-2">
          <div class="flex items-center gap-2 mb-1">
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              :style="`background: rgba(212, 168, 83, 0.15); color: var(--gold);`"
            >
              {{ event.operation }}
            </span>
            <span class="text-xs" style="color: var(--text-muted);">{{ event.timestamp }}</span>
          </div>
          <p class="text-sm" style="color: var(--text-secondary);">{{ event.description }}</p>
          <p class="text-xs font-mono mt-1" style="color: var(--text-muted);">{{ event.hash }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  events: Array<{
    operation: string
    description: string
    timestamp: string
    hash: string
  }>
}>()
</script>
