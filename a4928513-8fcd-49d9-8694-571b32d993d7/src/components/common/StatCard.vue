<template>
  <div class="stat-card">
    <div class="stat-content">
      <div class="stat-value">{{ formattedValue }}</div>
      <div class="stat-title">{{ title }}</div>
      <div v-if="trend !== undefined || trendText" class="stat-trend">
        <span :class="['trend-icon', { 'trend-up': trend! > 0, 'trend-down': trend! < 0 }]">
          <el-icon v-if="trend! > 0"><CaretTop /></el-icon>
          <el-icon v-else-if="trend! < 0"><CaretBottom /></el-icon>
        </span>
        <span v-if="trendText" class="trend-text">{{ trendText }}</span>
        <span v-else class="trend-text">
          {{ trend! > 0 ? '+' : '' }}{{ trend }}%
        </span>
      </div>
    </div>
    <div class="stat-icon">
      <el-icon>
        <component :is="iconComponent" />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CaretTop,
  CaretBottom,
  Document,
  Van,
  Calendar,
  Money,
  User,
  Box,
  DataAnalysis,
  Wallet,
  Present,
  Medal,
  Star,
  Ticket,
  List,
  TrendCharts,
  LocationFilled,
  MapLocation,
  Setting
} from '@element-plus/icons-vue'

const ICON_MAP: Record<string, any> = {
  Document,
  Van,
  Calendar,
  Money,
  User,
  Box,
  DataAnalysis,
  Wallet,
  Present,
  Medal,
  Star,
  Ticket,
  List,
  TrendCharts,
  LocationFilled,
  MapLocation,
  Setting,
  Odometer: DataAnalysis
}

const props = withDefaults(
  defineProps<{
    title: string
    value: number | string
    icon: any
    trend?: number
    trendText?: string
  }>(),
  {
    trend: undefined,
    trendText: ''
  }
)

const iconComponent = computed(() => {
  if (typeof props.icon === 'string') {
    return ICON_MAP[props.icon] || Document
  }
  return props.icon || Document
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString('zh-CN')
  }
  return props.value
})
</script>

<style lang="scss" scoped>
.stat-card {
  position: relative;
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all 0.3s ease;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, $color-funeral-gold 0%, $color-funeral-gold-dark 100%);
    opacity: 0.6;
  }

  &:hover {
    border-color: $color-funeral-gold;
    box-shadow: $shadow-card-hover;
    transform: translateY(-2px);

    &::before {
      opacity: 1;
    }
  }
}

.stat-content {
  flex: 1;
  z-index: 1;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 12px;
  background: linear-gradient(135deg, $color-funeral-gold-light 0%, $color-funeral-gold 60%, $color-funeral-gold-dark 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.stat-title {
  font-size: 14px;
  color: $color-funeral-text-secondary;
  margin-bottom: 8px;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, 0.04);
}

.trend-icon {
  display: inline-flex;
  align-items: center;

  &.trend-up {
    color: $color-status-success;
  }

  &.trend-down {
    color: $color-status-error;
  }
}

.trend-text {
  font-weight: 500;

  :deep(.trend-up) & {
    color: $color-status-success;
  }

  :deep(.trend-down) & {
    color: $color-status-error;
  }
}

.trend-up .trend-text {
  color: $color-status-success;
}

.trend-down .trend-text {
  color: $color-status-error;
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba($color-funeral-gold, 0.15) 0%, rgba($color-funeral-gold-dark, 0.08) 100%);
  border: 1px solid rgba($color-funeral-gold, 0.2);
  border-radius: $radius-lg;
  font-size: 28px;
  color: rgba($color-funeral-gold, 0.7);
  z-index: 1;

  :deep(.el-icon) {
    width: 28px;
    height: 28px;
  }
}
</style>
