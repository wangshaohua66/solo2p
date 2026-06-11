<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Calendar, Clock, Edit, Sunny } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import QRCode from 'qrcode'
import type { Course, CourseSession } from '@/types'
import { courseApi } from '@/api/course'

const route = useRoute()
const router = useRouter()

const activeTab = ref('overview')
const course = ref<Course | null>(null)
const isRegistered = ref(false)
const loading = ref(false)
const showQrDialog = ref(false)
const qrCodeDataUrl = ref('')
const currentSessionId = ref('')
const currentSession = ref<CourseSession | null>(null)

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    wheel: '拉坯',
    handbuilding: '捏塑',
    decoration: '彩绘',
    glaze: '釉料'
  }
  return map[type] || type
}

const getLevelLabel = (level: string) => {
  const map: Record<string, string> = {
    beginner: '入门级',
    intermediate: '进阶级',
    advanced: '高级'
  }
  return map[level] || level
}

const getLevelColor = (level: string) => {
  const map: Record<string, string> = {
    beginner: '#52c41a',
    intermediate: '#faad14',
    advanced: '#ff4d4f'
  }
  return map[level] || '#999'
}

const handleBack = () => {
  router.push('/courses')
}

const handleRegister = async () => {
  if (isRegistered.value) {
    ElMessage.info('您已报名此课程')
    return
  }
  if (!course.value?.id) return
  
  try {
    loading.value = true
    const result = await courseApi.register(course.value.id)
    if (result) {
      ElMessage.success(result.message || '报名成功！请在开课前准时参加')
      isRegistered.value = true
      if (course.value) {
        course.value.currentStudents++
      }
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '报名失败')
  } finally {
    loading.value = false
  }
}

const canCheckIn = (session: CourseSession) => {
  const now = dayjs()
  const sessionDateTime = dayjs(`${session.date} ${session.startTime}`)
  const checkInStart = sessionDateTime.subtract(30, 'minute')
  const checkInEnd = sessionDateTime.add(15, 'minute')
  return now.isAfter(checkInStart) && now.isBefore(checkInEnd)
}

const getCheckInStatusText = (session: CourseSession) => {
  const now = dayjs()
  const sessionDateTime = dayjs(`${session.date} ${session.startTime}`)
  const checkInStart = sessionDateTime.subtract(30, 'minute')
  
  if (now.isBefore(checkInStart)) {
    return `开课前30分钟开放签到`
  }
  const checkInEnd = sessionDateTime.add(15, 'minute')
  if (now.isAfter(checkInEnd)) {
    return '签到已结束'
  }
  return '可签到'
}

const generateQRCode = async (session: CourseSession) => {
  try {
    if (!course.value?.id) return
    const result = await courseApi.generateQrCode(course.value.id, session.id)
    if (result?.qrDataUrl) {
      qrCodeDataUrl.value = result.qrDataUrl
      return
    }
  } catch (e) {
    console.warn('后端QR生成失败，使用本地生成:', e)
  }

  const checkInData = {
    courseId: course.value?.id,
    sessionId: session.id,
    timestamp: Date.now(),
    type: 'course_checkin'
  }
  
  const qrData = JSON.stringify(checkInData)
  
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1d2129',
        light: '#ffffff'
      }
    })
  } catch (err) {
    console.error('QR Code generation failed:', err)
    ElMessage.error('二维码生成失败')
  }
}

const handleCheckIn = async (sessionId: string) => {
  if (!isRegistered.value) {
    ElMessage.warning('请先报名此课程')
    return
  }
  
  const session = course.value?.schedule.find(s => s.id === sessionId)
  if (!session) return
  
  if (!canCheckIn(session)) {
    ElMessage.warning(getCheckInStatusText(session))
    return
  }
  
  currentSessionId.value = sessionId
  currentSession.value = session
  await generateQRCode(session)
  showQrDialog.value = true
}

const confirmCheckIn = async () => {
  if (!course.value?.id || !currentSessionId.value) return
  
  try {
    loading.value = true
    const result = await courseApi.checkIn(course.value.id, currentSessionId.value)
    ElMessage.success(result?.message || '签到成功！')
    showQrDialog.value = false
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '签到失败')
  } finally {
    loading.value = false
  }
}

const fetchCourse = async () => {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  try {
    course.value = await courseApi.getCourse(id)
    const regStatus = await courseApi.getMyRegistration(id)
    if (regStatus) {
      isRegistered.value = regStatus.isRegistered || regStatus.status === 'registered'
    }
  } catch (e) {
    console.error('Failed to fetch course:', e)
    ElMessage.error('加载课程详情失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchCourse()
})
</script>

<template>
  <div class="course-detail-page" v-if="course">
    <div class="page-header">
      <el-button :icon="ArrowLeft" text @click="handleBack">
        返回课程列表
      </el-button>
    </div>

    <div class="detail-hero">
      <div class="hero-cover" :class="course.type">
        <el-icon :size="64">
          <component :is="course.type === 'wheel' ? 'Odometer' : 
                          course.type === 'handbuilding' ? 'Hand' :
                          course.type === 'decoration' ? 'Brush' : 'MagicStick'" />
        </el-icon>
        <div class="cover-tags">
          <el-tag 
            size="large"
            effect="dark"
            :style="{ backgroundColor: getLevelColor(course.level) }"
          >
            {{ getLevelLabel(course.level) }}
          </el-tag>
          <el-tag size="large" type="info" effect="dark">
            {{ getTypeLabel(course.type) }}
          </el-tag>
        </div>
      </div>
      
      <div class="hero-info">
        <h1 class="course-title">{{ course.title }}</h1>
        <div class="course-meta">
          <div class="instructor">
            <el-avatar :size="40">{{ course.instructorName?.charAt(0) }}</el-avatar>
            <div class="instructor-info">
              <span class="instructor-name">{{ course.instructorName }}</span>
              <span class="instructor-title">陶艺师</span>
            </div>
          </div>
          <div class="meta-divider"></div>
          <div class="meta-item">
            <el-icon><Calendar /></el-icon>
            <span>{{ course.schedule.length }} 节课</span>
          </div>
          <div class="meta-item">
            <el-icon><Clock /></el-icon>
            <span>每节 {{ course.duration }} 分钟</span>
          </div>
          <div class="meta-item">
            <el-icon><User /></el-icon>
            <span>{{ course.currentStudents }}/{{ course.maxStudents }} 人</span>
          </div>
        </div>
        
        <div class="price-section">
          <div class="price">
            <span class="price-symbol">¥</span>
            <span class="price-value">{{ course.price }}</span>
            <span class="price-unit">/ 期</span>
          </div>
          <el-button 
            type="primary" 
            size="large"
            :class="{ registered: isRegistered }"
            @click="handleRegister"
          >
            {{ isRegistered ? '已报名' : '立即报名' }}
          </el-button>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="课程介绍" name="overview">
        <div class="tab-content">
          <div class="section">
            <h3 class="section-title">课程简介</h3>
            <p class="course-description">{{ course.description }}</p>
          </div>
          
          <div class="section">
            <h3 class="section-title">适合人群</h3>
            <ul class="suitable-list">
              <li>陶艺零基础爱好者</li>
              <li>想体验手作乐趣的都市人群</li>
              <li>希望培养专注力和耐心的朋友</li>
              <li>亲子家庭共同体验</li>
            </ul>
          </div>
          
          <div class="section">
            <h3 class="section-title">你将学到</h3>
            <div class="learn-grid">
              <div class="learn-item">
                <div class="learn-icon" style="background: #e6f7ff; color: #1890ff;">
                  <el-icon><Brush /></el-icon>
                </div>
                <span>泥料准备与揉泥</span>
              </div>
              <div class="learn-item">
                <div class="learn-icon" style="background: #f6ffed; color: #52c41a;">
                  <el-icon><Odometer /></el-icon>
                </div>
                <span>拉坯基础手法</span>
              </div>
              <div class="learn-item">
                <div class="learn-icon" style="background: #fff7e6; color: #faad14;">
                  <el-icon><Edit /></el-icon>
                </div>
                <span>修坯与整型</span>
              </div>
              <div class="learn-item">
                <div class="learn-icon" style="background: #fff1f0; color: #ff4d4f;">
                  <el-icon><Sunny /></el-icon>
                </div>
                <span>烧制知识</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="课程安排" name="schedule">
        <div class="tab-content">
          <div class="schedule-list">
            <div 
              v-for="(session, index) in course.schedule" 
              :key="session.id"
              class="session-item"
            >
              <div class="session-number">{{ index + 1 }}</div>
              <div class="session-info">
                <h4 class="session-topic">{{ session.topic }}</h4>
                <div class="session-time">
                  <el-icon><Calendar /></el-icon>
                  <span>{{ dayjs(session.date).format('YYYY-MM-DD dddd') }}</span>
                  <el-icon><Clock /></el-icon>
                  <span>{{ session.startTime }} - {{ session.endTime }}</span>
                </div>
              </div>
              <div class="session-action">
                <el-button 
                  size="small"
                  :type="canCheckIn(session) ? 'primary' : 'info'"
                  :disabled="!canCheckIn(session) || !isRegistered"
                  @click="handleCheckIn(session.id)"
                >
                  {{ isRegistered ? (canCheckIn(session) ? '签到' : getCheckInStatusText(session)) : '需先报名' }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="学员名单" name="students">
        <div class="tab-content">
          <el-empty description="学员名单功能开发中..." />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog 
      v-model="showQrDialog" 
      title="课程签到"
      width="360px"
      align-center
    >
      <div class="qr-dialog-content">
        <div class="qr-info">
          <div class="qr-course-title">{{ currentSession?.topic }}</div>
          <div class="qr-course-time">
            <el-icon><Calendar /></el-icon>
            <span>{{ currentSession ? dayjs(currentSession.date).format('YYYY-MM-DD') : '' }}</span>
            <el-icon><Clock /></el-icon>
            <span>{{ currentSession?.startTime }} - {{ currentSession?.endTime }}</span>
          </div>
        </div>
        
        <div class="qr-code-wrapper">
          <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="签到二维码" class="qr-code-image" />
        </div>
        
        <div class="qr-tips">
          <p class="tip-title">扫码签到须知</p>
          <ul class="tip-list">
            <li>请在开课前30分钟内进行签到</li>
            <li>请出示此二维码给老师扫码验证</li>
            <li>迟到15分钟后将无法签到</li>
          </ul>
        </div>
        
        <div class="qr-actions">
          <el-button type="primary" class="full-width" @click="confirmCheckIn">
            确认签到
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.course-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-hero {
  display: flex;
  gap: 24px;
  background: white;
  border-radius: $border-radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
}

.hero-cover {
  width: 360px;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  position: relative;

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

  @media (max-width: 1024px) {
    width: 100%;
    min-height: 200px;
  }
}

.cover-tags {
  position: absolute;
  bottom: 20px;
  display: flex;
  gap: 8px;
}

.hero-info {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.course-title {
  font-size: 24px;
  font-weight: 700;
  color: $color-text-primary;
  margin: 0;
}

.course-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid $color-border;
}

.instructor {
  display: flex;
  align-items: center;
  gap: 10px;
}

.instructor-info {
  display: flex;
  flex-direction: column;
}

.instructor-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-primary;
}

.instructor-title {
  font-size: 12px;
  color: $color-text-placeholder;
}

.meta-divider {
  width: 1px;
  height: 30px;
  background: $color-border;

  @media (max-width: $breakpoint-mobile) {
    display: none;
  }
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;
}

.price-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;

  @media (max-width: $breakpoint-mobile) {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

.price {
  display: flex;
  align-items: baseline;
  color: $color-primary;
}

.price-symbol {
  font-size: 16px;
  font-weight: 500;
}

.price-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.price-unit {
  font-size: 14px;
  color: $color-text-secondary;
  margin-left: 6px;
}

.detail-tabs {
  background: white;
  border-radius: $border-radius-md;
  padding: 0 20px;
  box-shadow: $shadow-sm;

  :deep(.el-tabs__header) {
    margin: 0;
  }
}

.tab-content {
  padding: 10px 0 20px 0;
}

.section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
  margin: 0 0 12px 0;
}

.course-description {
  font-size: 14px;
  color: $color-text-secondary;
  line-height: 1.8;
  margin: 0;
}

.suitable-list {
  margin: 0;
  padding-left: 20px;

  li {
    font-size: 14px;
    color: $color-text-secondary;
    line-height: 2;
  }
}

.learn-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.learn-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: $color-bg;
  border-radius: $border-radius-md;
  font-size: 13px;
  color: $color-text-primary;
  text-align: center;
}

.learn-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: $color-bg;
  border-radius: $border-radius-md;
  transition: all $transition-fast;

  &:hover {
    background: darken($color-bg, 2%);
  }
}

.session-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: $color-primary;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-topic {
  font-size: 15px;
  font-weight: 500;
  color: $color-text-primary;
  margin: 0 0 6px 0;
}

.session-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: $color-text-secondary;
  flex-wrap: wrap;
}

.session-action {
  flex-shrink: 0;
}

.qr-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 10px 0;
}

.qr-info {
  text-align: center;
  width: 100%;
  
  .qr-course-title {
    font-size: 16px;
    font-weight: 600;
    color: #1d2129;
    margin-bottom: 8px;
  }
  
  .qr-course-time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: #86909c;
    flex-wrap: wrap;
    
    .el-icon {
      font-size: 14px;
    }
  }
}

.qr-code-wrapper {
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  
  .qr-code-image {
    width: 200px;
    height: 200px;
    display: block;
  }
}

.qr-tips {
  width: 100%;
  padding: 12px 16px;
  background: #f7f8fa;
  border-radius: 8px;
  
  .tip-title {
    font-size: 13px;
    font-weight: 500;
    color: #4e5969;
    margin: 0 0 8px 0;
  }
  
  .tip-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #86909c;
    line-height: 1.8;
  }
}

.qr-actions {
  width: 100%;
  
  .full-width {
    width: 100%;
  }
}
</style>
