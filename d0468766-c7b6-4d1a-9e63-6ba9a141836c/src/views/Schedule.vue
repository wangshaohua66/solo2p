<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElRadioGroup, ElRadioButton } from 'element-plus'
import * as ElIcons from '@element-plus/icons-vue'
import SectionPanel from '@/components/SectionPanel.vue'
import { scheduleApi, movieApi, dashboardApi } from '@/api'
import type { ScheduleItem, Movie, Cinema, Hall } from '@/types'

const loading = ref(true)
const movies = ref<Movie[]>([])
const cinemas = ref<Cinema[]>([])
const halls = ref<Hall[]>([])
const schedules = ref<ScheduleItem[]>([])
const selectedCinemaId = ref('C01')
const weekOffset = ref(0)
const monthOffset = ref(0)
const viewMode = ref<'week' | 'month'>('week')
const CLEANING_MINUTES = 15

function computeScheduleWeight(boxOffice: number, rating: number, duration: number): number {
  const boScore = Math.min(1, boxOffice / 500000000)
  const ratingScore = rating / 10
  const durationScore = duration < 100 ? 0.9 : duration > 150 ? 0.7 : 1.0
  const w = boScore * 0.45 + ratingScore * 0.3 + durationScore * 0.25
  return Math.round(w * 100) / 10
}

const weekDays = computed(() => {
  const base = new Date('2026-06-19')
  base.setDate(base.getDate() + weekOffset.value * 7)
  const monday = new Date(base)
  monday.setDate(base.getDate() - base.getDay() + 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { date: d.toISOString().slice(0, 10), label: `${d.getMonth() + 1}/${d.getDate()}`, week: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] }
  })
})

const monthDays = computed(() => {
  const base = new Date('2026-06-19')
  const year = base.getFullYear()
  const month = base.getMonth() + monthOffset.value
  const d = new Date(year, month, 1)
  const total = new Date(year, month + 1, 0).getDate()
  const startWeekday = d.getDay() === 0 ? 6 : d.getDay() - 1
  const days: { date: string; label: string; week: string; inMonth: boolean }[] = []
  for (let i = 0; i < startWeekday; i++) {
    const pd = new Date(year, month, -startWeekday + i + 1)
    days.push({ date: pd.toISOString().slice(0, 10), label: `${pd.getDate()}`, week: ['日', '一', '二', '三', '四', '五', '六'][pd.getDay()], inMonth: false })
  }
  for (let i = 1; i <= total; i++) {
    const cd = new Date(year, month, i)
    days.push({ date: cd.toISOString().slice(0, 10), label: `${i}`, week: ['日', '一', '二', '三', '四', '五', '六'][cd.getDay()], inMonth: true })
  }
  while (days.length % 7 !== 0) {
    const idx = days.length - total - startWeekday + 1
    const nd = new Date(year, month + 1, idx)
    days.push({ date: nd.toISOString().slice(0, 10), label: `${nd.getDate()}`, week: ['日', '一', '二', '三', '四', '五', '六'][nd.getDay()], inMonth: false })
  }
  return days
})

const monthTitle = computed(() => {
  const base = new Date('2026-06-19')
  const year = base.getFullYear()
  const month = base.getMonth() + monthOffset.value + 1
  return `${year}年${month}月`
})

const dayHours = Array.from({ length: 15 }, (_, i) => 9 + i)

const cinemaHalls = computed(() => halls.value.filter((h) => h.cinemaId === selectedCinemaId.value).slice(0, 5))

onMounted(async () => {
  const [m, cs, hs, sch] = await Promise.all([
    movieApi.getMovies(),
    dashboardApi.getCinemas(),
    movieApi.getHalls(),
    scheduleApi.getSchedules({ cinemaId: selectedCinemaId.value })
  ])
  movies.value = m.filter((x) => x.status !== '下映').map((mv) => ({ ...mv, rating: computeScheduleWeight(mv.boxOffice, mv.rating, mv.duration) }))
  cinemas.value = cs
  halls.value = hs
  schedules.value = sch
  loading.value = false
})

async function onCinemaChange() {
  schedules.value = await scheduleApi.getSchedules({ cinemaId: selectedCinemaId.value })
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function toPos(time: string) {
  const start = 9 * 60
  return ((timeToMinutes(time) - start) / 60) * 64
}

const draggedMovie = ref<Movie | null>(null)
const dragOverCell = ref<string | null>(null)

function onDragStart(e: DragEvent, movie: Movie) {
  draggedMovie.value = movie
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('text/plain', movie.id)
}

function onDrop(e: DragEvent, hall: Hall, date: string, hour: number) {
  e.preventDefault()
  dragOverCell.value = null
  const movie = draggedMovie.value
  if (!movie) return
  const startTime = `${String(hour).padStart(2, '0')}:00`
  const endMin = hour * 60 + movie.duration + CLEANING_MINUTES
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  scheduleApi
    .detectConflict({ hallId: hall.id, date, startTime, endTime, cleaningMinutes: CLEANING_MINUTES })
    .then((res) => {
      if (res.conflict) {
        ElMessage.error(`冲突：${res.reason}`)
        return
      }
      const weight = computeScheduleWeight(movie.boxOffice, movie.rating, movie.duration)
      scheduleApi
        .saveSchedule({
          movieId: movie.id,
          movieName: movie.name,
          cinemaId: hall.cinemaId,
          cinemaName: hall.cinemaName,
          hallId: hall.id,
          hallName: `${hall.cinemaName.split('·')[1]} ${hall.name}`,
          date,
          startTime,
          endTime,
          price: hall.type === 'IMAX' ? 88 : hall.type === 'CGS' ? 68 : hall.type === '杜比' ? 78 : 45,
          seatsTotal: hall.capacity,
          weight
        })
        .then(() => {
          ElMessage.success(`《${movie.name}》已排入 ${hall.name} ${startTime}（权重 ${weight}）`)
          onCinemaChange()
        })
    })
  draggedMovie.value = null
}

function cellSchedules(hallId: string, date: string, hour?: number) {
  if (hour !== undefined) {
    return schedules.value.filter((s) => s.hallId === hallId && s.date === date && timeToMinutes(s.startTime) >= hour * 60 && timeToMinutes(s.startTime) < (hour + 1) * 60)
  }
  return schedules.value.filter((s) => s.hallId === hallId && s.date === date)
}

function dateSchedules(date: string) {
  return schedules.value.filter((s) => s.date === date)
}

const statusMap: Record<string, { text: string; color: string }> = {
  planned: { text: '待开售', color: '#60A5FA' },
  on_sale: { text: '在售', color: '#4ADE80' },
  sold_out: { text: '售罄', color: '#C8364F' },
  finished: { text: '已结束', color: '#6b6f7e' }
}
</script>

<template>
  <div class="schedule-page" v-loading="loading">
    <div class="top-bar">
      <div class="filters">
        <el-select v-model="selectedCinemaId" placeholder="选择影院" @change="onCinemaChange" style="width: 220px">
          <el-option v-for="c in cinemas" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-radio-group v-model="viewMode" size="default">
          <el-radio-button value="week"><component :is="(ElIcons as any).Calendar" />周视图</el-radio-button>
          <el-radio-button value="month"><component :is="(ElIcons as any).Calendar" />月视图</el-radio-button>
        </el-radio-group>
        <div class="week-nav" v-if="viewMode === 'week'">
          <el-button :icon="(ElIcons as any).ArrowLeft" circle @click="weekOffset--" />
          <span class="week-label">第 {{ weekOffset + 1 }} 周 · {{ weekDays[0].label }} - {{ weekDays[6].label }}</span>
          <el-button :icon="(ElIcons as any).ArrowRight" circle @click="weekOffset++" />
        </div>
        <div class="week-nav" v-else>
          <el-button :icon="(ElIcons as any).ArrowLeft" circle @click="monthOffset--" />
          <span class="week-label">{{ monthTitle }}</span>
          <el-button :icon="(ElIcons as any).ArrowRight" circle @click="monthOffset++" />
        </div>
      </div>
      <div class="actions">
        <el-button :icon="(ElIcons as any).CopyDocument">复制上周排片</el-button>
        <el-button type="primary" :icon="(ElIcons as any).Check">发布排片</el-button>
      </div>
    </div>

    <div class="schedule-body">
      <SectionPanel title="影片库" subtitle="拖拽至右侧影厅时间格" class="movie-pool">
        <div class="pool-list">
          <div
            v-for="m in movies"
            :key="m.id"
            class="movie-card"
            draggable="true"
            @dragstart="onDragStart($event, m)"
          >
            <div class="mc-poster" :style="{ background: `linear-gradient(135deg, hsl(${(m.name.length * 37) % 360} 45% 35%), hsl(${(m.name.length * 37 + 40) % 360} 50% 22%))` }">
              <span class="mc-initial">{{ m.name[0] }}</span>
            </div>
            <div class="mc-info">
              <strong>{{ m.name }}</strong>
              <div class="mc-meta">
                <span>{{ m.genre }}</span>
                <span>{{ m.duration }}分钟</span>
              </div>
              <div class="mc-weight">
                <span>排片权重</span>
                <div class="weight-bar"><i :style="{ width: `${m.rating * 10}%` }" /></div>
                <strong>{{ m.rating }}</strong>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>

      <!-- 周视图 -->
      <SectionPanel v-if="viewMode === 'week'" title="排片日历 · 周视图" :subtitle="`${cinemas.find(c => c.id === selectedCinemaId)?.name || ''} · 拖拽影片到对应影厅与时段（含${CLEANING_MINUTES}分钟清洁间隔）`" no-padding class="calendar-panel">
        <div class="cal-grid">
          <div class="cal-head">
            <div class="corner-cell">影厅 / 时段</div>
            <div v-for="d in weekDays" :key="d.date" class="head-cell">
              <span class="hc-date">{{ d.label }}</span>
              <span class="hc-week">周{{ d.week }}</span>
            </div>
          </div>
          <div class="cal-body">
            <div v-for="hall in cinemaHalls" :key="hall.id" class="cal-row">
              <div class="hall-cell">
                <strong>{{ hall.name }}</strong>
                <span>{{ hall.type }} · {{ hall.capacity }}座</span>
              </div>
              <div v-for="d in weekDays" :key="d.date" class="day-cell">
                <div
                  class="hour-grid"
                  :class="{ over: dragOverCell === `${hall.id}-${d.date}` }"
                  @dragover.prevent="dragOverCell = `${hall.id}-${d.date}`"
                  @dragleave="dragOverCell = null"
                  @drop="onDrop($event, hall, d.date, 9)"
                >
                  <div
                    v-for="sch in cellSchedules(hall.id, d.date, 9)"
                    :key="sch.id"
                    class="show-block"
                    :style="{ '--c': statusMap[sch.status].color }"
                  >
                    <div class="sb-time">{{ sch.startTime }}</div>
                    <div class="sb-name">{{ sch.movieName }}</div>
                    <div class="sb-meta">
                      <span>¥{{ sch.price }}</span>
                      <span>{{ Math.round((sch.seatsSold / sch.seatsTotal) * 100) }}%</span>
                    </div>
                    <div class="sb-status">{{ statusMap[sch.status].text }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>

      <!-- 月视图 -->
      <SectionPanel v-else title="排片日历 · 月视图" :subtitle="`${cinemas.find(c => c.id === selectedCinemaId)?.name || ''} · 全月场次概览（含${CLEANING_MINUTES}分钟清洁间隔检测）`" no-padding class="calendar-panel">
        <div class="month-grid">
          <div class="month-head">
            <div v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="mhead-cell">星期{{ w }}</div>
          </div>
          <div class="month-body">
            <div
              v-for="d in monthDays"
              :key="d.date"
              class="mday-cell"
              :class="{ 'out-month': !d.inMonth, 'today': d.date === '2026-06-19' }"
            >
              <div class="mday-head">
                <span class="mday-date">{{ d.label }}</span>
                <span class="mday-count">{{ dateSchedules(d.date).length }}场</span>
              </div>
              <div class="mday-shows">
                <div
                  v-for="sch in dateSchedules(d.date).slice(0, 3)"
                  :key="sch.id"
                  class="m-show"
                  :style="{ '--c': statusMap[sch.status].color }"
                >
                  <span class="ms-time">{{ sch.startTime }}</span>
                  <span class="ms-name">{{ sch.movieName }}</span>
                </div>
                <div v-if="dateSchedules(d.date).length > 3" class="m-more">
                  +{{ dateSchedules(d.date).length - 3 }} 更多场次
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  </div>
</template>

<style scoped lang="scss">
.schedule-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.week-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  .week-label {
    font-size: 14px;
    color: var(--c-text-primary);
    font-weight: 600;
    min-width: 150px;
    text-align: center;
  }
}
.actions {
  display: flex;
  gap: 10px;
}
.schedule-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 18px;
}

.pool-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 560px;
  overflow-y: auto;
  @include scrollbar-dark;
}
.movie-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--c-border);
  cursor: grab;
  transition: all 0.2s ease;
  &:hover {
    border-color: $gold-line;
    background: $gold-soft;
    transform: translateX(3px);
  }
  &:active {
    cursor: grabbing;
  }
}
.mc-poster {
  width: 46px;
  height: 62px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .mc-initial {
    font-size: 22px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    font-family: var(--font-display);
  }
}
.mc-info {
  flex: 1;
  min-width: 0;
  strong {
    font-size: 13px;
    color: var(--c-text-primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.mc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--c-text-tertiary);
  margin: 4px 0;
}
.mc-weight {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--c-text-secondary);
  .weight-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: $grad-gold;
      border-radius: 2px;
    }
  }
  strong {
    color: $gold;
    font-family: var(--font-num);
  }
}

.cal-grid {
  overflow-x: auto;
  @include scrollbar-dark;
}
.cal-head {
  display: grid;
  grid-template-columns: 110px repeat(7, 1fr);
  position: sticky;
  top: 0;
  z-index: 2;
}
.corner-cell,
.head-cell {
  background: rgba(232, 181, 71, 0.06);
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  padding: 10px 8px;
  text-align: center;
  font-size: 12px;
}
.corner-cell {
  color: var(--c-text-secondary);
  font-weight: 600;
  font-size: 11px;
  position: sticky;
  left: 0;
  z-index: 3;
}
.head-cell {
  display: flex;
  flex-direction: column;
  .hc-date {
    font-size: 15px;
    font-weight: 600;
    color: var(--c-text-primary);
    font-family: var(--font-num);
  }
  .hc-week {
    font-size: 11px;
    color: var(--c-text-tertiary);
  }
}
.cal-row {
  display: grid;
  grid-template-columns: 110px repeat(7, 1fr);
}
.hall-cell {
  background: rgba(18, 18, 28, 0.6);
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  left: 0;
  z-index: 1;
  strong {
    font-size: 13px;
    color: $gold;
  }
  span {
    font-size: 10px;
    color: var(--c-text-tertiary);
  }
}
.day-cell {
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  min-height: 80px;
  padding: 4px;
}
.hour-grid {
  min-height: 72px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.15s ease;
  &.over {
    background: $gold-soft;
    box-shadow: inset 0 0 0 2px $gold;
  }
}
.show-block {
  border-radius: 6px;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--c) 18%, transparent);
  border-left: 3px solid var(--c);
  position: relative;
  cursor: pointer;
  transition: transform 0.15s ease;
  &:hover {
    transform: scale(1.02);
  }
  .sb-time {
    font-size: 11px;
    color: var(--c);
    font-weight: 600;
    font-family: var(--font-num);
  }
  .sb-name {
    font-size: 12px;
    color: var(--c-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }
  .sb-meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--c-text-secondary);
  }
  .sb-status {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 9px;
    color: var(--c);
  }
}

// 月视图样式
.month-grid {
  width: 100%;
}
.month-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.mhead-cell {
  background: rgba(232, 181, 71, 0.06);
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  padding: 12px 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: $gold;
  &:last-child {
    border-right: none;
  }
}
.month-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(120px, auto);
}
.mday-cell {
  border-bottom: 1px solid var(--c-border);
  border-right: 1px solid var(--c-border);
  padding: 8px;
  background: rgba(255, 255, 255, 0.01);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  transition: background 0.2s ease;
  &.out-month {
    background: rgba(0, 0, 0, 0.15);
    opacity: 0.5;
  }
  &.today {
    background: rgba(232, 181, 71, 0.08);
    .mday-date {
      color: $gold;
      font-weight: 700;
    }
  }
  &:hover {
    background: $gold-soft;
  }
  &:nth-child(7n) {
    border-right: none;
  }
}
.mday-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .mday-date {
    font-size: 14px;
    font-family: var(--font-num);
    color: var(--c-text-primary);
  }
  .mday-count {
    font-size: 11px;
    color: $gold;
    background: rgba(232, 181, 71, 0.12);
    padding: 1px 6px;
    border-radius: 8px;
  }
}
.mday-shows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  overflow: hidden;
}
.m-show {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 3px 5px;
  border-radius: 4px;
  font-size: 11px;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  border-left: 2px solid var(--c);
  .ms-time {
    font-family: var(--font-num);
    color: var(--c);
    font-weight: 600;
    flex-shrink: 0;
  }
  .ms-name {
    color: var(--c-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.m-more {
  font-size: 11px;
  color: var(--c-text-tertiary);
  text-align: center;
  padding: 4px;
  border-top: 1px dashed var(--c-border);
  margin-top: auto;
}
</style>
