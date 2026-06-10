<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { SalesItem, SalesStatus } from '@/types'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const activeTab = ref<'listed' | 'sold' | 'all'>('listed')
const searchKeyword = ref('')
const pageIndex = ref(1)
const pageSize = ref(20)
const total = ref(0)

const salesItems = ref<SalesItem[]>([
  {
    id: 'si1',
    pieceId: 'p1',
    pieceTitle: '青花瓷茶盏',
    pieceImage: '',
    price: 388,
    status: 'listed',
    listedAt: '2024-01-20T00:00:00Z',
    authorShare: 232.8,
    studioShare: 155.2
  },
  {
    id: 'si2',
    pieceId: 'p2',
    pieceTitle: '手工捏塑花瓶',
    pieceImage: '',
    price: 588,
    status: 'listed',
    listedAt: '2024-01-18T00:00:00Z',
    authorShare: 352.8,
    studioShare: 235.2
  },
  {
    id: 'si3',
    pieceId: 'p3',
    pieceTitle: '拉坯碗套装',
    pieceImage: '',
    price: 268,
    status: 'sold',
    listedAt: '2024-01-10T00:00:00Z',
    soldAt: '2024-01-22T00:00:00Z',
    buyerName: '李先生',
    buyerContact: '138****8001',
    authorShare: 160.8,
    studioShare: 107.2
  },
  {
    id: 'si4',
    pieceId: 'p4',
    pieceTitle: '日式汤吞',
    pieceImage: '',
    price: 128,
    status: 'sold',
    listedAt: '2024-01-05T00:00:00Z',
    soldAt: '2024-01-15T00:00:00Z',
    buyerName: '王女士',
    buyerContact: '139****8002',
    authorShare: 76.8,
    studioShare: 51.2
  }
])

const filteredItems = computed(() => {
  return salesItems.value.filter(item => {
    if (activeTab.value !== 'all' && item.status !== activeTab.value) return false
    if (searchKeyword.value) {
      return item.pieceTitle?.toLowerCase().includes(searchKeyword.value.toLowerCase())
    }
    return true
  })
})

const getStatusLabel = (status: SalesStatus) => {
  const map: Record<string, string> = {
    draft: '草稿',
    listed: '在售',
    reserved: '预留',
    sold: '已售出',
    returned: '已退回'
  }
  return map[status] || status
}

const getStatusColor = (status: SalesStatus) => {
  const map: Record<string, string> = {
    draft: '#909399',
    listed: '#67c23a',
    reserved: '#e6a23c',
    sold: '#409eff',
    returned: '#f56c6c'
  }
  return map[status] || '#999'
}

const getPieceColor = (index: number) => {
  const colors = ['#c85a32', '#5b8ff9', '#5ad8a6', '#f6bd16', '#722ed1']
  return colors[index % colors.length]
}

const handleSell = (item: SalesItem) => {
  ElMessage.prompt('请输入买家姓名和联系方式', '标记为已售出', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '买家姓名 / 电话'
  }).then(({ value }) => {
    ElMessage.success('已标记为售出')
  }).catch(() => {})
}

const handleRemove = (item: SalesItem) => {
  ElMessage.info('下架功能开发中...')
}

const handleAdd = () => {
  ElMessage.info('添加销售商品功能开发中...')
}

onMounted(() => {
  total.value = salesItems.value.length
})
</script>

<template>
  <div class="sales-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">作品销售</h2>
        <el-tabs v-model="activeTab" class="header-tabs">
          <el-tab-pane label="在售" name="listed" />
          <el-tab-pane label="已售出" name="sold" />
          <el-tab-pane label="全部" name="all" />
        </el-tabs>
      </div>
      <div class="header-right">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索作品..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-button type="primary" :icon="Plus" @click="handleAdd">
          上架作品
        </el-button>
      </div>
    </div>

    <div class="sales-stats">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(103, 194, 58, 0.1); color: #67c23a;">
          <el-icon><ShoppingBag /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ salesItems.filter(i => i.status === 'listed').length }}</div>
          <div class="stat-label">在售作品</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(64, 158, 255, 0.1); color: #409eff;">
          <el-icon><Finished /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ salesItems.filter(i => i.status === 'sold').length }}</div>
          <div class="stat-label">已售出</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(230, 162, 60, 0.1); color: #e6a23c;">
          <el-icon><Money /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">
            ¥{{ salesItems.filter(i => i.status === 'sold').reduce((sum, i) => sum + i.price, 0).toLocaleString() }}
          </div>
          <div class="stat-label">销售总额</div>
        </div>
      </div>
    </div>

    <div class="sales-grid">
      <div 
        v-for="(item, index) in filteredItems" 
        :key="item.id"
        class="sales-card"
      >
        <div class="piece-image" :style="{ background: `linear-gradient(135deg, ${getPieceColor(index)}aa 0%, ${getPieceColor(index)} 100%)` }">
          <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="92" rx="28" ry="5" fill="white" opacity="0.2"/>
            <path d="M15 92C15 60 22 35 40 35C58 35 65 60 65 92" 
              stroke="white" stroke-width="2" fill="white" fill-opacity="0.3"/>
            <ellipse cx="40" cy="35" rx="18" ry="6" fill="white" fill-opacity="0.5"/>
          </svg>
          <el-tag 
            class="status-tag"
            :style="{ 
              backgroundColor: getStatusColor(item.status) + 'ee', 
              color: 'white',
              border: 'none' 
            }"
          >
            {{ getStatusLabel(item.status) }}
          </el-tag>
        </div>
        
        <div class="card-content">
          <h3 class="piece-title">{{ item.pieceTitle }}</h3>
          <div class="price">¥{{ item.price }}</div>
          
          <div class="card-meta">
            <div class="meta-item">
              <span class="meta-label">上架时间</span>
              <span class="meta-value">{{ dayjs(item.listedAt).format('MM-DD') }}</span>
            </div>
            <div v-if="item.soldAt" class="meta-item">
              <span class="meta-label">售出时间</span>
              <span class="meta-value">{{ dayjs(item.soldAt).format('MM-DD') }}</span>
            </div>
          </div>
          
          <div v-if="item.buyerName" class="buyer-info">
            <span>买家：{{ item.buyerName }}</span>
          </div>
          
          <div class="card-actions">
            <el-button v-if="item.status === 'listed'" size="small" type="primary" @click="handleSell(item)">
              标记售出
            </el-button>
            <el-button v-if="item.status === 'listed'" size="small" @click="handleRemove(item)">
              下架
            </el-button>
            <el-button v-if="item.status === 'sold'" size="small" type="success" disabled>
              已完成
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredItems.length === 0" description="暂无数据" />
  </div>
</template>

<style scoped lang="scss">
.sales-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.header-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
  }
  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 220px;
}

.sales-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: $border-radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: $color-text-primary;
}

.stat-label {
  font-size: 13px;
  color: $color-text-secondary;
}

.sales-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.sales-card {
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  box-shadow: $shadow-sm;
  transition: all $transition-normal;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-md;
  }
}

.piece-image {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  svg {
    width: 80px;
    height: 100px;
  }
}

.status-tag {
  position: absolute;
  top: 12px;
  right: 12px;
}

.card-content {
  padding: 16px;
}

.piece-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 8px 0;
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: $color-primary;
  margin-bottom: 12px;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: $color-text-placeholder;
}

.meta-value {
  font-size: 13px;
  color: $color-text-secondary;
}

.buyer-info {
  font-size: 12px;
  color: $color-text-secondary;
  padding: 8px 0;
  border-top: 1px solid $color-border;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
