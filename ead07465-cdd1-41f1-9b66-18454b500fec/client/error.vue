<template>
  <div class="h-screen w-screen flex items-center justify-center bg-primary">
    <div class="card p-8 max-w-md text-center">
      <div class="text-6xl mb-4">⚠️</div>
      <h1 class="text-xl font-bold text-primary mb-2">应用错误</h1>
      <p class="text-muted text-sm mb-6">{{ error?.message || '发生未知错误' }}</p>
      <button class="btn btn-primary" @click="handleError">返回首页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error: { message: string; statusCode?: number }
}>()

const handleError = () => clearError({ redirect: '/' })
</script>
