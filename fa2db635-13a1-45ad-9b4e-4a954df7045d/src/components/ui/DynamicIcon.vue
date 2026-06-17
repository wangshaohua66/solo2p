<script setup lang="ts">
import type { Component } from 'vue'
import {
  LayoutDashboard,
  CalendarDays,
  HeartHandshake,
  ListChecks,
  Package,
  Calculator,
  FileSignature,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-vue-next'

defineProps<{ name: string; size?: number }>()

const map: Record<string, Component> = {
  LayoutDashboard,
  CalendarDays,
  HeartHandshake,
  ListChecks,
  Package,
  Calculator,
  FileSignature,
  Wallet,
  BarChart3,
  Settings,
}
</script>

<template>
  <component :is="map[name]" :size="size || 18" />
</template>
