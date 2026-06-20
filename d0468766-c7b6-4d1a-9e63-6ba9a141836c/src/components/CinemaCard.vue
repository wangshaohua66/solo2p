<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'
import type { Cinema } from '@/types'

const props = defineProps<{
  cinema: Cinema
}>()

const currentIndex = ref(0)
let timer: number | null = null

const images = computed(() => {
  if (props.cinema.images?.length) return props.cinema.images
  return [
    `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('cinema lobby interior with golden lighting luxury design dark atmosphere')}&image_size=landscape_16_9`,
    `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('movie theater auditorium red seats golden screen')}&image_size=landscape_16_9`,
    `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('cinema concession stand popcorn and drinks counter')}&image_size=landscape_16_9`
  ]
})

const statusMeta: Record<string, { text: string; color: string; bg: string }> = {
  open: { text: '营业中', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  maintenance: { text: '维护中', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  closed: { text: '已关闭', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
}

function next() {
  currentIndex.value = (currentIndex.value + 1) % images.value.length
}
function prev() {
  currentIndex.value = (currentIndex.value - 1 + images.value.length) % images.value.length
}
function goTo(i: number) {
  currentIndex.value = i
}

onMounted(() => {
  timer = window.setInterval(next, 4000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="cinema-card" @mouseenter="timer && clearInterval(timer)" @mouseleave="timer = window.setInterval(next, 4000)">
    <div class="carousel">
      <transition name="fade" mode="out-in">
        <img v-for="(img, i) in images" :key="i" v-show="i === currentIndex" :src="img" :alt="cinema.name" class="carousel-img" />
      </transition>
      <button class="arrow left" @click="prev"><component :is="(ElIcons as any).ArrowLeft" /></button>
      <button class="arrow right" @click="next"><component :is="(ElIcons as any).ArrowRight" /></button>
      <div class="dots">
        <span v-for="(_, i) in images" :key="i" class="dot" :class="{ active: i === currentIndex }" @click="goTo(i)" />
      </div>
      <div class="status-tag" :style="{ color: statusMeta[cinema.status].color, background: statusMeta[cinema.status].bg }">
        {{ statusMeta[cinema.status].text }}
      </div>
    </div>
    <div class="cc-body">
      <div class="cc-head">
        <strong class="cc-name">{{ cinema.name }}</strong>
        <span class="cc-rating">
          <component :is="(ElIcons as any).StarFilled" />
          4.{{ (cinema.name.length % 5) + 5 }}
        </span>
      </div>
      <div class="cc-info">
        <span><component :is="(ElIcons as any).Location" />{{ cinema.address }}</span>
        <span><component :is="(ElIcons as any).Phone" />{{ cinema.phone }}</span>
        <span><component :is="(ElIcons as any).Clock" />{{ cinema.businessHours }}</span>
      </div>
      <div class="cc-stats">
        <div>
          <strong class="num">{{ cinema.halls }}</strong>
          <span>影厅数</span>
        </div>
        <div>
          <strong class="num">{{ cinema.screens }}</strong>
          <span>银幕数</span>
        </div>
        <div>
          <strong class="num gold-text">¥{{ (cinema.todayBoxOffice / 10000).toFixed(1) }}万</strong>
          <span>今日票房</span>
        </div>
        <div>
          <strong class="num">{{ cinema.todayAudience }}</strong>
          <span>今日观众</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cinema-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.25s ease;
  &:hover {
    border-color: $gold-line;
    box-shadow: $shadow-gold;
    transform: translateY(-3px);
  }
}
.carousel {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a26, #0f0f17);
  .carousel-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: $gold;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s ease;
    &.left { left: 10px; }
    &.right { right: 10px; }
  }
  &:hover .arrow {
    opacity: 1;
  }
  .dots {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      transition: all 0.2s ease;
      &.active {
        background: $gold;
        width: 18px;
        border-radius: 3px;
      }
    }
  }
  .status-tag {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
}
.cc-body {
  padding: 14px;
}
.cc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  .cc-name {
    font-size: 16px;
    color: var(--c-text-primary);
    font-family: var(--font-display);
  }
  .cc-rating {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 13px;
    color: $gold;
    font-weight: 600;
  }
}
.cc-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--c-text-secondary);
    :deep(.el-icon) {
      font-size: 13px;
      color: $gold;
    }
  }
}
.cc-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
  div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    strong {
      font-size: 15px;
      color: var(--c-text-primary);
    }
    span {
      font-size: 10px;
      color: var(--c-text-tertiary);
    }
  }
}
</style>
