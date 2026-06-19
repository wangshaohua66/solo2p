<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
  noPadding?: boolean
}>()
</script>

<template>
  <section class="panel">
    <header class="panel-head" v-if="title || $slots.head">
      <slot name="head">
        <div class="head-left">
          <span class="head-bar" aria-hidden="true" />
          <div class="head-text">
            <h3 class="display">{{ title }}</h3>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div class="head-right">
          <slot name="action" />
        </div>
      </slot>
    </header>
    <div class="panel-body" :class="{ 'no-pad': noPadding }">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel {
  @include card-base;
  @include gold-top-line;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--c-border);
}
.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head-bar {
  width: 4px;
  height: 18px;
  background: $grad-gold;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(232, 181, 71, 0.5);
}
.head-text {
  h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--c-text-primary);
    letter-spacing: 0.03em;
  }
  p {
    font-size: 12px;
    color: var(--c-text-tertiary);
    margin-top: 2px;
  }
}
.panel-body {
  padding: 22px;
  &.no-pad {
    padding: 0;
  }
}
</style>
