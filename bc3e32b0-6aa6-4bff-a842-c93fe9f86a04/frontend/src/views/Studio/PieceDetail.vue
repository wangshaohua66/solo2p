<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const activeTab = ref('overview')
const piece = ref<any>(null)
const activePhotoStage = ref<'clay' | 'bisque' | 'glaze' | 'finished'>('finished')

const stages = [
  { value: 'clay', label: '泥坯', icon: 'Brush' },
  { value: 'bisque', label: '素烧', icon: 'Flame' },
  { value: 'glaze', label: '施釉', icon: 'MagicStick' },
  { value: 'finished', label: '成品', icon: 'Star' }
]

const mockPiece = {
  id: 'piece-1',
  title: '青花瓷茶盏',
  description: '一只精心制作的青花茶盏，器型典雅，釉色温润。',
  memberId: 'member-1',
  memberName: '张小明',
  glazeRecipeId: 'recipe-1',
  glazeRecipeName: '青瓷釉',
  kilnScheduleId: 'schedule-1',
  kilnScheduleName: '第24期釉烧',
  status: 'completed',
  weight: 180,
  height: 8.5,
  width: 10,
  createdAt: '2024-01-10T00:00:00Z',
  completedAt: '2024-01-25T00:00:00Z',
  isForSale: true,
  price: 388,
  photos: [
    { id: 'p1', stage: 'clay', url: '', uploadedAt: '2024-01-10T00:00:00Z', description: '刚拉坯完成的泥坯状态' },
    { id: 'p2', stage: 'bisque', url: '', uploadedAt: '2024-01-15T00:00:00Z', description: '素烧后的效果' },
    { id: 'p3', stage: 'glaze', url: '', uploadedAt: '2024-01-20T00:00:00Z', description: '施釉完成，准备入窑' },
    { id: 'p4', stage: 'finished', url: '', uploadedAt: '2024-01-25T00:00:00Z', description: '最终成品效果' }
  ],
  tags: ['青花瓷', '茶器', '手工拉坯']
}

piece.value = mockPiece

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: '创作中',
    bisqued: '素烧完成',
    glazed: '施釉完成',
    fired: '烧制中',
    completed: '已完成',
    sold: '已售出'
  }
  return map[status] || status
}

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    draft: '#d4a574',
    bisqued: '#8c8c8c',
    glazed: '#c85a32',
    fired: '#faad14',
    completed: '#52c41a',
    sold: '#722ed1'
  }
  return map[status] || '#999'
}

const getStageColor = (stage: string) => {
  const map: Record<string, string> = {
    clay: '#d4a574',
    bisque: '#8c8c8c',
    glaze: '#c85a32',
    finished: '#52c41a'
  }
  return map[stage] || '#999'
}

const hasStagePhoto = (stage: string) => {
  return piece.value?.photos.some((p: any) => p.stage === stage)
}

const handleBack = () => {
  router.push('/pieces')
}

const handleEdit = () => {
  ElMessage.info('编辑作品功能开发中...')
}

const handleUploadPhoto = () => {
  ElMessage.info('上传照片功能开发中...')
}

const handleSetForSale = () => {
  ElMessage.info('上架销售功能开发中...')
}

onMounted(() => {
  const id = route.params.id as string
  console.log('Loading piece:', id)
})
</script>

<template>
  <div class="piece-detail-page" v-if="piece">
    <div class="page-header">
      <el-button :icon="ArrowLeft" text @click="handleBack">
        返回作品列表
      </el-button>
      <div class="header-actions">
        <el-button @click="handleUploadPhoto">
          <el-icon><Upload /></el-icon>
          上传照片
        </el-button>
        <el-button @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="primary" @click="handleSetForSale">
          <el-icon><ShoppingCart /></el-icon>
          {{ piece.isForSale ? '管理销售' : '上架销售' }}
        </el-button>
      </div>
    </div>

    <div class="detail-content">
      <div class="left-section">
        <div class="photo-viewer">
          <div class="main-photo" :style="{ background: `linear-gradient(135deg, ${getStageColor(activePhotoStage)}aa 0%, ${getStageColor(activePhotoStage)} 100%)` }">
            <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="100" cy="245" rx="70" ry="10" fill="white" opacity="0.2"/>
              <path d="M35 245C35 170 50 100 100 100C150 100 165 170 165 245" 
                stroke="white" stroke-width="3" fill="white" fill-opacity="0.3"/>
              <ellipse cx="100" cy="100" rx="45" ry="14" fill="white" fill-opacity="0.5"/>
            </svg>
          </div>
          
          <div class="stage-selector">
            <div 
              v-for="stage in stages" 
              :key="stage.value"
              class="stage-item"
              :class="{ 
                active: activePhotoStage === stage.value,
                disabled: !hasStagePhoto(stage.value)
              }"
              @click="hasStagePhoto(stage.value) && (activePhotoStage = stage.value as any)"
            >
              <el-icon><component :is="stage.icon" /></el-icon>
              <span>{{ stage.label }}</span>
              <div 
                v-if="hasStagePhoto(stage.value)" 
                class="stage-thumb"
                :style="{ backgroundColor: getStageColor(stage.value) }"
              ></div>
            </div>
          </div>
          
          <div class="photo-info">
            <p class="photo-desc">
              {{ piece.photos.find((p: any) => p.stage === activePhotoStage)?.description || '' }}
            </p>
            <p class="photo-date">
              {{ dayjs(piece.photos.find((p: any) => p.stage === activePhotoStage)?.uploadedAt).format('YYYY-MM-DD') }}
            </p>
          </div>
        </div>
      </div>

      <div class="right-section">
        <div class="piece-header">
          <h1 class="piece-title">{{ piece.title }}</h1>
          <el-tag 
            size="large"
            :style="{ 
              backgroundColor: getStatusColor(piece.status) + '20', 
              color: getStatusColor(piece.status),
              border: 'none' 
            }"
          >
            {{ getStatusLabel(piece.status) }}
          </el-tag>
        </div>
        
        <div class="piece-meta-grid">
          <div class="meta-item">
            <span class="meta-label">作者</span>
            <div class="meta-value author">
              <el-avatar :size="24">{{ piece.memberName?.charAt(0) }}</el-avatar>
              <span>{{ piece.memberName }}</span>
            </div>
          </div>
          <div class="meta-item">
            <span class="meta-label">釉料配方</span>
            <span class="meta-value link" @click="router.push(`/glaze-recipes/${piece.glazeRecipeId}`)">
              {{ piece.glazeRecipeName }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">烧制窑炉</span>
            <span class="meta-value">{{ piece.kilnScheduleName }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">创作日期</span>
            <span class="meta-value">{{ dayjs(piece.createdAt).format('YYYY-MM-DD') }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">完成日期</span>
            <span class="meta-value">{{ piece.completedAt ? dayjs(piece.completedAt).format('YYYY-MM-DD') : '-' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">尺寸</span>
            <span class="meta-value">高 {{ piece.height }}cm × 宽 {{ piece.width }}cm</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">重量</span>
            <span class="meta-value">{{ piece.weight }}g</span>
          </div>
          <div class="meta-item" v-if="piece.isForSale">
            <span class="meta-label">售价</span>
            <span class="meta-value price">¥{{ piece.price }}</span>
          </div>
        </div>

        <div class="piece-description">
          <h3 class="section-title">作品描述</h3>
          <p>{{ piece.description }}</p>
        </div>

        <div class="piece-tags">
          <h3 class="section-title">标签</h3>
          <div class="tags-list">
            <el-tag 
              v-for="tag in piece.tags" 
              :key="tag"
              effect="plain"
              type="info"
              size="large"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>

        <div class="timeline-section">
          <h3 class="section-title">创作轨迹</h3>
          <el-timeline>
            <el-timeline-item
              v-for="stage in stages"
              :key="stage.value"
              :timestamp="dayjs(piece.photos.find((p: any) => p.stage === stage.value)?.uploadedAt).format('YYYY-MM-DD')"
              :color="hasStagePhoto(stage.value) ? getStageColor(stage.value) : '#dcdfe6'"
              :hollow="!hasStagePhoto(stage.value)"
            >
              <div class="timeline-content">
                <span class="timeline-stage">{{ stage.label }}</span>
                <span v-if="hasStagePhoto(stage.value)" class="timeline-desc">
                  {{ piece.photos.find((p: any) => p.stage === stage.value)?.description }}
                </span>
                <span v-else class="timeline-pending">待完成</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.piece-detail-page {
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

.header-actions {
  display: flex;
  gap: 10px;
}

.detail-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.left-section {
  position: sticky;
  top: 80px;
  align-self: flex-start;
}

.photo-viewer {
  background: white;
  border-radius: $border-radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
}

.main-photo {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 60%;
    height: 60%;
  }
}

.stage-selector {
  display: flex;
  border-top: 1px solid $color-border;
}

.stage-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  cursor: pointer;
  transition: all $transition-fast;
  border-right: 1px solid $color-border;
  font-size: 12px;
  color: $color-text-secondary;

  &:last-child {
    border-right: none;
  }

  &:hover:not(.disabled) {
    background: $color-bg;
  }

  &.active {
    background: linear-gradient(to bottom, rgba($color-primary, 0.1) 0%, transparent 100%);
    color: $color-primary;
    font-weight: 500;
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.stage-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  opacity: 0.6;
}

.photo-info {
  padding: 12px 16px;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.photo-desc {
  font-size: 13px;
  color: $color-text-primary;
  margin: 0 0 4px 0;
}

.photo-date {
  font-size: 12px;
  color: $color-text-placeholder;
  margin: 0;
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.piece-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.piece-title {
  font-size: 24px;
  font-weight: 700;
  color: $color-text-primary;
  margin: 0;
}

.piece-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: $color-text-placeholder;
}

.meta-value {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;

  &.author {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &.link {
    color: $color-primary;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }

  &.price {
    color: $color-primary;
    font-size: 18px;
    font-weight: 700;
  }
}

.piece-description,
.piece-tags,
.timeline-section {
  background: white;
  border-radius: $border-radius-md;
  padding: 20px;
  box-shadow: $shadow-sm;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 12px 0;
}

.piece-description p {
  font-size: 14px;
  color: $color-text-secondary;
  line-height: 1.6;
  margin: 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-stage {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.timeline-desc {
  font-size: 12px;
  color: $color-text-secondary;
}

.timeline-pending {
  font-size: 12px;
  color: $color-text-placeholder;
  font-style: italic;
}
</style>
