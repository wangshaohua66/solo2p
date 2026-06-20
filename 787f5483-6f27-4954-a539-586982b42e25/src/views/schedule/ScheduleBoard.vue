<script setup lang="ts">import { ref, onMounted, computed, watch } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import type { ScheduleItem } from '@/types';
import { formatDate, formatDuration } from '@/utils';
import { channels, exportSchedule, importSchedule, syncWithBroadcastSystem, createScheduleItem } from '@/api/schedule';
import Sortable from 'sortablejs';
import * as XLSX from 'xlsx';
const scheduleStore = useScheduleStore();
const loading = computed(() => scheduleStore.loading);
const schedules = computed(() => scheduleStore.schedules);
const totalDuration = computed(() => scheduleStore.totalDuration);
const scheduleGaps = computed(() => scheduleStore.scheduleGaps);
const selectedChannel = computed({
 get: () => scheduleStore.selectedChannel,
 set: (val) => scheduleStore.setSelectedChannel(val)
});
const selectedDate = computed({
 get: () => scheduleStore.selectedDate,
 set: (val) => scheduleStore.setSelectedDate(val)
});
const viewMode = computed({
 get: () => scheduleStore.viewMode,
 set: (val) => scheduleStore.setViewMode(val)
});
const createDialogVisible = ref(false);
const formRef = ref<FormInstance>();
const timelineRef = ref<HTMLElement>();
const form = reactive({
 programName: '',
 programType: '',
 startTime: '',
 endTime: '',
 topicId: undefined as number | undefined
});
const rules: FormRules = {
 programName: [
 { required: true, message: '请输入节目名称', trigger: 'blur' }
 ],
 programType: [
 { required: true, message: '请选择节目类型', trigger: 'change' }
 ],
 startTime: [
 { required: true, message: '请选择开始时间', trigger: 'change' }
 ],
 endTime: [
 { required: true, message: '请选择结束时间', trigger: 'change' }
 ]
};
const programTypeOptions = [
 { value: 'news', label: '新闻' },
 { value: 'feature', label: '专题' },
 { value: 'variety', label: '综艺' },
 { value: 'drama', label: '电视剧' },
 { value: 'advertisement', label: '广告' },
 { value: 'other', label: '其他' }
];
const statusMap: Record<string, {
 text: string;
 class: string;
}> = {
 scheduled: { text: '已排期', class: 'tag--primary' },
 broadcasting: { text: '播出中', class: 'tag--success' },
 completed: { text: '已播出', class: 'tag--info' },
 cancelled: { text: '已取消', class: 'tag--danger' }
};
const sortedSchedules = computed(() => {
 return [...schedules.value].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
});
const timeSlots = computed(() => {
 const slots = [];
 for (let hour = 6; hour < 30; hour++) {
 const displayHour = hour >= 24 ? hour - 24 : hour;
 slots.push({
 hour,
 label: `${displayHour.toString().padStart(2, '0')}:00`,
 time: `${selectedDate.value} ${displayHour.toString().padStart(2, '0')}:00:00`
 });
 }
 return slots;
});
let sortableInstance: Sortable | null = null;
function initSortable() {
 if (!timelineRef.value)
 return;
 const next = (el: HTMLElement) => el.nextElementSibling;
 const prev = (el: HTMLElement) => el.previousElementSibling;
 const getParent = (el: HTMLElement) => el.parentElement;
 sortableInstance = Sortable.create(timelineRef.value, {
 animation: 150,
 handle: '.schedule-item',
 ghostClass: 'sortable-ghost',
 chosenClass: 'sortable-chosen',
 dragClass: 'sortable-drag',
 onEnd: async (evt) => {
 if (evt.oldIndex === evt.newIndex)
 return;
 const items = sortedSchedules.value.map((item, index) => ({
 id: item.id,
 order: index + 1
 }));
 try {
 await scheduleStore.reorderItems(items);
 ElMessage.success('排序已更新');
 }
 catch (error) {
 ElMessage.error('排序更新失败');
 }
 }
 });
}
function destroySortable() {
 if (sortableInstance) {
 sortableInstance.destroy();
 sortableInstance = null;
 }
}
watch(viewMode, (newVal) => {
 if (newVal === 'timeline') {
 setTimeout(initSortable, 100);
 }
 else {
 destroySortable();
 }
});
function openCreateDialog() {
 Object.assign(form, {
 programName: '',
 programType: '',
 startTime: `${selectedDate.value} 00:00:00`,
 endTime: `${selectedDate.value} 00:30:00`,
 topicId: undefined
 });
 createDialogVisible.value = true;
}
async function handleCreate() {
 if (!formRef.value)
 return;
 await formRef.value.validate(async (valid) => {
 if (valid) {
 try {
 await scheduleStore.addScheduleItem({
 ...form,
 startTime: `${selectedDate.value} ${form.startTime.split(' ')[1] || form.startTime}`,
 endTime: `${selectedDate.value} ${form.endTime.split(' ')[1] || form.endTime}`,
 duration: calculateDuration(form.startTime, form.endTime),
 status: 'scheduled',
 createdBy: '当前用户'
 });
 ElMessage.success('节目已添加');
 createDialogVisible.value = false;
 }
 catch (error) {
 ElMessage.error('添加失败');
 }
 }
 });
}
function calculateDuration(start: string, end: string): number {
 const startTime = new Date(`2000-01-01 ${start.split(' ')[1] || start}`).getTime();
 const endTime = new Date(`2000-01-01 ${end.split(' ')[1] || end}`).getTime();
 return Math.floor((endTime - startTime) / 60000);
}
async function handleEdit(item: ScheduleItem) {
 ElMessage.info('编辑功能开发中');
}
async function handleDelete(item: ScheduleItem) {
 try {
 await ElMessageBox.confirm(`确认删除节目"${item.programName}"吗？`, '确认删除', {
 type: 'warning'
 });
 await scheduleStore.removeScheduleItem(item.id);
 ElMessage.success('删除成功');
 }
 catch {
 // 用户取消
 }
}
async function handleExport(format: 'excel' | 'xml') {
 try {
 const blob = await exportSchedule({
 channelId: selectedChannel.value,
 startDate: selectedDate.value,
 endDate: selectedDate.value,
 format
 });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `节目单_${channels.find(c => c.id === selectedChannel.value)?.name}_${selectedDate.value}.${format === 'excel' ? 'xlsx' : 'xml'}`;
 a.click();
 window.URL.revokeObjectURL(url);
 ElMessage.success('导出成功');
 }
 catch (error) {
 ElMessage.error('导出失败');
 }
}
function handleImport() {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = '.xlsx,.xls,.xml';
 input.onchange = async (e: Event) => {
 const file = (e.target as HTMLInputElement).files?.[0];
 if (!file)
 return;
 try {
 await importSchedule(file, selectedChannel.value, selectedDate.value);
 ElMessage.success('导入成功');
 await scheduleStore.fetchSchedule();
 }
 catch (error) {
 ElMessage.error('导入失败');
 }
 };
 input.click();
}
async function handleSync() {
 try {
 await ElMessageBox.confirm('确认同步到播出系统吗？', '确认同步', {
 type: 'warning'
 });
 const ids = schedules.value.map(s => s.id);
 await syncWithBroadcastSystem(ids);
 ElMessage.success('同步成功');
 }
 catch {
 // 用户取消
 }
}
function getTimePosition(time: string): number {
 const date = new Date(time);
 const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
 return (hours - 6) * 60;
}
function getItemDurationInMinutes(item: ScheduleItem): number {
 return item.duration;
}
onMounted(() => {
 scheduleStore.fetchSchedule();
 if (viewMode.value === 'timeline') {
 setTimeout(initSortable, 100);
 }
});
</script>

<template>
  <div class="page-container schedule-board">
    <div class="page-header">
      <div class="page-header__title">播出排期看板</div>
      <div class="page-header__actions">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>添加节目
        </el-button>
        <el-dropdown>
          <el-button>
            <el-icon><Download /></el-icon>导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleExport('excel')">
                <el-icon><Document /></el-icon>Excel 格式
              </el-dropdown-item>
              <el-dropdown-item @click="handleExport('xml')">
                <el-icon><Document /></el-icon>XML 格式
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="handleImport">
          <el-icon><Upload /></el-icon>导入
        </el-button>
        <el-button type="success" @click="handleSync">
          <el-icon><Connection /></el-icon>同步播出系统
        </el-button>
      </div>
    </div>
    
    <div class="card filter-card">
      <div class="filter-left">
        <el-radio-group v-model="selectedChannel" size="large">
          <el-radio-button
            v-for="channel in channels"
            :key="channel.id"
            :value="channel.id"
          >
            {{ channel.name }}
          </el-radio-button>
        </el-radio-group>
      </div>
      
      <div class="filter-center">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          size="large"
          style="width: 200px"
        />
      </div>
      
      <div class="filter-right">
        <div class="view-toggle">
          <el-button-group>
            <el-button :type="viewMode === 'timeline' ? 'primary' : ''" @click="viewMode = 'timeline'">
              <el-icon><Time /></el-icon>时间轴视图
            </el-button>
            <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode = 'list'">
              <el-icon><List /></el-icon>列表视图
            </el-button>
          </el-button-group>
        </div>
      </div>
    </div>
    
    <div class="stats-bar">
      <div class="stat-item">
        <span class="label">节目数量</span>
        <span class="value">{{ schedules.length }}</span>
      </div>
      <div class="stat-item">
        <span class="label">总时长</span>
        <span class="value">{{ formatDuration(totalDuration * 60) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">空档数量</span>
        <span class="value" :class="{ warning: scheduleGaps.length > 0 }">{{ scheduleGaps.length }}</span>
      </div>
    </div>
    
    <el-alert
      v-if="scheduleGaps.length > 0"
      :title="`检测到 ${scheduleGaps.length} 个播出空档，请及时填充`"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #default>
        <div class="gap-list">
          <div v-for="(gap, index) in scheduleGaps.slice(0, 5)" :key="index" class="gap-item">
            <span>{{ formatDate(gap.startTime, 'HH:mm') }} - {{ formatDate(gap.endTime, 'HH:mm') }}</span>
            <span class="gap-duration">空档 {{ gap.duration }} 分钟</span>
          </div>
        </div>
      </div>
    </el-alert>
    
    <div v-if="viewMode === 'timeline'" ref="timelineRef" class="card timeline-container" v-loading="loading">
      <div class="timeline-header">
        <div class="timeline-time-slot" v-for="slot in timeSlots" :key="slot.hour">
          <div class="time-label">{{ slot.label }}</div>
          <div class="time-line"></div>
        </div>
      </div>
      
      <div class="timeline-content">
        <div
          v-for="item in sortedSchedules"
          :key="item.id"
          class="schedule-item"
          :class="item.programType"
          :style="{
            left: `${getTimePosition(item.startTime)}px`,
            width: `${getItemDurationInMinutes(item)}px`
          }"
          @click="handleEdit(item)"
        >
          <div class="item-time">
            {{ formatDate(item.startTime, 'HH:mm') }} - {{ formatDate(item.endTime, 'HH:mm') }}
          </div>
          <div class="item-title">{{ item.programName }}</div>
          <div class="item-duration">{{ formatDuration(item.duration * 60) }}</div>
          <div class="item-actions">
            <el-button type="danger" text size="small" @click.stop="handleDelete(item)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="card" v-loading="loading">
      <el-table
        :data="sortedSchedules"
        stripe
        style="width: 100%"
        row-key="id"
      >
        <el-table-column type="index" width="60" label="序号" />
        
        <el-table-column prop="programName" label="节目名称" min-width="200" />
        
        <el-table-column prop="programType" label="类型" width="100">
          <template #default="{ row }">
            <span
              class="tag"
              :class="{
                'tag--primary': row.programType === 'news',
                'tag--success': row.programType === 'feature',
                'tag--warning': row.programType === 'variety',
                'tag--danger': row.programType === 'drama',
                'tag--info': row.programType === 'advertisement'
              }"
            >
              {{ programTypeOptions.find(o => o.value === row.programType)?.label }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="startTime" label="开始时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.startTime, 'HH:mm:ss') }}
          </template>
        </el-table-column>
        
        <el-table-column prop="endTime" label="结束时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.endTime, 'HH:mm:ss') }}
          </template>
        </el-table-column>
        
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration * 60) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="statusMap[row.status].class">
              {{ statusMap[row.status].text }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="createdBy" label="创建人" width="100" />
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <el-dialog
      v-model="createDialogVisible"
      title="添加节目"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="节目名称" prop="programName">
          <el-input v-model="form.programName" placeholder="请输入节目名称" />
        </el-form-item>
        
        <el-form-item label="节目类型" prop="programType">
          <el-select v-model="form.programType" placeholder="请选择" style="width: 100%">
            <el-option
              v-for="item in programTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-time-picker
                v-model="form.startTime"
                value-format="HH:mm:ss"
                placeholder="选择开始时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-time-picker
                v-model="form.endTime"
                value-format="HH:mm:ss"
                placeholder="选择结束时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.schedule-board {
  .filter-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 16px;
    flex-wrap: wrap;
  }
  
  .stats-bar {
    display: flex;
    gap: 32px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    
    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .label {
        font-size: 12px;
        color: var(--text-color-tertiary);
      }
      
      .value {
        font-size: 20px;
        font-weight: 600;
        color: var(--text-color-primary);
        
        &.warning {
          color: var(--warning-color);
        }
      }
    }
  }
  
  .gap-list {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 8px;
    
    .gap-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background-color: rgba(230, 162, 60, 0.1);
      border-radius: 4px;
      font-size: 12px;
      
      .gap-duration {
        color: var(--warning-color);
        font-weight: 500;
      }
    }
  }
  
  .timeline-container {
    position: relative;
    overflow-x: auto;
    min-height: 300px;
  }
  
  .timeline-header {
    display: flex;
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--bg-color-card);
  }
  
  .timeline-time-slot {
    position: relative;
    width: 60px;
    flex-shrink: 0;
    
    .time-label {
      font-size: 11px;
      color: var(--text-color-tertiary);
      padding: 4px 0 4px 4px;
    }
    
    .time-line {
      position: absolute;
      top: 28px;
      left: 0;
      width: 1px;
      height: calc(100vh - 300px);
      min-height: 250px;
      background-color: var(--border-color-light);
    }
  }
  
  .timeline-content {
    position: relative;
    height: 80px;
    margin-top: 8px;
  }
  
  .schedule-item {
    position: absolute;
    top: 0;
    height: 60px;
    padding: 8px 12px;
    border-radius: var(--border-radius-sm);
    cursor: grab;
    overflow: hidden;
    transition: all var(--transition-fast);
    min-width: 60px;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      z-index: 5;
    }
    
    &.news {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.9), rgba(64, 158, 255, 0.7));
      border-left: 3px solid var(--primary-color);
    }
    
    &.feature {
      background: linear-gradient(135deg, rgba(103, 194, 58, 0.9), rgba(103, 194, 58, 0.7));
      border-left: 3px solid var(--success-color);
    }
    
    &.variety {
      background: linear-gradient(135deg, rgba(230, 162, 60, 0.9), rgba(230, 162, 60, 0.7));
      border-left: 3px solid var(--warning-color);
    }
    
    &.drama {
      background: linear-gradient(135deg, rgba(245, 108, 108, 0.9), rgba(245, 108, 108, 0.7));
      border-left: 3px solid var(--danger-color);
    }
    
    &.advertisement {
      background: linear-gradient(135deg, rgba(144, 147, 153, 0.9), rgba(144, 147, 153, 0.7));
      border-left: 3px solid var(--info-color);
    }
    
    .item-time {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 4px;
    }
    
    .item-title {
      font-size: 13px;
      font-weight: 500;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .item-duration {
      position: absolute;
      bottom: 6px;
      right: 12px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.8);
    }
    
    .item-actions {
      position: absolute;
      top: 4px;
      right: 4px;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    &:hover .item-actions {
      opacity: 1;
    }
  }
  
  .sortable-ghost {
    opacity: 0.5;
    background-color: var(--bg-color-tertiary) !important;
  }
  
  .sortable-chosen {
    cursor: grabbing;
  }
  
  .sortable-drag {
    opacity: 0.8;
    transform: rotate(2deg);
  }
}

@media (max-width: 768px) {
  .schedule-board {
    .filter-card {
      flex-direction: column;
      align-items: stretch;
    }
    
    .filter-center {
      .el-date-picker {
        width: 100% !important;
      }
    }
    
    .filter-right {
      .view-toggle {
        :deep(.el-button-group) {
          width: 100%;
          
          .el-button {
            flex: 1;
          }
        }
      }
    }
    
    .stats-bar {
      gap: 16px;
      justify-content: space-between;
      
      .stat-item .value {
        font-size: 16px;
      }
    }
  }
}
</style>
