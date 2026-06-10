<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { MaterialAlert } from '@/types'
import { ElMessage } from 'element-plus'
import { inventoryApi } from '@/api'

const alerts = ref<MaterialAlert[]>([])
const isLoading = ref(false)
const onlyUnread = ref(false)

const filteredAlerts = computed(() => {
  if (onlyUnread.value) {
    return alerts.value.filter(a => !a.isRead)
  }
  return alerts.value
})

const unreadCount = computed(() => alerts.value.filter(a => !a.isRead).length)

const handleMarkAsRead = (alert: MaterialAlert) => {
  inventoryApi.markAlertAsRead(alert.id).then(() => {
    const item = alerts.value.find(a => a.id === alert.id)
    if (item) {
      item.isRead = true
    }
  }).catch(() => {
    ElMessage.error('操作失败')
  })
}

const handleMarkAllAsRead = () => {
  inventoryApi.markAllAlertsAsRead().then(() => {
    alerts.value.forEach(a => a.isRead = true)
    ElMessage.success('已全部标记为已读')
  }).catch(() => {
    ElMessage.error('操作失败')
  })
}

const handleGeneratePurchaseOrder = () => {
  inventoryApi.generatePurchaseSuggestion().then((result: any) => {
    ElMessage.success('已生成采购建议单')
    console.log('Purchase suggestions:', result)
  }).catch(() => {
    ElMessage.error('生成失败')
  })
}

onMounted(() => {
  alerts.value = [
    {
      id: 'a1',
      materialId: 'm1',
      materialName: '氧化铜',
      currentQuantity: 4,
      threshold: 5,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      isRead: false,
      suggestedPurchaseAmount: 10
    },
    {
      id: 'a2',
      materialName: '氧化铁',
      materialId: 'm2',
      currentQuantity: 6,
      threshold: 3,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      isRead: true,
      suggestedPurchaseAmount: 5
    }
  ]
})
</script>

<template>
  <div class="alert-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">库存预警</h2>
        <el-tag type="danger" effect="plain" v-if="unreadCount > 0">
          {{ unreadCount }} 条未读
        </el-tag>
      </div>
      <div class="header-right">
        <el-switch v-model="onlyUnread" active-text="仅看未读" inactive-text="全部" />
        <el-button @click="handleMarkAllAsRead" :disabled="unreadCount === 0">
          全部已读
        </el-button>
        <el-button type="primary" @click="handleGeneratePurchaseOrder">
          <el-icon><Document /></el-icon>
          生成采购单
        </el-button>
      </div>
    </div>

    <div class="alert-list">
      <div 
        v-for="alert in filteredAlerts" 
        :key="alert.id"
        class="alert-item"
        :class="{ unread: !alert.isRead }"
      >
        <div class="alert-icon">
          <el-icon :size="24"><WarningFilled /></el-icon>
        </div>
        <div class="alert-content">
          <div class="alert-title">
            {{ alert.materialName }} 库存不足
            <span v-if="!alert.isRead" class="unread-dot"></span>
          </div>
          <div class="alert-info">
            当前库存: <strong>{{ alert.currentQuantity }}</strong> | 
            预警阈值: <strong>{{ alert.threshold }}</strong>
          </div>
          <div class="alert-suggestion" v-if="alert.suggestedPurchaseAmount">
            建议采购量: {{ alert.suggestedPurchaseAmount }} 单位
          </div>
          <div class="alert-time">{{ new Date(alert.createdAt).toLocaleString() }}</div>
        </div>
        <div class="alert-actions">
          <el-button 
            v-if="!alert.isRead" 
            size="small" 
            type="primary" 
            link
            @click="handleMarkAsRead(alert)"
          >
            标为已读
          </el-button>
          <el-button size="small" link>
            采购
          </el-button>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredAlerts.length === 0" description="暂无预警信息" />
  </div>
</template>

<style scoped lang="scss">
.alert-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
  transition: all $transition-fast;
  opacity: 0.7;

  &.unread {
    opacity: 1;
    border-left: 4px solid $color-error;
  }

  &:hover {
    box-shadow: $shadow-md;
  }
}

.alert-icon {
  color: $color-error;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 15px;
  font-weight: 500;
  color: $color-text-primary;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $color-error;
}

.alert-info {
  font-size: 13px;
  color: $color-text-secondary;
  margin-bottom: 4px;

  strong {
    color: $color-error;
    font-weight: 600;
  }
}

.alert-suggestion {
  font-size: 13px;
  color: $color-primary;
  margin-bottom: 4px;
}

.alert-time {
  font-size: 12px;
  color: $color-text-placeholder;
}

.alert-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
