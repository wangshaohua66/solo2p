<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
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

const dayHours = Array.from({ length: 15 }, (_, i) => 9 + i)

const cinemaHalls = computed(() => halls.value.filter((h) => h.cinemaId === selectedCinemaId.value).slice(0, 5))

onMounted(async () => {
  const [m, cs, hs, sch] = await Promise.all([
    movieApi.getMovies(),
    dashboardApi.getCinemas(),
    movieApi.getHalls(),
    scheduleApi.getSchedules({ cinemaId: selectedCinemaId.value })
  ])
  movies.value = m.filter((x) => x.status !== '下映')
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
  const endMin = hour * 60 + movie.duration + 15
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  scheduleApi
    .detectConflict({ hallId: hall.id, date, startTime, endTime })
    .then((res) => {
      if (res.conflict) {
        ElMessage.error(`冲突：${res.reason}`)
        return
      }
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
          weight: Math.round((0.6 + Math.random() * 0.4) * 100) / 100
        })
        .then(() => {
          ElMessage.success(`《${movie.name}》已排入 ${hall.name} ${startTime}`)
          onCinemaChange()
        })
    })
  draggedMovie.value = null
}

function cellSchedules(hallId: string, date: string, hour: number) {
  return schedules.value.filter((s) => s.hallId === hallId && s.date === date && timeToMinutes(s.startTime) >= hour * 60 && timeToMinutes(s.startTime) < (hour + 1) * 60)
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
        <div class="week-nav">
          <el-button :icon="(ElIcons as any).ArrowLeft" circle @click="weekOffset--" />
          <span class="week-label">第 {{ weekOffset + 1 }} 周 · {{ weekDays[0].label }} - {{ weekDays[6].label }}</span>
          <el-button :icon="(ElIcons as any).ArrowRight" circle @click="weekOffset++" />
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

      <SectionPanel title="排片日历 · 周视图" :subtitle="`${cinemas.find(c => c.id === selectedCinemaId)?.name || ''} · 拖拽影片到对应影厅与时段`" no-padding class="calendar-panel">
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
</style>
