<template>
  <div class="status-timeline">
    <div
      v-for="(record, index) in timelineNodes"
      :key="record.status"
      :class="['timeline-item', record.state]"
    >
      <div class="timeline-left">
        <div class="timeline-dot-wrapper">
          <div class="timeline-dot" :style="getDotStyle(record)">
            <el-icon v-if="record.state === 'completed'" class="dot-icon"><Check /></el-icon>
            <span v-else class="dot-number">{{ index + 1 }}</span>
          </div>
          <div v-if="record.state === 'current'" class="dot-pulse"></div>
        </div>
        <div v-if="index < timelineNodes.length - 1" class="timeline-line" :class="record.state"></div>
      </div>

      <div class="timeline-content">
        <div class="timeline-header">
          <span class="status-label" :style="getStatusLabelStyle(record)">
            {{ getStatusLabel(record.status) }}
          </span>
          <span v-if="record.state !== 'pending'" class="status-time">
            <el-icon><Clock /></el-icon>
            {{ record.time }}
          </span>
        </div>
        <div v-if="record.state !== 'pending'" class="timeline-operator">
          <el-icon><User /></el-icon>
          <span>{{ record.operatorName }}</span>
          <span v-if="record.remark" class="timeline-remark">· {{ record.remark }}</span>
        </div>
        <div v-else class="timeline-pending-hint">
          尚未到达此状态
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Clock, User } from '@element-plus/icons-vue'
import type { StatusRecord, RemainsStatus } from '@/types/remains'
import { remainsStatusFlow, getRemainsStatusInfo } from '@/utils/status'

type NodeState = 'completed' | 'current' | 'pending'

interface TimelineNode extends Partial<StatusRecord> {
  status: RemainsStatus
  state: NodeState
}

const props = defineProps<{
  history: StatusRecord[]
  current: RemainsStatus
}>()

const timelineNodes = computed<TimelineNode[]>(() => {
  const currentIndex = remainsStatusFlow.indexOf(props.current)
  return remainsStatusFlow.map((status, flowIndex) => {
    const record = props.history.find((h) => h.status === status)
    let state: NodeState = 'pending'
    if (record) {
      state = status === props.current ? 'current' : 'completed'
    } else if (flowIndex < currentIndex && currentIndex !== -1) {
      state = 'completed'
    } else if (status === props.current) {
      state = 'current'
    }
    return {
      status,
      state,
      ...record
    }
  })
})

function getStatusLabel(status: RemainsStatus): string {
  return getRemainsStatusInfo(status).label
}

function getDotStyle(node: TimelineNode): Record<string, string> {
  const info = getRemainsStatusInfo(node.status)
  if (node.state === 'completed') {
    return {
      backgroundColor: '#52C41A',
      borderColor: '#52C41A'
    }
  }
  if (node.state === 'current') {
    return {
      backgroundColor: info.color || '#C9A86C',
      borderColor: info.color || '#C9A86C',
      boxShadow: `0 0 0 4px ${info.color || '#C9A86C'}33, 0 0 20px ${info.color || '#C9A86C'}55`
    }
  }
  return {
    backgroundColor: 'transparent',
    borderColor: '#3A3A44'
  }
}

function getStatusLabelStyle(node: TimelineNode): Record<string, string> {
  const info = getRemainsStatusInfo(node.status)
  if (node.state === 'completed') {
    return { color: '#52C41A' }
  }
  if (node.state === 'current') {
    return { color: info.color || '#C9A86C', fontWeight: '600' }
  }
  return { color: '#6B6B74' }
}
</script>

<style lang="scss" scoped>
.status-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 8px 0;
}

.timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}

.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 32px;
}

.timeline-dot-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timeline-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.3s ease;

  .dot-icon {
    width: 13px;
    height: 13px;
    color: #fff;
  }

  .dot-number {
    font-size: 11px;
    font-weight: 600;
    color: #6B6B74;
  }
}

.timeline-item.current .timeline-dot .dot-number {
  color: #fff;
}

.dot-pulse {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba($color-funeral-gold, 0.3) 0%, transparent 70%);
  animation: pulse 2s ease-in-out infinite;
  z-index: 1;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.2;
  }
}

.timeline-line {
  flex: 1;
  width: 2px;
  min-height: 36px;
  background: $color-funeral-border;
  margin: 4px 0;

  &.completed {
    background: linear-gradient(180deg, #52C41A 0%, rgba(82, 196, 26, 0.3) 100%);
  }

  &.current {
    background: linear-gradient(180deg, $color-funeral-gold 0%, $color-funeral-border 100%);
  }
}

.timeline-content {
  flex: 1;
  padding-bottom: 20px;
  padding-top: 4px;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.status-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $color-funeral-text-muted;
  font-family: 'SF Mono', Monaco, monospace;

  :deep(.el-icon) {
    width: 12px;
    height: 12px;
  }
}

.timeline-operator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $color-funeral-text-secondary;
  flex-wrap: wrap;

  :deep(.el-icon) {
    width: 12px;
    height: 12px;
    color: $color-funeral-text-muted;
  }
}

.timeline-remark {
  color: $color-funeral-text-muted;
  font-style: italic;
}

.timeline-pending-hint {
  font-size: 12px;
  color: $color-funeral-text-muted;
  font-style: italic;
  opacity: 0.7;
}
</style>
