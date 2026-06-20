<template>
  <div class="remains-card">
    <div class="card-header" :style="{ background: statusGradient }">
      <StatusTag :status="data.currentStatus" type="remains" />
      <span class="card-code">{{ data.code }}</span>
    </div>

    <div class="card-body">
      <div class="deceased-info">
        <div class="deceased-name-row">
          <span class="deceased-name">{{ data.name }}</span>
          <span :class="['gender-badge', data.gender]">
            <el-icon v-if="data.gender === 'male'"><Male /></el-icon>
            <el-icon v-else><Female /></el-icon>
            {{ data.age }}岁
          </span>
        </div>
        <div class="info-row">
          <el-icon><Warning /></el-icon>
          <span class="info-label">死亡原因：</span>
          <span class="info-value">{{ data.causeOfDeath }}</span>
        </div>
        <div class="info-row">
          <el-icon><Location /></el-icon>
          <span class="info-label">接运地址：</span>
          <span class="info-value ellipsis">{{ data.pickupAddress }}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="family-info">
        <div class="info-row">
          <el-icon><User /></el-icon>
          <span class="info-value">{{ data.family.name }}</span>
          <span class="relation-tag">{{ data.family.relation }}</span>
        </div>
        <div class="info-row">
          <el-icon><Phone /></el-icon>
          <span class="info-value">{{ data.family.phone }}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="time-info">
        <div class="info-row">
          <el-icon><Clock /></el-icon>
          <span class="info-label">死亡时间：</span>
          <span class="info-value">{{ data.deathTime }}</span>
        </div>
        <div v-if="data.arriveTime" class="info-row">
          <el-icon><House /></el-icon>
          <span class="info-label">到馆时间：</span>
          <span class="info-value">{{ data.arriveTime }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="funeral-home">
        <el-icon><OfficeBuilding /></el-icon>
        <span>{{ data.funeralHomeName }}</span>
      </div>
      <div class="action-buttons">
        <el-button size="small" type="primary" text @click="handleViewDetail">
          查看详情
        </el-button>
        <el-button size="small" type="warning" text @click="handleUpdateStatus">
          更新状态
        </el-button>
        <el-button size="small" type="success" text @click="handleSettlement">
          费用结算
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Male, Female, Warning, Location, User, Phone, Clock, House, OfficeBuilding } from '@element-plus/icons-vue'
import type { Remains } from '@/types/remains'
import { getRemainsStatusInfo } from '@/utils/status'
import StatusTag from '@/components/common/StatusTag.vue'

const props = defineProps<{
  data: Remains
}>()

const emit = defineEmits<{
  (e: 'view', id: string): void
  (e: 'updateStatus', data: Remains): void
  (e: 'settlement', id: string): void
}>()

const router = useRouter()

const statusGradient = computed(() => {
  const info = getRemainsStatusInfo(props.data.currentStatus)
  const color = info.color || '#8B7355'
  return `linear-gradient(90deg, ${color}22 0%, ${color}08 100%)`
})

function handleViewDetail() {
  emit('view', props.data.id)
  router.push(`/remains/detail/${props.data.id}`)
}

function handleUpdateStatus() {
  emit('updateStatus', props.data)
}

function handleSettlement() {
  emit('settlement', props.data.id)
  ElMessage.info(`正在为 ${props.data.name} 打开费用结算`)
}
</script>

<style lang="scss" scoped>
.remains-card {
  background: $color-funeral-card;
  border: 1px solid $color-funeral-border;
  border-radius: $radius-md;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    border-color: $color-funeral-gold;
    box-shadow: $shadow-card-hover;
    transform: translateY(-3px);
  }
}

.card-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid $color-funeral-border;
}

.card-code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: $color-funeral-gold;
  letter-spacing: 0.5px;
  opacity: 0.85;
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.deceased-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deceased-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.deceased-name {
  font-size: 20px;
  font-weight: 700;
  color: $color-funeral-text-primary;
  letter-spacing: 1px;
}

.gender-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: $radius-sm;
  font-size: 12px;
  font-weight: 500;

  &.male {
    background: rgba(24, 144, 255, 0.12);
    color: #409EFF;
    border: 1px solid rgba(24, 144, 255, 0.25);
  }

  &.female {
    background: rgba(235, 47, 150, 0.12);
    color: #EB2F96;
    border: 1px solid rgba(235, 47, 150, 0.25);
  }

  :deep(.el-icon) {
    width: 12px;
    height: 12px;
  }
}

.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 1.6;

  :deep(.el-icon) {
    width: 14px;
    height: 14px;
    color: $color-funeral-gold;
    flex-shrink: 0;
  }
}

.info-label {
  color: $color-funeral-text-muted;
  flex-shrink: 0;
}

.info-value {
  color: $color-funeral-text-secondary;

  &.ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.divider {
  height: 1px;
  background: $color-funeral-border;
  margin: 2px 0;
}

.family-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.relation-tag {
  padding: 1px 8px;
  border-radius: $radius-sm;
  background: rgba($color-funeral-gold, 0.12);
  color: $color-funeral-gold;
  font-size: 11px;
  border: 1px solid rgba($color-funeral-gold, 0.25);
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-footer {
  padding: 12px 16px;
  border-top: 1px solid $color-funeral-border;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
}

.funeral-home {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $color-funeral-text-muted;

  :deep(.el-icon) {
    width: 13px;
    height: 13px;
    color: $color-funeral-text-muted;
  }
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;

  :deep(.el-button) {
    font-size: 12px;
    padding: 4px 8px;

    &.el-button--text.is-text {
      padding: 4px 8px;
    }
  }
}
</style>
