<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { PieceArchive, PieceStatus, PhotoStage, PagedQuery } from '@/types'
import { ElMessage } from 'element-plus'
import { pieceApi } from '@/api/piece'

const router = useRouter()

const isLoading = ref(false)
const pieces = ref<PieceArchive[]>([])
const pageIndex = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const searchKeyword = ref('')
const filterStatus = ref<PieceStatus | ''>('')
const filterMember = ref('')
const activeStage = ref<PhotoStage | 'all'>('all')
const totalCount = ref(0)

const stages = [
  { value: 'all', label: '全部', icon: 'Picture' },
  { value: 'clay', label: '泥坯', icon: 'Brush' },
  { value: 'bisque', label: '素烧', icon: 'Flame' },
  { value: 'glaze', label: '施釉', icon: 'MagicStick' },
  { value: 'finished', label: '成品', icon: 'Star' }
]

const fetchPieces = async (reset: boolean = false) => {
  if (isLoading.value) return
  isLoading.value = true
  
  if (reset) {
    pageIndex.value = 1
    pieces.value = []
    hasMore.value = true
  }
  
  try {
    const params: PagedQuery & {
      keyword?: string
      status?: PieceStatus
      stage?: PhotoStage | 'all'
      memberId?: string
      pageIndex: number
      pageSize: number
    } = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterMember.value) params.memberId = filterMember.value
    if (activeStage.value !== 'all') params.stage = activeStage.value
    
    const result = await pieceApi.getPieces(params)
    if (reset || pageIndex.value === 1) {
      pieces.value = result.items
    } else {
      pieces.value = [...pieces.value, ...result.items]
    }
    totalCount.value = result.totalCount
    hasMore.value = pieces.value.length < result.totalCount
    if (result.items.length > 0) {
      pageIndex.value++
    }
  } catch (e) {
    console.error('Failed to fetch pieces:', e)
  } finally {
    isLoading.value = false
  }
}

const getStatusLabel = (status: PieceStatus) => {
  const map: Record<PieceStatus, string> = {
    draft: '创作中',
    bisqued: '素烧完成',
    glazed: '施釉完成',
    fired: '烧制中',
    completed: '已完成',
    sold: '已售出'
  }
  return map[status] || status
}

const getStatusColor = (status: PieceStatus) => {
  const map: Record<PieceStatus, string> = {
    draft: '#d4a574',
    bisqued: '#8c8c8c',
    glazed: '#c85a32',
    fired: '#faad14',
    completed: '#52c41a',
    sold: '#722ed1'
  }
  return map[status] || '#999'
}

const getPieceColor = (index: number) => {
  const colors = [
    { main: '#c85a32', light: '#e07a52' },
    { main: '#5b8ff9', light: '#7da6ff' },
    { main: '#5ad8a6', light: '#7ae3bb' },
    { main: '#f6bd16', light: '#f8cf4a' },
    { main: '#722ed1', light: '#9254de' },
    { main: '#e86452', light: '#ee8a7c' }
  ]
  return colors[index % colors.length]
}

const handlePieceClick = (piece: PieceArchive) => {
  router.push(`/pieces/${piece.id}`)
}

const handleLoadMore = () => {
  if (!hasMore.value) return
  fetchPieces(false)
}

const handleUploadPiece = () => {
  ElMessage.info('上传作品功能开发中...')
}

const getPhotoByStage = (piece: PieceArchive, stage: PhotoStage) => {
  return piece.photos.find(p => p.stage === stage)
}

watch([searchKeyword, filterStatus, activeStage, filterMember], () => {
  fetchPieces(true)
})

onMounted(() => {
  fetchPieces(true)
})
</script>

<template>
  <div class="piece-archive-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">作品档案墙</h2>
        <span class="piece-count">共 {{ pieces.length }} 件作品</span>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleUploadPiece">
          上传作品
        </el-button>
      </div>
    </div>

    <div class="filter-section">
      <div class="stage-tabs">
        <div 
          v-for="stage in stages" 
          :key="stage.value"
          class="stage-tab"
          :class="{ active: activeStage === stage.value }"
          @click="activeStage = stage.value as any"
        >
          <el-icon><component :is="stage.icon" /></el-icon>
          <span>{{ stage.label }}</span>
        </div>
      </div>
      
      <div class="filter-row">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索作品名称、作者..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select 
          v-model="filterStatus" 
          placeholder="作品状态"
          clearable
          class="status-select"
        >
          <el-option label="创作中" value="draft" />
          <el-option label="素烧完成" value="bisqued" />
          <el-option label="施釉完成" value="glazed" />
          <el-option label="烧制中" value="fired" />
          <el-option label="已完成" value="completed" />
          <el-option label="已售出" value="sold" />
        </el-select>
      </div>
    </div>

    <div class="waterfall-container">
      <div class="waterfall-column">
        <div 
          v-for="(piece, index) in pieces.filter((_, i) => i % 3 === 0)" 
          :key="piece.id"
          class="piece-card"
          @click="handlePieceClick(piece)"
        >
          <div class="piece-cover" :style="{ background: `linear-gradient(135deg, ${getPieceColor(index).light} 0%, ${getPieceColor(index).main} 100%)` }">
            <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="130" rx="35" ry="5" fill="white" opacity="0.2"/>
              <path d="M20 130C20 90 28 55 50 55C72 55 80 90 80 130" 
                stroke="white" stroke-width="2" fill="white" fill-opacity="0.3"/>
              <ellipse cx="50" cy="55" rx="20" ry="7" fill="white" fill-opacity="0.5"/>
            </svg>
            <div v-if="piece.isForSale" class="for-sale-badge">
              <el-icon><ShoppingCart /></el-icon>
              ¥{{ piece.price }}
            </div>
            <div class="stage-indicators">
              <div 
                v-for="s in ['clay', 'bisque', 'glaze', 'finished']" 
                :key="s"
                class="stage-dot"
                :class="{ active: piece.photos.some(p => p.stage === s) }"
              ></div>
            </div>
          </div>
          <div class="piece-info">
            <h3 class="piece-title">{{ piece.title }}</h3>
            <div class="piece-meta">
              <div class="author">
                <el-avatar :size="20">{{ piece.memberName?.charAt(0) }}</el-avatar>
                <span>{{ piece.memberName }}</span>
              </div>
              <el-tag 
                size="small"
                :style="{ 
                  backgroundColor: getStatusColor(piece.status) + '20', 
                  color: getStatusColor(piece.status),
                  border: 'none' 
                }"
              >
                {{ getStatusLabel(piece.status) }}
              </el-tag>
            </div>
            <div class="piece-tags">
              <el-tag 
                v-for="tag in piece.tags" 
                :key="tag"
                size="small"
                effect="plain"
                type="info"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
      
      <div class="waterfall-column">
        <div 
          v-for="(piece, index) in pieces.filter((_, i) => i % 3 === 1)" 
          :key="piece.id"
          class="piece-card"
          @click="handlePieceClick(piece)"
        >
          <div class="piece-cover tall" :style="{ background: `linear-gradient(135deg, ${getPieceColor(index + 1).light} 0%, ${getPieceColor(index + 1).main} 100%)` }">
            <svg viewBox="0 0 100 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="150" rx="35" ry="5" fill="white" opacity="0.2"/>
              <path d="M20 150C20 100 25 60 50 60C75 60 80 100 80 150" 
                stroke="white" stroke-width="2" fill="white" fill-opacity="0.3"/>
              <ellipse cx="50" cy="60" rx="18" ry="6" fill="white" fill-opacity="0.5"/>
            </svg>
            <div class="stage-indicators">
              <div 
                v-for="s in ['clay', 'bisque', 'glaze', 'finished']" 
                :key="s"
                class="stage-dot"
                :class="{ active: piece.photos.some(p => p.stage === s) }"
              ></div>
            </div>
          </div>
          <div class="piece-info">
            <h3 class="piece-title">{{ piece.title }}</h3>
            <div class="piece-meta">
              <div class="author">
                <el-avatar :size="20">{{ piece.memberName?.charAt(0) }}</el-avatar>
                <span>{{ piece.memberName }}</span>
              </div>
              <el-tag 
                size="small"
                :style="{ 
                  backgroundColor: getStatusColor(piece.status) + '20', 
                  color: getStatusColor(piece.status),
                  border: 'none' 
                }"
              >
                {{ getStatusLabel(piece.status) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
      
      <div class="waterfall-column">
        <div 
          v-for="(piece, index) in pieces.filter((_, i) => i % 3 === 2)" 
          :key="piece.id"
          class="piece-card"
          @click="handlePieceClick(piece)"
        >
          <div class="piece-cover" :style="{ background: `linear-gradient(135deg, ${getPieceColor(index + 2).light} 0%, ${getPieceColor(index + 2).main} 100%)` }">
            <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="60" cy="90" rx="45" ry="6" fill="white" opacity="0.2"/>
              <path d="M20 90C20 70 30 45 60 45C90 45 100 70 100 90" 
                stroke="white" stroke-width="2" fill="white" fill-opacity="0.3"/>
              <ellipse cx="60" cy="45" rx="28" ry="8" fill="white" fill-opacity="0.5"/>
            </svg>
            <div class="stage-indicators">
              <div 
                v-for="s in ['clay', 'bisque', 'glaze', 'finished']" 
                :key="s"
                class="stage-dot"
                :class="{ active: piece.photos.some(p => p.stage === s) }"
              ></div>
            </div>
          </div>
          <div class="piece-info">
            <h3 class="piece-title">{{ piece.title }}</h3>
            <div class="piece-meta">
              <div class="author">
                <el-avatar :size="20">{{ piece.memberName?.charAt(0) }}</el-avatar>
                <span>{{ piece.memberName }}</span>
              </div>
              <el-tag 
                size="small"
                :style="{ 
                  backgroundColor: getStatusColor(piece.status) + '20', 
                  color: getStatusColor(piece.status),
                  border: 'none' 
                }"
              >
                {{ getStatusLabel(piece.status) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="load-more" v-if="hasMore">
      <el-button :loading="isLoading" @click="handleLoadMore">
        {{ isLoading ? '加载中...' : '加载更多' }}
      </el-button>
    </div>
    
    <div class="no-more" v-else-if="pieces.length > 0">
      <el-divider>— 已经到底啦 —</el-divider>
    </div>

    <el-empty v-if="pieces.length === 0" description="暂无作品" />
  </div>
</template>

<style scoped lang="scss">
.piece-archive-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.piece-count {
  font-size: 14px;
  color: $color-text-secondary;
}

.filter-section {
  background: white;
  border-radius: $border-radius-md;
  padding: 16px;
  box-shadow: $shadow-sm;
}

.stage-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.stage-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all $transition-fast;
  white-space: nowrap;
  background: $color-bg;

  &:hover {
    color: $color-primary;
  }

  &.active {
    background: $color-primary;
    color: white;
  }
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 280px;
}

.status-select {
  width: 150px;
}

.waterfall-container {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  @media (max-width: 1024px) {
    gap: 12px;
  }

  @media (max-width: $breakpoint-mobile) {
    flex-direction: column;
    
    .waterfall-column {
      width: 100% !important;
    }
  }
}

.waterfall-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: 1024px) {
    gap: 12px;
  }
}

.piece-card {
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  cursor: pointer;
  transition: all $transition-normal;
  box-shadow: $shadow-sm;

  &:hover {
    transform: translateY(-4px);
    box-shadow: $shadow-lg;

    .piece-cover {
      .piece-cover svg {
        transform: scale(1.05);
      }
    }
  }
}

.piece-cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  svg {
    width: 60%;
    height: 60%;
    transition: transform $transition-normal;
  }

  &.tall {
    aspect-ratio: 3/4;
  }

  &:not(.tall) {
    aspect-ratio: 4/3;
  }
}

.for-sale-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

.stage-indicators {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}

.stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.5);

  &.active {
    background: white;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
  }
}

.piece-info {
  padding: 14px;
}

.piece-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 10px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.piece-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;
}

.piece-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.load-more {
  text-align: center;
  padding: 20px;
}

.no-more {
  text-align: center;
  padding: 10px 0;
  
  :deep(.el-divider__text) {
    color: $color-text-placeholder;
    font-size: 12px;
  }
}
</style>
