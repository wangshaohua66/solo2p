<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElButton, ElResult } from 'element-plus'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <ElResult
      status="404"
      title="404"
      sub-title="抱歉，您访问的页面不存在"
    >
      <template #extra>
        <ElButton type="primary" @click="goHome">返回首页</ElButton>
      </template>
    </ElResult>
  </div>
</template>
