<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const route = useRoute()

const layoutComponent = computed(() => {
  if (route.meta.layout === 'auth') {
    return AuthLayout
  }
  return AppLayout
})
</script>

<template>
  <transition name="fade" mode="out-in">
    <component :is="layoutComponent">
      <router-view v-slot="{ Component }">
        <transition name="slide-up" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </component>
  </transition>
</template>
