<template>
  <el-config-provider :locale="zhCn" :size="'default'">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>
