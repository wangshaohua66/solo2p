<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Course, CourseType, CourseLevel, CourseStatus } from '@/types'
import { ElMessage } from 'element-plus'

const router = useRouter()

const activeTab = ref<'all' | 'my'>('all')
const filterType = ref<CourseType | ''>('')
const filterLevel = ref<CourseLevel | ''>('')
const searchKeyword = ref('')

const courses = ref<Course[]>([
  {
    id: '1',
    title: '零基础拉坯入门班',
    description: '从零开始学习拉坯技艺，掌握基本手法和造型技巧，适合完全零基础的陶艺爱好者。',
    type: 'wheel',
    instructorId: 'ins-1',
    instructorName: '李老师',
    price: 299,
    duration: 120,
    maxStudents: 8,
    currentStudents: 5,
    level: 'beginner',
    startDate: '2024-02-01',
    endDate: '2024-03-01',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    schedule: [
      { id: 's1', date: '2024-02-03', startTime: '14:00', endTime: '16:00', topic: '初识陶艺与泥料准备' },
      { id: 's2', date: '2024-02-10', startTime: '14:00', endTime: '16:00', topic: '基础拉坯手法' },
      { id: 's3', date: '2024-02-17', startTime: '14:00', endTime: '16:00', topic: '碗与杯的造型' },
      { id: 's4', date: '2024-02-24', startTime: '14:00', endTime: '16:00', topic: '修坯与装饰' }
    ]
  },
  {
    id: '2',
    title: '手工捏塑创作课',
    description: '使用手捏技法创作独特造型的陶艺作品，发挥想象力，打造独一无二的艺术品。',
    type: 'handbuilding',
    instructorId: 'ins-2',
    instructorName: '王老师',
    price: 259,
    duration: 90,
    maxStudents: 10,
    currentStudents: 8,
    level: 'beginner',
    startDate: '2024-02-05',
    endDate: '2024-02-26',
    status: 'published',
    createdAt: '2024-01-05T00:00:00Z',
    schedule: [
      { id: 's1', date: '2024-02-05', startTime: '10:00', endTime: '11:30', topic: '手捏基础技法' },
      { id: 's2', date: '2024-02-12', startTime: '10:00', endTime: '11:30', topic: '动物造型创作' },
      { id: 's3', date: '2024-02-19', startTime: '10:00', endTime: '11:30', topic: '花器设计' },
      { id: 's4', date: '2024-02-26', startTime: '10:00', endTime: '11:30', topic: '综合创作' }
    ]
  },
  {
    id: '3',
    title: '釉下彩彩绘进阶',
    description: '学习釉下彩彩绘技巧，掌握青花、五彩等传统技法，创作精美的彩绘作品。',
    type: 'decoration',
    instructorId: 'ins-1',
    instructorName: '李老师',
    price: 399,
    duration: 150,
    maxStudents: 6,
    currentStudents: 6,
    level: 'intermediate',
    startDate: '2024-02-10',
    endDate: '2024-03-10',
    status: 'published',
    createdAt: '2024-01-10T00:00:00Z',
    schedule: [
      { id: 's1', date: '2024-02-10', startTime: '15:00', endTime: '17:30', topic: '釉下彩基础' },
      { id: 's2', date: '2024-02-17', startTime: '15:00', endTime: '17:30', topic: '线描技法' },
      { id: 's3', date: '2024-02-24', startTime: '15:00', endTime: '17:30', topic: '青花技法' },
      { id: 's4', date: '2024-03-03', startTime: '15:00', endTime: '17:30', topic: '五彩技法' }
    ]
  },
  {
    id: '4',
    title: '釉料配方实验课',
    description: '深入学习釉料配方原理，亲手调配釉料，了解不同烧成效果的影响因素。',
    type: 'glaze',
    instructorId: 'ins-3',
    instructorName: '陈老师',
    price: 599,
    duration: 180,
    maxStudents: 4,
    currentStudents: 3,
    level: 'advanced',
    startDate: '2024-02-15',
    endDate: '2024-03-15',
    status: 'published',
    createdAt: '2024-01-15T00:00:00Z',
    schedule: [
      { id: 's1', date: '2024-02-15', startTime: '09:00', endTime: '12:00', topic: '釉料基础理论' },
      { id: 's2', date: '2024-02-22', startTime: '09:00', endTime: '12:00', topic: '原料特性与调配' },
      { id: 's3', date: '2024-03-01', startTime: '09:00', endTime: '12:00', topic: '基础釉实验' },
      { id: 's4', date: '2024-03-08', startTime: '09:00', endTime: '12:00', topic: '色釉与效果釉' }
    ]
  }
])

const filteredCourses = computed(() => {
  return courses.value.filter(c => {
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      if (!c.title.toLowerCase().includes(kw) && 
          !c.instructorName?.toLowerCase().includes(kw) &&
          !c.description?.toLowerCase().includes(kw)) {
        return false
      }
    }
    if (filterType.value && c.type !== filterType.value) return false
    if (filterLevel.value && c.level !== filterLevel.value) return false
    if (c.status === 'draft' || c.status === 'cancelled') return false
    return true
  })
})

const getTypeLabel = (type: CourseType) => {
  const map: Record<CourseType, string> = {
    wheel: '拉坯',
    handbuilding: '捏塑',
    decoration: '彩绘',
    glaze: '釉料'
  }
  return map[type] || type
}

const getLevelLabel = (level: CourseLevel) => {
  const map: Record<CourseLevel, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级'
  }
  return map[level] || level
}

const getLevelColor = (level: CourseLevel) => {
  const map: Record<CourseLevel, string> = {
    beginner: '#52c41a',
    intermediate: '#faad14',
    advanced: '#ff4d4f'
  }
  return map[level] || '#999'
}

const getProgressPercent = (course: Course) => {
  return Math.round((course.currentStudents / course.maxStudents) * 100)
}

const handleCourseClick = (course: Course) => {
  router.push(`/courses/${course.id}`)
}

const handleRegister = (course: Course, e: Event) => {
  e.stopPropagation()
  if (course.currentStudents >= course.maxStudents) {
    ElMessage.warning('课程名额已满，已加入候补名单')
  } else {
    ElMessage.success('报名成功！')
  }
}

const handleCreateCourse = () => {
  ElMessage.info('创建课程功能开发中...')
}
</script>

<template>
  <div class="course-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">课程中心</h2>
        <el-tabs v-model="activeTab" class="header-tabs" @tab-change="() => {}">
          <el-tab-pane label="全部课程" name="all" />
          <el-tab-pane label="我的课程" name="my" />
        </el-tabs>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleCreateCourse">
          发布课程
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-left">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索课程名称、老师..."
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <el-select 
          v-model="filterType" 
          placeholder="课程类型"
          clearable
          class="filter-select"
        >
          <el-option label="拉坯课" value="wheel" />
          <el-option label="捏塑课" value="handbuilding" />
          <el-option label="彩绘课" value="decoration" />
          <el-option label="釉料课" value="glaze" />
        </el-select>
        <el-select 
          v-model="filterLevel" 
          placeholder="难度等级"
          clearable
          class="filter-select"
        >
          <el-option label="入门级" value="beginner" />
          <el-option label="进阶级" value="intermediate" />
          <el-option label="高级" value="advanced" />
        </el-select>
      </div>
    </div>

    <div class="course-grid">
      <div 
        v-for="course in filteredCourses" 
        :key="course.id"
        class="course-card"
        @click="handleCourseClick(course)"
      >
        <div class="course-cover" :class="course.type">
          <div class="cover-icon">
            <el-icon :size="48">
              <component :is="course.type === 'wheel' ? 'Odometer' : 
                              course.type === 'handbuilding' ? 'Hand' :
                              course.type === 'decoration' ? 'Brush' : 'MagicStick'" />
            </el-icon>
          </div>
          <div class="course-tags">
            <el-tag 
              size="small" 
              effect="dark"
              :style="{ backgroundColor: getLevelColor(course.level) }"
            >
              {{ getLevelLabel(course.level) }}
            </el-tag>
            <el-tag size="small" type="info" effect="dark">
              {{ getTypeLabel(course.type) }}
            </el-tag>
          </div>
        </div>
        
        <div class="course-info">
          <h3 class="course-title">{{ course.title }}</h3>
          <p class="course-desc">{{ course.description }}</p>
          
          <div class="course-meta">
            <div class="instructor">
              <el-avatar :size="24">{{ course.instructorName?.charAt(0) }}</el-avatar>
              <span>{{ course.instructorName }}</span>
            </div>
            <div class="schedule-info">
              <el-icon><Calendar /></el-icon>
              <span>{{ course.schedule.length }} 节课</span>
            </div>
          </div>
          
          <div class="progress-section">
            <div class="progress-info">
              <span class="students-count">{{ course.currentStudents }}/{{ course.maxStudents }} 人</span>
              <span 
                class="status-text"
                :class="{ full: course.currentStudents >= course.maxStudents }"
              >
                {{ course.currentStudents >= course.maxStudents ? '已满员' : '报名中' }}
              </span>
            </div>
            <el-progress 
              :percentage="getProgressPercent(course)" 
              :stroke-width="6"
              :color="course.currentStudents >= course.maxStudents ? '#f56c6c' : '#c85a32'"
              :show-text="false"
            />
          </div>
          
          <div class="course-footer">
            <div class="price">
              <span class="price-symbol">¥</span>
              <span class="price-value">{{ course.price }}</span>
              <span class="price-unit">/ 期</span>
            </div>
            <el-button 
              type="primary" 
              size="small"
              :disabled="course.status !== 'published'"
              @click="(e) => handleRegister(course, e)"
            >
              {{ course.currentStudents >= course.maxStudents ? '候补' : '立即报名' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredCourses.length === 0" description="暂无课程" />
  </div>
</template>

<style scoped lang="scss">
.course-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: $color-text-primary;
}

.header-tabs {
  :deep(.el-tabs__item) {
    font-size: 15px;
  }
  
  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: $border-radius-md;
  box-shadow: $shadow-sm;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-left {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 280px;
}

.filter-select {
  width: 140px;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.course-card {
  background: white;
  border-radius: $border-radius-md;
  overflow: hidden;
  cursor: pointer;
  transition: all $transition-normal;
  box-shadow: $shadow-sm;

  &:hover {
    transform: translateY(-4px);
    box-shadow: $shadow-lg;
  }
}

.course-cover {
  height: 140px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;

  &.wheel {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  &.handbuilding {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  &.decoration {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  &.glaze {
    background: linear-gradient(135deg, #c85a32 0%, #d4a574 100%);
  }
}

.cover-icon {
  opacity: 0.9;
}

.course-tags {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
}

.course-info {
  padding: 16px;
}

.course-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.course-desc {
  font-size: 13px;
  color: $color-text-secondary;
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 39px;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: $color-text-secondary;
}

.instructor,
.schedule-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-section {
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}

.students-count {
  color: $color-text-secondary;
}

.status-text {
  color: $color-success;
  font-weight: 500;

  &.full {
    color: $color-error;
  }
}

.course-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}

.price {
  display: flex;
  align-items: baseline;
  color: $color-primary;
}

.price-symbol {
  font-size: 14px;
  font-weight: 500;
}

.price-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.price-unit {
  font-size: 12px;
  color: $color-text-secondary;
  margin-left: 4px;
}
</style>
