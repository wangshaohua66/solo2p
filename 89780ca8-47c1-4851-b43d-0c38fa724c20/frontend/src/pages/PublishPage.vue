<template>
  <div>
    <div class="flex items-center gap-4 mb-6">
      <button class="p-2 rounded-lg transition-colors" style="color: var(--text-secondary);" @click="$router.push('/creator')">
        <ArrowLeft :size="20" />
      </button>
      <h1 class="text-2xl font-bold" style="font-family: 'Playfair Display', serif;">Publish Collection</h1>
    </div>
    <PublishWizard />
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import PublishWizard from '@/components/PublishWizard.vue'
</script>
